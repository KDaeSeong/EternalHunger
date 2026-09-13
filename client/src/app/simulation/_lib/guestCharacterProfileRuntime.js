import { CHARACTER_SKILL_SLOTS, createDefaultCompiledSkill, getCharacterSkillMovementError } from '../../../utils/characterSkillCompilerCore.js';
import { normalizeSupportedTacSkill } from '../../../utils/tacticalSkillCatalog.js';
import { applyStartingPassiveHealth } from '../../../utils/characterPassiveStats.js';
import { getCharacterStatusSkillError } from '../../../utils/characterStatusSkillDefinition.js';
import { normalizeUniqueResourceDefinition } from './uniqueResourceRuntime.js';

export const GUEST_CHARACTER_PROFILE_KEY = 'eh_guest_character_profiles_v1';
const MAX_BYTES = 1000000;
const idOf = (actor) => String(actor?._id || actor?.id || '');
const validId = (id) => /^guest-survivor-(0[1-9]|1[0-9]|2[0-4])$/.test(id);
const failure = (message) => ({ ok: false, profiles: [], errors: [message] });

// Only editable definition fields are persisted. No HP, items, team assignment,
// cooldown, reward or other live match state can enter the local profile.
export function normalizeGuestCharacterProfile(raw) {
  if (!raw || !validId(String(raw.id || ''))) return null;
  const name = String(raw.name || '').trim().slice(0, 80);
  if (!name) return null;
  if (CHARACTER_SKILL_SLOTS.some((slot) => getCharacterStatusSkillError(raw.characterSkills?.[slot], slot))) return null;
  const characterSkills = Object.fromEntries(CHARACTER_SKILL_SLOTS.map((slot) => {
    const source = raw.characterSkills?.[slot] || {};
    const skill = createDefaultCompiledSkill(source, slot);
    skill.name = skill.name.trim().slice(0, 100);
    skill.sourceText = skill.sourceText.slice(0, 5000);
    return [slot, skill];
  }));
  const characterSkillLevels = {};
  for (const slot of ['q', 'w', 'e', 'r']) {
    const level = Number(raw.characterSkillLevels?.[slot]);
    if (Number.isFinite(level) && level >= 1 && level <= 5) characterSkillLevels[slot] = Math.floor(level);
  }
  return {
    id: String(raw.id),
    name,
    tacticalSkill: normalizeSupportedTacSkill(raw.tacticalSkill),
    characterSkills,
    characterSkillLevels,
    uniqueResource: normalizeUniqueResourceDefinition(raw.uniqueResource),
  };
}

function profileStorage(storage) { return storage === undefined ? globalThis.localStorage : storage; }

export function readGuestCharacterProfiles(storage) {
  try {
    const target = profileStorage(storage);
    if (!target) return failure('이 기기의 저장 공간을 사용할 수 없습니다.');
    const text = target.getItem(GUEST_CHARACTER_PROFILE_KEY);
    if (text == null) return { ok: true, profiles: [], errors: [] };
    if (text.length > MAX_BYTES) return failure('저장된 게스트 캐릭터 데이터가 너무 큽니다. 원본은 변경하지 않았습니다.');
    const saved = JSON.parse(text);
    if (saved?.schemaVersion !== 1 || !Array.isArray(saved.profiles) || saved.profiles.length > 24) {
      return failure('지원하지 않는 게스트 캐릭터 저장 형식입니다. 원본은 변경하지 않았습니다.');
    }
    const profiles = saved.profiles.map(normalizeGuestCharacterProfile);
    if (profiles.some((row) => !row) || new Set(profiles.map((row) => row.id)).size !== profiles.length) {
      return failure('저장된 게스트 캐릭터 식별자·이름·스킬 설정이 올바르지 않습니다. 원본은 변경하지 않았습니다.');
    }
    return { ok: true, profiles, errors: [] };
  } catch {
    return failure('게스트 캐릭터 저장을 읽지 못했습니다. 원본은 변경하지 않았습니다.');
  }
}

