import { mutatePersistedState } from './state-store';
import { loadState } from '../shared/storage';
import type { ComposerPayload, PersistedState, ProviderEvent, ProviderId } from '../shared/types';
import {
  addClocktowerEvent,
  alivePlayers,
  aliveSeats,
  chefEvilPairs,
  checkClocktowerWinner,
  clockId,
  closestAliveNeighbor,
  handleDemonDeathReplacement,
  informationTruth,
  isImpaired,
  markDead,
  playerAt,
  resolveRegistration,
  resolveRegistrationAsType,
  setClocktowerPhase,
  setWinner,
  storytellerChoose
} from '../game/clocktower/core';
import { parseClocktowerAction, strictClocktowerActionInstruction, validateClocktowerAction } from '../game/clocktower/actions';
import { buildClocktowerTurnPrompt } from '../game/clocktower/context';
import { clocktowerRoleById, ROLE_IDS_BY_TYPE } from '../game/clocktower/scripts';
import { createClocktowerGame } from '../game/clocktower/setup';
import type {
  ClocktowerActionType,
  ClocktowerGameSession,
  ClocktowerNomination,
  ClocktowerPendingHumanAction,
  ClocktowerPendingTurn,
  ClocktowerPlayer,
  ClocktowerRoleId,
  ClocktowerSetupSettings,
  ClocktowerTurnKind,
  ParsedClocktowerAction
} from '../game/clocktower/types';

export interface ClocktowerProviderBridge {
  createFreshConversation(provider: ProviderId, preferredTabId?: number): Promise<{ tabId: number; conversationUrl?: string }>;
  send(provider: ProviderId, operationId: string, payload: ComposerPayload, tabId?: number, conversationUrl?: string): Promise<{ tabId: number; conversationUrl?: string }>;
  cancel(provider: ProviderId, operationId?: string, tabId?: number): Promise<void>;
  closeTab(tabId: number): Promise<void>;
}

interface TurnSpec {
  seat: number;
  kind: ClocktowerTurnKind;
  instruction: string;
  expectedActions?: ClocktowerActionType[];
  allowedTargets?: number[];
  minTargets?: number;
  maxTargets?: number;
  pureAction?: boolean;
  metadata?: Record<string, unknown>;
  retryCount?: number;
  correction?: string;
}

interface HumanSubmission {
  text?: string;
  actionType?: ClocktowerActionType;
  targetSeats?: number[];
  targetSeat?: number;
}

const advanceTails = new Map<string, Promise<void>>();

function gameById(state: PersistedState, gameId: string): ClocktowerGameSession {
  const game = state.clocktowerGames.find((item) => item.id === gameId);
  if (!game) throw new Error('迷雾议会对局不存在或已删除');
  return game;
}

function notify(gameId?: string): void {
  chrome.runtime.sendMessage({ source: 'background', type: 'STATE_UPDATED', clocktowerGameId: gameId }).catch(() => undefined);
}

function effectiveRole(player: ClocktowerPlayer): ClocktowerRoleId {
  return player.trueCharacter === 'drunk' ? player.perceivedCharacter : player.trueCharacter;
}

function functioning(game: ClocktowerGameSession, player: ClocktowerPlayer, role: ClocktowerRoleId): boolean {
  return player.trueCharacter === role && !isImpaired(game, player) && player.alive;
}

function nightQueue(game: ClocktowerGameSession, firstNight: boolean): number[] {
  return game.players
    .filter((player) => player.alive)
    .map((player) => ({
      seat: player.seat,
      order: firstNight ? clocktowerRoleById[effectiveRole(player)].firstNightOrder : clocktowerRoleById[effectiveRole(player)].otherNightOrder
    }))
    .filter((item): item is { seat: number; order: number } => typeof item.order === 'number')
    .sort((a, b) => a.order - b.order || a.seat - b.seat)
    .map((item) => item.seat);
}

function privateInfo(game: ClocktowerGameSession, seat: number, content: string, data?: Record<string, unknown>): void {
  addClocktowerEvent(game, 'private_info', content, { type: 'private', seats: [seat] }, undefined, data);
}

function publicEvent(game: ClocktowerGameSession, type: Parameters<typeof addClocktowerEvent>[1], content: string, authorSeat?: number, data?: Record<string, unknown>): void {
  addClocktowerEvent(game, type, content, { type: 'public' }, authorSeat, data);
}

function choosePair(game: ClocktowerGameSession, matching: ClocktowerPlayer[], key: string, excludeSeat?: number): { seats: number[]; target?: ClocktowerPlayer } {
  const candidates = game.players.filter((player) => player.seat !== excludeSeat);
  const target = matching.length ? storytellerChoose(game, 'pair_info_target', matching, `${key}:target`, (p) => String(p.seat)) : undefined;
  const decoys = candidates.filter((player) => player.seat !== target?.seat);
  const decoy = decoys.length ? storytellerChoose(game, 'pair_info_decoy', decoys, `${key}:decoy`, (p) => String(p.seat)) : undefined;
  return { seats: [target?.seat, decoy?.seat].filter((seat): seat is number => Boolean(seat)), target };
}

function falseOrTrueCount(game: ClocktowerGameSession, player: ClocktowerPlayer, key: string, truthful: number, max: number): number {
  if (!isImpaired(game, player)) return truthful;
  const choices = Array.from({ length: max + 1 }, (_, index) => index);
  return storytellerChoose(game, 'impaired_count', choices, `${key}:${player.seat}`, String);
}

