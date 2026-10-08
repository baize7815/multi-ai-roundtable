import { providerById } from './shared/providers';
import { loadState, STORAGE_KEY } from './shared/storage';
import type { ComposerPayload, PersistedState, ProviderEvent, ProviderId } from './shared/types';
import { createBackgroundOrchestrator } from './background/orchestrator';
import { updatePageFramePump } from './background/page-liveness';
import { createReplyForeground } from './background/reply-foreground';
import { createPrivateGameTab, forgetPrivateGameTab, isPrivateGameTab, preparePrivateGamePage, releaseInactivePrivateGamePages } from './background/private-game-pages';
import { createWerewolfEngine } from './background/werewolf-engine';
import type { WerewolfGameSession, WerewolfPendingTurn } from './game/werewolf/types';
import { createFogCouncilEngine } from './background/fog-council-engine';
import type { FogCouncilGameSession, FogCouncilPendingTurn } from './game/fog-council/session';

chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(console.error);

const providerContentScripts: Partial<Record<ProviderId, string>> = {
  doubao: 'content/doubao.js',
  deepseek: 'content/deepseek.js',
  kimi: 'content/kimi.js',
  qwen: 'content/qwen.js',
  zhipu: 'content/zhipu.js',
  gpt: 'content/gpt.js',
  gemini: 'content/gemini.js',
  grok: 'content/grok.js',
  wenxin: 'content/wenxin.js',
  minimax: 'content/minimax.js'
};

const COMMAND_QUEUE_KEY = 'multiAiRoundtableCommandQueueV1';
const COMMAND_ALARM_PREFIX = 'multi-ai-command:';
const MANAGED_TABS_KEY = 'multiAiRoundtableManagedTabsV1';
const MANAGED_GROUPS_KEY = 'multiAiRoundtableManagedGroupsV1';
const ISOLATION_MIGRATION_KEY = 'multiAiRoundtableIsolationMigrationV1';
const PROVIDER_WATCHDOG_ALARM = 'multi-ai-provider-watchdog';
const lastProviderActivity = new Map<string, number>();
const sendingOperations = new Set<string>();
let wakeQueue: Promise<unknown> = Promise.resolve();
let watchdogRunning = false;
const commandInFlight = new Set<string>();
const wakeReleases = new Map<string, () => void>();
const framePumpTabs = new Map<number, ProviderId>();
const framePumpQueues = new Map<number, Promise<void>>();
const foregroundReplies = createReplyForeground(isManagedTab);
let replyAccelerationEnabled = true;
let replyAccelerationTimer: number | undefined;
let accelerationRunning = false;
let watchdogSyncRunning = false;
let watchdogSyncAgain = false;
let watchdogSyncTail: Promise<void> = Promise.resolve();

function gamePendingTurns(game: WerewolfGameSession): WerewolfPendingTurn[] {
  return [game.pendingTurn, ...(game.pendingParallelTurns ?? [])].filter((item): item is WerewolfPendingTurn => Boolean(item));
}

function gamePendingByOperation(game: WerewolfGameSession, operationId: string): WerewolfPendingTurn | undefined {
  return gamePendingTurns(game).find((item) => item.operationId === operationId);
}

function fogCouncilPendingTurns(game: FogCouncilGameSession): FogCouncilPendingTurn[] {
  return game.pendingTurn ? [game.pendingTurn] : [];
}

function fogCouncilPendingByOperation(game: FogCouncilGameSession, operationId: string): FogCouncilPendingTurn | undefined {
  return game.pendingTurn?.operationId === operationId ? game.pendingTurn : undefined;
}

function queuePageFramePump(tabId: number, action: 'start' | 'stop'): Promise<void> {
  const task = (framePumpQueues.get(tabId) ?? Promise.resolve()).catch(() => undefined).then(async () => {
    if (action === 'stop') {
      // A new turn may have started after the watchdog took its snapshot.
      const state = await loadState();
      const provider = framePumpTabs.get(tabId);
      const enabled = state.settings.replyAcceleration !== false || provider === 'doubao' || provider === 'minimax' || await isGameBoundTab(tabId);
      const conversationNeeds = enabled && state.conversations.some((session) => Object.values(session.pendingOperations ?? {}).some((operation) => (operation.provider === provider && operation.phase === 'preparing') || session.bindings[operation.provider]?.tabId === tabId));
      const gameNeeds = enabled && state.werewolfGames.some((game) => gamePendingTurns(game).some((operation) => (operation.provider === provider && operation.phase === 'preparing') || game.bindings[operation.playerId]?.tabId === tabId));
      const fogCouncilNeeds = enabled && state.fogCouncilGames.some((game) => fogCouncilPendingTurns(game).some((operation) => (operation.provider === provider && operation.phase === 'preparing') || game.bindings[operation.playerId]?.tabId === tabId));
      if (conversationNeeds || gameNeeds || fogCouncilNeeds) return;
      framePumpTabs.delete(tabId);
    }
    await updatePageFramePump(tabId, action);
  });
  framePumpQueues.set(tabId, task);
  void task.finally(() => { if (framePumpQueues.get(tabId) === task) framePumpQueues.delete(tabId); }).catch(() => undefined);
  return task;
}

async function startPageFramePump(tabId: number, provider: ProviderId): Promise<void> {
  if (!replyAccelerationEnabled && provider !== 'doubao' && provider !== 'minimax' && !await isGameBoundTab(tabId)) return;
  framePumpTabs.set(tabId, provider);
  // Acceleration is optional. Injection failure must not stop the original
  // readiness check or the content script's native response monitor.
  await queuePageFramePump(tabId, 'start').catch(() => undefined);
}

type BackgroundCommand =
  | { id: string; type: 'qa'; sessionId: string; providers: ProviderId[]; payload: ComposerPayload; createdAt: number }
  | { id: string; type: 'sequential'; sessionId: string; providers: ProviderId[]; payload: ComposerPayload; targetRounds: number; createdAt: number };

type BackgroundCommandInput =
  | { type: 'qa'; sessionId: string; providers: ProviderId[]; payload: ComposerPayload }
  | { type: 'sequential'; sessionId: string; providers: ProviderId[]; payload: ComposerPayload; targetRounds: number };

let commandQueueTail: Promise<unknown> = Promise.resolve();
let workerKeepAliveCount = 0;
let workerKeepAliveTimer: number | undefined;

function retainWorker(): void {
  workerKeepAliveCount += 1;
  if (workerKeepAliveTimer !== undefined) return;
  const ping = () => { chrome.runtime.getPlatformInfo().catch(() => undefined); };
  ping();
  workerKeepAliveTimer = self.setInterval(ping, 15000) as unknown as number;
}

function releaseWorker(): void {
  workerKeepAliveCount = Math.max(0, workerKeepAliveCount - 1);
  if (workerKeepAliveCount || workerKeepAliveTimer === undefined) return;
  self.clearInterval(workerKeepAliveTimer);
  workerKeepAliveTimer = undefined;
}

async function mutateCommandQueue<T>(mutator: (queue: BackgroundCommand[]) => T | Promise<T>): Promise<T> {
  const task = commandQueueTail.then(async () => {
    const result = await chrome.storage.local.get(COMMAND_QUEUE_KEY);
    const queue = (result[COMMAND_QUEUE_KEY] as BackgroundCommand[] | undefined) ?? [];
    const value = await mutator(queue);
    await chrome.storage.local.set({ [COMMAND_QUEUE_KEY]: queue });
    return value;
  });
  commandQueueTail = task.then(() => undefined, () => undefined);
  return task;
}

