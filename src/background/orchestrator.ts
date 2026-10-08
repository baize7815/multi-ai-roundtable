import { providerById } from '../shared/providers';
import { loadState } from '../shared/storage';
import { mutatePersistedState } from './state-store';
import type {
  ChatMessage,
  ComposerPayload,
  ConversationSession,
  PersistedState,
  ProviderEvent,
  ProviderId,
  ProviderOperationState,
  SequentialExecutionState
} from '../shared/types';

export interface ProviderBridge {
  createFreshConversation(provider: ProviderId, preferredTabId?: number): Promise<{ tabId: number; conversationUrl?: string }>;
  send(provider: ProviderId, operationId: string, payload: ComposerPayload, tabId?: number, conversationUrl?: string): Promise<void>;
  cancel(provider: ProviderId, operationId?: string, tabId?: number): Promise<void>;
}

interface StartQaRequest {
  sessionId: string;
  providers: ProviderId[];
  payload: ComposerPayload;
}

interface StartSequentialRequest extends StartQaRequest {
  targetRounds: number;
}

function id(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

function modeLabelProvider(provider: ProviderId): string {
  return providerById[provider]?.label ?? provider;
}

function sessionById(state: PersistedState, sessionId: string): ConversationSession {
  const session = state.conversations.find((item) => item.id === sessionId);
  if (!session) throw new Error('会话不存在或已被删除');
  return session;
}

function notifyStateChanged(sessionId?: string): void {
  chrome.runtime.sendMessage({ source: 'background', type: 'STATE_UPDATED', sessionId }).catch(() => undefined);
}

function expertDisplayLabel(session: ConversationSession, provider?: ProviderId): string {
  if (!provider) return '系统';
  const expert = session.mode === 'expert' ? session.expertAssignments?.[provider] : undefined;
  return expert?.name ? `${modeLabelProvider(provider)} · ${expert.name}` : modeLabelProvider(provider);
}

function buildSequentialPrompt(session: ConversationSession, provider: ProviderId): string {
  let lastOwnIndex = -1;
  session.messages.forEach((message, index) => {
    if (message.role === 'assistant' && message.provider === provider && message.status === 'completed') lastOwnIndex = index;
  });
  const unseen = session.messages
    .slice(lastOwnIndex + 1)
    .filter((message) => message.role === 'user' || (message.role === 'assistant' && message.provider !== provider && message.status === 'completed'));
  const body = unseen.length
    ? unseen.map((message) => `【${message.role === 'user' ? '用户' : expertDisplayLabel(session, message.provider)}】\n${message.text}`).join('\n\n')
    : '请继续讨论，补充新的观点。';
  return `${body}\n\n请基于以上你尚未看到的新增内容继续讨论。避免复述已有内容，直接回应并推进讨论。`;
}

function withExpertPreset(session: ConversationSession, provider: ProviderId, prompt: string): string {
  if (session.mode !== 'expert') return prompt;
  const initialized = session.expertInitializedProviders?.includes(provider) ?? false;
  const expert = session.expertAssignments?.[provider];
  if (initialized || !expert?.prompt.trim()) return prompt;
  return `${expert.prompt.trim()}\n\n${prompt}`;
}

function touch(session: ConversationSession): void {
  session.updatedAt = Date.now();
}

export function createBackgroundOrchestrator(bridge: ProviderBridge) {
  const dispatches = new Map<string, Promise<void>>();
  async function ensureBindings(sessionId: string, providers: ProviderId[]): Promise<void> {
    const snapshot = await mutatePersistedState((state) => {
      const session = sessionById(state, sessionId);
      return {
        needsFresh: session.needsFreshConversations,
        bindings: structuredClone(session.bindings)
      };
    });

    const targets = snapshot.needsFresh
      ? providers
      : providers.filter((provider) => !snapshot.bindings[provider]);
    if (!targets.length) return;

    const created = await Promise.all(targets.map(async (provider) => {
      const existing = snapshot.bindings[provider];
      const binding = await bridge.createFreshConversation(provider, existing?.tabId);
      return [provider, { provider, tabId: binding.tabId, conversationUrl: binding.conversationUrl }] as const;
    }));

    await mutatePersistedState((state) => {
      const session = sessionById(state, sessionId);
      for (const [provider, binding] of created) session.bindings[provider] = binding;
      session.needsFreshConversations = false;
      touch(session);
    });
    notifyStateChanged(sessionId);
  }

  async function createOperation(sessionId: string, provider: ProviderId, payload: ComposerPayload): Promise<{ operation: ProviderOperationState; tabId?: number; conversationUrl?: string }> {
    return mutatePersistedState((state) => {
      const session = sessionById(state, sessionId);
      const operationId = id('op');
      const message: ChatMessage = {
        id: id('msg'),
        role: 'assistant',
        provider,
        text: '',
        createdAt: Date.now(),
        status: 'pending'
      };
      const operation: ProviderOperationState = {
        operationId,
        messageId: message.id,
        provider,
        mode: session.mode,
        payload,
        startedAt: Date.now(),
        phase: 'preparing'
      };
      session.messages.push(message);
      session.pendingOperations ??= {};
      session.pendingOperations[operationId] = operation;
      if (session.execution) session.execution.currentOperationId = operationId;
      touch(session);
      const binding = session.bindings[provider];
      return { operation, tabId: binding?.tabId, conversationUrl: binding?.conversationUrl };
    });
  }

  async function failOperation(sessionId: string, operationId: string, error: unknown): Promise<void> {
    const messageText = error instanceof Error ? error.message : String(error);
    await mutatePersistedState((state) => {
      const session = sessionById(state, sessionId);
      const operation = session.pendingOperations?.[operationId];
      if (!operation) return;
      const message = session.messages.find((item) => item.id === operation.messageId);
      if (message) Object.assign(message, { status: 'error' as const, error: messageText });
      delete session.pendingOperations?.[operationId];
      if (session.execution?.currentOperationId === operationId) {
        session.execution.currentOperationId = undefined;
        session.execution.status = 'paused';
      }
      touch(session);
    });
    notifyStateChanged(sessionId);
  }

  async function dispatchOperation(sessionId: string, provider: ProviderId, payload: ComposerPayload): Promise<void> {
    const { operation, tabId, conversationUrl } = await createOperation(sessionId, provider, payload);
    notifyStateChanged(sessionId);
    try {
      await ensureBindings(sessionId, [provider]);
      const latest = await loadState();
      const session = sessionById(latest, sessionId);
      if (!session.pendingOperations?.[operation.operationId]) return;
      const binding = session.bindings[provider];
      await bridge.send(provider, operation.operationId, payload, binding?.tabId ?? tabId, binding?.conversationUrl ?? conversationUrl);
    } catch (error) {
      await failOperation(sessionId, operation.operationId, error);
    }
  }

  async function dispatchNextSequentialTurn(sessionId: string): Promise<void> {
    const next = await mutatePersistedState((state) => {
      const session = sessionById(state, sessionId);
      const execution = session.execution;
      if (!execution || execution.status !== 'running') return null;
      if (execution.currentOperationId && session.pendingOperations?.[execution.currentOperationId]) return null;
      if (execution.roundIndex >= execution.targetRounds) {
        session.execution = undefined;
        touch(session);
        return { completed: true } as const;
      }
      const provider = execution.providers[execution.providerIndex];
      if (!provider) {
        session.execution = undefined;
        touch(session);
        return { completed: true } as const;
      }
      const basePrompt = buildSequentialPrompt(session, provider);
      const text = withExpertPreset(session, provider, basePrompt);
      const seen = execution.seenCurrentUserProviders.includes(provider);
      const payload: ComposerPayload = {
        text,
        attachments: seen ? [] : execution.payload.attachments
      };
      return { completed: false, provider, payload } as const;
    });

    if (!next) return;
    if (next.completed) {
      notifyStateChanged(sessionId);
      return;
    }
    await dispatchOperation(sessionId, next.provider, next.payload);
  }

  async function dispatchNextSequential(sessionId: string): Promise<void> {
    const existing = dispatches.get(sessionId);
    // Completion can arrive while the previous send is still acknowledging a
    // navigation. Queue the next check after that dispatch releases its lock.
    if (existing) return existing.then(() => dispatchNextSequential(sessionId));
    const task = dispatchNextSequentialTurn(sessionId);
    dispatches.set(sessionId, task);
    try { await task; } finally { dispatches.delete(sessionId); }
  }

  async function startQa(request: StartQaRequest): Promise<void> {
    await Promise.all(request.providers.map((provider) => dispatchOperation(request.sessionId, provider, request.payload)));
  }

  async function startSequential(request: StartSequentialRequest): Promise<void> {
    await mutatePersistedState((state) => {
      const session = sessionById(state, request.sessionId);
      if (session.mode === 'qa') throw new Error('AI 对话不能启动循环');
      if (session.execution?.status === 'running') throw new Error('当前循环仍在运行');
      const execution: SequentialExecutionState = {
        status: 'running',
        providers: request.providers,
        targetRounds: Math.max(1, Math.min(99, Math.trunc(request.targetRounds) || 1)),
        roundIndex: 0,
        providerIndex: 0,
        payload: request.payload,
        seenCurrentUserProviders: []
      };
      session.execution = execution;
      touch(session);
    });
    notifyStateChanged(request.sessionId);
    await dispatchNextSequential(request.sessionId);
  }

  async function resumeSequential(sessionId: string, supplementalPayload?: ComposerPayload): Promise<void> {
    await mutatePersistedState((state) => {
      const session = sessionById(state, sessionId);
      if (!session.execution) throw new Error('没有可继续的循环');
      const hasSupplement = Boolean(supplementalPayload && (supplementalPayload.text.trim() || supplementalPayload.attachments.length));
      if (hasSupplement && supplementalPayload) {
        session.messages.push({
          id: id('msg'),
          role: 'user',
          text: supplementalPayload.text,
          attachments: supplementalPayload.attachments.map(({ id, name, type, size, kind }) => ({ id, name, type, size, kind })),
          createdAt: Date.now(),
          status: 'completed'
        });
        session.execution.payload = supplementalPayload;
        session.execution.seenCurrentUserProviders = [];
      }
      session.execution.status = 'running';
      touch(session);
    });
    notifyStateChanged(sessionId);
    await dispatchNextSequential(sessionId);
  }

  async function interruptSequential(sessionId: string): Promise<void> {
    const target = await mutatePersistedState((state) => {
      const session = sessionById(state, sessionId);
      const execution = session.execution;
      if (!execution) return null;
      execution.status = 'paused';
      const operationId = execution.currentOperationId;
      const operation = operationId ? session.pendingOperations?.[operationId] : undefined;
      if (operation) {
        const message = session.messages.find((item) => item.id === operation.messageId);
        if (message && (message.status === 'pending' || message.status === 'streaming')) message.status = 'interrupted';
        delete session.pendingOperations?.[operation.operationId];
      }
      execution.currentOperationId = undefined;
      touch(session);
      const binding = operation ? session.bindings[operation.provider] : undefined;
      return operation ? { operation, tabId: binding?.tabId } : null;
    });
    notifyStateChanged(sessionId);
    if (target) await bridge.cancel(target.operation.provider, target.operation.operationId, target.tabId).catch(() => undefined);
  }

  async function handleProviderEvent(event: ProviderEvent): Promise<void> {
    if (!event.operationId) return;
    let advanceSessionId: string | undefined;
    await mutatePersistedState((state) => {
      const session = state.conversations.find((item) => Boolean(item.pendingOperations?.[event.operationId!]));
      if (!session) return;
      const operation = session.pendingOperations?.[event.operationId!];
      if (!operation) return;
      if (operation.provider !== event.provider) return;
      const boundTabId = session.bindings[event.provider]?.tabId;
      if (event.tabId && boundTabId && boundTabId !== event.tabId) return;
      if (event.tabId) {
        const oldBinding = session.bindings[event.provider];
        session.bindings[event.provider] = {
          provider: event.provider,
          tabId: event.tabId,
          conversationUrl: event.url || oldBinding?.conversationUrl
        };
      }
      const message = session.messages.find((item) => item.id === operation.messageId);
      if (event.type === 'PROVIDER_RESPONSE_STARTED' && message) message.status = 'streaming';
      if (event.type === 'PROVIDER_RESPONSE_DELTA' && message) {
        message.text = event.text ?? '';
        message.status = 'streaming';
      }
      if (event.type === 'PROVIDER_RESPONSE_COMPLETED') {
        if (message) {
          message.text = event.text ?? '';
          message.status = 'completed';
          message.error = undefined;
        }
        delete session.pendingOperations?.[operation.operationId];
        const execution = session.execution;
        if (execution?.currentOperationId === operation.operationId) {
          execution.currentOperationId = undefined;
          if (!execution.seenCurrentUserProviders.includes(operation.provider)) execution.seenCurrentUserProviders.push(operation.provider);
          if (session.mode === 'expert' && !(session.expertInitializedProviders?.includes(operation.provider))) {
            session.expertInitializedProviders = [...(session.expertInitializedProviders ?? []), operation.provider];
          }
          execution.providerIndex += 1;
          if (execution.providerIndex >= execution.providers.length) {
            execution.providerIndex = 0;
            execution.roundIndex += 1;
          }
          if (execution.status === 'running' && execution.roundIndex < execution.targetRounds) advanceSessionId = session.id;
          else if (execution.status === 'running' && execution.roundIndex >= execution.targetRounds) session.execution = undefined;
        }
      }
      if (event.type === 'PROVIDER_ERROR') {
        if (message) {
          message.status = 'error';
          message.error = event.error || `${modeLabelProvider(operation.provider)} 执行失败`;
        }
        delete session.pendingOperations?.[operation.operationId];
        if (session.execution?.currentOperationId === operation.operationId) {
          session.execution.currentOperationId = undefined;
          session.execution.status = 'paused';
        }
      }
      touch(session);
    });
    notifyStateChanged(advanceSessionId);
    // Acknowledge the persisted terminal event without waiting for the next
    // website to initialise or submit. Recovery can also resume this cursor.
    if (advanceSessionId) void dispatchNextSequential(advanceSessionId).catch(console.error);
  }

  async function recover(): Promise<void> {
    const staleBefore = Date.now() - 30 * 60 * 1000;
    const { resumable, changed } = await mutatePersistedState((state) => {
      let changed = false;
      for (const session of state.conversations) {
        for (const [operationId, operation] of Object.entries(session.pendingOperations ?? {})) {
          const preparationExpired = operation.phase === 'preparing' && Date.now() - operation.startedAt > 90000;
          if (!preparationExpired && operation.startedAt >= staleBefore) continue;
          const message = session.messages.find((item) => item.id === operation.messageId);
          if (message && (message.status === 'pending' || message.status === 'streaming')) {
            message.status = 'error';
            message.error = preparationExpired ? 'AI 页面准备超时，请重新开始本轮' : '等待回复超时，未确认生成结束';
          }
          delete session.pendingOperations?.[operationId];
          if (session.execution?.currentOperationId === operationId) {
            session.execution.currentOperationId = undefined;
            session.execution.status = 'paused';
          }
          touch(session);
          changed = true;
        }
      }
      return {
        changed,
        resumable: state.conversations
          .filter((session) => session.execution?.status === 'running' && !session.execution.currentOperationId)
          .map((session) => session.id)
      };
    });
    if (changed) notifyStateChanged();
    for (const sessionId of resumable) await dispatchNextSequential(sessionId).catch(() => undefined);
  }

  async function applyUiPatch(patch: {
    activeMode?: PersistedState['activeMode'];
    activeConversationIds?: PersistedState['activeConversationIds'];
    settings?: Partial<PersistedState['settings']>;
    expertPresets?: PersistedState['expertPresets'];
    sessions?: { id: string; created?: ConversationSession; addedMessages?: ChatMessage[]; rounds?: number; expertAssignments?: ConversationSession['expertAssignments']; title?: string }[];
    deletedSessionIds?: string[];
  }): Promise<void> {
    await mutatePersistedState((state) => {
      if (patch.activeMode) state.activeMode = patch.activeMode;
      if (patch.activeConversationIds) Object.assign(state.activeConversationIds, patch.activeConversationIds);
      if (patch.settings) Object.assign(state.settings, patch.settings);
      if (patch.expertPresets) state.expertPresets = patch.expertPresets;
      for (const update of patch.sessions ?? []) {
        let session = state.conversations.find((item) => item.id === update.id);
        if (!session && update.created) {
          session = structuredClone(update.created);
          session.execution = undefined;
          session.pendingOperations = {};
          state.conversations.push(session);
        }
        if (!session) continue;
        for (const message of update.addedMessages ?? []) {
          if (message.role === 'user' && !session.messages.some((item) => item.id === message.id)) session.messages.push(message);
        }
        if (update.rounds !== undefined) {
          session.rounds = update.rounds;
          if (session.execution) session.execution.targetRounds = update.rounds;
        }
        if (update.title !== undefined) session.title = update.title;
        if (update.expertAssignments && !session.messages.some((message) => message.role === 'assistant')) session.expertAssignments = update.expertAssignments;
        touch(session);
      }
      for (const sessionId of patch.deletedSessionIds ?? []) {
        const session = state.conversations.find((item) => item.id === sessionId);
        if (session?.execution?.status === 'running' || Object.keys(session?.pendingOperations ?? {}).length) throw new Error('请先中断正在运行的会话');
        state.conversations = state.conversations.filter((item) => item.id !== sessionId);
      }
    });
    notifyStateChanged();
  }

  async function attachBinding(operationId: string, provider: ProviderId, tabId: number, conversationUrl?: string): Promise<void> {
    await mutatePersistedState((state) => {
      const session = state.conversations.find((item) => item.pendingOperations?.[operationId]?.provider === provider);
      if (!session) throw new Error('本次 AI 操作已中断');
      session.bindings[provider] = { provider, tabId, conversationUrl };
      session.pendingOperations![operationId].phase = 'active';
      touch(session);
    });
  }

  return {
    startQa,
    startSequential,
    resumeSequential,
    interruptSequential,
    handleProviderEvent,
    recover,
    applyUiPatch,
    attachBinding
  };
}
