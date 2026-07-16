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

export const TCG_CHARACTER_PROFILES = {
  YUUKA: {
    id: 'YUUKA',
    name: '하야세 유우카',
    academy: '밀레니엄',
    tone: 'blue',
    ai: { aggressive: 0.4, control: 0.8, combo: 0.6, risk: 0.2 },
    quotes: {
      GREET: ['하야세 유우카입니다. 효율적으로 진행하죠.', '밀레니엄, 세미나. 일정대로 시작합니다.'],
      TURN_START: ['내 차례네요. 최적해로 가겠습니다.', '계산 완료. 실행하죠.'],
      DRAW: ['데이터가 충분해요.', '좋아요. 변수는 통제 가능합니다.'],
      SUMMON: ['리소스를 투입합니다.', '배치 완료.'],
      SET: ['리스크 관리 차원에서요.', '백업 플랜도 필요하죠.'],
      EFFECT_ACTIVATE: ['효과 적용. 처리합니다.', '로그 남겼습니다.'],
      ATTACK_DECLARE: ['필요한 피해만 넣겠습니다.', '계산된 공격입니다.'],
      DAMAGE_TAKEN: ['손실 기록. 회수 계획으로 전환.', '예상 오차 범위 내입니다.'],
      WIN: ['예상대로네요. 수고하셨습니다.', '결과: 승리. 비용 대비 효율 양호.'],
      LOSE: ['재검증이 필요하네요.', '오차가 컸습니다. 다음엔 수정하죠.'],
    },
  },
  HINA: {
    id: 'HINA',
    name: '소라사키 히나',
    academy: '게헨나',
    tone: 'red',
    ai: { aggressive: 0.75, control: 0.45, combo: 0.35, risk: 0.55 },
    quotes: {
      GREET: ['히나입니다. 규율은 제가 지켜드리죠.', '게헨나 선도부, 출석했습니다.'],
      TURN_START: ['내 차례군요. 정리하겠습니다.', '지금부터 제가 처리합니다.'],
      DRAW: ['상황은 충분히 읽었어요.', '패가 괜찮군요.'],
      SUMMON: ['전선에 투입.', '질서가 필요해.'],
      SET: ['예비 수단도 준비하죠.', '대응책을 깔아두겠습니다.'],
      EFFECT_ACTIVATE: ['효과를 사용하죠.', '이건 필요합니다.'],
      ATTACK_DECLARE: ['끝내겠습니다.', '저지합니다.'],
      DAMAGE_TAKEN: ['피해는 감수합니다.', '괜찮습니다. 계속하죠.'],
      WIN: ['정리 완료. 다음 업무로 넘어가죠.', '규율은 지켜졌습니다.'],
      LOSE: ['판단이 늦었네요. 다음엔 고치겠습니다.', '이번엔 제가 미흡했습니다.'],
    },
  },
  MIKA: {
    id: 'MIKA',
    name: '미카',
    academy: '트리니티',
    tone: 'gold',
    ai: { aggressive: 0.65, control: 0.55, combo: 0.4, risk: 0.35 },
    quotes: {
      GREET: ['에헤헤, 잘 부탁해요!', '트리니티의 미카! 즐겁게 가자~'],
      TURN_START: ['내 차례! 시작해볼까?', '자, 분위기 올라가자~'],
      DRAW: ['오~ 이거 쓸 만한데?', '패가 예쁘게 들어왔어.'],
      SUMMON: ['짜잔! 등장!', '나가자~!'],
      SET: ['혹시 몰라서 준비!', '비밀 장치 설치~'],
      EFFECT_ACTIVATE: ['지금이 찬스!', '효과 발동~!'],
      ATTACK_DECLARE: ['가자! 한 방이야!', '돌격~!'],
      DAMAGE_TAKEN: ['앗! 좀 아픈데...', '괜찮아, 아직 할 수 있어!'],
      WIN: ['봐봐~ 내가 이겼지!', '오늘은 내가 주인공~'],
      LOSE: ['힝... 다음엔 더 잘할래.', '졌지만... 재미있었어!'],
    },
  },
  GENERIC_GEHE: {
    id: 'GENERIC_GEHE',
    name: '게헨나 대표',
    academy: '게헨나',
    tone: 'red',
    ai: { aggressive: 0.7, control: 0.35, combo: 0.25, risk: 0.65 },
    quotes: {
      GREET: ['게헨나의 방식으로 간다.', '끝까지 밀어붙이자.'],
      TURN_START: ['내 턴이야. 달린다.', '가속한다.'],
      DRAW: ['좋아, 더 밀어붙인다.'],
      SUMMON: ['나와라!', '전개한다.'],
      SET: ['일단 깔아둔다.'],
      EFFECT_ACTIVATE: ['효과 발동!', '여기서 몰아친다.'],
      ATTACK_DECLARE: ['공격!', '뚫는다!'],
      DAMAGE_TAKEN: ['아직 안 끝났어.'],
      WIN: ['이게 게헨나지.', '좋아, 끝났다.'],
      LOSE: ['쳇... 다음엔 더 세게 간다.', '운이 좋았네.'],
    },
  },
  GENERIC_TRIN: {
    id: 'GENERIC_TRIN',
    name: '트리니티 대표',
    academy: '트리니티',
    tone: 'gold',
    ai: { aggressive: 0.55, control: 0.6, combo: 0.35, risk: 0.3 },
    quotes: {
      GREET: ['트리니티의 이름으로.', '정돈된 듀얼을 하죠.'],
      TURN_START: ['차분히 진행하겠습니다.', '내 차례군요.'],
      DRAW: ['좋은 흐름입니다.'],
      SUMMON: ['필드에 세우겠습니다.'],
      SET: ['대응책을 준비하죠.'],
      EFFECT_ACTIVATE: ['효과를 처리합니다.'],
      ATTACK_DECLARE: ['공격하겠습니다.'],
      DAMAGE_TAKEN: ['피해는 계산 안입니다.'],
      WIN: ['질서는 유지되었습니다.', '좋은 승부였어요.'],
      LOSE: ['이번엔 판단이 부족했네요.', '다음엔 더 정교하게.'],
    },
  },
  GENERIC_MILL: {
    id: 'GENERIC_MILL',
    name: '밀레니엄 대표',
    academy: '밀레니엄',
    tone: 'blue',
    ai: { aggressive: 0.4, control: 0.7, combo: 0.55, risk: 0.25 },
    quotes: {
      GREET: ['시스템 부팅. 듀얼 개시.', '데이터 수집 시작.'],
      TURN_START: ['프로세스 진행.', '내 차례: 최적화 실행.'],
      DRAW: ['입력 데이터 확보.'],
      SUMMON: ['필드 리소스 배치.'],
      SET: ['예비 루틴 저장.'],
      EFFECT_ACTIVATE: ['효과 프로세스 실행.'],
      ATTACK_DECLARE: ['공격 루틴 실행.'],
      DAMAGE_TAKEN: ['손실 감지.'],
      WIN: ['결과 확인: 승리.', '계산이 맞았네요.'],
      LOSE: ['로그 분석 필요.', '다음 패치로 보완하죠.'],
    },
  },
};