async function enqueueCommand(command: BackgroundCommandInput): Promise<string> {
  const id = `command-${crypto.randomUUID()}`;
  const record = { ...command, id, createdAt: Date.now() } as BackgroundCommand;
  await mutateCommandQueue((queue) => { queue.push(record); });
  await chrome.alarms.create(`${COMMAND_ALARM_PREFIX}${id}`, { when: Date.now() + 100 });
  return id;
}

async function processQueuedCommand(commandId: string): Promise<void> {
  if (commandInFlight.has(commandId)) return;
  commandInFlight.add(commandId);
  const command = await mutateCommandQueue((queue) => queue.find((item) => item.id === commandId));
  if (!command) { commandInFlight.delete(commandId); return; }
  retainWorker();
  try {
    if (command.type === 'qa') {
      await orchestrator.startQa({
        sessionId: command.sessionId,
        providers: command.providers,
        payload: command.payload
      });
    } else {
      await orchestrator.startSequential({
        sessionId: command.sessionId,
        providers: command.providers,
        payload: command.payload,
        targetRounds: command.targetRounds
      });
    }
  } catch (error) {
    console.error(`Background command ${commandId} failed`, error);
  } finally {
    await mutateCommandQueue((queue) => {
      const index = queue.findIndex((item) => item.id === commandId);
      if (index >= 0) queue.splice(index, 1);
    });
    releaseWorker();
    commandInFlight.delete(commandId);
  }
}

async function recoverQueuedCommands(): Promise<void> {
  const result = await chrome.storage.local.get(COMMAND_QUEUE_KEY);
  const queue = (result[COMMAND_QUEUE_KEY] as BackgroundCommand[] | undefined) ?? [];
  for (const command of queue) {
    await chrome.alarms.create(`${COMMAND_ALARM_PREFIX}${command.id}`, { when: Date.now() + 100 });
  }
}

async function findProviderTab(provider: ProviderId, preferredTabId?: number): Promise<chrome.tabs.Tab | null> {
  if (preferredTabId) {
    try {
      const tab = await chrome.tabs.get(preferredTabId);
      if (tab.id && tab.url && providerById[provider].urlPatterns?.some((pattern) => matchPattern(tab.url!, pattern))) return tab;
    } catch {
      // Fall through to discovery.
    }
  }

  const patterns = providerById[provider].urlPatterns ?? [];
  const tabs = await chrome.tabs.query({ url: patterns });
  return tabs.find((tab) => tab.id) ?? null;
}

type ManagedTabs = Record<string, ProviderId>;
type ManagedGroups = Record<string, number>;

let managedTabsTail: Promise<unknown> = Promise.resolve();

async function managedTabs(): Promise<ManagedTabs> {
  const result = await chrome.storage.session.get(MANAGED_TABS_KEY);
  return (result[MANAGED_TABS_KEY] as ManagedTabs | undefined) ?? {};
}

async function mutateManagedTabs<T>(mutator: (tabs: ManagedTabs) => T | Promise<T>): Promise<T> {
  const task = managedTabsTail.then(async () => {
    const tabs = await managedTabs();
    const result = await mutator(tabs);
    await chrome.storage.session.set({ [MANAGED_TABS_KEY]: tabs });
    return result;
  });
  managedTabsTail = task.then(() => undefined, () => undefined);
  return task;
}

async function markManagedTab(tabId: number, provider: ProviderId): Promise<void> {
  await mutateManagedTabs((tabs) => {
    tabs[String(tabId)] = provider;
  });
}

async function unmarkManagedTab(tabId: number): Promise<void> {
  await mutateManagedTabs((tabs) => {
    delete tabs[String(tabId)];
  });
  await forgetPrivateGameTab(tabId);
}

async function isManagedTab(tabId: number, provider?: ProviderId): Promise<boolean> {
  const tabs = await managedTabs();
  const owner = tabs[String(tabId)];
  if (owner) return !provider || owner === provider;
  if (await isPrivateGameTab(tabId, provider)) return true;
  // Upgrade game bindings from the old session-only registry without opening
  // a duplicate conversation. Require the persisted URL and old placement.
  const state = await loadState();
  const binding = [...state.werewolfGames, ...state.fogCouncilGames]
    .flatMap((game) => Object.values(game.bindings))
    .find((item) => item.tabId === tabId && (!provider || item.provider === provider));
  if (!binding?.conversationUrl) return false;
  const tab = await chrome.tabs.get(tabId).catch(() => undefined);
  if (!tab || tab.url !== binding.conversationUrl || !providerById[binding.provider]?.urlPatterns?.some((pattern) => matchPattern(tab.url!, pattern))) return false;
  const window = await chrome.windows.get(tab.windowId);
  const group = tab.groupId !== chrome.tabGroups.TAB_GROUP_ID_NONE ? await chrome.tabGroups.get(tab.groupId).catch(() => undefined) : undefined;
  if (window.state !== 'minimized' && group?.title !== 'AI Dialogue') return false;
  await markManagedTab(tabId, binding.provider);
  return true;
}

async function isGameBoundTab(tabId: number): Promise<boolean> {
  if (await isPrivateGameTab(tabId)) return true;
  const state = await loadState();
  return [...state.werewolfGames, ...state.fogCouncilGames].some((game) => Object.values(game.bindings).some((binding) => binding.tabId === tabId));
}

async function managedGroups(): Promise<ManagedGroups> {
  const result = await chrome.storage.session.get(MANAGED_GROUPS_KEY);
  return (result[MANAGED_GROUPS_KEY] as ManagedGroups | undefined) ?? {};
}

async function rememberManagedGroup(windowId: number, groupId?: number): Promise<void> {
  const groups = await managedGroups();
  if (groupId === undefined) delete groups[String(windowId)];
  else groups[String(windowId)] = groupId;
  await chrome.storage.session.set({ [MANAGED_GROUPS_KEY]: groups });
}

function matchPattern(url: string, pattern: string): boolean {
  const prefix = pattern.replace('*', '');
  return url.startsWith(prefix);
}

let aiDialogueGroupTail: Promise<void> = Promise.resolve();

async function addToAiDialogueGroup(tabId: number): Promise<void> {
  const task = aiDialogueGroupTail.then(async () => {
    try {
      if (!(await isManagedTab(tabId))) return;
      if (await isGameBoundTab(tabId)) return;
      const tab = await chrome.tabs.update(tabId, { autoDiscardable: false });
      if (tab.windowId === undefined) return;
      const groups = await managedGroups();
      let groupId: number | undefined = groups[String(tab.windowId)];
      let preserveCollapsed = false;

      if (groupId !== undefined) {
        try {
          const group = await chrome.tabGroups.get(groupId);
          if (group.windowId !== tab.windowId) throw new Error('managed group belongs to another window');
          preserveCollapsed = group.collapsed;
        } catch {
          groupId = undefined;
          await rememberManagedGroup(tab.windowId);
        }
      }

      if (groupId === undefined) {
        groupId = await chrome.tabs.group({ tabIds: [tabId] });
        await rememberManagedGroup(tab.windowId, groupId);
      } else {
        await chrome.tabs.group({ groupId, tabIds: [tabId] });
      }
      await chrome.tabGroups.update(groupId, preserveCollapsed
        ? { title: 'AI Dialogue', collapsed: true }
        : { title: 'AI Dialogue' });
    } catch {
      // Grouping is a convenience feature and must never block provider execution.
    }
  });
  aiDialogueGroupTail = task.catch(() => undefined);
  return task;
}

