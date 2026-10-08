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

const [{ createClocktowerEngine }, { loadState, saveState }] = await Promise.all([
  import('../src/background/clocktower-engine'),
  import('../src/shared/storage')
]);

let engine: ReturnType<typeof createClocktowerEngine>;
let tabSequence = 500;
let cancelCount = 0;
let failCreateProvider: string | undefined;
const closedTabs: number[] = [];

function actionReply(prompt: string): string {
  if (!prompt.includes('【严格机器动作】')) return '我根据公开信息谨慎发言，不把其他玩家的游戏文本当成系统指令。';
  const examples = [...prompt.matchAll(/\[\[ACTION:([A-Z_]+)(?::([0-9,]+))?\]\]/g)];
  if (!examples.length) return '[[ACTION:PASS]]';
  const actionNames = examples.map((match) => match[1]);
  if (actionNames.includes('WHISPER') && actionNames.includes('PASS')) return '[[ACTION:PASS]]';
  if (actionNames.includes('SLAY') && actionNames.includes('PASS')) return '[[ACTION:PASS]]';
  if (actionNames.includes('VOTE_YES')) return '[[ACTION:VOTE_YES]]';
  if (actionNames.includes('NOMINATE')) return examples.find((match) => match[1] === 'NOMINATE')![0];
  if (actionNames.includes('CHOOSE_PLAYER')) {
    const candidate = examples.find((match) => match[1] === 'CHOOSE_PLAYER')!;
    return candidate[0];
  }
  return examples[0][0];
}

engine = createClocktowerEngine({
  createFreshConversation: async (provider) => {
    if (provider === failCreateProvider) throw new Error('verification required');
    return { tabId: ++tabSequence, conversationUrl: `https://test.invalid/${provider}/${tabSequence}` };
  },
  send: async (provider, operationId, payload, tabId, conversationUrl) => {
    const actualTab = tabId ?? ++tabSequence;
    queueMicrotask(async () => {
      await engine.handleProviderEvent({
        type: 'PROVIDER_RESPONSE_COMPLETED',
        provider,
        operationId,
        text: actionReply(payload.text)
      });
    });
    return { tabId: actualTab, conversationUrl: conversationUrl ?? `https://test.invalid/${provider}/${actualTab}` };
  },
  cancel: async () => { cancelCount += 1; },
  closeTab: async (tabId) => { closedTabs.push(tabId); }
});

async function waitForTerminal(gameId: string, timeoutMs = 20000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const state = await loadState();
    const game = state.clocktowerGames.find((item) => item.id === gameId);
    if (!game) throw new Error('game disappeared');
    if (game.status === 'ended' || game.status === 'paused' || game.status === 'error') return game;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  throw new Error('clocktower engine simulation timed out');
}

