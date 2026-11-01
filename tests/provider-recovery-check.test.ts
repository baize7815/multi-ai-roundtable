import assert from 'node:assert/strict';
import { emitProviderEvent, installProviderHarness, recoverStableProviderReply, responseMatchesBaseline } from '../src/content/common';
import { readFileSync } from 'node:fs';
import type { ProviderEvent } from '../src/shared/types';

type Handler = (message: any, sender: any, respond: (value: any) => void) => boolean;
let listener: Handler | undefined;
const stored = new Map<string, unknown>();
const emitted: ProviderEvent[] = [];
let attempts = 0;

(globalThis as any).chrome = {
  runtime: {
    onMessage: {
      addListener: (handler: Handler) => { listener = handler; },
      hasListener: () => false
    },
    sendMessage: async (message: any) => {
      if (message?.source === 'provider-content') emitted.push(message.event);
      return { success: true };
    },
    connect: () => { throw new Error('keepalive not required in unit test'); }
  },
  storage: {
    local: {
      get: async (key: string) => ({ [key]: stored.get(key) }),
      set: async (values: Record<string, unknown>) => {
        for (const [key, value] of Object.entries(values)) stored.set(key, value);
      },
      remove: async (keys: string[] | string) => {
        for (const key of Array.isArray(keys) ? keys : [keys]) stored.delete(key);
      }
    }
  }
};

installProviderHarness({
  provider: 'deepseek',
  send: async () => { throw new Error('网页发送确认超时，但 AI 已完成回复'); },
  cancel: async () => undefined,
  tryFinalize: async (operationId) => { attempts++; return operationId === 'valid' || operationId === 'send-recovery'; }
});

async function invoke(message: Record<string, unknown>): Promise<any> {
  return new Promise((resolve, reject) => {
    if (!listener) { reject(new Error('content harness not registered')); return; }
    const result = listener(message, {}, resolve);
    if (!result) reject(new Error('provider message not accepted'));
  });
}

const baseline = await invoke({ type: 'PROVIDER_CHECK', operationId: 'valid' });
assert.equal(baseline.success, false, '普通轮询不允许擅自把页面文字当成完成回复');
assert.equal(attempts, 0);

const wrong = await invoke({ type: 'PROVIDER_CHECK', operationId: 'stale', tryFinalize: true });
assert.equal(wrong.success, false, '旧操作不能领取新操作的回复');
const recovered = await invoke({ type: 'PROVIDER_CHECK', operationId: 'valid', tryFinalize: true });
assert.deepEqual(recovered, { success: true, phase: 'terminal' }, '明确的最终回复探测应唤回后台');
assert.equal(attempts, 2);

const send = await invoke({ type: 'PROVIDER_SEND', operationId: 'send-recovery', payload: { text: 'testing', attachments: [] } });
assert.equal(send.success, true, '发送确认失败但同操作已有最终回复时不能误判发送失败');
assert.equal(send.phase, 'completed');
assert.ok(!emitted.some((event) => event.operationId === 'send-recovery' && event.type === 'PROVIDER_ERROR'));

emitProviderEvent({ type: 'PROVIDER_RESPONSE_COMPLETED', provider: 'deepseek', operationId: 'finished', text: '最终答案' });
await new Promise((resolve) => setTimeout(resolve, 0));
emitProviderEvent({ type: 'PROVIDER_ERROR', provider: 'deepseek', operationId: 'finished', error: '后来的错误' });
await new Promise((resolve) => setTimeout(resolve, 0));
assert.ok(!emitted.some((event) => event.operationId === 'finished' && event.type === 'PROVIDER_ERROR'),
  '最终回复确认之后的迟到错误不得覆盖完成事件');