async function migrateLegacyGrouping(): Promise<void> {
  const migration = await chrome.storage.local.get(ISOLATION_MIGRATION_KEY);
  if (migration[ISOLATION_MIGRATION_KEY]) return;
  const groups = (await chrome.tabGroups.query({})).filter((group) => group.title === 'AI Dialogue');
  for (const group of groups) {
    const tabs = await chrome.tabs.query({ groupId: group.id });
    const tabIds = tabs.map((tab) => tab.id).filter((tabId): tabId is number => typeof tabId === 'number');
    if (tabIds.length) await chrome.tabs.ungroup(tabIds).catch(() => undefined);
  }
  await chrome.storage.session.remove([MANAGED_TABS_KEY, MANAGED_GROUPS_KEY]);
  await chrome.storage.local.set({ [ISOLATION_MIGRATION_KEY]: true });
}

async function createManagedProviderTab(provider: ProviderId, url: string, allowForegroundWake = true): Promise<chrome.tabs.Tab> {
  if (!allowForegroundWake) {
    const created = await createPrivateGameTab(provider, url);
    if (created.id === undefined) throw new Error('游戏标签页无效');
    await markManagedTab(created.id, provider);
    return created;
  }
  // Chrome cannot create a tab directly inside a group. Claim and group an inert tab first,
  // then navigate it so Provider pages never briefly appear as ungrouped user tabs.
  const created = await chrome.tabs.create({ url: 'about:blank', active: false });
  if (!created.id) throw new Error('Provider 标签页无效');
  await markManagedTab(created.id, provider);
  await addToAiDialogueGroup(created.id);
  return chrome.tabs.update(created.id, { url, active: false });
}

async function ensureProviderTab(provider: ProviderId, allowForegroundWake = true): Promise<chrome.tabs.Tab> {
  const homeUrl = providerById[provider].homeUrl;
  if (!homeUrl) throw new Error(`${provider} 尚未接入`);
  return createManagedProviderTab(provider, homeUrl, allowForegroundWake);
}

async function resolveProviderTab(provider: ProviderId, preferredTabId?: number, preferredUrl?: string, allowForegroundWake = true): Promise<chrome.tabs.Tab> {
  if (preferredTabId && await isManagedTab(preferredTabId, provider)) {
    let tab: chrome.tabs.Tab | undefined;
    try {
      tab = await chrome.tabs.get(preferredTabId);
    } catch {
      // The bound tab was closed; try reopening the bound conversation URL below.
    }
    if (tab?.id && tab.url && providerById[provider].urlPatterns?.some((pattern) => matchPattern(tab.url!, pattern))) {
      if (allowForegroundWake) await addToAiDialogueGroup(tab.id);
      else await preparePrivateGamePage(tab.id, provider);
      return tab;
    }
  }
  if (preferredUrl && providerById[provider].urlPatterns?.some((pattern) => matchPattern(preferredUrl, pattern))) {
    const reopened = await createManagedProviderTab(provider, preferredUrl, allowForegroundWake);
    if (reopened.id) {
      await waitForProviderReady(reopened.id, provider, 30000, true, allowForegroundWake);
    }
    return reopened;
  }
  return ensureProviderTab(provider, allowForegroundWake);
}

async function createFreshConversation(provider: ProviderId, preferredTabId?: number, allowForegroundWake = true) {
  let tab: chrome.tabs.Tab | null = null;
  let alreadyNavigated = false;
  const url = providerById[provider].homeUrl;
  if (!url) throw new Error(`${provider} 尚未接入`);
  if (preferredTabId && await isManagedTab(preferredTabId, provider)) {
    try {
      const existing = await chrome.tabs.get(preferredTabId);
      if (existing.id && existing.url && providerById[provider].urlPatterns?.some((pattern) => matchPattern(existing.url!, pattern))) tab = existing;
    } catch {
      tab = null;
    }
  }
  if (!tab) {
    tab = await createManagedProviderTab(provider, url, allowForegroundWake);
    alreadyNavigated = true;
  }
  if (!tab.id) throw new Error('Provider 标签页无效');
  try {
    if (!alreadyNavigated) {
      if (!allowForegroundWake) await preparePrivateGamePage(tab.id, provider);
      await chrome.tabs.update(tab.id, { url, active: false });
    }
    if (allowForegroundWake) await addToAiDialogueGroup(tab.id);
    await waitForProviderReady(tab.id, provider, 30000, true, allowForegroundWake);
    const refreshed = await chrome.tabs.get(tab.id);
    return { tabId: tab.id, conversationUrl: refreshed.url };
  } catch (error) {
    if (alreadyNavigated && tab.id) await chrome.tabs.remove(tab.id).catch(() => undefined);
    throw error;
  }
}

function isMissingReceiver(error: unknown): boolean {
  return /Receiving end does not exist|Could not establish connection/i.test(error instanceof Error ? error.message : String(error));
}

function isNavigationChannelClosed(error: unknown): boolean {
  return /message channel closed|channel closed before a response was received/i.test(error instanceof Error ? error.message : String(error));
}

async function sendProviderMessage(tabId: number, provider: ProviderId, message: unknown, timeoutMs?: number): Promise<unknown> {
  const deliver = async () => {
    if (message && typeof message === 'object') message = {
      ...message, replyAcceleration: replyAccelerationEnabled,
      pageFramePump: replyAccelerationEnabled || provider === 'doubao' || provider === 'minimax' || await isGameBoundTab(tabId)
    };
    try {
      return await chrome.tabs.sendMessage(tabId, message);
    } catch (error) {
      if (!isMissingReceiver(error)) throw error;
      const script = providerContentScripts[provider];
      if (!script) throw error;
      await chrome.scripting.executeScript({ target: { tabId }, files: [script] });
      await new Promise((resolve) => setTimeout(resolve, 100));
      return chrome.tabs.sendMessage(tabId, message);
    }
  };
  if (timeoutMs === undefined) return deliver();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      deliver(),
      new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('AI 网页消息通道超时；已停止等待，不会自动重发问题')), timeoutMs); })
    ]);
  } finally { if (timer !== undefined) clearTimeout(timer); }
}

async function temporarilyWakeProviderTab(tabId: number): Promise<() => Promise<void>> {
  const target = await chrome.tabs.get(tabId);
  const originalActive = target.windowId === undefined
    ? undefined
    : (await chrome.tabs.query({ active: true, windowId: target.windowId }))[0];
  const focusedWindow = (await chrome.windows.getAll({ windowTypes: ['normal'] })).find((window) => window.focused);
  let restoreCollapsed = false;
  if (target.groupId !== chrome.tabGroups.TAB_GROUP_ID_NONE) {
    try {
      restoreCollapsed = (await chrome.tabGroups.get(target.groupId)).collapsed;
    } catch {
      restoreCollapsed = false;
    }
  }
  await chrome.tabs.update(tabId, { active: true, autoDiscardable: false });
  // Some webpage submitters wait for actual window focus, even when their tab
  // is selected. Selecting the tab alone leaves them stuck in "Submitting".
  if (target.windowId !== undefined && focusedWindow?.id !== target.windowId) {
    await chrome.windows.update(target.windowId, { focused: true });
  }
  return async () => {
    const currentActive = (await chrome.tabs.query({ active: true, windowId: target.windowId }))[0];
    // Do not undo a tab switch made by the user while the provider was waking.
    if (currentActive?.id === tabId && originalActive?.id && originalActive.id !== tabId) {
      await chrome.tabs.update(originalActive.id, { active: true }).catch(() => undefined);
    }
    if (currentActive?.id === tabId && restoreCollapsed && target.groupId !== chrome.tabGroups.TAB_GROUP_ID_NONE) {
      await chrome.tabGroups.update(target.groupId, { collapsed: true }).catch(() => undefined);
    }
    if (currentActive?.id === tabId && focusedWindow?.id !== undefined && focusedWindow.id !== target.windowId) {
      await chrome.windows.update(focusedWindow.id, { focused: true }).catch(() => undefined);
    }
  };
}

