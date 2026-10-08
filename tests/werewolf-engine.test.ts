import assert from 'node:assert/strict';

const storageData: Record<string, unknown> = {};

function storageGet(keys: string | string[] | Record<string, unknown> | null): Record<string, unknown> {
  if (keys === null) return { ...storageData };
  if (typeof keys === 'string') return keys in storageData ? { [keys]: storageData[keys] } : {};
  if (Array.isArray(keys)) return Object.fromEntries(keys.filter((key) => key in storageData).map((key) => [key, storageData[key]]));
  return Object.fromEntries(Object.entries(keys).map(([key, fallback]) => [key, key in storageData ? storageData[key] : fallback]));
}

(globalThis as any).chrome = {
  storage: {
    local: {
      get: async (keys: any) => storageGet(keys),
      set: async (value: Record<string, unknown>) => { Object.assign(storageData, structuredClone(value)); }
    }
  },
  runtime: { sendMessage: async () => undefined }
};

const [{ createWerewolfEngine }, { loadState }] = await Promise.all([
  import('../src/background/werewolf-engine'),
  import('../src/shared/storage')
]);

let engine: ReturnType<typeof createWerewolfEngine>;
let tabSequence = 200;
const reasoningMarker = 'INTERNAL_REASONING_MUST_NEVER_COMMIT';
let autoComplete = true;
let invalidNextMachineAction = false;
let formatRepairCount = 0;
let cancelCount = 0;
let activeVoteSends = 0;
let maxConcurrentVoteSends = 0;

function replyForPrompt(prompt: string): string {
  if (!prompt.includes('[MACHINE ACTION]')) return '我只根据当前允许看到的信息发言，并继续推进本局。';
  const machineSection = prompt.slice(prompt.lastIndexOf('[MACHINE ACTION]'));
  const actions = [...machineSection.matchAll(/\[\[ACTION\s*:\s*([A-Z_]+)(?::\s*(\d+))?\s*\]\]/g)];
  const selected = actions[0]?.[0];
  if (!selected) return '格式测试失败';
  return selected;
}

