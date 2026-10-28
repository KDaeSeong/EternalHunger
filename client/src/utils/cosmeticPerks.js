const COSMETIC_PERKS = Object.freeze([
  { code: 'COS_TITLE_ROOKIE', name: '루미아 신입 생존자', kind: 'title', value: '루미아 신입 생존자' },
  { code: 'COS_TITLE_NIGHT_RUNNER', name: '야간 루퍼', kind: 'title', value: '야간 루퍼' },
  { code: 'COS_FRAME_SKYLINE', name: '스카이라인 초상화 프레임', kind: 'portraitFrame', value: 'skyline' },
  { code: 'COS_FRAME_GOLDLINE', name: '골드 라인 초상화 프레임', kind: 'portraitFrame', value: 'goldline' },
  { code: 'COS_BADGE_ALPHA', name: '알파 추적자 배지', kind: 'badge', value: 'alpha_tracker' },
  { code: 'COS_BADGE_WEAKLINE', name: '위클라인 감시자 배지', kind: 'badge', value: 'weakline_watcher' },
  { code: 'COS_LOG_CYAN', name: '청록 로그 하이라이트', kind: 'logStyle', value: 'cyan' },
  { code: 'COS_VICTORY_SPOTLIGHT', name: '승리 스포트라이트', kind: 'victoryEffect', value: 'spotlight' },
]);

const COSMETIC_BY_CODE = new Map(COSMETIC_PERKS.map((perk) => [perk.code, perk]));
const LOADOUT_SLOTS = Object.freeze(['title', 'portraitFrame', 'logStyle', 'victoryEffect']);

function ownedCosmeticCodes(user) {
  if (Array.isArray(user?.perks)) {
    return new Set(user.perks.filter((value) => typeof value === 'string').map((value) => value.trim()).filter(Boolean));
  }
  const cosmetics = user?.cosmetics;
  const sanitized = Array.isArray(cosmetics)
    ? cosmetics
    : cosmetics && typeof cosmetics === 'object'
      ? [...LOADOUT_SLOTS.map((slot) => cosmetics[slot]), ...(Array.isArray(cosmetics.badges) ? cosmetics.badges : [])]
      : [];
  return new Set(sanitized.map((perk) => typeof perk?.code === 'string' ? perk.code : '').filter(Boolean));
}

function cosmeticItem(code, ownedCodes) {
  const item = COSMETIC_BY_CODE.get(code);
  return item && ownedCodes.has(code) ? { ...item } : null;
}

function resolveSlot(user, slot, ownedCodes) {
  const loadout = user?.cosmeticLoadout;
  const hasExplicitChoice = loadout && typeof loadout === 'object'
    && !Array.isArray(loadout) && Object.prototype.hasOwnProperty.call(loadout, slot);

  if (hasExplicitChoice) {
    const code = loadout[slot];
    if (typeof code !== 'string' || !code) return null;
    const item = cosmeticItem(code, ownedCodes);
    return item?.kind === slot ? item : null;
  }

  const fallback = [...ownedCodes].reverse().find((code) => COSMETIC_BY_CODE.get(code)?.kind === slot);
  return fallback ? cosmeticItem(fallback, ownedCodes) : null;
}

export function resolveCosmeticPerks(user) {
  const ownedCodes = ownedCosmeticCodes(user);
  const resolved = Object.fromEntries(LOADOUT_SLOTS.map((slot) => [slot, resolveSlot(user, slot, ownedCodes)]));
  const cosmeticBadges = COSMETIC_PERKS
    .filter((perk) => perk.kind === 'badge' && ownedCodes.has(perk.code))
    .map((perk) => ({ ...perk }));

  return { ...resolved, badges: cosmeticBadges };
}

export function mergeProfileBadges(earnedBadges, cosmeticBadges) {
  const earned = Array.isArray(earnedBadges) ? earnedBadges : [];
  const seenNames = new Set(earned.map((badge) => String(badge?.name || '').trim()).filter(Boolean));
  const cosmetics = Array.isArray(cosmeticBadges) ? cosmeticBadges : [];
  return [...earned, ...cosmetics.filter((badge) => {
    const name = String(badge?.name || '').trim();
    if (!name || seenNames.has(name)) return false;
    seenNames.add(name);
    return true;
  })];
}

export { COSMETIC_PERKS };
