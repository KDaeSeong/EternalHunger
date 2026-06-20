// Print a compact summary of imported Eternal Return meta rows.
// Usage:
//   node scripts/list_er_meta.js
//   node scripts/list_er_meta.js --namespace namuSubject --limit 200
//   node scripts/list_er_meta.js --json ./er_meta.json

const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const ErMeta = require('../models/ErMeta');

function parseCli(argv) {
  const opt = { namespace: '', source: '', limit: 120, json: '' };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--namespace') opt.namespace = String(argv[++i] || '').trim();
    if (a === '--source') opt.source = String(argv[++i] || '').trim();
    if (a === '--limit') opt.limit = Number(argv[++i] || opt.limit);
    if (a === '--json') opt.json = String(argv[++i] || '').trim();
  }
  if (!Number.isFinite(opt.limit) || opt.limit < 1) opt.limit = 120;
  return opt;
}

function buildQuery(opt) {
  const q = {};
  if (opt.namespace) q.namespace = opt.namespace;
  if (opt.source) q.source = opt.source;
  return q;
}

function sampleLabel(doc) {
  const name = doc.localizedName || doc.name || doc.code;
  const weapons = Array.isArray(doc.weaponTypes) && doc.weaponTypes.length
    ? ` [${doc.weaponTypes.join(', ')}]`
    : '';
  const type = doc.type ? ` (${doc.type})` : '';
  return `${name}${type}${weapons}`;
}

async function main() {
  if (!process.env.MONGO_URI) throw new Error('MONGO_URI가 필요합니다(.env)');
  const opt = parseCli(process.argv.slice(2));
  await mongoose.connect(process.env.MONGO_URI);

  const q = buildQuery(opt);
  const docs = await ErMeta.find(q)
    .sort({ namespace: 1, localizedName: 1, name: 1, code: 1 })
    .limit(opt.limit)
    .lean();

  const summary = await ErMeta.aggregate([
    { $match: q },
    {
      $group: {
        _id: { namespace: '$namespace', source: '$source' },
        count: { $sum: 1 },
        latest: { $max: '$importedAt' }
      }
    },
    { $sort: { '_id.namespace': 1, '_id.source': 1 } }
  ]);

  console.log(`ER meta rows: ${docs.length}${opt.namespace ? ` namespace=${opt.namespace}` : ''}${opt.source ? ` source=${opt.source}` : ''}`);
  for (const row of summary) {
    console.log(`- ${row._id.namespace}/${row._id.source || 'unknown'}: ${row.count}`);
  }
  for (const doc of docs.slice(0, 30)) {
    console.log(`  ${doc.namespace}:${doc.code} ${sampleLabel(doc)}`);
  }

  if (opt.json) {
    const outPath = path.resolve(process.cwd(), opt.json);
    fs.writeFileSync(outPath, JSON.stringify({ summary, items: docs }, null, 2), 'utf-8');
    console.log(`JSON written: ${outPath}`);
  }

  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
