import {
  DEFAULT_TCG_CHARACTERS,
  FALLBACK_DECK_CARD_IDS,
  FALLBACK_TCG_CARDS,
  buildDeckFromIds,
  getTcgCharacter,
  hasKeyword,
  normalizeCards,
  normalizeTcgCharacters,
} from './tcgCatalog.js';

export const QUICK_SAVE_SLOT = 'quick-match';
export const ENGINE_VERSION = 'tcg-v13-zone-engine-v1';
export const PHASES = ['MAIN1', 'BATTLE', 'MAIN2', 'END'];
export const PLAYERS = ['player', 'enemy'];
export const PLAYER_LABELS = {
  player: '나',
  enemy: 'AI',
};

const MAX_EVENTS = 160;
const MAX_LOG = 80;
const LP_START = 8000;
const ZONE_SIZE = 5;

const ENEMY_DECK_CARD_IDS = [
  'GEH-HINA-01',
  'GEH-TUNE-01',
  'GEH-FIELD-01',
  'TRI-MIKA-01',
  'TRI-TUNE-01',
  'TRI-NORMAL-01',
  'MIL-YUUKA-01',
  'MIL-TUNE-01',
  'MIL-NORMAL-01',
  'MIL-FIELD-01',
  'GEH-SEINA-01',
  'TRI-COUNTER-01',
];

function nowId(prefix = 'id') {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function opponent(player) {
  return player === 'player' ? 'enemy' : 'player';
}

function eventText(actor, text) {
  return `[${PLAYER_LABELS[actor] || actor}] ${text}`;
}

function createEvent(type, actor, text, payload = {}, turn = 1, phase = 'MAIN1') {
  return {
    id: nowId('evt'),
    at: new Date().toISOString(),
    turn,
    phase,
    type,
    actor,
    text,
    payload,
  };
}

function emit(state, type, actor, text, payload = {}) {
  const event = createEvent(type, actor, text, payload, state.turn, state.phase);
  return {
    ...state,
    events: [event, ...(state.events || [])].slice(0, MAX_EVENTS),
    log: [eventText(actor, text), ...(state.log || [])].slice(0, MAX_LOG),
  };
}

function cardType(card) {
  if (!card) return 'Unknown';
  if (card.role === 'Unit') return 'Monster';
  if (card.tags?.includes('trap') || card.tags?.includes('counter')) return 'Trap';
  return 'Spell';
}

function spellSubType(card) {
  if (!card) return 'Normal';
  if (card.tags?.includes('field')) return 'Field';
  if (card.tags?.includes('counter')) return 'Counter';
  if (card.tags?.includes('quick')) return 'QuickPlay';
  return 'Normal';
}

function effectKey(card) {
  if (card?.effect === 'banish-enemy-unit') return 'banish-enemy-card';
  if (card?.effect) return card.effect;
  if (card?.effectId === 'E_DRAW_1') return 'draw';
  if (card?.effectId === 'E_DESTROY_OPP_MONSTER') return 'destroy-enemy-unit';
  if (card?.effectId === 'E_BANISH_ANY_CARD') return 'banish-enemy-card';
  if (card?.id === 'repair') return 'heal';
  if (card?.id === 'barrage') return 'damage';
  if (card?.id === 'barrier') return 'shield';
  return 'none';
}

const HANDLED_EFFECTS = {
  damage: '상대 LP 피해',
  heal: '아군 LP 회복',
  draw: '드로우',
  'draw-heal': '드로우 + 회복',
  shield: '보호막 부여',
  'destroy-enemy-unit': '상대 유닛 파괴',
  'banish-enemy-card': '상대 카드 제외',
  'hina-destroy-any': '필드 카드 파괴',
  'hina-battle-heal': '전투 파괴 후 LP 회복',
  'mika-battle-boost': '데미지 계산 ATK 상승',
  'mika-negate': '트리니티 코스트 체인 무효/파괴',
  'yuuka-search': '덱 서치',
  'yuuka-data-shield': 'DATA + 대상 보호',
  'counter-negate': '체인 무효',
};

const HANDLED_KEYWORDS = {
  guard: '가드 우선 공격 강제',
  pierce: 'DEF 초과 피해 관통',
  quick: 'AI 전개 우선도 보정',
  shield: '피해 1회 무효',
};

const SPECIAL_CARD_EFFECTS = {
  'GEH-HINA-01': ['히나 ②: LP 지불 후 필드 카드 파괴', '히나 ③: 전투 파괴 후 LP 회복'],
  'TRI-MIKA-01': ['미카 ①: 데미지 계산 ATK +1200', '미카 ②: 트리니티 코스트 후 체인 무효/파괴'],
  'MIL-YUUKA-01': ['유우카 ①: 밀레니엄 마법 서치', '유우카 ②: DATA + 대상 보호'],
};

function effectAmount(card, fallback = 1) {
  return Math.max(1, Number(card?.effectAmount || fallback));
}

export function cardEffectCoverageReport(cards = FALLBACK_TCG_CARDS) {
  const catalog = normalizeCards(cards).length ? normalizeCards(cards) : FALLBACK_TCG_CARDS;
  const rows = catalog.map((card) => {
    const type = cardType(card);
    const key = effectKey(card);
    const keywords = (Array.isArray(card.keywords) ? card.keywords : []).filter(Boolean);
    const handledKeywords = keywords.filter((keyword) => HANDLED_KEYWORDS[keyword]);
    const unhandledKeywords = keywords.filter((keyword) => !HANDLED_KEYWORDS[keyword]);
    const specialEffects = SPECIAL_CARD_EFFECTS[card.id] || [];
    const isTactic = type !== 'Monster';
    const hasHandledEffect = isTactic ? Boolean(HANDLED_EFFECTS[key]) : true;
    const covered = hasHandledEffect && unhandledKeywords.length === 0;
    const status = !covered
      ? '확인 필요'
      : isTactic
        ? '효과 처리'
        : specialEffects.length
          ? '전용 효과'
          : handledKeywords.length
            ? '키워드 처리'
            : '스탯 모델';
    const detailParts = [];
    if (isTactic) detailParts.push(HANDLED_EFFECTS[key] || `미처리 효과: ${key}`);
    if (specialEffects.length) detailParts.push(...specialEffects);
    if (handledKeywords.length) {
      detailParts.push(`키워드: ${handledKeywords.map((keyword) => HANDLED_KEYWORDS[keyword]).join(', ')}`);
    }
    if (!detailParts.length) detailParts.push('공격력/체력/비용 기반 기본 유닛으로 처리합니다.');
    if (unhandledKeywords.length) detailParts.push(`미처리 키워드: ${unhandledKeywords.join(', ')}`);
    return {
      id: card.id,
      name: card.name || card.id,
      type,
      effect: key,
      status,
      covered,
      sourceId: card.sourceId || '',
      v13: Boolean(card.sourceId || card.tags?.includes('v13')),
      detail: detailParts.join(' · '),
      tone: covered ? 'green' : 'gold',
    };
  });
  const total = rows.length;
  const coveredRows = rows.filter((row) => row.covered);
  const unsupportedRows = rows.filter((row) => !row.covered);
  const tacticRows = rows.filter((row) => row.type !== 'Monster');
  const v13Rows = rows.filter((row) => row.v13);
  const keywordRows = Object.entries(HANDLED_KEYWORDS).map(([keyword, detail]) => {
    const count = catalog.filter((card) => Array.isArray(card.keywords) && card.keywords.includes(keyword)).length;
    return {
      keyword,
      detail,
      count,
      status: count ? '활성' : '대기',
    };
  });
  const completionPct = total ? Math.round((coveredRows.length / total) * 100) : 0;
  return {
    completionPct,
    ready: unsupportedRows.length === 0,
    totalCards: total,
    coveredCards: coveredRows.length,
    tacticCards: tacticRows.length,
    tacticCovered: tacticRows.filter((row) => row.covered).length,
    v13Cards: v13Rows.length,
    v13Covered: v13Rows.filter((row) => row.covered).length,
    unsupportedRows,
    keywordRows,
    rows,
    headline: `카드 ${coveredRows.length}/${total}장 처리 · 전술 ${tacticRows.filter((row) => row.covered).length}/${tacticRows.length}장 · v13 ${v13Rows.filter((row) => row.covered).length}/${v13Rows.length}장`,
    recommendations: unsupportedRows.length
      ? unsupportedRows.map((row) => `${row.name}: ${row.detail}`).slice(0, 4)
      : ['현재 카드 풀의 효과/키워드가 모두 간소화 룰 처리 경로에 연결되어 있습니다.'],
  };
}

function cloneZone() {
  return Array.from({ length: ZONE_SIZE }, () => null);
}

function makeInstance(card, owner, index = 0) {
  return {
    ...card,
    instanceId: `${owner}-${card.id}-${index}-${Math.random().toString(36).slice(2, 6)}`,
    owner,
    face: 'up',
    position: 'ATK',
    currentHealth: Math.max(1, Number(card.health || 1)),
    hasAttacked: false,
    shield: Boolean(card.shield || hasKeyword(card, 'shield')),
    protectedUntilTurn: 0,
  };
}

function makeDeck(cardIds, cards, owner, fallbackIds = FALLBACK_DECK_CARD_IDS) {
  const deck = buildDeckFromIds(cardIds, cards);
  const source = deck.length ? deck : buildDeckFromIds(fallbackIds, cards);
  const expanded = [];
  while (expanded.length < Math.max(20, source.length)) {
    const row = source[expanded.length % source.length];
    expanded.push(makeInstance(row, owner, expanded.length));
  }
  return expanded;
}

export function buildEnemyDeck(cards = FALLBACK_TCG_CARDS) {
  return makeDeck(ENEMY_DECK_CARD_IDS, cards, 'enemy', ENEMY_DECK_CARD_IDS);
}

function emptyPlayerState(deck = []) {
  return {
    lp: LP_START,
    deck,
    hand: [],
    grave: [],
    banished: [],
    monster: cloneZone(),
    spellTrap: cloneZone(),
    field: null,
    flags: {
      normalSummoned: false,
      usedEffects: {},
    },
  };
}

export function createDuelState({
  deckCardIds = FALLBACK_DECK_CARD_IDS,
  enemyDeckCardIds = ENEMY_DECK_CARD_IDS,
  cardCatalog = FALLBACK_TCG_CARDS,
  characters = DEFAULT_TCG_CHARACTERS,
} = {}) {
  const cards = normalizeCards(cardCatalog);
  let state = {
    matchId: nowId('match'),
    startedAt: new Date().toISOString(),
    version: ENGINE_VERSION,
    turn: 1,
    turnPlayer: 'player',
    phase: 'MAIN1',
    winner: '',
    players: {
      player: emptyPlayerState(makeDeck(deckCardIds, cards, 'player')),
      enemy: emptyPlayerState(makeDeck(enemyDeckCardIds, cards, 'enemy', ENEMY_DECK_CARD_IDS)),
    },
    chain: [],
    prompt: { kind: 'NONE' },
    characters: normalizeTcgCharacters(characters),
    log: [],
    events: [],
  };
  state = emit(state, 'GREET', 'player', '듀얼을 시작했습니다. 선공은 드로우와 배틀 없이 MAIN1에서 시작합니다.');
  state = emit(state, 'GREET', 'enemy', '상대가 준비했습니다.');
  state = drawCards(state, 'player', 5);
  state = drawCards(state, 'enemy', 5);
  return state;
}

export function normalizeDuelState(value, fallback = {}) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const base = createDuelState(fallback);
  const normalizePlayer = (raw, basePlayer) => ({
    ...basePlayer,
    ...(raw && typeof raw === 'object' ? raw : {}),
    lp: Math.max(0, Math.min(99999, Number(raw?.lp ?? basePlayer.lp))),
    deck: Array.isArray(raw?.deck) ? raw.deck : basePlayer.deck,
    hand: Array.isArray(raw?.hand) ? raw.hand : basePlayer.hand,
    grave: Array.isArray(raw?.grave) ? raw.grave : [],
    banished: Array.isArray(raw?.banished) ? raw.banished : [],
    monster: Array.isArray(raw?.monster) ? [...raw.monster, ...cloneZone()].slice(0, ZONE_SIZE) : cloneZone(),
    spellTrap: Array.isArray(raw?.spellTrap) ? [...raw.spellTrap, ...cloneZone()].slice(0, ZONE_SIZE) : cloneZone(),
    field: raw?.field || null,
    flags: {
      normalSummoned: Boolean(raw?.flags?.normalSummoned),
      usedEffects: raw?.flags?.usedEffects && typeof raw.flags.usedEffects === 'object' ? raw.flags.usedEffects : {},
    },
  });

  return {
    ...base,
    ...value,
    turn: Math.max(1, Number(value.turn || 1)),
    turnPlayer: PLAYERS.includes(value.turnPlayer) ? value.turnPlayer : 'player',
    phase: PHASES.includes(value.phase) ? value.phase : 'MAIN1',
    winner: PLAYERS.includes(value.winner) ? value.winner : '',
    players: {
      player: normalizePlayer(value.players?.player, base.players.player),
      enemy: normalizePlayer(value.players?.enemy, base.players.enemy),
    },
    chain: Array.isArray(value.chain) ? value.chain.slice(0, 8) : [],
    prompt: value.prompt && typeof value.prompt === 'object' ? value.prompt : { kind: 'NONE' },
    characters: normalizeTcgCharacters(value.characters || base.characters),
    log: Array.isArray(value.log) ? value.log.slice(0, MAX_LOG) : [],
    events: Array.isArray(value.events) ? value.events.slice(0, MAX_EVENTS) : [],
  };
}

