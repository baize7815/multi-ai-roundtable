import assert from 'node:assert/strict';

const storageData: Record<string, unknown> = {};

function storageGet(keys: string | string[] | Record<string, unknown> | null): Record<string, unknown> {
  if (keys === null) return { ...storageData };
  if (typeof keys === 'string') return keys in storageData ? { [keys]: storageData[keys] } : {};
  if (Array.isArray(keys)) return Object.fromEntries(keys.filter((key) => key in storageData).map((key) => [key, storageData[key]]));
  return Object.fromEntries(Object.entries(keys).map(([key, fallback]) => [key, key in storageData ? storageData[key] : fallback]));
}

(globalThis as any).chrome = {
  storage: {
    local: {
      get: async (keys: any) => storageGet(keys),
      set: async (value: Record<string, unknown>) => { Object.assign(storageData, structuredClone(value)); }
    }
  },
  runtime: { sendMessage: async () => undefined }
};

const [{ createBackgroundOrchestrator }, storage] = await Promise.all([
  import('../src/background/orchestrator'),
  import('../src/shared/storage')
]);

type ProviderId = import('../src/shared/types').ProviderId;
type ConversationSession = import('../src/shared/types').ConversationSession;
type ComposerPayload = import('../src/shared/types').ComposerPayload;

let tabId = 400;
let orchestrator: ReturnType<typeof createBackgroundOrchestrator>;
const sends: { provider: ProviderId; operationId: string; payload: ComposerPayload }[] = [];

orchestrator = createBackgroundOrchestrator({
  createFreshConversation: async (provider) => ({ tabId: ++tabId, conversationUrl: `https://test.invalid/${provider}/${tabId}` }),
  send: async (provider, operationId, payload) => {
    sends.push({ provider, operationId, payload: structuredClone(payload) });
    queueMicrotask(() => {
      void orchestrator.handleProviderEvent({
        type: 'PROVIDER_RESPONSE_COMPLETED',
        provider,
        operationId,
        text: `${provider} 的最终回复`
      });
    });
  },
  cancel: async () => undefined
});

function userMessage(text: string) {
  return { id: `user-${crypto.randomUUID()}`, role: 'user' as const, text, createdAt: Date.now(), status: 'completed' as const };
}

async function resetSessions(sessions: ConversationSession[]): Promise<void> {
  sends.length = 0;
  const state = structuredClone(storage.DEFAULT_STATE);
  state.conversations = sessions;
  state.activeConversationIds = Object.fromEntries(sessions.map((session) => [session.mode, session.id]));
  await storage.saveState(state);
}

async function waitUntil(predicate: () => Promise<boolean>, timeoutMs = 3000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 2));
  }
  throw new Error('旧模式回归测试等待超时');
}

const qa = storage.createConversationSession('qa');
qa.messages.push(userMessage('QA 回归'));
await resetSessions([qa]);
await orchestrator.startQa({ sessionId: qa.id, providers: ['doubao', 'deepseek'], payload: { text: 'QA 回归', attachments: [] } });
await waitUntil(async () => {
  const session = (await storage.loadState()).conversations.find((item) => item.id === qa.id)!;
  return session.messages.filter((message) => message.role === 'assistant' && message.status === 'completed').length === 2;
});
assert.deepEqual(new Set(sends.map((item) => item.provider)), new Set<ProviderId>(['doubao', 'deepseek']));
assert.ok(sends.every((item) => item.payload.text === 'QA 回归'), '未选择预设的既有会话必须保持原始提问');