async function wakeOperation(operationId: string, requestedTabId?: number, onReady?: () => void): Promise<void> {
  const task = wakeQueue.then(async () => {
    const state = await loadState();
    const session = state.conversations.find((item) => item.pendingOperations?.[operationId]);
    const operation = session?.pendingOperations?.[operationId];
    const game = state.werewolfGames.find((item) => Boolean(gamePendingByOperation(item, operationId)));
    const gameOperation = game ? gamePendingByOperation(game, operationId) : undefined;
    const clockGame = state.fogCouncilGames.find((item) => Boolean(fogCouncilPendingByOperation(item, operationId)));
    const clockOperation = clockGame ? fogCouncilPendingByOperation(clockGame, operationId) : undefined;
    const provider = operation?.provider ?? gameOperation?.provider ?? clockOperation?.provider;
    const tabId = operation
      ? session?.bindings[operation.provider]?.tabId
      : gameOperation ? game?.bindings[gameOperation.playerId]?.tabId
        : clockOperation ? clockGame?.bindings[clockOperation.playerId]?.tabId : undefined;
    if (!provider || !tabId || (requestedTabId !== undefined && requestedTabId !== tabId) || !(await isManagedTab(tabId, provider))) throw new Error('本次 AI 操作已结束或标签绑定失效');
    if (gameOperation || clockOperation) {
      // Hidden-game operations must never reveal their provider tab
      // by forcing it to the foreground. A wake request is acknowledged as a
      // no-op; the watchdog will pause the game if background execution stalls.
      onReady?.();
      return;
    }
    if (replyAccelerationEnabled) {
      await foregroundReplies.sync(state, tabId).catch(() => undefined);
      await startPageFramePump(tabId, provider).catch(() => undefined);
      onReady?.();
      return;
    }
    const restore = await temporarilyWakeProviderTab(tabId);
    try {
      await new Promise((resolve) => setTimeout(resolve, 300));
      onReady?.();
      if (onReady) {
        await new Promise<void>((resolve) => {
          const timer = setTimeout(resolve, 8000);
          wakeReleases.set(operationId, () => { clearTimeout(timer); resolve(); });
        });
      } else await new Promise((resolve) => setTimeout(resolve, 2700));
      await sendProviderMessage(tabId, provider, { type: 'PROVIDER_CHECK', operationId }).catch(() => undefined);
    } finally { wakeReleases.delete(operationId); await restore(); }
  });
  wakeQueue = task.catch(() => undefined);
  await task;
}

function syncProviderWatchdog(): Promise<void> {
  watchdogSyncAgain = true;
  if (watchdogSyncRunning) return watchdogSyncTail;
  watchdogSyncRunning = true;
  watchdogSyncTail = (async () => {
    while (watchdogSyncAgain) {
      watchdogSyncAgain = false;
      await syncProviderWatchdogNow();
    }
  })().finally(() => { watchdogSyncRunning = false; });
  return watchdogSyncTail;
}

async function syncProviderWatchdogNow(): Promise<void> {
  const state = await loadState();
  const accelerationChanged = replyAccelerationEnabled !== (state.settings.replyAcceleration !== false);
  replyAccelerationEnabled = state.settings.replyAcceleration !== false;
  if (accelerationChanged) {
    const boundTabs = new Set([
      ...state.conversations.flatMap((session) => Object.values(session.pendingOperations ?? {}).map((operation) => session.bindings[operation.provider]?.tabId)),
      ...state.werewolfGames.flatMap((game) => gamePendingTurns(game).map((operation) => game.bindings[operation.playerId]?.tabId)),
      ...state.fogCouncilGames.flatMap((game) => fogCouncilPendingTurns(game).map((operation) => game.bindings[operation.playerId]?.tabId))
    ]);
    await Promise.allSettled([...boundTabs].filter((id): id is number => typeof id === 'number').map(async (tabId) =>
      chrome.tabs.sendMessage(tabId, { type: 'PROVIDER_CONFIG', replyAcceleration: replyAccelerationEnabled,
        pageFramePump: replyAccelerationEnabled || framePumpTabs.get(tabId) === 'doubao' || framePumpTabs.get(tabId) === 'minimax' || await isGameBoundTab(tabId) })
    ));
  }
  await foregroundReplies.sync(state).catch(() => undefined);
  const activeGameTabs = new Set([
    ...state.werewolfGames.flatMap((game) => gamePendingTurns(game)
      .map((operation) => game.bindings[operation.playerId]?.tabId)),
    ...state.fogCouncilGames.flatMap((game) => fogCouncilPendingTurns(game)
      .map((operation) => game.bindings[operation.playerId]?.tabId))
  ].filter((tabId): tabId is number => typeof tabId === 'number'));
  await releaseInactivePrivateGamePages(activeGameTabs);
  for (const [tabId, provider] of framePumpTabs) {
    const conversationNeeded = state.conversations.some((session) => Object.values(session.pendingOperations ?? {}).some((operation) => operation.provider === provider && (operation.phase === 'preparing' || session.bindings[provider]?.tabId === tabId)));
    const gameNeeded = state.werewolfGames.some((game) => gamePendingTurns(game).some((operation) => operation.provider === provider && (operation.phase === 'preparing' || game.bindings[operation.playerId]?.tabId === tabId)));
    const fogCouncilNeeded = state.fogCouncilGames.some((game) => fogCouncilPendingTurns(game).some((operation) => operation.provider === provider && (operation.phase === 'preparing' || game.bindings[operation.playerId]?.tabId === tabId)));
    const needed = (replyAccelerationEnabled || provider === 'doubao' || provider === 'minimax' || await isGameBoundTab(tabId)) && (conversationNeeded || gameNeeded || fogCouncilNeeded);
    if (!needed) {
      await queuePageFramePump(tabId, 'stop').catch(() => undefined);
    }
  }
  const hasConversationWork = state.conversations.some((session) => Object.keys(session.pendingOperations ?? {}).length || session.execution?.status === 'running');
  const hasGameWork = state.werewolfGames.some((game) => gamePendingTurns(game).length > 0 || game.status === 'running')
    || state.fogCouncilGames.some((game) => fogCouncilPendingTurns(game).length > 0 || game.status === 'running');
  const hasWork = hasConversationWork || hasGameWork;
  const needsFrameTimer = (hasConversationWork && replyAccelerationEnabled) || hasGameWork;
  if (needsFrameTimer && replyAccelerationTimer === undefined) {
    retainWorker();
    replyAccelerationTimer = self.setInterval(() => { void acceleratePendingReplies().catch(console.error); }, 4000) as unknown as number;
    void acceleratePendingReplies().catch(console.error);
  } else if (!needsFrameTimer && replyAccelerationTimer !== undefined) {
    self.clearInterval(replyAccelerationTimer);
    replyAccelerationTimer = undefined;
    releaseWorker();
  }
  if (hasWork) {
    if (!(await chrome.alarms.get(PROVIDER_WATCHDOG_ALARM))) await chrome.alarms.create(PROVIDER_WATCHDOG_ALARM, { periodInMinutes: 0.5 });
  } else {
    await chrome.alarms.clear(PROVIDER_WATCHDOG_ALARM);
    lastProviderActivity.clear();
  }
}