export function serializeDuelState(state) {
  return {
    matchId: state.matchId,
    startedAt: state.startedAt,
    version: state.version || ENGINE_VERSION,
    turn: state.turn,
    turnPlayer: state.turnPlayer,
    phase: state.phase,
    winner: state.winner,
    players: state.players,
    chain: state.chain,
    prompt: state.prompt,
    characters: normalizeTcgCharacters(state.characters),
    log: state.log,
    events: state.events,
  };
}

export function summarizeDuel(state) {
  const advisor = turnAdvisorForState(state, 'player');
  return {
    turn: state.turn,
    phase: state.phase,
    turnPlayer: state.turnPlayer,
    winner: state.winner || 'playing',
    playerLp: state.players.player.lp,
    enemyLp: state.players.enemy.lp,
    playerDeck: state.players.player.deck.length,
    enemyDeck: state.players.enemy.deck.length,
    playerHand: state.players.player.hand.length,
    enemyHand: state.players.enemy.hand.length,
    chain: state.chain.length,
    playerCharacter: normalizeTcgCharacters(state.characters).player,
    enemyCharacter: normalizeTcgCharacters(state.characters).enemy,
    turnAdvisor: {
      riskLabel: advisor.riskLabel,
      recommendedAction: advisor.recommendedAction,
      readinessPct: advisor.readinessPct,
      boardDelta: advisor.boardDelta,
      lethalDamage: advisor.lethal?.damage || 0,
    },
  };
}

function zoneCards(zone) {
  return Array.isArray(zone) ? zone.filter(Boolean) : [];
}

function openSlots(zone) {
  return Array.isArray(zone) ? zone.filter((card) => !card).length : 0;
}

function boardPowerFor(playerState) {
  return zoneCards(playerState?.monster).reduce((sum, card) => (
    sum + monsterAtk(card) + Math.max(0, monsterHealth(card)) * 0.7 + Number(card?.shield ? 120 : 0)
  ), 0);
}

function handProfileFor(playerState) {
  const cards = Array.isArray(playerState?.hand) ? playerState.hand : [];
  return cards.reduce((profile, card) => {
    const type = cardType(card);
    if (type === 'Monster') profile.monsters += 1;
    else if (type === 'Trap') profile.traps += 1;
    else profile.spells += 1;
    if (spellSubType(card) === 'Field') profile.fields += 1;
    if (['destroy-enemy-unit', 'banish-enemy-card', 'damage'].includes(effectKey(card))) profile.pressure += 1;
    return profile;
  }, { monsters: 0, spells: 0, traps: 0, fields: 0, pressure: 0 });
}

function bestHandMonster(playerState) {
  return (Array.isArray(playerState?.hand) ? playerState.hand : [])
    .filter((card) => cardType(card) === 'Monster')
    .sort((a, b) => (
      monsterAtk(b) + monsterHealth(b) * 0.8 + Number(b?.cost || 0) * 10
    ) - (
      monsterAtk(a) + monsterHealth(a) * 0.8 + Number(a?.cost || 0) * 10
    ))[0] || null;
}

function attackLineFor(state, actor) {
  const player = PLAYERS.includes(actor) ? actor : 'player';
  const rival = opponent(player);
  const side = state.players?.[player] || {};
  const rivalSide = state.players?.[rival] || {};
  const attackers = zoneCards(side.monster)
    .filter((card) => !card.hasAttacked && card.position !== 'DEF')
    .sort((a, b) => monsterAtk(b) - monsterAtk(a));
  const bestAttacker = attackers[0] || null;
  const defenders = zoneCards(rivalSide.monster);
  const weakestDefender = defenders
    .slice()
    .sort((a, b) => monsterHealth(a) - monsterHealth(b) || monsterAtk(a) - monsterAtk(b))[0] || null;
  const directDamage = defenders.length ? 0 : monsterAtk(bestAttacker);

  return {
    canAttack: Boolean(bestAttacker),
    attackerName: bestAttacker?.name || '',
    targetName: weakestDefender?.name || '',
    damage: directDamage,
    lethal: directDamage > 0 && directDamage >= Number(rivalSide.lp || 0),
    defenderCount: defenders.length,
  };
}

function advisorAction(id, title, detail, priority = 'normal') {
  return { id, title, detail, priority };
}

export function turnAdvisorForState(state, actor = 'player') {
  const current = normalizeDuelState(state);
  const player = PLAYERS.includes(actor) ? actor : 'player';
  const rival = opponent(player);
  const side = current.players[player];
  const rivalSide = current.players[rival];
  const hand = handProfileFor(side);
  const summonCandidate = bestHandMonster(side);
  const attackLine = attackLineFor(current, player);
  const playerPower = boardPowerFor(side);
  const rivalPower = boardPowerFor(rivalSide);
  const boardDelta = Math.round(playerPower - rivalPower);
  const lpDelta = Number(side.lp || 0) - Number(rivalSide.lp || 0);
  const openMonster = openSlots(side.monster);
  const openSpellTrap = openSlots(side.spellTrap);
  const recommendations = [];

  if (current.winner) {
    recommendations.push(advisorAction('record', '전적 저장', '승패가 확정됐습니다. 매치 리포트와 로그를 비교한 뒤 저장/전적을 남기세요.', 'high'));
  } else if (current.prompt.kind !== 'NONE') {
    const promptLabel = current.prompt.kind === 'RESPOND'
      ? '체인 응답'
      : current.prompt.kind === 'SELECT_TARGET'
        ? '대상 선택'
        : current.prompt.kind === 'SELECT_FROM_DECK'
          ? '덱 선택'
          : current.prompt.kind === 'SELECT_COST_MIKA_NEGATE'
            ? '미카 코스트 선택'
          : '효과 확인';
    recommendations.push(advisorAction('prompt', promptLabel, '현재 선택/응답 프롬프트가 진행을 막고 있습니다. 먼저 프롬프트를 처리하세요.', 'high'));
  } else if (current.chain.length > 0) {
    recommendations.push(advisorAction('chain', '체인 해결', `${current.chain.length}개 효과가 대기 중입니다. 응답이 없다면 체인을 해결하세요.`, 'high'));
  } else if (current.turnPlayer !== player) {
    recommendations.push(advisorAction('wait', '상대 턴 대기', `${PLAYER_LABELS[rival]} 턴입니다. 자동 진행 후 내 턴 보드 상태를 다시 확인하세요.`, 'normal'));
  } else if (current.phase === 'MAIN1' || current.phase === 'MAIN2') {
    if (!side.flags.normalSummoned && summonCandidate && openMonster > 0) {
      recommendations.push(advisorAction('summon', `${summonCandidate.name} 일반 소환`, `빈 몬스터 존 ${openMonster}칸이 있습니다. 현재 패에서 가장 안정적인 전개 카드입니다.`, 'high'));
    }
    if (!side.field && hand.fields > 0) {
      recommendations.push(advisorAction('field', '필드 마법 발동', '필드가 비어 있습니다. 필드 마법을 먼저 깔면 후속 전투와 효과 가치가 올라갑니다.', 'normal'));
    }
    if (hand.pressure > 0 && zoneCards(rivalSide.monster).length > 0) {
      recommendations.push(advisorAction('removal', '제거/피해 주문 확인', '상대 몬스터가 있으므로 제거, 제외, 피해 주문으로 전투 전에 길을 열 수 있습니다.', 'normal'));
    }
    if (hand.traps > 0 && openSpellTrap > 0) {
      recommendations.push(advisorAction('set-trap', '함정 세트', `마법/함정 존 ${openSpellTrap}칸이 비어 있습니다. 다음 상대 턴 방어선을 준비하세요.`, 'normal'));
    }
    recommendations.push(advisorAction('battle-ready', '배틀 진입 검토', '소환/마법/세트를 마쳤다면 배틀 페이즈로 넘어가 공격 기회를 확인하세요.', 'low'));
  } else if (current.phase === 'BATTLE') {
    if (attackLine.lethal) {
      recommendations.push(advisorAction('lethal', '직접 공격으로 마무리', `${attackLine.attackerName} 공격으로 ${attackLine.damage} 피해를 줄 수 있습니다.`, 'high'));
    } else if (attackLine.canAttack && attackLine.defenderCount > 0) {
      recommendations.push(advisorAction('attack', '가장 약한 몬스터 공격', `${attackLine.attackerName}로 ${attackLine.targetName || '상대 몬스터'}를 먼저 정리하세요.`, 'high'));
    } else if (attackLine.canAttack) {
      recommendations.push(advisorAction('direct', '직접 공격', `${attackLine.attackerName}로 직접 공격할 수 있습니다.`, 'high'));
    } else {
      recommendations.push(advisorAction('end-battle', '페이즈 넘기기', '공격 가능한 몬스터가 없습니다. MAIN2/END로 진행하세요.', 'normal'));
    }
  } else {
    recommendations.push(advisorAction('next-phase', '다음 페이즈', '현재 페이즈에서 처리할 핵심 행동이 적습니다. 다음 페이즈로 넘기세요.', 'normal'));
  }

  if (!current.winner && Number(side.lp || 0) <= 2000) {
    recommendations.push(advisorAction('low-lp', 'LP 위험', 'LP가 낮습니다. 수비 표시, 가드, 보호막, 함정 세트를 우선하세요.', 'high'));
  }

  const riskScore = (lpDelta < -2000 ? 2 : lpDelta < 0 ? 1 : 0)
    + (boardDelta < -1200 ? 2 : boardDelta < 0 ? 1 : 0)
    + (Number(side.deck?.length || 0) <= 5 ? 1 : 0)
    + (Number(side.lp || 0) <= 2000 ? 2 : 0);
  const riskLabel = current.winner
    ? '종료'
    : riskScore >= 4
      ? '위험'
      : riskScore >= 2
        ? '주의'
        : '안정';
  const readinessPct = Math.max(0, Math.min(100, Math.round(
    58
    + Math.max(-18, Math.min(18, boardDelta / 180))
    + Math.max(-14, Math.min(14, lpDelta / 220))
    + (hand.monsters ? 5 : -6)
    + (hand.traps ? 4 : 0)
    + (attackLine.lethal ? 14 : 0)
    - (current.prompt.kind !== 'NONE' ? 12 : 0)
    - (current.chain.length ? 8 : 0)
  )));
  const first = recommendations[0] || advisorAction('watch', '상태 확인', '현재 보드와 패를 확인하세요.', 'normal');

  return {
    player,
    rival,
    phase: current.phase,
    riskLabel,
    readinessPct,
    boardDelta,
    lpDelta,
    openMonster,
    openSpellTrap,
    hand,
    lethal: attackLine,
    recommendedAction: first.title,
    headline: `${riskLabel} · ${first.title}`,
    recommendations: recommendations.slice(0, 6),
  };
}

function emptyReportStats(player) {
  return {
    player,
    label: PLAYER_LABELS[player] || player,
    draws: 0,
    summons: 0,
    sets: 0,
    effects: 0,
    attacks: 0,
    damageDealt: 0,
    damageTaken: 0,
    wins: 0,
    losses: 0,
  };
}

function parseLpDamage(text) {
  const match = String(text || '').match(/(\d+)\s*LP\s*피해/);
  return match ? Math.max(0, Number(match[1] || 0)) : 0;
}

function fieldCount(playerState) {
  return (Array.isArray(playerState?.monster) ? playerState.monster.filter(Boolean).length : 0)
    + (Array.isArray(playerState?.spellTrap) ? playerState.spellTrap.filter(Boolean).length : 0)
    + (playerState?.field ? 1 : 0);
}

