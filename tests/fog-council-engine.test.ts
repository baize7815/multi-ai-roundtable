import assert from 'node:assert/strict';

const memory: Record<string, unknown> = {};
const storageGet = (keys: string | string[] | Record<string, unknown> | null): Record<string, unknown> => {
  if (keys === null) return { ...memory };
  if (typeof keys === 'string') return keys in memory ? { [keys]: memory[keys] } : {};
  if (Array.isArray(keys)) return Object.fromEntries(keys.filter(key => key in memory).map(key => [key, memory[key]]));
  return Object.fromEntries(Object.entries(keys).map(([key, fallback]) => [key, key in memory ? memory[key] : fallback]));
};
(globalThis as any).chrome = {
  storage: { local: { get: async (keys: any) => storageGet(keys),
    set: async (values: Record<string, unknown>) => { Object.assign(memory, structuredClone(values)); } } },
  runtime: { sendMessage: async () => undefined }
};

const [{ createFogCouncilEngine }, { loadState, saveState }] = await Promise.all([
  import('../src/background/fog-council-engine'),
  import('../src/shared/storage')
]);
let engine: ReturnType<typeof createFogCouncilEngine>;
let tabId = 800;
let sendCount = 0;
let cancelCount = 0;
let closeCount = 0;
let autoReply = true;
let currentGameId = '';
let concurrent = 0;
let maxConcurrent = 0;

engine = createFogCouncilEngine({
  createFreshConversation: async provider => ({ tabId: ++tabId, conversationUrl: 'https://mock.invalid/' + provider + '/' + tabId }),
  send: async (provider, operationId, payload, tab, url) => {
    sendCount++;
    concurrent++;
    maxConcurrent = Math.max(maxConcurrent, concurrent);
    assert.ok(payload.text.includes('[YOUR PRIVATE CARD]'));
    assert.ok(payload.text.includes('[THIS TURN]'));
    const bound = tab ?? ++tabId;
    if (autoReply) {
      setTimeout(() => { void (async () => {
        const s = await loadState();
        const game = s.fogCouncilGames.find(g => g.pendingTurn?.operationId === operationId)!;
        if (!game) return;
        const text = game.pendingTurn!.kind === 'speech'
          ? '我建议认真核对各席线索。\n[[COUNCIL:SPEAK]]'
          : '[[COUNCIL:VOTE:' + game.current!.channel + ']]';
        await engine.handleProviderEvent({ type: 'PROVIDER_RESPONSE_STARTED', provider, operationId, text: 'THOUGHT_DO_NOT_DISPLAY' });
        await engine.handleProviderEvent({ type: 'PROVIDER_RESPONSE_COMPLETED', provider, operationId, text });
        await engine.handleProviderEvent({ type: 'PROVIDER_RESPONSE_COMPLETED', provider, operationId, text });
      })().finally(() => { concurrent--; }); }, 0);
    } else {
      concurrent--;
    }
    return { tabId: bound, conversationUrl: url || 'https://mock.invalid/' + provider + '/' + bound };
  },
  cancel: async () => { cancelCount++; },
  closeTab: async () => { closeCount++; }
});

async function awaitGame(gameId: string, condition: (game: Awaited<ReturnType<typeof loadState>>['fogCouncilGames'][number]) => boolean, timeout = 15000) {
  const until = Date.now() + timeout;
  while (Date.now() < until) {
    const state = await loadState();
    const game = state.fogCouncilGames.find(g => g.id === gameId);
    if (!game) throw new Error('Game disappeared');
    if (condition(game)) return game;
    if (game.status === 'paused' && game.errorMessage) throw new Error(game.errorMessage);
    await new Promise(r => setTimeout(r, 2));
  }
  throw new Error('Fog council engine timed out');
}

const pool = ['doubao', 'deepseek', 'kimi', 'qwen', 'zhipu', 'gpt', 'gemini', 'grok'] as const;
for (const count of [6, 7, 8] as const) {
  const created = await engine.createGame({ playerCount: count, providerIds: pool.slice(0, count), includeHuman: false, humanSeat: 0 });
  currentGameId = created.id;
  await engine.startGame(created.id);
  const ended = await awaitGame(created.id, game => game.status === 'ended');
  assert.equal(ended.winner, 'clarity');
  assert.equal(ended.round, 3);
  assert.equal(ended.clarityScore, 3);
  assert.equal(ended.pendingTurn, undefined);
  assert.equal(ended.events.some(e => e.text.includes('THOUGHT_DO_NOT_DISPLAY')), false);
  assert.equal(ended.events.filter(e => e.type === 'speech').length, count * 3);
  assert.equal(ended.events.filter(e => e.type === 'reveal').length, 3);
  assert.equal(ended.committedOperationIds.length, count * 6);
  assert.equal(new Set(ended.committedOperationIds).size, count * 6);
  assert.equal(ended.events.filter(e => e.type === 'sealed_vote' && e.actorSeat).every(e => e.visibility.type === 'seat'), true);
}
assert.equal(maxConcurrent, 1, 'game dispatch must remain serial per game');

const human = await engine.createGame({playerCount:6,providerIds:pool.slice(0,5),includeHuman:true,humanSeat:3});
await engine.startGame(human.id);
let game = await awaitGame(human.id,g=>g.pendingHumanAction?.seat===3);
assert.equal(game.pendingHumanAction?.kind,'speech');
await engine.submitHumanAction(human.id,{text:'我将根据公开线索作出判断。'});
game = await awaitGame(human.id,g=>g.pendingHumanAction?.seat===3 && g.pendingHumanAction.kind==='vote');
await engine.submitHumanAction(human.id,{channel:game.current!.channel});
game = await awaitGame(human.id,g=>g.round>=2);
assert.equal(game.clarityScore,1);
assert.equal(game.seatProviders[3],undefined);
assert.equal(game.events.filter(e=>e.visibility.type==='seat' && e.visibility.seat!==3).length>0,true);

autoReply = false;
const stalled = await engine.createGame({playerCount:6,providerIds:pool.slice(0,6),includeHuman:false,humanSeat:0});
await engine.startGame(stalled.id);
const pending = await awaitGame(stalled.id,g=>Boolean(g.pendingTurn));
assert.ok(pending.pendingTurn);
const initialCount=sendCount;
const stored=await loadState();
const current=stored.fogCouncilGames.find(g=>g.id===stalled.id)!;
current.pendingTurn!.phase='preparing';
await saveState(stored);
await engine.recover();
const paused=await awaitGame(stalled.id,g=>g.status==='paused');
assert.equal(paused.pendingTurn?.operationId,pending.pendingTurn?.operationId);
assert.equal(sendCount,initialCount,'never blindly resend ambiguous provider prompt');
await assert.rejects(engine.resumeGame(stalled.id),/不能直接继续/);
assert.equal(cancelCount,0);
assert.equal(closeCount,0);

console.log('fog council engine mock: six-seven-eight AI games, human turns, hidden votes, exactly once, crash-safe pause passed');
