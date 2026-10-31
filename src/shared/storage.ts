import type { ChatMessage, ConversationMode, ConversationSession, ExpertPreset, PersistedState, ProviderBinding, ProviderId } from './types';

export const BUILTIN_EXPERT_PRESETS: ExpertPreset[] = [
  { id: 'builtin-expert-1', name: "产品总监", prompt: "从用户问题、价值主张、需求优先级、可验证的 MVP、商业闭环和机会成本出发，明确决策建议与放弃项。", createdAt: 1767225600000, updatedAt: 1767225600000 },
  { id: 'builtin-expert-2', name: "系统架构师", prompt: "从系统边界、技术选型、数据流、性能与可靠性、扩展成本、故障恢复与安全性评估方案，提出可落地的架构取舍。", createdAt: 1767225600000, updatedAt: 1767225600000 },
  { id: 'builtin-expert-3', name: "魔鬼代言人", prompt: "主动寻找逻辑缺陷、隐藏前提、反例、失败路径及合规与安全风险；先陈述反方最强论证，再提出可验证的修正办法。", createdAt: 1767225600000, updatedAt: 1767225600000 },
  { id: 'builtin-expert-4', name: "增长运营专家", prompt: "分析目标人群、冷启动渠道、转化漏斗、留存机制、增长实验与可衡量指标，注意获客成本和增长质量。", createdAt: 1767225600000, updatedAt: 1767225600000 },
  { id: 'builtin-expert-5', name: "用户体验设计师", prompt: "关注用户目标、任务路径、交互反馈、认知负担、信息层级、可访问性与视觉一致性，提出可测试的原型改进。", createdAt: 1767225600000, updatedAt: 1767225600000 },
  { id: 'builtin-expert-6', name: "第一性原理思考者", prompt: "明确问题定义，拆除未经证明的假设，从基本约束与可验证事实推导解法，并区分事实、推论与猜想。", createdAt: 1767225600000, updatedAt: 1767225600000 }
];

export const STORAGE_KEY = 'multiAiRoundtableStateV2';
const LEGACY_STORAGE_KEY = 'multiAiRoundtableStateV1';

export const DEFAULT_STATE: PersistedState = {
  activeMode: 'qa',
  settings: {
    replyAcceleration: true,
    replyAccelerationMode: 'background_pump',
    qaProviders: ['doubao', 'deepseek'],
    qaPresetByProvider: {},
    roundtableProviders: ['doubao', 'deepseek'],
    werewolfProviders: ['doubao', 'deepseek', 'kimi', 'qwen', 'zhipu', 'gpt', 'gemini', 'grok'],
    clocktowerProviders: ['doubao', 'deepseek', 'kimi', 'qwen', 'zhipu', 'gpt', 'gemini', 'grok'],
    expertPresetByProvider: {}
  },
  expertPresets: structuredClone(BUILTIN_EXPERT_PRESETS),
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
  clocktowerGames: [],
  clocktowerSetup: {
    playerCount: 6,
    providerIds: ['doubao', 'deepseek', 'kimi', 'qwen', 'zhipu', 'gpt'],
    includeHuman: false,
    humanSeat: 0,
    scriptId: 'trouble-brewing',
    setupMode: 'curated'
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
      replyAccelerationMode: 'background_pump',
      qaProviders: legacy.settings?.qaProviders ?? DEFAULT_STATE.settings.qaProviders,
      qaPresetByProvider: {},
      roundtableProviders: legacy.settings?.roundtableProviders ?? DEFAULT_STATE.settings.roundtableProviders,
      werewolfProviders: DEFAULT_STATE.settings.werewolfProviders,
      clocktowerProviders: DEFAULT_STATE.settings.clocktowerProviders,
      expertPresetByProvider: {}
    },
    expertPresets: structuredClone(BUILTIN_EXPERT_PRESETS),
    conversations: [qa, roundtable, expert],
    activeConversationIds: { qa: qa.id, roundtable: roundtable.id, expert: expert.id },
    werewolfGames: [],
    werewolfSetup: structuredClone(DEFAULT_STATE.werewolfSetup),
    clocktowerGames: [],
    clocktowerSetup: structuredClone(DEFAULT_STATE.clocktowerSetup)
  };
}

export async function loadState(): Promise<PersistedState> {
  const result = await chrome.storage.local.get([STORAGE_KEY, LEGACY_STORAGE_KEY]);
  const stored = result[STORAGE_KEY] as Partial<PersistedState> | undefined;
  if (!stored) {
    const legacy = result[LEGACY_STORAGE_KEY] as LegacyState | undefined;
    return legacy ? migrateLegacy(legacy) : structuredClone(DEFAULT_STATE);
  }
  return {
    ...DEFAULT_STATE,
    ...stored,
    // The public 0.2.0 build used a different experimental game mode ID.
    // Do not let its saved tab selection break the restored local game UI.
    activeMode: stored.activeMode === ('fog_council' as string) ? 'clocktower' : (stored.activeMode ?? 'qa'),
    settings: {
      replyAcceleration: stored.settings?.replyAcceleration ?? true,
      replyAccelerationMode: stored.settings?.replyAccelerationMode ?? 'background_pump',
      qaProviders: stored.settings?.qaProviders ?? DEFAULT_STATE.settings.qaProviders,
      qaPresetByProvider: stored.settings?.qaPresetByProvider ?? {},
      roundtableProviders: stored.settings?.roundtableProviders ?? DEFAULT_STATE.settings.roundtableProviders,
      werewolfProviders: stored.settings?.werewolfProviders ?? DEFAULT_STATE.settings.werewolfProviders,
      clocktowerProviders: stored.settings?.clocktowerProviders ?? DEFAULT_STATE.settings.clocktowerProviders,
      expertPresetByProvider: stored.settings?.expertPresetByProvider ?? {}
    },
    expertPresets: stored.expertPresets ?? [],
    conversations: stored.conversations ?? [],
    activeConversationIds: stored.activeConversationIds ?? {},
    werewolfGames: stored.werewolfGames ?? [],
    activeWerewolfGameId: stored.activeWerewolfGameId,
    werewolfSetup: stored.werewolfSetup ?? structuredClone(DEFAULT_STATE.werewolfSetup),
    clocktowerGames: stored.clocktowerGames ?? [],
    activeClocktowerGameId: stored.activeClocktowerGameId,
    clocktowerSetup: stored.clocktowerSetup ?? structuredClone(DEFAULT_STATE.clocktowerSetup)
  };
}

export async function saveState(state: PersistedState): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEY]: state });
}