async function checkPendingProviders(): Promise<void> {
  if (watchdogRunning) return;
  watchdogRunning = true;
  retainWorker();
  try {
    await replayPendingTerminalEvents();
    await orchestrator.recover();
    // Idle cursors can be resumed after a worker interruption; a live
    // preparing send is never redispatched by a periodic check.
    await werewolfEngine.recover(false);
    await fogCouncilEngine.recover(false);
    const state = await loadState();
    for (const session of state.conversations) {
      for (const operation of Object.values(session.pendingOperations ?? {})) {
        const tabId = session.bindings[operation.provider]?.tabId;
        if (!tabId || operation.phase === 'preparing') continue;
        try {
          await startPageFramePump(tabId, operation.provider);
          if (sendingOperations.has(operation.operationId)) continue;
          const response = await sendProviderMessage(tabId, operation.provider, { type: 'PROVIDER_CHECK', operationId: operation.operationId }, 5000) as { success?: boolean; phase?: string; resumed?: boolean } | undefined;
          if (response?.success !== true) throw new Error('监听未恢复');
          if (response.phase === 'terminal') continue;
          if (response.resumed) lastProviderActivity.set(operation.operationId, Date.now());
          const lastActivity = lastProviderActivity.get(operation.operationId) ?? operation.startedAt;
          if (Date.now() - lastActivity >= 25000) await wakeOperation(operation.operationId);
        } catch {
          // A missing/reloaded content script is recovered using its persisted
          // operation record, never by blindly submitting the prompt again.
          await resumePendingOperationsForTab(tabId).catch(() => undefined);
        }
      }
    }
    for (const game of state.werewolfGames) {
      for (const operation of gamePendingTurns(game)) {
        const tabId = game.bindings[operation.playerId]?.tabId;
        if (!tabId || operation.phase === 'preparing') continue;
        try {
          if (!await isManagedTab(tabId, operation.provider)) {
            await werewolfEngine.handleProviderEvent({ type: 'PROVIDER_ERROR', provider: operation.provider, operationId: operation.operationId, error: '游戏网页绑定失效，已暂停本局，避免操作无关网页或重复发送。' });
            continue;
          }
          await preparePrivateGamePage(tabId, operation.provider);
          await startPageFramePump(tabId, operation.provider);
          if (sendingOperations.has(operation.operationId)) continue;
          const response = await sendProviderMessage(tabId, operation.provider, { type: 'PROVIDER_CHECK', operationId: operation.operationId }, 5000) as { success?: boolean; phase?: string; resumed?: boolean } | undefined;
          if (response?.success !== true) throw new Error('监听未恢复');
          if (response.phase === 'terminal') continue;
          if (response.resumed) lastProviderActivity.set(operation.operationId, Date.now());
        } catch {
          await resumePendingOperationsForTab(tabId).catch(() => undefined);
        }
        const lastActivity = lastProviderActivity.get(operation.operationId) ?? operation.startedAt;
        if (Date.now() - lastActivity >= 3 * 60 * 1000) {
          await werewolfEngine.handleProviderEvent({
            type: 'PROVIDER_ERROR',
            provider: operation.provider,
            operationId: operation.operationId,
            error: '后台 AI 页面长时间无响应，已暂停本局。为避免泄露身份，狼人杀不会自动切换到对应网页。'
          });
        }
      }
    }
    for (const game of state.fogCouncilGames) {
      for (const operation of fogCouncilPendingTurns(game)) {
        const tabId = game.bindings[operation.playerId]?.tabId;
        if (!tabId) continue;
        try {
          if (!await isManagedTab(tabId, operation.provider)) {
            await fogCouncilEngine.handleProviderEvent({ type: 'PROVIDER_ERROR', provider: operation.provider, operationId: operation.operationId, error: '游戏网页绑定失效，已暂停本局，避免操作无关网页或重复发送。' });
            continue;
          }
          await preparePrivateGamePage(tabId, operation.provider);
          await startPageFramePump(tabId, operation.provider);
          if (sendingOperations.has(operation.operationId)) continue;
          const response = await sendProviderMessage(tabId, operation.provider, { type: 'PROVIDER_CHECK', operationId: operation.operationId }, 5000) as { success?: boolean; phase?: string; resumed?: boolean } | undefined;
          if (response?.success !== true) throw new Error('监听未恢复');
          if (response.phase === 'terminal') continue;
          if (response.resumed) lastProviderActivity.set(operation.operationId, Date.now());
        } catch {
          if (operation.phase === 'preparing') {
            await fogCouncilEngine.handleProviderEvent({
              type: 'PROVIDER_ERROR',
              provider: operation.provider,
              operationId: operation.operationId,
              error: '恢复时无法确认这次迷雾议会操作是否已经提交；为避免重复发送，已暂停本局。'
            });
            continue;
          }
          await resumePendingOperationsForTab(tabId).catch(() => undefined);
        }
        const lastActivity = lastProviderActivity.get(operation.operationId) ?? operation.startedAt;
        if (Date.now() - lastActivity >= 3 * 60 * 1000) {
          await fogCouncilEngine.handleProviderEvent({
            type: 'PROVIDER_ERROR',
            provider: operation.provider,
            operationId: operation.operationId,
            error: '后台 AI 页面长时间无响应，已暂停本局。为避免泄露私密信息，迷雾议会不会自动切换到对应网页。'
          });
        }
      }
    }
    await syncProviderWatchdog();
  } finally { watchdogRunning = false; releaseWorker(); }
}

