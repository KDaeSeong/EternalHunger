const TCG_GAME_SLUG = 'dual-academy-tcg';

const TCG_DECK_RULES = {
  minCards: 8,
  maxCards: 20,
  maxCopies: 3,
};

const TCG_CARDS = [
  {
    id: 'GEH-HINA-01',
    name: '소라사키 히나',
    role: 'Unit',
    cost: 7,
    attack: 5,
    health: 5,
    text: 'v13 원본: 자기 피해를 전제로 전장을 정리하는 게헨나 에이스입니다. 간소화 룰에서는 관통 유닛으로 동작합니다.',
    tone: 'red',
    rarity: 'legendary',
    keywords: ['pierce'],
    tags: ['v13', 'gehenna', 'monster', 'ace'],
    sourceId: 'GEH-HINA-01',
    academy: '게헨나',
  },
  {
    id: 'GEH-SEINA-01',
    name: '히무로 세나',
    role: 'Unit',
    cost: 5,
    attack: 3,
    health: 4,
    text: 'v13 원본: 응급의학부 소생/파괴 방지 효과. 간소화 룰에서는 안정적인 중형 유닛입니다.',
    tone: 'green',
    rarity: 'rare',
    keywords: [],
    tags: ['v13', 'gehenna', 'monster', 'medical'],
    sourceId: 'GEH-SEINA-01',
    academy: '게헨나',
  },
  {
    id: 'GEH-TUNE-01',
    name: '행정 튜너 이부키',
    role: 'Unit',
    cost: 3,
    attack: 2,
    health: 3,
    text: 'v13 원본: 게헨나 서치와 레벨 조정 튜너. 간소화 룰에서는 속공 유닛으로 동작합니다.',
    tone: 'red',
    rarity: 'common',
    keywords: ['quick'],
    tags: ['v13', 'gehenna', 'monster', 'tuner'],
    sourceId: 'GEH-TUNE-01',
    academy: '게헨나',
  },
  {
    id: 'GEH-FIELD-01',
    name: '규율의 불문율',
    role: 'Tactic',
    cost: 3,
    attack: 0,
    health: 0,
    text: 'v13 원본: 게헨나 필드 마법. 간소화 룰에서는 상대 본부에 3 피해를 줍니다.',
    tone: 'red',
    rarity: 'rare',
    keywords: [],
    tags: ['v13', 'gehenna', 'spell', 'field'],
    effect: 'damage',
    effectAmount: 3,
    sourceId: 'GEH-FIELD-01',
    academy: '게헨나',
  },
  {
    id: 'TRI-MIKA-01',
    name: '미소노 미카',
    role: 'Unit',
    cost: 7,
    attack: 6,
    health: 4,
    text: 'v13 원본: 전투 중 ATK 상승과 카운터 성향. 간소화 룰에서는 강한 관통 유닛입니다.',
    tone: 'gold',
    rarity: 'legendary',
    keywords: ['pierce'],
    tags: ['v13', 'trinity', 'monster', 'ace'],
    sourceId: 'TRI-MIKA-01',
    academy: '트리니티',
  },
  {
    id: 'TRI-TUNE-01',
    name: '예지 튜너 세이아',
    role: 'Unit',
    cost: 4,
    attack: 3,
    health: 4,
    text: 'v13 원본: 덱 조작과 대상 보호 튜너. 간소화 룰에서는 보호막 키워드를 가진 유닛입니다.',
    tone: 'violet',
    rarity: 'rare',
    keywords: ['shield'],
    shield: true,
    tags: ['v13', 'trinity', 'monster', 'tuner'],
    sourceId: 'TRI-TUNE-01',
    academy: '트리니티',
  },
  {
    id: 'TRI-NORMAL-01',
    name: '정의의 집행',
    role: 'Tactic',
    cost: 3,
    attack: 0,
    health: 0,
    text: 'v13 원본: 상대 몬스터 1장을 파괴합니다. 간소화 룰에서는 상대 최약 유닛을 제거합니다.',
    tone: 'gold',
    rarity: 'rare',
    keywords: [],
    tags: ['v13', 'trinity', 'spell', 'removal'],
    effect: 'destroy-enemy-unit',
    effectId: 'E_DESTROY_OPP_MONSTER',
    sourceId: 'TRI-NORMAL-01',
    academy: '트리니티',
  },
  {
    id: 'TRI-COUNTER-01',
    name: '성역의 반증',
    role: 'Tactic',
    cost: 2,
    attack: 0,
    health: 0,
    text: 'v13 원본: 카운터 함정. 간소화 룰에서는 아군 유닛 하나에게 보호막을 부여합니다.',
    tone: 'blue',
    rarity: 'rare',
    keywords: ['shield'],
    tags: ['v13', 'trinity', 'trap', 'counter'],
    effect: 'shield',
    sourceId: 'TRI-COUNTER-01',
    academy: '트리니티',
  },
  {
    id: 'MIL-YUUKA-01',
    name: '하야세 유우카',
    role: 'Unit',
    cost: 4,
    attack: 3,
    health: 5,
    text: 'v13 원본: 밀레니엄 서치와 데이터 카운터 보호. 간소화 룰에서는 도발/보호막 유닛입니다.',
    tone: 'blue',
    rarity: 'legendary',
    keywords: ['guard', 'shield'],
    shield: true,
    tags: ['v13', 'millennium', 'monster', 'ace'],
    sourceId: 'MIL-YUUKA-01',
    academy: '밀레니엄',
  },
  {
    id: 'MIL-TUNE-01',
    name: '프로브 튜너 하레',
    role: 'Unit',
    cost: 3,
    attack: 2,
    health: 3,
    text: 'v13 원본: 데이터 카운터와 드로우 튜너. 간소화 룰에서는 속공 유닛입니다.',
    tone: 'green',
    rarity: 'common',
    keywords: ['quick'],
    tags: ['v13', 'millennium', 'monster', 'tuner'],
    sourceId: 'MIL-TUNE-01',
    academy: '밀레니엄',
  },
  {
    id: 'MIL-NORMAL-01',
    name: '세미나의 회계감사',
    role: 'Tactic',
    cost: 1,
    attack: 0,
    health: 0,
    text: 'v13 원본: 카드 1장을 드로우합니다.',
    tone: 'blue',
    rarity: 'common',
    keywords: [],
    tags: ['v13', 'millennium', 'spell', 'draw'],
    effect: 'draw',
    effectAmount: 1,
    effectId: 'E_DRAW_1',
    sourceId: 'MIL-NORMAL-01',
    academy: '밀레니엄',
  },
  {
    id: 'MIL-NORMAL-02',
    name: '격리 프로토콜',
    role: 'Tactic',
    cost: 4,
    attack: 0,
    health: 0,
    text: 'v13 원본: 필드의 카드 1장을 제외합니다. 간소화 룰에서는 상대 최강 유닛을 제거합니다.',
    tone: 'violet',
    rarity: 'rare',
    keywords: [],
    tags: ['v13', 'millennium', 'spell', 'banish'],
    effect: 'banish-enemy-unit',
    effectId: 'E_BANISH_ANY_CARD',
    sourceId: 'MIL-NORMAL-02',
    academy: '밀레니엄',
  },
  {
    id: 'MIL-FIELD-01',
    name: '알고리즘 네트워크',
    role: 'Tactic',
    cost: 3,
    attack: 0,
    health: 0,
    text: 'v13 원본: 데이터 카운터 필드 마법. 간소화 룰에서는 1장 드로우하고 본부 체력을 1 회복합니다.',
    tone: 'blue',
    rarity: 'rare',
    keywords: [],
    tags: ['v13', 'millennium', 'spell', 'field'],
    effect: 'draw-heal',
    effectAmount: 1,
    sourceId: 'MIL-FIELD-01',
    academy: '밀레니엄',
  },
  {
    id: 'striker',
    name: '전열 스트라이커',
    role: 'Unit',
    cost: 1,
    attack: 2,
    health: 2,
    text: '낮은 코스트로 전열을 빠르게 채웁니다.',
    tone: 'red',
    rarity: 'common',
    keywords: [],
    tags: ['unit', 'frontline'],
  },
  {
    id: 'guardian',
    name: '실드 가디언',
    role: 'Unit',
    cost: 2,
    attack: 1,
    health: 5,
    text: '도발. 튼튼한 체력으로 공격을 대신 받아냅니다.',
    tone: 'blue',
    rarity: 'common',
    keywords: ['guard'],
    tags: ['unit', 'defense', 'guard'],
  },
  {
    id: 'sniper',
    name: '후열 스나이퍼',
    role: 'Unit',
    cost: 3,
    attack: 4,
    health: 2,
    text: '관통. 방어 유닛을 쓰러뜨리면 남은 피해가 본부에 들어갑니다.',
    tone: 'violet',
    rarity: 'rare',
    keywords: ['pierce'],
    tags: ['unit', 'backline', 'pierce'],
  },
  {
    id: 'charger',
    name: '돌격 첨병',
    role: 'Unit',
    cost: 2,
    attack: 3,
    health: 2,
    text: '속공. 배치한 턴에도 바로 공격할 수 있습니다.',
    tone: 'red',
    rarity: 'common',
    keywords: ['quick'],
    tags: ['unit', 'aggressive', 'quick'],
  },
  {
    id: 'captain',
    name: '전술 지휘관',
    role: 'Unit',
    cost: 4,
    attack: 3,
    health: 5,
    text: '중반 필드 싸움을 지탱하는 핵심 유닛입니다.',
    tone: 'gold',
    rarity: 'rare',
    keywords: [],
    tags: ['unit', 'command'],
  },
  {
    id: 'repair',
    name: '응급 정비',
    role: 'Tactic',
    cost: 1,
    attack: 0,
    health: 0,
    text: '내 본부 체력을 3 회복합니다.',
    tone: 'green',
    rarity: 'common',
    keywords: [],
    tags: ['tactic', 'heal'],
  },
  {
    id: 'barrage',
    name: '집중 포화',
    role: 'Tactic',
    cost: 2,
    attack: 0,
    health: 0,
    text: '상대 본부에 3 피해를 줍니다.',
    tone: 'gold',
    rarity: 'common',
    keywords: [],
    tags: ['tactic', 'damage'],
  },
  {
    id: 'barrier',
    name: '방어막 전개',
    role: 'Tactic',
    cost: 2,
    attack: 0,
    health: 0,
    text: '아군 유닛 하나에게 보호막을 부여합니다. 유닛이 없으면 본부 체력을 2 회복합니다.',
    tone: 'blue',
    rarity: 'rare',
    keywords: ['shield'],
    tags: ['tactic', 'shield'],
  },
];

