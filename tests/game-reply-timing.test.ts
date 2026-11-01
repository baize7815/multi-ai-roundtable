import assert from 'node:assert/strict';
import { GAME_PREPARING_TIMEOUT_MS, GAME_UNCONFIRMED_TIMEOUT_MS, GAME_REPLY_IDLE_TIMEOUT_MS, gameReplyTiming } from '../src/background/game-reply-timing';

assert.equal(GAME_PREPARING_TIMEOUT_MS, 180000);
assert.equal(GAME_UNCONFIRMED_TIMEOUT_MS, 180000);
assert.equal(GAME_REPLY_IDLE_TIMEOUT_MS, 360000);

const unconfirmed = { startedAt: 1000, submissionUnconfirmedAt: 1500 };
assert.deepEqual(gameReplyTiming(unconfirmed, 0, 180999), {
  lastActivityAt: 1000,
  timeoutMs: 180000,
  unconfirmedWithoutReply: true,
  timedOut: false
});
assert.equal(gameReplyTiming(unconfirmed, 0, 181000).timedOut, true);
assert.equal(gameReplyTiming(unconfirmed, 181000, 180999).timedOut, false, 'real reply activity must refresh this operation');

const longThinking = { startedAt: 1000, responseStartedAt: 180000, responseLastActivityAt: 250000, submissionUnconfirmedAt: 1500 };
assert.equal(gameReplyTiming(longThinking, 0, 609999).timedOut, false,
  'one AI thinking for more than 180 seconds may continue when its reply is active');
assert.equal(gameReplyTiming(longThinking, 0, 610000).timedOut, true);
assert.equal(gameReplyTiming(longThinking, 490000, 610000).timedOut, false,
  'a streaming reply resets only its own inactivity deadline');
assert.equal(gameReplyTiming(longThinking, 0, 500000).unconfirmedWithoutReply, false,
  'once text has arrived, the unconfirmed-send limit no longer applies');

const anotherModel = { startedAt: 500000 };
assert.equal(gameReplyTiming(anotherModel, 0, 610000).timedOut, false,
  'models have independent timeout anchors, not one shared round timer');
console.log('game per-provider 180s/360s timeouts and progress recovery tests passed');