export function saveGuestCharacterProfile(raw, storage) {
  for (const slot of CHARACTER_SKILL_SLOTS) {
    const error = getCharacterStatusSkillError(raw?.characterSkills?.[slot], slot)
      || getCharacterSkillMovementError(raw?.characterSkills?.[slot], slot);
    if (error) return failure(`${slot.toUpperCase()}: ${error}`);
  }
  const profile = normalizeGuestCharacterProfile(raw);
  if (!profile) return failure('캐릭터 이름과 게스트 식별자를 확인해 주세요.');
  const rawResource = raw?.uniqueResource && typeof raw.uniqueResource === 'object' ? raw.uniqueResource : {};
  if (rawResource.enabled === true) {
    const resourceName = String(rawResource.name || '').trim();
    const maxValue = Number(rawResource.maxValue);
    const startValue = Number(rawResource.startValue);
    const regenPerSec = Number(rawResource.regenPerSec);
    if (!resourceName) return failure('고유 자원 이름을 입력해 주세요.');
    if (!Number.isFinite(maxValue) || maxValue < 1 || maxValue > 10000) return failure('고유 자원 최대치는 1~10000이어야 합니다.');
    if (!Number.isFinite(startValue) || startValue < 0 || startValue > maxValue) return failure('고유 자원 시작치는 0 이상 최대치 이하여야 합니다.');
    if (!Number.isFinite(regenPerSec) || regenPerSec < 0 || regenPerSec > 100) return failure('고유 자원 초당 회복은 0~100이어야 합니다.');
  }
  for (const [slot, skill] of Object.entries(profile.characterSkills)) {
    if (!skill.enabled) continue;
    if (!skill.name) return failure(`${slot.toUpperCase()} 스킬 이름을 입력해 주세요.`);
    const payload = [skill.firstFlat, skill.flatDamage, skill.secondFlat, skill.heal, skill.shield,
      skill.maxHpPct, skill.currentHpPct, skill.secondMaxHpPct, skill.secondCurrentHpPct,
      Object.values(skill.statModifiers), [skill.skillAmpScale, skill.firstSkillAmpScale, skill.secondSkillAmpScale,
        skill.attackPowerScale, skill.secondAttackPowerScale, skill.resourceGain, skill.movementDistance]].flat();
    if (!payload.some((value) => Number(value) !== 0) && !skill.statusEffects.length) return failure(`${slot.toUpperCase()}에 실제 피해·회복·보호막·이동·고유 자원 획득·능력치·상태 효과를 입력해 주세요.`);
    if (!profile.uniqueResource.enabled && (Number(skill.resourceCost || 0) > 0 || Number(skill.resourceGain || 0) > 0)) {
      return failure(`${slot.toUpperCase()}: 고유 자원 소비·획득을 쓰려면 고유 자원을 먼저 켜 주세요.`);
    }
    if (Number(skill.resourceCost || 0) > 10000 || Number(skill.resourceGain || 0) > 10000) {
      return failure(`${slot.toUpperCase()}: 고유 자원 소비·획득의 현재 지원 최대값은 10000입니다.`);
    }
    for (const [key, maximum] of Object.entries({ cooldownSec: 180, recastWindowSec: 30, range: 20,
      radius: 5, castDelaySec: 10, recoveryDelaySec: 10, durationSec: 60, movementDistance: 10 })) {
      if (skill[key] > maximum) return failure(`${slot.toUpperCase()}: ${key}의 현재 지원 최대값은 ${maximum}입니다. 자동으로 줄여 저장하지 않았습니다.`);
    }
  }
  const previous = readGuestCharacterProfiles(storage);
  if (!previous.ok) return previous;
  const profiles = [...previous.profiles.filter((row) => row.id !== profile.id), profile];
  const serialized = JSON.stringify({ schemaVersion: 1, profiles });
  if (serialized.length > MAX_BYTES) return failure('캐릭터 설정이 저장 한도를 넘었습니다. 설명을 줄여 주세요.');
  try {
    profileStorage(storage).setItem(GUEST_CHARACTER_PROFILE_KEY, serialized);
    return { ok: true, profiles, profile, errors: [] };
  } catch {
    return failure('기기에 저장하지 못해 적용하지 않았습니다. 저장 공간이나 브라우저 설정을 확인해 주세요.');
  }
}

export function applyGuestCharacterProfiles(roster, profiles = []) {
  const byId = new Map(profiles.map(normalizeGuestCharacterProfile).filter(Boolean).map((row) => [row.id, row]));
  return roster.map((actor) => {
    const profile = actor?.guestDefault === true && byId.get(idOf(actor));
    if (!profile) return actor;
    const definition = structuredClone(profile); delete definition.id;
    return applyStartingPassiveHealth({
      ...actor,
      ...definition,
      uniqueResourceValue: definition.uniqueResource?.enabled ? definition.uniqueResource.startValue : 0,
      localProfile: true,
      characterSkillCode: '',
      erSubject: '',
      characterSkillLevel: undefined,
    });
  });
}

export function saveGuestCharacterBeforeMatch({ actorId, draft, state = {}, actions = {}, storage }) {
  if (state.day !== 0 || state.matchSec !== 0 || state.isAdvancing || state.isGameOver || state.replayMode || state.isRunLocked?.()) {
    return failure('캐릭터 편집은 새 경기 시작 전 0일차 00초에만 가능합니다.');
  }
  const actor = (state.candidateSurvivors || []).find((row) => idOf(row) === actorId && row.guestDefault === true);
  if (!actor) return failure('게스트 기본 명단의 캐릭터만 이 기기에서 편집할 수 있습니다.');
  const result = saveGuestCharacterProfile({ ...draft, id: actorId }, storage);
  if (!result.ok) return result;
  actions.setCandidateSurvivors?.((rows) => applyGuestCharacterProfiles(rows, [result.profile]));
  actions.setSurvivors?.((rows) => applyGuestCharacterProfiles(rows, [result.profile]));
  return result;
}
