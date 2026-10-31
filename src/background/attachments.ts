import type { AttachmentPayload, ComposerPayload } from '../shared/types';

export const ATTACHMENT_DATA_PREFIX = 'multiAiRoundtableAttachment:';

/** Store large payload data separately from frequently persisted conversation state. */
export async function stashPayloadAttachments(payload: ComposerPayload): Promise<ComposerPayload> {
  const data: Record<string, { dataUrl: string; createdAt: number }> = {};
  const attachments = payload.attachments.map((attachment) => {
    if (attachment.dataUrl) data[`${ATTACHMENT_DATA_PREFIX}${attachment.id}`] = { dataUrl: attachment.dataUrl, createdAt: Date.now() };
    return { ...attachment, dataUrl: '' };
  });
  if (Object.keys(data).length) await chrome.storage.local.set(data);
  return { ...payload, attachments };
}

export async function hydratePayloadAttachments(payload: ComposerPayload): Promise<ComposerPayload> {
  const missing = payload.attachments.filter((attachment) => !attachment.dataUrl);
  if (!missing.length) return payload;
  const stored = await chrome.storage.local.get(missing.map((attachment) => `${ATTACHMENT_DATA_PREFIX}${attachment.id}`));
  const attachments: AttachmentPayload[] = payload.attachments.map((attachment) => {
    const record = stored[`${ATTACHMENT_DATA_PREFIX}${attachment.id}`];
    const dataUrl = attachment.dataUrl || (typeof record === 'string' ? record : record?.dataUrl);
    if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:')) {
      throw new Error(`附件「${attachment.name}」已丢失，请重新添加后发送`);
    }
    return { ...attachment, dataUrl };
  });
  return { ...payload, attachments };
}

/** Prune only stale, unreferenced attachment objects; never inspect unrelated values. */
export async function cleanupOrphanAttachments(activeIds: Set<string>): Promise<number> {
  const store = chrome.storage.local as typeof chrome.storage.local & { getKeys?: () => Promise<string[]> };
  if (typeof store.getKeys !== 'function') return 0;
  const candidates = (await store.getKeys()).filter((key) =>
    key.startsWith(ATTACHMENT_DATA_PREFIX) && !activeIds.has(key.slice(ATTACHMENT_DATA_PREFIX.length)));
  const expiredBefore = Date.now() - 7 * 24 * 60 * 60 * 1000;
  let removed = 0;
  for (let offset = 0; offset < candidates.length; offset += 25) {
    const keys = candidates.slice(offset, offset + 25);
    const values = await store.get(keys);
    const stale = keys.filter((key) => {
      const value = values[key];
      return Boolean(value && typeof value === 'object' && typeof value.createdAt === 'number' && value.createdAt < expiredBefore);
    });
    if (stale.length) {
      await store.remove(stale);
      removed += stale.length;
    }
  }
  return removed;
}
