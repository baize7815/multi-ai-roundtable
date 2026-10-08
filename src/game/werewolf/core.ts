import type { ProviderId } from '../../shared/types';
import { ROLE_LABELS, rulesetForPlayerCount } from './rules';
import type {
  GameVisibility,
  WerewolfDeathRecord,
  WerewolfFaction,
  WerewolfGameEvent,
  WerewolfGameSession,
  WerewolfPlayer,
  WerewolfRoleId,
  WerewolfRuleset,
  WerewolfSetupSettings
} from './types';

export function hashSeed(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state += 0x6D2B79F5;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function seededShuffle<T>(items: T[], seed: number): T[] {
  const result = [...items];
  const random = seededRandom(seed);
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function factionForRole(role: WerewolfRoleId): WerewolfFaction {
  return role === 'wolf' ? 'wolf' : 'village';
}

function roleDeck(ruleset: WerewolfRuleset): WerewolfRoleId[] {
  const deck: WerewolfRoleId[] = [];
  for (const [role, count] of Object.entries(ruleset.roleCounts) as [WerewolfRoleId, number][]) {
    for (let i = 0; i < count; i += 1) deck.push(role);
  }
  if (deck.length !== ruleset.playerCount) throw new Error(`角色数量 ${deck.length} 与玩家人数 ${ruleset.playerCount} 不一致`);
  return deck;
}

export function createGameId(): string {
  return `werewolf-${crypto.randomUUID()}`;
}

export function createWerewolfGame(setup: WerewolfSetupSettings, title = '狼人杀新对局'): WerewolfGameSession {
  const ruleset = rulesetForPlayerCount(setup.playerCount);
  const id = createGameId();
  const seed = hashSeed(id);
  const roles = seededShuffle(roleDeck(ruleset), seed);
  const seats = Array.from({ length: setup.playerCount }, (_, index) => index + 1);
  const humanSeat = setup.includeHuman
    ? (setup.humanSeat > 0 && setup.humanSeat <= setup.playerCount ? setup.humanSeat : seededShuffle(seats, seed ^ 0xA5A5A5A5)[0])
    : undefined;
  const aiProviders = setup.providerIds.slice(0, setup.playerCount - (humanSeat ? 1 : 0));
  if (aiProviders.length !== setup.playerCount - (humanSeat ? 1 : 0)) throw new Error('狼人杀可用 AI 模型数量不足');
  let providerIndex = 0;
  const players: WerewolfPlayer[] = seats.map((seat, index) => {
    const role = roles[index];
    const human = seat === humanSeat;
    const player: WerewolfPlayer = {
      id: `player-${seat}-${crypto.randomUUID()}`,
      seat,
      controller: human ? 'human' : 'ai',
      providerId: human ? undefined : aiProviders[providerIndex++] as ProviderId,
      role,
      faction: factionForRole(role),
      lifeState: 'alive',
      privateState: {}
    };
    if (role === 'seer') player.privateState.seerChecks = [];
    if (role === 'witch') {
      player.privateState.witchAntidoteAvailable = true;
      player.privateState.witchPoisonAvailable = true;
    }
    return player;
  });
  const now = Date.now();
  return {
    id,
    title,
    createdAt: now,
    updatedAt: now,
    status: 'setup',
    day: 1,
    phase: 'setup',
    phaseId: `phase-${crypto.randomUUID()}`,
    presetId: ruleset.id,
    seed,
    rulesetSnapshot: ruleset,
    players,
    events: [],
    actions: [],
    committedActionIds: [],
    bindings: {},
    cursor: { queue: [], index: 0, round: 0 },
    night: { wolfVotes: {}, deaths: [] },
    dayState: { votes: {}, runoffVotes: {} },
    pendingDeaths: [],
    pendingLastWords: []
  };
}

export function playerBySeat(game: WerewolfGameSession, seat: number): WerewolfPlayer | undefined {
  return game.players.find((player) => player.seat === seat);
}

export function alivePlayers(game: WerewolfGameSession): WerewolfPlayer[] {
  return game.players.filter((player) => player.lifeState === 'alive');
}

export function aliveSeats(game: WerewolfGameSession): number[] {
  return alivePlayers(game).map((player) => player.seat);
}

export function aliveByRole(game: WerewolfGameSession, role: WerewolfRoleId): WerewolfPlayer[] {
  return alivePlayers(game).filter((player) => player.role === role);
}

export function addGameEvent(game: WerewolfGameSession, type: WerewolfGameEvent['type'], content: string, visibility: GameVisibility, authorSeat?: number, data?: Record<string, unknown>): WerewolfGameEvent {
  const event: WerewolfGameEvent = {
    id: `event-${crypto.randomUUID()}`,
    gameId: game.id,
    phaseId: game.phaseId,
    type,
    authorSeat,
    content,
    visibility,
    committedAt: Date.now(),
    data
  };
  game.events.push(event);
  game.updatedAt = event.committedAt;
  return event;
}

export function setGamePhase(game: WerewolfGameSession, phase: WerewolfGameSession['phase'], queue: number[] = [], round = 0): void {
  game.phase = phase;
  game.phaseId = `phase-${crypto.randomUUID()}`;
  game.cursor = { queue: [...queue], index: 0, round };
  game.pendingTurn = undefined;
  game.pendingHumanAction = undefined;
  game.updatedAt = Date.now();
}

export function stableChoice<T>(items: T[], game: WerewolfGameSession, salt: string): T | undefined {
  if (!items.length) return undefined;
  const random = seededRandom(game.seed ^ hashSeed(`${game.id}:${game.day}:${game.phaseId}:${salt}`));
  return items[Math.floor(random() * items.length)];
}

export function uniqueHighestTarget(votes: Record<string, number>): { target?: number; tied: number[] } {
  const counts = new Map<number, number>();
  for (const target of Object.values(votes)) counts.set(target, (counts.get(target) ?? 0) + 1);
  if (!counts.size) return { tied: [] };
  const max = Math.max(...counts.values());
  const tied = [...counts.entries()].filter(([, count]) => count === max).map(([target]) => target).sort((a, b) => a - b);
  return { target: tied.length === 1 ? tied[0] : undefined, tied };
}

export function checkWinner(game: WerewolfGameSession): WerewolfFaction | undefined {
  const alive = alivePlayers(game);
  const wolves = alive.filter((player) => player.role === 'wolf');
  if (!wolves.length) return 'village';
  const villagers = alive.filter((player) => player.role === 'villager');
  const gods = alive.filter((player) => player.role !== 'wolf' && player.role !== 'villager');
  if (!villagers.length || !gods.length) return 'wolf';
  return undefined;
}

export function markDead(game: WerewolfGameSession, record: WerewolfDeathRecord): WerewolfPlayer | undefined {
  const player = playerBySeat(game, record.seat);
  if (!player || player.lifeState === 'dead') return player;
  player.lifeState = 'dead';
  player.deathCause = record.cause;
  player.deathDay = game.day;
  addGameEvent(game, 'death', `${player.seat}号玩家出局。`, { type: 'public' }, undefined, { seat: player.seat, cause: record.cause });
  if (game.rulesetSnapshot.revealRoleOnDeath) addGameEvent(game, 'role_reveal', `${player.seat}号身份：${ROLE_LABELS[player.role]}`, { type: 'public' });
  return player;
}

export function roleRevealSummary(game: WerewolfGameSession): string {
  return [...game.players].sort((a, b) => a.seat - b.seat).map((player) => `${player.seat}号：${ROLE_LABELS[player.role]}`).join('；');
}