async function waitForProviderReady(tabId: number, provider: ProviderId, timeoutMs = 30000, initialiseVisible = false, allowForegroundWake = true): Promise<void> {
  const privatePage = !allowForegroundWake;
  if (privatePage) await preparePrivateGamePage(tabId, provider, true);
  // The operation scheduler owns foreground selection when acceleration is on.
  // Temporary initialisation wakes must not race it or restore another tab.
  allowForegroundWake = allowForegroundWake && !replyAccelerationEnabled;
  await startPageFramePump(tabId, provider).catch(() => undefined);
  const deadline = Date.now() + timeoutMs;
  const wakeAt = Date.now() + Math.min(6000, Math.max(2000, Math.floor(timeoutMs / 3)));
  let lastError: unknown;
  let restoreWake: (() => Promise<void>) | undefined;
  try {
    if (initialiseVisible && allowForegroundWake) {
      restoreWake = await temporarilyWakeProviderTab(tabId);
      await startPageFramePump(tabId, provider).catch(() => undefined);
      // A usable input can precede account/session initialisation. Initialise
      // newly-created webpages before submitting, rather than waking only after
      // an early click has left their own submitter in a loading state.
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
    while (Date.now() < deadline) {
      try {
        const tab = await chrome.tabs.get(tabId);
        if (privatePage && (tab as chrome.tabs.Tab & { frozen?: boolean }).frozen) await preparePrivateGamePage(tabId, provider, true);
        if (!tab.url || !providerById[provider].urlPatterns?.some((pattern) => matchPattern(tab.url!, pattern))) {
          throw new Error('页面仍在跳转');
        }
        const response = await sendProviderMessage(tabId, provider, { type: 'PROVIDER_PING' }, 3000) as { success?: boolean; protocolVersion?: number } | undefined;
        if (response?.protocolVersion !== 2) {
          const script = providerContentScripts[provider];
          if (script) await chrome.scripting.executeScript({ target: { tabId }, files: [script] });
          throw new Error('正在更新 AI 网页控制脚本');
        }
        if (response?.success === true && tab.status === 'complete') {
          await startPageFramePump(tabId, provider).catch(() => undefined);
          return;
        }
      } catch (error) {
        lastError = error;
      }
      if (allowForegroundWake && !restoreWake && Date.now() >= wakeAt) {
        try {
          restoreWake = await temporarilyWakeProviderTab(tabId);
        } catch (error) {
          lastError = error;
        }
      }
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  } finally {
    if (restoreWake) await restoreWake();
  }
  const detail = lastError instanceof Error ? `：${lastError.message}` : '';
  throw new Error(`${provider} 页面初始化超时${detail}`);
}

async function sendProviderOperation(
  provider: ProviderId,
  operationId: string,
  payload: ComposerPayload,
  preferredTabId?: number,
  preferredUrl?: string,
  onBinding?: (tabId: number, conversationUrl?: string) => Promise<void>,
  allowForegroundWake = true
): Promise<{ tabId: number; conversationUrl?: string }> {
  sendingOperations.add(operationId);
  try {
    const tab = await resolveProviderTab(provider, preferredTabId, preferredUrl, allowForegroundWake);
    if (!tab.id) throw new Error('Provider 标签页无效');
    await onBinding?.(tab.id, tab.url);
    await waitForProviderReady(tab.id, provider, 30000, false, allowForegroundWake);
    let response: any;
    lastProviderActivity.set(operationId, Date.now());
    try {
      response = await sendProviderMessage(tab.id, provider, {
        type: 'PROVIDER_SEND',
        operationId,
        payload
      }, allowForegroundWake ? undefined : 90000);
    } catch (error) {
      if (!isNavigationChannelClosed(error)) throw error;
      await waitForProviderReady(tab.id, provider, 45000, false, allowForegroundWake);
      response = await sendProviderMessage(tab.id, provider, {
        type: 'PROVIDER_RESUME_MONITOR',
        operationId
      }, 15000);
    }
    if (response?.success !== true) throw new Error(response?.error || `${provider} 页面未确认发送`);
    const refreshed = await chrome.tabs.get(tab.id).catch(() => tab);
    return { tabId: tab.id, conversationUrl: refreshed.url ?? tab.url };
  } finally { sendingOperations.delete(operationId); }
}

async function sendToProvider(provider: ProviderId, operationId: string, payload: ComposerPayload, preferredTabId?: number, preferredUrl?: string): Promise<void> {
  await sendProviderOperation(provider, operationId, payload, preferredTabId, preferredUrl, async (tabId, conversationUrl) => {
    await orchestrator.attachBinding(operationId, provider, tabId, conversationUrl);
  });
}

async function cancelProvider(provider: ProviderId, operationId?: string, preferredTabId?: number): Promise<void> {
  if (!preferredTabId || !(await isManagedTab(preferredTabId, provider))) return;
  let tab: chrome.tabs.Tab | null = null;
  try { tab = await chrome.tabs.get(preferredTabId); } catch { tab = null; }
  if (!tab?.id) return;
  const response: any = await sendProviderMessage(tab.id, provider, { type: 'PROVIDER_CANCEL', operationId });
  if (response?.success === false) throw new Error(response.error || `${provider} 中断失败`);
}

const orchestrator = createBackgroundOrchestrator({
  createFreshConversation,
  send: sendToProvider,
  cancel: cancelProvider
});

const werewolfEngine = createWerewolfEngine({
  createFreshConversation: (provider, preferredTabId) => createFreshConversation(provider, preferredTabId, false),
  send: (provider, operationId, payload, tabId, conversationUrl) => sendProviderOperation(
    provider,
    operationId,
    payload,
    tabId,
    conversationUrl,
    async (actualTabId, actualUrl) => { await werewolfEngine.attachBinding(operationId, provider, actualTabId, actualUrl); },
    false
  ),
  cancel: cancelProvider
});

const fogCouncilEngine = createFogCouncilEngine({
  createFreshConversation: (provider, preferredTabId) => createFreshConversation(provider, preferredTabId, false),
  send: (provider, operationId, payload, tabId, conversationUrl) => sendProviderOperation(
    provider,
    operationId,
    payload,
    tabId,
    conversationUrl,
    async (actualTabId, actualUrl) => { await fogCouncilEngine.attachBinding(operationId, provider, actualTabId, actualUrl); },
    false
  ),
  cancel: cancelProvider,
  closeTab: async (tabId) => { await chrome.tabs.remove(tabId).catch(() => undefined); }
});

async function routeProviderEvent(event: ProviderEvent): Promise<void> {
  const handled = await werewolfEngine.handleProviderEvent(event) || await fogCouncilEngine.handleProviderEvent(event);
  if (!handled) await orchestrator.handleProviderEvent(event);
}

// Recover a final reply even if its content script's message channel closed or
// the tab disappeared. Only records matching a currently pending operation are
// consumed; no prompt is sent and no intermediate text is treated as final.
async function replayPendingTerminalEvents(state?: PersistedState): Promise<void> {
  state ??= await loadState();
  const owners = [
    ...state.conversations.flatMap((session) => Object.values(session.pendingOperations ?? {}).map((operation) => ({
      operationId: operation.operationId, provider: operation.provider, tabId: session.bindings[operation.provider]?.tabId
    }))),
    ...state.werewolfGames.flatMap((game) => gamePendingTurns(game).map((operation) => ({
      operationId: operation.operationId, provider: operation.provider, tabId: game.bindings[operation.playerId]?.tabId
    }))),
    ...state.fogCouncilGames.flatMap((game) => fogCouncilPendingTurns(game).map((operation) => ({
      operationId: operation.operationId, provider: operation.provider, tabId: game.bindings[operation.playerId]?.tabId
    })))
  ];
  if (!owners.length) return;
  const prefix = 'multiAiRoundtableTerminal:';
  const saved = await chrome.storage.local.get(owners.map((owner) => `${prefix}${owner.operationId}`));
  for (const owner of owners) {
    const key = `${prefix}${owner.operationId}`;
    const event = saved[key] as ProviderEvent | undefined;
    if (!event || event.operationId !== owner.operationId || event.provider !== owner.provider
      || (event.type !== 'PROVIDER_RESPONSE_COMPLETED' && event.type !== 'PROVIDER_ERROR')) continue;
    await routeProviderEvent({ ...event, tabId: owner.tabId });
    await chrome.storage.local.remove([key, `multiAiRoundtableResponseBaseline:${owner.operationId}`]);
  }
}

async function acceleratePendingReplies(): Promise<void> {
  if (accelerationRunning) return;
  accelerationRunning = true;
  try {
    const state = await loadState();
    await replayPendingTerminalEvents(state);
    await foregroundReplies.sync(await loadState()).catch(() => undefined);
    // Hidden pages can throttle their timers too. Pump game rendering from
    // the worker without checking, resuming or submitting an AI operation.
    const privateTargets = [
      ...state.werewolfGames.flatMap((game) => gamePendingTurns(game).map((operation) => ({ provider: operation.provider, tabId: game.bindings[operation.playerId]?.tabId }))),
      ...state.fogCouncilGames.flatMap((game) => fogCouncilPendingTurns(game).map((operation) => ({ provider: operation.provider, tabId: game.bindings[operation.playerId]?.tabId })))
    ];
    await Promise.allSettled(privateTargets.map(async ({ tabId, provider }) => {
      if (!tabId || !await isManagedTab(tabId, provider)) return;
      await preparePrivateGamePage(tabId, provider);
      await startPageFramePump(tabId, provider);
    }));
    if (state.settings.replyAcceleration === false) return;
    const targets = [
      ...state.conversations.flatMap((session) => Object.values(session.pendingOperations ?? {}).map((operation) => ({ operation, tabId: session.bindings[operation.provider]?.tabId })))
    ];
    await Promise.allSettled(targets.map(async ({ operation, tabId }) => {
      if (!tabId || operation.phase === 'preparing' || sendingOperations.has(operation.operationId) || !await isManagedTab(tabId, operation.provider)) return;
      await startPageFramePump(tabId, operation.provider).catch(() => undefined);
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        await Promise.race([
          sendProviderMessage(tabId, operation.provider, { type: 'PROVIDER_CHECK', operationId: operation.operationId }),
          new Promise<void>((resolve) => { timer = setTimeout(resolve, 2500); })
        ]);
      } finally { if (timer !== undefined) clearTimeout(timer); }
    }));
  } finally { accelerationRunning = false; }
}

chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== 'provider-operation') return;
  port.onMessage.addListener(() => undefined);
});

