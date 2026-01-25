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

  // 2. 8대 스탯 (Deep Stats)
  stats: {
    str: { type: Number, default: 10 }, // 근력
    agi: { type: Number, default: 10 }, // 민첩
    int: { type: Number, default: 10 }, // 지능
    men: { type: Number, default: 10 }, // 정신
    luk: { type: Number, default: 10 }, // 행운
    dex: { type: Number, default: 10 }, // 손재주
    sht: { type: Number, default: 10 }, // 사격
    end: { type: Number, default: 10 }, // 지구력
  },

  // 인벤토리
  inventory: [{
    id: String,
    name: String,
    type: { type: String, enum: ['food', 'weapon', 'misc'] },
    tags: [String],
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
