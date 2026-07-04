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

export const TCG_CHARACTERS = {
  player: {
    id: 'YUUKA',
    name: '하야세 유우카',
    academy: '밀레니엄',
    tone: 'blue',
    quotes: {
      GREET: '하야세 유우카입니다. 효율적으로 진행하죠.',
      TURN_START: '계산 완료. 실행하죠.',
      DRAW: '데이터가 충분해요.',
      SUMMON: '리소스를 투입합니다.',
      EFFECT_ACTIVATE: '효과 적용. 처리합니다.',
      ATTACK_DECLARE: '계산된 공격입니다.',
      DAMAGE_TAKEN: '손실 기록. 회수 계획으로 전환.',
      WIN: '결과: 승리. 비용 대비 효율 양호.',
      LOSE: '재검증이 필요하네요.',
    },
  },
  enemy: {
    id: 'HINA',
    name: '소라사키 히나',
    academy: '게헨나',
    tone: 'red',
    quotes: {
      GREET: '게헨나 선도부, 출석했습니다.',
      TURN_START: '내 차례군요. 정리하겠습니다.',
      DRAW: '상황은 충분히 읽었어요.',
      SUMMON: '전선에 투입.',
      EFFECT_ACTIVATE: '효과를 사용하죠.',
      ATTACK_DECLARE: '끝내겠습니다.',
      DAMAGE_TAKEN: '피해는 감수합니다.',
      WIN: '정리 완료. 다음 업무로 넘어가죠.',
      LOSE: '판단이 늦었네요. 다음엔 고치겠습니다.',
    },
  },
};

