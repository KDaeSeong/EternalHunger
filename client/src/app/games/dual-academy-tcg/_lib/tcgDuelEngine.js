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

function effectAmount(card, fallback = 1) {
  return Math.max(1, Number(card?.effectAmount || fallback));
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
  next = emit(next, 'EFFECT_ACTIVATE', player, `${monster.name} ① 발동: 덱에서 밀레니엄 마법을 선택합니다.`);
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
  let next = emit(paid, 'EFFECT_ACTIVATE', player, `${card.name} ② 발동: LP 800을 지불하고 필드 카드 1장을 파괴합니다.`);
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
  let next = emit(marked, 'EFFECT_ACTIVATE', player, `${card.name} ② 발동: 자신 필드 카드에 DATA와 보호막을 부여합니다.`);
  if (!options.length) return emit(next, 'PROMPT', player, '대상으로 선택할 자신 필드 카드가 없습니다.');
  return {
    ...next,
    chain: [link, ...next.chain],
    prompt: { kind: 'SELECT_TARGET', player, chainId: link.chainId, title: '유우카 ②: DATA를 놓을 카드 선택', options },
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
  if (link.source.zone === 'spellTrap') {
    const ps = state.players[owner];
    const current = ps.spellTrap[link.source.slot];
    if (!current || current.id !== link.cardId) return state;
    const spellTrap = ps.spellTrap.slice();
    spellTrap[link.source.slot] = null;
    return updatePlayer(state, owner, (player) => ({ ...player, spellTrap, grave: [...player.grave, { ...current, face: 'up' }] }));
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
    if (!picked) return emit(state, 'EFFECT_ACTIVATE', owner, `${card.name} 효과로 가져올 카드가 없습니다.`);
    const deck = ps.deck.slice();
    const [drawn] = deck.splice(deckIndex, 1);
    return emit(updatePlayer(state, owner, (player) => ({ ...player, deck, hand: [...player.hand, { ...drawn, face: 'up' }] })), 'EFFECT_ACTIVATE', owner, `유우카 ①: ${drawn.name}를 패에 넣었습니다.`);
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
      return emit(updatePlayer(state, owner, (player) => ({ ...player, monster })), 'EFFECT_ACTIVATE', owner, `${monster[slot].name}에 보호막을 부여했습니다.`);
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
    return removeTarget(state, actualTarget, effect === 'banish-enemy-card' ? 'banish' : 'destroy', owner, card.name);
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
    return emit(updatePlayer(state, target.player, (player) => ({ ...player, monster })), 'EFFECT_ACTIVATE', actor, `${sourceName}: ${card.name}에 DATA +1 / 보호막`);
  }
  if (target.zone === 'spellTrap') {
    const spellTrap = ps.spellTrap.slice();
    const card = spellTrap[target.slot];
    if (!card) return state;
    spellTrap[target.slot] = applyToCard(card);
    return emit(updatePlayer(state, target.player, (player) => ({ ...player, spellTrap })), 'EFFECT_ACTIVATE', actor, `${sourceName}: ${card.name}에 DATA +1 / 보호막`);
  }
  if (target.zone === 'field') {
    const card = ps.field;
    if (!card) return state;
    return emit(updatePlayer(state, target.player, (player) => ({ ...player, field: applyToCard(card) })), 'EFFECT_ACTIVATE', actor, `${sourceName}: ${card.name}에 DATA +1 / 보호막`);
  }
  return state;
}

function removeTarget(state, target, mode, actor, sourceName) {
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
    })), 'EFFECT_ACTIVATE', actor, `${sourceName}: ${card.name} ${mode === 'banish' ? '제외' : '파괴'}`);
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
    })), 'EFFECT_ACTIVATE', actor, `${sourceName}: ${card.name} ${mode === 'banish' ? '제외' : '파괴'}`);
  }
  if (target.zone === 'field') {
    const card = ps.field;
    if (!card) return state;
    return emit(updatePlayer(state, target.player, (player) => ({
      ...player,
      field: null,
      [mode === 'banish' ? 'banished' : 'grave']: [...player[mode === 'banish' ? 'banished' : 'grave'], { ...card, face: 'up' }],
    })), 'EFFECT_ACTIVATE', actor, `${sourceName}: ${card.name} ${mode === 'banish' ? '제외' : '파괴'}`);
  }
  return state;
}

