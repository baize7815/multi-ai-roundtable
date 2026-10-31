import type { ClocktowerActionType, ParsedClocktowerAction } from './types';

// Provider DOM is converted back to Markdown before reaching the engine.
// That conversion escapes underscores, so CHOOSE_PLAYER can arrive as
// CHOOSE\_PLAYER. Accept both forms while keeping the wire protocol unchanged.
const ACTION_RE = /\[\[ACTION\s*:\s*([A-Z_\\]+)(?::\s*([0-9,]+|YES|NO))?\s*\]\]/gi;

const ACTION_MAP: Record<string, ClocktowerActionType> = {
  CHOOSE_PLAYER: 'choose_player',
  CHOOSE_PLAYERS: 'choose_players',
  NOMINATE: 'nominate',
  VOTE_YES: 'vote_yes',
  VOTE_NO: 'vote_no',
  SLAY: 'slay',
  WHISPER: 'whisper',
  PASS: 'pass'
};

export function parseClocktowerAction(text: string): ParsedClocktowerAction {
  ACTION_RE.lastIndex = 0;
  let last: RegExpExecArray | undefined;
  for (let match = ACTION_RE.exec(text); match; match = ACTION_RE.exec(text)) last = match;
  if (!last) return { displayText: text.trim() };
  const actionType = ACTION_MAP[last[1].replace(/\\/g, '').toUpperCase()];
  if (!actionType) return { displayText: text.trim() };
  const targets = last[2] && /^\d+(?:,\d+)*$/.test(last[2])
    ? last[2].split(',').map(Number)
    : undefined;
  const displayText = text.replace(last[0], '').trim();
  return { displayText, actionType, targetSeats: targets, rawAction: last[0] };
}

export function validateClocktowerAction(input: {
  parsed: ParsedClocktowerAction;
  expected: ClocktowerActionType[];
  allowedTargets: number[];
  minTargets: number;
  maxTargets: number;
}): { ok: true } | { ok: false; error: string } {
  const { parsed, expected, allowedTargets, minTargets, maxTargets } = input;
  if (!parsed.actionType) return { ok: false, error: '缺少机器动作' };
  if (!expected.includes(parsed.actionType)) return { ok: false, error: '当前阶段不允许该动作' };
  const targets = parsed.targetSeats ?? [];
  if (targets.length < minTargets || targets.length > maxTargets) return { ok: false, error: `目标数量必须为 ${minTargets}–${maxTargets}` };
  if (targets.some((seat) => !allowedTargets.includes(seat))) return { ok: false, error: '包含非法目标' };
  if (new Set(targets).size !== targets.length) return { ok: false, error: '目标不能重复' };
  return { ok: true };
}

export function strictClocktowerActionInstruction(expected: ClocktowerActionType[], minTargets: number, maxTargets: number, allowedTargets: number[]): string {
  const targetHint = allowedTargets.length ? `合法目标座位：${allowedTargets.join('、')}。` : '';
  const examples: string[] = [];
  const first = allowedTargets[0] ?? 1;
  const second = allowedTargets.find((seat) => seat !== first) ?? first;
  if (expected.includes('choose_player')) examples.push(`[[ACTION:CHOOSE_PLAYER:${first}]]`);
  if (expected.includes('choose_players')) examples.push(`[[ACTION:CHOOSE_PLAYERS:${first},${second}]]`);
  if (expected.includes('nominate')) examples.push(`[[ACTION:NOMINATE:${first}]]`);
  if (expected.includes('slay')) examples.push(`[[ACTION:SLAY:${first}]]`);
  if (expected.includes('whisper')) examples.push(`[[ACTION:WHISPER:${first}]]`);
  if (expected.includes('vote_yes')) examples.push('[[ACTION:VOTE_YES]]');
  if (expected.includes('vote_no')) examples.push('[[ACTION:VOTE_NO]]');
  if (expected.includes('pass')) examples.push('[[ACTION:PASS]]');
  return `【严格机器动作】只能在回复最后附一个动作标记；若当前阶段要求纯动作，则回复只能有这一行。目标数 ${minTargets}–${maxTargets}。${targetHint}\n允许格式：${examples.join(' 或 ')}`;
}