function reportSummaryForPlayer(playerState, stats) {
  return {
    ...stats,
    lp: Number(playerState?.lp || 0),
    deck: Array.isArray(playerState?.deck) ? playerState.deck.length : 0,
    hand: Array.isArray(playerState?.hand) ? playerState.hand.length : 0,
    fieldCards: fieldCount(playerState),
    grave: Array.isArray(playerState?.grave) ? playerState.grave.length : 0,
    banished: Array.isArray(playerState?.banished) ? playerState.banished.length : 0,
    tempoScore: Math.round(stats.summons * 3 + stats.effects * 2 + stats.attacks * 2 + fieldCount(playerState) * 2 - stats.damageTaken / 800),
  };
}

export function matchReportForState(state) {
  const safe = state && typeof state === 'object' ? state : {};
  const events = Array.isArray(safe.events) ? safe.events : [];
  const chronological = events.slice().reverse();
  const stats = {
    player: emptyReportStats('player'),
    enemy: emptyReportStats('enemy'),
  };
  const typeCounts = {};

  chronological.forEach((event) => {
    const type = String(event?.type || 'UNKNOWN');
    const actor = PLAYERS.includes(event?.actor) ? event.actor : '';
    typeCounts[type] = Number(typeCounts[type] || 0) + 1;
    if (!actor) return;

    const row = stats[actor];
    if (type === 'DRAW') row.draws += 1;
    if (type === 'SUMMON') row.summons += 1;
    if (type === 'SET') row.sets += 1;
    if (type === 'EFFECT_ACTIVATE') row.effects += 1;
    if (type === 'WIN') row.wins += 1;
    if (type === 'LOSE') row.losses += 1;

    if (type === 'ATTACK_DECLARE') {
      row.attacks += 1;
      const directDamage = parseLpDamage(event.text);
      if (directDamage > 0) {
        row.damageDealt += directDamage;
        stats[opponent(actor)].damageTaken += directDamage;
      }
    }

    if (type === 'DAMAGE_TAKEN') {
      const damage = parseLpDamage(event.text);
      row.damageTaken += damage;
      stats[opponent(actor)].damageDealt += damage;
    }
  });

  const playerState = safe.players?.player || {};
  const enemyState = safe.players?.enemy || {};
  const player = reportSummaryForPlayer(playerState, stats.player);
  const enemy = reportSummaryForPlayer(enemyState, stats.enemy);
  const lpDiff = player.lp - enemy.lp;
  const winner = safe.winner || '';
  const headline = winner
    ? `${PLAYER_LABELS[winner] || winner} 승리: ${player.label} ${player.lp} LP / ${enemy.label} ${enemy.lp} LP`
    : lpDiff === 0
      ? `${safe.turn || 1}턴 ${safe.phase || 'MAIN1'} 진행 중: LP 균형`
      : `${safe.turn || 1}턴 ${safe.phase || 'MAIN1'} 진행 중: ${lpDiff > 0 ? player.label : enemy.label} ${Math.abs(lpDiff)} LP 우세`;
  const highlights = chronological
    .slice(-6)
    .reverse()
    .map((event) => `T${event.turn} ${event.phase} · ${PLAYER_LABELS[event.actor] || event.actor} · ${event.text}`);
  const recommendations = [
    !winner && player.hand >= 6 ? '패가 많습니다. 소환/세트/마법 발동으로 손패를 줄이는 쪽이 좋습니다.' : '',
    !winner && player.deck <= 5 ? '덱이 얼마 남지 않았습니다. 장기전보다 빠른 마무리를 노리세요.' : '',
    !winner && enemy.fieldCards > player.fieldCards ? '필드 수에서 밀립니다. 제거 효과나 가드 몬스터를 우선 확인하세요.' : '',
    !winner && player.damageTaken > enemy.damageTaken ? '누적 피해가 더 큽니다. BATTLE 진입 전 수비 표시와 보호막을 점검하세요.' : '',
    !winner && Array.isArray(safe.chain) && safe.chain.length ? '체인이 쌓여 있습니다. 응답/해결 순서를 먼저 처리해야 합니다.' : '',
    winner ? '전적 저장 후 덱/로그를 비교하면 다음 밸런스 조정 포인트를 잡기 쉽습니다.' : '',
  ].filter(Boolean);

  if (!recommendations.length) {
    recommendations.push('현재 보드 균형이 좋습니다. 다음 페이즈 전 공격 가능한 몬스터와 세트 카드를 확인하세요.');
  }

  return {
    headline,
    eventCount: events.length,
    turn: Number(safe.turn || 1),
    phase: safe.phase || 'MAIN1',
    winner,
    winnerLabel: winner ? PLAYER_LABELS[winner] || winner : '진행 중',
    lpDiff,
    players: { player, enemy },
    typeRows: Object.entries(typeCounts)
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count || a.type.localeCompare(b.type))
      .slice(0, 6),
    highlights,
    recommendations,
  };
}

function replayPriorityForEvent(event) {
  const type = String(event?.type || '');
  if (type === 'WIN' || type === 'LOSE') return 'decisive';
  if (type === 'DAMAGE_TAKEN' || type === 'ATTACK_DECLARE') {
    return parseLpDamage(event?.text) >= 1500 ? 'swing' : 'normal';
  }
  if (type === 'EFFECT_ACTIVATE') return 'chain';
  if (type === 'SUMMON' || type === 'SET') return 'tempo';
  return 'normal';
}

function replayEventLabel(event) {
  const actor = PLAYER_LABELS[event?.actor] || event?.actor || '시스템';
  return `T${event?.turn || 1} ${event?.phase || 'MAIN1'} · ${actor} · ${event?.text || event?.type || '이벤트'}`;
}

export function replayTimelineForState(state) {
  const safe = state && typeof state === 'object' ? state : {};
  const events = Array.isArray(safe.events) ? safe.events : [];
  const chronological = events.slice().reverse();
  const rowsByTurn = new Map();
  let playerDamage = 0;
  let enemyDamage = 0;
  let chainActivations = 0;

  chronological.forEach((event) => {
    const turn = Math.max(1, Number(event?.turn || 1));
    const actor = PLAYERS.includes(event?.actor) ? event.actor : '';
    const phase = event?.phase || 'MAIN1';
    const type = String(event?.type || 'UNKNOWN');
    if (!rowsByTurn.has(turn)) {
      rowsByTurn.set(turn, {
        turn,
        phases: new Set(),
        eventCount: 0,
        playerActions: 0,
        enemyActions: 0,
        playerDamage: 0,
        enemyDamage: 0,
        chainCount: 0,
        tempoEvents: 0,
        decisiveEvents: 0,
        highlights: [],
      });
    }
    const row = rowsByTurn.get(turn);
    row.phases.add(phase);
    row.eventCount += 1;
    if (actor === 'player') row.playerActions += 1;
    if (actor === 'enemy') row.enemyActions += 1;
    if (type === 'EFFECT_ACTIVATE') {
      row.chainCount += 1;
      chainActivations += 1;
    }
    if (type === 'SUMMON' || type === 'SET' || type === 'EFFECT_ACTIVATE') row.tempoEvents += 1;
    if (type === 'WIN' || type === 'LOSE') row.decisiveEvents += 1;

    const damage = parseLpDamage(event?.text);
    if (damage > 0) {
      if (type === 'DAMAGE_TAKEN' && actor) {
        const dealer = opponent(actor);
        if (dealer === 'player') {
          row.playerDamage += damage;
          playerDamage += damage;
        } else {
          row.enemyDamage += damage;
          enemyDamage += damage;
        }
      } else if (type === 'ATTACK_DECLARE' && actor) {
        if (actor === 'player') {
          row.playerDamage += damage;
          playerDamage += damage;
        } else {
          row.enemyDamage += damage;
          enemyDamage += damage;
        }
      }
    }

    const priority = replayPriorityForEvent(event);
    if (priority !== 'normal' || row.highlights.length < 2) {
      row.highlights.push({
        id: event?.id || `${turn}-${row.eventCount}`,
        type,
        actor,
        priority,
        label: replayEventLabel(event),
      });
    }
  });

  const turnRows = [...rowsByTurn.values()].map((row) => {
    const swing = row.playerDamage - row.enemyDamage;
    const phaseText = [...row.phases].join(' / ') || '-';
    const tempoDelta = row.playerActions - row.enemyActions + row.tempoEvents;
    return {
      ...row,
      phases: phaseText,
      swing,
      tempoDelta,
      swingLabel: swing === 0 ? '균형' : swing > 0 ? `내가 ${swing} 우세` : `AI가 ${Math.abs(swing)} 우세`,
      highlights: row.highlights.slice(-4).reverse(),
    };
  }).sort((a, b) => b.turn - a.turn);

  const currentChain = Array.isArray(safe.chain) ? safe.chain : [];
  const chainAuditRows = currentChain.map((link, index) => ({
    order: currentChain.length - index,
    owner: link.owner,
    ownerLabel: PLAYER_LABELS[link.owner] || link.owner || '알 수 없음',
    cardName: link.cardName || link.cardId || '효과',
    effect: link.meta?.effect || 'effect',
    negated: Boolean(link.negated),
    source: link.source?.zone ? `${link.source.zone}${Number.isFinite(link.source.slot) ? ` ${link.source.slot + 1}` : ''}` : 'unknown',
  }));
  const prompt = safe.prompt && typeof safe.prompt === 'object' ? safe.prompt : { kind: 'NONE' };
  const chainStatus = currentChain.length
    ? `${currentChain.length}개 체인 대기 · ${prompt.kind === 'RESPOND' ? `${PLAYER_LABELS[prompt.player] || prompt.player} 응답 대기` : '해결 대기'}`
    : prompt.kind !== 'NONE'
      ? `${prompt.kind} 프롬프트 처리 필요`
      : '체인 없음';
  const latestTurn = turnRows[0] || null;
  const totalSwing = playerDamage - enemyDamage;
  const headline = latestTurn
    ? `T${latestTurn.turn}까지 ${events.length}건 · ${totalSwing >= 0 ? '내 우세' : 'AI 우세'} ${Math.abs(totalSwing)} LP`
    : '아직 리플레이 이벤트가 없습니다.';
  const exportText = turnRows
    .slice()
    .reverse()
    .map((row) => `T${row.turn} ${row.phases} | ${row.swingLabel} | 이벤트 ${row.eventCount} | ${row.highlights.map((item) => item.label).join(' / ')}`)
    .join('\n');
  const recommendations = [
    currentChain.length ? '체인 해결 전에는 새 행동보다 응답/해결 순서를 먼저 확인하세요.' : '',
    totalSwing < -2000 ? '누적 피해가 크게 밀립니다. 다음 MAIN 페이즈에서 수비 카드와 제거 효과를 우선하세요.' : '',
    totalSwing > 2000 && !safe.winner ? 'LP 우세가 큽니다. 배틀 페이즈에서 마무리 공격 가능 여부를 확인하세요.' : '',
    chainActivations >= 3 ? '효과 발동이 많았습니다. 리플레이에서 어느 효과가 템포를 만든 건지 확인해 덱 비율을 조정하세요.' : '',
  ].filter(Boolean);
  if (!recommendations.length) recommendations.push('타임라인은 안정적입니다. 최근 턴의 공격/효과 순서만 점검하면 됩니다.');

  return {
    headline,
    eventCount: events.length,
    turnCount: turnRows.length,
    totalSwing,
    playerDamage,
    enemyDamage,
    chainActivations,
    chainStatus,
    chainAuditRows,
    turnRows,
    exportText,
    recommendations,
  };
}

function replayCardSnapshot(card) {
  if (!card) return null;
  return {
    id: card.id || '',
    instanceId: card.instanceId || '',
    name: card.name || card.id || '카드',
    role: card.role || '',
    tags: Array.isArray(card.tags) ? card.tags.slice(0, 8) : [],
    owner: card.owner || '',
    face: card.face || 'up',
    position: card.position || '',
    attack: Number(card.attack || card.atk || 0),
    health: Number(card.health || 0),
    currentHealth: Number(card.currentHealth ?? card.health ?? 0),
    dataCounters: Number(card.dataCounters || 0),
    shield: Boolean(card.shield),
    hasAttacked: Boolean(card.hasAttacked),
  };
}

function replayPlayerSnapshot(playerState = {}) {
  return {
    lp: Number(playerState.lp || 0),
    deckCount: Array.isArray(playerState.deck) ? playerState.deck.length : 0,
    hand: (Array.isArray(playerState.hand) ? playerState.hand : []).map(replayCardSnapshot),
    graveCount: Array.isArray(playerState.grave) ? playerState.grave.length : 0,
    banishedCount: Array.isArray(playerState.banished) ? playerState.banished.length : 0,
    monster: (Array.isArray(playerState.monster) ? playerState.monster : cloneZone()).map(replayCardSnapshot),
    spellTrap: (Array.isArray(playerState.spellTrap) ? playerState.spellTrap : cloneZone()).map(replayCardSnapshot),
    field: replayCardSnapshot(playerState.field),
  };
}

