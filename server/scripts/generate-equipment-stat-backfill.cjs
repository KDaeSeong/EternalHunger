const fs = require('node:fs');
const path = require('node:path');
const { parseNamuStatTemplates } = require('../utils/namuItemStats');
const root = path.resolve(__dirname, '../..');
const source = require('../utils/defaultItemTree.generated.json');
const rowsByName = new Map();
for (const name of fs.readdirSync(path.join(__dirname, 'namu_pastes')).sort()) {
  if (!/^(armor_|weapon_)/.test(name) || name === 'weapon_skills.code') continue;
  // 이미 저장된 구형 아이템의 수치도 복구한다. 원본 시드에 없는 아이템은 추가하지 않는다.
  for (const row of parseNamuStatTemplates(fs.readFileSync(path.join(__dirname, 'namu_pastes', name), 'utf8'), { includeInactive: true })) {
    const rows = rowsByName.get(row.name) || [];
    rows.push(row); rowsByName.set(row.name, rows);
  }
}
const result = {};
const slotCategory = { head: '머리', clothes: '옷', arm: '팔', shoes: '다리' };
for (const item of source) {
  const key = String(item.key || item.itemKey || item.externalId || '');
  if (!key.startsWith('namu:') || !['무기', '방어구'].includes(item.type)) continue;
  const category = item.equipSlot === 'weapon' ? String(item.weaponType || '').replace(/\s/g, '') : slotCategory[item.equipSlot];
  const candidates = rowsByName.get(item.name) || [];
  const found = candidates.find(row => row.category === category || row.category.endsWith('/' + category));
  if (!found) continue;
  result[key] = { legacyStats: item.stats || {}, stats: found.stats };
}
const content = JSON.stringify(Object.fromEntries(Object.entries(result).sort(([a], [b]) => a.localeCompare(b)))) + '\n';
const output = path.join(root, 'shared/importedEquipmentStats.generated.json');
if (process.argv.includes('--check')) {
  if (fs.readFileSync(output, 'utf8') !== content) throw new Error('장비 스탯 복구 데이터를 다시 생성해야 합니다.');
} else fs.writeFileSync(output, content);
console.log(JSON.stringify({ restoredItems: Object.keys(result).length, output }));
