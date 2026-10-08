import { ROLE_IDS_BY_TYPE, clocktowerRoleById } from './scripts';
import type {
  ClocktowerAlignment,
  ClocktowerEvent,
  ClocktowerGameSession,
  ClocktowerPhase,
  ClocktowerPlayer,
  ClocktowerRoleId,
  ClocktowerRoleType,
  ClocktowerStorytellerDecision,
  ClocktowerVisibility
} from './types';

export function clockId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

export function playerAt(game: ClocktowerGameSession, seat: number): ClocktowerPlayer | undefined {
  return game.players.find((player) => player.seat === seat);
}

export function alivePlayers(game: ClocktowerGameSession): ClocktowerPlayer[] {
  return game.players.filter((player) => player.alive);
}

export function aliveSeats(game: ClocktowerGameSession): number[] {
  return alivePlayers(game).map((player) => player.seat);
}

export function publiclyAlive(game: ClocktowerGameSession, player: ClocktowerPlayer): boolean {
  if (game.status === 'ended') return player.alive;
  return player.alive || game.pendingNightDeaths.includes(player.seat);
}

export function rolePlayers(game: ClocktowerGameSession, role: ClocktowerRoleId): ClocktowerPlayer[] {
  return game.players.filter((player) => player.trueCharacter === role);
}

export function isImpaired(game: ClocktowerGameSession, player: ClocktowerPlayer): boolean {
  return player.drunk || (player.poisonedUntilDay !== undefined && player.poisonedUntilDay >= game.day);
}

export function setClocktowerPhase(game: ClocktowerGameSession, phase: ClocktowerPhase, queue: number[] = [], stage?: string): void {
  game.phase = phase;
  game.phaseId = clockId('clock-phase');
  game.cursor = { queue, index: 0, stage };
  game.pendingTurn = undefined;
  game.pendingHumanAction = undefined;
  game.updatedAt = Date.now();
  addClocktowerEvent(game, 'phase', phaseLabel(game), { type: 'public' });
}

export function phaseLabel(game: ClocktowerGameSession): string {
  const labels: Partial<Record<ClocktowerPhase, string>> = {
    setup: '等待开始',
    first_night: '第一夜',
    other_night: `第 ${game.day} 夜`,
    dawn: `第 ${game.day} 天天亮`,
    day_whispers: `第 ${game.day} 天私聊`,
    day_discussion: `第 ${game.day} 天讨论`,
    nomination: '提名阶段',
    accusation: '指控',
    defense: '辩护',
    vote: '投票',
    execution: '处决结算',
    day_end: '白天结束',
    ended: '游戏结束'
  };
  return labels[game.phase] ?? game.phase;
}

export function addClocktowerEvent(
  game: ClocktowerGameSession,
  type: ClocktowerEvent['type'],
  content: string,
  visibility: ClocktowerVisibility,
  authorSeat?: number,
  data?: Record<string, unknown>
): ClocktowerEvent {
  const event: ClocktowerEvent = {
    id: clockId('clock-event'),
    phaseId: game.phaseId,
    day: game.day,
    type,
    content,
    visibility,
    authorSeat,
    createdAt: Date.now(),
    data
  };
  game.events.push(event);
  game.updatedAt = Date.now();
  return event;
}

export function deterministicIndex(game: ClocktowerGameSession, key: string, length: number): number {
  if (length <= 1) return 0;
  let hash = game.seed >>> 0;
  const text = `${game.id}:${game.day}:${game.phaseId}:${key}`;
  for (let i = 0; i < text.length; i += 1) hash = Math.imul(hash ^ text.charCodeAt(i), 16777619) >>> 0;
  return hash % length;
}

export function storytellerChoose<T>(
  game: ClocktowerGameSession,
  kind: string,
  options: T[],
  key: string,
  describe: (value: T) => string = (value) => String(value)
): T {
  if (!options.length) throw new Error(`Storyteller 没有合法选项：${kind}`);
  const selected = options[deterministicIndex(game, key, options.length)];
  const decision: ClocktowerStorytellerDecision = {
    id: clockId('clock-st'),
    phaseId: game.phaseId,
    kind,
    legalOptions: options.map(describe),
    selected: describe(selected),
    reason: '从合法选项中使用对局 seed 进行可重放裁量。',
    createdAt: Date.now()
  };
  game.storytellerDecisions.push(decision);
  return selected;
}

export interface Registration {
  alignment: ClocktowerAlignment;
  role: ClocktowerRoleId;
  type: ClocktowerRoleType;
  isDemon: boolean;
}

function registrationOptions(subject: ClocktowerPlayer): Registration[] {
  const base = clocktowerRoleById[subject.trueCharacter];
  if (subject.trueCharacter === 'recluse') {
    return [
      { alignment: 'good', role: 'recluse', type: 'outsider', isDemon: false },
      ...ROLE_IDS_BY_TYPE.minion.map((role) => ({ alignment: 'evil' as const, role, type: 'minion' as const, isDemon: false })),
      ...ROLE_IDS_BY_TYPE.demon.map((role) => ({ alignment: 'evil' as const, role, type: 'demon' as const, isDemon: true }))
    ];
  }
  if (subject.trueCharacter === 'spy') {
    return [
      { alignment: 'evil', role: 'spy', type: 'minion', isDemon: false },
      ...ROLE_IDS_BY_TYPE.townsfolk.map((role) => ({ alignment: 'good' as const, role, type: 'townsfolk' as const, isDemon: false })),
      ...ROLE_IDS_BY_TYPE.outsider.map((role) => ({ alignment: 'good' as const, role, type: 'outsider' as const, isDemon: false }))
    ];
  }
  return [{ alignment: subject.alignment, role: subject.trueCharacter, type: base.type, isDemon: base.type === 'demon' }];
}

