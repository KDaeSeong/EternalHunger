import { apiGet } from '../../../utils/api';
import { normalizeWeaponType } from '../../../utils/equipmentCatalog';
import { normalizeErStats } from '../../../utils/erStats';
import { normalizeSupportedTacSkill } from '../../simulation/tacticalSkillTable';

const GOAL_GEAR_TIERS = [
  { value: 4, label: '영웅' },
  { value: 5, label: '전설' },
  { value: 6, label: '초월' },
];

const LOADOUT_TIERS = [
  { key: 'hero', label: '영웅' },
  { key: 'legend', label: '전설' },
  { key: 'transcend', label: '초월' },
];

const LOADOUT_SLOTS = [
  { key: 'weaponKey', label: '무기', slot: 'weapon' },
  { key: 'headKey', label: '머리', slot: 'head' },
  { key: 'clothesKey', label: '옷', slot: 'clothes' },
  { key: 'armKey', label: '팔', slot: 'arm' },
  { key: 'shoesKey', label: '신발', slot: 'shoes' },
];

const EMPTY_LOADOUTS = {
  hero: { weaponKey: '', headKey: '', clothesKey: '', armKey: '', shoesKey: '' },
  legend: { weaponKey: '', headKey: '', clothesKey: '', armKey: '', shoesKey: '' },
  transcend: { weaponKey: '', headKey: '', clothesKey: '', armKey: '', shoesKey: '' },
};

function coerceLoadouts(raw) {
  const src = raw && typeof raw === 'object' ? raw : {};
  const out = JSON.parse(JSON.stringify(EMPTY_LOADOUTS));
  for (const tier of LOADOUT_TIERS) {
    const tierObj = src?.[tier.key] && typeof src[tier.key] === 'object' ? src[tier.key] : {};
    for (const slot of LOADOUT_SLOTS) {
      const value = tierObj?.[slot.key];
      out[tier.key][slot.key] = typeof value === 'string' ? value : '';
    }
  }
  return out;
}

function normalizeDetailsCharacterList(data) {
  return (Array.isArray(data) ? data : []).map((char) => ({
    ...char,
    stats: normalizeErStats(char?.stats),
    goalGearTier: [4, 5, 6].includes(Number(char?.goalGearTier)) ? Number(char.goalGearTier) : 6,
    tacticalSkill: normalizeSupportedTacSkill(char?.tacticalSkill),
    goalLoadouts: coerceLoadouts(char?.goalLoadouts),
  }));
}

function formatSaveMismatchMessage(mismatches) {
  const sample = (Array.isArray(mismatches) ? mismatches : [])
    .slice(0, 5)
    .map((m) => `${m.field}:${String(m.id || '').slice(-6)}`)
    .join(', ');
  return `저장 후 서버 재조회 값이 요청값과 다릅니다.${sample ? ` (${sample})` : ''}`;
}

function freshCharactersUrl() {
  return `/characters?view=stats&_fresh=${Date.now()}`;
}

async function loadCharactersAfterSave(result) {
  if (Array.isArray(result?.characters)) return result.characters;
  return apiGet(freshCharactersUrl(), { timeoutMs: 30000 });
}

function syncTokenCookie(token) {
  try {
    document.cookie = `token=${encodeURIComponent(token)}; path=/; SameSite=Lax`;
  } catch {
  }
}

function getGoalGearTierLabel(value) {
  return GOAL_GEAR_TIERS.find((tier) => tier.value === Number(value || 6))?.label || '초월';
}

function getLoadoutOptionsForSlot(char, slot, equipList) {
  const slotKey = String(slot || '');
  const charWeaponType = normalizeWeaponType(char?.weaponType || '');
  return (Array.isArray(equipList) ? equipList : [])
    .filter((item) => String(item?.equipSlot || '') === slotKey)
    .filter((item) => {
      if (slotKey !== 'weapon') return true;
      if (!charWeaponType) return true;
      const directType = normalizeWeaponType(item?.weaponType || '');
      const tagType = Array.isArray(item?.tags)
        ? item.tags.map((tag) => normalizeWeaponType(tag)).find(Boolean)
        : '';
      const itemWeaponType = directType || tagType;
      return itemWeaponType ? itemWeaponType === charWeaponType : false;
    });
}

export {
  EMPTY_LOADOUTS,
  GOAL_GEAR_TIERS,
  LOADOUT_SLOTS,
  LOADOUT_TIERS,
  coerceLoadouts,
  formatSaveMismatchMessage,
  getGoalGearTierLabel,
  getLoadoutOptionsForSlot,
  loadCharactersAfterSave,
  normalizeDetailsCharacterList,
  syncTokenCookie,
};
