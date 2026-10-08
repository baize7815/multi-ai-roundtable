import { loadState, saveState } from '../shared/storage';
import { providerById } from '../shared/providers';
import type { ComposerPayload, PersistedState, ProviderEvent, ProviderId } from '../shared/types';
import { createCouncilGame, startCouncilGame, openCouncilDebate, submitCouncilSpeech, submitCouncilBallot, pauseCouncilGame, resumeCouncilGame } from '../game/fog-council/core';
import { buildCouncilSeatContext } from '../game/fog-council/context';
import { parseCouncilFinalAnswer } from '../game/fog-council/actions';
import type { FogCouncilSetup, FogCouncilSession, FogCouncilSubmission, FogCouncilPendingTurn } from '../game/fog-council/session';

interface Bridge {
  createFreshConversation(provider: ProviderId, tabId?: number): Promise<{ tabId: number; conversationUrl?: string }>;
  send(provider: ProviderId, operationId: string, payload: ComposerPayload, tabId?: number, url?: string): Promise<{ tabId: number; conversationUrl?: string }>;
  cancel(provider: ProviderId, operationId?: string, tabId?: number): Promise<void>;
  closeTab(tabId: number): Promise<void>;
}
const queues = new Map<string, Promise<void>>();

function announce(gameId?: string): void {
  chrome.runtime.sendMessage({ source: 'background', type: 'STATE_UPDATED', fogCouncilGameId: gameId }).catch(() => undefined);
}

function getGame(state: PersistedState, id: string): FogCouncilSession {
  const game = state.fogCouncilGames.find(g => g.id === id);
  if (!game) throw new Error('迷雾议会对局不存在');
  return game;
}

function mutate<T>(operation: (s: PersistedState) => Promise<T> | T): Promise<T> {
  const previous = queues.get('all') ?? Promise.resolve();
  const run = previous.catch(() => undefined).then(async () => {
    const state = await loadState();
    const result = await operation(state);
    await saveState(state);
    return result;
  });
  queues.set('all', run.then(() => undefined, () => undefined));
  return run;
}

function nextSeat(game: FogCouncilSession): number | undefined {
  if (!game.current || game.status !== 'running') return undefined;
  if (game.phase === 'debate') return Object.keys(game.current.speeches).length + 1;
  if (game.phase === 'ballot') return game.players.find(p => !(p.seat in game.current!.ballots))?.seat;
  return undefined;
}

