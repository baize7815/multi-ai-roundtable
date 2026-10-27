import assert from 'node:assert/strict';
import { createReplyForeground } from '../src/background/reply-foreground';
import { createConversationSession, DEFAULT_STATE } from '../src/shared/storage';
import type { ConversationMode, PersistedState, ProviderId } from '../src/shared/types';

const tabs = new Map<number, { id: number; windowId: number; groupId: number; active: boolean }>();
let activeTab = 100;
let scheduler: ReturnType<typeof createReplyForeground>;

function resetTabs(): void {
  tabs.clear();
  for (const id of [100, 101, 102, 103]) tabs.set(id, { id, windowId: 1, groupId: id === 103 ? 7 : -1, active: id === 100 });
  activeTab = 100;
}

function makeState(mode: ConversationMode, entries: Array<[ProviderId, number, 'pending' | 'streaming']>): PersistedState {
  const state = structuredClone(DEFAULT_STATE);
  state.settings.qaProviders = entries.map(([id]) => id);
  const session = createConversationSession(mode);
  session.pendingOperations = {};
  for (const [provider, tabId, status] of entries) {
    session.bindings[provider] = { provider, tabId };
    const operationId = `op-${provider}`;
    const messageId = `msg-${provider}`;
    session.messages.push({ id: messageId, provider, role: 'assistant', text: '', createdAt: Date.now(), status });
    session.pendingOperations[operationId] = {
      operationId, messageId, provider, mode, payload: { text: 'test', attachments: [] }, phase: 'active', startedAt: Date.now()
    };
  }
  state.conversations = [session];
  return state;
}

(globalThis as any).chrome = {
  tabs: {
    get: async (id: number) => {
      const tab = tabs.get(id);
      if (!tab) throw new Error('missing tab');
      return { ...tab };
    },
    query: async ({ active, windowId }: { active?: boolean; windowId?: number }) =>
      [...tabs.values()].filter((tab) => (!active || tab.id === activeTab) && (windowId === undefined || tab.windowId === windowId)).map((tab) => ({ ...tab })),
    update: async (id: number, options: { active?: boolean }) => {
      const tab = tabs.get(id);
      if (!tab) throw new Error('missing tab');
      if (options.active) {
        activeTab = id;
        scheduler.onActivated({ tabId: id, windowId: 1 });
      }
      return { ...tab, active: id === activeTab };
    }
  },
  tabGroups: {
    TAB_GROUP_ID_NONE: -1,
    get: async (id: number) => ({ id, windowId: 1, collapsed: id === 7 }),
    update: async () => undefined
  }
};

resetTabs();
scheduler = createReplyForeground(async (id) => tabs.has(id));
const solo = makeState('qa', [['deepseek', 101, 'streaming']]);
await scheduler.sync(solo);
assert.equal(activeTab, 101, '单个 QA 模型回复期间应切到对应 AI 标签');
solo.conversations[0].pendingOperations = {};
await scheduler.sync(solo);
assert.equal(activeTab, 101, '单个 QA 模型完成回复后不应跳回原页面');

resetTabs();
scheduler = createReplyForeground(async (id) => tabs.has(id));
const multi = makeState('qa', [['deepseek', 101, 'pending'], ['doubao', 102, 'streaming']]);
await scheduler.sync(multi);
assert.equal(activeTab, 102, '多模型应优先显示正在生成的 AI 而不是等待中的 AI');
multi.conversations[0].messages.find((message) => message.provider === 'deepseek')!.status = 'streaming';
await scheduler.sync(multi, 101);
assert.equal(activeTab, 101, '新开始生成的模型应该能成为首选标签');
activeTab = 100;
scheduler.onActivated({ tabId: 100, windowId: 1 });
await scheduler.sync(multi, 102);
assert.equal(activeTab, 100, '手动切换标签后不允许再次抢回焦点');

resetTabs();
scheduler = createReplyForeground(async (id) => tabs.has(id));
const sequential = makeState('roundtable', [['deepseek', 103, 'streaming']]);
await scheduler.sync(sequential);
assert.equal(activeTab, 103, '圆桌仍应跟随回复且分组页可正常激活');
sequential.conversations[0].pendingOperations = {};
await scheduler.sync(sequential);
assert.equal(activeTab, 100, '圆桌回复完成后保留原有恢复逻辑');

resetTabs();
scheduler = createReplyForeground(async (id) => tabs.has(id));
const noAcceleration = makeState('qa', [['deepseek', 101, 'streaming']]);
noAcceleration.settings.replyAcceleration = false;
await scheduler.sync(noAcceleration);
assert.equal(activeTab, 100, '关闭回复加速时不能自动切换标签');

console.log('reply foreground QA/roundtable tests passed');
