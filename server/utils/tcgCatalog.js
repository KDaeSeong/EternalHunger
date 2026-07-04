const TCG_GAME_SLUG = 'dual-academy-tcg';

const TCG_DECK_RULES = {
  minCards: 8,
  maxCards: 20,
  maxCopies: 3,
};

const TCG_CARDS = [
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
    tags: ['unit', 'frontline'],
  },
  {
    id: 'guardian',
    name: '실드 가디언',
    role: 'Unit',
    cost: 2,
    attack: 1,
    health: 5,
    text: '튼튼한 체력으로 다음 턴을 버팁니다.',
    tone: 'blue',
    rarity: 'common',
    tags: ['unit', 'defense'],
  },
  {
    id: 'sniper',
    name: '후열 스나이퍼',
    role: 'Unit',
    cost: 3,
    attack: 4,
    health: 2,
    text: '필드에 남으면 강한 압박을 만듭니다.',
    tone: 'violet',
    rarity: 'rare',
    tags: ['unit', 'backline'],
  },
  {
    id: 'charger',
    name: '돌격 첨병',
    role: 'Unit',
    cost: 2,
    attack: 3,
    health: 2,
    text: '공격력이 높아 초반 교환에 강합니다.',
    tone: 'red',
    rarity: 'common',
    tags: ['unit', 'aggressive'],
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
    tags: ['tactic', 'damage'],
  },
  {
    id: 'barrier',
    name: '방어막 전개',
    role: 'Tactic',
    cost: 2,
    attack: 0,
    health: 0,
    text: '내 본부 체력을 2 회복하고 다음 공격을 대비합니다.',
    tone: 'blue',
    rarity: 'rare',
    tags: ['tactic', 'shield'],
  },
];

const DEFAULT_DECK_CARD_IDS = [
  'striker',
  'guardian',
  'striker',
  'repair',
  'sniper',
  'barrage',
  'guardian',
  'striker',
  'barrage',
  'repair',
  'charger',
  'captain',
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
