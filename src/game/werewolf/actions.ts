import type { ParsedWerewolfAction, WerewolfActionType } from './types';

const TAG_ACTION_RE = /<action>\s*([A-Z_]+)(?::\s*(\d+))?\s*<\/action>/gi;
const BRACKET_ACTION_RE = /\[\[ACTION\s*:\s*([A-Z_]+)(?::\s*(\d+))?\s*\]\]/gi;
const BARE_FINAL_ACTION_RE = /(?:^|\n)\s*(VOTE|KILL|CHECK|SAVE|POISON|SHOOT|PASS)(?::\s*(\d+))?\s*$/i;
const CHINESE_FINAL_VOTE_RE = /(?:^|\n)\s*(?:我(?:最终)?(?:选择)?投(?:票)?(?:给)?|最终(?:选择|投票)(?:给|是)?|投票(?:给)?|投)\s*(\d+)\s*号\s*[。！!]?\s*$/i;
const ACTION_NAME: Record<string, WerewolfActionType> = {
  VOTE: 'vote',
  KILL: 'kill',
  CHECK: 'check',
  SAVE: 'save',
  POISON: 'poison',
  SHOOT: 'shoot',
  PASS: 'pass'
};

export function stripMachineActions(text: string): string {
  return text
    .replace(TAG_ACTION_RE, '')
    .replace(BRACKET_ACTION_RE, '')
    .replace(BARE_FINAL_ACTION_RE, '')
    .trim();
}

export function parseWerewolfAction(text: string): ParsedWerewolfAction {
  const explicit = [
    ...[...text.matchAll(TAG_ACTION_RE)].map((match) => ({ match, index: match.index ?? -1 })),
    ...[...text.matchAll(BRACKET_ACTION_RE)].map((match) => ({ match, index: match.index ?? -1 }))
  ].sort((a, b) => a.index - b.index);
  const lastExplicit = explicit.at(-1)?.match;
  const fallback = lastExplicit ? undefined : text.match(BARE_FINAL_ACTION_RE);
  const chineseVote = lastExplicit || fallback ? undefined : text.match(CHINESE_FINAL_VOTE_RE);
  const last = lastExplicit ?? fallback;
  if (!last && chineseVote) {
    return {
      displayText: text.trim(),
      actionType: 'vote',
      targetSeat: Number(chineseVote[1]),
      rawAction: chineseVote[0]
    };
  }
  if (!last) return { displayText: text.trim() };
  const actionType = ACTION_NAME[String(last[1] ?? '').toUpperCase()];
  const targetSeat = last[2] ? Number(last[2]) : undefined;
  return {
    displayText: stripMachineActions(text),
    actionType,
    targetSeat,
    rawAction: last[0]
  };
}

export function validateWerewolfAction(input: {
  parsed: ParsedWerewolfAction;
  expected: WerewolfActionType[];
  allowedTargets: number[];
}): { ok: true } | { ok: false; error: string } {
  const { parsed, expected, allowedTargets } = input;
  if (!parsed.actionType) return { ok: false, error: '缺少合法机器动作标记' };
  if (!expected.includes(parsed.actionType)) return { ok: false, error: `当前阶段不允许 ${parsed.actionType}` };
  if (parsed.actionType === 'pass') return { ok: true };
  if (parsed.targetSeat === undefined || !Number.isInteger(parsed.targetSeat)) return { ok: false, error: '动作缺少合法座位号' };
  if (!allowedTargets.includes(parsed.targetSeat)) return { ok: false, error: `${parsed.targetSeat} 号不是当前合法目标` };
  return { ok: true };
}

export function actionInstruction(expected: WerewolfActionType[], allowedTargets: number[]): string {
  const targetHint = allowedTargets.length ? `合法目标座位：${allowedTargets.join('、')}。` : '';
  const examples = expected.map((type) => {
    if (type === 'pass') return '[[ACTION:PASS]]';
    const token = type.toUpperCase();
    return `[[ACTION:${token}:${allowedTargets[0] ?? 1}]]`;
  });
  return `【严格输出协议】整个回复只能包含一行机器动作，禁止解释、理由、Markdown、代码块、前后缀或任何其他文字。${targetHint}\n唯一合法格式：${examples.join(' 或 ')}。`;
}
