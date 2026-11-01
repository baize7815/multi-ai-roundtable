import type { ClocktowerPendingHumanAction, ClocktowerPhase } from './types';

/** Human-facing explanations of the scripted day/night sequence. */
export function clocktowerPhaseGuide(phase: ClocktowerPhase, pending?: ClocktowerPendingHumanAction): string {
  if (phase === 'day_whispers') {
    if (pending?.kind === 'whisper' && pending.metadata?.mode === 'reply')
      return '这是对方发给你的私人消息。请在下方回复；内容只有你和对方可见。私聊结束后才进入全体公开讨论。';
    return '当前是白天的可选私聊，不是夜间角色技能。可以输入私聊内容并选择一名玩家，也可以跳过。所有玩家完成后进入全体公开讨论，你还会有公开发言回合。';
  }
  if (phase === 'day_discussion')
    return '当前是全体公开讨论。下方输入的内容会对所有玩家可见；这不是私聊。';
  if (phase === 'first_night' || phase === 'other_night')
    return '当前是夜间角色行动，相关操作和结果仅对有权限的玩家可见。';
  if (phase === 'nomination')
    return '当前是公开提名阶段。每名存活玩家可按规则提名一次，或选择跳过。';
  if (phase === 'accusation' || phase === 'defense')
    return '当前是公开指控或辩护阶段。下方发言会对全体玩家可见。';
  if (phase === 'vote')
    return '当前是公开投票阶段。请选择是否投票，系统会统一计票。';
  return '';
}