const qaWithPresets = storage.createConversationSession('qa');
await resetSessions([qaWithPresets]);
await orchestrator.applyUiPatch({ sessions: [{
  id: qaWithPresets.id,
  addedMessages: [userMessage('预设首问')],
  qaPresetAssignments: {
    doubao: { presetId: 'preset-a', name: '产品经理', prompt: 'QA_PRESET_A：从产品视角回答。' },
    deepseek: { presetId: 'preset-b', name: '工程师', prompt: 'QA_PRESET_B：从技术视角回答。' }
  }
}] });
await orchestrator.startQa({ sessionId: qaWithPresets.id, providers: ['doubao', 'deepseek'], payload: { text: '预设首问', attachments: [] } });
await waitUntil(async () => {
  const session = (await storage.loadState()).conversations.find((item) => item.id === qaWithPresets.id)!;
  return session.qaInitializedProviders?.length === 2;
});
assert.match(sends.find((item) => item.provider === 'doubao')!.payload.text, /^QA_PRESET_A：.*\n\n预设首问$/s);
assert.match(sends.find((item) => item.provider === 'deepseek')!.payload.text, /^QA_PRESET_B：.*\n\n预设首问$/s);
assert.doesNotMatch(sends.find((item) => item.provider === 'doubao')!.payload.text, /QA_PRESET_B/);
assert.doesNotMatch(sends.find((item) => item.provider === 'deepseek')!.payload.text, /QA_PRESET_A/);
const firstState = await storage.loadState();
const firstSession = firstState.conversations.find((item) => item.id === qaWithPresets.id)!;
assert.deepEqual(firstSession.messages.filter((item) => item.role === 'user').map((item) => item.text), ['预设首问'], '会话中不应显示注入的预设内容');
firstState.expertPresets = [{ id: 'preset-a', name: '已修改', prompt: 'SHOULD_NOT_APPEAR', createdAt: 0, updatedAt: 1 }];
firstState.settings.qaPresetByProvider = { doubao: 'preset-a' };
await storage.saveState(firstState);
await orchestrator.startQa({ sessionId: qaWithPresets.id, providers: ['doubao', 'deepseek'], payload: { text: '预设追问', attachments: [] } });
await waitUntil(async () => {
  const session = (await storage.loadState()).conversations.find((item) => item.id === qaWithPresets.id)!;
  return session.messages.filter((item) => item.role === 'assistant' && item.status === 'completed').length === 4;
});
assert.deepEqual(sends.slice(-2).map((item) => item.payload.text), ['预设追问', '预设追问'], '后续回复不应重复注入预设，修改设置也不应改变既有会话');

const unselected = storage.createConversationSession('qa');
unselected.messages.push(userMessage('无预设'));
unselected.qaPresetAssignments = { doubao: { presetId: 'preset-a', name: '产品经理', prompt: 'QA_PRESET_A' } };
await resetSessions([unselected]);
await orchestrator.startQa({ sessionId: unselected.id, providers: ['deepseek'], payload: { text: '无预设', attachments: [] } });
await waitUntil(async () => {
  const session = (await storage.loadState()).conversations.find((item) => item.id === unselected.id)!;
  return session.messages.filter((message) => message.role === 'assistant' && message.status === 'completed').length === 1;
});
assert.equal(sends[0].payload.text, '无预设', '未选择预设的模型须正常发送原文');


const roundtable = storage.createConversationSession('roundtable');
roundtable.messages.push(userMessage('圆桌回归'));
await resetSessions([roundtable]);
await orchestrator.startSequential({ sessionId: roundtable.id, providers: ['doubao', 'deepseek'], payload: { text: '圆桌回归', attachments: [] }, targetRounds: 1 });
await waitUntil(async () => !(await storage.loadState()).conversations.find((item) => item.id === roundtable.id)!.execution);
assert.deepEqual(sends.map((item) => item.provider), ['doubao', 'deepseek'], 'AI 圆桌必须保持配置顺序串行接力');
const deepseekRoundPrompt = sends.find((item) => item.provider === 'deepseek')!.payload.text;
assert.match(deepseekRoundPrompt, /doubao 的最终回复/, '下一位 AI 必须看到上一位的最终回复');

const expert = storage.createConversationSession('expert');
expert.messages.push(userMessage('专家团回归'));
expert.expertAssignments = {
  doubao: { presetId: 'preset-a', name: '孔子', prompt: 'PRESET_KONGZI：你是孔子。' },
  deepseek: { presetId: 'preset-b', name: '爱因斯坦', prompt: 'PRESET_EINSTEIN：你是爱因斯坦。' }
};
expert.expertInitializedProviders = [];
await resetSessions([expert]);
await orchestrator.startSequential({ sessionId: expert.id, providers: ['doubao', 'deepseek'], payload: { text: '专家团回归', attachments: [] }, targetRounds: 1 });
await waitUntil(async () => !(await storage.loadState()).conversations.find((item) => item.id === expert.id)!.execution);
const doubaoExpert = sends.find((item) => item.provider === 'doubao')!.payload.text;
const deepseekExpert = sends.find((item) => item.provider === 'deepseek')!.payload.text;
assert.match(doubaoExpert, /PRESET_KONGZI/);
assert.doesNotMatch(doubaoExpert, /PRESET_EINSTEIN/);
assert.match(deepseekExpert, /PRESET_EINSTEIN/);
assert.doesNotMatch(deepseekExpert, /PRESET_KONGZI/, '上一个专家的预设提示词不得进入下一个 AI 上下文');
assert.match(deepseekExpert, /doubao 的最终回复/);

console.log('legacy orchestrator regression tests passed');
