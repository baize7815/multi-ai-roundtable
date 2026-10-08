import type { CouncilRoleDefinition, CouncilRoleId } from './types';

export const COUNCIL_ROLES: readonly CouncilRoleDefinition[] = [
  { id: 'calibrator', name: '定标师', faction: 'clarity', description: '每轮收到唯一的正确频道信号。' },
  { id: 'dual-track', name: '双轨师', faction: 'clarity', description: '每轮收到含正确频道的两个候选。' },
  { id: 'filter', name: '排误师', faction: 'clarity', description: '每轮收到一个确定错误的频道。' },
  { id: 'wave-scout', name: '巡波师', faction: 'clarity', description: '每轮收到一条约 75% 可靠的单频道观测。' },
  { id: 'coordinator', name: '协调师', faction: 'clarity', description: '奇数轮获得双候选，偶数轮获得精确信号。' },
  { id: 'line-keeper', name: '守线员', faction: 'clarity', description: '每轮获知正确频道属于 B 还是 A/C 组合。' },
  { id: 'fog-weaver', name: '雾织者', faction: 'mist', description: '知晓正确频道，尝试在公开讨论中误导议会。' },
  { id: 'noise-caster', name: '噪讯师', faction: 'mist', description: '知晓正确频道，尝试在公开讨论中误导议会。' }
] as const;

export const COUNCIL_ROLE_BY_ID = Object.fromEntries(COUNCIL_ROLES.map(role => [role.id, role])) as Record<CouncilRoleId, CouncilRoleDefinition>;