function addAutomaticNightInfo(game: ClocktowerGameSession, player: ClocktowerPlayer, role: ClocktowerRoleId): boolean {
  if (role === 'washerwoman') {
    const purpose = `washerwoman:${player.seat}`;
    const matches = game.players.filter((item) =>
      item.seat !== player.seat && Boolean(resolveRegistrationAsType(game, item, purpose, 'townsfolk'))
    );
    if (!matches.length) return true;
    const { seats, target } = choosePair(game, matches, 'washerwoman', player.seat);
    const shownRole = isImpaired(game, player)
      ? storytellerChoose(game, 'washerwoman_false_role', ROLE_IDS_BY_TYPE.townsfolk, `washerwoman:false:${player.seat}`)
      : resolveRegistrationAsType(game, target!, purpose, 'townsfolk')!.role;
    privateInfo(game, player.seat, `你获知：${seats.join('号、')}号两人中，有一人是${clocktowerRoleById[shownRole].name}。`);
    return true;
  }
  if (role === 'librarian') {
    const purpose = `librarian:${player.seat}`;
    const matches = game.players.filter((item) =>
      item.seat !== player.seat && Boolean(resolveRegistrationAsType(game, item, purpose, 'outsider'))
    );
    if (!matches.length && !isImpaired(game, player)) {
      privateInfo(game, player.seat, '你获知：本局没有外来者。');
      return true;
    }
    const source = matches.length ? matches : game.players.filter((item) => item.seat !== player.seat);
    const { seats, target } = choosePair(game, source, 'librarian', player.seat);
    const shownRole = isImpaired(game, player)
      ? storytellerChoose(game, 'librarian_false_role', ROLE_IDS_BY_TYPE.outsider, `librarian:false:${player.seat}`)
      : resolveRegistrationAsType(game, target!, purpose, 'outsider')!.role;
    privateInfo(game, player.seat, `你获知：${seats.join('号、')}号两人中，有一人是${clocktowerRoleById[shownRole].name}。`);
    return true;
  }
  if (role === 'investigator') {
    const purpose = `investigator:${player.seat}`;
    const matches = game.players.filter((item) =>
      item.seat !== player.seat && Boolean(resolveRegistrationAsType(game, item, purpose, 'minion'))
    );
    if (!matches.length) return true;
    const { seats, target } = choosePair(game, matches, 'investigator', player.seat);
    const shownRole = isImpaired(game, player)
      ? storytellerChoose(game, 'investigator_false_role', ROLE_IDS_BY_TYPE.minion, `investigator:false:${player.seat}`)
      : resolveRegistrationAsType(game, target!, purpose, 'minion')!.role;
    privateInfo(game, player.seat, `你获知：${seats.join('号、')}号两人中，有一人是${clocktowerRoleById[shownRole].name}。`);
    return true;
  }
  if (role === 'chef') {
    const truthful = chefEvilPairs(game);
    privateInfo(game, player.seat, `你获知：场上相邻邪恶玩家共有 ${falseOrTrueCount(game, player, 'chef', truthful, Math.floor(game.players.length / 2))} 对。`);
    return true;
  }
  if (role === 'empath') {
    const left = closestAliveNeighbor(game, player.seat, -1);
    const right = closestAliveNeighbor(game, player.seat, 1);
    const truthful = [left, right].filter((item): item is ClocktowerPlayer => Boolean(item))
      .filter((item) => resolveRegistration(game, item, `empath:${player.seat}`).alignment === 'evil').length;
    privateInfo(game, player.seat, `你获知：你两侧最近的存活玩家中有 ${falseOrTrueCount(game, player, 'empath', truthful, 2)} 名邪恶。`);
    return true;
  }
  if (role === 'undertaker') {
    if (!game.lastExecutedSeat) {
      privateInfo(game, player.seat, '昨天天没有玩家因处决而死亡。');
      return true;
    }
    const target = playerAt(game, game.lastExecutedSeat);
    if (!target) return true;
    const truthful = resolveRegistration(game, target, `undertaker:${player.seat}`).role;
    const shown = isImpaired(game, player)
      ? storytellerChoose(game, 'undertaker_false_role', Object.keys(clocktowerRoleById) as ClocktowerRoleId[], `undertaker:false:${player.seat}`)
      : truthful;
    privateInfo(game, player.seat, `你获知：昨天被处决并死亡的 ${target.seat}号 是 ${clocktowerRoleById[shown].name}。`);
    return true;
  }
  if (role === 'spy') {
    const grimoire = game.players
      .map((item) => `${item.seat}号：${clocktowerRoleById[item.trueCharacter].name} · ${item.alive ? '存活' : '死亡'}${item.drunk ? ' · Drunk' : ''}${item.poisonedUntilDay !== undefined && item.poisonedUntilDay >= game.day ? ' · 中毒' : ''}`)
      .join('\n');
    privateInfo(game, player.seat, `你查看了魔典：\n${grimoire}`);
    return true;
  }
  return false;
}

function nightTurnSpec(game: ClocktowerGameSession, player: ClocktowerPlayer): TurnSpec | undefined {
  const role = effectiveRole(player);
  const allSeats = game.players.map((item) => item.seat);
  if (addAutomaticNightInfo(game, player, role)) return undefined;
  if (role === 'poisoner') return {
    seat: player.seat, kind: 'ability', instruction: '选择今晚要投毒的一名玩家。', expectedActions: ['choose_player'],
    allowedTargets: allSeats, minTargets: 1, maxTargets: 1, pureAction: true, metadata: { role }
  };
  if (role === 'fortune_teller') return {
    seat: player.seat, kind: 'ability', instruction: '选择两名玩家进行占卜。', expectedActions: ['choose_players'],
    allowedTargets: allSeats, minTargets: 2, maxTargets: 2, pureAction: true, metadata: { role }
  };
  if (role === 'monk') return {
    seat: player.seat, kind: 'ability', instruction: '选择一名非自己的存活玩家，使其当夜免受恶魔能力杀死。', expectedActions: ['choose_player'],
    allowedTargets: aliveSeats(game).filter((seat) => seat !== player.seat), minTargets: 1, maxTargets: 1, pureAction: true, metadata: { role }
  };
  if (role === 'butler') return {
    seat: player.seat, kind: 'ability', instruction: '选择一名非自己的存活玩家作为明天的主人。', expectedActions: ['choose_player'],
    allowedTargets: aliveSeats(game).filter((seat) => seat !== player.seat), minTargets: 1, maxTargets: 1, pureAction: true, metadata: { role }
  };
  if (role === 'imp' && game.phase === 'other_night') return {
    seat: player.seat, kind: 'ability', instruction: '选择今晚要攻击的一名存活玩家。你可以选择自己。', expectedActions: ['choose_player'],
    allowedTargets: aliveSeats(game), minTargets: 1, maxTargets: 1, pureAction: true, metadata: { role }
  };
  return undefined;
}

function pendingRavenkeeper(game: ClocktowerGameSession): ClocktowerPlayer | undefined {
  return game.players.find((player) =>
    !player.alive
    && game.pendingNightDeaths.includes(player.seat)
    && effectiveRole(player) === 'ravenkeeper'
    && !player.oncePerGameUsed.ravenkeeper_trigger
  );
}

function eligibleSlayers(game: ClocktowerGameSession): ClocktowerPlayer[] {
  return game.players.filter((player) => player.alive && effectiveRole(player) === 'slayer' && !player.oncePerGameUsed.slayer);
}

function prepareTurn(game: ClocktowerGameSession, spec: TurnSpec): { type: 'ai'; pending: ClocktowerPendingTurn } | { type: 'human' } {
  const player = playerAt(game, spec.seat);
  if (!player) throw new Error('待行动玩家不存在');
  const expectedActions = spec.expectedActions ?? [];
  const allowedTargets = spec.allowedTargets ?? [];
  const minTargets = spec.minTargets ?? 0;
  const maxTargets = spec.maxTargets ?? 0;
  const prompt = buildClocktowerTurnPrompt({
    game,
    seat: spec.seat,
    kind: spec.kind,
    instruction: spec.instruction,
    expectedActions,
    allowedTargets,
    minTargets,
    maxTargets,
    pureAction: spec.pureAction,
    correction: spec.correction
  });
  const base = {
    turnId: clockId('clock-turn'),
    actionId: clockId('clock-action'),
    seat: spec.seat,
    phaseId: game.phaseId,
    kind: spec.kind,
    prompt,
    expectedActions,
    allowedTargets,
    minTargets,
    maxTargets,
    metadata: spec.metadata
  };
  if (player.controller === 'human') {
    game.pendingHumanAction = base;
    game.status = 'waiting_human';
    return { type: 'human' };
  }
  if (!player.providerId) throw new Error('AI 玩家缺少 Provider');
  const pending: ClocktowerPendingTurn = {
    ...base,
    operationId: clockId('clock-op'),
    playerId: player.id,
    provider: player.providerId,
    retryCount: spec.retryCount ?? 0,
    startedAt: Date.now(),
    phase: 'preparing'
  };
  game.pendingTurn = pending;
  return { type: 'ai', pending };
}