export function resolveChain(state) {
  if (!state.chain.length) return state;
  if (state.prompt.kind !== 'NONE') return state;
  let next = state;
  const links = [...next.chain];
  next = { ...next, chain: [] };

  const negated = new Set();
  for (const link of links) {
    if (negated.has(link.chainId)) {
      next = emit(next, 'EFFECT_ACTIVATE', link.owner, `${link.cardName} 효과가 무효화되었습니다.`);
      next = removePersistentSource(next, link);
      continue;
    }
    if (link.meta?.effect === 'counter-negate' && link.meta?.targetChainId) {
      negated.add(link.meta.targetChainId);
      next = emit(next, 'EFFECT_ACTIVATE', link.owner, `${link.cardName}로 체인 효과를 무효화했습니다.`);
      next = removePersistentSource(next, link);
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
      if (card) result.push({ player, zone: 'monster', slot, label: `${PLAYER_LABELS[player]} 몬스터 ${slot + 1}: ${card.name}` });
    });
  };
  const addCards = (player) => {
    addMonster(player);
    state.players[player].spellTrap.forEach((card, slot) => {
      if (card) result.push({ player, zone: 'spellTrap', slot, label: `${PLAYER_LABELS[player]} 마법/함정 ${slot + 1}: ${card.name}` });
    });
    if (state.players[player].field) result.push({ player, zone: 'field', slot: 0, label: `${PLAYER_LABELS[player]} 필드: ${state.players[player].field.name}` });
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

function monsterHealth(card) {
  return Number(card?.currentHealth ?? card?.health ?? 0);
}

export function declareAttack(state, attackerSlot, targetSlot = null) {
  const player = state.turnPlayer;
  if (state.winner || state.prompt.kind !== 'NONE' || state.chain.length) return state;
  if (state.phase !== 'BATTLE') return emit(state, 'PROMPT', player, 'BATTLE 페이즈에만 공격할 수 있습니다.');
  const ps = state.players[player];
  const op = state.players[opponent(player)];
  const attacker = ps.monster[attackerSlot];
  if (!attacker || attacker.hasAttacked) return state;

  const guarded = op.monster.some((card) => card && hasKeyword(card, 'guard'));
  if (targetSlot !== null && guarded && !hasKeyword(op.monster[targetSlot], 'guard')) {
    return emit(state, 'PROMPT', player, '가드 몬스터를 먼저 공격해야 합니다.');
  }

  const monster = ps.monster.slice();
  monster[attackerSlot] = { ...attacker, hasAttacked: true };
  let next = updatePlayer(state, player, (current) => ({ ...current, monster }));

  if (targetSlot === null || targetSlot === undefined || !op.monster[targetSlot]) {
    if (op.monster.some(Boolean)) return emit(next, 'PROMPT', player, '상대 몬스터가 있으면 직접 공격할 수 없습니다.');
    const damage = monsterAtk(attacker);
    const nextLp = Math.max(0, op.lp - damage);
    next = updatePlayer(next, opponent(player), (current) => ({ ...current, lp: nextLp }));
    next = emit(next, 'ATTACK_DECLARE', player, `${attacker.name} 직접 공격: ${damage} LP 피해`);
    return nextLp <= 0 ? finishGame(next, player) : next;
  }

  const defender = op.monster[targetSlot];
  const damageToDefender = monsterAtk(attacker);
  const damageToAttacker = monsterAtk(defender);
  const nextAttacker = applyMonsterDamage(monster[attackerSlot], damageToAttacker);
  const nextDefender = applyMonsterDamage(defender, damageToDefender);
  const nextMyMonster = monster.slice();
  const nextOppMonster = op.monster.slice();
  if (monsterHealth(nextAttacker) <= 0) {
    nextMyMonster[attackerSlot] = null;
    next = updatePlayer(next, player, (current) => ({ ...current, grave: [...current.grave, { ...nextAttacker, face: 'up' }] }));
  } else {
    nextMyMonster[attackerSlot] = nextAttacker;
  }
  if (monsterHealth(nextDefender) <= 0) {
    nextOppMonster[targetSlot] = null;
    next = updatePlayer(next, opponent(player), (current) => ({ ...current, grave: [...current.grave, { ...nextDefender, face: 'up' }] }));
  } else {
    nextOppMonster[targetSlot] = nextDefender;
  }
  next = updatePlayer(next, player, (current) => ({ ...current, monster: nextMyMonster }));
  next = updatePlayer(next, opponent(player), (current) => ({ ...current, monster: nextOppMonster }));
  return emit(next, 'ATTACK_DECLARE', player, `${attacker.name}가 ${defender.name}와 전투했습니다.`);
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

export function autoPlayEnemy(state) {
  if (state.winner) return state;
  const enemyProfile = aiProfileFor(state, 'enemy');
  const enemyAi = enemyProfile.ai || {};
  if (state.prompt.kind === 'RESPOND' && state.prompt.player === 'enemy') {
    const counterSlot = state.players.enemy.spellTrap.findIndex((card) => card && cardType(card) === 'Trap' && spellSubType(card) === 'Counter');
    const counterChance = boundedChance(0.18 + Number(enemyAi.control || 0) * 0.45 - Number(enemyAi.risk || 0) * 0.12);
    if (counterSlot >= 0 && Math.random() < counterChance) return activateCounterTrap(state, 'enemy', counterSlot);
    return passResponse(state);
  }
  if (state.prompt.kind !== 'NONE' || state.chain.length) return state;
  if (state.turnPlayer !== 'enemy') return state;

  let next = state;
  let guard = 0;
  while (!next.winner && next.turnPlayer === 'enemy' && guard < 40) {
    guard += 1;
    if (next.prompt.kind !== 'NONE' || next.chain.length) break;
    if (next.phase === 'MAIN1') {
      const enemy = next.players.enemy;
      const monsterSlot = firstEmpty(enemy.monster);
      const unit = playableHandCards(enemy, 'Monster').sort((a, b) => aiUnitScore(b.card, enemyAi) - aiUnitScore(a.card, enemyAi))[0]?.card;
      if (monsterSlot >= 0 && unit && !enemy.flags.normalSummoned) {
        next = normalSummon(next, unit.instanceId, monsterSlot);
        continue;
      }
      const field = enemy.hand.find((card) => cardType(card) === 'Spell' && spellSubType(card) === 'Field');
      const fieldChance = boundedChance(0.28 + Number(enemyAi.combo || 0) * 0.36 + Number(enemyAi.control || 0) * 0.18);
      if (field && !enemy.field && Math.random() < fieldChance) {
        next = activateFromHand(next, field.instanceId);
        if (next.prompt.kind === 'RESPOND') next = resolveChain(passResponse(next));
        continue;
      }
      const removal = enemy.hand.find((card) => cardType(card) === 'Spell' && ['destroy-enemy-unit', 'banish-enemy-card', 'damage', 'draw', 'draw-heal'].includes(effectKey(card)));
      const spellChance = boundedChance(0.3 + Number(enemyAi.aggressive || 0) * 0.22 + Number(enemyAi.combo || 0) * 0.2 + Number(enemyAi.control || 0) * 0.12);
      if (removal && Math.random() < spellChance && (effectKey(removal) !== 'destroy-enemy-unit' || next.players.player.monster.some(Boolean))) {
        next = activateFromHand(next, removal.instanceId);
        if (next.prompt.kind === 'RESPOND') next = resolveChain(passResponse(next));
        if (next.prompt.kind === 'SELECT_TARGET') {
          const opt = next.prompt.options[0];
          if (opt) next = chooseTarget(next, opt);
        }
        continue;
      }
      const settable = enemy.hand.find((card) => cardType(card) === 'Trap');
      const stSlot = firstEmpty(enemy.spellTrap);
      const setChance = boundedChance(0.22 + Number(enemyAi.control || 0) * 0.45 - Number(enemyAi.aggressive || 0) * 0.14);
      if (settable && stSlot >= 0 && Math.random() < setChance) {
        next = setSpellTrap(next, settable.instanceId, stSlot);
        continue;
      }
      next = advancePhase(next);
      continue;
    }
    if (next.phase === 'BATTLE') {
      const attackerSlot = next.players.enemy.monster.findIndex((card) => card && !card.hasAttacked);
      if (attackerSlot >= 0) {
        const targetSlot = weakestMonsterSlot(next.players.player.monster);
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