function replayEventSnapshot(event, index) {
  return {
    id: event?.id || `event-${index + 1}`,
    at: event?.at || '',
    turn: Math.max(1, Number(event?.turn || 1)),
    phase: event?.phase || 'MAIN1',
    type: event?.type || 'UNKNOWN',
    actor: PLAYERS.includes(event?.actor) ? event.actor : '',
    text: event?.text || '',
    priority: replayPriorityForEvent(event),
    payload: event?.payload && typeof event.payload === 'object' ? event.payload : {},
  };
}

function replayAuditRows({ current, payload, report, timeline, jsonText }) {
  const events = Array.isArray(current.events) ? current.events : [];
  const chain = Array.isArray(current.chain) ? current.chain : [];
  const prompt = current.prompt && typeof current.prompt === 'object' ? current.prompt : { kind: 'NONE' };
  const versionOk = String(current.version || '') === ENGINE_VERSION;
  const missingEventFields = events.filter((event) => !event?.id || !event?.type || !event?.text).length;
  const payloadReady = Boolean(payload?.match?.matchId && Array.isArray(payload?.events));
  const sizeKb = Math.max(1, Math.ceil(String(jsonText || '').length / 1024));

  return [
    {
      id: 'payload',
      label: '패키지',
      status: payloadReady ? 'OK' : '확인 필요',
      detail: payloadReady ? `matchId ${payload.match.matchId} 기준으로 리플레이 패키지를 구성했습니다.` : 'matchId 또는 이벤트 배열이 비어 있습니다.',
      tone: payloadReady ? 'green' : 'gold',
    },
    {
      id: 'events',
      label: '이벤트',
      status: missingEventFields ? '확인 필요' : 'OK',
      detail: `${events.length}건 중 필수 필드 누락 ${missingEventFields}건입니다.`,
      tone: missingEventFields ? 'gold' : 'green',
    },
    {
      id: 'timeline',
      label: '타임라인',
      status: timeline.turnRows.length ? 'OK' : '대기',
      detail: `턴 ${timeline.turnCount}개, 효과 발동 ${timeline.chainActivations}회, LP 스윙 ${timeline.totalSwing}입니다.`,
      tone: timeline.turnRows.length ? 'green' : 'gold',
    },
    {
      id: 'chain',
      label: '체인',
      status: chain.length ? '대기 중' : 'OK',
      detail: chain.length ? `${chain.length}개 체인이 아직 해결되지 않았습니다. ${timeline.chainStatus}` : '대기 중인 체인이 없습니다.',
      tone: chain.length ? 'gold' : 'green',
    },
    {
      id: 'prompt',
      label: '프롬프트',
      status: prompt.kind === 'NONE' ? 'OK' : '대기 중',
      detail: prompt.kind === 'NONE' ? '선택/응답 프롬프트가 없습니다.' : `${prompt.kind} 프롬프트가 남아 있습니다.`,
      tone: prompt.kind === 'NONE' ? 'green' : 'gold',
    },
    {
      id: 'report',
      label: '리포트',
      status: report.eventCount === events.length ? 'OK' : '확인 필요',
      detail: `리포트 이벤트 ${report.eventCount}건 / 원본 이벤트 ${events.length}건입니다.`,
      tone: report.eventCount === events.length ? 'green' : 'gold',
    },
    {
      id: 'version',
      label: '엔진',
      status: versionOk ? 'OK' : '버전 차이',
      detail: `${current.version || 'unknown'} / 현재 ${ENGINE_VERSION}`,
      tone: versionOk ? 'green' : 'gold',
    },
    {
      id: 'size',
      label: '크기',
      status: sizeKb <= 512 ? 'OK' : '큼',
      detail: `약 ${sizeKb.toLocaleString('ko-KR')}KB JSON입니다.`,
      tone: sizeKb <= 512 ? 'green' : 'gold',
    },
  ];
}

export function replayExportForState(state) {
  const current = normalizeDuelState(state) || createDuelState();
  const report = matchReportForState(current);
  const timeline = replayTimelineForState(current);
  const chronologicalEvents = (Array.isArray(current.events) ? current.events : [])
    .slice()
    .reverse()
    .map(replayEventSnapshot);
  const matchId = current.matchId || nowId('match');
  const safeMatchId = String(matchId).replace(/[^a-zA-Z0-9_-]/g, '-');
  const payload = {
    format: 'dual-academy-replay-v1',
    gameSlug: 'dual-academy-tcg',
    engineVersion: current.version || ENGINE_VERSION,
    exportedAt: new Date().toISOString(),
    match: {
      matchId,
      startedAt: current.startedAt || '',
      turn: Number(current.turn || 1),
      phase: current.phase || 'MAIN1',
      turnPlayer: current.turnPlayer || 'player',
      winner: current.winner || '',
      winnerLabel: report.winnerLabel,
      headline: report.headline,
    },
    players: {
      player: replayPlayerSnapshot(current.players?.player),
      enemy: replayPlayerSnapshot(current.players?.enemy),
    },
    characters: normalizeTcgCharacters(current.characters),
    report: {
      headline: report.headline,
      eventCount: report.eventCount,
      lpDiff: report.lpDiff,
      typeRows: report.typeRows,
      highlights: report.highlights,
      recommendations: report.recommendations,
      players: report.players,
    },
    timeline: {
      headline: timeline.headline,
      eventCount: timeline.eventCount,
      turnCount: timeline.turnCount,
      totalSwing: timeline.totalSwing,
      playerDamage: timeline.playerDamage,
      enemyDamage: timeline.enemyDamage,
      chainActivations: timeline.chainActivations,
      chainStatus: timeline.chainStatus,
      chainAuditRows: timeline.chainAuditRows,
      turnRows: timeline.turnRows,
      recommendations: timeline.recommendations,
    },
    prompt: current.prompt,
    chain: Array.isArray(current.chain) ? current.chain : [],
    events: chronologicalEvents,
    serializedState: serializeDuelState(current),
  };
  const jsonText = JSON.stringify(payload, null, 2);
  const auditRows = replayAuditRows({ current, payload, report, timeline, jsonText });
  const blockingRows = auditRows.filter((row) => row.status !== 'OK' && row.id !== 'chain' && row.id !== 'prompt');
  const pendingRows = auditRows.filter((row) => row.status !== 'OK');
  const byteSize = jsonText.length;
  const sizeKb = Math.max(1, Math.ceil(byteSize / 1024));

  return {
    format: payload.format,
    fileName: `dual-academy-replay-${safeMatchId}.json`,
    payload,
    jsonText,
    previewText: jsonText.length > 4200 ? `${jsonText.slice(0, 4200)}\n...` : jsonText,
    byteSize,
    sizeLabel: `${sizeKb.toLocaleString('ko-KR')}KB`,
    eventCount: chronologicalEvents.length,
    turnCount: timeline.turnCount,
    auditRows,
    statusLabel: pendingRows.length ? `${pendingRows.length}건 확인` : '내보내기 가능',
    ready: blockingRows.length === 0,
  };
}

export function drawCards(state, player, count = 1) {
  let next = state;
  for (let index = 0; index < count; index += 1) {
    const ps = next.players[player];
    if (!ps.deck.length) {
      return finishGame(emit(next, 'LOSE', player, '덱이 비어 패배했습니다.'), opponent(player));
    }
    const [top, ...deck] = ps.deck;
    const drawn = { ...top, face: 'up' };
    next = {
      ...next,
      players: {
        ...next.players,
        [player]: {
          ...ps,
          deck,
          hand: [...ps.hand, drawn],
        },
      },
    };
  }
  return emit(next, 'DRAW', player, `${count}장 드로우했습니다.`);
}

function canMainPhase(state) {
  return state.phase === 'MAIN1' || state.phase === 'MAIN2';
}

function isLocked(state) {
  return Boolean(state.winner || state.prompt.kind !== 'NONE' || state.chain.length > 0);
}

function updatePlayer(state, player, updater) {
  return {
    ...state,
    players: {
      ...state.players,
      [player]: updater(state.players[player]),
    },
  };
}

function effectUsed(ps, key) {
  return Boolean(ps?.flags?.usedEffects?.[key]);
}

function markEffectUsed(ps, key) {
  return {
    ...ps,
    flags: {
      ...ps.flags,
      usedEffects: {
        ...ps.flags.usedEffects,
        [key]: true,
      },
    },
  };
}

function finishGame(state, winner) {
  if (!PLAYERS.includes(winner) || state.winner) return state;
  const won = emit({
    ...state,
    winner,
  }, 'WIN', winner, `${PLAYER_LABELS[winner]} 승리`);
  return emit(won, 'LOSE', opponent(winner), `${PLAYER_LABELS[opponent(winner)]} 패배`);
}

function firstEmpty(zone) {
  return zone.findIndex((row) => !row);
}

function removeHandCard(ps, instanceId) {
  const index = ps.hand.findIndex((card) => card.instanceId === instanceId);
  if (index < 0) return null;
  const hand = ps.hand.slice();
  const [card] = hand.splice(index, 1);
  return { card, hand };
}

export function normalSummon(state, instanceId, slot) {
  const player = state.turnPlayer;
  if (isLocked(state) || !canMainPhase(state)) return emit(state, 'PROMPT', player, 'MAIN 페이즈에만 소환할 수 있습니다.');
  const ps = state.players[player];
  if (ps.flags.normalSummoned) return emit(state, 'PROMPT', player, '이번 턴에는 이미 일반 소환했습니다.');
  if (slot < 0 || slot >= ZONE_SIZE || ps.monster[slot]) return emit(state, 'PROMPT', player, '해당 몬스터 존을 사용할 수 없습니다.');
  const picked = removeHandCard(ps, instanceId);
  if (!picked) return state;
  if (cardType(picked.card) !== 'Monster') return emit(state, 'PROMPT', player, '몬스터 카드만 소환할 수 있습니다.');

  const monster = ps.monster.slice();
  monster[slot] = {
    ...picked.card,
    face: 'up',
    position: 'ATK',
    currentHealth: Math.max(1, Number(picked.card.health || 1)),
    hasAttacked: false,
  };

  let next = {
    ...state,
    players: {
      ...state.players,
      [player]: {
        ...ps,
        hand: picked.hand,
        monster,
        flags: { ...ps.flags, normalSummoned: true },
      },
    },
  };
  next = emit(next, 'SUMMON', player, `${picked.card.name} 일반 소환`);
  if (picked.card.id === 'MIL-YUUKA-01') {
    next = {
      ...next,
      prompt: {
        kind: 'TRIGGER_CONFIRM',
        player,
        title: `${picked.card.name}: 덱에서 마법 1장을 패에 넣겠습니까?`,
        slot,
      },
    };
  }
  return next;
}

export function setSpellTrap(state, instanceId, slot) {
  const player = state.turnPlayer;
  if (isLocked(state) || !canMainPhase(state)) return emit(state, 'PROMPT', player, 'MAIN 페이즈에만 세트할 수 있습니다.');
  const ps = state.players[player];
  if (slot < 0 || slot >= ZONE_SIZE || ps.spellTrap[slot]) return emit(state, 'PROMPT', player, '해당 마법/함정 존을 사용할 수 없습니다.');
  const picked = removeHandCard(ps, instanceId);
  if (!picked) return state;
  if (cardType(picked.card) === 'Monster') return emit(state, 'PROMPT', player, '마법/함정 카드만 세트할 수 있습니다.');

  const spellTrap = ps.spellTrap.slice();
  spellTrap[slot] = { ...picked.card, face: 'down' };
  return emit({
    ...state,
    players: {
      ...state.players,
      [player]: {
        ...ps,
        hand: picked.hand,
        spellTrap,
      },
    },
  }, 'SET', player, `${picked.card.name} 세트`);
}

function makeChainLink(owner, source, card, meta = {}) {
  return {
    chainId: nowId('chain'),
    owner,
    source,
    cardId: card.id,
    cardName: card.name,
    negated: false,
    meta,
  };
}

function openResponse(state, link) {
  return {
    ...state,
    chain: [link, ...state.chain],
    prompt: { kind: 'RESPOND', player: opponent(link.owner), toChainId: link.chainId },
  };
}