export const DEFAULT_TCG_CHARACTERS = {
  player: 'YUUKA',
  enemy: 'HINA',
};

export const TCG_CHARACTERS = {
  player: TCG_CHARACTER_PROFILES[DEFAULT_TCG_CHARACTERS.player],
  enemy: TCG_CHARACTER_PROFILES[DEFAULT_TCG_CHARACTERS.enemy],
};

export const TCG_CHARACTER_LIST = Object.values(TCG_CHARACTER_PROFILES);

export function getTcgCharacter(id, fallbackId = 'YUUKA') {
  return TCG_CHARACTER_PROFILES[id] || TCG_CHARACTER_PROFILES[fallbackId] || TCG_CHARACTER_PROFILES.YUUKA;
}

export function normalizeTcgCharacters(value) {
  return {
    player: getTcgCharacter(value?.player, DEFAULT_TCG_CHARACTERS.player).id,
    enemy: getTcgCharacter(value?.enemy, DEFAULT_TCG_CHARACTERS.enemy).id,
  };
}

function pickQuote(quotes, salt = '') {
  if (Array.isArray(quotes) && quotes.length) {
    const seed = String(salt || '').split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
    return quotes[seed % quotes.length];
  }
  if (typeof quotes === 'string' && quotes) return quotes;
  return '';
}

export function renderTcgQuote(profile, event) {
  if (!profile || !event) return '';
  const base = pickQuote(profile.quotes?.[event.type], event.id) || pickQuote(profile.quotes?.TURN_START, event.id) || event.text || '...';
  return base
    .replaceAll('{card}', event.payload?.cardName || event.payload?.cardId || '')
    .replaceAll('{amount}', event.payload?.amount != null ? String(event.payload.amount) : '');
}