const DEFAULT_DECK_CARD_IDS = [
  'MIL-YUUKA-01',
  'MIL-TUNE-01',
  'MIL-NORMAL-01',
  'TRI-TUNE-01',
  'TRI-NORMAL-01',
  'GEH-TUNE-01',
  'GEH-SEINA-01',
  'TRI-COUNTER-01',
  'MIL-NORMAL-02',
  'GEH-FIELD-01',
  'TRI-MIKA-01',
  'GEH-HINA-01',
];

const CARD_BY_ID = new Map(TCG_CARDS.map((card) => [card.id, card]));

function getTcgCard(id) {
  return CARD_BY_ID.get(String(id || '').trim()) || null;
}

function normalizeDeckCardIds(value) {
  const source = Array.isArray(value) ? value : [];
  return source
    .map((id) => String(id || '').trim())
    .filter((id) => CARD_BY_ID.has(id))
    .slice(0, TCG_DECK_RULES.maxCards);
}

function validateDeckCardIds(cardIds) {
  const normalized = normalizeDeckCardIds(cardIds);
  if (normalized.length < TCG_DECK_RULES.minCards) {
    return { ok: false, error: `덱은 최소 ${TCG_DECK_RULES.minCards}장 이상이어야 합니다.`, cardIds: normalized };
  }
  if (normalized.length > TCG_DECK_RULES.maxCards) {
    return { ok: false, error: `덱은 최대 ${TCG_DECK_RULES.maxCards}장까지 구성할 수 있습니다.`, cardIds: normalized };
  }

  const counts = new Map();
  for (const id of normalized) {
    counts.set(id, (counts.get(id) || 0) + 1);
    if (counts.get(id) > TCG_DECK_RULES.maxCopies) {
      const card = getTcgCard(id);
      return {
        ok: false,
        error: `${card?.name || id}은(는) ${TCG_DECK_RULES.maxCopies}장까지만 넣을 수 있습니다.`,
        cardIds: normalized,
      };
    }
  }

  return { ok: true, error: '', cardIds: normalized };
}

function summarizeDeck(cardIds) {
  const cards = normalizeDeckCardIds(cardIds)
    .map(getTcgCard)
    .filter(Boolean);
  const totalCost = cards.reduce((sum, card) => sum + Number(card.cost || 0), 0);
  const unitCount = cards.filter((card) => card.role === 'Unit').length;
  const tacticCount = cards.filter((card) => card.role === 'Tactic').length;
  return {
    totalCards: cards.length,
    unitCount,
    tacticCount,
    averageCost: cards.length ? Number((totalCost / cards.length).toFixed(2)) : 0,
  };
}

module.exports = {
  TCG_GAME_SLUG,
  TCG_DECK_RULES,
  TCG_CARDS,
  DEFAULT_DECK_CARD_IDS,
  getTcgCard,
  normalizeDeckCardIds,
  validateDeckCardIds,
  summarizeDeck,
};