export function createFogCouncilEngine(bridge: Bridge) {
  async function drive(id: string): Promise<void> {
    for (let iteration = 0; iteration < 30; iteration++) {
      const command = await mutate(state => {
        const game = getGame(state, id);
        if (game.status !== 'running' || game.pendingTurn || game.pendingHumanAction) return null;
        if (game.phase === 'briefing') {
          Object.assign(game, openCouncilDebate(game));
        }
        const seat = nextSeat(game);
        if (!seat || !game.current) return null;
        if (game.humanSeat === seat) {
          game.pendingHumanAction = { seat, kind: game.phase === 'ballot' ? 'vote' : 'speech' };
          game.updatedAt = Date.now();
          return null;
        }
        const provider = game.seatProviders[seat];
        if (!provider) throw new Error('议席缺少 AI 网页绑定');
        const operation: FogCouncilPendingTurn = {
          operationId: 'fog-' + crypto.randomUUID(),
          playerId: 'seat-' + seat,
          seat, provider,
          kind: game.phase === 'ballot' ? 'vote' : 'speech',
          phase: 'preparing',
          prompt: buildCouncilSeatContext(game, seat),
          startedAt: Date.now()
        };
        game.pendingTurn = operation;
        game.updatedAt = Date.now();
        return { operation, binding: game.bindings[operation.playerId] };
      });
      announce(id);
      if (!command) return;
      const { operation, binding } = command;
      const payload: ComposerPayload = { text: operation.prompt, attachments: [] };
      try {
        const result = await bridge.send(operation.provider, operation.operationId, payload, binding?.tabId, binding?.conversationUrl);
        await mutate(state => {
          const game = getGame(state, id);
          if (game.pendingTurn?.operationId !== operation.operationId) return;
          game.bindings[operation.playerId] = { provider: operation.provider, tabId: result.tabId, conversationUrl: result.conversationUrl };
          game.pendingTurn.phase = 'active';
          game.updatedAt = Date.now();
        });
      } catch (error) {
        await pauseOnError(operation.operationId, error instanceof Error ? error.message : String(error));
      }
      announce(id);
      return;
    }
    throw new Error('议会驱动循环超出限制');
  }

  async function pauseOnError(operationId: string, error: string): Promise<void> {
    let id: string | undefined;
    await mutate(state => {
      const game = state.fogCouncilGames.find(g => g.pendingTurn?.operationId === operationId);
      if (!game) return;
      id = game.id;
      game.status = 'paused';
      game.errorMessage = error;
      // Keep the pending record: do not retry an ambiguous provider submission.
      game.updatedAt = Date.now();
    });
    if (id) announce(id);
  }

  async function createGame(setup: FogCouncilSetup): Promise<FogCouncilSession> {
    if (![6, 7, 8].includes(setup.playerCount)) throw new Error('人数应为 6–8');
    const needed = setup.playerCount - (setup.includeHuman ? 1 : 0);
    if (setup.providerIds.length < needed) throw new Error('AI 模型不足');
    const ids = setup.providerIds.slice(0, needed);
    if (new Set(ids).size !== ids.length || ids.some(id => !providerById[id]?.enabled)) throw new Error('必须选择不重复的有效模型');
    const core = createCouncilGame(setup.playerCount, crypto.getRandomValues(new Uint32Array(1))[0]);
    const humanSeat = setup.includeHuman ? (setup.humanSeat || (core.seed % setup.playerCount) + 1) : undefined;
    const seatProviders: Record<number, ProviderId> = {};
    let index = 0;
    for (const player of core.players) if (player.seat !== humanSeat) seatProviders[player.seat] = ids[index++];
    const now = Date.now();
    const game: FogCouncilSession = {
      ...core,
      id: 'fog-council-' + crypto.randomUUID(),
      title: setup.playerCount + ' 人迷雾议会 · ' + new Date(now).toLocaleString('zh-CN'),
      createdAt: now, updatedAt: now,
      bindings: {}, seatProviders, humanSeat
    };
    await mutate(state => {
      state.fogCouncilGames.push(game);
      state.activeFogCouncilGameId = game.id;
      state.activeMode = 'fog_council';
    });
    announce(game.id);
    return game;
  }

  async function updateSetup(setup: FogCouncilSetup): Promise<void> {
    await mutate(state => {
      state.fogCouncilSetup = { ...setup };
      state.settings.fogCouncilProviders = [...setup.providerIds];
    });
  }

  async function setActiveGame(id?: string): Promise<void> {
    await mutate(state => {
      if (id) getGame(state, id);
      state.activeFogCouncilGameId = id;
      state.activeMode = 'fog_council';
    });
  }

  async function startGame(id: string): Promise<void> {
    const original = getGame(await loadState(), id);
    if (original.status !== 'setup') throw new Error('只能启动新创建的议会');
    const opened: number[] = [];
    try {
      for (const player of original.players) {
        const provider = original.seatProviders[player.seat];
        if (!provider) continue;
        const binding = await bridge.createFreshConversation(provider);
        opened.push(binding.tabId);
        await mutate(state => {
          getGame(state, id).bindings['seat-' + player.seat] = { provider, ...binding };
        });
      }
      await mutate(state => {
        const game = getGame(state, id);
        Object.assign(game, startCouncilGame(game));
        game.updatedAt = Date.now();
      });
      announce(id);
      await drive(id);
    } catch (error) {
      await mutate(state => {
        const game = getGame(state, id);
        game.status = 'paused';
        game.errorMessage = '议会初始化失败：' + (error instanceof Error ? error.message : String(error));
        game.updatedAt = Date.now();
        game.bindings = {};
      });
      await Promise.allSettled(opened.map(tabId => bridge.closeTab(tabId)));
      announce(id);
      throw error;
    }
  }

  async function attachBinding(operationId: string, provider: ProviderId, tabId: number, url?: string): Promise<void> {
    await mutate(state => {
      const game = state.fogCouncilGames.find(g => g.pendingTurn?.operationId === operationId);
      if (!game || game.pendingTurn!.provider !== provider) return;
      game.bindings[game.pendingTurn!.playerId] = { provider, tabId, conversationUrl: url };
    });
  }

  async function handleProviderEvent(event: ProviderEvent): Promise<boolean> {
    if (!event.operationId || !['PROVIDER_RESPONSE_COMPLETED', 'PROVIDER_ERROR'].includes(event.type)) return false;
    const state = await loadState();
    const game = state.fogCouncilGames.find(g => g.pendingTurn?.operationId === event.operationId && g.pendingTurn?.provider === event.provider);
    if (!game) return false;
    if (event.type === 'PROVIDER_ERROR') {
      await pauseOnError(event.operationId, event.error || 'AI 网页发生错误');
      return true;
    }
    try {
      const action = parseCouncilFinalAnswer(event.text || '', game.pendingTurn!.kind === 'vote' ? 'ballot' : 'debate');
      await mutate(state => {
        const current = getGame(state, game.id);
        const pending = current.pendingTurn;
        if (!pending || pending.operationId !== event.operationId || current.status !== 'running') return;
        if (action.type === 'speech' && pending.kind === 'speech') {
          Object.assign(current, submitCouncilSpeech(current, pending.seat, action.text, pending.operationId));
        } else if (action.type === 'vote' && pending.kind === 'vote') {
          Object.assign(current, submitCouncilBallot(current, pending.seat, action.channel, pending.operationId));
        } else throw new Error('AI 回复与当前阶段不匹配');
        current.pendingTurn = undefined;
        current.updatedAt = Date.now();
      });
      announce(game.id);
      void drive(game.id).catch(console.error);
    } catch (error) {
      await pauseOnError(event.operationId, error instanceof Error ? error.message : String(error));
    }
    return true;
  }

  async function submitHumanAction(id: string, submission: FogCouncilSubmission): Promise<void> {
    await mutate(state => {
      const game = getGame(state, id);
      const pending = game.pendingHumanAction;
      if (!pending || game.status !== 'running') throw new Error('当前没有等待你的议会动作');
      const key = 'human-' + game.round + '-' + pending.kind + '-' + pending.seat;
      if (pending.kind === 'speech' && submission.text?.trim()) {
        Object.assign(game, submitCouncilSpeech(game, pending.seat, submission.text, key));
      } else if (pending.kind === 'vote' && ['A', 'B', 'C'].includes(String(submission.channel))) {
        Object.assign(game, submitCouncilBallot(game, pending.seat, submission.channel!, key));
      } else throw new Error('请输入合法的发言或选择频道');
      game.pendingHumanAction = undefined;
      game.updatedAt = Date.now();
    });
    announce(id);
    await drive(id);
  }

  async function interruptGame(id: string): Promise<void> {
    const before = getGame(await loadState(), id);
    if (before.status !== 'running') return;
    await mutate(state => {
      const game = getGame(state, id);
      Object.assign(game, pauseCouncilGame(game));
      game.updatedAt = Date.now();
    });
    if (before.pendingTurn) await bridge.cancel(before.pendingTurn.provider, before.pendingTurn.operationId, before.bindings[before.pendingTurn.playerId]?.tabId).catch(() => undefined);
    announce(id);
  }

  async function resumeGame(id: string): Promise<void> {
    await mutate(state => {
      const game = getGame(state, id);
      if (game.pendingTurn) throw new Error('之前的网页操作尚未确认完成，为避免重复发送，不能直接继续；请新开一局');
      Object.assign(game, resumeCouncilGame(game));
      game.errorMessage = undefined;
      game.updatedAt = Date.now();
    });
    announce(id);
    await drive(id);
  }

  async function recover(_redispatch = false): Promise<void> {
    const state = await loadState();
    for (const game of state.fogCouncilGames) {
      if (game.status !== 'running') continue;
      if (game.pendingTurn?.phase === 'preparing') {
        await pauseOnError(game.pendingTurn.operationId, '后台重启时无法确认网页是否已提交，已暂停防止重复动作');
      } else if (!game.pendingTurn && !game.pendingHumanAction) await drive(game.id);
    }
  }

  async function deleteGame(id: string): Promise<void> {
    const game = getGame(await loadState(), id);
    if (game.status === 'running' || game.pendingTurn) throw new Error('请先中断并确认网页操作结束');
    await mutate(state => {
      state.fogCouncilGames = state.fogCouncilGames.filter(g => g.id !== id);
      if (state.activeFogCouncilGameId === id) state.activeFogCouncilGameId = undefined;
    });
    await Promise.allSettled(Object.values(game.bindings).map(binding => bridge.closeTab(binding.tabId)));
    announce();
  }

  return { createGame, updateSetup, setActiveGame, startGame, attachBinding, handleProviderEvent, submitHumanAction, interruptGame, resumeGame, recover, deleteGame };
}
