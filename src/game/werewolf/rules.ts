import type { WerewolfRoleId, WerewolfRuleset } from './types';

const zeroRoles = (): Record<WerewolfRoleId, number> => ({ wolf: 0, villager: 0, seer: 0, witch: 0, hunter: 0 });

function rules(playerCount: 6 | 7 | 8, roleCounts: Partial<Record<WerewolfRoleId, number>>): WerewolfRuleset {
  return {
    id: `werewolf-v1-${playerCount}`,
    name: `${playerCount} 人 V1`,
    playerCount,
    roleCounts: { ...zeroRoles(), ...roleCounts },
    wolfDiscussionRounds: 2,
    wolfTiePolicy: 'revote_then_seeded_random',
    dayVoteTiePolicy: 'revote_then_no_exile',
    allowWitchSelfSaveFirstNight: true,
    allowDoublePotionSameNight: false,
    hunterCanShootWhenPoisoned: false,
    revealRoleOnDeath: false,
    wolvesMaySelfKill: true,
    nightDeathLastWords: false,
    dayExileLastWords: true,
    winCondition: 'slaughter_edge'
  };
}

export const WEREWOLF_RULESETS: WerewolfRuleset[] = [
  rules(6, { wolf: 2, seer: 1, witch: 1, villager: 2 }),
  rules(7, { wolf: 2, seer: 1, witch: 1, hunter: 1, villager: 2 }),
  rules(8, { wolf: 2, seer: 1, witch: 1, hunter: 1, villager: 3 })
];

export const WEREWOLF_RULESET_BY_ID = Object.fromEntries(WEREWOLF_RULESETS.map((item) => [item.id, item])) as Record<string, WerewolfRuleset>;

export function rulesetForPlayerCount(playerCount: number): WerewolfRuleset {
  return structuredClone(WEREWOLF_RULESETS.find((item) => item.playerCount === playerCount) ?? WEREWOLF_RULESETS[0]);
}

export const ROLE_LABELS: Record<WerewolfRoleId, string> = {
  wolf: '狼人',
  villager: '村民',
  seer: '预言家',
  witch: '女巫',
  hunter: '猎人'
};

export const ROLE_OBJECTIVES: Record<WerewolfRoleId, string> = {
  wolf: '隐藏身份，配合狼人同伴淘汰好人阵营，并尽力让狼人阵营获胜。',
  villager: '通过公开发言和投票找出狼人，帮助好人阵营获胜。',
  seer: '利用每晚查验得到的真实结果帮助好人阵营判断狼人，同时保护自己的身份。',
  witch: '谨慎使用一次解药和一次毒药，根据公开信息帮助好人阵营获胜。',
  hunter: '通过发言和投票帮助好人阵营；在符合规则的死亡情况下可选择带走一名玩家。'
};