function currentNomination(game: ClocktowerGameSession): ClocktowerNomination | undefined {
  return game.currentNominationId ? game.nominations.find((item) => item.id === game.currentNominationId) : undefined;
}

function recomputeAboutToDie(game: ClocktowerGameSession): void {
  const qualifying = game.nominations.filter((item) => item.day === game.day && item.resolved && item.qualifies);
  const max = qualifying.reduce((value, item) => Math.max(value, item.voteCount), 0);
  const top = qualifying.filter((item) => item.voteCount === max);
  game.aboutToDieSeat = max > 0 && top.length === 1 ? top[0].nomineeSeat : undefined;
}

function resolveVote(game: ClocktowerGameSession, nomination: ClocktowerNomination): void {
  nomination.voteCount = nomination.votes.length;
  nomination.threshold = Math.ceil(alivePlayers(game).length / 2);
  nomination.qualifies = nomination.voteCount >= nomination.threshold;
  nomination.resolved = true;
  publicEvent(game, 'vote', `${nomination.nomineeSeat}号获得 ${nomination.voteCount} 票（门槛 ${nomination.threshold}）。`, undefined, {
    kind: 'result',
    nominationId: nomination.id,
    nomineeSeat: nomination.nomineeSeat,
    votes: nomination.votes,
    threshold: nomination.threshold
  });
  recomputeAboutToDie(game);
}

function executeSeat(game: ClocktowerGameSession, seat: number, reason: string): void {
  game.executedTodaySeat = seat;
  const player = playerAt(game, seat);
  publicEvent(game, 'execution', `${seat}号被处决。`, undefined, { seat });
  if (!player?.alive) return;
  const wasDemon = player.trueCharacter === 'imp';
  markDead(game, seat, reason);
  game.lastExecutedSeat = seat;
  if (player.trueCharacter === 'saint' && !isImpaired(game, player)) {
    setWinner(game, 'evil', '圣徒因处决而死亡。');
    return;
  }
  if (wasDemon) {
    const replaced = handleDemonDeathReplacement(game, seat, false);
    if (!replaced) checkClocktowerWinner(game);
    else checkClocktowerWinner(game);
  } else {
    checkClocktowerWinner(game);
  }
}

function killAtNight(game: ClocktowerGameSession, targetSeat: number, sourceSeat: number): void {
  const source = playerAt(game, sourceSeat);
  const target = playerAt(game, targetSeat);
  if (!source || !target?.alive) return;
  if (!functioning(game, source, 'imp')) return;
  if (targetSeat !== sourceSeat && functioning(game, target, 'soldier')) return;
  if (targetSeat !== sourceSeat && game.currentMonkProtectedSeat === targetSeat) return;

  let actualTarget = target;
  if (targetSeat !== sourceSeat && functioning(game, target, 'mayor')) {
    const redirects = [target, ...alivePlayers(game).filter((player) => player.seat !== targetSeat && player.trueCharacter !== 'imp')];
    actualTarget = storytellerChoose(game, 'mayor_redirect', redirects, `mayor:${game.day}:${targetSeat}`, (player) => String(player.seat));
  }
  const wasDemon = actualTarget.trueCharacter === 'imp';
  actualTarget.alive = false;
  if (!game.pendingNightDeaths.includes(actualTarget.seat)) game.pendingNightDeaths.push(actualTarget.seat);
  addClocktowerEvent(game, 'death', `${actualTarget.seat}号在夜间死亡（未公开）。`, { type: 'storyteller' }, undefined, { seat: actualTarget.seat, reason: 'demon' });
  if (wasDemon) {
    const replaced = handleDemonDeathReplacement(game, actualTarget.seat, actualTarget.seat === sourceSeat);
    if (!replaced) checkClocktowerWinner(game);
  }
}

function applyAbilityAction(game: ClocktowerGameSession, player: ClocktowerPlayer, pending: Pick<ClocktowerPendingTurn | ClocktowerPendingHumanAction, 'metadata'>, parsed: ParsedClocktowerAction): void {
  const role = String(pending.metadata?.role ?? '') as ClocktowerRoleId;
  const targets = parsed.targetSeats ?? [];
  if (role === 'poisoner' && targets[0] && functioning(game, player, 'poisoner')) {
    const target = playerAt(game, targets[0]);
    if (target) {
      target.poisonedUntilDay = game.day;
      game.currentPoisonedSeat = target.seat;
      addClocktowerEvent(game, 'ability', `${player.seat}号投毒 ${target.seat}号。`, { type: 'storyteller' }, player.seat);
    }
  }
  if (role === 'monk' && targets[0] && functioning(game, player, 'monk')) {
    game.currentMonkProtectedSeat = targets[0];
    addClocktowerEvent(game, 'ability', `${player.seat}号保护 ${targets[0]}号。`, { type: 'storyteller' }, player.seat);
  }
  if (role === 'butler' && targets[0] && functioning(game, player, 'butler')) {
    game.currentButlerMasters[String(player.seat)] = targets[0];
    privateInfo(game, player.seat, `你选择 ${targets[0]}号 作为明天的主人。`);
  }
  if (role === 'fortune_teller' && targets.length === 2) {
    const truthful = targets.some((seat) => {
      const target = playerAt(game, seat);
      return target ? resolveRegistration(game, target, `fortune:${player.seat}`).isDemon || seat === game.redHerringSeat : false;
    });
    const shown = informationTruth(game, player, `fortune:${targets.join(',')}`, truthful);
    privateInfo(game, player.seat, `你占卜 ${targets.join('号、')}号：结果为 ${shown ? 'YES（至少一人显示为恶魔）' : 'NO'}。`);
  }
  if (role === 'imp' && targets[0]) killAtNight(game, targets[0], player.seat);
  if (role === 'ravenkeeper' && targets[0]) {
    player.oncePerGameUsed.ravenkeeper_trigger = true;
    const target = playerAt(game, targets[0]);
    if (target) {
      const truthful = resolveRegistration(game, target, `ravenkeeper:${player.seat}`).role;
      const shown = isImpaired(game, player)
        ? storytellerChoose(game, 'ravenkeeper_false_role', Object.keys(clocktowerRoleById) as ClocktowerRoleId[], `ravenkeeper:false:${player.seat}`)
        : truthful;
      privateInfo(game, player.seat, `你选择了 ${targets[0]}号，获知其角色为：${clocktowerRoleById[shown].name}。`);
    }
  }
  if (role === 'slayer' && targets[0]) {
    player.oncePerGameUsed.slayer = true;
    publicEvent(game, 'ability', `${player.seat}号发动杀手能力，选择 ${targets[0]}号。`, player.seat);
    const target = playerAt(game, targets[0]);
    if (target && functioning(game, player, 'slayer') && resolveRegistration(game, target, `slayer:${player.seat}`).isDemon && target.alive) {
      const wasDemon = target.trueCharacter === 'imp';
      markDead(game, target.seat, 'slayer');
      if (wasDemon) {
        const replaced = handleDemonDeathReplacement(game, target.seat, false);
        if (!replaced) checkClocktowerWinner(game);
        else checkClocktowerWinner(game);
      } else {
        checkClocktowerWinner(game);
      }
    }
  }
}

