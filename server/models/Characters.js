// server/models/Character.js (업그레이드 버전)
const mongoose = require('mongoose');
const { Schema } = mongoose;

const characterSchema = new Schema({
  // 1. 기본 정보
  name: { type: String, required: true },
  previewImage: { type: String },
  summary: { type: String },
  gender: { type: String, default: '남' },
  
  // 로그인 기능 도입 시 사용 (현재는 비워둠)
  creatorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User',timestamps: true },

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

  // ★ 인벤토리 필드 추가
  inventory: [{
    id: String,
    name: String,
    type: { type: String, enum: ['food', 'weapon', 'misc'] },
    tags: [String],
    acquiredDay: Number
  }],

  // ★ 고유 스킬 추가
  specialSkill: {
    name: { type: String, default: "평범함" },
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
    history: [{                           // 과거 기록
        date: { type: Date, default: Date.now },
        rank: Number,
        killCount: Number
    }]
  },

  // ★ 현재 캐릭터에게 적용 중인 상태 이상 목록
  activeEffects: [{
    effectId: { type: Schema.Types.ObjectId, ref: 'StatusEffect' },
    name: String,
    remainingDuration: Number, // 남은 지속 시간
    appliedAt: { type: Date, default: Date.now }
  }],

  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Character', characterSchema);