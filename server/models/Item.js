// server/models/Item.js
// 아이템 스키마(로드맵 1, 3~5번 연동)
// - admin/items UI는 value를 사용하고,
// - public/kiosks/drone 쪽은 baseCreditValue를 참조하는 코드가 많아서
//   두 필드를 동시에 유지하며 자동 동기화합니다.

const mongoose = require('mongoose');

const ItemSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },

  // 분류
  type: { type: String, enum: ['무기', '방어구', '소모품', '재료', '기타'], default: '기타' },
  tags: { type: [String], default: [] },

  // 희귀도/티어
  rarity: { type: String, default: 'common' },
  tier: { type: Number, default: 1 },

  // 스택/가치(크레딧 기준값)
  stackMax: { type: Number, default: 1 },
  value: { type: Number, default: 0 },          // (레거시/UI 호환) 판매/교환 기준값
  baseCreditValue: { type: Number, default: 0 }, // (서버 기본) 판매/보상 기준값

  // 조합 레시피(로드맵 1-2)
  recipe: {
    ingredients: [{
      itemId: { type: mongoose.Schema.Types.ObjectId, ref: 'Item' },
      qty: { type: Number, default: 1 }
    }],
    creditsCost: { type: Number, default: 0 },
    resultQty: { type: Number, default: 1 }
  },

  // 전투/효과 스탯(선택)
  stats: {
    atk: { type: Number, default: 0 },
    def: { type: Number, default: 0 },
    hp: { type: Number, default: 0 }
  },

  description: { type: String, default: '' },
  image: { type: String, default: '' },

  createdAt: { type: Date, default: Date.now }
});

// value <-> baseCreditValue 동기화
ItemSchema.pre('validate', function syncCreditValues(next) {
  try {
    if (typeof this.value === 'number' && (this.baseCreditValue === undefined || this.baseCreditValue === null)) {
      this.baseCreditValue = this.value;
    }
    if (typeof this.baseCreditValue === 'number' && (this.value === undefined || this.value === null)) {
      this.value = this.baseCreditValue;
    }
    // 둘 다 들어오면 value를 우선으로 맞춤(관리 UI 기준)
    if (typeof this.value === 'number' && typeof this.baseCreditValue === 'number') {
      this.baseCreditValue = this.value;
    }

    // tags 정리
    if (Array.isArray(this.tags)) {
      this.tags = [...new Set(this.tags.map(t => String(t).trim()).filter(Boolean))];
    }

    // 안전장치
    if (!Number.isFinite(this.tier) || this.tier < 1) this.tier = 1;
    if (!Number.isFinite(this.stackMax) || this.stackMax < 1) this.stackMax = 1;
    if (!Number.isFinite(this.value)) this.value = 0;
    if (!Number.isFinite(this.baseCreditValue)) this.baseCreditValue = this.value;

    next();
  } catch (e) {
    next(e);
  }
});

module.exports = mongoose.model('Item', ItemSchema);
