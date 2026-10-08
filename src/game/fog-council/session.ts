import type { ProviderBinding, ProviderId } from '../../shared/types';
import type { CouncilChannel, CouncilGame } from './types';

export interface FogCouncilSetup {
  playerCount: 6 | 7 | 8;
  providerIds: ProviderId[];
  includeHuman: boolean;
  humanSeat: number;
}

export interface FogCouncilPendingTurn {
  operationId: string;
  playerId: string;
  seat: number;
  provider: ProviderId;
  kind: 'speech' | 'vote';
  phase: 'preparing' | 'active';
  prompt: string;
  startedAt: number;
}

export interface FogCouncilPendingHumanAction {
  seat: number;
  kind: 'speech' | 'vote';
}

export interface FogCouncilSession extends CouncilGame {
  title: string;
  createdAt: number;
  updatedAt: number;
  bindings: Record<string, ProviderBinding>;
  seatProviders: Record<number, ProviderId>;
  humanSeat?: number;
  pendingTurn?: FogCouncilPendingTurn;
  pendingHumanAction?: FogCouncilPendingHumanAction;
  errorMessage?: string;
}

export type FogCouncilSubmission = { text?: string; channel?: CouncilChannel };

export type FogCouncilGameSession = FogCouncilSession;
export type FogCouncilSetupSettings = FogCouncilSetup;
