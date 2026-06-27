// server/scripts/migrate_dedupe_itemkey.js
// ✅ itemKey(SSOT) 중복 정리(1회성)
// - 같은 itemKey를 가진 Item을 1개(canonical)로 통합하고 참조 itemId를 치환
//
// 사용:
//   MONGO_URI=... npm run migrate:itemkey -- --dry
//   MONGO_URI=... npm run migrate:itemkey -- --apply

require('dotenv').config();
const mongoose = require('mongoose');

const Item = require('../models/Item');
const Character = require('../models/Characters');
const MapModel = require('../models/Map');
const Kiosk = require('../models/Kiosk');
const DroneOffer = require('../models/DroneOffer');
const TradeOffer = require('../models/TradeOffer');

const argv = new Set(process.argv.slice(2));
const apply = argv.has('--apply');
const dry = argv.has('--dry') || !apply;
const keepDupes = argv.has('--keep-duplicates');

function hasOwner(ownerUserId) {
  return ownerUserId !== undefined && ownerUserId !== null && String(ownerUserId).trim() !== '';
}

function ownerKey(ownerUserId) {
  return hasOwner(ownerUserId) ? String(ownerUserId) : '__legacy__';
}

function itemOwnerFilter(ownerUserId, extra = {}) {
  if (hasOwner(ownerUserId)) return { ...(extra || {}), ownerUserId };
  const legacyClause = { $or: [{ ownerUserId: null }, { ownerUserId: { $exists: false } }] };
  if (extra?.$or || extra?.$and) return { $and: [extra, legacyClause] };
  return { ...(extra || {}), ...legacyClause };
}

function score(it) {
  let s = 0;
  if (it?.lockedByAdmin) s += 1000;
  if (it?.externalId) s += 50;
  const ing = Array.isArray(it?.recipe?.ingredients) ? it.recipe.ingredients.length : 0;
  if (ing > 0) s += 80 + Math.min(ing, 8);
  s += Math.min((it?.tags?.length || 0), 10);
  s += Math.min((it?.spawnZones?.length || 0), 10);
  s += Math.min((it?.spawnCrateTypes?.length || 0), 10);
  return s;
}

function mergePatch(canon, other) {
  const patch = {};
  const mergeArr = (k) => {
    const a = Array.isArray(canon?.[k]) ? canon[k] : [];
    const b = Array.isArray(other?.[k]) ? other[k] : [];
    const u = [...new Set([...a, ...b].map(v => String(v).trim()).filter(Boolean))];
    if (u.length !== a.length) patch[k] = u;
  };
  mergeArr('tags');
  mergeArr('spawnZones');
  mergeArr('spawnCrateTypes');
  if (!canon?.description && other?.description) patch.description = other.description;
  if (!canon?.image && other?.image) patch.image = other.image;
  if (!canon?.equipSlot && other?.equipSlot) patch.equipSlot = other.equipSlot;
  if (!canon?.weaponType && other?.weaponType) patch.weaponType = other.weaponType;
  if (!(canon?.droneCreditsCost > 0) && (other?.droneCreditsCost > 0)) patch.droneCreditsCost = other.droneCreditsCost;
  const canonIng = Array.isArray(canon?.recipe?.ingredients) ? canon.recipe.ingredients.length : 0;
  const otherIng = Array.isArray(other?.recipe?.ingredients) ? other.recipe.ingredients.length : 0;
  if (canonIng === 0 && otherIng > 0) patch.recipe = other.recipe;
  return patch;
}