export const FALLBACK_TCG_CARDS = [
  { id: 'GEH-HINA-01', name: '소라사키 히나', role: 'Unit', cost: 7, attack: 5, health: 5, text: '② LP 800을 지불해 필드 카드 1장을 파괴합니다. ③ 전투로 몬스터를 파괴하면 400 LP를 회복합니다.', tone: 'red', rarity: 'legendary', keywords: ['pierce'], tags: ['v13', 'gehenna', 'monster', 'ace'], sourceId: 'GEH-HINA-01', academy: '게헨나' },
  { id: 'GEH-SEINA-01', name: '히무로 세나', role: 'Unit', cost: 5, attack: 3, health: 4, text: 'v13 원본: 응급의학부 소생/파괴 방지 효과. 간소화 룰에서는 안정적인 중형 유닛입니다.', tone: 'green', rarity: 'rare', keywords: [], tags: ['v13', 'gehenna', 'monster', 'medical'], sourceId: 'GEH-SEINA-01', academy: '게헨나' },
  { id: 'GEH-TUNE-01', name: '행정 튜너 이부키', role: 'Unit', cost: 3, attack: 2, health: 3, text: 'v13 원본: 게헨나 서치와 레벨 조정 튜너. 간소화 룰에서는 속공 유닛으로 동작합니다.', tone: 'red', rarity: 'common', keywords: ['quick'], tags: ['v13', 'gehenna', 'monster', 'tuner'], sourceId: 'GEH-TUNE-01', academy: '게헨나' },
  { id: 'GEH-FIELD-01', name: '규율의 불문율', role: 'Tactic', cost: 3, attack: 0, health: 0, text: 'v13 원본: 게헨나 필드 마법. 간소화 룰에서는 상대 본부에 3 피해를 줍니다.', tone: 'red', rarity: 'rare', keywords: [], tags: ['v13', 'gehenna', 'spell', 'field'], effect: 'damage', effectAmount: 3, sourceId: 'GEH-FIELD-01', academy: '게헨나' },
  { id: 'TRI-MIKA-01', name: '미소노 미카', role: 'Unit', cost: 7, attack: 6, health: 4, text: '① 데미지 계산 동안 ATK +1200(간소화 수치 +3). ② 다른 트리니티 카드 1장을 묘지로 보내 상대 효과를 무효로 하고 파괴합니다.', tone: 'gold', rarity: 'legendary', keywords: ['pierce'], tags: ['v13', 'trinity', 'monster', 'ace'], sourceId: 'TRI-MIKA-01', academy: '트리니티' },
  { id: 'TRI-TUNE-01', name: '예지 튜너 세이아', role: 'Unit', cost: 4, attack: 3, health: 4, text: 'v13 원본: 덱 조작과 대상 보호 튜너. 간소화 룰에서는 보호막 키워드를 가진 유닛입니다.', tone: 'violet', rarity: 'rare', keywords: ['shield'], shield: true, tags: ['v13', 'trinity', 'monster', 'tuner'], sourceId: 'TRI-TUNE-01', academy: '트리니티' },
  { id: 'TRI-NORMAL-01', name: '정의의 집행', role: 'Tactic', cost: 3, attack: 0, health: 0, text: 'v13 원본: 상대 몬스터 1장을 파괴합니다. 간소화 룰에서는 상대 최약 유닛을 제거합니다.', tone: 'gold', rarity: 'rare', keywords: [], tags: ['v13', 'trinity', 'spell', 'removal'], effect: 'destroy-enemy-unit', effectId: 'E_DESTROY_OPP_MONSTER', sourceId: 'TRI-NORMAL-01', academy: '트리니티' },
  { id: 'TRI-COUNTER-01', name: '성역의 반증', role: 'Tactic', cost: 2, attack: 0, health: 0, text: '상대 효과에 체인해 발동을 무효로 하고, 필드에 남은 발동 카드를 파괴합니다.', tone: 'blue', rarity: 'rare', keywords: ['shield'], tags: ['v13', 'trinity', 'trap', 'counter'], effect: 'shield', sourceId: 'TRI-COUNTER-01', academy: '트리니티' },
  { id: 'MIL-YUUKA-01', name: '하야세 유우카', role: 'Unit', cost: 4, attack: 3, health: 5, text: '① 소환 시 밀레니엄 마법을 서치합니다. ② 자신 필드 카드에 DATA +1과 이번 턴 대상 보호를 부여합니다.', tone: 'blue', rarity: 'legendary', keywords: ['guard', 'shield'], shield: true, tags: ['v13', 'millennium', 'monster', 'ace'], sourceId: 'MIL-YUUKA-01', academy: '밀레니엄' },
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

export function cardRole(card) {
  if (!card) return 'Tactic';
  if (card.role) return card.role;
  if (card.kind === 'Monster') return 'Unit';
  return 'Tactic';
}

export function cardCost(card) {
  const raw = card?.cost ?? card?.level ?? 0;
  return Math.max(0, Number(raw || 0));
}

export function cardAcademy(card) {
  return String(card?.academy || '공용');
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
  const totalCost = valid.reduce((sum, card) => sum + cardCost(card), 0);
  return {
    totalCards: valid.length,
    unitCount: valid.filter((card) => cardRole(card) === 'Unit').length,
    tacticCount: valid.filter((card) => cardRole(card) !== 'Unit').length,
    averageCost: valid.length ? Number((totalCost / valid.length).toFixed(2)) : 0,
  };
}

function addToMap(map, key, amount = 1) {
  map.set(key, (map.get(key) || 0) + amount);
}

function sortedRows(map) {
  return [...map.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, 'ko-KR'));
}