export function resolveRegistration(game: ClocktowerGameSession, subject: ClocktowerPlayer, purpose: string): Registration {
  const options = registrationOptions(subject);
  return options[deterministicIndex(game, `register:${purpose}:${subject.seat}`, options.length)];
}

export function resolveRegistrationAsType(
  game: ClocktowerGameSession,
  subject: ClocktowerPlayer,
  purpose: string,
  type: ClocktowerRoleType
): Registration | undefined {
  const options = registrationOptions(subject).filter((item) => item.type === type);
  if (!options.length) return undefined;
  return options[deterministicIndex(game, `register:${purpose}:${subject.seat}:${type}`, options.length)];
}

export function informationTruth(game: ClocktowerGameSession, player: ClocktowerPlayer, key: string, truthful: boolean): boolean {
  if (!isImpaired(game, player)) return truthful;
  return storytellerChoose(game, 'impaired_information', [truthful, !truthful], `impaired:${player.seat}:${key}`, String);
}

export function markDead(game: ClocktowerGameSession, seat: number, reason: string): boolean {
  const player = playerAt(game, seat);
  if (!player?.alive) return false;
  player.alive = false;
  addClocktowerEvent(game, 'death', `${seat}号死亡。`, { type: 'public' }, undefined, { seat, reason });
  return true;
}

function transformToImp(game: ClocktowerGameSession, player: ClocktowerPlayer, reason: string): void {
  const from = player.trueCharacter;
  player.trueCharacter = 'imp';
  player.perceivedCharacter = 'imp';
  player.alignment = 'evil';
  player.drunk = false;
  player.poisonedUntilDay = undefined;
  addClocktowerEvent(game, 'role_change', `你已从${clocktowerRoleById[from].name}变成小恶魔。`, { type: 'private', seats: [player.seat] }, player.seat, { from, to: 'imp', reason });
}

export function handleDemonDeathReplacement(game: ClocktowerGameSession, demonSeat: number, selfKill = false): boolean {
  const demon = playerAt(game, demonSeat);
  if (!demon || demon.trueCharacter !== 'imp') return false;
  const livingMinions = game.players.filter((player) => player.alive && clocktowerRoleById[player.trueCharacter].type === 'minion');
  const scarlet = livingMinions.find((player) => player.trueCharacter === 'scarlet_woman');
  const aliveBeforeDemonDeath = alivePlayers(game).length + (demon.alive ? 0 : 1);
  if (scarlet && !isImpaired(game, scarlet) && aliveBeforeDemonDeath >= 5) {
    transformToImp(game, scarlet, 'scarlet_woman');
    return true;
  }
  if (selfKill && livingMinions.length) {
    const successor = storytellerChoose(game, 'imp_self_kill_successor', livingMinions, `imp-self:${demonSeat}`, (p) => String(p.seat));
    transformToImp(game, successor, 'imp_self_kill');
    return true;
  }
  return false;
}

export function setWinner(game: ClocktowerGameSession, winner: ClocktowerAlignment, reason: string): void {
  if (game.winner) return;
  game.winner = winner;
  game.winnerReason = reason;
  game.status = 'ended';
  game.phase = 'ended';
  game.endedAt = Date.now();
  addClocktowerEvent(game, 'game_end', `${winner === 'good' ? '善良' : '邪恶'}阵营获胜：${reason}`, { type: 'public' });
}

export function checkClocktowerWinner(game: ClocktowerGameSession): ClocktowerAlignment | undefined {
  if (game.winner) return game.winner;
  const alive = alivePlayers(game);
  const demonAlive = alive.some((player) => player.trueCharacter === 'imp');
  if (!demonAlive) {
    setWinner(game, 'good', '恶魔已经死亡且没有合法继承者。');
    return 'good';
  }
  if (alive.length <= 2) {
    setWinner(game, 'evil', '场上只剩两名存活玩家且恶魔仍存活。');
    return 'evil';
  }
  return undefined;
}

export function closestAliveNeighbor(game: ClocktowerGameSession, seat: number, direction: -1 | 1): ClocktowerPlayer | undefined {
  const n = game.players.length;
  for (let step = 1; step < n; step += 1) {
    const candidateSeat = ((seat - 1 + direction * step + n * 2) % n) + 1;
    const player = playerAt(game, candidateSeat);
    if (player?.alive) return player;
  }
  return undefined;
}

export function chefEvilPairs(game: ClocktowerGameSession): number {
  let count = 0;
  const n = game.players.length;
  for (let seat = 1; seat <= n; seat += 1) {
    const a = playerAt(game, seat)!;
    const b = playerAt(game, seat === n ? 1 : seat + 1)!;
    if (resolveRegistration(game, a, `chef:${seat}`).alignment === 'evil' && resolveRegistration(game, b, `chef:${seat + 1}`).alignment === 'evil') count += 1;
  }
  return count;
}
