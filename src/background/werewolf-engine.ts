import { providerById } from '../shared/providers';
import { loadState } from '../shared/storage';
import type { ComposerPayload, PersistedState, ProviderEvent, ProviderId } from '../shared/types';
import { parseWerewolfAction, validateWerewolfAction } from '../game/werewolf/actions';
import { buildWerewolfPrompt } from '../game/werewolf/context';
import {
  addGameEvent,
  aliveByRole,
  alivePlayers,
  aliveSeats,
  checkWinner,
  createWerewolfGame,
  markDead,
  playerBySeat,
  roleRevealSummary,
  setGamePhase,
  stableChoice,
  uniqueHighestTarget
} from '../game/werewolf/core';
import type {
  ParsedWerewolfAction,
  WerewolfActionType,
  WerewolfDeathRecord,
  WerewolfGameSession,
  WerewolfPendingHumanAction,
  WerewolfPendingTurn,
  WerewolfSetupSettings,
  WerewolfTurnKind
} from '../game/werewolf/types';
import { mutatePersistedState } from './state-store';

export interface WerewolfProviderBridge {
  createFreshConversation(provider: ProviderId, preferredTabId?: number): Promise<{ tabId: number; conversationUrl?: string }>;
  send(provider: ProviderId, operationId: string, payload: ComposerPayload, tabId?: number, conversationUrl?: string): Promise<{ tabId: number; conversationUrl?: string }>;
  cancel(provider: ProviderId, operationId?: string, tabId?: number): Promise<void>;
}

interface TurnSpec {
  seat: number;
  kind: WerewolfTurnKind;
  expectedActions: WerewolfActionType[];
  allowedTargets: number[];
  retryCount?: number;
  correction?: string;
}

interface HumanSubmission {
  text?: string;
  actionType?: WerewolfActionType;
  targetSeat?: number;
}

const advanceTails = new Map<string, Promise<void>>();

