export const GAME_PREPARING_TIMEOUT_MS = 180000;
export const GAME_UNCONFIRMED_TIMEOUT_MS = 180000;
export const GAME_REPLY_IDLE_TIMEOUT_MS = 360000;

export interface GamePendingReplyTiming {
  startedAt: number;
  responseStartedAt?: number;
  responseLastActivityAt?: number;
  submissionUnconfirmedAt?: number;
}

export function gameReplyTiming(
  pending: GamePendingReplyTiming,
  volatileActivityAt = 0,
  now = Date.now()
): { lastActivityAt: number; timeoutMs: number; unconfirmedWithoutReply: boolean; timedOut: boolean } {
  const lastActivityAt = Math.max(
    pending.startedAt,
    pending.responseStartedAt ?? 0,
    pending.responseLastActivityAt ?? 0,
    volatileActivityAt
  );
  const unconfirmedWithoutReply = Boolean(pending.submissionUnconfirmedAt && !pending.responseStartedAt);
  const timeoutMs = unconfirmedWithoutReply ? GAME_UNCONFIRMED_TIMEOUT_MS : GAME_REPLY_IDLE_TIMEOUT_MS;
  return { lastActivityAt, timeoutMs, unconfirmedWithoutReply, timedOut: now - lastActivityAt >= timeoutMs };
}
