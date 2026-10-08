import { providerById } from '../shared/providers';
import type { ProviderId } from '../shared/types';

const WINDOW_KEY = 'multiAiRoundtablePrivateGameWindowV2';
const TABS_KEY = 'multiAiRoundtablePrivateGameTabsV1';
const LEGACY_WINDOW_KEY = 'multiAiRoundtablePrivateGameWindowV1';
interface WindowRecord { windowId: number; anchorTabId: number }
type PrivateTabs = Record<string, ProviderId>;
let tail: Promise<unknown> = Promise.resolve();
const ACTIVE_WIDTH = 420;
const ACTIVE_HEIGHT = 320;
const EDGE_PEEK = 24;

function serial<T>(run: () => Promise<T>): Promise<T> {
  const task = tail.catch(() => undefined).then(run);
  tail = task.then(() => undefined, () => undefined);
  return task;
}

function anchorUrl(): string { return chrome.runtime.getURL('game-background.html'); }

async function record(): Promise<WindowRecord | undefined> {
  const saved = await chrome.storage.local.get(WINDOW_KEY);
  return saved[WINDOW_KEY] as WindowRecord | undefined;
}

async function ownedWindow(): Promise<chrome.windows.Window | undefined> {
  const current = await record();
  if (!current) return undefined;
  const anchor = await chrome.tabs.get(current.anchorTabId).catch(() => undefined);
  if (anchor?.windowId !== current.windowId || (anchor.pendingUrl ?? anchor.url) !== anchorUrl()) return undefined;
  return chrome.windows.get(current.windowId).catch(() => undefined);
}

async function activeBounds(): Promise<{ left?: number; top?: number; width: number; height: number }> {
  const reference = (await chrome.windows.getAll({ windowTypes: ['normal'] }).catch(() => []))
    .find((window) => window.focused);
  const left = reference?.left;
  const top = reference?.top;
  const width = reference?.width;
  const height = reference?.height;
  if ([left, top, width, height].every((value) => typeof value === 'number')) {
    return {
      left: left! + width! - EDGE_PEEK,
      top: top! + height! - EDGE_PEEK,
      width: ACTIVE_WIDTH,
      height: ACTIVE_HEIGHT
    };
  }
  return { width: ACTIVE_WIDTH, height: ACTIVE_HEIGHT };
}

async function wakeWindow(windowId: number): Promise<void> {
  let current = await chrome.windows.get(windowId);
  if (current.state !== 'normal') {
    current = await chrome.windows.update(windowId, { state: 'normal' });
  }
  const bounds = await activeBounds();
  const move = current.left !== bounds.left || current.top !== bounds.top
    || current.width !== bounds.width || current.height !== bounds.height;
  if (move || current.focused) {
    await chrome.windows.update(windowId, { ...(move ? bounds : {}), focused: false }).catch(async () => {
      if (current.focused) await chrome.windows.update(windowId, { focused: false });
    });
  }
}

async function parkWindow(windowId: number, anchorTabId: number): Promise<void> {
  await chrome.tabs.update(anchorTabId, { active: true }).catch(() => undefined);
  const current = await chrome.windows.get(windowId).catch(() => undefined);
  if (current && current.state !== 'minimized') {
    await chrome.windows.update(windowId, { state: 'minimized' }).catch(() => undefined);
  }
}

async function ensureWindow(): Promise<chrome.windows.Window & { id: number }> {
  let target = await ownedWindow();
  if (target?.id !== undefined && target.type !== 'normal') {
    await chrome.windows.remove(target.id).catch(() => undefined);
    await chrome.storage.local.remove([WINDOW_KEY, TABS_KEY]);
    target = undefined;
  }
  if (!target) {
    // Reuse the old helper's window only while its original session owns it.
    const legacy = await chrome.storage.session.get(LEGACY_WINDOW_KEY);
    target = typeof legacy[LEGACY_WINDOW_KEY] === 'number'
      ? await chrome.windows.get(legacy[LEGACY_WINDOW_KEY]).catch(() => undefined)
      : undefined;
    if (target?.type !== 'normal') target = undefined;
    if (target?.id !== undefined) {
      const anchor = await chrome.tabs.create({ windowId: target.id, url: anchorUrl(), active: false });
      if (anchor.id === undefined) throw new Error('无法登记游戏后台窗口');
      await chrome.storage.local.set({ [WINDOW_KEY]: { windowId: target.id, anchorTabId: anchor.id } satisfies WindowRecord });
    } else {
      target = await chrome.windows.create({ url: anchorUrl(), type: 'normal', state: 'minimized', focused: false });
      const anchor = target.tabs?.[0] ?? (target.id === undefined ? undefined : (await chrome.tabs.query({ windowId: target.id }))[0]);
      if (target.id === undefined || anchor?.id === undefined) throw new Error('无法创建游戏后台窗口');
      await chrome.storage.local.set({ [WINDOW_KEY]: { windowId: target.id, anchorTabId: anchor.id } satisfies WindowRecord });
      await chrome.storage.local.remove(TABS_KEY);
    }
  }
  if (target.id === undefined) throw new Error('游戏后台窗口无效');
  return target as chrome.windows.Window & { id: number };
}