export function analyzeDeck(cardIds, cards, rules = TCG_DECK_RULES) {
  const ids = Array.isArray(cardIds) ? cardIds : [];
  const cardMap = buildCardMap(cards);
  const copyMap = new Map();
  const academyMap = new Map();
  const keywordMap = new Map();
  const costMap = new Map([
    ['0-1', 0],
    ['2-3', 0],
    ['4-5', 0],
    ['6+', 0],
  ]);
  const missingIds = [];

  ids.forEach((rawId) => {
    const id = String(rawId || '').trim();
    if (!id) return;
    addToMap(copyMap, id);
    const card = cardMap.get(id);
    if (!card) {
      missingIds.push(id);
      return;
    }
    addToMap(academyMap, cardAcademy(card));
    cardKeywords(card).forEach((keyword) => addToMap(keywordMap, TCG_KEYWORD_LABELS[keyword] || keyword));
    const cost = cardCost(card);
    if (cost <= 1) addToMap(costMap, '0-1');
    else if (cost <= 3) addToMap(costMap, '2-3');
    else if (cost <= 5) addToMap(costMap, '4-5');
    else addToMap(costMap, '6+');
  });

  const summary = summarizeDeck(ids, cards);
  const errors = [];
  const warnings = [];
  const recommendations = [];
  const maxCopies = Math.max(1, Number(rules?.maxCopies || TCG_DECK_RULES.maxCopies));
  const minCards = Math.max(0, Number(rules?.minCards || TCG_DECK_RULES.minCards));
  const maxCards = Math.max(minCards || 1, Number(rules?.maxCards || TCG_DECK_RULES.maxCards));
  const duplicateRows = [...copyMap.entries()]
    .filter(([, count]) => count > 1)
    .map(([id, count]) => ({ id, count, card: cardMap.get(id) }))
    .sort((a, b) => b.count - a.count || String(a.card?.name || a.id).localeCompare(String(b.card?.name || b.id), 'ko-KR'));

  if (ids.length < minCards) errors.push(`최소 ${minCards}장이 필요합니다.`);
  if (ids.length > maxCards) errors.push(`최대 ${maxCards}장까지만 사용할 수 있습니다.`);
  duplicateRows.forEach((row) => {
    if (row.count > maxCopies) errors.push(`${row.card?.name || row.id}은(는) ${maxCopies}장까지만 넣을 수 있습니다.`);
  });
  if (missingIds.length) errors.push(`목록에 없는 카드가 포함되어 있습니다: ${missingIds.join(', ')}`);

  const unitRatio = summary.totalCards ? summary.unitCount / summary.totalCards : 0;
  if (summary.totalCards >= minCards && unitRatio < 0.45) warnings.push('유닛 비중이 낮아 필드 전개가 끊길 수 있습니다.');
  if (summary.totalCards >= minCards && unitRatio > 0.78) warnings.push('전술 카드 비중이 낮아 상황 대응력이 떨어질 수 있습니다.');
  if (summary.averageCost >= 4.6) warnings.push('평균 비용이 높아 초반 손패가 무거울 수 있습니다.');
  if ((costMap.get('0-1') || 0) + (costMap.get('2-3') || 0) < Math.ceil(summary.totalCards * 0.4)) {
    warnings.push('저비용 카드가 부족합니다. 1-3 비용 카드를 조금 더 넣는 편이 안정적입니다.');
  }
  if (!keywordMap.size) warnings.push('키워드 카드가 없어 덱 개성이 약합니다.');

  if (!errors.length && !warnings.length) recommendations.push('현재 덱은 저장하고 바로 테스트해도 무난한 구성입니다.');
  if (!errors.length && warnings.length) recommendations.push('저장은 가능하지만, 경고 항목을 조정하면 대전 안정성이 올라갑니다.');
  if (errors.length) recommendations.push('저장 전에 필수 오류를 먼저 해결해 주세요.');

  return {
    summary,
    errors,
    warnings,
    recommendations,
    costRows: sortedRows(costMap),
    academyRows: sortedRows(academyMap),
    keywordRows: sortedRows(keywordMap),
    duplicateRows,
    missingIds,
  };
}
