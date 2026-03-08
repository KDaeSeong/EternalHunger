// server/scripts/ensure_itemkey_unique_index.js
// ✅ Item.itemKey unique 인덱스 적용(중복 재발 방지)
// 사용:
//   MONGO_URI=... npm run index:itemkey

require('dotenv').config();
const mongoose = require('mongoose');
const Item = require('../models/Item');

async function main() {
  const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!mongoUri) throw new Error('MONGO_URI가 필요합니다.');
  await mongoose.connect(mongoUri);

  try {
    const idx = await Item.collection.indexes();
    const existing = idx.find((x) => x?.name === 'itemKey_1');
    if (existing && !existing.unique) {
      console.log('[index:itemkey] drop old index itemKey_1');
      await Item.collection.dropIndex('itemKey_1');
    }

    console.log('[index:itemkey] create unique index itemKey_1');
    await Item.collection.createIndex(
      { itemKey: 1 },
      {
        name: 'itemKey_1',
        unique: true,
        partialFilterExpression: { itemKey: { $type: 'string', $ne: '' } }
      }
    );
    console.log('[index:itemkey] OK');
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((e) => {
  console.error('[index:itemkey] error:', e?.message || e);
  console.error('중복 itemKey가 남아있다면 먼저: npm run migrate:itemkey -- --apply');
  process.exit(1);
});