export function activateFromHand(state, instanceId, slot = 0) {
  const player = state.turnPlayer;
  if (isLocked(state) || !canMainPhase(state)) return emit(state, 'PROMPT', player, 'MAIN 페이즈에만 발동할 수 있습니다.');
  const ps = state.players[player];
  const picked = removeHandCard(ps, instanceId);
  if (!picked) return state;
  const type = cardType(picked.card);
  if (type === 'Monster') return emit(state, 'PROMPT', player, '몬스터는 소환해야 합니다.');
  if (type === 'Trap') return emit(state, 'PROMPT', player, '함정은 먼저 세트해야 합니다.');

  const subtype = spellSubType(picked.card);
  let next;
  let source;
  if (subtype === 'Field') {
    const grave = [...ps.grave];
    if (ps.field) grave.push({ ...ps.field, face: 'up' });
    next = {
      ...state,
      players: {
        ...state.players,
        [player]: {
          ...ps,
          hand: picked.hand,
          field: { ...picked.card, face: 'up' },
          grave,
        },
      },
    };
    source = { zone: 'field', slot: 0 };
  } else {
    next = {
      ...state,
      players: {
        ...state.players,
        [player]: {
          ...ps,
          hand: picked.hand,
          grave: [...ps.grave, { ...picked.card, face: 'up' }],
        },
      },
    };
    source = { zone: 'hand', slot };
  }

  const link = makeChainLink(player, source, picked.card, { effect: effectKey(picked.card), fromHand: true });
  next = emit(next, 'EFFECT_ACTIVATE', player, `${picked.card.name} 발동`);
  return openResponse(next, link);
}

export function activateSetCard(state, slot) {
  const player = state.turnPlayer;
  if (isLocked(state) || !canMainPhase(state)) return emit(state, 'PROMPT', player, 'MAIN 페이즈에만 발동할 수 있습니다.');
  const ps = state.players[player];
  const card = ps.spellTrap[slot];
  if (!card) return state;
  if (cardType(card) === 'Trap' && spellSubType(card) === 'Counter') {
    return emit(state, 'PROMPT', player, '카운터 함정은 체인 응답 창에서만 발동합니다.');
  }
  const spellTrap = ps.spellTrap.slice();
  spellTrap[slot] = { ...card, face: 'up' };
  let next = updatePlayer(state, player, (current) => ({ ...current, spellTrap }));
  const link = makeChainLink(player, { zone: 'spellTrap', slot }, card, { effect: effectKey(card) });
  next = emit(next, 'EFFECT_ACTIVATE', player, `${card.name} 발동`);
  return openResponse(next, link);
}

export function activateCounterTrap(state, player, slot) {
  if (state.prompt.kind !== 'RESPOND' || state.prompt.player !== player || !state.chain.length) return state;
  const ps = state.players[player];
  const card = ps.spellTrap[slot];
  if (!card || cardType(card) !== 'Trap' || spellSubType(card) !== 'Counter') return emit(state, 'PROMPT', player, '발동 가능한 카운터 함정이 아닙니다.');
  const spellTrap = ps.spellTrap.slice();
  spellTrap[slot] = { ...card, face: 'up' };
  let next = updatePlayer(state, player, (current) => ({ ...current, spellTrap }));
  const link = makeChainLink(player, { zone: 'spellTrap', slot }, card, {
    effect: 'counter-negate',
    targetChainId: state.prompt.toChainId,
  });
  next = emit(next, 'EFFECT_ACTIVATE', player, `${card.name} 카운터 발동`);
  return {
    ...next,
    chain: [link, ...state.chain],
    prompt: { kind: 'RESPOND', player: opponent(player), toChainId: link.chainId },
  };
}

const MIKA_QUICK_EFFECT_KEY = 'TRI-MIKA-01:MIKA_QUICK_2';

function isFaceUp(card) {
  return Boolean(card) && card.face !== 'down' && card.face !== 'FaceDown';
}

function isTrinityCard(card) {
  return String(card?.academy || '').includes('트리니티') || card?.tags?.includes('trinity');
}

export function mikaNegateCostOptions(state, player, mikaSlot) {
  const ps = state.players[player];
  if (!ps) return [];
  const options = [];
  ps.monster.forEach((card, slot) => {
    if (!card || slot === mikaSlot || !isTrinityCard(card)) return;
    options.push({ zone: 'monster', slot, label: `몬스터 ${slot + 1}: ${card.name}` });
  });
  ps.spellTrap.forEach((card, slot) => {
    if (!card || !isTrinityCard(card)) return;
    options.push({
      zone: 'spellTrap',
      slot,
      label: `마법/함정 ${slot + 1}: ${card.name} (${isFaceUp(card) ? '앞면' : '세트'})`,
    });
  });
  if (ps.field && isTrinityCard(ps.field)) {
    options.push({ zone: 'field', slot: 0, label: `필드: ${ps.field.name}` });
  }
  return options;
}

export function mikaQuickReadiness(state, player = state.prompt?.player) {
  if (state.prompt?.kind !== 'RESPOND' || state.prompt.player !== player) {
    return { canActivate: false, reason: '상대 효과의 체인 응답 창에서만 발동할 수 있습니다.', mikaSlot: -1, options: [] };
  }
  const ps = state.players[player];
  const mikaSlot = ps?.monster?.findIndex((card) => isFaceUp(card) && card.id === 'TRI-MIKA-01') ?? -1;
  if (mikaSlot < 0) return { canActivate: false, reason: '앞면 표시의 미카가 없습니다.', mikaSlot, options: [] };
  if (effectUsed(ps, MIKA_QUICK_EFFECT_KEY)) {
    return { canActivate: false, reason: '미카 ②는 이번 턴 이미 사용했습니다.', mikaSlot, options: [] };
  }
  const targetChainId = state.prompt.toChainId;
  const targetLink = state.chain.find((link) => link.chainId === targetChainId);
  if (!targetLink || targetLink.owner === player) {
    return { canActivate: false, reason: '무효로 할 상대 체인 효과가 없습니다.', mikaSlot, options: [] };
  }
  const options = mikaNegateCostOptions(state, player, mikaSlot);
  if (!options.length) {
    return { canActivate: false, reason: '묘지로 보낼 다른 트리니티 카드가 없습니다.', mikaSlot, options };
  }
  return { canActivate: true, reason: '', mikaSlot, targetChainId, options };
}

export function activateMikaQuick(state) {
  const player = state.prompt?.player;
  const readiness = mikaQuickReadiness(state, player);
  if (!readiness.canActivate) return emit(state, 'PROMPT', player || state.turnPlayer, readiness.reason);
  return {
    ...state,
    prompt: {
      kind: 'SELECT_COST_MIKA_NEGATE',
      player,
      mikaSlot: readiness.mikaSlot,
      targetChainId: readiness.targetChainId,
      title: '미카 ②: 묘지로 보낼 트리니티 카드 선택',
      options: readiness.options,
    },
  };
}

function sendMikaCostToGrave(state, player, option) {
  const ps = state.players[player];
  if (option.zone === 'monster') {
    const card = ps.monster[option.slot];
    if (!card) return null;
    const monster = ps.monster.slice();
    monster[option.slot] = null;
    return {
      card,
      state: updatePlayer(state, player, (current) => ({
        ...current,
        monster,
        grave: [...current.grave, { ...card, face: 'up' }],
      })),
    };
  }
  if (option.zone === 'spellTrap') {
    const card = ps.spellTrap[option.slot];
    if (!card) return null;
    const spellTrap = ps.spellTrap.slice();
    spellTrap[option.slot] = null;
    return {
      card,
      state: updatePlayer(state, player, (current) => ({
        ...current,
        spellTrap,
        grave: [...current.grave, { ...card, face: 'up' }],
      })),
    };
  }
  if (option.zone === 'field') {
    const card = ps.field;
    if (!card) return null;
    return {
      card,
      state: updatePlayer(state, player, (current) => ({
        ...current,
        field: null,
        grave: [...current.grave, { ...card, face: 'up' }],
      })),
    };
  }
  return null;
}

export function chooseMikaNegateCost(state, target) {
  if (state.prompt.kind !== 'SELECT_COST_MIKA_NEGATE') return state;
  const { player, mikaSlot, targetChainId } = state.prompt;
  const option = state.prompt.options.find((row) => row.zone === target?.zone && Number(row.slot) === Number(target?.slot));
  if (!option) return emit(state, 'PROMPT', player, '선택할 수 없는 미카 효과 코스트입니다.');
  const ps = state.players[player];
  const mika = ps.monster[mikaSlot];
  if (!isFaceUp(mika) || mika.id !== 'TRI-MIKA-01') return emit(state, 'PROMPT', player, '미카가 필드에서 벗어났습니다.');
  if (effectUsed(ps, MIKA_QUICK_EFFECT_KEY)) return emit(state, 'PROMPT', player, '미카 ②는 이번 턴 이미 사용했습니다.');
  const targetLink = state.chain.find((link) => link.chainId === targetChainId);
  if (!targetLink || targetLink.owner === player) return emit(state, 'PROMPT', player, '무효로 할 상대 체인 효과가 없습니다.');
  const currentCostOptions = mikaNegateCostOptions(state, player, mikaSlot);
  if (!currentCostOptions.some((row) => row.zone === option.zone && row.slot === option.slot)) {
    return emit(state, 'PROMPT', player, '선택한 트리니티 카드가 더 이상 필드에 없습니다.');
  }
  const paid = sendMikaCostToGrave(state, player, option);
  if (!paid) return emit(state, 'PROMPT', player, '미카 효과 코스트를 지불하지 못했습니다.');
  let next = updatePlayer(paid.state, player, (current) => markEffectUsed(current, MIKA_QUICK_EFFECT_KEY));
  const link = makeChainLink(player, { zone: 'monster', slot: mikaSlot }, mika, {
    effect: 'mika-negate',
    targetChainId,
    cost: { zone: option.zone, slot: option.slot, cardId: paid.card.id, cardName: paid.card.name },
  });
  next = emit(
    next,
    'EFFECT_ACTIVATE',
    player,
    `미카 ②: ${paid.card.name}을(를) 묘지로 보내고 ${targetLink.cardName}의 발동을 무효로 합니다.`,
    { effect: 'mika-negate', costCardName: paid.card.name, targetCardName: targetLink.cardName, targetChainId },
  );
  return {
    ...next,
    chain: [link, ...next.chain],
    prompt: { kind: 'RESPOND', player: opponent(player), toChainId: link.chainId },
  };
}

export function passResponse(state) {
  if (state.prompt.kind !== 'RESPOND') return state;
  return {
    ...state,
    prompt: { kind: 'NONE' },
  };
}

export function confirmTrigger(state, accept) {
  if (state.prompt.kind !== 'TRIGGER_CONFIRM') return state;
  const { player, slot } = state.prompt;
  let next = { ...state, prompt: { kind: 'NONE' } };
  if (!accept) return emit(next, 'PROMPT', player, '유우카 트리거를 넘겼습니다.');
  const ps = next.players[player];
  const monster = ps.monster[slot];
  if (!monster || monster.id !== 'MIL-YUUKA-01') return emit(next, 'PROMPT', player, '유우카가 필드에 없습니다.');
  const key = 'MIL-YUUKA-01:YUUKA_TRIGGER_1';
  if (effectUsed(ps, key)) return emit(next, 'PROMPT', player, '이번 턴 이미 사용한 효과입니다.');
  const options = ps.deck
    .map((card, deckIndex) => ({ card, deckIndex }))
    .filter(({ card }) => cardType(card) === 'Spell' && String(card.academy || '').includes('밀레니엄'))
    .map(({ card, deckIndex }) => ({
      deckIndex,
      cardId: card.id,
      label: `${card.name} (${cardKindLabel(card)})`,
    }));
  if (!options.length) return emit(next, 'PROMPT', player, '덱에 가져올 밀레니엄 마법 카드가 없습니다.');
  const link = makeChainLink(player, { zone: 'monster', slot }, monster, { effect: 'yuuka-search' });
  next = updatePlayer(next, player, (current) => markEffectUsed(current, key));
  next = emit(
    next,
    'EFFECT_ACTIVATE',
    player,
    `${monster.name} ① 발동: 덱에서 밀레니엄 마법을 선택합니다.`,
    { effect: 'yuuka-search' },
  );
  return {
    ...next,
    chain: [link, ...next.chain],
    prompt: { kind: 'SELECT_FROM_DECK', player, chainId: link.chainId, title: '유우카 ①: 덱에서 밀레니엄 마법 1장 선택', options },
  };
}

function cardKindLabel(card) {
  const kind = cardType(card);
  const subtype = spellSubType(card);
  return kind === 'Monster' ? kind : `${kind}/${subtype}`;
}

