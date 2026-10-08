import { ROLE_IDS_BY_TYPE, clocktowerRoleById } from './scripts';
import type {
  ClocktowerGameSession,
  ClocktowerPlayer,
  ClocktowerRoleId,
  ClocktowerRuleset,
  ClocktowerSetupSettings
} from './types';

function rng(seed: number): () => number {
  let x = (seed | 0) || 0x6d2b79f5;
  return () => {
    x |= 0;
    x = (x + 0x6d2b79f5) | 0;
    let t = Math.imul(x ^ (x >>> 15), 1 | x);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(items: T[], random: () => number): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function choose<T>(items: T[], count: number, random: () => number): T[] {
  return shuffle(items, random).slice(0, count);
}

export function clocktowerBaseCounts(playerCount: 6 | 7 | 8): Pick<ClocktowerRuleset, 'townsfolk' | 'outsiders' | 'minions' | 'demons'> {
  if (playerCount === 6) return { townsfolk: 3, outsiders: 1, minions: 1, demons: 1 };
  if (playerCount === 7) return { townsfolk: 5, outsiders: 0, minions: 1, demons: 1 };
  return { townsfolk: 5, outsiders: 1, minions: 1, demons: 1 };
}

export function buildClocktowerRuleset(playerCount: 6 | 7 | 8): ClocktowerRuleset {
  const counts = clocktowerBaseCounts(playerCount);
  return {
    id: `trouble-brewing-${playerCount}-v1`,
    name: `${playerCount} 人 经典身份剧本`,
    scriptId: 'trouble-brewing',
    playerCount,
    ...counts,
    teensyvilleEvilInfo: playerCount <= 6,
    whispersPerDay: 1
  };
}

const CURATED: Record<6 | 7 | 8, ClocktowerRoleId[][]> = {
  6: [
    ['empath', 'fortune_teller', 'monk', 'drunk', 'poisoner', 'imp'],
    ['chef', 'virgin', 'slayer', 'saint', 'spy', 'imp']
  ],
  7: [
    ['washerwoman', 'chef', 'empath', 'fortune_teller', 'monk', 'poisoner', 'imp'],
    ['investigator', 'fortune_teller', 'undertaker', 'virgin', 'soldier', 'scarlet_woman', 'imp']
  ],
  8: [
    ['washerwoman', 'chef', 'empath', 'fortune_teller', 'monk', 'drunk', 'poisoner', 'imp'],
    ['librarian', 'investigator', 'undertaker', 'virgin', 'slayer', 'saint', 'spy', 'imp']
  ]
};

function randomLegalRoles(playerCount: 6 | 7 | 8, random: () => number): ClocktowerRoleId[] {
  const base = clocktowerBaseCounts(playerCount);
  const minion = choose(ROLE_IDS_BY_TYPE.minion, base.minions, random);
  let townsfolk = base.townsfolk;
  let outsiders = base.outsiders;
  if (minion.includes('baron')) {
    townsfolk -= 2;
    outsiders += 2;
  }
  return [
    ...choose(ROLE_IDS_BY_TYPE.townsfolk, townsfolk, random),
    ...choose(ROLE_IDS_BY_TYPE.outsider, outsiders, random),
    ...minion,
    'imp'
  ];
}

export interface ResolvedClocktowerSetup {
  ruleset: ClocktowerRuleset;
  players: ClocktowerPlayer[];
  demonBluffs: ClocktowerRoleId[];
  redHerringSeat?: number;
}

export function resolveClocktowerSetup(settings: ClocktowerSetupSettings, seed: number): ResolvedClocktowerSetup {
  const random = rng(seed);
  const ruleset = buildClocktowerRuleset(settings.playerCount);
  const roles = settings.setupMode === 'curated'
    ? [...CURATED[settings.playerCount][Math.floor(random() * CURATED[settings.playerCount].length)]]
    : randomLegalRoles(settings.playerCount, random);
  if (roles.length !== settings.playerCount) throw new Error('迷雾议会阵容生成数量异常');

  const shuffledRoles = shuffle(roles, random);
  const seats = Array.from({ length: settings.playerCount }, (_, index) => index + 1);
  let humanSeat = settings.includeHuman ? settings.humanSeat : 0;
  if (settings.includeHuman && !humanSeat) humanSeat = seats[Math.floor(random() * seats.length)] as ClocktowerSetupSettings['humanSeat'];
  const providers = settings.providerIds;
  let providerIndex = 0;
  const inPlay = new Set(shuffledRoles);
  const unusedTownsfolk = ROLE_IDS_BY_TYPE.townsfolk.filter((id) => !inPlay.has(id));
  const players: ClocktowerPlayer[] = seats.map((seat, index) => {
    const trueCharacter = shuffledRoles[index];
    const definition = clocktowerRoleById[trueCharacter];
    let perceivedCharacter = trueCharacter;
    if (trueCharacter === 'drunk') {
      perceivedCharacter = unusedTownsfolk.length
        ? unusedTownsfolk[Math.floor(random() * unusedTownsfolk.length)]
        : ROLE_IDS_BY_TYPE.townsfolk[Math.floor(random() * ROLE_IDS_BY_TYPE.townsfolk.length)];
    }
    const isHuman = settings.includeHuman && seat === humanSeat;
    const providerId = isHuman ? undefined : providers[providerIndex++];
    if (!isHuman && !providerId) throw new Error('迷雾议会 AI 模型数量不足');
    return {
      id: `clock-player-${crypto.randomUUID()}`,
      seat,
      controller: isHuman ? 'human' : 'ai',
      providerId,
      trueCharacter,
      perceivedCharacter,
      alignment: definition.alignment,
      alive: true,
      deadVoteAvailable: true,
      drunk: trueCharacter === 'drunk',
      oncePerGameUsed: {},
      reminders: []
    };
  });

  const unavailableBluffs = new Set<ClocktowerRoleId>();
  for (const player of players.filter((item) => item.alignment === 'good')) {
    unavailableBluffs.add(player.trueCharacter);
    if (player.trueCharacter === 'drunk') unavailableBluffs.add(player.perceivedCharacter);
  }
  const bluffPool = [...ROLE_IDS_BY_TYPE.townsfolk, ...ROLE_IDS_BY_TYPE.outsider].filter((id) => !unavailableBluffs.has(id));
  const demonBluffs = settings.playerCount >= 7 ? choose(bluffPool, 3, random) : [];
  const fortuneTeller = players.find((player) => player.trueCharacter === 'fortune_teller');
  const redCandidates = players.filter((player) => player.alignment === 'good' && player.seat !== fortuneTeller?.seat);
  const redHerringSeat = fortuneTeller && redCandidates.length
    ? redCandidates[Math.floor(random() * redCandidates.length)].seat
    : undefined;

  return { ruleset, players, demonBluffs, redHerringSeat };
}

export function createClocktowerGame(settings: ClocktowerSetupSettings, seed = (Date.now() ^ Math.floor(Math.random() * 0x7fffffff)) >>> 0): ClocktowerGameSession {
  const resolved = resolveClocktowerSetup(settings, seed);
  const now = Date.now();
  return {
    id: `clocktower-${crypto.randomUUID()}`,
    title: `${settings.playerCount}人迷雾议会 · ${new Date(now).toLocaleString('zh-CN', { hour12: false })}`,
    createdAt: now,
    updatedAt: now,
    status: 'setup',
    day: 1,
    phase: 'setup',
    phaseId: `clock-phase-${crypto.randomUUID()}`,
    scriptId: 'trouble-brewing',
    seed,
    rulesetSnapshot: resolved.ruleset,
    players: resolved.players,
    events: [],
    actions: [],
    storytellerDecisions: [],
    nominations: [],
    bindings: {},
    cursor: { queue: [], index: 0 },
    demonBluffs: resolved.demonBluffs,
    redHerringSeat: resolved.redHerringSeat,
    currentButlerMasters: {},
    pendingNightDeaths: [],
    nominatedByToday: [],
    nominatedToday: [],
    whisperCountBySeat: {},
    nominationQueue: [],
    nominationIndex: 0
  };
}
