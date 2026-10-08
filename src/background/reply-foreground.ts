import type { PersistedState } from '../shared/types';

interface Target { tabId: number }
interface WindowLease {
  originalTabId?: number;
  lastTabId?: number;
  selectedAt: number;
  manual: boolean;
  collapsedGroups: Set<number>;
}

// Only conversation operations enter this scheduler. Game bindings are never
// eligible, including when a game and an ordinary conversation run together.
export function createReplyForeground(isManaged: (tabId: number) => Promise<boolean>) {
  const leases = new Map<number, WindowLease>();
  const expectedActivations = new Map<number, number>();
  let tail: Promise<void> = Promise.resolve();
  let running = false;
  let queuedState: PersistedState | undefined;
  let queuedPreferredTabId: number | undefined;

  function onActivated({ tabId, windowId }: chrome.tabs.TabActiveInfo): void {
    if (expectedActivations.get(windowId) === tabId) {
      expectedActivations.delete(windowId);
      return;
    }
    const lease = leases.get(windowId);
    if (lease && lease.lastTabId !== tabId) lease.manual = true;
  }

  async function activate(tabId: number, windowId: number): Promise<void> {
    expectedActivations.set(windowId, tabId);
    try { await chrome.tabs.update(tabId, { active: true }); }
    catch (error) { expectedActivations.delete(windowId); throw error; }
  }

  async function release(windowId: number, lease: WindowLease, privateTabs: Set<number>): Promise<void> {
    try {
      if (lease.manual) return;
      const active = (await chrome.tabs.query({ active: true, windowId }))[0];
      if (lease.manual || active?.id !== lease.lastTabId) return;
      if (lease.originalTabId && !privateTabs.has(lease.originalTabId) && lease.originalTabId !== active.id) {
        await activate(lease.originalTabId, windowId).catch(() => undefined);
      }
      // Keep the lease while restoring so manual activations still cancel it.
      const restored = (await chrome.tabs.query({ active: true, windowId }))[0];
      for (const groupId of lease.collapsedGroups) {
        if (lease.manual) return;
        if (restored?.groupId !== groupId) await chrome.tabGroups.update(groupId, { collapsed: true }).catch(() => undefined);
      }
    } finally {
      if (leases.get(windowId) === lease) leases.delete(windowId);
    }
  }

  async function syncNow(state: PersistedState, preferredTabId?: number): Promise<void> {
    const privateTabs = new Set([
      ...state.werewolfGames.flatMap((game) => Object.values(game.bindings).map((binding) => binding.tabId)),
      ...state.fogCouncilGames.flatMap((game) => Object.values(game.bindings).map((binding) => binding.tabId))
    ]);
    const targets = new Map<number, Target[]>();
    if (state.settings.replyAcceleration !== false) {
      const operations = state.conversations.flatMap((session) =>
        Object.values(session.pendingOperations ?? {}).map((operation) => ({ session, operation }))
      );
      for (const { session, operation } of operations) {
        const tabId = session.bindings[operation.provider]?.tabId;
        if (!tabId || operation.phase === 'preparing' || privateTabs.has(tabId) || !await isManaged(tabId)) continue;
        const tab = await chrome.tabs.get(tabId).catch(() => undefined);
        if (!tab || tab.windowId === undefined) continue;
        const group = targets.get(tab.windowId) ?? [];
        if (!group.some((item) => item.tabId === tabId)) group.push({ tabId });
        targets.set(tab.windowId, group);
      }
    }
    for (const [windowId, lease] of leases) {
      if (!targets.has(windowId)) await release(windowId, lease, privateTabs).catch(() => undefined);
    }
    for (const [windowId, group] of targets) {
      let lease = leases.get(windowId);
      const active = (await chrome.tabs.query({ active: true, windowId }))[0];
      if (!lease) {
        lease = { originalTabId: active?.id, selectedAt: 0, manual: false, collapsedGroups: new Set() };
        leases.set(windowId, lease);
      }
      if (lease.manual) continue;
      if (lease.lastTabId && active?.id !== lease.lastTabId) { lease.manual = true; continue; }
      const preferred = group.find((item) => item.tabId === preferredTabId);
      const currentIndex = group.findIndex((item) => item.tabId === lease.lastTabId);
      const next = preferred ?? group[currentIndex < 0 ? 0 : (currentIndex + 1) % group.length];
      if (!preferred && currentIndex >= 0 && Date.now() - lease.selectedAt < 4000) continue;
      if (active?.id === next.tabId) {
        lease.lastTabId = next.tabId;
        if (!lease.selectedAt) lease.selectedAt = Date.now();
        continue;
      }
      const tab = await chrome.tabs.get(next.tabId).catch(() => undefined);
      if (!tab) continue;
      if (tab.groupId !== chrome.tabGroups.TAB_GROUP_ID_NONE) {
        const tabGroup = await chrome.tabGroups.get(tab.groupId).catch(() => undefined);
        if (tabGroup?.collapsed) lease.collapsedGroups.add(tab.groupId);
      }
      // Do not focus another window or undo minimisation to accelerate a reply.
      if (lease.manual) continue;
      await activate(next.tabId, windowId);
      lease.lastTabId = next.tabId;
      lease.selectedAt = Date.now();
    }
  }

  function sync(state: PersistedState, preferredTabId?: number): Promise<void> {
    queuedState = state;
    if (preferredTabId !== undefined) queuedPreferredTabId = preferredTabId;
    if (running) return tail;
    running = true;
    tail = (async () => {
      while (queuedState) {
        const latest = queuedState;
        const preferred = queuedPreferredTabId;
        queuedState = undefined;
        queuedPreferredTabId = undefined;
        await syncNow(latest, preferred);
      }
    })().finally(() => { running = false; });
    return tail;
  }

  return { sync, onActivated };
}
