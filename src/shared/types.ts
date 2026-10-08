import type { WerewolfGameSession, WerewolfSetupSettings } from '../game/werewolf/types';
import type { FogCouncilGameSession, FogCouncilSetupSettings } from '../game/fog-council/session';

export const PROVIDER_IDS = ['doubao', 'deepseek', 'kimi', 'qwen', 'zhipu', 'gpt', 'gemini', 'grok', 'wenxin', 'minimax'] as const;
export type ProviderId = (typeof PROVIDER_IDS)[number];

export type ConversationMode = 'qa' | 'roundtable' | 'expert';
export type Mode = ConversationMode | 'werewolf' | 'fog_council';
export type SequentialMode = 'roundtable' | 'expert';

export interface AttachmentPayload {
  id: string;
  name: string;
  type: string;
  size: number;
  dataUrl: string;
  kind: 'image' | 'attachment';
}

export interface ComposerPayload {
  text: string;
  attachments: AttachmentPayload[];
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  provider?: ProviderId;
  text: string;
  attachments?: Pick<AttachmentPayload, 'id' | 'name' | 'type' | 'size' | 'kind'>[];
  createdAt: number;
  status?: 'pending' | 'streaming' | 'completed' | 'error' | 'interrupted';
  error?: string;
}

export interface ProviderBinding {
  provider: ProviderId;
  tabId: number;
  conversationUrl?: string;
}

export interface ProviderCapabilities {
  text: boolean;
  images: boolean;
  attachments: boolean;
  cancel: boolean;
}

export interface AppSettings {
  replyAcceleration?: boolean;
  qaProviders: ProviderId[];
  roundtableProviders: ProviderId[];
  werewolfProviders: ProviderId[];
  fogCouncilProviders: ProviderId[];
  expertPresetByProvider: Partial<Record<ProviderId, string>>;
}

export interface ExpertPreset {
  id: string;
  name: string;
  prompt: string;
  createdAt: number;
  updatedAt: number;
}

export interface ExpertAssignmentSnapshot {
  presetId: string;
  name: string;
  prompt: string;
}

export interface ProviderOperationState {
  operationId: string;
  messageId: string;
  provider: ProviderId;
  mode: ConversationMode;
  payload: ComposerPayload;
  startedAt: number;
  phase?: 'preparing' | 'active';
}

export interface SequentialExecutionState {
  status: 'running' | 'paused';
  providers: ProviderId[];
  targetRounds: number;
  roundIndex: number;
  providerIndex: number;
  payload: ComposerPayload;
  seenCurrentUserProviders: ProviderId[];
  currentOperationId?: string;
}

export interface ConversationSession {
  id: string;
  mode: ConversationMode;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: ChatMessage[];
  bindings: Partial<Record<ProviderId, ProviderBinding>>;
  needsFreshConversations: boolean;
  rounds: number;
  execution?: SequentialExecutionState;
  pendingOperations?: Record<string, ProviderOperationState>;
  expertAssignments?: Partial<Record<ProviderId, ExpertAssignmentSnapshot>>;
  expertInitializedProviders?: ProviderId[];
}

export interface PersistedState {
  activeMode: Mode;
  settings: AppSettings;
  expertPresets: ExpertPreset[];
  conversations: ConversationSession[];
  activeConversationIds: Partial<Record<ConversationMode, string>>;
  werewolfGames: WerewolfGameSession[];
  activeWerewolfGameId?: string;
  werewolfSetup: WerewolfSetupSettings;
  fogCouncilGames: FogCouncilGameSession[];
  activeFogCouncilGameId?: string;
  fogCouncilSetup: FogCouncilSetupSettings;
}

export type ProviderEventType =
  | 'PROVIDER_READY'
  | 'PROVIDER_RESPONSE_STARTED'
  | 'PROVIDER_RESPONSE_DELTA'
  | 'PROVIDER_RESPONSE_COMPLETED'
  | 'PROVIDER_ERROR';

export interface ProviderEvent {
  type: ProviderEventType;
  provider: ProviderId;
  operationId?: string;
  text?: string;
  error?: string;
  tabId?: number;
  url?: string;
}