function nominationVoteQueue(game: ClocktowerGameSession): number[] {
  const nomination = currentNomination(game);
  if (!nomination) return [];
  const nominee = nomination.nomineeSeat;
  const n = game.players.length;
  return Array.from({ length: n }, (_, index) => ((nominee + index) % n) + 1);
}

function recordPublicVote(game: ClocktowerGameSession, nomination: ClocktowerNomination, player: ClocktowerPlayer, yes: boolean): void {
  const canVote = player.alive || player.deadVoteAvailable;
  const counted = yes && canVote;
  if (counted) {
    nomination.votes.push(player.seat);
    if (!player.alive) {
      player.deadVoteAvailable = false;
      nomination.deadVotesSpent.push(player.seat);
    }
  }
  publicEvent(
    game,
    'vote',
    `${player.seat}号${counted ? '投票' : '不投'}。当前累计 ${nomination.votes.length} 票。`,
    player.seat,
    {
      kind: 'individual',
      nominationId: nomination.id,
      seat: player.seat,
      yes: counted,
      runningTotal: nomination.votes.length
    }
  );
  game.cursor.index += 1;
}

function applyParsedAction(
  game: ClocktowerGameSession,
  pending: Pick<ClocktowerPendingTurn | ClocktowerPendingHumanAction, 'actionId' | 'turnId' | 'seat' | 'phaseId' | 'kind' | 'metadata'>,
  parsed: ParsedClocktowerAction
): void {
  const player = playerAt(game, pending.seat);
  if (!player) return;
  if (parsed.actionType) {
    game.actions.push({
      id: pending.actionId,
      phaseId: pending.phaseId,
      turnId: pending.turnId,
      actorSeat: pending.seat,
      type: parsed.actionType,
      targetSeats: parsed.targetSeats,
      text: parsed.displayText,
      committedAt: Date.now()
    });
  }

  if (pending.kind === 'ability') {
    if (parsed.actionType !== 'pass') applyAbilityAction(game, player, pending, parsed);
    return;
  }
  if (pending.kind === 'whisper') {
    if (String(pending.metadata?.mode) === 'reply') {
      const peer = Number(pending.metadata?.peerSeat);
      if (parsed.displayText) addClocktowerEvent(game, 'whisper', parsed.displayText, { type: 'private', seats: [pending.seat, peer] }, pending.seat);
      game.cursor.stage = 'whisper_init';
      game.cursor.index += 1;
      return;
    }
    if (parsed.actionType === 'whisper' && parsed.targetSeats?.[0] && parsed.displayText) {
      const target = parsed.targetSeats[0];
      addClocktowerEvent(game, 'whisper', parsed.displayText, { type: 'private', seats: [pending.seat, target] }, pending.seat);
      game.whisperCountBySeat[String(pending.seat)] = (game.whisperCountBySeat[String(pending.seat)] ?? 0) + 1;
      game.cursor.stage = `whisper_reply:${pending.seat}:${target}`;
      return;
    }
    game.cursor.index += 1;
    return;
  }
  if (pending.kind === 'speech' || pending.kind === 'accusation' || pending.kind === 'defense') {
    if (parsed.displayText) publicEvent(game, 'speech', parsed.displayText, pending.seat);
    game.cursor.index += 1;
    return;
  }
  if (pending.kind === 'nominate') {
    if (parsed.actionType === 'nominate' && parsed.targetSeats?.[0]) {
      const targetSeat = parsed.targetSeats[0];
      const nomination: ClocktowerNomination = {
        id: clockId('nomination'),
        day: game.day,
        nominatorSeat: pending.seat,
        nomineeSeat: targetSeat,
        votes: [],
        deadVotesSpent: [],
        voteCommitments: {},
        threshold: Math.ceil(alivePlayers(game).length / 2),
        voteCount: 0,
        qualifies: false,
        resolved: false
      };
      game.nominations.push(nomination);
      game.currentNominationId = nomination.id;
      game.nominatedByToday.push(pending.seat);
      game.nominatedToday.push(targetSeat);
      publicEvent(game, 'nomination', `${pending.seat}号提名 ${targetSeat}号。`, pending.seat);
      const nominee = playerAt(game, targetSeat);
      if (nominee?.trueCharacter === 'virgin' && !nominee.oncePerGameUsed.virgin) {
        nominee.oncePerGameUsed.virgin = true;
        const nominator = playerAt(game, pending.seat);
        if (nominator && functioning(game, nominee, 'virgin') && resolveRegistration(game, nominator, `virgin:${targetSeat}`).type === 'townsfolk') {
          executeSeat(game, nominator.seat, 'virgin');
          if (game.winner) return;
          game.nominationIndex = game.nominationQueue.length;
          setClocktowerPhase(game, 'day_end');
          return;
        }
      }
      setClocktowerPhase(game, 'accusation', [pending.seat]);
      return;
    }
    game.nominationIndex += 1;
    return;
  }
  if (pending.kind === 'vote') {
    const nomination = currentNomination(game);
    if (!nomination) return;
    const yes = parsed.actionType === 'vote_yes';
    if (String(pending.metadata?.mode) === 'butler_master_commit') {
      (nomination.voteCommitments ??= {})[String(player.seat)] = yes;
      return;
    }
    recordPublicVote(game, nomination, player, yes);
  }
}