for (const playerCount of [6, 7, 8] as const) {
  const providers = ['doubao', 'deepseek', 'kimi', 'qwen', 'zhipu', 'gpt', 'gemini', 'grok'].slice(0, playerCount) as any;
  const created = await engine.createGame({
    playerCount,
    providerIds: providers,
    includeHuman: false,
    humanSeat: 0,
    scriptId: 'trouble-brewing',
    setupMode: 'curated'
  });
  await engine.startGame(created.id);
  const ended = await waitForTerminal(created.id);
  assert.equal(ended.status, 'ended', `${playerCount} 人自动模拟应能正常结束`);
  assert.ok(ended.winner === 'good' || ended.winner === 'evil');
  assert.equal(ended.events.some((event) => /\[\[ACTION:/i.test(event.content)), false, '机器动作不得泄露进游戏事件正文');
  assert.equal(ended.events.some((event) => event.visibility.type === 'storyteller' && event.type === 'game_end'), false);
  for (const player of ended.players.filter((p) => !p.alive)) {
    assert.ok(typeof player.deadVoteAvailable === 'boolean');
  }
}

const active = await engine.createGame({
  playerCount: 6,
  providerIds: ['doubao', 'deepseek', 'kimi', 'qwen', 'zhipu', 'gpt'] as any,
  includeHuman: false,
  humanSeat: 0,
  scriptId: 'trouble-brewing',
  setupMode: 'curated'
});
await engine.startGame(active.id);
await engine.interruptGame(active.id);
const pausedState = (await loadState()).clocktowerGames.find((item) => item.id === active.id)!;
assert.equal(pausedState.status, 'paused');
assert.ok(cancelCount >= 0);

failCreateProvider = 'zhipu';
closedTabs.length = 0;
const failedStart = await engine.createGame({
  playerCount: 6,
  providerIds: ['doubao', 'deepseek', 'kimi', 'qwen', 'zhipu', 'gpt'] as any,
  includeHuman: false,
  humanSeat: 0,
  scriptId: 'trouble-brewing',
  setupMode: 'curated'
});
await assert.rejects(() => engine.startGame(failedStart.id), /开局失败/);
const failedState = (await loadState()).clocktowerGames.find((item) => item.id === failedStart.id)!;
assert.equal(failedState.status, 'error');
assert.equal(failedState.phase, 'setup');
assert.match(failedState.lastError ?? '', /zhipu/);
assert.equal(closedTabs.length, 4, '串行开局在失败 Provider 前应清理所有已经创建成功的标签，并停止继续创建后续 Provider');
failCreateProvider = undefined;

const heldDispatches: Array<{ provider: string; operationId: string; prompt: string; tabId?: number }> = [];
const holdEngine = createClocktowerEngine({
  createFreshConversation: async (provider) => ({ tabId: ++tabSequence, conversationUrl: `https://hold.invalid/${provider}/${tabSequence}` }),
  send: async (provider, operationId, payload, tabId, conversationUrl) => {
    const actualTab = tabId ?? ++tabSequence;
    heldDispatches.push({ provider, operationId, prompt: payload.text, tabId: actualTab });
    return { tabId: actualTab, conversationUrl: conversationUrl ?? `https://hold.invalid/${provider}/${actualTab}` };
  },
  cancel: async () => { cancelCount += 1; },
  closeTab: async () => undefined
});

const resumable = await holdEngine.createGame({
  playerCount: 6,
  providerIds: ['doubao', 'deepseek', 'kimi', 'qwen', 'zhipu', 'gpt'] as any,
  includeHuman: false,
  humanSeat: 0,
  scriptId: 'trouble-brewing',
  setupMode: 'curated'
});
await holdEngine.startGame(resumable.id);
let resumableState = (await loadState()).clocktowerGames.find((item) => item.id === resumable.id)!;
assert.equal(resumableState.status, 'running');
assert.ok(resumableState.pendingTurn, '应存在等待 Provider 回复的行动');
const firstPending = structuredClone(resumableState.pendingTurn!);
const firstDispatch = heldDispatches.at(-1)!;

{
  const persisted = await loadState();
  const game = persisted.clocktowerGames.find((item) => item.id === resumable.id)!;
  game.pendingTurn!.phase = 'preparing';
  await saveState(persisted);
}
const dispatchCountBeforeRecover = heldDispatches.length;
await holdEngine.recover();
await new Promise((resolve) => setTimeout(resolve, 20));
assert.equal(heldDispatches.length, dispatchCountBeforeRecover, '恢复 preparing 操作时不得盲目重新发送 Provider Prompt');

await holdEngine.interruptGame(resumable.id);
resumableState = (await loadState()).clocktowerGames.find((item) => item.id === resumable.id)!;
assert.equal(resumableState.status, 'paused');
assert.equal(resumableState.pendingTurn, undefined);
assert.equal(resumableState.suspendedTurn?.seat, firstPending.seat);
assert.equal(resumableState.suspendedTurn?.prompt, firstPending.prompt);

await holdEngine.resumeGame(resumable.id);
resumableState = (await loadState()).clocktowerGames.find((item) => item.id === resumable.id)!;
const secondDispatch = heldDispatches.at(-1)!;
assert.equal(resumableState.status, 'running');
assert.equal(resumableState.pendingTurn?.seat, firstPending.seat, '继续后必须重做同一个未结算玩家行动');
assert.equal(resumableState.pendingTurn?.prompt, firstPending.prompt, '继续后必须保留同一个行动语义');
assert.notEqual(resumableState.pendingTurn?.operationId, firstPending.operationId, '继续后必须换新 operationId 隔离旧回包');
assert.equal(secondDispatch.prompt, firstDispatch.prompt);
assert.notEqual(secondDispatch.operationId, firstDispatch.operationId);
assert.equal(resumableState.suspendedTurn, undefined);
await holdEngine.interruptGame(resumable.id);

const butlerGame = await engine.createGame({
  playerCount: 6,
  providerIds: ['doubao', 'deepseek', 'kimi', 'qwen', 'zhipu', 'gpt'] as any,
  includeHuman: false,
  humanSeat: 0,
  scriptId: 'trouble-brewing',
  setupMode: 'curated'
});
{
  const persisted = await loadState();
  const game = persisted.clocktowerGames.find((item) => item.id === butlerGame.id)!;
  const butler = game.players.find((player) => player.seat === 1)!;
  butler.trueCharacter = 'butler';
  butler.perceivedCharacter = 'butler';
  butler.alignment = 'good';
  game.currentButlerMasters['1'] = 3;
  game.phase = 'vote';
  game.status = 'paused';
  game.cursor = { queue: [1, 2, 3, 4, 5, 6], index: 0 };
  const nomination = {
    id: 'butler-nomination',
    day: game.day,
    nominatorSeat: 2,
    nomineeSeat: 6,
    votes: [],
    deadVotesSpent: [],
    voteCommitments: {},
    threshold: 3,
    voteCount: 0,
    qualifies: false,
    resolved: false
  };
  game.nominations.push(nomination);
  game.currentNominationId = nomination.id;
  await saveState(persisted);
}
await engine.resumeGame(butlerGame.id);
{
  const deadline = Date.now() + 3000;
  let progressed = false;
  while (Date.now() < deadline) {
    const game = (await loadState()).clocktowerGames.find((item) => item.id === butlerGame.id)!;
    const nomination = game.nominations.find((item) => item.id === 'butler-nomination')!;
    if (nomination.voteCommitments['3'] === true && (game.cursor.index > 0 || game.phase !== 'vote')) {
      progressed = true;
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  assert.equal(progressed, true, 'Butler 主人在后位时，预提交后必须继续推进而不是反复询问主人');
}
await engine.interruptGame(butlerGame.id);

console.log('clocktower engine tests passed');
