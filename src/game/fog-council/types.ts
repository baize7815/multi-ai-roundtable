export type CouncilChannel = 'A' | 'B' | 'C';
export type CouncilFaction = 'clarity' | 'mist';
export type CouncilRoleId =
  | 'calibrator' | 'dual-track' | 'filter' | 'wave-scout'
  | 'coordinator' | 'line-keeper' | 'fog-weaver' | 'noise-caster';
export type CouncilPhase = 'setup' | 'briefing' | 'debate' | 'ballot' | 'ended';
export type CouncilStatus = 'setup' | 'running' | 'paused' | 'ended';
export type CouncilClueKind = 'exact' | 'pair' | 'exclude' | 'noisy' | 'group';
export type CouncilVisibility = { type: 'public' } | { type: 'seat'; seat: number };

export interface CouncilPlayer {
  seat: number;
  role: CouncilRoleId;
  faction: CouncilFaction;
}

export interface CouncilClue {
  kind: CouncilClueKind;
  channels: CouncilChannel[];
  text: string;
}

export interface CouncilEvent {
  id: string;
  round: number;
  type: 'start' | 'briefing' | 'speech' | 'sealed_vote' | 'reveal' | 'end';
  actorSeat?: number;
  text: string;
  visibility: CouncilVisibility;
}

export interface CouncilRound {
  round: number;
  phaseId: string;
  channel: CouncilChannel;
  clues: Record<number, CouncilClue>;
  speeches: Record<number, string>;
  ballots: Record<number, CouncilChannel>;
}

export interface CouncilGame {
  id: string;
  seed: number;
  playerCount: 6 | 7 | 8;
  status: CouncilStatus;
  phase: CouncilPhase;
  round: number;
  players: CouncilPlayer[];
  current: CouncilRound | null;
  clarityScore: number;
  mistScore: number;
  winner?: CouncilFaction;
  committedOperationIds: string[];
  events: CouncilEvent[];
}

export interface CouncilPublicView {
  status: CouncilStatus;
  phase: CouncilPhase;
  round: number;
  seats: number[];
  currentSpeakerSeat?: number;
  votedCount: number;
  clarityScore: number;
  mistScore: number;
  winner?: CouncilFaction;
  events: CouncilEvent[];
}

export interface CouncilRoleDefinition {
  id: CouncilRoleId;
  name: string;
  faction: CouncilFaction;
  description: string;
}
