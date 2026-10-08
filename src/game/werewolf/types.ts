import type { ProviderBinding, ProviderId } from '../../shared/types';

export type WerewolfRoleId = 'wolf' | 'villager' | 'seer' | 'witch' | 'hunter';
export type WerewolfFaction = 'wolf' | 'village';
export type WerewolfLifeState = 'alive' | 'dying' | 'dead';
export type WerewolfGameStatus = 'setup' | 'running' | 'paused' | 'waiting_human' | 'ended' | 'error';

export type WerewolfPhase =
  | 'setup'
  | 'night_start'
  | 'wolf_discussion'
  | 'wolf_vote'
  | 'wolf_tiebreak_discussion'
  | 'wolf_tiebreak_vote'
  | 'seer_action'
  | 'witch_action'
  | 'night_resolution'
  | 'dawn'
  | 'death_trigger'
  | 'last_word'
  | 'day_speech'
  | 'day_vote'
  | 'day_tiebreak_vote'
  | 'exile_resolution'
  | 'win_check'
  | 'ended';

export type WerewolfActionType = 'vote' | 'kill' | 'check' | 'save' | 'poison' | 'shoot' | 'pass' | 'speech';
export type WerewolfTurnKind = 'speech' | 'wolf_discussion' | 'vote' | 'kill' | 'check' | 'witch' | 'shoot' | 'last_word';

export type GameVisibility =
  | { type: 'public' }
  | { type: 'wolf' }
  | { type: 'private'; seat: number }
  | { type: 'system' };

export interface WerewolfRuleset {
  id: string;
  name: string;
  playerCount: 6 | 7 | 8;
  roleCounts: Record<WerewolfRoleId, number>;
  wolfDiscussionRounds: number;
  wolfTiePolicy: 'revote_then_seeded_random';
  dayVoteTiePolicy: 'revote_then_no_exile';
  allowWitchSelfSaveFirstNight: boolean;
  allowDoublePotionSameNight: boolean;
  hunterCanShootWhenPoisoned: boolean;
  revealRoleOnDeath: boolean;
  wolvesMaySelfKill: boolean;
  nightDeathLastWords: boolean;
  dayExileLastWords: boolean;
  winCondition: 'slaughter_edge';
}

export interface SeerCheckRecord {
  day: number;
  seat: number;
  isWolf: boolean;
}

export interface WerewolfPrivateState {
  seerChecks?: SeerCheckRecord[];
  witchAntidoteAvailable?: boolean;
  witchPoisonAvailable?: boolean;
}

export interface WerewolfPlayer {
  id: string;
  seat: number;
  controller: 'ai' | 'human';
  providerId?: ProviderId;
  role: WerewolfRoleId;
  faction: WerewolfFaction;
  lifeState: WerewolfLifeState;
  privateState: WerewolfPrivateState;
  deathCause?: 'wolf' | 'poison' | 'exile' | 'shot';
  deathDay?: number;
}

export interface WerewolfGameEvent {
  id: string;
  gameId: string;
  phaseId: string;
  type:
    | 'game_start'
    | 'phase'
    | 'speech'
    | 'wolf_chat'
    | 'vote_result'
    | 'night_result'
    | 'death'
    | 'last_word'
    | 'seer_result'
    | 'witch_action'
    | 'hunter_action'
    | 'role_reveal'
    | 'game_end'
    | 'notice';
  authorSeat?: number;
  content: string;
  visibility: GameVisibility;
  committedAt: number;
  data?: Record<string, unknown>;
}

export interface WerewolfGameAction {
  actionId: string;
  gameId: string;
  phaseId: string;
  turnId: string;
  actorSeat: number;
  type: WerewolfActionType;
  targetSeat?: number;
  committedAt: number;
}

export interface WerewolfDeathRecord {
  seat: number;
  cause: 'wolf' | 'poison' | 'exile' | 'shot';
  sourceSeat?: number;
}

export interface WerewolfPendingTurn {
  operationId: string;
  turnId: string;
  actionId: string;
  playerId: string;
  seat: number;
  provider: ProviderId;
  phaseId: string;
  kind: WerewolfTurnKind;
  prompt: string;
  allowedTargets: number[];
  expectedActions: WerewolfActionType[];
  retryCount: number;
  startedAt: number;
  phase: 'preparing' | 'active';
}

export interface WerewolfPendingHumanAction {
  turnId: string;
  actionId: string;
  seat: number;
  phaseId: string;
  kind: WerewolfTurnKind;
  allowedTargets: number[];
  expectedActions: WerewolfActionType[];
  prompt: string;
}

export interface WerewolfCursor {
  queue: number[];
  index: number;
  round: number;
  runoffCandidates?: number[];
  returnPhase?: WerewolfPhase;
}

export interface WerewolfNightState {
  wolfVotes: Record<string, number>;
  wolfTarget?: number;
  witchSavedSeat?: number;
  witchPoisonedSeat?: number;
  deaths: WerewolfDeathRecord[];
}

export interface WerewolfDayState {
  votes: Record<string, number>;
  runoffVotes: Record<string, number>;
  runoffCandidates?: number[];
  exiledSeat?: number;
}

export interface WerewolfGameSession {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  status: WerewolfGameStatus;
  day: number;
  phase: WerewolfPhase;
  phaseId: string;
  presetId: string;
  seed: number;
  rulesetSnapshot: WerewolfRuleset;
  players: WerewolfPlayer[];
  events: WerewolfGameEvent[];
  actions: WerewolfGameAction[];
  committedActionIds: string[];
  bindings: Record<string, ProviderBinding>;
  cursor: WerewolfCursor;
  night: WerewolfNightState;
  dayState: WerewolfDayState;
  pendingDeaths: WerewolfDeathRecord[];
  pendingLastWords: number[];
  pendingTurn?: WerewolfPendingTurn;
  pendingParallelTurns?: WerewolfPendingTurn[];
  pendingHumanAction?: WerewolfPendingHumanAction;
  lastError?: string;
  winner?: WerewolfFaction;
  endedAt?: number;
}

export interface WerewolfSetupSettings {
  playerCount: 6 | 7 | 8;
  providerIds: ProviderId[];
  includeHuman: boolean;
  humanSeat: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
  presetId: string;
}

export interface ParsedWerewolfAction {
  displayText: string;
  actionType?: WerewolfActionType;
  targetSeat?: number;
  rawAction?: string;
}
