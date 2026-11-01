import type { PersistedState, ProviderEvent, ProviderId } from '../shared/types';

export type PendingOwner = 'conversation' | 'werewolf' | 'clocktower';
export const TERMINAL_RECEIPT_PREFIX = 'multiAiRoundtableTerminalReceipt:';

export function isTerminalProviderEvent(event: ProviderEvent): boolean {
  return event.type === 'PROVIDER_RESPONSE_COMPLETED' || event.type === 'PROVIDER_ERROR';
}

// Only real reply events extend the watchdog's activity timeout. Reattaching a
// DOM monitor, checking an operation, or seeing an unrelated READY must not.
export function isProviderReplyActivity(event: ProviderEvent): boolean {
  return event.type === 'PROVIDER_RESPONSE_STARTED' || event.type === 'PROVIDER_RESPONSE_DELTA';
}

function matchesBinding(event: ProviderEvent, provider: ProviderId, tabId?: number): boolean {
  return event.provider === provider && (event.tabId === undefined || tabId === undefined || event.tabId === tabId);
}

export function pendingOwner(state: PersistedState, event: ProviderEvent): PendingOwner | undefined {
  const operationId = event.operationId;
  if (!operationId) return undefined;
  for (const session of state.conversations) {
    const op = session.pendingOperations?.[operationId];
    if (op && matchesBinding(event, op.provider, session.bindings[op.provider]?.tabId)) return 'conversation';
  }
  for (const game of state.werewolfGames) {
    const turns = [game.pendingTurn, ...(game.pendingParallelTurns ?? [])];
    const op = turns.find((item) => item?.operationId === operationId);
    if (op && matchesBinding(event, op.provider, game.bindings[op.playerId]?.tabId)) return 'werewolf';
  }
  for (const game of state.clocktowerGames) {
    const op = game.pendingTurn;
    if (op?.operationId === operationId && matchesBinding(event, op.provider, game.bindings[op.playerId]?.tabId)) return 'clocktower';
  }
  return undefined;
}

export interface TerminalReceipt {
  provider: ProviderId;
  type: ProviderEvent['type'];
  completedAt: number;
}

export async function acceptTerminalProviderEvent(event: ProviderEvent, deps: {
  loadState: () => Promise<PersistedState>;
  readReceipt: (key: string) => Promise<TerminalReceipt | undefined>;
  writeReceipt: (key: string, value: TerminalReceipt) => Promise<void>;
  dispatch: (owner: PendingOwner, event: ProviderEvent) => Promise<boolean>;
}): Promise<boolean> {
  if (!isTerminalProviderEvent(event) || !event.operationId) return false;
  const key = TERMINAL_RECEIPT_PREFIX + event.operationId;
  const receipt = await deps.readReceipt(key);
  if (receipt?.provider === event.provider && receipt.type === event.type) return true;
  // Do not acknowledge an orphan, a wrong provider, or a reply from a tab
  // different from the operation binding. Preserve its terminal journal.
  const owner = pendingOwner(await deps.loadState(), event);
  if (!owner) return false;
  if (!await deps.dispatch(owner, event)) return false;
  // A receipt makes a retry idempotent after a reply was committed but its ACK
  // was lost. If this write fails, the sender retains its journal for recovery.
  await deps.writeReceipt(key, { provider: event.provider, type: event.type, completedAt: Date.now() });
  return true;
}
