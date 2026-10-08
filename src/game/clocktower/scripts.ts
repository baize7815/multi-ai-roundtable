import type { ClocktowerRoleDefinition, ClocktowerRoleId, ClocktowerRoleType } from './types';

const role = (
  id: ClocktowerRoleId,
  name: string,
  type: ClocktowerRoleType,
  publicDescription: string,
  timing: string,
  firstNightOrder?: number,
  otherNightOrder?: number
): ClocktowerRoleDefinition => ({
  id,
  name,
  type,
  alignment: type === 'minion' || type === 'demon' ? 'evil' : 'good',
  publicDescription,
  timing,
  firstNightOrder,
  otherNightOrder
});

export const TROUBLE_BREWING_ROLES: ClocktowerRoleDefinition[] = [
  role('washerwoman', '寻纹者', 'townsfolk', '首夜获知两名玩家中有一人是某个特定镇民。', '首夜', 50),
  role('librarian', '卷宗师', 'townsfolk', '首夜获知两名玩家中有一人是某个外来者；若没有外来者可获知“0”。', '首夜', 60),
  role('investigator', '影迹侦察官', 'townsfolk', '首夜获知两名玩家中有一人是某个爪牙。', '首夜', 70),
  role('chef', '邻域观测员', 'townsfolk', '首夜获知相邻邪恶玩家对数。', '首夜', 80),
  role('empath', '识心者', 'townsfolk', '每夜获知自己两侧最近的存活玩家中有几名邪恶。', '每夜', 90, 90),
  role('fortune_teller', '星轨预言者', 'townsfolk', '每夜选择两名玩家，获知其中是否至少一人注册为恶魔；另有一名善良红鲱鱼也会呈阳性。', '每夜', 100, 100),
  role('undertaker', '回溯师', 'townsfolk', '每个非首夜获知白天被处决并死亡玩家的角色。', '每夜*', undefined, 110),
  role('monk', '庇护者', 'townsfolk', '每个非首夜选择一名非自己的玩家，使其当夜免受恶魔能力杀死。', '每夜*', undefined, 30),
  role('ravenkeeper', '暮鸦信使', 'townsfolk', '若在夜间死亡，选择一名玩家并获知其角色。', '夜间死亡触发'),
  role('virgin', '无瑕证人', 'townsfolk', '第一次被提名时，若提名者注册为镇民，则提名者立即被处决。', '首次被提名'),
  role('slayer', '破咒猎手', 'townsfolk', '一局一次，白天公开选择一名玩家；若其注册为恶魔，则其死亡。', '白天一次'),
  role('soldier', '铁甲卫士', 'townsfolk', '不能被恶魔能力杀死。', '被动'),
  role('mayor', '议会长', 'townsfolk', '仅三人存活且当天无人被处决时善良获胜；夜间被恶魔攻击时，主持人可让其他玩家代死。', '被动/胜负'),

  role('butler', '侍从', 'outsider', '每夜选择一名主人；次日只有主人投票时自己才可投票。', '每夜', 120, 120),
  role('drunk', '迷醉者', 'outsider', '你不知道自己是迷醉者，而认为自己是某个镇民；你没有真实能力。', '持续'),
  role('recluse', '离群者', 'outsider', '你可能注册为邪恶、爪牙或恶魔，即使死亡后也可能如此。', '持续'),
  role('saint', '誓约守护者', 'outsider', '如果你因处决而死亡，你的阵营失败。', '被处决'),

  role('poisoner', '蚀雾师', 'minion', '每夜选择一名玩家，使其本夜与次日中毒。', '每夜', 10, 10),
  role('spy', '潜影者', 'minion', '每夜查看魔典；你可能注册为善良、镇民或外来者。', '每夜', 130, 130),
  role('scarlet_woman', '赤影继承者', 'minion', '恶魔死亡时若当时至少五人存活，你成为新的恶魔。', '恶魔死亡触发'),
  role('baron', '夜幕领主', 'minion', '开局额外加入两名外来者并减少两名镇民。', '开局'),

  role('imp', '暗焰之主', 'demon', '每个非首夜选择一名玩家死亡；若杀死自己，则一名爪牙成为新的暗焰之主。', '每夜*', undefined, 50)
];

export const TROUBLE_BREWING_ROLE_IDS = TROUBLE_BREWING_ROLES.map((item) => item.id);
export const clocktowerRoleById = Object.fromEntries(TROUBLE_BREWING_ROLES.map((item) => [item.id, item])) as Record<ClocktowerRoleId, ClocktowerRoleDefinition>;

export const ROLE_IDS_BY_TYPE = {
  townsfolk: TROUBLE_BREWING_ROLES.filter((item) => item.type === 'townsfolk').map((item) => item.id),
  outsider: TROUBLE_BREWING_ROLES.filter((item) => item.type === 'outsider').map((item) => item.id),
  minion: TROUBLE_BREWING_ROLES.filter((item) => item.type === 'minion').map((item) => item.id),
  demon: TROUBLE_BREWING_ROLES.filter((item) => item.type === 'demon').map((item) => item.id)
} satisfies Record<ClocktowerRoleType, ClocktowerRoleId[]>;

export const TROUBLE_BREWING_SCRIPT = {
  id: 'trouble-brewing' as const,
  name: '迷雾议会 · 经典身份剧本',
  minPlayers: 5,
  maxPlayers: 15,
  roles: TROUBLE_BREWING_ROLE_IDS
};
