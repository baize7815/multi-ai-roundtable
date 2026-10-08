import { COUNCIL_CHANNELS } from './core';
import type { CouncilChannel } from './types';

export type CouncilMachineAction =
  | { type: 'vote'; channel: CouncilChannel }
  | { type: 'speech'; text: string };

const VOTE_RE = /^\[\[COUNCIL:VOTE:([ABC])\]\]$/;
const SPEECH_RE = /^\[\[COUNCIL:SPEAK\]\]$/;

export function parseCouncilFinalAnswer(text: string, stage: 'debate' | 'ballot'): CouncilMachineAction {
  const trimmed = text.trim();
  if (stage === 'ballot') {
    const match = trimmed.match(VOTE_RE);
    if (!match || !COUNCIL_CHANNELS.includes(match[1] as CouncilChannel)) {
      throw new Error('密封表决只允许 [[COUNCIL:VOTE:A/B/C]] 形式，不能附带其他文字');
    }
    return { type: 'vote', channel: match[1] as CouncilChannel };
  }
  const rows = trimmed.split(/\r?\n/);
  if (rows.at(-1)?.trim() !== '[[COUNCIL:SPEAK]]') throw new Error('发言结尾必须有 [[COUNCIL:SPEAK]]');
  const prose = rows.slice(0, -1).join('\n').trim();
  if (!prose || prose.length > 1500 || SPEECH_RE.test(prose)) throw new Error('发言长度或机器动作有误');
  return { type: 'speech', text: prose };
}
