const COSMETICS = Object.freeze({
  COS_TITLE_ROOKIE: Object.freeze({ code: 'COS_TITLE_ROOKIE', name: '루미아 신입 생존자', kind: 'title', value: '루미아 신입 생존자' }),
  COS_TITLE_NIGHT_RUNNER: Object.freeze({ code: 'COS_TITLE_NIGHT_RUNNER', name: '야간 루퍼', kind: 'title', value: '야간 루퍼' }),
  COS_FRAME_SKYLINE: Object.freeze({ code: 'COS_FRAME_SKYLINE', name: '스카이라인 초상화 프레임', kind: 'portraitFrame', value: 'skyline' }),
  COS_FRAME_GOLDLINE: Object.freeze({ code: 'COS_FRAME_GOLDLINE', name: '골드 라인 초상화 프레임', kind: 'portraitFrame', value: 'goldline' }),
  COS_BADGE_ALPHA: Object.freeze({ code: 'COS_BADGE_ALPHA', name: '알파 추적자 배지', kind: 'badge', value: 'alpha_tracker' }),
  COS_BADGE_WEAKLINE: Object.freeze({ code: 'COS_BADGE_WEAKLINE', name: '위클라인 감시자 배지', kind: 'badge', value: 'weakline_watcher' }),
  COS_LOG_CYAN: Object.freeze({ code: 'COS_LOG_CYAN', name: '청록 로그 하이라이트', kind: 'logStyle', value: 'cyan' }),
  COS_VICTORY_SPOTLIGHT: Object.freeze({ code: 'COS_VICTORY_SPOTLIGHT', name: '승리 스포트라이트', kind: 'victoryEffect', value: 'spotlight' }),
});

const LOADOUT_KINDS = Object.freeze(['title', 'portraitFrame', 'logStyle', 'victoryEffect']);

function ownedCodes(user) {
  return Array.isArray(user?.perks)
    ? user.perks.map((code) => typeof code === 'string' ? code.trim() : '').filter(Boolean)
    : [];
}

function resolveCosmeticPerks(user) {
  const owned = ownedCodes(user);
  const configured = user?.cosmeticLoadout && typeof user.cosmeticLoadout === 'object' && !Array.isArray(user.cosmeticLoadout)
    ? user.cosmeticLoadout
    : {};
  const resolved = { title: null, portraitFrame: null, logStyle: null, victoryEffect: null, badges: [] };

  for (const kind of LOADOUT_KINDS) {
    let code;
    if (Object.prototype.hasOwnProperty.call(configured, kind)) {
      if (typeof configured[kind] !== 'string' || configured[kind] === '') continue;
      code = configured[kind];
    } else {
      code = [...owned].reverse().find((ownedCode) => COSMETICS[ownedCode]?.kind === kind);
    }
    const cosmetic = COSMETICS[code];
    if (cosmetic && cosmetic.kind === kind && owned.includes(code)) resolved[kind] = { ...cosmetic };
  }

  resolved.badges = [...new Set(owned)]
    .map((code) => COSMETICS[code])
    .filter((cosmetic) => cosmetic?.kind === 'badge')
    .map((cosmetic) => ({ ...cosmetic }));
  return resolved;
}

function normalizeCosmeticLoadout(value) {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const loadout = {};
  for (const kind of LOADOUT_KINDS) {
    if (Object.prototype.hasOwnProperty.call(source, kind)) {
      loadout[kind] = typeof source[kind] === 'string' ? source[kind] : '';
    }
  }
  return loadout;
}

module.exports = { COSMETICS, LOADOUT_KINDS, normalizeCosmeticLoadout, resolveCosmeticPerks };
