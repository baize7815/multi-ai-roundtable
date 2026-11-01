import assert from 'node:assert/strict';
import { confirmProviderSubmission, installProviderHarness } from '../src/content/common';

let listener: ((message: any, sender: any, done: (value: any) => void) => boolean) | undefined;
const stored = new Map<string, unknown>();
const emitted: any[] = [];
let retryCount = 0;
let submitted = false;
(globalThis as any).document = { documentElement: null, dispatchEvent: () => undefined };
(globalThis as any).chrome = {
  runtime: {
    onMessage: { addListener: (fn: typeof listener) => { listener = fn; }, hasListener: () => false },
    sendMessage: async (payload: any) => {
      if (payload.source === 'provider-content') emitted.push(payload.event);
      return { success: true };
    },
    connect: () => { throw new Error('keepalive not supported by fixture'); }
  },
  storage: { local: {
    get: async (key: string) => ({ [key]: stored.get(key) }),
    set: async (values: Record<string, unknown>) => {
      for (const [key, val] of Object.entries(values)) stored.set(key, val);
    },
    remove: async (keys: string[] | string) => {
      for (const key of Array.isArray(keys) ? keys : [keys]) stored.delete(key);
    }
  }}
};

installProviderHarness({
  provider: 'gpt',
  ready: () => true,
  cancel: async () => undefined,
  send: async (_payload, operationId) => {
    await confirmProviderSubmission(operationId, {
      current: () => true,
      submitted: () => submitted,
      retry: () => { retryCount++; },
      attemptTimeoutMs: 40,
      privateGameTimeoutMs: 60
    });
  }
});

async function invoke(msg: Record<string, unknown>): Promise<any> {
  return new Promise((resolve, reject) => {
    if (!listener?.(msg, {}, resolve)) reject(new Error('no content listener'));
  });
}

const unknown = await invoke({
  type: 'PROVIDER_SEND', operationId: 'game-unknown', privateGame: true,
  payload: { text: 'first attempt', attachments: [] }
});
assert.equal(unknown.success, true);
assert.equal(unknown.phase, 'unconfirmed', 'game must remain observable instead of failing after short acknowledgement');
assert.equal(retryCount, 0, 'a game may not click the same prompt again after an uncertain submit');
assert.equal(emitted.some((event) => event.type === 'PROVIDER_ERROR' && event.operationId === 'game-unknown'), false);

submitted = true;
const confirmed = await invoke({
  type: 'PROVIDER_SEND', operationId: 'game-confirmed', privateGame: true,
  payload: { text: 'second operation', attachments: [] }
});
assert.equal(confirmed.success, true);
assert.equal(confirmed.phase, 'monitoring', 'a confirmed submit enters ordinary reply monitoring');
assert.equal(retryCount, 0);

submitted = false;
const ordinary = await invoke({
  type: 'PROVIDER_SEND', operationId: 'ordinary-unconfirmed',
  payload: { text: 'ordinary qa prompt', attachments: [] }
});
assert.equal(ordinary.success, false, 'normal QA mode retains existing explicit failure behaviour');
assert.ok(retryCount >= 1, 'non-game mode retains its previous controlled retry strategy');
console.log('private game first-send acknowledgement and no-duplicate-click tests passed');