export function chooseFromDeck(state, deckIndex) {
  if (state.prompt.kind !== 'SELECT_FROM_DECK') return state;
  const { player, chainId } = state.prompt;
  const picked = state.prompt.options.find((option) => Number(option.deckIndex) === Number(deckIndex));
  if (!picked) return emit(state, 'PROMPT', player, '선택할 수 없는 카드입니다.');
  const chain = state.chain.map((link) => (
    link.chainId === chainId
      ? { ...link, meta: { ...link.meta, deckIndex: picked.deckIndex, pickedCardId: picked.cardId } }
      : link
  ));
  return resolveChain({
    ...state,
    chain,
    prompt: { kind: 'NONE' },
  });
}

export function activateHinaIgnition(state, slot) {
  const player = state.turnPlayer;
  if (isLocked(state) || !canMainPhase(state)) return emit(state, 'PROMPT', player, 'MAIN 페이즈에만 히나 효과를 사용할 수 있습니다.');
  const ps = state.players[player];
  const card = ps.monster[slot];
  if (!card || card.id !== 'GEH-HINA-01') return emit(state, 'PROMPT', player, '해당 몬스터 존에 히나가 없습니다.');
  const key = 'GEH-HINA-01:HINA_IGNITION_2';
  if (effectUsed(ps, key)) return emit(state, 'PROMPT', player, '히나 ②는 이번 턴 이미 사용했습니다.');
  if (ps.lp <= 800) return emit(state, 'PROMPT', player, '히나 ②를 사용하려면 LP가 801 이상 필요합니다.');
  const paid = updatePlayer(state, player, (current) => markEffectUsed({ ...current, lp: current.lp - 800 }, key));
  const link = makeChainLink(player, { zone: 'monster', slot }, card, { effect: 'hina-destroy-any' });
  const options = targetOptions(paid, player, 'hina-destroy-any');
  let next = emit(
    paid,
    'EFFECT_ACTIVATE',
    player,
    `${card.name} ② 발동: LP 800을 지불하고 필드 카드 1장을 파괴합니다.`,
    { effect: 'hina-destroy-any', lpCost: 800 },
  );
  if (!options.length) return emit(next, 'PROMPT', player, '파괴할 카드가 없습니다.');
  return {
    ...next,
    chain: [link, ...next.chain],
    prompt: { kind: 'SELECT_TARGET', player, chainId: link.chainId, title: '히나 ②: 파괴할 카드 선택', options },
  };
}

export function activateYuukaQuick(state, slot) {
  const player = state.turnPlayer;
  if (isLocked(state) || !canMainPhase(state)) return emit(state, 'PROMPT', player, 'MAIN 페이즈에만 유우카 효과를 사용할 수 있습니다.');
  const ps = state.players[player];
  const card = ps.monster[slot];
  if (!card || card.id !== 'MIL-YUUKA-01') return emit(state, 'PROMPT', player, '해당 몬스터 존에 유우카가 없습니다.');
  const key = 'MIL-YUUKA-01:YUUKA_IGNITION_2';
  if (effectUsed(ps, key)) return emit(state, 'PROMPT', player, '유우카 ②는 이번 턴 이미 사용했습니다.');
  const marked = updatePlayer(state, player, (current) => markEffectUsed(current, key));
  const link = makeChainLink(player, { zone: 'monster', slot }, card, { effect: 'yuuka-data-shield' });
  const options = targetOptions(marked, player, 'own-card');
  let next = emit(
    marked,
    'EFFECT_ACTIVATE',
    player,
    `${card.name} ② 발동: 자신 필드 카드에 DATA와 대상 보호를 부여합니다.`,
    { effect: 'yuuka-data-shield' },
  );
  if (!options.length) return emit(next, 'PROMPT', player, '대상으로 선택할 자신 필드 카드가 없습니다.');
  return {
    ...next,
    chain: [link, ...next.chain],
    prompt: { kind: 'SELECT_TARGET', player, chainId: link.chainId, title: '유우카 ②: DATA와 대상 보호를 부여할 카드 선택', options },
  };
}

function findTargetForEffect(state, owner, effect) {
  const op = opponent(owner);
  if (effect === 'destroy-enemy-unit') {
    const slot = weakestMonsterSlot(state.players[op].monster);
    return slot >= 0 ? { player: op, zone: 'monster', slot } : null;
  }
  if (effect === 'banish-enemy-card') {
    const monsterSlot = strongestMonsterSlot(state.players[op].monster);
    if (monsterSlot >= 0) return { player: op, zone: 'monster', slot: monsterSlot };
    const stSlot = state.players[op].spellTrap.findIndex(Boolean);
    if (stSlot >= 0) return { player: op, zone: 'spellTrap', slot: stSlot };
    if (state.players[op].field) return { player: op, zone: 'field', slot: 0 };
  }
  if (effect === 'hina-destroy-any') {
    const enemyMonsterSlot = strongestMonsterSlot(state.players[op].monster);
    if (enemyMonsterSlot >= 0) return { player: op, zone: 'monster', slot: enemyMonsterSlot };
    const enemyStSlot = state.players[op].spellTrap.findIndex(Boolean);
    if (enemyStSlot >= 0) return { player: op, zone: 'spellTrap', slot: enemyStSlot };
    if (state.players[op].field) return { player: op, zone: 'field', slot: 0 };
  }
  return null;
}

function weakestMonsterSlot(zone) {
  let best = -1;
  zone.forEach((card, index) => {
    if (!card) return;
    if (best < 0 || Number(card.currentHealth || card.health || 0) < Number(zone[best].currentHealth || zone[best].health || 0)) best = index;
  });
  return best;
}

function strongestMonsterSlot(zone) {
  let best = -1;
  zone.forEach((card, index) => {
    if (!card) return;
    const value = Number(card.attack || 0) + Number(card.currentHealth || card.health || 0);
    const bestValue = best >= 0 ? Number(zone[best].attack || 0) + Number(zone[best].currentHealth || zone[best].health || 0) : -1;
    if (value > bestValue) best = index;
  });
  return best;
}

export function chooseTarget(state, target) {
  if (state.prompt.kind !== 'SELECT_TARGET') return state;
  return resolveChain({
    ...state,
    chain: state.chain.map((link) => (
      link.chainId === state.prompt.chainId ? { ...link, meta: { ...link.meta, target } } : link
    )),
    prompt: { kind: 'NONE' },
  });
}

function removePersistentSource(state, link) {
  const owner = link.owner;
  const ps = state.players[owner];
  if (link.source.zone === 'spellTrap') {
    const current = ps.spellTrap[link.source.slot];
    if (!current || current.id !== link.cardId) return state;
    const spellTrap = ps.spellTrap.slice();
    spellTrap[link.source.slot] = null;
    return updatePlayer(state, owner, (player) => ({ ...player, spellTrap, grave: [...player.grave, { ...current, face: 'up' }] }));
  }
  if (link.source.zone === 'monster') {
    const current = ps.monster[link.source.slot];
    if (!current || current.id !== link.cardId) return state;
    const monster = ps.monster.slice();
    monster[link.source.slot] = null;
    return updatePlayer(state, owner, (player) => ({ ...player, monster, grave: [...player.grave, { ...current, face: 'up' }] }));
  }
  if (link.source.zone === 'field') {
    const current = ps.field;
    if (!current || current.id !== link.cardId) return state;
    return updatePlayer(state, owner, (player) => ({ ...player, field: null, grave: [...player.grave, { ...current, face: 'up' }] }));
  }
  return state;
}

function applySimpleEffect(state, owner, card, target, effectOverride = '', meta = {}) {
  const op = opponent(owner);
  const effect = effectOverride || effectKey(card);
  if (effect === 'yuuka-search') {
    const deckIndex = Number(meta.deckIndex);
    const ps = state.players[owner];
    const picked = ps.deck[deckIndex];
    if (!picked) return emit(state, 'EFFECT_ACTIVATE', owner, `${card.name} 효과로 가져올 카드가 없습니다.`, { effect: 'yuuka-search' });
    const deck = ps.deck.slice();
    const [drawn] = deck.splice(deckIndex, 1);
    return emit(
      updatePlayer(state, owner, (player) => ({ ...player, deck, hand: [...player.hand, { ...drawn, face: 'up' }] })),
      'EFFECT_ACTIVATE',
      owner,
      `유우카 ①: ${drawn.name}를 패에 넣었습니다.`,
      { effect: 'yuuka-search', cardId: drawn.id, cardName: drawn.name },
    );
  }
  if (effect === 'damage') {
    const amount = effectAmount(card, 3) * 400;
    const nextLp = Math.max(0, state.players[op].lp - amount);
    let next = updatePlayer(state, op, (player) => ({ ...player, lp: nextLp }));
    next = emit(next, 'DAMAGE_TAKEN', op, `${card.name} 효과로 ${amount} LP 피해`);
    return nextLp <= 0 ? finishGame(next, owner) : next;
  }
  if (effect === 'heal') {
    const amount = effectAmount(card, 3) * 400;
    return emit(updatePlayer(state, owner, (player) => ({ ...player, lp: Math.min(99999, player.lp + amount) })), 'EFFECT_ACTIVATE', owner, `${card.name} 효과로 ${amount} LP 회복`);
  }
  if (effect === 'draw' || effect === 'draw-heal') {
    let next = drawCards(state, owner, effectAmount(card, 1));
    if (effect === 'draw-heal') next = updatePlayer(next, owner, (player) => ({ ...player, lp: player.lp + 400 }));
    return emit(next, 'EFFECT_ACTIVATE', owner, `${card.name} 효과를 처리했습니다.`);
  }
  if (effect === 'shield') {
    const slot = weakestMonsterSlot(state.players[owner].monster);
    if (slot >= 0) {
      const monster = state.players[owner].monster.slice();
      monster[slot] = { ...monster[slot], shield: true, protectedUntilTurn: state.turn };
      return emit(updatePlayer(state, owner, (player) => ({ ...player, monster })), 'EFFECT_ACTIVATE', owner, `${monster[slot].name}에 보호막을 부여했습니다.`, { effect: 'shield' });
    }
    return updatePlayer(state, owner, (player) => ({ ...player, lp: player.lp + 400 }));
  }
  if (effect === 'yuuka-data-shield') {
    if (!target) return emit(state, 'EFFECT_ACTIVATE', owner, `${card.name} 효과 대상이 없습니다.`);
    return applyDataShield(state, target, owner, card.name);
  }
  if (effect === 'destroy-enemy-unit' || effect === 'banish-enemy-card' || effect === 'hina-destroy-any') {
    const actualTarget = target || findTargetForEffect(state, owner, effect);
    if (!actualTarget) return emit(state, 'EFFECT_ACTIVATE', owner, `${card.name} 효과 대상이 없습니다.`);
    return removeTarget(state, actualTarget, effect === 'banish-enemy-card' ? 'banish' : 'destroy', owner, card.name, effect);
  }
  return emit(state, 'EFFECT_ACTIVATE', owner, `${card.name} 효과를 처리했습니다.`);
}

function applyDataShield(state, target, actor, sourceName) {
  const ps = state.players[target.player];
  const applyToCard = (card) => ({
    ...card,
    dataCounters: Number(card?.dataCounters || 0) + 1,
    shield: true,
    protectedUntilTurn: state.turn,
  });
  if (target.zone === 'monster') {
    const monster = ps.monster.slice();
    const card = monster[target.slot];
    if (!card) return state;
    monster[target.slot] = applyToCard(card);
    return emit(
      updatePlayer(state, target.player, (player) => ({ ...player, monster })),
      'EFFECT_ACTIVATE',
      actor,
      `${sourceName}: ${card.name}에 DATA +1 / 대상 보호`,
      { effect: 'yuuka-data-shield', targetCardName: card.name },
    );
  }
  if (target.zone === 'spellTrap') {
    const spellTrap = ps.spellTrap.slice();
    const card = spellTrap[target.slot];
    if (!card) return state;
    spellTrap[target.slot] = applyToCard(card);
    return emit(
      updatePlayer(state, target.player, (player) => ({ ...player, spellTrap })),
      'EFFECT_ACTIVATE',
      actor,
      `${sourceName}: ${card.name}에 DATA +1 / 대상 보호`,
      { effect: 'yuuka-data-shield', targetCardName: card.name },
    );
  }
  if (target.zone === 'field') {
    const card = ps.field;
    if (!card) return state;
    return emit(
      updatePlayer(state, target.player, (player) => ({ ...player, field: applyToCard(card) })),
      'EFFECT_ACTIVATE',
      actor,
      `${sourceName}: ${card.name}에 DATA +1 / 대상 보호`,
      { effect: 'yuuka-data-shield', targetCardName: card.name },
    );
  }
  return state;
}

