require('dotenv').config();

const mongoose = require('mongoose');
const User = require('../models/User');
const Character = require('../models/Characters');

function argValue(name) {
  const idx = process.argv.indexOf(`--${name}`);
  if (idx < 0) return '';
  return String(process.argv[idx + 1] || '').trim();
}

function bihyungTemplate() {
  return {
    name: '\uBE44\uD615',
    gender: '\uB0A8\uC131',
    summary: 'Sample character for the first character-skill runtime. Q is active through characterSkillCode=bihyung.',
    weaponType: '\uD22C\uCC99',
    characterTemplateId: 'bihyung',
    characterSkillCode: 'bihyung',
    characterSkillLevel: 1,
    characterSkillLevels: { q: 1, w: 1, e: 1, r: 1 },
    characterSkills: {
      q: {
        enabled: true,
        type: 'basic_attack_recast',
        name: '\uB3C4\uAE68\uBE44 \uC7A5\uB09C',
        cooldownSec: 7,
        recastWindowSec: 5,
        radius: 1,
        firstFlat: [10, 20, 30, 40, 50],
        secondFlat: [20, 30, 40, 50, 60],
        secondMaxHpPct: [0, 0, 0, 0, 0],
        secondCurrentHpPct: [1, 1, 2, 2, 3],
        firstSkillAmpScale: 0,
        secondSkillAmpScale: 0,
        sourceText: '\uC801 1\uC778\uC5D0\uAC8C 10/20/30/40/50 \uD53C\uD574, 5\uCD08 \uC548\uC5D0 \uD55C\uBC88 \uB354 \uBC1C\uB3D9\uD558\uBA74 20/30/40/50/60, \uBC94\uC704 1, \uD604\uC7AC \uCCB4\uB825\uC758 1/1/2/2/3\uD37C\uC13C\uD2B8 \uCD94\uAC00 \uD53C\uD574',
      },
    },
    erSubject: 'bihyung',
    erRole: 'trickster',
    erTrait: 'sprint',
    erWeapons: ['\uD22C\uCC99'],
    goalGearTier: 4,
    stats: {
      maxHp: 106,
      hpGrowth: 4,
      attackPower: 25,
      attackPowerGrowth: 1.3,
      skillAmp: 18,
      skillAmpGrowth: 1.6,
      defense: 15,
      defenseGrowth: 0.8,
      attackSpeed: 0.78,
      attackSpeedGrowth: 0.018,
      attackRange: 4.8,
      sightRange: 8.4,
    },
  };
}

async function main() {
  const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!mongoUri) throw new Error('MONGO_URI is required');

  const usernameArg = argValue('username') || 'eptjd4658';
  const userIdArg = argValue('userId');

  await mongoose.connect(mongoUri);

  const user = userIdArg
    ? await User.findById(userIdArg).select('_id username').lean()
    : await User.findOne({ username: usernameArg }).select('_id username').lean();

  if (!user) throw new Error(`User not found: ${userIdArg || usernameArg}`);

  const payload = bihyungTemplate();
  const existing = await Character.findOne({
    userId: user._id,
    $or: [
      { characterTemplateId: 'bihyung' },
      { characterSkillCode: 'bihyung' },
      { erSubject: 'bihyung' },
      { name: payload.name },
    ],
  });

  const character = existing
    ? await Character.findOneAndUpdate(
      { _id: existing._id, userId: user._id },
      { $set: payload },
      { new: true, runValidators: true }
    )
    : await new Character({ ...payload, userId: user._id }).save();

  console.log(JSON.stringify({
    ok: true,
    action: existing ? 'updated' : 'created',
    username: user.username,
    userId: String(user._id),
    characterId: String(character._id),
    characterTemplateId: character.characterTemplateId,
    characterSkillCode: character.characterSkillCode,
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
