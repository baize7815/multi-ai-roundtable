import assert from 'node:assert/strict';
import { buildExpertPresetTransferFile, mergeExpertPresets, parseExpertPresetTransferFile, replaceExpertPresets } from '../src/sidepanel/expert-transfer';

const base = [{ id: 'expert-a', name: '孔子', prompt: '旧提示词', createdAt: 1, updatedAt: 1 }];
const exported = buildExpertPresetTransferFile(base);
assert.equal(exported.type, 'multi-ai-roundtable-expert-presets');
assert.deepEqual(exported.experts, [{ name: '孔子', prompt: '旧提示词' }]);

const parsed = parseExpertPresetTransferFile(JSON.stringify({
  type: 'multi-ai-roundtable-expert-presets',
  version: 1,
  experts: [
    { name: '孔子', prompt: '新提示词' },
    { name: '爱因斯坦', prompt: '相对论专家' }
  ]
}));
assert.equal(parsed.length, 2);

let seq = 0;
const merged = mergeExpertPresets(base, parsed, 100, () => `new-${++seq}`);
assert.equal(merged.added, 1);
assert.equal(merged.updated, 1);
assert.equal(merged.unchanged, 0);
assert.equal(merged.presets[0].id, 'expert-a', '同名导入必须保留原 preset id，避免模型绑定失效');
assert.equal(merged.presets[0].prompt, '新提示词');
assert.equal(merged.presets[1].name, '爱因斯坦');

const replaced = replaceExpertPresets(
  [{ id: 'old-a', name: '孔子', prompt: '旧', createdAt: 1, updatedAt: 1 }, { id: 'old-b', name: '旧角色', prompt: '旧', createdAt: 1, updatedAt: 1 }],
  [{ name: '孔子', prompt: '新' }, { name: '新角色', prompt: '新角色内容' }],
  200, () => 'new-role'
);
assert.deepEqual(replaced.presets.map((item) => item.name), ['孔子', '新角色']);
assert.equal(replaced.presets[0].id, 'old-a', '替换时同名角色 ID 必须不变');
assert.equal(replaced.presets[1].id, 'new-role');

assert.throws(() => parseExpertPresetTransferFile('{bad json'), /JSON 文件格式无效/);
assert.throws(() => parseExpertPresetTransferFile(JSON.stringify({ experts: [{ name: '空提示', prompt: '' }] })), /缺少名称或预设提示词/);

console.log('expert preset transfer tests passed');