function removeTarget(state, target, mode, actor, sourceName, effect = '') {
  const ps = state.players[target.player];
  if (target.zone === 'monster') {
    const monster = ps.monster.slice();
    const card = monster[target.slot];
    if (!card) return state;
    monster[target.slot] = null;
    return emit(updatePlayer(state, target.player, (player) => ({
      ...player,
      monster,
      [mode === 'banish' ? 'banished' : 'grave']: [...player[mode === 'banish' ? 'banished' : 'grave'], { ...card, face: 'up' }],
    })), 'EFFECT_ACTIVATE', actor, `${sourceName}: ${card.name} ${mode === 'banish' ? '제외' : '파괴'}`, { effect, targetCardName: card.name });
  }
  if (target.zone === 'spellTrap') {
    const spellTrap = ps.spellTrap.slice();
    const card = spellTrap[target.slot];
    if (!card) return state;
    spellTrap[target.slot] = null;
    return emit(updatePlayer(state, target.player, (player) => ({
      ...player,
      spellTrap,
      [mode === 'banish' ? 'banished' : 'grave']: [...player[mode === 'banish' ? 'banished' : 'grave'], { ...card, face: 'up' }],
    })), 'EFFECT_ACTIVATE', actor, `${sourceName}: ${card.name} ${mode === 'banish' ? '제외' : '파괴'}`, { effect, targetCardName: card.name });
  }
  if (target.zone === 'field') {
    const card = ps.field;
    if (!card) return state;
    return emit(updatePlayer(state, target.player, (player) => ({
      ...player,
      field: null,
      [mode === 'banish' ? 'banished' : 'grave']: [...player[mode === 'banish' ? 'banished' : 'grave'], { ...card, face: 'up' }],
    })), 'EFFECT_ACTIVATE', actor, `${sourceName}: ${card.name} ${mode === 'banish' ? '제외' : '파괴'}`, { effect, targetCardName: card.name });
  }
  return state;
}

export function resolveChain(state) {
  if (!state.chain.length) return state;
  if (state.prompt.kind !== 'NONE') return state;
  let next = state;
  const links = [...next.chain];
  next = { ...next, chain: [] };

  const negated = new Map();
  for (const link of links) {
    if (negated.has(link.chainId)) {
      const negatedBy = negated.get(link.chainId);
      next = emit(next, 'EFFECT_ACTIVATE', link.owner, `${link.cardName} 효과가 무효화되고 발동 카드가 파괴되었습니다.`, {
        effect: negatedBy === 'mika-negate' ? 'mika-negate' : 'chain-negated',
        cardName: link.cardName,
      });
      next = removePersistentSource(next, link);
      continue;
    }
    if ((link.meta?.effect === 'counter-negate' || link.meta?.effect === 'mika-negate') && link.meta?.targetChainId) {
      negated.set(link.meta.targetChainId, link.meta.effect);
      const isMika = link.meta.effect === 'mika-negate';
      next = emit(
        next,
        'EFFECT_ACTIVATE',
        link.owner,
        isMika ? '미카 ②로 상대 효과의 발동을 무효로 하고 파괴합니다.' : `${link.cardName}로 체인 효과를 무효화했습니다.`,
        { effect: isMika ? 'mika-negate' : 'counter-negate', targetChainId: link.meta.targetChainId },
      );
      if (!isMika) next = removePersistentSource(next, link);
      continue;
    }

    const owner = link.owner;
    const card = findCardByInstanceOrId(next, owner, link.cardId, link.source) || { id: link.cardId, name: link.cardName };
    const effect = link.meta?.effect || effectKey(card);
    if ((effect === 'destroy-enemy-unit' || effect === 'banish-enemy-card' || effect === 'hina-destroy-any' || effect === 'yuuka-data-shield') && !link.meta?.target) {
      const options = targetOptions(next, owner, effect);
      if (options.length) {
        return {
          ...next,
          chain: [link, ...links.filter((row) => row.chainId !== link.chainId)],
          prompt: { kind: 'SELECT_TARGET', player: owner, chainId: link.chainId, title: `${link.cardName} 대상 선택`, options },
        };
      }
    }
    next = applySimpleEffect(next, owner, card, link.meta?.target, effect, link.meta);
    if (link.source.zone === 'spellTrap' && spellSubType(card) !== 'Continuous') next = removePersistentSource(next, link);
  }
  return next;
}

function findCardByInstanceOrId(state, owner, cardId, source) {
  const ps = state.players[owner];
  const zones = [ps.hand, ps.grave, ps.banished, ps.deck, ps.monster, ps.spellTrap, [ps.field]];
  for (const zone of zones) {
    for (const row of zone) {
      if (row && row.cardId === cardId) return row;
      if (row && row.id === cardId) return row;
    }
  }
  if (source?.zone === 'field' && ps.field?.id === cardId) return ps.field;
  return null;
}

export function targetOptions(state, owner, effect) {
  const op = opponent(owner);
  const result = [];
  const addMonster = (player) => {
    state.players[player].monster.forEach((card, slot) => {
      if (!card || (player !== owner && Number(card.protectedUntilTurn || 0) === Number(state.turn))) return;
      result.push({ player, zone: 'monster', slot, label: `${PLAYER_LABELS[player]} 몬스터 ${slot + 1}: ${card.name}` });
    });
  };
  const addCards = (player) => {
    addMonster(player);
    state.players[player].spellTrap.forEach((card, slot) => {
      if (!card || (player !== owner && Number(card.protectedUntilTurn || 0) === Number(state.turn))) return;
      result.push({ player, zone: 'spellTrap', slot, label: `${PLAYER_LABELS[player]} 마법/함정 ${slot + 1}: ${card.name}` });
    });
    if (state.players[player].field && !(player !== owner && Number(state.players[player].field.protectedUntilTurn || 0) === Number(state.turn))) {
      result.push({ player, zone: 'field', slot: 0, label: `${PLAYER_LABELS[player]} 필드: ${state.players[player].field.name}` });
    }
  };
  if (effect === 'destroy-enemy-unit') addMonster(op);
  if (effect === 'banish-enemy-card') addCards(op);
  if (effect === 'hina-destroy-any') {
    addCards(op);
    addCards(owner);
  }
  if (effect === 'own-card' || effect === 'yuuka-data-shield') addCards(owner);
  return result;
}

export function advancePhase(state) {
  if (state.winner) return state;
  if (state.prompt.kind !== 'NONE') return emit(state, 'PROMPT', state.turnPlayer, '선택/응답을 먼저 처리하세요.');
  if (state.chain.length) return emit(state, 'PROMPT', state.turnPlayer, '체인을 먼저 해결하세요.');
  const currentIndex = PHASES.indexOf(state.phase);
  const player = state.turnPlayer;

  if (state.phase === 'END' || currentIndex === PHASES.length - 1) {
    const nextPlayer = opponent(player);
    let next = {
      ...state,
      turn: state.turn + 1,
      turnPlayer: nextPlayer,
      phase: 'MAIN1',
      players: {
        ...state.players,
        [nextPlayer]: readyPlayer(state.players[nextPlayer]),
        [player]: resetFlags(state.players[player]),
      },
    };
    next = emit(next, 'TURN_START', nextPlayer, `${PLAYER_LABELS[nextPlayer]} 턴 시작`);
    return drawCards(next, nextPlayer, 1);
  }

  const nextPhase = PHASES[currentIndex + 1] || 'END';
  if (state.turn === 1 && player === 'player' && state.phase === 'MAIN1') {
    return emit({ ...state, phase: 'END' }, 'PHASE', player, '선공 첫 턴은 배틀 페이즈 없이 END로 이동합니다.');
  }
  return emit({ ...state, phase: nextPhase }, 'PHASE', player, `${nextPhase} 페이즈로 이동했습니다.`);
}

function readyPlayer(ps) {
  return resetFlags({
    ...ps,
    monster: ps.monster.map((card) => (card ? { ...card, hasAttacked: false } : null)),
  });
}

function resetFlags(ps) {
  return {
    ...ps,
    flags: {
      normalSummoned: false,
      usedEffects: {},
    },
  };
}

function monsterAtk(card) {
  return Number(card?.attack || card?.atk || 0);
}

function battleAttack(card) {
  return monsterAtk(card) + (card?.id === 'TRI-MIKA-01' ? 3 : 0);
}

function applyBattleSignatureFeedback(state, player, card, attack, destroyedOpponent = false) {
  let next = state;
  if (card?.id === 'TRI-MIKA-01') {
    next = emit(
      next,
      'EFFECT_ACTIVATE',
      player,
      `미카 ①: 데미지 계산 동안 ATK +1200 (간소화 수치 ${attack}).`,
      { effect: 'mika-battle-boost', attack },
    );
  }
  if (card?.id === 'GEH-HINA-01' && destroyedOpponent) {
    next = updatePlayer(next, player, (current) => ({ ...current, lp: Math.min(99999, current.lp + 400) }));
    next = emit(next, 'EFFECT_ACTIVATE', player, '히나 ③: 전투로 몬스터를 파괴해 400 LP를 회복했습니다.', {
      effect: 'hina-battle-heal',
      amount: 400,
    });
  }
  return next;
}

function monsterHealth(card) {
  return Number(card?.currentHealth ?? card?.health ?? 0);
}

function monsterDefense(card) {
  return Math.max(0, monsterHealth(card));
}

function monsterHasPierce(card) {
  return Boolean(card?.pierce || card?.status?.pierce || hasKeyword(card, 'pierce'));
}

export function changeMonsterPosition(state, slot) {
  const player = state.turnPlayer;
  if (isLocked(state) || !canMainPhase(state)) return emit(state, 'PROMPT', player, 'MAIN 페이즈에서만 표시를 변경할 수 있습니다.');
  const ps = state.players[player];
  const card = ps.monster[slot];
  if (!card) return emit(state, 'PROMPT', player, '해당 몬스터 존에 카드가 없습니다.');
  if (card.face === 'down') return emit(state, 'PROMPT', player, '앞면 몬스터만 표시를 변경할 수 있습니다.');
  const monster = ps.monster.slice();
  const nextPosition = card.position === 'DEF' ? 'ATK' : 'DEF';
  monster[slot] = { ...card, position: nextPosition };
  return emit(updatePlayer(state, player, (current) => ({ ...current, monster })), 'POSITION_CHANGE', player, `${card.name} 표시 변경: ${nextPosition}`);
}

