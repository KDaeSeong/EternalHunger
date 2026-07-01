// server/models/Characters.js
// ★ 멀티유저 지원(2단계): userId 스코프 추가
const mongoose = require('mongoose');
const { Schema } = mongoose;

const characterSchema = new Schema({
  // ★ 어떤 유저의 캐릭터인지 (멀티유저 핵심)
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // 추가
  // 1. 기본 정보
  name: { type: String, required: true },
  previewImage: { type: String },
  summary: { type: String },
  gender: { type: String, default: '남' },
  weaponType: { type: String, default: '' },
  characterTemplateId: { type: String, default: '' },
  characterSkillCode: { type: String, default: '' },
  characterSkillLevel: { type: Number, default: 1 },
  characterSkillLevels: {
    q: { type: Number, default: 1 },
    w: { type: Number, default: 1 },
    e: { type: Number, default: 1 },
    r: { type: Number, default: 1 },
  },
  characterSkills: { type: Schema.Types.Mixed, default: {} },

  // --- 관전형 목표 세팅 ---
  // - goalGearTier: 목표 장비 등급(영웅=4, 전설=5, 초월=6)
  // - tacticalSkill: 시즌 11 일반 게임 전술 스킬(문자열)
  // - goalLoadouts: 목표 등급별(영웅/전설/초월) 슬롯별 목표 장비(itemKey) 세팅
  goalGearTier: { type: Number, default: 6 },
  tacticalSkill: { type: String, default: '블링크' },
  // 전술 스킬 레벨(런 단위): Lv.1 시작, 최대 Lv.2 (런 시작 시 1로 초기화)
  tacticalSkillLevel: { type: Number, default: 1 },
  // 이터널 리턴 이식 메타(실험체/역할/특성/사용 가능 무기)
  erSubject: { type: String, default: '' },
  erRole: { type: String, default: '' },
  erTrait: { type: String, default: '' },
  erWeapons: [{ type: String }],

  goalLoadouts: {
    hero: {
      weaponKey: { type: String, default: '' },
      headKey: { type: String, default: '' },
      clothesKey: { type: String, default: '' },
      armKey: { type: String, default: '' },
      shoesKey: { type: String, default: '' },
    },
    legend: {
      weaponKey: { type: String, default: '' },
      headKey: { type: String, default: '' },
      clothesKey: { type: String, default: '' },
      armKey: { type: String, default: '' },
      shoesKey: { type: String, default: '' },
    },
    transcend: {
      weaponKey: { type: String, default: '' },
      headKey: { type: String, default: '' },
      clothesKey: { type: String, default: '' },
      armKey: { type: String, default: '' },
      shoesKey: { type: String, default: '' },
    },
  },

  // 2. Eternal Return-style core stats
  stats: {
    maxHp: { type: Number, default: 100 },
    hpGrowth: { type: Number, default: 4 },
    attackPower: { type: Number, default: 24 },
    attackPowerGrowth: { type: Number, default: 1.4 },
    skillAmp: { type: Number, default: 0 },
    skillAmpGrowth: { type: Number, default: 1.1 },
    defense: { type: Number, default: 14 },
    defenseGrowth: { type: Number, default: 0.8 },
    attackSpeed: { type: Number, default: 0.72 },
    attackSpeedGrowth: { type: Number, default: 0.015 },
    attackRange: { type: Number, default: 1.5 },
    sightRange: { type: Number, default: 8 },
  },

  // Match runtime growth metadata. A new simulation still starts at Lv.1;
  // these fields are stored only so presets/admin tools can round-trip the shape.
  level: { type: Number, default: 1 },
  erLevel: { type: Number, default: 1 },
  masteryXp: { type: Number, default: 0 },
  weaponMasteryXp: { type: Number, default: 0 },
  weaponMasteryLevel: { type: Number, default: 1 },
  mastery: {
    weapon: { xp: { type: Number, default: 0 }, level: { type: Number, default: 1 } },
    defense: { xp: { type: Number, default: 0 }, level: { type: Number, default: 1 } },
    hunting: { xp: { type: Number, default: 0 }, level: { type: Number, default: 1 } },
    craft: { xp: { type: Number, default: 0 }, level: { type: Number, default: 1 } },
    search: { xp: { type: Number, default: 0 }, level: { type: Number, default: 1 } },
    movement: { xp: { type: Number, default: 0 }, level: { type: Number, default: 1 } },
  },

  // 인벤토리
  // - legacy: { id, name, type, tags, acquiredDay }
  // - normalized: { itemId, name, qty, ... }
  //   (로드맵 1/3/4/5 연동을 위해 itemId/qty를 추가)
  inventory: [{
    // ObjectId(정규화)도, 문자열(임시/이식)도 허용
    itemId: { type: Schema.Types.Mixed },
    qty: { type: Number, default: 1 },
    id: String,
    name: String,
    // enum 제거: 무기/장비/방어구 등 확장/이식 데이터를 허용
    type: { type: String },
    tags: [String],
    equipSlot: String,
    weaponType: String,
    tier: Number,
    grade: String,
    stats: Schema.Types.Mixed,
    acquiredDay: Number
  }],

  // 고유 스킬
  specialSkill: {
    name: { type: String, default: '평범함' },
    description: String,
    type: { type: String, enum: ['passive', 'combat', 'event'] }, // 적용 시점
    effectValue: { type: Number, default: 0 }
  },

  // 3. 명예의 전당 기록용 (누적 데이터)
  records: {
    totalKills: { type: Number, default: 0 },
    totalWins: { type: Number, default: 0 },
    gamesPlayed: { type: Number, default: 0 }, // 참가한 횟수
    deathCount: { type: Number, default: 0 }   // 사망한 횟수
  },

  // 4. 회차 계승(Legacy) 시스템
  legacy: {
    points: { type: Number, default: 0 }, // LP (레거시 포인트)
    unlockedPerks: [{ type: String }],    // 해금된 특전
    history: [{
      date: { type: Date, default: Date.now },
      rank: Number,
      killCount: Number
    }]
  },

  // 현재 캐릭터에게 적용 중인 상태 이상 목록
  activeEffects: [{
    effectId: { type: Schema.Types.ObjectId, ref: 'StatusEffect' },
    name: String,
    remainingDuration: Number, // 남은 지속 시간
    appliedAt: { type: Date, default: Date.now }
  }],

  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Character', characterSchema);