function nextStep(game: ClocktowerGameSession): { pending?: ClocktowerPendingTurn; waiting?: boolean; changed?: boolean } {
  if (game.status !== 'running') return { waiting: true };
  if (game.pendingTurn || game.pendingHumanAction) return { waiting: true };
  if (game.winner) return { waiting: true };

  if (game.phase === 'first_night' || game.phase === 'other_night') {
    if (game.phase === 'other_night') {
      const ravenkeeper = pendingRavenkeeper(game);
      if (ravenkeeper) {
        const result = prepareTurn(game, {
          seat: ravenkeeper.seat,
          kind: 'ability',
          instruction: '你在夜间死亡。选择一名玩家并获知其角色。',
          expectedActions: ['choose_player'],
          allowedTargets: game.players.map((player) => player.seat),
          minTargets: 1,
          maxTargets: 1,
          pureAction: true,
          metadata: { role: 'ravenkeeper' }
        });
        return result.type === 'ai' ? { pending: result.pending } : { waiting: true, changed: true };
      }
    }
    if (game.cursor.index < game.cursor.queue.length) {
      const seat = game.cursor.queue[game.cursor.index];
      const player = playerAt(game, seat);
      game.cursor.index += 1;
      if (!player?.alive) return { changed: true };
      const spec = nightTurnSpec(game, player);
      if (!spec) return { changed: true };
      const result = prepareTurn(game, spec);
      return result.type === 'ai' ? { pending: result.pending } : { waiting: true, changed: true };
    }
    setClocktowerPhase(game, 'dawn');
    return { changed: true };
  }

  if (game.phase === 'dawn') {
    if (game.pendingNightDeaths.length) {
      publicEvent(game, 'storyteller', `昨夜死亡：${game.pendingNightDeaths.map((seat) => `${seat}号`).join('、')}。`);
    } else {
      publicEvent(game, 'storyteller', '昨夜平安无事。');
    }
    game.pendingNightDeaths = [];
    game.currentMonkProtectedSeat = undefined;
    // Undertaker consumes the previous day's execution during other_night.
    // Clear it at dawn so a later no-execution day cannot replay stale info.
    game.lastExecutedSeat = undefined;
    if (checkClocktowerWinner(game)) return { changed: true, waiting: true };
    setClocktowerPhase(game, 'day_whispers', game.players.map((player) => player.seat), 'whisper_init');
    return { changed: true };
  }

  if (game.phase === 'day_whispers') {
    if (game.cursor.stage?.startsWith('whisper_reply:')) {
      const [, initiatorRaw, targetRaw] = game.cursor.stage.split(':');
      const initiatorSeat = Number(initiatorRaw);
      const targetSeat = Number(targetRaw);
      const target = playerAt(game, targetSeat);
      if (!target) {
        game.cursor.stage = 'whisper_init';
        game.cursor.index += 1;
        return { changed: true };
      }
      const result = prepareTurn(game, {
        seat: targetSeat,
        kind: 'whisper',
        instruction: `${initiatorSeat}号刚刚私聊了你。请私密回复一次。`,
        metadata: { mode: 'reply', peerSeat: initiatorSeat }
      });
      return result.type === 'ai' ? { pending: result.pending } : { waiting: true, changed: true };
    }
    if (game.cursor.index >= game.cursor.queue.length) {
      setClocktowerPhase(game, 'day_discussion', game.players.map((player) => player.seat), 'speech');
      return { changed: true };
    }
    const seat = game.cursor.queue[game.cursor.index];
    const player = playerAt(game, seat);
    if (!player || (game.whisperCountBySeat[String(seat)] ?? 0) >= game.rulesetSnapshot.whispersPerDay) {
      game.cursor.index += 1;
      return { changed: true };
    }
    const targets = game.players.map((item) => item.seat).filter((target) => target !== seat);
    const result = prepareTurn(game, {
      seat,
      kind: 'whisper',
      instruction: '你可以发起一次私聊。若要私聊，请写一段只给目标看的简短消息，并在最后提交 WHISPER；也可以直接 PASS。',
      expectedActions: ['whisper', 'pass'],
      allowedTargets: targets,
      minTargets: 0,
      maxTargets: 1,
      metadata: { mode: 'init' }
    });
    return result.type === 'ai' ? { pending: result.pending } : { waiting: true, changed: true };
  }

  if (game.phase === 'day_discussion') {
    if (game.cursor.stage === 'slayer') {
      if (game.cursor.index >= game.cursor.queue.length) {
        game.nominationQueue = aliveSeats(game);
        game.nominationIndex = 0;
        setClocktowerPhase(game, 'nomination');
        return { changed: true };
      }
      const seat = game.cursor.queue[game.cursor.index++];
      const player = playerAt(game, seat);
      if (!player?.alive) return { changed: true };
      const result = prepareTurn(game, {
        seat,
        kind: 'ability',
        instruction: '你可以选择现在发动一次杀手能力，也可以保留能力。',
        expectedActions: ['slay', 'pass'],
        allowedTargets: game.players.map((item) => item.seat).filter((target) => target !== seat),
        minTargets: 0,
        maxTargets: 1,
        pureAction: true,
        metadata: { role: 'slayer' }
      });
      return result.type === 'ai' ? { pending: result.pending } : { waiting: true, changed: true };
    }
    if (game.cursor.index < game.cursor.queue.length) {
      const seat = game.cursor.queue[game.cursor.index];
      const result = prepareTurn(game, { seat, kind: 'speech', instruction: '进行本日公开讨论发言。死亡玩家仍可正常发言。' });
      return result.type === 'ai' ? { pending: result.pending } : { waiting: true, changed: true };
    }
    const slayers = eligibleSlayers(game);
    if (slayers.length) {
      game.cursor = { queue: slayers.map((player) => player.seat), index: 0, stage: 'slayer' };
      return { changed: true };
    }
    game.nominationQueue = aliveSeats(game);
    game.nominationIndex = 0;
    setClocktowerPhase(game, 'nomination');
    return { changed: true };
  }

  if (game.phase === 'nomination') {
    if (game.nominationIndex >= game.nominationQueue.length) {
      setClocktowerPhase(game, 'execution');
      return { changed: true };
    }
    const seat = game.nominationQueue[game.nominationIndex];
    const player = playerAt(game, seat);
    if (!player?.alive || game.nominatedByToday.includes(seat)) {
      game.nominationIndex += 1;
      return { changed: true };
    }
    const targets = game.players
      .filter((item) => item.alive && item.seat !== seat && !game.nominatedToday.includes(item.seat))
      .map((item) => item.seat);
    if (!targets.length) {
      game.nominationIndex = game.nominationQueue.length;
      return { changed: true };
    }
    const result = prepareTurn(game, {
      seat,
      kind: 'nominate',
      instruction: '你现在有一次今日提名机会。选择一个尚未被提名的玩家，或 PASS。',
      expectedActions: ['nominate', 'pass'],
      allowedTargets: targets,
      minTargets: 0,
      maxTargets: 1,
      pureAction: true
    });
    return result.type === 'ai' ? { pending: result.pending } : { waiting: true, changed: true };
  }

  if (game.phase === 'accusation') {
    if (game.cursor.index >= game.cursor.queue.length) {
      const nomination = currentNomination(game);
      if (!nomination) throw new Error('当前提名丢失');
      setClocktowerPhase(game, 'defense', [nomination.nomineeSeat]);
      return { changed: true };
    }
    const seat = game.cursor.queue[game.cursor.index];
    const result = prepareTurn(game, { seat, kind: 'accusation', instruction: '请公开说明你为什么提名这名玩家。' });
    return result.type === 'ai' ? { pending: result.pending } : { waiting: true, changed: true };
  }

  if (game.phase === 'defense') {
    if (game.cursor.index >= game.cursor.queue.length) {
      setClocktowerPhase(game, 'vote', nominationVoteQueue(game));
      return { changed: true };
    }
    const seat = game.cursor.queue[game.cursor.index];
    const result = prepareTurn(game, { seat, kind: 'defense', instruction: '你被提名了。请公开进行一次辩护。' });
    return result.type === 'ai' ? { pending: result.pending } : { waiting: true, changed: true };
  }

  if (game.phase === 'vote') {
    const nomination = currentNomination(game);
    if (!nomination) throw new Error('当前投票提名丢失');
    if (game.cursor.index >= game.cursor.queue.length) {
      resolveVote(game, nomination);
      game.currentNominationId = undefined;
      game.nominationIndex += 1;
      setClocktowerPhase(game, 'nomination');
      return { changed: true };
    }
    const seat = game.cursor.queue[game.cursor.index];
    const player = playerAt(game, seat);
    if (!player || (!player.alive && !player.deadVoteAvailable)) {
      game.cursor.index += 1;
      return { changed: true };
    }
    const committed = (nomination.voteCommitments ??= {})[String(seat)];
    if (committed !== undefined) {
      recordPublicVote(game, nomination, player, committed);
      return { changed: true };
    }
    if (effectiveRole(player) === 'butler' && functioning(game, player, 'butler')) {
      const master = game.currentButlerMasters[String(player.seat)];
      if (master) {
        const masterIndex = game.cursor.queue.indexOf(master);
        if (masterIndex >= 0 && masterIndex < game.cursor.index) {
          if (!nomination.votes.includes(master)) {
            recordPublicVote(game, nomination, player, false);
            return { changed: true };
          }
        } else if (masterIndex > game.cursor.index) {
          const masterCommitment = (nomination.voteCommitments ??= {})[String(master)];
          if (masterCommitment === false) {
            recordPublicVote(game, nomination, player, false);
            return { changed: true };
          }
          if (masterCommitment === true) {
            // The master has privately committed to vote yes. The Butler may
            // now choose whether to vote; the master's own vote is only
            // published when the public cursor reaches the master's seat.
          } else {
          const masterPlayer = playerAt(game, master);
          if (!masterPlayer || (!masterPlayer.alive && !masterPlayer.deadVoteAvailable)) {
            recordPublicVote(game, nomination, player, false);
            return { changed: true };
          }
          const result = prepareTurn(game, {
            seat: master,
            kind: 'vote',
            instruction: `为了结算 ${player.seat}号管家的投票资格，请提前确认你对 ${nomination.nomineeSeat}号 本轮是否举手。你的选择现在不会公开，轮到你的座位时才公开计票。`,
            expectedActions: ['vote_yes', 'vote_no'],
            minTargets: 0,
            maxTargets: 0,
            pureAction: true,
            metadata: { nominationId: nomination.id, mode: 'butler_master_commit', butlerSeat: player.seat }
          });
          return result.type === 'ai' ? { pending: result.pending } : { waiting: true, changed: true };
          }
        }
      }
    }
    const result = prepareTurn(game, {
      seat,
      kind: 'vote',
      instruction: `当前正在对 ${nomination.nomineeSeat}号 的提名公开投票。请选择投票或不投。`,
      expectedActions: ['vote_yes', 'vote_no'],
      minTargets: 0,
      maxTargets: 0,
      pureAction: true,
      metadata: { nominationId: nomination.id }
    });
    return result.type === 'ai' ? { pending: result.pending } : { waiting: true, changed: true };
  }

  if (game.phase === 'execution') {
    if (game.aboutToDieSeat) executeSeat(game, game.aboutToDieSeat, 'execution');
    if (game.winner) return { changed: true, waiting: true };
    setClocktowerPhase(game, 'day_end');
    return { changed: true };
  }

  if (game.phase === 'day_end') {
    const mayor = game.players.find((player) => player.trueCharacter === 'mayor' && player.alive);
    if (!game.executedTodaySeat && alivePlayers(game).length === 3 && mayor && functioning(game, mayor, 'mayor')) {
      setWinner(game, 'good', '仅三名玩家存活且今天无人被处决，市长能力令善良阵营获胜。');
      return { changed: true, waiting: true };
    }
    if (checkClocktowerWinner(game)) return { changed: true, waiting: true };
    game.day += 1;
    for (const player of game.players) {
      if (player.poisonedUntilDay !== undefined && player.poisonedUntilDay < game.day) player.poisonedUntilDay = undefined;
    }
    game.currentPoisonedSeat = undefined;
    game.currentMonkProtectedSeat = undefined;
    game.executedTodaySeat = undefined;
    game.aboutToDieSeat = undefined;
    game.currentNominationId = undefined;
    game.nominatedByToday = [];
    game.nominatedToday = [];
    game.whisperCountBySeat = {};
    setClocktowerPhase(game, 'other_night', nightQueue(game, false));
    return { changed: true };
  }

  return { waiting: true };
}

