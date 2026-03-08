// server/scripts/list_namu_items.js
// MongoDB(Item)에서 나무위키(붙여넣기 import)로 들어간 아이템을 요약 출력
// 사용:
//   node scripts/list_namu_items.js
//   node scripts/list_namu_items.js --limit 200
//   node scripts/list_namu_items.js --json ./namu_items.json

const path = require('path');
const mongoose = require('mongoose');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const Item = require('../models/Item');

function parseCli(argv) {
  const opt = { limit: 120, json: '' };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--limit') opt.limit = Number(argv[++i] || opt.limit);
    if (a === '--json') opt.json = String(argv[++i] || '');
  }
  if (!Number.isFinite(opt.limit) || opt.limit < 1) opt.limit = 120;
  return opt;
}

function groupKey(doc) {
  if (doc.type === '무기') return `weapon:${doc.weaponType || 'unknown'}`;
  if (doc.type === '방어구') return `armor:${doc.equipSlot || 'unknown'}`;
  if (doc.type === '재료') return 'material';
  return `other:${doc.type || '기타'}`;
}

async function main() {
  if (!process.env.MONGO_URI) throw new Error('MONGO_URI가 필요합니다(.env)');
  const opt = parseCli(process.argv.slice(2));

  await mongoose.connect(process.env.MONGO_URI);

  const q = {
    $or: [
      { source: 'namu' },
      { externalId: { $regex: /^namu:/ } }
    ]
  };

  const docs = await Item.find(q)
    .sort({ type: 1, weaponType: 1, equipSlot: 1, tier: 1, name: 1 })
    .lean();

  const total = docs.length;
  const groups = new Map();
  for (const d of docs) {
    const k = groupKey(d);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(d);
  }

  const summary = {
    total,
    byGroup: [...groups.entries()].map(([k, arr]) => ({
      key: k,
      count: arr.length,
      sample: arr.slice(0, 15).map(x => x.name)
    }))
  };

  // 콘솔 출력
  console.log(`NAMU items in DB: ${total}`);
  for (const g of summary.byGroup.sort((a, b) => b.count - a.count)) {
    const s = g.sample.slice(0, 10).join(', ');
    console.log(`- ${g.key}: ${g.count}${s ? ` | ${s}` : ''}`);
  }

  // 상세 목록(옵션)
  if (opt.json) {
    const fs = require('fs');
    const outPath = path.resolve(process.cwd(), opt.json);
    const payload = {
      summary,
      items: docs.slice(0, opt.limit).map(d => ({
        name: d.name,
        type: d.type,
        tier: d.tier,
        rarity: d.rarity,
        equipSlot: d.equipSlot,
        weaponType: d.weaponType,
        externalId: d.externalId,
        hasRecipe: Array.isArray(d.recipe?.ingredients) && d.recipe.ingredients.length > 0
      }))
    };
    fs.writeFileSync(outPath, JSON.stringify(payload, null, 2), 'utf-8');
    console.log(`JSON written: ${outPath}`);
  }

  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
