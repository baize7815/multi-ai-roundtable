import type { ProviderBinding, ProviderId } from '../../shared/types';

export type ClocktowerRoleType = 'townsfolk' | 'outsider' | 'minion' | 'demon';
export type ClocktowerAlignment = 'good' | 'evil';
export type ClocktowerRoleId =
  | 'washerwoman' | 'librarian' | 'investigator' | 'chef' | 'empath'
  | 'fortune_teller' | 'undertaker' | 'monk' | 'ravenkeeper' | 'virgin'
  | 'slayer' | 'soldier' | 'mayor'
  | 'butler' | 'drunk' | 'recluse' | 'saint'
  | 'poisoner' | 'spy' | 'scarlet_woman' | 'baron'
  | 'imp';

export type ClocktowerGameStatus = 'setup' | 'running' | 'paused' | 'waiting_human' | 'ended' | 'error';
export type ClocktowerPhase =
  | 'setup'
  | 'first_night'
  | 'other_night'
  | 'dawn'
  | 'day_whispers'
  | 'day_discussion'
  | 'nomination'
  | 'accusation'
  | 'defense'
  | 'vote'
  | 'execution'
  | 'day_end'
  | 'ended';

export type ClocktowerActionType =
  | 'choose_player'
  | 'choose_players'
  | 'choose_character'
  | 'nominate'
  | 'vote_yes'
  | 'vote_no'
  | 'slay'
  | 'whisper'
  | 'pass'
  | 'speech';

export type ClocktowerTurnKind =
  | 'ability'
  | 'speech'
  | 'whisper'
  | 'nominate'
  | 'accusation'
  | 'defense'
  | 'vote';

export type ClocktowerVisibility =
  | { type: 'public' }
  | { type: 'private'; seats: number[] }
  | { type: 'storyteller' }
  | { type: 'post_game' };

export interface ClocktowerRoleDefinition {
  id: ClocktowerRoleId;
  name: string;
  type: ClocktowerRoleType;
  alignment: ClocktowerAlignment;
  publicDescription: string;
  timing: string;
  firstNightOrder?: number;
  otherNightOrder?: number;
}

export interface ClocktowerReminder {
  id: string;
  type: string;
  seat?: number;
  sourceSeat?: number;
  expiresAt?: 'dawn' | 'dusk' | 'never';
  data?: Record<string, unknown>;
}

export interface ClocktowerPlayer {
  id: string;
  seat: number;
  controller: 'ai' | 'human';
  providerId?: ProviderId;
  trueCharacter: ClocktowerRoleId;
  perceivedCharacter: ClocktowerRoleId;
  alignment: ClocktowerAlignment;
  alive: boolean;
  deadVoteAvailable: boolean;
  drunk: boolean;
  poisonedUntilDay?: number;
  oncePerGameUsed: Record<string, boolean>;
  reminders: ClocktowerReminder[];
}

export interface ClocktowerEvent {
  id: string;
  phaseId: string;
  day: number;
  type:
    | 'game_start'
    | 'phase'
    | 'storyteller'
    | 'private_info'
    | 'speech'
    | 'whisper'
    | 'nomination'
    | 'vote'
    | 'execution'
    | 'death'
    | 'ability'
    | 'role_change'
    | 'game_end';
  authorSeat?: number;
  content: string;
  visibility: ClocktowerVisibility;
  createdAt: number;
  data?: Record<string, unknown>;
}

export interface ClocktowerAction {
  id: string;
  phaseId: string;
  turnId: string;
  actorSeat: number;
  type: ClocktowerActionType;
  targetSeats?: number[];
  text?: string;
  committedAt: number;
}

export interface ClocktowerStorytellerDecision {
  id: string;
  phaseId: string;
  kind: string;
  legalOptions: string[];
  selected: string;
  reason: string;
  createdAt: number;
}

export interface ClocktowerNomination {
  id: string;
  day: number;
  nominatorSeat: number;
  nomineeSeat: number;
  votes: number[];
  deadVotesSpent: number[];
  voteCommitments: Record<string, boolean>;
  threshold: number;
  voteCount: number;
  qualifies: boolean;
  resolved: boolean;
}

export interface ClocktowerRuleset {
  id: string;
  name: string;
  scriptId: 'trouble-brewing';
  playerCount: 6 | 7 | 8;
  townsfolk: number;
  outsiders: number;
  minions: number;
  demons: number;
  teensyvilleEvilInfo: boolean;
  whispersPerDay: number;
}

export interface ClocktowerPendingTurn {
  operationId: string;
  turnId: string;
  actionId: string;
  playerId: string;
  seat: number;
  provider: ProviderId;
  phaseId: string;
  kind: ClocktowerTurnKind;
  prompt: string;
  expectedActions: ClocktowerActionType[];
  allowedTargets: number[];
  minTargets: number;
  maxTargets: number;
  retryCount: number;
  startedAt: number;
  phase: 'preparing' | 'active';
  metadata?: Record<string, unknown>;
}

export interface ClocktowerPendingHumanAction {
  turnId: string;
  actionId: string;
  seat: number;
  phaseId: string;
  kind: ClocktowerTurnKind;
  prompt: string;
  expectedActions: ClocktowerActionType[];
  allowedTargets: number[];
  minTargets: number;
  maxTargets: number;
  metadata?: Record<string, unknown>;
}

export interface ClocktowerCursor {
  queue: number[];
  index: number;
  stage?: string;
  nominationIndex?: number;
  voteIndex?: number;
}

export interface ClocktowerGameSession {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  status: ClocktowerGameStatus;
  day: number;
  phase: ClocktowerPhase;
  phaseId: string;
  scriptId: 'trouble-brewing';
  seed: number;
  rulesetSnapshot: ClocktowerRuleset;
  players: ClocktowerPlayer[];
  events: ClocktowerEvent[];
  actions: ClocktowerAction[];
  storytellerDecisions: ClocktowerStorytellerDecision[];
  nominations: ClocktowerNomination[];
  bindings: Record<string, ProviderBinding>;
  cursor: ClocktowerCursor;
  pendingTurn?: ClocktowerPendingTurn;
  pendingHumanAction?: ClocktowerPendingHumanAction;
  suspendedTurn?: ClocktowerPendingTurn;
  suspendedHumanAction?: ClocktowerPendingHumanAction;
  demonBluffs: ClocktowerRoleId[];
  redHerringSeat?: number;
  currentPoisonedSeat?: number;
  currentButlerMasters: Record<string, number>;
  pendingNightDeaths: number[];
  currentMonkProtectedSeat?: number;
  executedTodaySeat?: number;
  aboutToDieSeat?: number;
  lastExecutedSeat?: number;
  nominatedByToday: number[];
  nominatedToday: number[];
  whisperCountBySeat: Record<string, number>;
  nominationQueue: number[];
  nominationIndex: number;
  currentNominationId?: string;
  winner?: ClocktowerAlignment;
  winnerReason?: string;
  endedAt?: number;
  lastError?: string;
}

export interface ClocktowerSetupSettings {
  playerCount: 6 | 7 | 8;
  providerIds: ProviderId[];
  includeHuman: boolean;
  humanSeat: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
  scriptId: 'trouble-brewing';
  setupMode: 'curated' | 'random_legal';
}

export interface ParsedClocktowerAction {
  displayText: string;
  actionType?: ClocktowerActionType;
  targetSeats?: number[];
  rawAction?: string;
}
