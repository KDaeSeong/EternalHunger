require('dotenv').config();

const mongoose = require('mongoose');
const Item = require('../models/Item');
const Kiosk = require('../models/Kiosk');
const Perk = require('../models/Perk');
const MapModel = require('../models/Map');
const DroneOffer = require('../models/DroneOffer');

async function dropIndexIfExists(collection, name) {
  const indexes = await collection.indexes();
  if (!indexes.some((idx) => idx.name === name)) return false;
  await collection.dropIndex(name);
  return true;
}

async function main() {
  if (!process.env.MONGO_URI) throw new Error('MONGO_URI is required');
  await mongoose.connect(process.env.MONGO_URI);

  const dropped = [];
  const dropTargets = [
    [Item.collection, 'externalId_1'],
    [Item.collection, 'itemKey_1'],
    [Kiosk.collection, 'kioskId_1'],
    [Perk.collection, 'code_1'],
  ];

  for (const [collection, name] of dropTargets) {
    if (await dropIndexIfExists(collection, name)) {
      dropped.push(`${collection.collectionName}.${name}`);
    }
  }

  await Item.syncIndexes();
  await Kiosk.syncIndexes();
  await Perk.syncIndexes();
  await MapModel.syncIndexes();
  await DroneOffer.syncIndexes();

  console.log(JSON.stringify({ ok: true, dropped }, null, 2));
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect().catch(() => {});
  });