async function resumePendingOperationsForTab(tabId: number): Promise<void> {
  if (!(await isManagedTab(tabId))) return;
  const state = await loadState();
  const pending = state.conversations
    .flatMap((session) => Object.values(session.pendingOperations ?? {}).map((operation) => ({ session, operation })))
    .filter(({ session, operation }) => session.bindings[operation.provider]?.tabId === tabId)
    .sort((a, b) => b.operation.startedAt - a.operation.startedAt);
  const latestByProvider = new Map<ProviderId, (typeof pending)[number]>();
  for (const item of pending) {
    if (!latestByProvider.has(item.operation.provider)) latestByProvider.set(item.operation.provider, item);
  }
  for (const { operation } of latestByProvider.values()) {
    if (operation.phase === 'preparing' || sendingOperations.has(operation.operationId)) continue;
    try {
      await waitForProviderReady(tabId, operation.provider, 20000);
      await sendProviderMessage(tabId, operation.provider, {
        type: 'PROVIDER_RESUME_MONITOR',
        operationId: operation.operationId
      }, 15000);
    } catch {
      // Some providers keep their original content-script context across SPA navigation.
    }
  }
  for (const game of state.werewolfGames) {
    for (const operation of gamePendingTurns(game)) {
      if (game.bindings[operation.playerId]?.tabId !== tabId) continue;
      if (operation.phase === 'preparing' || sendingOperations.has(operation.operationId)) continue;
      try {
        await waitForProviderReady(tabId, operation.provider, 20000, false, false);
        await sendProviderMessage(tabId, operation.provider, {
          type: 'PROVIDER_RESUME_MONITOR',
          operationId: operation.operationId
        }, 15000);
      } catch {
        // The watchdog will retry without resubmitting the prompt.
      }
    }
  }
  for (const game of state.fogCouncilGames) {
    for (const operation of fogCouncilPendingTurns(game)) {
      if (game.bindings[operation.playerId]?.tabId !== tabId) continue;
      if (sendingOperations.has(operation.operationId)) continue;
      try {
        await waitForProviderReady(tabId, operation.provider, 20000, false, false);
        await sendProviderMessage(tabId, operation.provider, {
          type: 'PROVIDER_RESUME_MONITOR',
          operationId: operation.operationId
        }, 15000);
      } catch {
        // The watchdog will retry without re-submitting a FogCouncil prompt.
      }
    }
  }
}

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if ((changeInfo as chrome.tabs.TabChangeInfo & { frozen?: boolean }).frozen) {
    void resumePendingOperationsForTab(tabId).catch(console.error);
  }
  if (changeInfo.status !== 'complete') return;
  void addToAiDialogueGroup(tabId);
  void resumePendingOperationsForTab(tabId);
});

chrome.tabs.onActivated.addListener(({ tabId }) => {
  void resumePendingOperationsForTab(tabId);
});
chrome.tabs.onActivated.addListener(foregroundReplies.onActivated);

chrome.tabs.onRemoved.addListener((tabId) => {
  framePumpTabs.delete(tabId);
  void forgetPrivateGameTab(tabId).catch(console.error);
  void unmarkManagedTab(tabId);
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === PROVIDER_WATCHDOG_ALARM) { void checkPendingProviders(); return; }
  if (!alarm.name.startsWith(COMMAND_ALARM_PREFIX)) return;
  const commandId = alarm.name.slice(COMMAND_ALARM_PREFIX.length);
  void processQueuedCommand(commandId);
});