async function rememberTab(tabId: number, provider: ProviderId): Promise<void> {
  const saved = await chrome.storage.local.get(TABS_KEY);
  const tabs = (saved[TABS_KEY] as PrivateTabs | undefined) ?? {};
  tabs[String(tabId)] = provider;
  await chrome.storage.local.set({ [TABS_KEY]: tabs });
}

export async function isPrivateGameTab(tabId: number, provider?: ProviderId): Promise<boolean> {
  const saved = await chrome.storage.local.get(TABS_KEY);
  const owner = (saved[TABS_KEY] as PrivateTabs | undefined)?.[String(tabId)];
  if (!owner || (provider && owner !== provider)) return false;
  const window = await ownedWindow();
  const tab = await chrome.tabs.get(tabId).catch(() => undefined);
  return Boolean(window && tab && tab.url
    && providerById[owner]?.urlPatterns?.some((pattern) => tab.url!.startsWith(pattern.replace('*', ''))));
}

export function forgetPrivateGameTab(tabId: number): Promise<void> {
  return serial(async () => {
    const saved = await chrome.storage.local.get(TABS_KEY);
    const tabs = (saved[TABS_KEY] as PrivateTabs | undefined) ?? {};
    if (!(String(tabId) in tabs)) return;
    delete tabs[String(tabId)];
    await chrome.storage.local.set({ [TABS_KEY]: tabs });
  });
}

export function createPrivateGameTab(provider: ProviderId, url: string): Promise<chrome.tabs.Tab> {
  return serial(async () => {
    const target = await ensureWindow();
    const tab = await chrome.tabs.create({ windowId: target.id, url: 'about:blank', active: false });
    if (tab.id === undefined) throw new Error('游戏标签页无效');
    await rememberTab(tab.id, provider);
    try {
      await wakeWindow(target.id);
      return await chrome.tabs.update(tab.id, { url, autoDiscardable: false, active: true });
    } catch (error) {
      await chrome.tabs.remove(tab.id).catch(() => undefined);
      throw error;
    }
  });
}

// Callers validate ownership. Recovery reuses the same tab and conversation.
export function preparePrivateGamePage(tabId: number, provider: ProviderId, activate = true): Promise<void> {
  return serial(async () => {
    const target = await ensureWindow();
    const tab = await chrome.tabs.get(tabId) as chrome.tabs.Tab & { frozen?: boolean };
    if (tab.windowId !== target.id) await chrome.tabs.move(tabId, { windowId: target.id, index: -1 });
    else if (tab.groupId !== chrome.tabGroups.TAB_GROUP_ID_NONE) await chrome.tabs.ungroup(tabId);
    await rememberTab(tabId, provider);
    await wakeWindow(target.id);
    await chrome.tabs.update(tabId, { autoDiscardable: false, ...(activate || tab.frozen ? { active: true } : {}) });
  });
}

export function releaseInactivePrivateGamePages(keep: Set<number>): Promise<void> {
  return serial(async () => {
    const target = await ownedWindow();
    const currentRecord = await record();
    if (!target?.id || !currentRecord) return;
    const ownedTabs = await chrome.tabs.query({ windowId: target.id });
    const keepTab = [...keep].find((tabId) => ownedTabs.some((tab) => tab.id === tabId));
    if (keepTab !== undefined) {
      await wakeWindow(target.id);
      await chrome.tabs.update(keepTab, { active: true, autoDiscardable: false }).catch(() => undefined);
      return;
    }
    await parkWindow(target.id, currentRecord.anchorTabId);
  });
}
