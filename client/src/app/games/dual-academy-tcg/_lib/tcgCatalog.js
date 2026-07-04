export const TCG_GAME_SLUG = 'dual-academy-tcg';

export const TCG_DECK_RULES = {
  minCards: 8,
  maxCards: 20,
  maxCopies: 3,
};

export const FALLBACK_TCG_CARDS = [
  { id: 'striker', name: '전열 스트라이커', role: 'Unit', cost: 1, attack: 2, health: 2, text: '낮은 코스트로 전열을 빠르게 채웁니다.', tone: 'red', rarity: 'common' },
  { id: 'guardian', name: '실드 가디언', role: 'Unit', cost: 2, attack: 1, health: 5, text: '튼튼한 체력으로 다음 턴을 버팁니다.', tone: 'blue', rarity: 'common' },
  { id: 'sniper', name: '후열 스나이퍼', role: 'Unit', cost: 3, attack: 4, health: 2, text: '필드에 남으면 강한 압박을 만듭니다.', tone: 'violet', rarity: 'rare' },
  { id: 'charger', name: '돌격 첨병', role: 'Unit', cost: 2, attack: 3, health: 2, text: '공격력이 높아 초반 교환에 강합니다.', tone: 'red', rarity: 'common' },
  { id: 'captain', name: '전술 지휘관', role: 'Unit', cost: 4, attack: 3, health: 5, text: '중반 필드 싸움을 지탱하는 핵심 유닛입니다.', tone: 'gold', rarity: 'rare' },
  { id: 'repair', name: '응급 정비', role: 'Tactic', cost: 1, attack: 0, health: 0, text: '내 본부 체력을 3 회복합니다.', tone: 'green', rarity: 'common' },
  { id: 'barrage', name: '집중 포화', role: 'Tactic', cost: 2, attack: 0, health: 0, text: '상대 본부에 3 피해를 줍니다.', tone: 'gold', rarity: 'common' },
  { id: 'barrier', name: '방어막 전개', role: 'Tactic', cost: 2, attack: 0, health: 0, text: '내 본부 체력을 2 회복하고 다음 공격을 대비합니다.', tone: 'blue', rarity: 'rare' },
];

export const FALLBACK_DECK_CARD_IDS = [
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

export function normalizeCards(value) {
  return Array.isArray(value) && value.length ? value : FALLBACK_TCG_CARDS;
}

export function buildCardMap(cards) {
  return new Map(normalizeCards(cards).map((card) => [card.id, card]));
}

export function buildDeckFromIds(cardIds, cards) {
  const cardMap = buildCardMap(cards);
  const ids = Array.isArray(cardIds) && cardIds.length ? cardIds : FALLBACK_DECK_CARD_IDS;
  return ids
    .map((id, index) => {
      const card = cardMap.get(String(id || '').trim());
      return card ? { ...card, instanceId: `${card.id}-${index}` } : null;
    })
    .filter(Boolean);
}

export function summarizeDeck(cardIds, cards) {
  const cardMap = buildCardMap(cards);
  const valid = (Array.isArray(cardIds) ? cardIds : [])
    .map((id) => cardMap.get(String(id || '').trim()))
    .filter(Boolean);
  const totalCost = valid.reduce((sum, card) => sum + Number(card.cost || 0), 0);
  return {
    totalCards: valid.length,
    unitCount: valid.filter((card) => card.role === 'Unit').length,
    tacticCount: valid.filter((card) => card.role === 'Tactic').length,
    averageCost: valid.length ? Number((totalCost / valid.length).toFixed(2)) : 0,
  };
}
