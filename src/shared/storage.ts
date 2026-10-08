import type { ChatMessage, ConversationMode, ConversationSession, PersistedState, ProviderBinding, ProviderId } from './types';

export const STORAGE_KEY = 'multiAiRoundtableStateV2';
const LEGACY_STORAGE_KEY = 'multiAiRoundtableStateV1';

export const DEFAULT_STATE: PersistedState = {
  activeMode: 'qa',
  settings: {
    replyAcceleration: true,
    qaProviders: ['doubao', 'deepseek'],
    roundtableProviders: ['doubao', 'deepseek'],
    werewolfProviders: ['doubao', 'deepseek', 'kimi', 'qwen', 'zhipu', 'gpt', 'gemini', 'grok'],
    fogCouncilProviders: ['doubao', 'deepseek', 'kimi', 'qwen', 'zhipu', 'gpt', 'gemini', 'grok'],
    expertPresetByProvider: {}
  },
  expertPresets: [],
  conversations: [],
  activeConversationIds: {},
  werewolfGames: [],
  werewolfSetup: {
    playerCount: 6,
    providerIds: ['doubao', 'deepseek', 'kimi', 'qwen', 'zhipu', 'gpt'],
    includeHuman: false,
    humanSeat: 0,
    presetId: 'werewolf-v1-6'
  },
  fogCouncilGames: [],
  fogCouncilSetup: {
    playerCount: 6,
    providerIds: ['doubao', 'deepseek', 'kimi', 'qwen', 'zhipu', 'gpt'],
    includeHuman: false,
    humanSeat: 0
  }
};

export function createConversationSession(mode: ConversationMode): ConversationSession {
  const now = Date.now();
  return {
    id: `session-${crypto.randomUUID()}`,
    mode,
    title: '新会话',
    createdAt: now,
    updatedAt: now,
    messages: [],
    bindings: {},
    needsFreshConversations: true,
    rounds: 2,
    expertInitializedProviders: []
  };
}

interface LegacyState {
  activeMode?: 'qa' | 'roundtable';
  settings?: { qaProviders?: ProviderId[]; roundtableProviders?: ProviderId[] };
  qaMessages?: ChatMessage[];
  roundtableMessages?: ChatMessage[];
  roundtableRounds?: number;
  roundtableBindings?: Partial<Record<ProviderId, ProviderBinding>>;
  roundtableNeedsFreshConversations?: boolean;
}

function legacySession(mode: ConversationMode, messages: ChatMessage[], rounds = 2, bindings: Partial<Record<ProviderId, ProviderBinding>> = {}, needsFresh = true): ConversationSession {
  const session = createConversationSession(mode);
  session.messages = messages;
  session.rounds = rounds;
  session.bindings = bindings;
  session.needsFreshConversations = needsFresh;
  session.title = messages.find((message) => message.role === 'user')?.text.trim().slice(0, 32) || '新会话';
  return session;
}

function migrateLegacy(legacy: LegacyState): PersistedState {
  const qa = legacySession('qa', legacy.qaMessages ?? [], 2, {}, !(legacy.qaMessages?.length));
  const roundtable = legacySession(
    'roundtable',
    legacy.roundtableMessages ?? [],
    Math.max(1, Math.min(99, Number(legacy.roundtableRounds) || 2)),
    legacy.roundtableBindings ?? {},
    legacy.roundtableNeedsFreshConversations ?? !(legacy.roundtableMessages?.length)
  );
  const expert = createConversationSession('expert');
  return {
    activeMode: legacy.activeMode ?? 'qa',
    settings: {
      replyAcceleration: true,
      qaProviders: legacy.settings?.qaProviders ?? DEFAULT_STATE.settings.qaProviders,
      roundtableProviders: legacy.settings?.roundtableProviders ?? DEFAULT_STATE.settings.roundtableProviders,
      werewolfProviders: DEFAULT_STATE.settings.werewolfProviders,
      fogCouncilProviders: DEFAULT_STATE.settings.fogCouncilProviders,
      expertPresetByProvider: {}
    },
    expertPresets: [],
    conversations: [qa, roundtable, expert],
    activeConversationIds: { qa: qa.id, roundtable: roundtable.id, expert: expert.id },
    werewolfGames: [],
    werewolfSetup: structuredClone(DEFAULT_STATE.werewolfSetup),
    fogCouncilGames: [],
    fogCouncilSetup: structuredClone(DEFAULT_STATE.fogCouncilSetup)
  };
}

export async function loadState(): Promise<PersistedState> {
  const result = await chrome.storage.local.get([STORAGE_KEY, LEGACY_STORAGE_KEY]);
  const stored = result[STORAGE_KEY] as Partial<PersistedState> | undefined;
  if (!stored) {
    const legacy = result[LEGACY_STORAGE_KEY] as LegacyState | undefined;
    return legacy ? migrateLegacy(legacy) : structuredClone(DEFAULT_STATE);
  }
  // Previous local development builds included an unrelated experimental game.
  // Keep user conversations and Werewolf sessions, but do not load/re-export
  // obsolete game records into the new, original Fog Council mode.
  const safeStored = { ...stored } as Partial<PersistedState> & Record<string, unknown>;
  for (const key of ['clocktowerGames', 'activeClocktowerGameId', 'clocktowerSetup']) delete safeStored[key];
  const activeMode = ['qa', 'roundtable', 'expert', 'werewolf', 'fog_council'].includes(String(stored.activeMode))
    ? stored.activeMode!
    : 'qa';
  return {
    ...DEFAULT_STATE,
    ...safeStored,
    activeMode,
    settings: {
      replyAcceleration: stored.settings?.replyAcceleration ?? true,
      qaProviders: stored.settings?.qaProviders ?? DEFAULT_STATE.settings.qaProviders,
      roundtableProviders: stored.settings?.roundtableProviders ?? DEFAULT_STATE.settings.roundtableProviders,
      werewolfProviders: stored.settings?.werewolfProviders ?? DEFAULT_STATE.settings.werewolfProviders,
      fogCouncilProviders: stored.settings?.fogCouncilProviders ?? DEFAULT_STATE.settings.fogCouncilProviders,
      expertPresetByProvider: stored.settings?.expertPresetByProvider ?? {}
    },
    expertPresets: stored.expertPresets ?? [],
    conversations: stored.conversations ?? [],
    activeConversationIds: stored.activeConversationIds ?? {},
    werewolfGames: stored.werewolfGames ?? [],
    activeWerewolfGameId: stored.activeWerewolfGameId,
    werewolfSetup: stored.werewolfSetup ?? structuredClone(DEFAULT_STATE.werewolfSetup),
    fogCouncilGames: stored.fogCouncilGames ?? [],
    activeFogCouncilGameId: stored.activeFogCouncilGameId,
    fogCouncilSetup: stored.fogCouncilSetup ?? structuredClone(DEFAULT_STATE.fogCouncilSetup)
  };
}

export async function saveState(state: PersistedState): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEY]: state });
}
