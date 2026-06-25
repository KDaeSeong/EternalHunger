require('dotenv').config();

const mongoose = require('mongoose');
const User = require('../models/User');
const Item = require('../models/Item');
const MapModel = require('../models/Map');
const Kiosk = require('../models/Kiosk');
const DroneOffer = require('../models/DroneOffer');
const Perk = require('../models/Perk');

function argValue(name) {
  const idx = process.argv.indexOf(`--${name}`);
  if (idx < 0) return '';
  return String(process.argv[idx + 1] || '').trim();
}

function legacyFilter() {
  return {
    $or: [
      { ownerUserId: null },
      { ownerUserId: { $exists: false } },
    ],
  };
}

async function updateLegacy(Model, ownerUserId) {
  const result = await Model.updateMany(legacyFilter(), { $set: { ownerUserId } });
  return Number(result?.modifiedCount || 0);
}

async function main() {
  if (!process.env.MONGO_URI) throw new Error('MONGO_URI is required');

  const userIdArg = argValue('userId');
  const usernameArg = argValue('username');
  if (!userIdArg && !usernameArg) {
    throw new Error('Usage: node scripts/claim_legacy_admin_scope.js --username <name> OR --userId <id>');
  }

  await mongoose.connect(process.env.MONGO_URI);

  const user = userIdArg
    ? await User.findById(userIdArg).select('_id username isAdmin').lean()
    : await User.findOne({ username: usernameArg }).select('_id username isAdmin').lean();

  if (!user) throw new Error('Target user not found');

  const ownerUserId = user._id;
  const modified = {
    items: await updateLegacy(Item, ownerUserId),
    maps: await updateLegacy(MapModel, ownerUserId),
    kiosks: await updateLegacy(Kiosk, ownerUserId),
    droneOffers: await updateLegacy(DroneOffer, ownerUserId),
    perks: await updateLegacy(Perk, ownerUserId),
  };

  console.log(JSON.stringify({
    ok: true,
    ownerUserId: String(ownerUserId),
    username: user.username,
    modified,
  }, null, 2));
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect().catch(() => {});
  });