export function declareAttack(state, attackerSlot, targetSlot = null) {
  const player = state.turnPlayer;
  if (state.winner || state.prompt.kind !== 'NONE' || state.chain.length) return state;
  if (state.phase !== 'BATTLE') return emit(state, 'PROMPT', player, 'BATTLE 페이즈에만 공격할 수 있습니다.');
  const ps = state.players[player];
  const op = state.players[opponent(player)];
  const attacker = ps.monster[attackerSlot];
  if (!attacker || attacker.hasAttacked) return state;
  if (attacker.position === 'DEF') return emit(state, 'PROMPT', player, 'DEF 표시 몬스터는 공격할 수 없습니다.');

  const guarded = op.monster.some((card) => card && hasKeyword(card, 'guard'));
  if (targetSlot !== null && guarded && !hasKeyword(op.monster[targetSlot], 'guard')) {
    return emit(state, 'PROMPT', player, '가드 몬스터를 먼저 공격해야 합니다.');
  }

  const monster = ps.monster.slice();
  monster[attackerSlot] = { ...attacker, hasAttacked: true };
  let next = updatePlayer(state, player, (current) => ({ ...current, monster }));

  if (targetSlot === null || targetSlot === undefined || !op.monster[targetSlot]) {
    if (op.monster.some(Boolean)) return emit(next, 'PROMPT', player, '상대 몬스터가 있으면 직접 공격할 수 없습니다.');
    const damage = battleAttack(attacker);
    const nextLp = Math.max(0, op.lp - damage);
    next = updatePlayer(next, opponent(player), (current) => ({ ...current, lp: nextLp }));
    next = emit(next, 'ATTACK_DECLARE', player, `${attacker.name} 직접 공격: ${damage} LP 피해`);
    next = applyBattleSignatureFeedback(next, player, attacker, damage);
    return nextLp <= 0 ? finishGame(next, player) : next;
  }

  const defender = op.monster[targetSlot];
  if (defender?.position === 'DEF') {
    const attack = battleAttack(attacker);
    const defense = monsterDefense(defender);
    const nextMyMonster = monster.slice();
    const nextOppMonster = op.monster.slice();
    if (attack > defense) {
      const excess = attack - defense;
      nextOppMonster[targetSlot] = null;
      next = updatePlayer(next, opponent(player), (current) => ({
        ...current,
        monster: nextOppMonster,
        grave: [...current.grave, { ...defender, face: 'up' }],
      }));
      next = updatePlayer(next, player, (current) => ({ ...current, monster: nextMyMonster }));
      next = emit(next, 'ATTACK_DECLARE', player, `${attacker.name} ATK ${attack} > DEF ${defense}: ${defender.name} 파괴`);
      if (monsterHasPierce(attacker) && excess > 0) {
        const nextLp = Math.max(0, next.players[opponent(player)].lp - excess);
        next = updatePlayer(next, opponent(player), (current) => ({ ...current, lp: nextLp }));
        next = emit(next, 'DAMAGE_TAKEN', opponent(player), `${attacker.name} 관통: ${excess} LP 피해`);
        next = applyBattleSignatureFeedback(next, player, attacker, attack, true);
        return nextLp <= 0 ? finishGame(next, player) : next;
      }
      return applyBattleSignatureFeedback(next, player, attacker, attack, true);
    }
    if (attack < defense) {
      const damage = defense - attack;
      const nextLp = Math.max(0, next.players[player].lp - damage);
      next = updatePlayer(next, player, (current) => ({ ...current, monster: nextMyMonster, lp: nextLp }));
      next = emit(next, 'DAMAGE_TAKEN', player, `${attacker.name} ATK ${attack} < DEF ${defense}: ${damage} LP 피해`);
      next = applyBattleSignatureFeedback(next, player, attacker, attack);
      return nextLp <= 0 ? finishGame(next, opponent(player)) : next;
    }
    next = updatePlayer(next, player, (current) => ({ ...current, monster: nextMyMonster }));
    next = emit(next, 'ATTACK_DECLARE', player, `${attacker.name} ATK ${attack} = DEF ${defense}: 전투 피해 없음`);
    return applyBattleSignatureFeedback(next, player, attacker, attack);
  }

  const damageToDefender = battleAttack(attacker);
  const damageToAttacker = battleAttack(defender);
  const nextAttacker = applyMonsterDamage(monster[attackerSlot], damageToAttacker);
  const nextDefender = applyMonsterDamage(defender, damageToDefender);
  const nextMyMonster = monster.slice();
  const nextOppMonster = op.monster.slice();
  const attackerDestroyed = monsterHealth(nextAttacker) <= 0;
  const defenderDestroyed = monsterHealth(nextDefender) <= 0;
  if (attackerDestroyed) {
    nextMyMonster[attackerSlot] = null;
    next = updatePlayer(next, player, (current) => ({ ...current, grave: [...current.grave, { ...nextAttacker, face: 'up' }] }));
  } else {
    nextMyMonster[attackerSlot] = nextAttacker;
  }
  if (defenderDestroyed) {
    nextOppMonster[targetSlot] = null;
    next = updatePlayer(next, opponent(player), (current) => ({ ...current, grave: [...current.grave, { ...nextDefender, face: 'up' }] }));
  } else {
    nextOppMonster[targetSlot] = nextDefender;
  }
  next = updatePlayer(next, player, (current) => ({ ...current, monster: nextMyMonster }));
  next = updatePlayer(next, opponent(player), (current) => ({ ...current, monster: nextOppMonster }));
  next = emit(next, 'ATTACK_DECLARE', player, `${attacker.name}가 ${defender.name}와 전투했습니다.`);
  next = applyBattleSignatureFeedback(next, player, attacker, damageToDefender, defenderDestroyed);
  return applyBattleSignatureFeedback(next, opponent(player), defender, damageToAttacker, attackerDestroyed);
}

function applyMonsterDamage(card, damage) {
  if (!card) return card;
  if (damage > 0 && card.shield) return { ...card, shield: false };
  return {
    ...card,
    currentHealth: monsterHealth(card) - Math.max(0, damage),
  };
}

export function activateFieldIgnition(state, player = state.turnPlayer) {
  if (isLocked(state) || !canMainPhase(state)) return state;
  const ps = state.players[player];
  const field = ps.field;
  if (!field) return emit(state, 'PROMPT', player, '필드 카드가 없습니다.');
  const key = `${field.instanceId || field.id}:IGNITION`;
  if (ps.flags.usedEffects[key]) return emit(state, 'PROMPT', player, '이번 턴에 이미 필드 효과를 사용했습니다.');
  let next = updatePlayer(state, player, (current) => ({
    ...current,
    flags: { ...current.flags, usedEffects: { ...current.flags.usedEffects, [key]: true } },
  }));
  if (field.id === 'MIL-FIELD-01') {
    next = drawCards(next, player, 1);
    return emit(next, 'EFFECT_ACTIVATE', player, `${field.name}: 1장 드로우`);
  }
  if (field.id === 'GEH-FIELD-01') {
    const op = opponent(player);
    const nextLp = Math.max(0, next.players[op].lp - 600);
    next = updatePlayer(next, op, (current) => ({ ...current, lp: nextLp }));
    next = emit(next, 'DAMAGE_TAKEN', op, `${field.name}: 600 LP 피해`);
    return nextLp <= 0 ? finishGame(next, player) : next;
  }
  return emit(next, 'EFFECT_ACTIVATE', player, `${field.name} 필드 효과를 처리했습니다.`);
}

function playableHandCards(ps, type = null) {
  return ps.hand
    .map((card) => ({ card, type: cardType(card), subtype: spellSubType(card) }))
    .filter((row) => !type || row.type === type);
}

function boundedChance(value) {
  return Math.max(0.05, Math.min(0.95, Number(value || 0)));
}

function aiProfileFor(state, player = 'enemy') {
  const id = normalizeTcgCharacters(state.characters)[player];
  return getTcgCharacter(id, player === 'enemy' ? 'HINA' : 'YUUKA');
}

function aiUnitScore(card, ai) {
  return monsterAtk(card) * (1 + Number(ai.aggressive || 0))
    + monsterHealth(card) * (0.8 + Number(ai.control || 0) * 0.45)
    + Number(card?.cost || 0) * 0.25
    + (hasKeyword(card, 'quick') ? Number(ai.risk || 0) * 2 : 0)
    + (hasKeyword(card, 'guard') ? Number(ai.control || 0) * 2 : 0)
    + (hasKeyword(card, 'pierce') ? Number(ai.aggressive || 0) * 1.5 : 0);
}

function mikaCostValue(state, player, option) {
  const ps = state.players[player];
  if (option.zone === 'field') return 1000;
  if (option.zone === 'spellTrap') {
    const card = ps.spellTrap[option.slot];
    return card ? (isFaceUp(card) ? 80 : 35) + Number(card.cost || 0) * 10 : 9999;
  }
  const card = ps.monster[option.slot];
  return card ? monsterAtk(card) * 12 + monsterHealth(card) * 8 + Number(card.cost || 0) * 5 : 9999;
}

function resolveAutoPrompt(state, player, ai) {
  if (state.prompt.kind === 'RESPOND' && state.prompt.player === player) {
    const counterSlot = state.players[player].spellTrap.findIndex((card) => card && cardType(card) === 'Trap' && spellSubType(card) === 'Counter');
    const counterChance = boundedChance(0.18 + Number(ai.control || 0) * 0.45 - Number(ai.risk || 0) * 0.12);
    if (counterSlot >= 0 && Math.random() < counterChance) return activateCounterTrap(state, player, counterSlot);
    const mika = mikaQuickReadiness(state, player);
    const mikaChance = boundedChance(0.22 + Number(ai.control || 0) * 0.3 + Number(ai.combo || 0) * 0.24 + Number(ai.risk || 0) * 0.08);
    if (mika.canActivate && Math.random() < mikaChance) return activateMikaQuick(state);
    return passResponse(state);
  }
  if (state.prompt.kind === 'TRIGGER_CONFIRM' && state.prompt.player === player) {
    const acceptChance = boundedChance(0.44 + Number(ai.combo || 0) * 0.32 + Number(ai.control || 0) * 0.18);
    return confirmTrigger(state, Math.random() < acceptChance);
  }
  if (state.prompt.kind === 'SELECT_FROM_DECK' && state.prompt.player === player) {
    const option = state.prompt.options[0];
    return option ? chooseFromDeck(state, option.deckIndex) : { ...state, prompt: { kind: 'NONE' } };
  }
  if (state.prompt.kind === 'SELECT_COST_MIKA_NEGATE' && state.prompt.player === player) {
    const option = [...state.prompt.options].sort((a, b) => mikaCostValue(state, player, a) - mikaCostValue(state, player, b))[0];
    return option ? chooseMikaNegateCost(state, option) : { ...state, prompt: { kind: 'NONE' } };
  }
  if (state.prompt.kind === 'SELECT_TARGET' && state.prompt.player === player) {
    const option = state.prompt.options[0];
    return option ? chooseTarget(state, option) : { ...state, prompt: { kind: 'NONE' } };
  }
  return state;
}

export function autoPlayEnemy(state) {
  return autoPlayFor(state, 'enemy');
}

export function autoPlayPlayer(state) {
  return autoPlayFor(state, 'player');
}

export function autoPlayFor(state, actor = state.turnPlayer) {
  if (state.winner) return state;
  const player = PLAYERS.includes(actor) ? actor : state.turnPlayer;
  const rival = opponent(player);
  const profile = aiProfileFor(state, player);
  const ai = profile.ai || {};
  const prompted = resolveAutoPrompt(state, player, ai);
  if (prompted !== state) return prompted;
  if (state.prompt.kind !== 'NONE') return state;
  if (state.chain.length) return resolveChain(state);
  if (state.turnPlayer !== player) return state;

  let next = state;
  let guard = 0;
  while (!next.winner && next.turnPlayer === player && guard < 40) {
    guard += 1;
    const promptedNext = resolveAutoPrompt(next, player, ai);
    if (promptedNext !== next) {
      next = promptedNext;
      continue;
    }
    if (next.prompt.kind !== 'NONE') break;
    if (next.chain.length) {
      next = resolveChain(next);
      continue;
    }
    if (next.phase === 'MAIN1') {
      const side = next.players[player];
      const monsterSlot = firstEmpty(side.monster);
      const unit = playableHandCards(side, 'Monster').sort((a, b) => aiUnitScore(b.card, ai) - aiUnitScore(a.card, ai))[0]?.card;
      if (monsterSlot >= 0 && unit && !side.flags.normalSummoned) {
        next = normalSummon(next, unit.instanceId, monsterSlot);
        continue;
      }
      const field = side.hand.find((card) => cardType(card) === 'Spell' && spellSubType(card) === 'Field');
      const fieldChance = boundedChance(0.28 + Number(ai.combo || 0) * 0.36 + Number(ai.control || 0) * 0.18);
      if (field && !side.field && Math.random() < fieldChance) {
        next = activateFromHand(next, field.instanceId);
        if (next.prompt.kind === 'RESPOND') next = resolveChain(passResponse(next));
        continue;
      }
      const removal = side.hand.find((card) => cardType(card) === 'Spell' && ['destroy-enemy-unit', 'banish-enemy-card', 'damage', 'draw', 'draw-heal'].includes(effectKey(card)));
      const spellChance = boundedChance(0.3 + Number(ai.aggressive || 0) * 0.22 + Number(ai.combo || 0) * 0.2 + Number(ai.control || 0) * 0.12);
      if (removal && Math.random() < spellChance && (effectKey(removal) !== 'destroy-enemy-unit' || next.players[rival].monster.some(Boolean))) {
        next = activateFromHand(next, removal.instanceId);
        if (next.prompt.kind === 'RESPOND') next = resolveChain(passResponse(next));
        if (next.prompt.kind === 'SELECT_TARGET') {
          const opt = next.prompt.options[0];
          if (opt) next = chooseTarget(next, opt);
        }
        continue;
      }
      const settable = side.hand.find((card) => cardType(card) === 'Trap');
      const stSlot = firstEmpty(side.spellTrap);
      const setChance = boundedChance(0.22 + Number(ai.control || 0) * 0.45 - Number(ai.aggressive || 0) * 0.14);
      if (settable && stSlot >= 0 && Math.random() < setChance) {
        next = setSpellTrap(next, settable.instanceId, stSlot);
        continue;
      }
      next = advancePhase(next);
      continue;
    }
    if (next.phase === 'BATTLE') {
      const attackerSlot = next.players[player].monster.findIndex((card) => card && !card.hasAttacked);
      if (attackerSlot >= 0) {
        const targetSlot = weakestMonsterSlot(next.players[rival].monster);
        next = declareAttack(next, attackerSlot, targetSlot >= 0 ? targetSlot : null);
        continue;
      }
      next = advancePhase(next);
      continue;
    }
    next = advancePhase(next);
  }
  return next;
}