export function createClocktowerEngine(bridge: ClocktowerProviderBridge) {
  async function dispatchPending(gameId: string, pending: ClocktowerPendingTurn): Promise<void> {
    const state = await loadState();
    const game = gameById(state, gameId);
    if (game.status !== 'running' || game.pendingTurn?.operationId !== pending.operationId) return;
    const binding = game.bindings[pending.playerId];
    try {
      const actual = await bridge.send(pending.provider, pending.operationId, { text: pending.prompt, attachments: [] }, binding?.tabId, binding?.conversationUrl);
      await mutatePersistedState((next) => {
        const current = gameById(next, gameId);
        if (current.pendingTurn?.operationId !== pending.operationId) return;
        current.pendingTurn.phase = 'active';
        current.bindings[pending.playerId] = { provider: pending.provider, tabId: actual.tabId, conversationUrl: actual.conversationUrl };
        current.updatedAt = Date.now();
      });
      notify(gameId);
    } catch (error) {
      await mutatePersistedState((next) => {
        const current = gameById(next, gameId);
        if (current.pendingTurn?.operationId !== pending.operationId) return;
        current.suspendedTurn = structuredClone(current.pendingTurn);
        current.pendingTurn = undefined;
        current.status = 'paused';
        current.lastError = error instanceof Error ? error.message : String(error);
        current.updatedAt = Date.now();
      });
      notify(gameId);
    }
  }

  async function advance(gameId: string): Promise<void> {
    for (let guard = 0; guard < 200; guard += 1) {
      const step = await mutatePersistedState((state) => {
        const game = gameById(state, gameId);
        const result = nextStep(game);
        return { result, pending: result.pending ? structuredClone(result.pending) : undefined };
      });
      if (step.result.changed) notify(gameId);
      if (step.pending) {
        await dispatchPending(gameId, step.pending);
        return;
      }
      if (step.result.waiting) return;
    }
    throw new Error('迷雾议会状态机超过安全推进上限');
  }

  function scheduleAdvance(gameId: string): Promise<void> {
    const tail = advanceTails.get(gameId) ?? Promise.resolve();
    const next = tail.catch(() => undefined).then(() => advance(gameId));
    advanceTails.set(gameId, next);
    const clear = () => { if (advanceTails.get(gameId) === next) advanceTails.delete(gameId); };
    void next.then(clear, clear);
    return next;
  }

  async function dispatchRetry(gameId: string, previous: ClocktowerPendingTurn, error: string): Promise<void> {
    const pending = await mutatePersistedState((state) => {
      const game = gameById(state, gameId);
      if (game.status !== 'running' || game.phaseId !== previous.phaseId || game.pendingTurn) return undefined;
      const player = playerAt(game, previous.seat);
      if (!player || player.controller !== 'ai' || !player.providerId) return undefined;
      const actionProtocol = strictClocktowerActionInstruction(
        previous.expectedActions,
        previous.minTargets,
        previous.maxTargets,
        previous.allowedTargets
      );
      const prompt = [
        '[FORMAT REPAIR]',
        `上一份回答无法结算：${error}`,
        '这是纯机器动作修复。不要解释，不要复述身份，不要写 Markdown 代码块，不要添加任何前后文字。',
        actionProtocol,
        '最终回复必须只有一行 [[ACTION:...]]。'
      ].join('\n');
      const retry: ClocktowerPendingTurn = {
        ...previous,
        operationId: clockId('clock-op'),
        turnId: clockId('clock-turn'),
        actionId: clockId('clock-action'),
        prompt,
        retryCount: previous.retryCount + 1,
        startedAt: Date.now(),
        phase: 'preparing'
      };
      game.pendingTurn = retry;
      return structuredClone(retry);
    });
    // The repair is durable before acknowledging the old terminal event.
    // Sending the repair must not hold that acknowledgement channel open.
    if (pending) void dispatchPending(gameId, pending).catch(console.error);
  }

  async function completeTurn(gameId: string, pending: ClocktowerPendingTurn, text: string): Promise<{ retry?: string; paused?: string }> {
    return mutatePersistedState((state) => {
      const game = gameById(state, gameId);
      const current = game.pendingTurn;
      if (!current || current.operationId !== pending.operationId) return {};
      const parsed = parseClocktowerAction(text);
      if (pending.expectedActions.length) {
        const validated = validateClocktowerAction({
          parsed,
          expected: pending.expectedActions,
          allowedTargets: pending.allowedTargets,
          minTargets: pending.minTargets,
          maxTargets: pending.maxTargets
        });
        if (!validated.ok) {
          game.pendingTurn = undefined;
          if (pending.retryCount < 1) return { retry: validated.error };
          if (pending.expectedActions.includes('pass')) {
            applyParsedAction(game, pending, { displayText: '', actionType: 'pass' });
            game.status = 'running';
            return {};
          }
          if (pending.expectedActions.includes('vote_no')) {
            applyParsedAction(game, pending, { displayText: '', actionType: 'vote_no' });
            game.status = 'running';
            return {};
          }
          game.suspendedTurn = structuredClone(pending);
          game.status = 'paused';
          game.lastError = `${pending.seat}号连续两次未按动作协议回复：${validated.error}`;
          return { paused: game.lastError };
        }
      }
      game.pendingTurn = undefined;
      applyParsedAction(game, pending, parsed);
      if (game.status !== 'ended') game.status = 'running';
      game.updatedAt = Date.now();
      return {};
    });
  }

  async function createGame(settings: ClocktowerSetupSettings): Promise<ClocktowerGameSession> {
    const game = createClocktowerGame(settings);
    await mutatePersistedState((state) => {
      state.clocktowerGames.push(game);
      state.activeClocktowerGameId = game.id;
      state.clocktowerSetup = structuredClone(settings);
    });
    notify(game.id);
    return game;
  }

  async function startGame(gameId: string): Promise<void> {
    const snapshot = await loadState();
    const existing = gameById(snapshot, gameId);
    if (existing.phase !== 'setup' && existing.status !== 'setup') {
      if (existing.status === 'paused' || existing.status === 'error') return resumeGame(gameId);
      return;
    }
    const aiPlayers = existing.players.filter((player) => player.controller === 'ai');
    const bindings: Array<{
      playerId: string;
      provider: ProviderId;
      binding: { tabId: number; conversationUrl?: string };
    }> = [];
    const failed: Array<{ reason: unknown; player: ClocktowerPlayer }> = [];
    for (const player of aiPlayers) {
      try {
        const binding = await bridge.createFreshConversation(player.providerId!);
        bindings.push({ playerId: player.id, provider: player.providerId!, binding });
      } catch (reason) {
        failed.push({ reason, player });
        break;
      }
    }
    if (failed.length) {
      await Promise.allSettled(bindings.map((item) => bridge.closeTab(item.binding.tabId)));
      const detail = failed
        .map(({ reason, player }) => `${player.providerId ?? 'unknown'}：${reason instanceof Error ? reason.message : String(reason)}`)
        .join('；');
      await mutatePersistedState((state) => {
        const game = gameById(state, gameId);
        game.status = 'error';
        game.lastError = `开局失败：${detail}`;
        game.bindings = {};
        game.updatedAt = Date.now();
      });
      notify(gameId);
      throw new Error(`迷雾议会开局失败：${detail}`);
    }
    await mutatePersistedState((state) => {
      const game = gameById(state, gameId);
      for (const item of bindings) {
        game.bindings[item.playerId] = { provider: item.provider, tabId: item.binding.tabId, conversationUrl: item.binding.conversationUrl };
      }
      game.status = 'running';
      game.lastError = undefined;
      publicEvent(game, 'game_start', `迷雾议会开始，共 ${game.players.length} 名玩家。公开剧本为 经典身份剧本。`);
      for (const player of game.players) {
        privateInfo(game, player.seat, `你的角色是：${clocktowerRoleById[player.perceivedCharacter].name}。你的阵营是：${player.alignment === 'good' ? '善良' : '邪恶'}。`);
      }
      setClocktowerPhase(game, 'first_night', nightQueue(game, true));
    });
    notify(gameId);
    await scheduleAdvance(gameId);
  }

  async function interruptGame(gameId: string): Promise<void> {
    const target = await mutatePersistedState((state) => {
      const game = gameById(state, gameId);
      const pending = game.pendingTurn;
      const pendingHuman = game.pendingHumanAction;
      game.status = 'paused';
      game.suspendedTurn = pending ? structuredClone(pending) : undefined;
      game.suspendedHumanAction = pendingHuman ? structuredClone(pendingHuman) : undefined;
      game.pendingTurn = undefined;
      game.pendingHumanAction = undefined;
      game.updatedAt = Date.now();
      if (!pending) return undefined;
      return { provider: pending.provider, operationId: pending.operationId, tabId: game.bindings[pending.playerId]?.tabId };
    });
    if (target) await bridge.cancel(target.provider, target.operationId, target.tabId).catch(() => undefined);
    notify(gameId);
  }

  async function resumeGame(gameId: string): Promise<void> {
    const recovery = await mutatePersistedState((state) => {
      const game = gameById(state, gameId);
      if (game.status === 'ended') return { ended: true as const };
      game.status = 'running';
      game.lastError = undefined;
      let replay: ClocktowerPendingTurn | undefined;
      if (game.suspendedTurn) {
        replay = {
          ...game.suspendedTurn,
          operationId: clockId('clock-op'),
          turnId: clockId('clock-turn'),
          actionId: clockId('clock-action'),
          startedAt: Date.now(),
          phase: 'preparing'
        };
        game.pendingTurn = replay;
        game.pendingHumanAction = undefined;
        game.suspendedTurn = undefined;
        game.suspendedHumanAction = undefined;
      } else if (game.suspendedHumanAction) {
        game.pendingHumanAction = structuredClone(game.suspendedHumanAction);
        game.pendingTurn = undefined;
        game.suspendedHumanAction = undefined;
        game.status = 'waiting_human';
      } else {
        game.pendingTurn = undefined;
        game.pendingHumanAction = undefined;
      }
      game.updatedAt = Date.now();
      return {
        ended: false as const,
        replay: replay ? structuredClone(replay) : undefined,
        waitingHuman: game.status === 'waiting_human'
      };
    });
    notify(gameId);
    if (recovery.ended) return;
    if (recovery.replay) {
      await dispatchPending(gameId, recovery.replay);
      return;
    }
    if (recovery.waitingHuman) return;
    await scheduleAdvance(gameId);
  }

  async function submitHumanAction(gameId: string, submission: HumanSubmission): Promise<void> {
    await mutatePersistedState((state) => {
      const game = gameById(state, gameId);
      const pending = game.pendingHumanAction;
      if (!pending) throw new Error('当前没有等待中的真人行动');
      const targets = submission.targetSeats ?? (submission.targetSeat ? [submission.targetSeat] : undefined);
      const parsed: ParsedClocktowerAction = {
        displayText: submission.text?.trim() ?? '',
        actionType: submission.actionType,
        targetSeats: targets
      };
      if (pending.expectedActions.length) {
        const validated = validateClocktowerAction({
          parsed,
          expected: pending.expectedActions,
          allowedTargets: pending.allowedTargets,
          minTargets: pending.minTargets,
          maxTargets: pending.maxTargets
        });
        if (!validated.ok) throw new Error(validated.error);
      } else if (!parsed.displayText) {
        throw new Error('请输入发言');
      }
      game.pendingHumanAction = undefined;
      game.status = 'running';
      applyParsedAction(game, pending, parsed);
      game.updatedAt = Date.now();
    });
    notify(gameId);
    await scheduleAdvance(gameId);
  }

  async function handleProviderEvent(event: ProviderEvent): Promise<boolean> {
    if (!event.operationId) return false;
    const state = await loadState();
    const game = state.clocktowerGames.find((item) => item.pendingTurn?.operationId === event.operationId);
    const pending = game?.pendingTurn;
    if (!game || !pending || pending.provider !== event.provider) return false;
    if (event.type === 'PROVIDER_RESPONSE_COMPLETED') {
      const result = await completeTurn(game.id, pending, event.text ?? '');
      notify(game.id);
      if (result.retry) {
        await dispatchRetry(game.id, pending, result.retry);
        return true;
      }
      if (!result.paused) void scheduleAdvance(game.id).catch(console.error);
      return true;
    }
    if (event.type === 'PROVIDER_ERROR') {
      await mutatePersistedState((next) => {
        const current = gameById(next, game.id);
        if (current.pendingTurn?.operationId !== pending.operationId) return;
        current.suspendedTurn = structuredClone(current.pendingTurn);
        current.pendingTurn = undefined;
        current.status = 'paused';
        current.lastError = event.error || `${event.provider} 执行失败`;
      });
      notify(game.id);
      return true;
    }
    if (event.tabId) {
      await mutatePersistedState((next) => {
        const current = gameById(next, game.id);
        if (current.pendingTurn?.operationId !== pending.operationId) return;
        current.bindings[pending.playerId] = {
          provider: pending.provider,
          tabId: event.tabId!,
          conversationUrl: event.url || current.bindings[pending.playerId]?.conversationUrl
        };
      });
    }
    return true;
  }

  async function updateSetup(setup: ClocktowerSetupSettings): Promise<void> {
    await mutatePersistedState((state) => { state.clocktowerSetup = structuredClone(setup); });
    notify();
  }

  async function setActiveGame(gameId?: string): Promise<void> {
    await mutatePersistedState((state) => { state.activeClocktowerGameId = gameId; });
    notify(gameId);
  }

  async function deleteGame(gameId: string): Promise<void> {
    await mutatePersistedState((state) => {
      const game = gameById(state, gameId);
      if (game.status === 'running' || game.status === 'waiting_human' || game.pendingTurn) throw new Error('请先中断正在运行的迷雾议会对局');
      state.clocktowerGames = state.clocktowerGames.filter((item) => item.id !== gameId);
      if (state.activeClocktowerGameId === gameId) state.activeClocktowerGameId = undefined;
    });
    notify();
  }

  async function attachBinding(operationId: string, provider: ProviderId, tabId: number, conversationUrl?: string): Promise<boolean> {
    return mutatePersistedState((state) => {
      const game = state.clocktowerGames.find((item) => item.pendingTurn?.operationId === operationId);
      const pending = game?.pendingTurn;
      if (!game || !pending || pending.provider !== provider) return false;
      game.bindings[pending.playerId] = { provider, tabId, conversationUrl };
      return true;
    });
  }

  function ownsOperation(state: PersistedState, operationId: string): { game: ClocktowerGameSession; pending: ClocktowerPendingTurn } | undefined {
    const game = state.clocktowerGames.find((item) => item.pendingTurn?.operationId === operationId);
    return game?.pendingTurn ? { game, pending: game.pendingTurn } : undefined;
  }

  async function recover(dispatchPreparing = false): Promise<void> {
    const recovery = await mutatePersistedState((state) => {
      const ids: string[] = [];
      const preparing: { gameId: string; pending: ClocktowerPendingTurn }[] = [];
      const staleBefore = Date.now() - 30 * 60 * 1000;
      for (const game of state.clocktowerGames) {
        const pending = game.pendingTurn;
        if (pending?.startedAt && pending.startedAt < staleBefore) {
          game.suspendedTurn = structuredClone(pending);
          game.pendingTurn = undefined;
          game.status = 'paused';
          game.lastError = '等待 AI 回复超过 30 分钟，已暂停本局';
          continue;
        }
        if (dispatchPreparing && pending?.phase === 'preparing') preparing.push({ gameId: game.id, pending: structuredClone(pending) });
        if (game.status === 'running' && !pending && !game.pendingHumanAction) ids.push(game.id);
      }
      return { ids, preparing };
    });
    for (const item of recovery.preparing) await dispatchPending(item.gameId, item.pending).catch(() => undefined);
    for (const gameId of recovery.ids) void scheduleAdvance(gameId).catch(console.error);
  }

  return {
    createGame,
    updateSetup,
    setActiveGame,
    startGame,
    interruptGame,
    resumeGame,
    submitHumanAction,
    deleteGame,
    attachBinding,
    handleProviderEvent,
    ownsOperation,
    recover
  };
}