async function replaceRefs(ownerUserId, fromId, toId) {
  const fromStr = String(fromId);
  const ownerScoped = itemOwnerFilter(ownerUserId);
  const characterScope = hasOwner(ownerUserId) ? { userId: ownerUserId } : {};
  const tradeScope = hasOwner(ownerUserId) ? { fromUserId: ownerUserId } : {};
  const ops = [
    Item.updateMany({ ...ownerScoped, 'recipe.ingredients.itemId': fromId }, { $set: { 'recipe.ingredients.$[e].itemId': toId } }, { arrayFilters: [{ 'e.itemId': fromId }] }),
    Character.updateMany({ ...characterScope, 'inventory.itemId': fromId }, { $set: { 'inventory.$[e].itemId': toId } }, { arrayFilters: [{ 'e.itemId': fromId }] }),
    Character.updateMany({ ...characterScope, 'inventory.itemId': fromStr }, { $set: { 'inventory.$[e].itemId': toId } }, { arrayFilters: [{ 'e.itemId': fromStr }] }),
    MapModel.updateMany({ ...ownerScoped, 'itemCrates.lootTable.itemId': fromId }, { $set: { 'itemCrates.$[].lootTable.$[e].itemId': toId } }, { arrayFilters: [{ 'e.itemId': fromId }] }),
    Kiosk.updateMany({ ...ownerScoped, 'catalog.itemId': fromId }, { $set: { 'catalog.$[e].itemId': toId } }, { arrayFilters: [{ 'e.itemId': fromId }] }),
    Kiosk.updateMany({ ...ownerScoped, 'catalog.exchange.giveItemId': fromId }, { $set: { 'catalog.$[e].exchange.giveItemId': toId } }, { arrayFilters: [{ 'e.exchange.giveItemId': fromId }] }),
    DroneOffer.updateMany({ ...ownerScoped, itemId: fromId }, { $set: { itemId: toId } }),
    TradeOffer.updateMany({ ...tradeScope, 'give.itemId': fromId }, { $set: { 'give.$[e].itemId': toId } }, { arrayFilters: [{ 'e.itemId': fromId }] }),
    TradeOffer.updateMany({ ...tradeScope, 'want.itemId': fromId }, { $set: { 'want.$[e].itemId': toId } }, { arrayFilters: [{ 'e.itemId': fromId }] })
  ];
  if (dry) return;
  await Promise.allSettled(ops);
}

async function main() {
  const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!mongoUri) throw new Error('MONGO_URI가 필요합니다.');
  await mongoose.connect(mongoUri);

  try {
    const items = await Item.find({ itemKey: { $exists: true, $ne: null } })
      .select('_id ownerUserId itemKey externalId name tags recipe equipSlot weaponType spawnZones spawnCrateTypes droneCreditsCost lockedByAdmin description image')
      .lean();

    const groups = new Map();
    for (const it of items) {
      const k = String(it.itemKey || '').trim();
      if (!k) continue;
      const key = `${ownerKey(it.ownerUserId)}\t${k}`;
      if (!groups.has(key)) groups.set(key, { ownerUserId: it.ownerUserId || null, itemKey: k, items: [] });
      groups.get(key).items.push(it);
    }

    const dupGroups = [...groups.values()].filter((group) => group.items.length > 1);
    console.log(`[migrate:itemkey] dupKeys=${dupGroups.length} total=${items.length} dry=${dry}`);
    if (dupGroups.length === 0) return;

    for (const { ownerUserId, itemKey, items: arr } of dupGroups) {
      const sorted = [...arr].sort((a, b) => score(b) - score(a));
      const canon = sorted[0];
      const dupes = sorted.slice(1);

      console.log(`\n[migrate:itemkey] ${itemKey}`);
      console.log(`  owner: ${ownerKey(ownerUserId)}`);
      console.log(`  keep: ${String(canon._id)} (${canon.name})`);
      dupes.forEach(d => console.log(`  dupe: ${String(d._id)} (${d.name})`));

      if (!dry) {
        let canonDoc = await Item.findOne(itemOwnerFilter(ownerUserId, { _id: canon._id }));
        if (canonDoc) {
          for (const d of dupes) {
            const patch = mergePatch(canonDoc.toObject(), d);
            if (Object.keys(patch).length) {
              await Item.updateOne(itemOwnerFilter(ownerUserId, { _id: canon._id }), { $set: patch });
              canonDoc = await Item.findOne(itemOwnerFilter(ownerUserId, { _id: canon._id }));
            }
          }
        }
      }

      for (const d of dupes) {
        await replaceRefs(ownerUserId, d._id, canon._id);
      }

      if (!dry && !keepDupes) {
        await Item.deleteMany(itemOwnerFilter(ownerUserId, { _id: { $in: dupes.map(d => d._id) } }));
      }
    }

    if (dry) console.log('[migrate:itemkey] 실제 반영은 --apply');
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((e) => {
  console.error('[migrate:itemkey] error:', e);
  process.exit(1);
});
