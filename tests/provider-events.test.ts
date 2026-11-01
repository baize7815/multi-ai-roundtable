import assert from 'node:assert/strict';
import { acceptTerminalProviderEvent, isProviderReplyActivity, isTerminalProviderEvent, pendingOwner, TERMINAL_RECEIPT_PREFIX } from '../src/background/provider-events';
import { createConversationSession, DEFAULT_STATE } from '../src/shared/storage';
import type { PersistedState, ProviderEvent } from '../src/shared/types';

const state: PersistedState = structuredClone(DEFAULT_STATE);
const conversation = createConversationSession('qa');
conversation.bindings.deepseek = { provider: 'deepseek', tabId: 13 };
conversation.pendingOperations = {
  'qa-one': { operationId: 'qa-one', provider: 'deepseek', messageId: 'reply', mode: 'qa', payload: { text: 'test', attachments: [] }, startedAt: 1, phase: 'active' }
};
state.conversations = [conversation];
state.werewolfGames = [{
  bindings: { 'p1': { provider: 'doubao', tabId: 21 } },
  pendingTurn: { operationId: 'wolf-one', provider: 'doubao', playerId: 'p1' },
  pendingParallelTurns: []
} as any];
state.clocktowerGames = [{
  bindings: { 'p2': { provider: 'gpt', tabId: 31 } },
  pendingTurn: { operationId: 'clock-one', provider: 'gpt', playerId: 'p2' }
} as any];

const reply = (operationId: string, provider: ProviderEvent['provider'], tabId: number): ProviderEvent =>
  ({ type: 'PROVIDER_RESPONSE_COMPLETED', operationId, provider, tabId, text: '完成' });

assert.equal(pendingOwner(state, reply('qa-one', 'deepseek', 13)), 'conversation');
assert.equal(pendingOwner(state, reply('wolf-one', 'doubao', 21)), 'werewolf');
assert.equal(pendingOwner(state, reply('clock-one', 'gpt', 31)), 'clocktower');
assert.equal(pendingOwner(state, reply('wolf-one', 'doubao', 22)), undefined, '不可接受错误标签上的游戏回复');
assert.equal(pendingOwner(state, reply('clock-one', 'deepseek', 31)), undefined, '不可接受错误平台回包');
assert.equal(pendingOwner(state, reply('missing', 'doubao', 21)), undefined);
assert.equal(isProviderReplyActivity({ type: 'PROVIDER_READY', provider: 'doubao' }), false);
assert.equal(isProviderReplyActivity({ type: 'PROVIDER_RESPONSE_DELTA', provider: 'doubao' }), true);
assert.equal(isTerminalProviderEvent(reply('qa-one', 'deepseek', 13)), true);

const receipts = new Map<string, { provider: ProviderEvent['provider']; type: ProviderEvent['type']; completedAt: number }>();
const delivered: string[] = [];
let dispatchShouldSucceed = true;
const deps = {
  loadState: async () => state,
  readReceipt: async (key: string) => receipts.get(key),
  writeReceipt: async (key: string, value: any) => { receipts.set(key, value); },
  dispatch: async (owner: string, event: ProviderEvent) => {
    delivered.push(owner + ':' + event.operationId);
    if (!dispatchShouldSucceed) return false;
    if (owner === 'werewolf') state.werewolfGames[0].pendingTurn = undefined;
    if (owner === 'clocktower') state.clocktowerGames[0].pendingTurn = undefined;
    if (owner === 'conversation') delete conversation.pendingOperations?.[event.operationId!];
    return true;
  }
};
assert.equal(await acceptTerminalProviderEvent(reply('missing', 'doubao', 21), deps as any), false);
assert.equal(receipts.size, 0, '无归属操作不能写入收妥凭证');
assert.equal(await acceptTerminalProviderEvent(reply('wolf-one', 'doubao', 22), deps as any), false);
dispatchShouldSucceed = false;
assert.equal(await acceptTerminalProviderEvent(reply('wolf-one', 'doubao', 21), deps as any), false, '提交失败不能 ACK');
assert.equal(receipts.size, 0);
dispatchShouldSucceed = true;
assert.equal(await acceptTerminalProviderEvent(reply('wolf-one', 'doubao', 21), deps as any), true);
assert.ok(receipts.has(TERMINAL_RECEIPT_PREFIX + 'wolf-one'));
assert.equal(await acceptTerminalProviderEvent(reply('wolf-one', 'doubao', 21), deps as any), true, '提交成功但 ACK 丢失后应凭收据幂等确认');
assert.equal(delivered.filter((item) => item === 'werewolf:wolf-one').length, 2, '不应重复提交已确认的回复');
assert.equal(await acceptTerminalProviderEvent(reply('clock-one', 'gpt', 31), deps as any), true);
assert.equal(await acceptTerminalProviderEvent(reply('qa-one', 'deepseek', 13), deps as any), true);
assert.equal(await acceptTerminalProviderEvent(reply('qa-one', 'deepseek', 13), deps as any), true);
assert.equal(receipts.size, 3);
console.log('provider terminal receipts and game ownership tests passed');
