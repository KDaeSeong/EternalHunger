export const GAMEPLAY_PERK_LIMIT = 3;

export const GAMEPLAY_PERK_CODES = Object.freeze({
  CAREFUL_GATHER: 'PLAY_ARCHIVE_CAREFUL_GATHER',
  RESEARCH_NOTES: 'PLAY_ARCHIVE_RESEARCH_NOTES',
  START_SPONSOR: 'PLAY_EH_START_SPONSOR',
  PROCUREMENT_PARTNER: 'PLAY_EH_PROCUREMENT_PARTNER',
});

export const GAMEPLAY_GAME_LABELS = Object.freeze({
  'primitive-archive': '문명 아카이브',
  'eternal-hunger': '이터널 헝거',
});

export const GAMEPLAY_PERK_PRODUCTS = Object.freeze([
  {
    code: GAMEPLAY_PERK_CODES.CAREFUL_GATHER,
    name: '꼼꼼한 채집',
    gameSlug: 'primitive-archive',
    lpCost: 250,
    description: '한 런에서 처음 3번의 일반 채집 성공 시 실제 얻은 기본 자원 한 종류를 1개 더 받습니다.',
    effects: { gameSlug: 'primitive-archive', requiresEquip: true, balanceAffecting: true, gameplayKind: 'careful_gather', amount: 1, maxUses: 3 },
  },
  {
    code: GAMEPLAY_PERK_CODES.RESEARCH_NOTES,
    name: '연구 기록법',
    gameSlug: 'primitive-archive',
    lpCost: 400,
    description: '직접 연구 행동의 연구 포인트가 1 증가합니다. 한 런에서 최대 10번 적용됩니다.',
    effects: { gameSlug: 'primitive-archive', requiresEquip: true, balanceAffecting: true, gameplayKind: 'research_notes', amount: 1, maxUses: 10 },
  },
  {
    code: GAMEPLAY_PERK_CODES.START_SPONSOR,
    name: '출발 후원금',
    gameSlug: 'eternal-hunger',
    lpCost: 250,
    description: '경기 시작 전에 지정한 후원 팀의 대원마다 경기 크레딧 30을 한 번 지급합니다.',
    effects: { gameSlug: 'eternal-hunger', requiresEquip: true, balanceAffecting: true, gameplayKind: 'start_sponsor', amount: 30, maxUses: 1 },
  },
  {
    code: GAMEPLAY_PERK_CODES.PROCUREMENT_PARTNER,
    name: '조달 제휴',
    gameSlug: 'eternal-hunger',
    lpCost: 400,
    description: '경기 시작 전에 지정한 후원 팀의 경기 내 키오스크·드론 구매 비용을 5% 할인합니다.',
    effects: { gameSlug: 'eternal-hunger', requiresEquip: true, balanceAffecting: true, gameplayKind: 'procurement_partner', discountPct: 0.05 },
  },
].map((product) => Object.freeze({ ...product, effects: Object.freeze(product.effects) })));

const PRODUCTS_BY_CODE = new Map(GAMEPLAY_PERK_PRODUCTS.map((product) => [product.code, product]));

export function getGameplayPerkProduct(code) {
  return typeof code === 'string' ? PRODUCTS_BY_CODE.get(code) || null : null;
}

export function gameplayPerkProductsForGame(gameSlug) {
  if (!Object.hasOwn(GAMEPLAY_GAME_LABELS, gameSlug)) return [];
  return GAMEPLAY_PERK_PRODUCTS.filter((product) => product.gameSlug === gameSlug);
}

function hasMatchingGameplayEffect(row, product) {
  const actual = row?.effects;
  const expected = product.effects;
  if (!actual || typeof actual !== 'object' || Array.isArray(actual)) return false;
  const expectedKeys = Object.keys(expected);
  return Object.keys(actual).length === expectedKeys.length
    && expectedKeys.every((key) => actual[key] === expected[key]);
}

export function activeGameplayPerkProducts(rawProducts, gameSlug) {
  const fallbackByCode = new Map(gameplayPerkProductsForGame(gameSlug).map((product) => [product.code, product]));
  const seen = new Set();
  return (Array.isArray(rawProducts) ? rawProducts : []).flatMap((row) => {
    const code = typeof row?.code === 'string' ? row.code.trim() : '';
    const fallback = fallbackByCode.get(code);
    const rowGameSlug = typeof row?.gameSlug === 'string' ? row.gameSlug : row?.effects?.gameSlug;
    if (!fallback || seen.has(code) || row?.isActive !== true
      || rowGameSlug !== gameSlug || Number(row.lpCost) !== fallback.lpCost
      || !hasMatchingGameplayEffect(row, fallback)) return [];
    seen.add(code);
    return [{
      ...fallback,
      name: typeof row.name === 'string' && row.name.trim() ? row.name : fallback.name,
      description: typeof row.description === 'string' ? row.description : fallback.description,
      category: typeof row.category === 'string' ? row.category : 'buff',
      isActive: true,
    }];
  });
}

export function normalizeGameplayPerkAccount(payload, gameSlug) {
  const user = payload?.user && typeof payload.user === 'object' && !Array.isArray(payload.user) ? payload.user : {};
  const products = activeGameplayPerkProducts(payload?.perks, gameSlug);
  const ownedCodes = normalizeGameplayPerkCodes(user.perks, gameSlug);
  const activeCodes = new Set(products.map((product) => product.code));
  const equippedCodes = normalizeGameplayPerkCodes(user.perkLoadouts?.[gameSlug], gameSlug, ownedCodes)
    .filter((code) => activeCodes.has(code));
  return { products, ownedCodes, equippedCodes };
}

export function isGameplayPerkCode(code) {
  return Boolean(getGameplayPerkProduct(code));
}

export function normalizeGameplayPerkCodes(codes, gameSlug, ownedCodes) {
  if (!Object.hasOwn(GAMEPLAY_GAME_LABELS, gameSlug)) return [];
  const owned = Array.isArray(ownedCodes) ? new Set(ownedCodes.filter((code) => typeof code === 'string')) : null;
  const seen = new Set();
  return (Array.isArray(codes) ? codes : []).filter((code) => {
    if (typeof code !== 'string' || seen.has(code) || PRODUCTS_BY_CODE.get(code)?.gameSlug !== gameSlug || (owned && !owned.has(code))) return false;
    seen.add(code);
    return true;
  }).slice(0, GAMEPLAY_PERK_LIMIT);
}

export function normalizeGameplayPerkLoadouts(raw, ownedCodes) {
  const source = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  return Object.fromEntries(Object.keys(GAMEPLAY_GAME_LABELS).map((gameSlug) => [
    gameSlug,
    normalizeGameplayPerkCodes(source[gameSlug], gameSlug, ownedCodes),
  ]));
}

export function gameplayPerkNames(codes, gameSlug) {
  return normalizeGameplayPerkCodes(codes, gameSlug).map((code) => PRODUCTS_BY_CODE.get(code).name);
}