engine = createWerewolfEngine({
  createFreshConversation: async (provider) => ({ tabId: ++tabSequence, conversationUrl: `https://test.invalid/${provider}/${tabSequence}` }),
  send: async (provider, operationId, payload, tabId, conversationUrl) => {
    const actualTab = tabId ?? ++tabSequence;
    if (payload.text.includes('[FORMAT REPAIR]')) formatRepairCount += 1;
    const voteTurn = /\[\[ACTION\s*:\s*VOTE:/i.test(payload.text);
    if (voteTurn) {
      activeVoteSends += 1;
      maxConcurrentVoteSends = Math.max(maxConcurrentVoteSends, activeVoteSends);
    }
    if (autoComplete) setTimeout(() => { void (async () => {
      try {
        await engine.handleProviderEvent({ type: 'PROVIDER_RESPONSE_STARTED', provider, operationId });
        await engine.handleProviderEvent({ type: 'PROVIDER_RESPONSE_DELTA', provider, operationId, text: reasoningMarker });
        const machineTurn = payload.text.includes('[MACHINE ACTION]');
        const text = machineTurn && invalidNextMachineAction
          ? '这次故意不给机器动作，用于验证自动修复。'
          : replyForPrompt(payload.text);
        if (machineTurn && invalidNextMachineAction) invalidNextMachineAction = false;
        const completed = { type: 'PROVIDER_RESPONSE_COMPLETED' as const, provider, operationId, text };
        await engine.handleProviderEvent(completed);
        await engine.handleProviderEvent(completed);
      } finally {
        if (voteTurn) activeVoteSends -= 1;
      }
    })(); }, voteTurn ? 5 : 0);
    return { tabId: actualTab, conversationUrl: conversationUrl ?? `https://test.invalid/${provider}/${actualTab}` };
  },
  cancel: async () => { cancelCount += 1; }
});

async function waitForTerminal(gameId: string, timeoutMs = 8000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const state = await loadState();
    const current = state.werewolfGames.find((game) => game.id === gameId);
    if (!current) throw new Error('模拟对局意外丢失');
    if (current.status === 'ended') return current;
    if (current.status === 'paused' || current.status === 'error') throw new Error(`模拟对局异常停止：${current.lastError ?? current.status}`);
    await new Promise((resolve) => setTimeout(resolve, 2));
  }
  throw new Error('模拟对局超时');
}

const providerPool = ['doubao', 'deepseek', 'kimi', 'qwen', 'zhipu', 'gpt', 'gemini', 'grok'] as const;

for (const playerCount of [6, 7, 8] as const) {
  const created = await engine.createGame({
    playerCount,
    providerIds: providerPool.slice(0, playerCount),
    includeHuman: false,
    humanSeat: 0,
    presetId: `werewolf-v1-${playerCount}`
  });
  await engine.startGame(created.id);
  const ended = await waitForTerminal(created.id);
  assert.ok(ended.winner === 'wolf' || ended.winner === 'village');
  assert.equal(ended.players.filter((player) => player.lifeState === 'alive').length > 0, true);
  assert.equal(ended.events.some((event) => event.content.includes(reasoningMarker)), false, 'streaming/reasoning delta 不得进入 GameEvent');
  assert.equal(ended.events.some((event) => /<action>|\[\[ACTION/i.test(event.content)), false, '机器动作标记不得进入可显示游戏事件');
  assert.equal(new Set(ended.committedActionIds).size, ended.committedActionIds.length, '动作提交必须 exactly-once');
}
assert.equal(maxConcurrentVoteSends, 1, '游戏隐藏投票必须串行调度 Provider，避免多个后台网页互相抢占活跃状态');

invalidNextMachineAction = true;
formatRepairCount = 0;
const retryGame = await engine.createGame({
  playerCount: 6,
  providerIds: providerPool.slice(0, 6),
  includeHuman: false,
  humanSeat: 0,
  presetId: 'werewolf-v1-6'
});
await engine.startGame(retryGame.id);
await waitForTerminal(retryGame.id);
assert.ok(formatRepairCount >= 1, '非法机器动作应自动进入一次 FORMAT REPAIR 重试');

autoComplete = false;
const pausedGame = await engine.createGame({
  playerCount: 6,
  providerIds: providerPool.slice(0, 6),
  includeHuman: false,
  humanSeat: 0,
  presetId: 'werewolf-v1-6'
});
await engine.startGame(pausedGame.id);
const beforePause = (await loadState()).werewolfGames.find((game) => game.id === pausedGame.id)!;
assert.ok(beforePause.pendingTurn, '暂停测试需要先进入一个 AI pending turn');
const cursorBeforePause = structuredClone(beforePause.cursor);
const cancelBefore = cancelCount;
await engine.interruptGame(pausedGame.id);
const paused = (await loadState()).werewolfGames.find((game) => game.id === pausedGame.id)!;
assert.equal(paused.status, 'paused');
assert.equal(paused.pendingTurn, undefined);
assert.deepEqual(paused.cursor, cursorBeforePause, '中断不得推进尚未完成的 turn cursor');
assert.ok(cancelCount > cancelBefore, '中断正在生成的 AI turn 必须调用 Provider cancel');
autoComplete = true;
await engine.resumeGame(pausedGame.id);
await waitForTerminal(pausedGame.id);

const humanGame = await engine.createGame({
  playerCount: 6,
  providerIds: providerPool.slice(0, 5),
  includeHuman: true,
  humanSeat: 3,
  presetId: 'werewolf-v1-6'
});
await engine.startGame(humanGame.id);
const humanDeadline = Date.now() + 8000;
let humanEnded: Awaited<ReturnType<typeof waitForTerminal>> | undefined;
while (Date.now() < humanDeadline) {
  const current = (await loadState()).werewolfGames.find((game) => game.id === humanGame.id)!;
  if (current.status === 'ended') { humanEnded = current; break; }
  if (current.status === 'paused' || current.status === 'error') throw new Error(`人类玩家模拟局异常停止：${current.lastError ?? current.status}`);
  if (current.pendingHumanAction && (current.status === 'waiting_human' || (current.status === 'running' && current.pendingHumanAction.kind === 'vote'))) {
    const pending = current.pendingHumanAction;
    if (!pending.expectedActions.length) {
      await engine.submitHumanAction(current.id, { text: '这是人类玩家的测试发言。' });
    } else {
      const actionType = pending.expectedActions[0];
      const targetSeat = actionType === 'pass'
        ? undefined
        : actionType === 'save'
          ? current.night.wolfTarget
          : actionType === 'poison'
            ? pending.allowedTargets.find((seat) => seat !== pending.seat)
            : pending.allowedTargets[0];
      await engine.submitHumanAction(current.id, {
        actionType,
        targetSeat
      });
    }
    continue;
  }
  await new Promise((resolve) => setTimeout(resolve, 2));
}
assert.ok(humanEnded, '人类玩家参与的模拟局必须完整结束');
assert.equal(humanEnded!.players.find((player) => player.controller === 'human')?.seat, 3);

console.log('werewolf engine simulations passed');
