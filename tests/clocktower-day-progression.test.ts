import assert from 'node:assert/strict';
import { createClocktowerGame } from '../src/game/clocktower/setup';
import type { ProviderId } from '../src/shared/types';

const storage: Record<string, unknown> = {};
function read(keys: any): Record<string, unknown> {
  if (keys === null) return { ...storage };
  if (typeof keys === 'string') return keys in storage ? { [keys]: storage[keys] } : {};
  if (Array.isArray(keys)) return Object.fromEntries(keys.filter((key) => key in storage).map((key) => [key, storage[key]]));
  return Object.fromEntries(Object.entries(keys).map(([k, v]) => [k, k in storage ? storage[k] : v]));
}
(globalThis as any).chrome = {
  storage: { local: {
    get: async (keys: any) => read(keys),
    set: async (data: Record<string, unknown>) => { Object.assign(storage, structuredClone(data)); }
  }},
  runtime: { sendMessage: async () => undefined }
};

const [{ createClocktowerEngine }, { loadState, saveState }] = await Promise.all([
  import('../src/background/clocktower-engine'), import('../src/shared/storage')
]);

const setup = {
  playerCount: 6 as const,
  providerIds: ['doubao','deepseek','kimi','qwen','zhipu'] as ProviderId[],
  includeHuman: true,
  humanSeat: 1,
  scriptId: 'trouble-brewing' as const,
  setupMode: 'curated' as const
};
const game = createClocktowerGame(setup, 2468);
game.status = 'running';
game.day = 1;
game.phase = 'day_whispers';
game.phaseId = 'test-day-whispers';
game.cursor = { queue: game.players.map((player) => player.seat), index: 0, stage: 'whisper_init' };
const state = await loadState();
state.clocktowerGames.push(game);
await saveState(state);

let engine: ReturnType<typeof createClocktowerEngine>;
let serial = 2000;
engine = createClocktowerEngine({
  createFreshConversation: async () => ({ tabId: ++serial }),
  send: async (provider, operationId, payload) => {
    const reply = payload.text.includes('请私密回复一次') ? '这是仅对双方可见的私聊回复' : '[[ACTION:PASS]]';
    setTimeout(() => { void engine.handleProviderEvent({
      type: 'PROVIDER_RESPONSE_COMPLETED', provider, operationId, text: reply
    }); }, 0);
    return { tabId: ++serial };
  },
  cancel: async () => undefined,
  closeTab: async () => undefined
});
async function waitHuman(kind: 'whisper' | 'speech'): Promise<void> {
  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) {
    const active = (await loadState()).clocktowerGames.find((item) => item.id === game.id)!;
    if (active.pendingHumanAction?.kind === kind) return;
    if (active.status === 'paused' || active.status === 'error') throw new Error(active.lastError);
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error('Waiting for human ' + kind + ' timed out');
}
await engine.recover(false);
await waitHuman('whisper');
let current = (await loadState()).clocktowerGames.find((item) => item.id === game.id)!;
assert.equal(current.phase, 'day_whispers');
assert.ok(current.pendingHumanAction?.expectedActions.includes('pass'), '白天私聊是可选行动');
assert.ok(current.pendingHumanAction?.expectedActions.includes('whisper'));
await engine.submitHumanAction(game.id, {
  actionType: 'whisper', targetSeats: [2], text: '这是我的私聊'
});
await waitHuman('speech');
current = (await loadState()).clocktowerGames.find((item) => item.id === game.id)!;
assert.equal(current.phase, 'day_discussion', '私聊完成后应进入公开讨论');
const first = current.events.find((event) => event.content === '这是我的私聊');
const answer = current.events.find((event) => event.content === '这是仅对双方可见的私聊回复');
assert.deepEqual(first?.visibility, { type: 'private', seats: [1, 2] }, '人类私聊不应被其他玩家看到');
assert.deepEqual(answer?.visibility, { type: 'private', seats: [2, 1] }, 'AI 的私聊回复只能对双方可见');
await engine.submitHumanAction(game.id, { text: '现在我正在公开讨论' });
current = (await loadState()).clocktowerGames.find((item) => item.id === game.id)!;
const speech = current.events.find((event) => event.content === '现在我正在公开讨论');
assert.equal(speech?.visibility.type, 'public', '公开发言必须对全体玩家可见');
console.log('clocktower whisper, private response, public speech progression tests passed');