(globalThis as any).location = { href: 'https://example.test/chat' };
stored.set('multiAiRoundtableResponseBaseline:current', {
  provider: 'deepseek', count: 2, url: 'https://example.test/chat'
});
assert.equal(await responseMatchesBaseline('current', 'deepseek', 2), false, '旧回复不能被恢复');
assert.equal(await responseMatchesBaseline('current', 'deepseek', 3), true, '新回复需要超过发送前基线');
assert.equal(await responseMatchesBaseline('current', 'gpt', 3), false, '不能跨模型认领');
assert.equal(await responseMatchesBaseline('stale', 'deepseek', 3), false, '缺失发送基线应拒绝恢复');

const snapshot = { owned: true, text: '新的最终答案', generating: false };
let finalized = 0;
async function probe(): Promise<boolean> {
  return recoverStableProviderReply({
    provider: 'deepseek', operationId: 'final-probe', settleMs: 0,
    readSnapshot: () => ({ ...snapshot }),
    onFinalized: () => { finalized++; snapshot.owned = false; }
  });
}
snapshot.owned = false;
assert.equal(await probe(), false, '不是当前操作的消息不能恢复');
snapshot.owned = true;
snapshot.generating = true;
assert.equal(await probe(), false, '正在生成的中间内容不能当最终结果');
snapshot.generating = false;
snapshot.text = '';
assert.equal(await probe(), false, '空内容不能结束游戏');
snapshot.text = '新的最终答案';
assert.equal(await probe(), true, '明确归属且稳定的最终文字应该恢复');
await new Promise((resolve) => setTimeout(resolve, 0));
assert.equal(finalized, 1);
assert.ok(emitted.some((event) => event.type === 'PROVIDER_RESPONSE_COMPLETED'
  && event.operationId === 'final-probe' && event.text === '新的最终答案'));

let changed = false;
const changing = await recoverStableProviderReply({
  provider: 'gpt', operationId: 'moving-reply', settleMs: 0,
  readSnapshot: () => {
    const text = changed ? '下半段' : '上半段';
    changed = true;
    return { owned: true, text, generating: false };
  },
  onFinalized: () => { throw new Error('文本变化时不应提交'); }
});
assert.equal(changing, false, '两次检查文字不一致时不能提前提交');

for (const name of ['deepseek','doubao','kimi','qwen','zhipu','gpt','gemini','grok','wenxin','minimax']) {
  const source = readFileSync('src/content/' + name + '.ts', 'utf8');
  assert.ok(source.includes('async function tryFinalize(operationId: string)'), name + ' 需要对应网站的最终回复探针');
  assert.ok(source.includes('recoverStableProviderReply('), name + ' 需要使用公共稳定性检查');
  assert.ok(source.includes('installProviderHarness({ provider: PROVIDER, send, cancel, resumeMonitor, tryFinalize, ready })'),
    name + ' 必须把恢复探针接入网页消息接口');
}


for (const provider of ['deepseek','doubao','kimi','qwen','zhipu','gpt','gemini','grok','wenxin','minimax'] as const) {
  const operationId = 'all-sites-' + provider;
  let owned = true;
  let done = 0;
  const recover = () => recoverStableProviderReply({
    provider, operationId, settleMs: 0,
    readSnapshot: () => ({ owned, text: '该模型的最终文字', generating: false }),
    onFinalized: () => { done++; owned = false; }
  });
  const [a, b] = await Promise.all([recover(), recover()]);
  assert.equal(a, true, provider + ' 的已完成回复应被接受');
  assert.equal(b, true, provider + ' 并发探针应共享恢复结果');
  assert.equal(done, 1, provider + ' 不得重复提交同一操作');
}
await new Promise((resolve) => setTimeout(resolve, 0));
for (const provider of ['deepseek','doubao','kimi','qwen','zhipu','gpt','gemini','grok','wenxin','minimax'] as const) {
  assert.equal(emitted.filter((event) => event.operationId === 'all-sites-' + provider && event.type === 'PROVIDER_RESPONSE_COMPLETED').length,
    1, provider + ' 必须只发一个最终完成事件');
}
console.log('provider hidden reply finalization and safe recovery tests passed');
