const mongoose = require('mongoose');

const GameSettingsSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  presetName: { type: String, default: "기본 설정" },

  // ★ [추가됨] 스탯 가중치 (이게 있어야 보정치가 저장됩니다!)
  statWeights: {
    str: { type: Number, default: 1.0 }, // 근력
    agi: { type: Number, default: 1.0 }, // 민첩
    int: { type: Number, default: 1.0 }, // 지능
    men: { type: Number, default: 1.0 }, // 정신
    luk: { type: Number, default: 1.0 }, // 행운
    dex: { type: Number, default: 1.0 }, // 손재주
    sht: { type: Number, default: 1.0 }, // 사격
    end: { type: Number, default: 1.0 }  // 지구력
  },

  // 💀 서든데스 설정
  suddenDeathTurn: { type: Number, default: 5 }, 
  killWeight: { type: Number, default: 0.1 }, 

  // 🚫 금지구역 설정
  forbiddenZoneStartDay: { type: Number, default: 3 },
  forbiddenZoneDamageBase: { type: Number, default: 5 },

  // 🎲 확률 설정
  baseBattleProb: { type: Number, default: 0.3 }, 
  itemSpawnRate: { type: Number, default: 0.4 }, 

  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('GameSettings', GameSettingsSchema);