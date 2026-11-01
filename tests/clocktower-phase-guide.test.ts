import assert from 'node:assert/strict';
import { clocktowerPhaseGuide } from '../src/game/clocktower/phase-guide';
import type { ClocktowerPendingHumanAction } from '../src/game/clocktower/types';

const pending = {
  kind: 'whisper',
  metadata: { mode: 'init' },
  expectedActions: ['whisper', 'pass']
} as unknown as ClocktowerPendingHumanAction;
const guidance = clocktowerPhaseGuide('day_whispers', pending);
assert.match(guidance, /可选私聊/);
assert.match(guidance, /跳过/);
assert.match(guidance, /公开讨论/);
assert.match(guidance, /不是夜间角色技能/);

const reply = clocktowerPhaseGuide('day_whispers',
  { ...pending, metadata: { mode: 'reply' }, expectedActions: [] });
assert.match(reply, /只有你和对方可见/);
assert.match(clocktowerPhaseGuide('day_discussion'), /所有玩家可见/);
assert.match(clocktowerPhaseGuide('nomination'), /公开提名/);
assert.match(clocktowerPhaseGuide('first_night'), /夜间角色行动/);
console.log('clocktower night-to-day whisper, public discussion and phase guidance tests passed');