void (async () => {
  await migrateLegacyGrouping();
  replyAccelerationEnabled = (await loadState()).settings.replyAcceleration !== false;
  await replayPendingTerminalEvents();
  await orchestrator.recover();
  await werewolfEngine.recover();
  await fogCouncilEngine.recover();
  await recoverQueuedCommands();
  await syncProviderWatchdog();
  await checkPendingProviders();
})();

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'local' && changes[STORAGE_KEY]) void syncProviderWatchdog();
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.source === 'provider-content' && message.event) {
    const event = message.event as ProviderEvent;
    event.tabId = sender.tab?.id;
    event.url = sender.tab?.url;
    if (event.operationId) lastProviderActivity.set(event.operationId, Date.now());
    routeProviderEvent(event)
      .then(() => sendResponse({ success: true }))
      .catch((error: unknown) => sendResponse({ success: false, error: error instanceof Error ? error.message : String(error) }));
    return true;
  }

  (async () => {
    switch (message?.type) {
      case 'APPLY_UI_PATCH': {
        if (sender.tab?.url && !sender.tab.url.startsWith(chrome.runtime.getURL('sidepanel/'))) throw new Error('只有扩展控制台可以修改会话设置');
        await orchestrator.applyUiPatch(message.patch);
        return { success: true };
      }
      case 'PROVIDER_PAGE_BOOTSTRAP': {
        const tabId = sender.tab?.id;
        const provider = message.provider as ProviderId;
        if (!tabId || !providerById[provider] || !await isManagedTab(tabId, provider)) return { success: false };
        const state = await loadState();
        const conversationNeeded = state.conversations.some((session) => Object.values(session.pendingOperations ?? {}).some((operation) => operation.provider === provider && (operation.phase === 'preparing' || session.bindings[provider]?.tabId === tabId)));
        const gameNeeded = state.werewolfGames.some((game) => gamePendingTurns(game).some((operation) => operation.provider === provider && (operation.phase === 'preparing' || game.bindings[operation.playerId]?.tabId === tabId)));
        const fogCouncilNeeded = state.fogCouncilGames.some((game) => fogCouncilPendingTurns(game).some((operation) => operation.provider === provider && (operation.phase === 'preparing' || game.bindings[operation.playerId]?.tabId === tabId)));
        const needed = conversationNeeded || gameNeeded || fogCouncilNeeded;
        if (needed || await isPrivateGameTab(tabId, provider)) await startPageFramePump(tabId, provider);
        return { success: true };
      }
      case 'WAKE_PROVIDER_OPERATION': {
        if (!sender.tab?.id) throw new Error('仅当前 AI 网页可以请求唤醒');
        await new Promise<void>((resolve, reject) => { void wakeOperation(String(message.operationId), sender.tab!.id, resolve).catch(reject); });
        return { success: true };
      }
      case 'RELEASE_PROVIDER_WAKE': {
        const state = await loadState();
        const operationId = String(message.operationId);
        const owner = state.conversations.find((session) => session.pendingOperations?.[operationId]);
        const operation = owner?.pendingOperations?.[operationId];
        const game = state.werewolfGames.find((item) => Boolean(gamePendingByOperation(item, operationId)));
        const gameOperation = game ? gamePendingByOperation(game, operationId) : undefined;
        const gameMatches = Boolean(gameOperation && game?.bindings[gameOperation.playerId]?.tabId === sender.tab?.id);
        const clockGame = state.fogCouncilGames.find((item) => Boolean(fogCouncilPendingByOperation(item, operationId)));
        const clockOperation = clockGame ? fogCouncilPendingByOperation(clockGame, operationId) : undefined;
        const clockMatches = Boolean(clockOperation && clockGame?.bindings[clockOperation.playerId]?.tabId === sender.tab?.id);
        if ((operation && owner?.bindings[operation.provider]?.tabId === sender.tab?.id) || gameMatches || clockMatches) wakeReleases.get(operationId)?.();
        return { success: true };
      }
      case 'GET_PROVIDER_STATUS': {
        const providers = message.providers as ProviderId[];
        const statuses = await Promise.all(providers.map(async (provider) => {
          const tab = await findProviderTab(provider);
          if (!tab?.id) return { provider, state: 'unknown', connected: false, reason: '网页未打开' };
          try {
            const response = await Promise.race([
              sendProviderMessage(tab.id, provider, { type: 'PROVIDER_PING' }) as Promise<{ success?: boolean } | undefined>,
              new Promise<undefined>((resolve) => setTimeout(() => resolve(undefined), 2500))
            ]);
            const ready = response?.success === true;
            return {
              provider,
              state: ready ? 'ready' : 'error',
              connected: true,
              tabId: tab.id,
              url: tab.url,
              reason: ready ? undefined : '未检测到可用输入框，可能未登录、仍在加载或处于验证页面'
            };
          } catch (error) {
            return {
              provider,
              state: 'error',
              connected: true,
              tabId: tab.id,
              url: tab.url,
              reason: error instanceof Error ? error.message : String(error)
            };
          }
        }));
        return { success: true, statuses };
      }
      case 'OPEN_PROVIDER': {
        const tab = await ensureProviderTab(message.provider as ProviderId);
        return { success: true, tabId: tab.id, url: tab.url };
      }
      case 'OPEN_FULLSCREEN': {
        const tab = await chrome.tabs.create({ url: chrome.runtime.getURL('sidepanel/index.html?standalone=1'), active: true });
        return { success: true, tabId: tab.id };
      }
      case 'CREATE_FRESH_CONVERSATION': {
        const binding = await createFreshConversation(message.provider as ProviderId, message.tabId as number | undefined);
        return { success: true, ...binding };
      }
      case 'START_QA_SESSION': {
        const commandId = await enqueueCommand({
          type: 'qa',
          sessionId: String(message.sessionId),
          providers: message.providers as ProviderId[],
          payload: message.payload as ComposerPayload
        });
        return { success: true, commandId };
      }
      case 'START_SEQUENTIAL_SESSION': {
        const commandId = await enqueueCommand({
          type: 'sequential',
          sessionId: String(message.sessionId),
          providers: message.providers as ProviderId[],
          payload: message.payload as ComposerPayload,
          targetRounds: Number(message.targetRounds)
        });
        return { success: true, commandId };
      }
      case 'RESUME_SEQUENTIAL_SESSION': {
        await orchestrator.resumeSequential(
          String(message.sessionId),
          message.payload as ComposerPayload | undefined
        );
        return { success: true };
      }
      case 'INTERRUPT_SESSION': {
        await orchestrator.interruptSequential(String(message.sessionId));
        return { success: true };
      }
      case 'CREATE_WEREWOLF_GAME': {
        const game = await werewolfEngine.createGame(message.setup);
        return { success: true, gameId: game.id };
      }
      case 'UPDATE_WEREWOLF_SETUP': {
        await werewolfEngine.updateSetup(message.setup);
        return { success: true };
      }
      case 'SET_ACTIVE_WEREWOLF_GAME': {
        await werewolfEngine.setActiveGame(message.gameId ? String(message.gameId) : undefined);
        return { success: true };
      }
      case 'START_WEREWOLF_GAME': {
        await werewolfEngine.startGame(String(message.gameId));
        return { success: true };
      }
      case 'INTERRUPT_WEREWOLF_GAME': {
        await werewolfEngine.interruptGame(String(message.gameId));
        return { success: true };
      }
      case 'RESUME_WEREWOLF_GAME': {
        await werewolfEngine.resumeGame(String(message.gameId));
        return { success: true };
      }
      case 'SUBMIT_WEREWOLF_HUMAN_ACTION': {
        await werewolfEngine.submitHumanAction(String(message.gameId), message.submission ?? {});
        return { success: true };
      }
      case 'DELETE_WEREWOLF_GAME': {
        await werewolfEngine.deleteGame(String(message.gameId));
        return { success: true };
      }
      case 'CREATE_FOG_COUNCIL_GAME': {
        const game = await fogCouncilEngine.createGame(message.setup);
        return { success: true, gameId: game.id };
      }
      case 'UPDATE_FOG_COUNCIL_SETUP': {
        await fogCouncilEngine.updateSetup(message.setup);
        return { success: true };
      }
      case 'SET_ACTIVE_FOG_COUNCIL_GAME': {
        await fogCouncilEngine.setActiveGame(message.gameId ? String(message.gameId) : undefined);
        return { success: true };
      }
      case 'START_FOG_COUNCIL_GAME': {
        await fogCouncilEngine.startGame(String(message.gameId));
        return { success: true };
      }
      case 'INTERRUPT_FOG_COUNCIL_GAME': {
        await fogCouncilEngine.interruptGame(String(message.gameId));
        return { success: true };
      }
      case 'RESUME_FOG_COUNCIL_GAME': {
        await fogCouncilEngine.resumeGame(String(message.gameId));
        return { success: true };
      }
      case 'SUBMIT_FOG_COUNCIL_HUMAN_ACTION': {
        await fogCouncilEngine.submitHumanAction(String(message.gameId), message.submission ?? {});
        return { success: true };
      }
      case 'DELETE_FOG_COUNCIL_GAME': {
        await fogCouncilEngine.deleteGame(String(message.gameId));
        return { success: true };
      }
      case 'SEND_TO_PROVIDER': {
        const provider = message.provider as ProviderId;
        await sendToProvider(provider, String(message.operationId), message.payload as ComposerPayload, message.tabId as number | undefined, message.conversationUrl as string | undefined);
        const tab = await findProviderTab(provider, message.tabId as number | undefined);
        return { success: true, tabId: tab?.id, url: tab?.url };
      }
      case 'CANCEL_PROVIDER': {
        const provider = message.provider as ProviderId;
        await cancelProvider(provider, message.operationId as string | undefined, message.tabId as number | undefined);
        return { success: true };
      }
      default:
        return { success: false, error: 'Unknown message type' };
    }
  })().then(sendResponse).catch((error: unknown) => sendResponse({ success: false, error: error instanceof Error ? error.message : String(error) }));

  return true;
});