export const FALLBACK_TCG_CARDS = [
  { id: 'GEH-HINA-01', name: '소라사키 히나', role: 'Unit', cost: 7, attack: 5, health: 5, text: 'v13 원본: 자기 피해를 전제로 전장을 정리하는 게헨나 에이스입니다. 간소화 룰에서는 관통 유닛으로 동작합니다.', tone: 'red', rarity: 'legendary', keywords: ['pierce'], tags: ['v13', 'gehenna', 'monster', 'ace'], sourceId: 'GEH-HINA-01', academy: '게헨나' },
  { id: 'GEH-SEINA-01', name: '히무로 세나', role: 'Unit', cost: 5, attack: 3, health: 4, text: 'v13 원본: 응급의학부 소생/파괴 방지 효과. 간소화 룰에서는 안정적인 중형 유닛입니다.', tone: 'green', rarity: 'rare', keywords: [], tags: ['v13', 'gehenna', 'monster', 'medical'], sourceId: 'GEH-SEINA-01', academy: '게헨나' },
  { id: 'GEH-TUNE-01', name: '행정 튜너 이부키', role: 'Unit', cost: 3, attack: 2, health: 3, text: 'v13 원본: 게헨나 서치와 레벨 조정 튜너. 간소화 룰에서는 속공 유닛으로 동작합니다.', tone: 'red', rarity: 'common', keywords: ['quick'], tags: ['v13', 'gehenna', 'monster', 'tuner'], sourceId: 'GEH-TUNE-01', academy: '게헨나' },
  { id: 'GEH-FIELD-01', name: '규율의 불문율', role: 'Tactic', cost: 3, attack: 0, health: 0, text: 'v13 원본: 게헨나 필드 마법. 간소화 룰에서는 상대 본부에 3 피해를 줍니다.', tone: 'red', rarity: 'rare', keywords: [], tags: ['v13', 'gehenna', 'spell', 'field'], effect: 'damage', effectAmount: 3, sourceId: 'GEH-FIELD-01', academy: '게헨나' },
  { id: 'TRI-MIKA-01', name: '미소노 미카', role: 'Unit', cost: 7, attack: 6, health: 4, text: 'v13 원본: 전투 중 ATK 상승과 카운터 성향. 간소화 룰에서는 강한 관통 유닛입니다.', tone: 'gold', rarity: 'legendary', keywords: ['pierce'], tags: ['v13', 'trinity', 'monster', 'ace'], sourceId: 'TRI-MIKA-01', academy: '트리니티' },
  { id: 'TRI-TUNE-01', name: '예지 튜너 세이아', role: 'Unit', cost: 4, attack: 3, health: 4, text: 'v13 원본: 덱 조작과 대상 보호 튜너. 간소화 룰에서는 보호막 키워드를 가진 유닛입니다.', tone: 'violet', rarity: 'rare', keywords: ['shield'], shield: true, tags: ['v13', 'trinity', 'monster', 'tuner'], sourceId: 'TRI-TUNE-01', academy: '트리니티' },
  { id: 'TRI-NORMAL-01', name: '정의의 집행', role: 'Tactic', cost: 3, attack: 0, health: 0, text: 'v13 원본: 상대 몬스터 1장을 파괴합니다. 간소화 룰에서는 상대 최약 유닛을 제거합니다.', tone: 'gold', rarity: 'rare', keywords: [], tags: ['v13', 'trinity', 'spell', 'removal'], effect: 'destroy-enemy-unit', effectId: 'E_DESTROY_OPP_MONSTER', sourceId: 'TRI-NORMAL-01', academy: '트리니티' },
  { id: 'TRI-COUNTER-01', name: '성역의 반증', role: 'Tactic', cost: 2, attack: 0, health: 0, text: 'v13 원본: 카운터 함정. 간소화 룰에서는 아군 유닛 하나에게 보호막을 부여합니다.', tone: 'blue', rarity: 'rare', keywords: ['shield'], tags: ['v13', 'trinity', 'trap', 'counter'], effect: 'shield', sourceId: 'TRI-COUNTER-01', academy: '트리니티' },
  { id: 'MIL-YUUKA-01', name: '하야세 유우카', role: 'Unit', cost: 4, attack: 3, health: 5, text: 'v13 원본: 밀레니엄 서치와 데이터 카운터 보호. 간소화 룰에서는 도발/보호막 유닛입니다.', tone: 'blue', rarity: 'legendary', keywords: ['guard', 'shield'], shield: true, tags: ['v13', 'millennium', 'monster', 'ace'], sourceId: 'MIL-YUUKA-01', academy: '밀레니엄' },
  { id: 'MIL-TUNE-01', name: '프로브 튜너 하레', role: 'Unit', cost: 3, attack: 2, health: 3, text: 'v13 원본: 데이터 카운터와 드로우 튜너. 간소화 룰에서는 속공 유닛입니다.', tone: 'green', rarity: 'common', keywords: ['quick'], tags: ['v13', 'millennium', 'monster', 'tuner'], sourceId: 'MIL-TUNE-01', academy: '밀레니엄' },
  { id: 'MIL-NORMAL-01', name: '세미나의 회계감사', role: 'Tactic', cost: 1, attack: 0, health: 0, text: 'v13 원본: 카드 1장을 드로우합니다.', tone: 'blue', rarity: 'common', keywords: [], tags: ['v13', 'millennium', 'spell', 'draw'], effect: 'draw', effectAmount: 1, effectId: 'E_DRAW_1', sourceId: 'MIL-NORMAL-01', academy: '밀레니엄' },
  { id: 'MIL-NORMAL-02', name: '격리 프로토콜', role: 'Tactic', cost: 4, attack: 0, health: 0, text: 'v13 원본: 필드의 카드 1장을 제외합니다. 간소화 룰에서는 상대 최강 유닛을 제거합니다.', tone: 'violet', rarity: 'rare', keywords: [], tags: ['v13', 'millennium', 'spell', 'banish'], effect: 'banish-enemy-unit', effectId: 'E_BANISH_ANY_CARD', sourceId: 'MIL-NORMAL-02', academy: '밀레니엄' },
  { id: 'MIL-FIELD-01', name: '알고리즘 네트워크', role: 'Tactic', cost: 3, attack: 0, health: 0, text: 'v13 원본: 데이터 카운터 필드 마법. 간소화 룰에서는 1장 드로우하고 본부 체력을 1 회복합니다.', tone: 'blue', rarity: 'rare', keywords: [], tags: ['v13', 'millennium', 'spell', 'field'], effect: 'draw-heal', effectAmount: 1, sourceId: 'MIL-FIELD-01', academy: '밀레니엄' },
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
