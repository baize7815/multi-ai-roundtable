import { COUNCIL_ROLE_BY_ID } from './roles';
import type {
  CouncilChannel, CouncilClue, CouncilEvent, CouncilFaction, CouncilGame,
  CouncilPhase, CouncilPlayer, CouncilPublicView, CouncilRoleId, CouncilRound
} from './types';

export const COUNCIL_CHANNELS = ['A', 'B', 'C'] as const;
const GOOD_ROLES: CouncilRoleId[] = [
  'calibrator', 'dual-track', 'filter', 'wave-scout', 'coordinator', 'line-keeper'
];
const MIST_ROLES: CouncilRoleId[] = ['fog-weaver', 'noise-caster'];
const TARGET_SCORE = 3;

function rng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(source: readonly T[], random: () => number): T[] {
  const result = [...source];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function choose<T>(values: readonly T[], random: () => number): T {
  return values[Math.floor(random() * values.length)];
}

function assertSeats(game: CouncilGame): void {
  if (game.players.length !== game.playerCount) throw new Error('议会座位数量异常');
  if (game.players.some((p, index) => p.seat !== index + 1)) throw new Error('座位编号异常');
}

function append(game: CouncilGame, event: Omit<CouncilEvent, 'id'>): void {
  game.events.push({ ...event, id: 'event-' + game.events.length + '-' + event.round });
}

function clueFor(role: CouncilRoleId, answer: CouncilChannel, round: number, random: () => number): CouncilClue {
  const others = COUNCIL_CHANNELS.filter((candidate) => candidate !== answer);
  const wrong = choose(others, random);
  switch (role) {
    case 'calibrator':
      return { kind: 'exact', channels: [answer], text: '定标数据确认：频道 ' + answer + '。' };
    case 'dual-track':
      return { kind: 'pair', channels: shuffle([answer, wrong], random), text: '两条可行轨道：' + [answer, wrong].sort().join(' / ') + '，其中恰有一条正确。' };
    case 'filter':
      return { kind: 'exclude', channels: [wrong], text: '故障诊断确认：频道 ' + wrong + ' 不正确。' };
    case 'wave-scout': {
      const observed = random() < 0.75 ? answer : wrong;
      return { kind: 'noisy', channels: [observed], text: '巡波观测：频道 ' + observed + '。本类型信号约有 75% 的准确率，无法得知本轮是否命中。' };
    }
    case 'coordinator':
      return round % 2 === 0
        ? { kind: 'exact', channels: [answer], text: '本轮协调校准完成：频道 ' + answer + '。' }
        : { kind: 'pair', channels: shuffle([answer, wrong], random), text: '本轮两条候选轨道：' + [answer, wrong].sort().join(' / ') + '。' };
    case 'line-keeper':
      return {
        kind: 'group',
        channels: answer === 'B' ? ['B'] : ['A', 'C'],
        text: answer === 'B' ? '线路分组识别：唯一正确频道为 B。' : '线路分组识别：正确频道属于 A/C。'
      };
    case 'fog-weaver':
    case 'noise-caster':
      return { kind: 'exact', channels: [answer], text: '你知晓本轮的真实频道是 ' + answer + '。你的阵营目标是让议会选择其他频道。' };
  }
}

function makeRound(game: CouncilGame, round: number): CouncilRound {
  // A fresh deterministic stream per round; reading a transcript never mutates RNG.
  const random = rng((game.seed ^ Math.imul(round, 0x9e3779b1)) >>> 0);
  const channel = choose(COUNCIL_CHANNELS, random);
  const clues: Record<number, CouncilClue> = {};
  for (const player of game.players) clues[player.seat] = clueFor(player.role, channel, round, random);
  return {
    round,
    phaseId: 'round-' + round + '-' + game.seed.toString(16),
    channel,
    clues,
    speeches: {},
    ballots: {}
  };
}

function enterBriefing(game: CouncilGame, round: number): void {
  game.round = round;
  game.current = makeRound(game, round);
  game.phase = 'briefing';
  append(game, {
    round, type: 'briefing', text: '第 ' + round + ' 轮信号碎片已分别密送给各席，准备公开辩论。',
    visibility: { type: 'public' }
  });
}

export function createCouncilGame(playerCount: 6 | 7 | 8, seed: number): CouncilGame {
  if (![6, 7, 8].includes(playerCount)) throw new Error('只支持 6–8 人');
  const random = rng(seed);
  const roles = shuffle([...GOOD_ROLES.slice(0, playerCount - 2), ...MIST_ROLES], random);
  const players: CouncilPlayer[] = roles.map((role, index) => ({
    seat: index + 1,
    role,
    faction: COUNCIL_ROLE_BY_ID[role].faction
  }));
  const game: CouncilGame = {
    id: 'fog-council-' + (seed >>> 0).toString(16) + '-' + playerCount,
    seed: seed >>> 0,
    playerCount,
    status: 'setup',
    phase: 'setup',
    round: 0,
    players,
    current: null,
    clarityScore: 0,
    mistScore: 0,
    committedOperationIds: [],
    events: []
  };
  assertSeats(game);
  return game;
}

export function startCouncilGame(value: CouncilGame): CouncilGame {
  if (value.status !== 'setup') throw new Error('只能从未开始状态启动');
  const game = structuredClone(value);
  game.status = 'running';
  append(game, { round: 0, type: 'start', text: '迷雾议会开始，率先修复或扰乱三个频道轮次的阵营获胜。', visibility: { type: 'public' } });
  enterBriefing(game, 1);
  return game;
}

export function openCouncilDebate(value: CouncilGame): CouncilGame {
  if (value.status !== 'running' || value.phase !== 'briefing') throw new Error('本阶段不能开始辩论');
  const game = structuredClone(value);
  game.phase = 'debate';
  return game;
}

function requireSeat(game: CouncilGame, seat: number): CouncilPlayer {
  const player = game.players.find(p => p.seat === seat);
  if (!player) throw new Error('无效座位');
  return player;
}

function checkOperation(game: CouncilGame, operationId: string): boolean {
  if (!operationId || operationId.length > 150) throw new Error('动作 ID 不合法');
  return game.committedOperationIds.includes(operationId);
}

export function submitCouncilSpeech(value: CouncilGame, seat: number, speech: string, operationId: string): CouncilGame {
  if (checkOperation(value, operationId)) return structuredClone(value);
  if (value.status !== 'running' || value.phase !== 'debate' || !value.current) throw new Error('当前不允许发言');
  requireSeat(value, seat);
  const currentSeat = Object.keys(value.current.speeches).length + 1;
  if (seat !== currentSeat) throw new Error('请按议席顺序发言');
  if (!speech.trim() || speech.length > 1500) throw new Error('发言长度不合法');
  const game = structuredClone(value);
  game.current!.speeches[seat] = speech.trim();
  game.committedOperationIds.push(operationId);
  append(game, { round: game.round, type: 'speech', actorSeat: seat, text: speech.trim(), visibility: { type: 'public' } });
  if (seat === game.playerCount) {
    game.phase = 'ballot';
    append(game, { round: game.round, type: 'sealed_vote', text: '公开讨论结束，进入逐席密封表决。', visibility: { type: 'public' } });
  }
  return game;
}

function finishRound(game: CouncilGame): void {
  const current = game.current!;
  const tallies: Record<CouncilChannel, number> = { A: 0, B: 0, C: 0 };
  Object.values(current.ballots).forEach(channel => { tallies[channel] += 1; });
  const top = Math.max(...Object.values(tallies));
  const finalists = COUNCIL_CHANNELS.filter(channel => tallies[channel] === top);
  const selected = finalists.length === 1 ? finalists[0] : undefined;
  const correct = selected === current.channel;
  if (correct) game.clarityScore++;
  else game.mistScore++;
  const summary = '第 ' + game.round + ' 轮：密封表决 A=' + tallies.A + '、B=' + tallies.B + '、C=' + tallies.C
    + '；' + (selected ? '议会选定 ' + selected : '票数持平，未能作出决议')
    + '；正确频道为 ' + current.channel + '。'
    + (correct ? '清晰阵营获得一分。' : '迷雾阵营获得一分。');
  append(game, { round: game.round, type: 'reveal', text: summary, visibility: { type: 'public' } });
  if (game.clarityScore >= TARGET_SCORE || game.mistScore >= TARGET_SCORE) {
    const winner: CouncilFaction = game.clarityScore >= TARGET_SCORE ? 'clarity' : 'mist';
    game.phase = 'ended';
    game.status = 'ended';
    game.winner = winner;
    append(game, { round: game.round, type: 'end', text: winner === 'clarity' ? '信号网络修复成功，清晰阵营获胜。' : '信号网络被迷雾夺取，迷雾阵营获胜。', visibility: { type: 'public' } });
  } else {
    enterBriefing(game, game.round + 1);
  }
}

export function submitCouncilBallot(value: CouncilGame, seat: number, channel: CouncilChannel, operationId: string): CouncilGame {
  if (checkOperation(value, operationId)) return structuredClone(value);
  if (value.status !== 'running' || value.phase !== 'ballot' || !value.current) throw new Error('当前不允许表决');
  requireSeat(value, seat);
  if (!COUNCIL_CHANNELS.includes(channel)) throw new Error('非法频道');
  if (seat in value.current.ballots) throw new Error('本轮不能重复表决');
  const game = structuredClone(value);
  game.current!.ballots[seat] = channel;
  game.committedOperationIds.push(operationId);
  // Acknowledgements are addressed solely to the submitting seat.
  append(game, { round: game.round, type: 'sealed_vote', actorSeat: seat, text: '你的密封表决已记录。', visibility: { type: 'seat', seat } });
  if (Object.keys(game.current!.ballots).length === game.playerCount) finishRound(game);
  return game;
}

export function pauseCouncilGame(value: CouncilGame): CouncilGame {
  if (value.status !== 'running') throw new Error('只有进行中的议会可以中断');
  return { ...structuredClone(value), status: 'paused' };
}

export function resumeCouncilGame(value: CouncilGame): CouncilGame {
  if (value.status !== 'paused') throw new Error('只有中断中的议会可以恢复');
  return { ...structuredClone(value), status: 'running' };
}

export function visibleCouncilEvents(game: CouncilGame, viewerSeat?: number): CouncilEvent[] {
  return game.events.filter(e => e.visibility.type === 'public'
    || (e.visibility.type === 'seat' && e.visibility.seat === viewerSeat)).map(e => structuredClone(e));
}

export function publicCouncilView(game: CouncilGame): CouncilPublicView {
  return {
    status: game.status, phase: game.phase, round: game.round,
    seats: game.players.map(p => p.seat),
    currentSpeakerSeat: game.phase === 'debate' && game.current
      ? Object.keys(game.current.speeches).length + 1 : undefined,
    votedCount: game.current && game.phase === 'ballot' ? Object.keys(game.current.ballots).length : 0,
    clarityScore: game.clarityScore,
    mistScore: game.mistScore,
    winner: game.winner,
    events: visibleCouncilEvents(game)
  };
}