function id(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

function gameById(state: PersistedState, gameId: string): WerewolfGameSession {
  const game = state.werewolfGames.find((item) => item.id === gameId);
  if (!game) throw new Error('狼人杀对局不存在或已删除');
  return game;
}

function allPendingTurns(game: WerewolfGameSession): WerewolfPendingTurn[] {
  return [game.pendingTurn, ...(game.pendingParallelTurns ?? [])].filter((item): item is WerewolfPendingTurn => Boolean(item));
}

function findPendingTurn(game: WerewolfGameSession, operationId: string): WerewolfPendingTurn | undefined {
  return allPendingTurns(game).find((item) => item.operationId === operationId);
}

function removePendingTurn(game: WerewolfGameSession, operationId: string): void {
  if (game.pendingTurn?.operationId === operationId) game.pendingTurn = undefined;
  if (game.pendingParallelTurns?.length) {
    game.pendingParallelTurns = game.pendingParallelTurns.filter((item) => item.operationId !== operationId);
    if (!game.pendingParallelTurns.length) game.pendingParallelTurns = undefined;
  }
}

function hasPhaseVoteAction(game: WerewolfGameSession, seat: number): boolean {
  return game.actions.some((action) => action.phaseId === game.phaseId && action.actorSeat === seat && (action.type === 'vote' || action.type === 'pass'));
}

function notifyGameChanged(gameId?: string): void {
  chrome.runtime.sendMessage({ source: 'background', type: 'STATE_UPDATED', gameId }).catch(() => undefined);
}

function phaseLabel(game: WerewolfGameSession): string {
  const map: Partial<Record<WerewolfGameSession['phase'], string>> = {
    night_start: `第${game.day}夜`,
    wolf_discussion: '狼人夜谈',
    wolf_vote: '狼人刀人投票',
    wolf_tiebreak_discussion: '狼人决胜讨论',
    wolf_tiebreak_vote: '狼人决胜投票',
    seer_action: '预言家行动',
    witch_action: '女巫行动',
    night_resolution: '夜间结算',
    dawn: `第${game.day}天天亮`,
    day_speech: '白天发言',
    day_vote: '白天投票',
    day_tiebreak_vote: '白天平票重投',
    exile_resolution: '放逐结算',
    death_trigger: '死亡结算',
    last_word: '遗言',
    win_check: '胜负检查'
  };
  return map[game.phase] ?? game.phase;
}

function enterPhase(game: WerewolfGameSession, phase: WerewolfGameSession['phase'], queue: number[] = [], round = 0, returnPhase?: WerewolfGameSession['phase']): void {
  setGamePhase(game, phase, queue, round);
  game.cursor.returnPhase = returnPhase;
}

function tallyText(votes: Record<string, number>): string {
  const counts = new Map<number, number>();
  for (const target of Object.values(votes)) counts.set(target, (counts.get(target) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => a[0] - b[0]).map(([seat, count]) => `${seat}号 ${count}票`).join('，') || '无人投票';
}

function eventExists(game: WerewolfGameSession, type: WerewolfGameSession['events'][number]['type'], seat: number, day: number): boolean {
  return game.events.some((event) => event.type === type && event.authorSeat === seat && Number(event.data?.day) === day);
}

function specialActionError(game: WerewolfGameSession, pending: Pick<WerewolfPendingTurn | WerewolfPendingHumanAction, 'seat' | 'kind'>, parsed: ParsedWerewolfAction): string | undefined {
  const player = playerBySeat(game, pending.seat);
  if (!player) return '玩家不存在';
  if (pending.kind === 'witch') {
    if (parsed.actionType === 'save') {
      if (!player.privateState.witchAntidoteAvailable) return '解药已使用';
      if (!game.night.wolfTarget || parsed.targetSeat !== game.night.wolfTarget) return '解药只能用于狼人本夜袭击目标';
      if (parsed.targetSeat === player.seat && !(game.day === 1 && game.rulesetSnapshot.allowWitchSelfSaveFirstNight)) return '当前规则不允许女巫此时自救';
    }
    if (parsed.actionType === 'poison') {
      if (!player.privateState.witchPoisonAvailable) return '毒药已使用';
      if (parsed.targetSeat === player.seat) return '女巫不能毒自己';
    }
  }
  return undefined;
}

function applyMachineAction(game: WerewolfGameSession, pending: Pick<WerewolfPendingTurn | WerewolfPendingHumanAction, 'actionId' | 'turnId' | 'seat' | 'phaseId' | 'kind'>, parsed: ParsedWerewolfAction): void {
  if (!parsed.actionType || game.committedActionIds.includes(pending.actionId)) return;
  game.actions.push({
    actionId: pending.actionId,
    gameId: game.id,
    phaseId: pending.phaseId,
    turnId: pending.turnId,
    actorSeat: pending.seat,
    type: parsed.actionType,
    targetSeat: parsed.targetSeat,
    committedAt: Date.now()
  });
  game.committedActionIds.push(pending.actionId);
  const player = playerBySeat(game, pending.seat);

  if (pending.kind === 'kill' && parsed.actionType === 'kill' && parsed.targetSeat) {
    game.night.wolfVotes[String(pending.seat)] = parsed.targetSeat;
  }
  if (pending.kind === 'vote' && parsed.actionType === 'vote' && parsed.targetSeat) {
    const target = game.phase === 'day_tiebreak_vote' ? game.dayState.runoffVotes : game.dayState.votes;
    target[String(pending.seat)] = parsed.targetSeat;
  }
  if (pending.kind === 'check' && parsed.actionType === 'check' && parsed.targetSeat && player) {
    const target = playerBySeat(game, parsed.targetSeat);
    const isWolf = target?.role === 'wolf';
    player.privateState.seerChecks ??= [];
    player.privateState.seerChecks.push({ day: game.day, seat: parsed.targetSeat, isWolf });
    addGameEvent(game, 'seer_result', `查验 ${parsed.targetSeat}号：${isWolf ? '狼人' : '好人'}。`, { type: 'private', seat: player.seat }, player.seat, { day: game.day, targetSeat: parsed.targetSeat, isWolf });
  }
  if (pending.kind === 'witch' && player) {
    if (parsed.actionType === 'save' && parsed.targetSeat) {
      player.privateState.witchAntidoteAvailable = false;
      game.night.witchSavedSeat = parsed.targetSeat;
      addGameEvent(game, 'witch_action', `你使用了解药，目标 ${parsed.targetSeat}号。`, { type: 'private', seat: player.seat }, player.seat, { day: game.day, action: 'save', targetSeat: parsed.targetSeat });
    } else if (parsed.actionType === 'poison' && parsed.targetSeat) {
      player.privateState.witchPoisonAvailable = false;
      game.night.witchPoisonedSeat = parsed.targetSeat;
      addGameEvent(game, 'witch_action', `你使用了毒药，目标 ${parsed.targetSeat}号。`, { type: 'private', seat: player.seat }, player.seat, { day: game.day, action: 'poison', targetSeat: parsed.targetSeat });
    } else if (parsed.actionType === 'pass') {
      addGameEvent(game, 'witch_action', '你本夜没有使用药物。', { type: 'private', seat: player.seat }, player.seat, { day: game.day, action: 'pass' });
    }
  }
  if (pending.kind === 'shoot') {
    if (parsed.actionType === 'shoot' && parsed.targetSeat) {
      addGameEvent(game, 'hunter_action', `${pending.seat}号猎人发动技能，选择带走 ${parsed.targetSeat}号。`, { type: 'public' }, pending.seat, { day: game.day, targetSeat: parsed.targetSeat });
      const target = playerBySeat(game, parsed.targetSeat);
      if (target && target.lifeState === 'alive') {
        target.lifeState = 'dying';
        game.pendingDeaths.push({ seat: target.seat, cause: 'shot', sourceSeat: pending.seat });
      }
    } else {
      addGameEvent(game, 'hunter_action', `${pending.seat}号猎人没有发动技能。`, { type: 'public' }, pending.seat, { day: game.day });
    }
    const death = game.pendingDeaths[0];
    if (death?.seat === pending.seat) {
      markDead(game, death);
      game.pendingDeaths.shift();
      const allowLastWords = death.cause === 'exile'
        ? game.rulesetSnapshot.dayExileLastWords
        : game.rulesetSnapshot.nightDeathLastWords;
      if (allowLastWords) game.pendingLastWords.push(pending.seat);
    }
  }
}

function applyTurnContent(game: WerewolfGameSession, pending: Pick<WerewolfPendingTurn | WerewolfPendingHumanAction, 'seat' | 'kind'>, displayText: string): void {
  const text = displayText.trim();
  if (!text) return;
  if (pending.kind === 'speech') addGameEvent(game, 'speech', text, { type: 'public' }, pending.seat, { day: game.day });
  if (pending.kind === 'wolf_discussion') addGameEvent(game, 'wolf_chat', text, { type: 'wolf' }, pending.seat, { day: game.day });
  if (pending.kind === 'last_word') addGameEvent(game, 'last_word', text, { type: 'public' }, pending.seat, { day: game.day });
}

function finishNormalTurn(game: WerewolfGameSession, pending: Pick<WerewolfPendingTurn | WerewolfPendingHumanAction, 'kind'>): void {
  if (pending.kind !== 'shoot' && pending.kind !== 'vote') game.cursor.index += 1;
  game.updatedAt = Date.now();
}

function prepareTurn(game: WerewolfGameSession, spec: TurnSpec, parallel = false): { type: 'ai'; pending: WerewolfPendingTurn } | { type: 'human' } {
  const player = playerBySeat(game, spec.seat);
  if (!player) throw new Error(`找不到 ${spec.seat} 号玩家`);
  const prompt = `${buildWerewolfPrompt({
    game,
    seat: spec.seat,
    kind: spec.kind,
    expectedActions: spec.expectedActions,
    allowedTargets: spec.allowedTargets
  })}${spec.correction ? `\n\n[FORMAT REPAIR]\n上一份回答无法结算：${spec.correction}\n请重新提交当前动作。不要重复其他阶段内容。` : ''}`;
  const base = {
    turnId: id('turn'),
    actionId: id('action'),
    seat: spec.seat,
    phaseId: game.phaseId,
    kind: spec.kind,
    allowedTargets: [...spec.allowedTargets],
    expectedActions: [...spec.expectedActions],
    prompt
  };
  if (player.controller === 'human') {
    game.pendingHumanAction = base;
    if (!parallel) game.status = 'waiting_human';
    return { type: 'human' };
  }
  if (!player.providerId) throw new Error(`${spec.seat}号 AI 玩家没有 Provider`);
  const pending: WerewolfPendingTurn = {
    ...base,
    operationId: id('gameop'),
    playerId: player.id,
    provider: player.providerId,
    retryCount: spec.retryCount ?? 0,
    startedAt: Date.now(),
    phase: 'preparing'
  };
  if (parallel) {
    game.pendingParallelTurns ??= [];
    game.pendingParallelTurns.push(pending);
  } else game.pendingTurn = pending;
  return { type: 'ai', pending };
}

function nextStep(game: WerewolfGameSession): { dispatch?: WerewolfPendingTurn; dispatchMany?: WerewolfPendingTurn[]; waiting?: boolean; changed?: boolean } {
  if (game.status !== 'running') return { waiting: true };
  if (game.pendingTurn || game.pendingParallelTurns?.length || game.pendingHumanAction) return { waiting: true };

  const prepare = (spec: TurnSpec) => {
    const result = prepareTurn(game, spec);
    return result.type === 'ai' ? { dispatch: result.pending, changed: true } : { waiting: true, changed: true };
  };
  const wolves = () => aliveByRole(game, 'wolf').map((player) => player.seat);
  const alive = () => aliveSeats(game);

  switch (game.phase) {
    case 'setup':
    case 'night_start': {
      game.night = { wolfVotes: {}, deaths: [] };
      game.pendingDeaths = [];
      game.pendingLastWords = [];
      addGameEvent(game, 'phase', `第${game.day}夜开始。`, { type: 'public' }, undefined, { day: game.day });
      enterPhase(game, 'wolf_discussion', wolves(), 0);
      return { changed: true };
    }
    case 'wolf_discussion': {
      if (game.cursor.index < game.cursor.queue.length) return prepare({ seat: game.cursor.queue[game.cursor.index], kind: 'wolf_discussion', expectedActions: [], allowedTargets: [] });
      if (game.cursor.round + 1 < game.rulesetSnapshot.wolfDiscussionRounds) {
        game.cursor.index = 0;
        game.cursor.round += 1;
        return { changed: true };
      }
      game.night.wolfVotes = {};
      enterPhase(game, 'wolf_vote', wolves());
      return { changed: true };
    }
    case 'wolf_vote': {
      if (game.cursor.index < game.cursor.queue.length) return prepare({ seat: game.cursor.queue[game.cursor.index], kind: 'kill', expectedActions: ['kill'], allowedTargets: alive() });
      const result = uniqueHighestTarget(game.night.wolfVotes);
      addGameEvent(game, 'notice', `狼队首轮刀人票型：${tallyText(game.night.wolfVotes)}。`, { type: 'wolf' }, undefined, { day: game.day });
      if (result.target) {
        game.night.wolfTarget = result.target;
        enterPhase(game, 'seer_action', aliveByRole(game, 'seer').map((player) => player.seat));
      } else if (result.tied.length) {
        addGameEvent(game, 'notice', `狼队刀人平票：${result.tied.join('、')}号，进入决胜讨论。`, { type: 'wolf' });
        enterPhase(game, 'wolf_tiebreak_discussion', wolves());
        game.cursor.runoffCandidates = result.tied;
      } else {
        enterPhase(game, 'seer_action', aliveByRole(game, 'seer').map((player) => player.seat));
      }
      return { changed: true };
    }
    case 'wolf_tiebreak_discussion': {
      if (game.cursor.index < game.cursor.queue.length) return prepare({ seat: game.cursor.queue[game.cursor.index], kind: 'wolf_discussion', expectedActions: [], allowedTargets: [] });
      const candidates = [...(game.cursor.runoffCandidates ?? [])];
      game.night.wolfVotes = {};
      enterPhase(game, 'wolf_tiebreak_vote', wolves());
      game.cursor.runoffCandidates = candidates;
      return { changed: true };
    }
    case 'wolf_tiebreak_vote': {
      if (game.cursor.index < game.cursor.queue.length) return prepare({ seat: game.cursor.queue[game.cursor.index], kind: 'kill', expectedActions: ['kill'], allowedTargets: [...(game.cursor.runoffCandidates ?? [])] });
      const result = uniqueHighestTarget(game.night.wolfVotes);
      const candidates = result.target ? [result.target] : result.tied.length ? result.tied : (game.cursor.runoffCandidates ?? []);
      game.night.wolfTarget = result.target ?? stableChoice(candidates, game, 'wolf-final-tie');
      addGameEvent(game, 'notice', `狼队最终决定：${game.night.wolfTarget ? `${game.night.wolfTarget}号` : '空刀'}。`, { type: 'wolf' }, undefined, { day: game.day });
      enterPhase(game, 'seer_action', aliveByRole(game, 'seer').map((player) => player.seat));
      return { changed: true };
    }
    case 'seer_action': {
      if (game.cursor.index < game.cursor.queue.length) {
        const seat = game.cursor.queue[game.cursor.index];
        return prepare({ seat, kind: 'check', expectedActions: ['check'], allowedTargets: alive().filter((target) => target !== seat) });
      }
      enterPhase(game, 'witch_action', aliveByRole(game, 'witch').map((player) => player.seat));
      return { changed: true };
    }
    case 'witch_action': {
      if (game.cursor.index < game.cursor.queue.length) {
        const seat = game.cursor.queue[game.cursor.index];
        const witch = playerBySeat(game, seat)!;
        const expected: WerewolfActionType[] = ['pass'];
        if (witch.privateState.witchAntidoteAvailable && game.night.wolfTarget) expected.unshift('save');
        if (witch.privateState.witchPoisonAvailable) expected.unshift('poison');
        const allowed = alive().filter((target) => target !== seat || (target === game.night.wolfTarget && game.day === 1 && game.rulesetSnapshot.allowWitchSelfSaveFirstNight));
        return prepare({ seat, kind: 'witch', expectedActions: expected, allowedTargets: allowed });
      }
      enterPhase(game, 'night_resolution');
      return { changed: true };
    }
    case 'night_resolution': {
      const deaths: WerewolfDeathRecord[] = [];
      if (game.night.wolfTarget && game.night.witchSavedSeat !== game.night.wolfTarget) deaths.push({ seat: game.night.wolfTarget, cause: 'wolf' });
      if (game.night.witchPoisonedSeat && !deaths.some((item) => item.seat === game.night.witchPoisonedSeat)) deaths.push({ seat: game.night.witchPoisonedSeat, cause: 'poison' });
      game.night.deaths = deaths;
      game.pendingDeaths = [...deaths];
      for (const death of deaths) {
        const player = playerBySeat(game, death.seat);
        if (player?.lifeState === 'alive') player.lifeState = 'dying';
      }
      addGameEvent(game, 'night_result', deaths.length ? `昨夜 ${deaths.map((item) => `${item.seat}号`).join('、')} 死亡。` : '昨夜无人死亡。', { type: 'public' }, undefined, { day: game.day, seats: deaths.map((item) => item.seat) });
      if (deaths.length) enterPhase(game, 'death_trigger', [], 0, 'day_speech');
      else enterPhase(game, 'win_check', [], 0, 'day_speech');
      return { changed: true };
    }
    case 'dawn': {
      enterPhase(game, 'day_speech', alive());
      return { changed: true };
    }
    case 'death_trigger': {
      const death = game.pendingDeaths[0];
      if (!death) {
        const returnPhase = game.cursor.returnPhase ?? 'day_speech';
        if (game.pendingLastWords.length) {
          enterPhase(game, 'last_word', [...game.pendingLastWords], 0, returnPhase);
          game.pendingLastWords = [];
        } else enterPhase(game, 'win_check', [], 0, returnPhase);
        return { changed: true };
      }
      const player = playerBySeat(game, death.seat);
      if (!player || player.lifeState === 'dead') {
        game.pendingDeaths.shift();
        return { changed: true };
      }
      const hunterEligible = player.role === 'hunter' && (death.cause !== 'poison' || game.rulesetSnapshot.hunterCanShootWhenPoisoned);
      if (hunterEligible) {
        return prepare({ seat: player.seat, kind: 'shoot', expectedActions: ['shoot', 'pass'], allowedTargets: alive().filter((seat) => seat !== player.seat) });
      }
      markDead(game, death);
      game.pendingDeaths.shift();
      const allowLastWords = death.cause === 'exile'
        ? game.rulesetSnapshot.dayExileLastWords
        : game.rulesetSnapshot.nightDeathLastWords;
      if (allowLastWords) game.pendingLastWords.push(death.seat);
      return { changed: true };
    }
    case 'last_word': {
      if (game.cursor.index < game.cursor.queue.length) return prepare({ seat: game.cursor.queue[game.cursor.index], kind: 'last_word', expectedActions: [], allowedTargets: [] });
      const returnPhase = game.cursor.returnPhase ?? 'night_start';
      enterPhase(game, 'win_check', [], 0, returnPhase);
      return { changed: true };
    }
    case 'day_speech': {
      if (!game.cursor.queue.length && game.cursor.index === 0) {
        game.dayState = { votes: {}, runoffVotes: {} };
        game.cursor.queue = alive();
      }
      if (game.cursor.index < game.cursor.queue.length) return prepare({ seat: game.cursor.queue[game.cursor.index], kind: 'speech', expectedActions: [], allowedTargets: [] });
      enterPhase(game, 'day_vote', alive());
      return { changed: true };
    }
    case 'day_vote': {
      const remaining = game.cursor.queue.filter((seat) => !hasPhaseVoteAction(game, seat));
      if (remaining.length) {
        const seat = remaining[0];
        const allowedTargets = alive().filter((target) => target !== seat);
        const result = prepareTurn(game, {
          seat,
          kind: 'vote',
          expectedActions: allowedTargets.length ? ['vote'] : ['pass'],
          allowedTargets
        });
        return result.type === 'ai'
          ? { dispatch: result.pending, changed: true }
          : { waiting: true, changed: true };
      }
      const result = uniqueHighestTarget(game.dayState.votes);
      addGameEvent(game, 'vote_result', `白天投票：${tallyText(game.dayState.votes)}。${result.target ? `${result.target}号最高票。` : result.tied.length ? `平票：${result.tied.join('、')}号。` : '无人形成有效票。'}`, { type: 'public' }, undefined, { day: game.day });
      if (result.target) {
        game.dayState.exiledSeat = result.target;
        enterPhase(game, 'exile_resolution');
      } else if (result.tied.length) {
        game.dayState.runoffCandidates = result.tied;
        game.dayState.runoffVotes = {};
        enterPhase(game, 'day_tiebreak_vote', alive());
        game.cursor.runoffCandidates = result.tied;
      } else {
        game.dayState.exiledSeat = undefined;
        enterPhase(game, 'exile_resolution');
      }
      return { changed: true };
    }
    case 'day_tiebreak_vote': {
      const remaining = game.cursor.queue.filter((seat) => !hasPhaseVoteAction(game, seat));
      if (remaining.length) {
        const seat = remaining[0];
        const allowedTargets = (game.cursor.runoffCandidates ?? []).filter((target) => target !== seat);
        const result = prepareTurn(game, {
          seat,
          kind: 'vote',
          expectedActions: allowedTargets.length ? ['vote'] : ['pass'],
          allowedTargets
        });
        return result.type === 'ai'
          ? { dispatch: result.pending, changed: true }
          : { waiting: true, changed: true };
      }
      const result = uniqueHighestTarget(game.dayState.runoffVotes);
      game.dayState.exiledSeat = result.target;
      addGameEvent(game, 'vote_result', `平票重投：${tallyText(game.dayState.runoffVotes)}。${result.target ? `${result.target}号被放逐。` : '仍然平票，本日无人被放逐。'}`, { type: 'public' }, undefined, { day: game.day, runoff: true });
      enterPhase(game, 'exile_resolution');
      return { changed: true };
    }
    case 'exile_resolution': {
      const seat = game.dayState.exiledSeat;
      const player = seat ? playerBySeat(game, seat) : undefined;
      if (player?.lifeState === 'alive') {
        player.lifeState = 'dying';
        game.pendingDeaths = [{ seat: player.seat, cause: 'exile' }];
        game.pendingLastWords = [];
        enterPhase(game, 'death_trigger', [], 0, 'night_start');
      } else enterPhase(game, 'win_check', [], 0, 'night_start');
      return { changed: true };
    }
    case 'win_check': {
      const winner = checkWinner(game);
      if (winner) {
        game.winner = winner;
        game.status = 'ended';
        game.phase = 'ended';
        game.endedAt = Date.now();
        addGameEvent(game, 'game_end', `${winner === 'wolf' ? '狼人阵营' : '好人阵营'}获胜。身份揭晓：${roleRevealSummary(game)}`, { type: 'public' }, undefined, { winner });
        return { waiting: true, changed: true };
      }
      const returnPhase = game.cursor.returnPhase ?? 'day_speech';
      if (returnPhase === 'night_start') {
        game.day += 1;
        enterPhase(game, 'night_start');
      } else enterPhase(game, 'day_speech', alive());
      return { changed: true };
    }
    case 'ended':
      return { waiting: true };
    default:
      throw new Error(`尚未处理狼人杀阶段：${game.phase}`);
  }
}

export function createWerewolfEngine(bridge: WerewolfProviderBridge) {
  async function createGame(setup: WerewolfSetupSettings): Promise<WerewolfGameSession> {
    const enabled = setup.providerIds.filter((provider) => providerById[provider]?.enabled);
    const needed = setup.playerCount - (setup.includeHuman ? 1 : 0);
    if (new Set(enabled).size < needed) throw new Error(`当前配置需要 ${needed} 个不同的已接入 AI 模型`);
    const normalized: WerewolfSetupSettings = {
      ...setup,
      providerIds: [...new Set(enabled)].slice(0, needed),
      presetId: `werewolf-v1-${setup.playerCount}`
    };
    const game = createWerewolfGame(normalized, `${setup.playerCount}人狼人杀 · ${new Date().toLocaleString('zh-CN', { hour12: false })}`);
    await mutatePersistedState((state) => {
      state.werewolfSetup = structuredClone(setup);
      state.werewolfGames.push(game);
      state.activeWerewolfGameId = game.id;
      state.activeMode = 'werewolf';
    });
    notifyGameChanged(game.id);
    return structuredClone(game);
  }

  async function ensureFreshBindings(gameId: string): Promise<void> {
    const snapshot = await loadState();
    const game = gameById(snapshot, gameId);
    const aiPlayers = game.players.filter((player) => player.controller === 'ai' && player.providerId);
    const created: Array<readonly [string, { provider: ProviderId; tabId: number; conversationUrl?: string }]> = [];
    for (const player of aiPlayers) {
      const old = game.bindings[player.id];
      const binding = await bridge.createFreshConversation(player.providerId!, old?.tabId);
      created.push([player.id, { provider: player.providerId!, tabId: binding.tabId, conversationUrl: binding.conversationUrl }] as const);
    }
    await mutatePersistedState((state) => {
      const current = gameById(state, gameId);
      for (const [playerId, binding] of created) current.bindings[playerId] = binding;
      current.updatedAt = Date.now();
    });
  }

  async function startGame(gameId: string): Promise<void> {
    const state = await loadState();
    const existing = gameById(state, gameId);
    if (existing.status === 'running' || existing.status === 'waiting_human') throw new Error('狼人杀对局已经在进行');
    if (existing.status === 'ended') throw new Error('该对局已经结束，请新建一局');
    try {
      if (existing.status === 'setup') await ensureFreshBindings(gameId);
      await mutatePersistedState((next) => {
        const game = gameById(next, gameId);
        game.status = 'running';
        game.lastError = undefined;
        if (game.phase === 'setup') {
          addGameEvent(game, 'game_start', `狼人杀开始，共 ${game.players.length} 名玩家。身份已私下分配。`, { type: 'public' });
          enterPhase(game, 'night_start');
        }
        game.updatedAt = Date.now();
      });
      notifyGameChanged(gameId);
      await scheduleAdvance(gameId);
    } catch (error) {
      await mutatePersistedState((next) => {
        const game = gameById(next, gameId);
        game.status = 'error';
        game.lastError = error instanceof Error ? error.message : String(error);
      });
      notifyGameChanged(gameId);
      throw error;
    }
  }

  async function dispatchPending(gameId: string, pending: WerewolfPendingTurn): Promise<void> {
    const state = await loadState();
    const game = gameById(state, gameId);
    if (game.status !== 'running' || !findPendingTurn(game, pending.operationId)) return;
    const player = game.players.find((item) => item.id === pending.playerId);
    const binding = game.bindings[pending.playerId];
    if (!player?.providerId || !binding) throw new Error('狼人杀玩家网页会话尚未绑定');
    try {
      const actual = await bridge.send(player.providerId, pending.operationId, { text: pending.prompt, attachments: [] }, binding.tabId, binding.conversationUrl);
      await mutatePersistedState((next) => {
        const current = gameById(next, gameId);
        const currentPending = findPendingTurn(current, pending.operationId);
        if (!currentPending) return;
        currentPending.phase = 'active';
        current.bindings[pending.playerId] = { provider: player.providerId!, tabId: actual.tabId, conversationUrl: actual.conversationUrl };
        current.updatedAt = Date.now();
      });
      notifyGameChanged(gameId);
    } catch (error) {
      let continueVoting = false;
      await mutatePersistedState((next) => {
        const current = gameById(next, gameId);
        if (!findPendingTurn(current, pending.operationId)) return;
        removePendingTurn(current, pending.operationId);
        if (pending.kind === 'vote') {
          applyMachineAction(current, pending, { displayText: '', actionType: 'pass' });
          finishNormalTurn(current, pending);
          continueVoting = true;
          current.updatedAt = Date.now();
          return;
        }
        current.status = 'paused';
        current.lastError = error instanceof Error ? error.message : String(error);
        current.updatedAt = Date.now();
      });
      notifyGameChanged(gameId);
      if (continueVoting) void scheduleAdvance(gameId).catch(console.error);
    }
  }

  async function dispatchRetry(gameId: string, previous: WerewolfPendingTurn, error: string): Promise<void> {
    const prepared = await mutatePersistedState((state) => {
      const game = gameById(state, gameId);
      if (game.status !== 'running' || game.phaseId !== previous.phaseId) return undefined;
      if (game.pendingTurn) return undefined;
      const result = prepareTurn(game, {
        seat: previous.seat,
        kind: previous.kind,
        expectedActions: previous.expectedActions,
        allowedTargets: previous.allowedTargets,
        retryCount: previous.retryCount + 1,
        correction: error
      });
      return result.type === 'ai' ? structuredClone(result.pending) : undefined;
    });
    notifyGameChanged(gameId);
    if (prepared) await dispatchPending(gameId, prepared);
  }

  async function advanceLoop(gameId: string): Promise<void> {
    for (let guard = 0; guard < 200; guard += 1) {
      const step = await mutatePersistedState((state) => {
        const game = gameById(state, gameId);
        const before = `${game.status}|${game.phase}|${game.phaseId}|${game.cursor.index}|${game.cursor.round}|${game.pendingTurn?.operationId ?? ''}|${game.pendingHumanAction?.turnId ?? ''}`;
        const result = nextStep(game);
        if (result.changed) game.updatedAt = Date.now();
        const after = `${game.status}|${game.phase}|${game.phaseId}|${game.cursor.index}|${game.cursor.round}|${game.pendingTurn?.operationId ?? ''}|${game.pendingHumanAction?.turnId ?? ''}`;
        return { result, changed: before !== after || Boolean(result.changed) };
      });
      if (step.changed) notifyGameChanged(gameId);
      if (step.result.dispatchMany?.length) {
        await Promise.all(step.result.dispatchMany.map((pending) => dispatchPending(gameId, pending)));
        return;
      }
      if (step.result.dispatch) {
        await dispatchPending(gameId, step.result.dispatch);
        return;
      }
      if (step.result.waiting) return;
    }
    await mutatePersistedState((state) => {
      const game = gameById(state, gameId);
      game.status = 'error';
      game.lastError = '狼人杀状态机超过安全步数，已停止';
    });
    notifyGameChanged(gameId);
  }

  async function scheduleAdvance(gameId: string): Promise<void> {
    const previous = advanceTails.get(gameId) ?? Promise.resolve();
    const task = previous.catch(() => undefined).then(() => advanceLoop(gameId));
    advanceTails.set(gameId, task);
    try { await task; } finally { if (advanceTails.get(gameId) === task) advanceTails.delete(gameId); }
  }

  async function completeTurnFromText(gameId: string, pending: WerewolfPendingTurn, text: string): Promise<{ retry?: string; pause?: string }> {
    return mutatePersistedState((state) => {
      const game = gameById(state, gameId);
      const current = findPendingTurn(game, pending.operationId);
      if (!current) return {};
      if (current.phaseId !== game.phaseId || current.turnId !== pending.turnId) {
        removePendingTurn(game, pending.operationId);
        return {};
      }
      const parsed = parseWerewolfAction(text);
      if (pending.expectedActions.length) {
        const basic = validateWerewolfAction({ parsed, expected: pending.expectedActions, allowedTargets: pending.allowedTargets });
        const special = basic.ok ? specialActionError(game, pending, parsed) : undefined;
        const error = !basic.ok ? basic.error : special;
        if (error) {
          removePendingTurn(game, pending.operationId);
          if (pending.retryCount < 1) return { retry: error };
          if (pending.kind === 'vote') {
            applyMachineAction(game, pending, { displayText: '', actionType: 'pass' });
            finishNormalTurn(game, pending);
            return {};
          }
          game.status = 'paused';
          game.lastError = `${pending.seat}号动作连续两次无法结算：${error}`;
          return { pause: game.lastError };
        }
      }
      applyTurnContent(game, pending, parsed.displayText);
      applyMachineAction(game, pending, parsed);
      removePendingTurn(game, pending.operationId);
      finishNormalTurn(game, pending);
      return {};
    });
  }

  async function handleProviderEvent(event: ProviderEvent): Promise<boolean> {
    if (!event.operationId) return false;
    const state = await loadState();
    const game = state.werewolfGames.find((item) => Boolean(findPendingTurn(item, event.operationId!)));
    const pending = game ? findPendingTurn(game, event.operationId) : undefined;
    if (!game || !pending || pending.provider !== event.provider) return false;
    const binding = game.bindings[pending.playerId];
    if (event.tabId && binding?.tabId && event.tabId !== binding.tabId) return true;

    if (event.type === 'PROVIDER_RESPONSE_STARTED' || event.type === 'PROVIDER_RESPONSE_DELTA') {
      // Game mode is intentionally final-only. Intermediate text, including
      // reasoning/thinking DOM, is never written to the GameEvent ledger.
      return true;
    }
    if (event.type === 'PROVIDER_ERROR') {
      let continueVoting = false;
      await mutatePersistedState((next) => {
        const current = gameById(next, game.id);
        const currentPending = findPendingTurn(current, pending.operationId);
        if (!currentPending) return;
        removePendingTurn(current, pending.operationId);
        if (pending.kind === 'vote') {
          applyMachineAction(current, pending, { displayText: '', actionType: 'pass' });
          finishNormalTurn(current, pending);
          continueVoting = true;
          current.updatedAt = Date.now();
          return;
        }
        current.status = 'paused';
        current.lastError = event.error || `${providerById[pending.provider].label} 执行失败`;
        current.updatedAt = Date.now();
      });
      notifyGameChanged(game.id);
      if (continueVoting) void scheduleAdvance(game.id).catch(console.error);
      return true;
    }
    if (event.type !== 'PROVIDER_RESPONSE_COMPLETED') return true;

    if (event.tabId) {
      await mutatePersistedState((next) => {
        const current = gameById(next, game.id);
        if (!findPendingTurn(current, pending.operationId)) return;
        current.bindings[pending.playerId] = { provider: pending.provider, tabId: event.tabId!, conversationUrl: event.url || current.bindings[pending.playerId]?.conversationUrl };
      });
    }
    const outcome = await completeTurnFromText(game.id, pending, event.text ?? '');
    notifyGameChanged(game.id);
    if (outcome.retry) {
      await dispatchRetry(game.id, pending, outcome.retry);
      return true;
    }
    if (!outcome.pause) void scheduleAdvance(game.id).catch(console.error);
    return true;
  }

  async function submitHumanAction(gameId: string, submission: HumanSubmission): Promise<void> {
    await mutatePersistedState((state) => {
      const game = gameById(state, gameId);
      const pending = game.pendingHumanAction;
      const parallelVote = pending?.kind === 'vote' && game.status === 'running';
      if (!pending || (game.status !== 'waiting_human' && !parallelVote)) throw new Error('当前没有等待中的人类玩家行动');
      const parsed: ParsedWerewolfAction = {
        displayText: submission.text?.trim() ?? '',
        actionType: submission.actionType,
        targetSeat: submission.targetSeat
      };
      if (pending.expectedActions.length) {
        const basic = validateWerewolfAction({ parsed, expected: pending.expectedActions, allowedTargets: pending.allowedTargets });
        if (!basic.ok) throw new Error(basic.error);
        const special = specialActionError(game, pending, parsed);
        if (special) throw new Error(special);
      }
      applyTurnContent(game, pending, parsed.displayText);
      applyMachineAction(game, pending, parsed);
      game.pendingHumanAction = undefined;
      if (game.status === 'waiting_human') game.status = 'running';
      finishNormalTurn(game, pending);
    });
    notifyGameChanged(gameId);
    await scheduleAdvance(gameId);
  }

  async function interruptGame(gameId: string): Promise<void> {
    const targets = await mutatePersistedState((state) => {
      const game = gameById(state, gameId);
      const pending = allPendingTurns(game);
      game.status = 'paused';
      game.pendingTurn = undefined;
      game.pendingParallelTurns = undefined;
      game.pendingHumanAction = undefined;
      game.lastError = undefined;
      game.updatedAt = Date.now();
      return pending.map((item) => ({
        provider: item.provider,
        operationId: item.operationId,
        tabId: game.bindings[item.playerId]?.tabId
      }));
    });
    notifyGameChanged(gameId);
    await Promise.all(targets.map((target) => bridge.cancel(target.provider, target.operationId, target.tabId).catch(() => undefined)));
  }

  async function resumeGame(gameId: string): Promise<void> {
    await mutatePersistedState((state) => {
      const game = gameById(state, gameId);
      if (game.status === 'ended') throw new Error('游戏已经结束');
      if (game.status === 'running') return;
      game.status = 'running';
      game.lastError = undefined;
      game.pendingTurn = undefined;
      game.pendingParallelTurns = undefined;
      game.pendingHumanAction = undefined;
      game.updatedAt = Date.now();
    });
    notifyGameChanged(gameId);
    await scheduleAdvance(gameId);
  }

  async function deleteGame(gameId: string): Promise<void> {
    await mutatePersistedState((state) => {
      const game = gameById(state, gameId);
      if (game.status === 'running' || game.status === 'waiting_human' || game.pendingTurn || game.pendingParallelTurns?.length) throw new Error('请先中断正在运行的狼人杀对局');
      state.werewolfGames = state.werewolfGames.filter((item) => item.id !== gameId);
      if (state.activeWerewolfGameId === gameId) state.activeWerewolfGameId = state.werewolfGames.at(-1)?.id;
    });
    notifyGameChanged();
  }

  async function recover(dispatchPreparing = true): Promise<void> {
    const recovery = await mutatePersistedState((state) => {
      const ids: string[] = [];
      const preparing: { gameId: string; pending: WerewolfPendingTurn }[] = [];
      const staleBefore = Date.now() - 30 * 60 * 1000;
      for (const game of state.werewolfGames) {
        const pending = allPendingTurns(game);
        let stale = false;
        for (const item of pending) {
          if (dispatchPreparing && item.phase === 'preparing' && item.startedAt >= staleBefore) preparing.push({ gameId: game.id, pending: structuredClone(item) });
          if (item.startedAt < staleBefore) stale = true;
        }
        if (stale) {
          game.pendingTurn = undefined;
          game.pendingParallelTurns = undefined;
          game.status = 'paused';
          game.lastError = '等待 AI 回复超过 30 分钟，已暂停本局';
        }
        if (game.status === 'running' && !allPendingTurns(game).length && !game.pendingHumanAction) ids.push(game.id);
      }
      return { ids, preparing };
    });
    for (const item of recovery.preparing) void dispatchPending(item.gameId, item.pending).catch(console.error);
    for (const gameId of recovery.ids) void scheduleAdvance(gameId).catch(console.error);
  }

  async function updateSetup(setup: WerewolfSetupSettings): Promise<void> {
    await mutatePersistedState((state) => { state.werewolfSetup = structuredClone(setup); });
    notifyGameChanged();
  }

  async function setActiveGame(gameId?: string): Promise<void> {
    await mutatePersistedState((state) => {
      if (gameId && !state.werewolfGames.some((game) => game.id === gameId)) throw new Error('狼人杀对局不存在');
      state.activeWerewolfGameId = gameId;
      state.activeMode = 'werewolf';
    });
    notifyGameChanged(gameId);
  }

  async function attachBinding(operationId: string, provider: ProviderId, tabId: number, conversationUrl?: string): Promise<boolean> {
    return mutatePersistedState((state) => {
      const game = state.werewolfGames.find((item) => Boolean(findPendingTurn(item, operationId)));
      const pending = game ? findPendingTurn(game, operationId) : undefined;
      if (!game || !pending || pending.provider !== provider) return false;
      game.bindings[pending.playerId] = { provider, tabId, conversationUrl };
      // Binding a page does not confirm submission. dispatchPending marks the
      // turn active only after send returns, so checks cannot race the sender.
      game.updatedAt = Date.now();
      return true;
    });
  }

  function ownsOperation(state: PersistedState, operationId: string): { game: WerewolfGameSession; pending: WerewolfPendingTurn } | undefined {
    const game = state.werewolfGames.find((item) => Boolean(findPendingTurn(item, operationId)));
    const pending = game ? findPendingTurn(game, operationId) : undefined;
    return game && pending ? { game, pending } : undefined;
  }

  return {
    createGame,
    startGame,
    interruptGame,
    resumeGame,
    submitHumanAction,
    deleteGame,
    handleProviderEvent,
    recover,
    updateSetup,
    setActiveGame,
    attachBinding,
    ownsOperation
  };
}
