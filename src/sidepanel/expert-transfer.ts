import type { ExpertPreset } from '../shared/types';

export interface PortableExpertPreset {
  name: string;
  prompt: string;
}

export interface ExpertPresetTransferFile {
  type: 'multi-ai-roundtable-expert-presets';
  version: 1;
  exportedAt: string;
  experts: PortableExpertPreset[];
}

export function buildExpertPresetTransferFile(presets: ExpertPreset[]): ExpertPresetTransferFile {
  return {
    type: 'multi-ai-roundtable-expert-presets',
    version: 1,
    exportedAt: new Date().toISOString(),
    experts: presets.map(({ name, prompt }) => ({ name, prompt }))
  };
}

export function parseExpertPresetTransferFile(text: string): PortableExpertPreset[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('JSON 文件格式无效。');
  }

  const rawExperts = Array.isArray(parsed)
    ? parsed
    : parsed && typeof parsed === 'object' && Array.isArray((parsed as { experts?: unknown }).experts)
      ? (parsed as { experts: unknown[] }).experts
      : undefined;

  if (!rawExperts) throw new Error('JSON 中没有找到 experts 专家列表。');
  if (rawExperts.length === 0) throw new Error('JSON 中没有可导入的专家。');
  if (rawExperts.length > 500) throw new Error('单次最多导入 500 个专家。');

  const deduped = new Map<string, PortableExpertPreset>();
  rawExperts.forEach((item, index) => {
    if (!item || typeof item !== 'object') throw new Error(`第 ${index + 1} 个专家格式无效。`);
    const name = typeof (item as { name?: unknown }).name === 'string' ? (item as { name: string }).name.trim() : '';
    const prompt = typeof (item as { prompt?: unknown }).prompt === 'string' ? (item as { prompt: string }).prompt.trim() : '';
    if (!name || !prompt) throw new Error(`第 ${index + 1} 个专家缺少名称或预设提示词。`);
    if (name.length > 60) throw new Error(`第 ${index + 1} 个专家名称超过 60 个字符。`);
    if (prompt.length > 500_000) throw new Error(`第 ${index + 1} 个专家提示词过长。`);
    deduped.set(name.toLocaleLowerCase(), { name, prompt });
  });

  return [...deduped.values()];
}

export function mergeExpertPresets(
  existing: ExpertPreset[],
  incoming: PortableExpertPreset[],
  now: number,
  createId: () => string
): { presets: ExpertPreset[]; added: number; updated: number; unchanged: number } {
  const presets = existing.map((preset) => ({ ...preset }));
  const byName = new Map(presets.map((preset, index) => [preset.name.trim().toLocaleLowerCase(), index]));
  let added = 0;
  let updated = 0;
  let unchanged = 0;

  for (const item of incoming) {
    const key = item.name.trim().toLocaleLowerCase();
    const index = byName.get(key);
    if (index === undefined) {
      presets.push({ id: createId(), name: item.name, prompt: item.prompt, createdAt: now, updatedAt: now });
      byName.set(key, presets.length - 1);
      added += 1;
      continue;
    }

    const current = presets[index];
    if (current.name === item.name && current.prompt === item.prompt) {
      unchanged += 1;
      continue;
    }
    presets[index] = { ...current, name: item.name, prompt: item.prompt, updatedAt: now };
    updated += 1;
  }

  return { presets, added, updated, unchanged };
}
