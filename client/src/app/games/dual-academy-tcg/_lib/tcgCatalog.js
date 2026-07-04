export const TCG_GAME_SLUG = 'dual-academy-tcg';

export const TCG_DECK_RULES = {
  minCards: 8,
  maxCards: 20,
  maxCopies: 3,
};

export const TCG_KEYWORD_LABELS = {
  guard: '도발',
  quick: '속공',
  pierce: '관통',
  shield: '보호막',
};

export const FALLBACK_TCG_CARDS = [
  { id: 'striker', name: '전열 스트라이커', role: 'Unit', cost: 1, attack: 2, health: 2, text: '낮은 코스트로 전열을 빠르게 채웁니다.', tone: 'red', rarity: 'common', keywords: [] },
  { id: 'guardian', name: '실드 가디언', role: 'Unit', cost: 2, attack: 1, health: 5, text: '도발. 튼튼한 체력으로 공격을 대신 받아냅니다.', tone: 'blue', rarity: 'common', keywords: ['guard'] },
  { id: 'sniper', name: '후열 스나이퍼', role: 'Unit', cost: 3, attack: 4, health: 2, text: '관통. 방어 유닛을 쓰러뜨리면 남은 피해가 본부에 들어갑니다.', tone: 'violet', rarity: 'rare', keywords: ['pierce'] },
  { id: 'charger', name: '돌격 첨병', role: 'Unit', cost: 2, attack: 3, health: 2, text: '속공. 배치한 턴에도 바로 공격할 수 있습니다.', tone: 'red', rarity: 'common', keywords: ['quick'] },
  { id: 'captain', name: '전술 지휘관', role: 'Unit', cost: 4, attack: 3, health: 5, text: '중반 필드 싸움을 지탱하는 핵심 유닛입니다.', tone: 'gold', rarity: 'rare', keywords: [] },
  { id: 'repair', name: '응급 정비', role: 'Tactic', cost: 1, attack: 0, health: 0, text: '내 본부 체력을 3 회복합니다.', tone: 'green', rarity: 'common', keywords: [] },
  { id: 'barrage', name: '집중 포화', role: 'Tactic', cost: 2, attack: 0, health: 0, text: '상대 본부에 3 피해를 줍니다.', tone: 'gold', rarity: 'common', keywords: [] },
  { id: 'barrier', name: '방어막 전개', role: 'Tactic', cost: 2, attack: 0, health: 0, text: '아군 유닛 하나에게 보호막을 부여합니다. 유닛이 없으면 본부 체력을 2 회복합니다.', tone: 'blue', rarity: 'rare', keywords: ['shield'] },
];

export function cardKeywords(card) {
  return Array.isArray(card?.keywords) ? card.keywords : [];
}

export function hasKeyword(card, keyword) {
  return cardKeywords(card).includes(keyword);
}

export function keywordLabels(card) {
  return cardKeywords(card).map((keyword) => TCG_KEYWORD_LABELS[keyword] || keyword);
}

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
