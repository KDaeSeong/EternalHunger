// server/models/StatusEffect.js
const mongoose = require('mongoose');
const { Schema } = mongoose;

const StatusEffectSchema = new Schema({
  name: { type: String, required: true, unique: true }, // 효과 이름 (예: 식중독)
  type: { type: String, enum: ['buff', 'debuff'], required: true },
  description: String,

  // 1. 스탯 변화량 (기획서 2.2절 기반)
  // 예: { str: 20, agi: 10 }
  statModifiers: {
    str: { type: Number, default: 0 },
    agi: { type: Number, default: 0 },
    int: { type: Number, default: 0 },
    men: { type: Number, default: 0 },
    luk: { type: Number, default: 0 },
    dex: { type: Number, default: 0 },
    sht: { type: Number, default: 0 },
    end: { type: Number, default: 0 },
  },

  // 2. 특수 효과 태그
  // 예: ['no_escape', 'no_sleep', 'fixed_accuracy']
  specialTags: [{ type: String }],

  // 3. 지속 시간 (Phase 단위: 아침/밤)
  // -1이면 치료 전까지 영구 지속
  duration: { type: Number, default: 1 },

  // 4. 매 턴 발생하는 효과 (DOT 데미지 등)
  tickEffect: {
    hpChange: { type: Number, default: 0 }, // 매 턴 체력 변화
  }
});

module.exports = mongoose.model('StatusEffect', StatusEffectSchema);