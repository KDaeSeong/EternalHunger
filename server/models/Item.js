// server/models/Item.js
// 아이템 스키마(로드맵 1, 3~5번 연동)
// - admin/items UI는 value를 사용하고,
// - public/kiosks/drone 쪽은 baseCreditValue를 참조하는 코드가 많아서
//   두 필드를 동시에 유지하며 자동 동기화합니다.

const mongoose = require('mongoose');

const ItemSchema = new mongoose.Schema({
  // 외부/클라이언트에서 만든 아이템을 DB에 저장할 때 사용하는 식별자
  // - 시뮬레이션 랜덤 장비는 itemId(wpn_..., eq_...)를 externalId로 저장
  // - 관리자/기본 트리 아이템은 externalId 없이 ObjectId(_id)로만 관리 가능
  // ⚠️ default를 ''로 두면 모든 문서가 ''를 갖게 되어 unique index가 깨질 수 있으니
  // 기본값은 "없음"(undefined)으로 둡니다.
  externalId: { type: String, default: undefined },

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
    hp: { type: Number, default: 0 },
    // ✅ 시뮬레이션 장비(랜덤) 확장 스탯
    skillAmp: { type: Number, default: 0 },
    atkSpeed: { type: Number, default: 0 },
    critChance: { type: Number, default: 0 },
    cdr: { type: Number, default: 0 },
    lifesteal: { type: Number, default: 0 },
    moveSpeed: { type: Number, default: 0 }
  },

  // ✅ 장비 메타(시뮬/드랍/조합 등에서 사용)
  equipSlot: { type: String, default: '' }, // weapon/head/clothes/arm/shoes
  weaponType: { type: String, default: '' },
  archetype: { type: String, default: '' },

  // ✅ 생성 출처(디버그/정리용)
  source: { type: String, default: '' }, // e.g. 'simulation'
  generatedByUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  generatedAt: { type: Date, default: null },

  // ✅ 관리자 잠금: 시뮬/자동 업서트가 이 아이템을 덮어쓰지 못하게 함
  lockedByAdmin: { type: Boolean, default: false },

  description: { type: String, default: '' },
  image: { type: String, default: '' },

  createdAt: { type: Date, default: Date.now }
});

// value <-> baseCreditValue 동기화
// NOTE: Mongoose 9부터 pre middleware에서 next() 콜백을 더 이상 지원하지 않음.
//       (next 파라미터가 전달되지 않아 `next is not a function`이 발생)
//       => 동기 로직은 그냥 실행하고, 에러는 throw로 전파.
ItemSchema.pre('validate', function syncCreditValues() {
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

  // externalId 정리
  if (typeof this.externalId === 'string') {
    this.externalId = this.externalId.trim();
    if (!this.externalId) this.externalId = undefined;
  }

  // 안전장치
  if (!Number.isFinite(this.tier) || this.tier < 1) this.tier = 1;
  if (!Number.isFinite(this.stackMax) || this.stackMax < 1) this.stackMax = 1;
  if (!Number.isFinite(this.value)) this.value = 0;
  if (!Number.isFinite(this.baseCreditValue)) this.baseCreditValue = this.value;
});

// externalId는 있으면 유니크(없어도 되는 필드이므로 sparse)
ItemSchema.index({ externalId: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model('Item', ItemSchema);
