import assert from 'node:assert/strict';
import { ATTACHMENT_DATA_PREFIX, cleanupOrphanAttachments, hydratePayloadAttachments, stashPayloadAttachments } from '../src/background/attachments';

const values: Record<string, unknown> = {};
function read(keys: string | string[] | null): Record<string, unknown> {
  const requested = keys === null ? Object.keys(values) : typeof keys === 'string' ? [keys] : keys;
  return Object.fromEntries(requested.filter((key) => key in values).map((key) => [key, structuredClone(values[key])]));
}
(globalThis as any).chrome = {
  storage: {
    local: {
      get: async (keys: string | string[] | null) => read(keys),
      set: async (input: Record<string, unknown>) => { Object.assign(values, structuredClone(input)); },
      remove: async (keys: string[]) => { keys.forEach((key) => { delete values[key]; }); },
      getKeys: async () => Object.keys(values)
    }
  }
};

const input = { text: '请分析图片', attachments: [{
  id: 'picture-1', name: 'picture.png', type: 'image/png', size: 200,
  kind: 'image' as const, dataUrl: 'data:image/png;base64,AAAA'
}] };
const safe = await stashPayloadAttachments(input);
assert.equal(safe.attachments[0].dataUrl, '', '热路径的 payload 不应包含附件正文');
assert.deepEqual((await hydratePayloadAttachments(safe)).attachments, input.attachments, '发送时应能完整恢复附件');
assert.equal(safe.text, input.text, '保存附件时不能改写用户输入');
const key = `${ATTACHMENT_DATA_PREFIX}picture-1`;
(values[key] as { createdAt: number }).createdAt = Date.now() - 10 * 24 * 60 * 60 * 1000;
assert.equal(await cleanupOrphanAttachments(new Set(['picture-1'])), 0, '活跃会话附件不能被清除');
assert.equal(await cleanupOrphanAttachments(new Set()), 1, '过期孤儿附件应被清除');
await assert.rejects(() => hydratePayloadAttachments(safe), /附件.*丢失/, '缺少附件正文应明确报错而不是静默丢弃');
console.log('attachment sidecar persistence and cleanup tests passed');
