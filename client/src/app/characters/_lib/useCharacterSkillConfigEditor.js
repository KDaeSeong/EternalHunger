import { useMemo, useState } from 'react';
import {
  CHARACTER_SKILL_SLOT_LABELS,
  CHARACTER_SKILL_SLOTS,
  compileNaturalSkillDescription,
  getCharacterSkillMovementError,
} from '../../../utils/characterSkillCompiler';
import { getCharacterStatusSkillError } from '../../../utils/characterStatusSkillDefinition';
import { normalizeSupportedTacSkill } from '../../simulation/tacticalSkillTable';
import { normalizeUniqueResourceDefinition } from '../../simulation/_lib/uniqueResourceRuntime.js';
import {
  characterId,
  cleanNumber,
  createDefaultCharacterSkill,
  normalizeCharacterSkillForEditor,
  normalizeCharacterSkillLevels,
  normalizeCharacterSkillsForEditor,
  normalizeSkillLevelArray,
} from './characterEditorRuntime';

const normalizeEditableSkillSlot = (slot) => (
  CHARACTER_SKILL_SLOTS.includes(String(slot || '').toLowerCase()) ? String(slot || '').toLowerCase() : 'q'
);

function hasAnyLevelValue(list) {
  return (Array.isArray(list) ? list : []).some((value) => Number(value || 0) > 0);
}

function summarizeCompiledSkill(slot, skill, warnings = []) {
  const label = CHARACTER_SKILL_SLOT_LABELS[slot] || String(slot || '').toUpperCase();
  const damageBits = [];
  if (hasAnyLevelValue(skill.firstFlat)) damageBits.push(`1타 ${skill.firstFlat.join('/')}`);
  if (hasAnyLevelValue(skill.secondFlat)) damageBits.push(`2타 ${skill.secondFlat.join('/')}`);
  if (hasAnyLevelValue(skill.currentHpPct)) damageBits.push(`현재 체력 ${skill.currentHpPct.join('/')}%`);
  if (hasAnyLevelValue(skill.secondCurrentHpPct)) damageBits.push(`2타 현재 체력 ${skill.secondCurrentHpPct.join('/')}%`);
  if (hasAnyLevelValue(skill.maxHpPct)) damageBits.push(`최대 체력 ${skill.maxHpPct.join('/')}%`);
  if (hasAnyLevelValue(skill.secondMaxHpPct)) damageBits.push(`2타 최대 체력 ${skill.secondMaxHpPct.join('/')}%`);

  return {
    tone: warnings.length ? 'warning' : 'success',
    title: warnings.length ? `${label} 자동 작성 확인 필요` : `${label} 자동 작성 완료`,
    lines: [
      `타입 ${skill.type} / 조건 ${skill.useCondition || 'auto'} / 대상 ${skill.targetPriority || 'auto'} / 지원 ${skill.supportTargetScope || 'auto'}`,
      `쿨다운 ${skill.cooldownSec || 0}초 / 재발동 ${skill.recastWindowSec || 0}초 / 사거리 ${skill.range || 0} / 범위 ${skill.radius || 0}`,
      `선딜 ${skill.castDelaySec || 0}초 / 후딜 ${skill.recoveryDelaySec || 0}초`,
      damageBits.length ? `피해: ${damageBits.join(', ')}` : '피해/회복/보호막 수치가 없으면 수동 입력에서 보완하세요.',
      ...(skill.statusEffects?.length ? [`상태: ${skill.statusEffects.map((effect) => `${effect.name} / ${effect.target === 'self' ? '자신' : '스킬 대상'} / ${effect.durationSec}초`).join(', ')}`] : []),
      ...warnings,
    ],
  };
}

export function useCharacterSkillConfigEditor({
  characters,
  setCharacters,
} = {}) {
  const [configCharId, setConfigCharId] = useState(null);
  const [editTacticalSkill, setEditTacticalSkill] = useState('블링크');
  const [editCharacterSkillCode, setEditCharacterSkillCode] = useState('');
  const [editCharacterSkillLevels, setEditCharacterSkillLevels] = useState(() => normalizeCharacterSkillLevels());
  const [editCharacterSkills, setEditCharacterSkills] = useState(() => normalizeCharacterSkillsForEditor());
  const [editUniqueResource, setEditUniqueResource] = useState(() => normalizeUniqueResourceDefinition());
  const [activeSkillSlot, setActiveSkillSlot] = useState('q');
  const [manualSkillInputEnabled, setManualSkillInputEnabled] = useState(false);
  const [skillCompileNotice, setSkillCompileNotice] = useState(null);

  const configChar = useMemo(
    () => characters.find((c) => String(characterId(c)) === String(configCharId)) || null,
    [characters, configCharId]
  );

  const updateEditSkill = (slot, field, value) => {
    const skillSlot = normalizeEditableSkillSlot(slot);
    setEditCharacterSkills((prev) => {
      // Keep an invalid in-progress value visible until corrected; normalizing
      // the previous draft here would erase its status list on the next edit.
      const current = prev?.[skillSlot] || createDefaultCharacterSkill({}, skillSlot);
      const next = { ...current, [field]: value };
      if (field === 'firstFlat') next.flatDamage = [...value];
      if (field === 'firstSkillAmpScale') next.skillAmpScale = value;
      return { ...prev, [skillSlot]: next };
    });
  };

  const updateEditSkillLevelValue = (slot, field, index, value) => {
    const skillSlot = normalizeEditableSkillSlot(slot);
    setEditCharacterSkills((prev) => {
      const skill = prev?.[skillSlot] || createDefaultCharacterSkill({}, skillSlot);
      const isPercentField = field === 'secondMaxHpPct' || field === 'secondCurrentHpPct' || field === 'maxHpPct' || field === 'currentHpPct';
      const list = normalizeSkillLevelArray(skill[field], 0, { percent: isPercentField });
      list[index] = cleanNumber(value, 0);
      return {
        ...prev,
        [skillSlot]: {
          ...skill,
          [field]: list,
          ...(field === 'firstFlat' ? { flatDamage: [...list] } : {}),
        },
      };
    });
  };

  const compileEditSkillDescription = (slot = activeSkillSlot) => {
    const skillSlot = normalizeEditableSkillSlot(slot);
    const skill = editCharacterSkills?.[skillSlot] || createDefaultCharacterSkill({}, skillSlot);
    const result = compileNaturalSkillDescription(skill.sourceText, skill, skillSlot);
    if (result.ok === false) {
      setSkillCompileNotice({ tone: 'warning', title: '기존 입력을 유지했습니다', lines: result.warnings });
      return;
    }
    setEditCharacterSkills((prev) => ({
      ...prev,
      [skillSlot]: normalizeCharacterSkillForEditor({ [skillSlot]: result.skill }, skillSlot),
    }));
    setSkillCompileNotice(summarizeCompiledSkill(skillSlot, result.skill, result.warnings || []));
  };

  const openConfigModal = (char) => {
    const id = characterId(char);
    if (!id) return;
    setConfigCharId(id);
    setEditTacticalSkill(normalizeSupportedTacSkill(char?.tacticalSkill) || '블링크');
    setEditCharacterSkillCode(String(char?.characterSkillCode || char?.erSubject || '').trim());
    setEditCharacterSkillLevels(normalizeCharacterSkillLevels(char?.characterSkillLevels));
    setEditCharacterSkills(normalizeCharacterSkillsForEditor(char?.characterSkills));
    setEditUniqueResource(normalizeUniqueResourceDefinition(char?.uniqueResource));
    setActiveSkillSlot('q');
    setManualSkillInputEnabled(false);
    setSkillCompileNotice(null);
  };

  const closeConfigModal = () => {
    setConfigCharId(null);
    setSkillCompileNotice(null);
  };

  const saveConfigModal = () => {
    if (!configCharId) return;
    const errors = CHARACTER_SKILL_SLOTS.flatMap((slot) => {
      const error = getCharacterStatusSkillError(editCharacterSkills[slot], slot)
        || getCharacterSkillMovementError(editCharacterSkills[slot], slot);
      return error ? [`${CHARACTER_SKILL_SLOT_LABELS[slot]}: ${error}`] : [];
    });
    const rawResource = editUniqueResource && typeof editUniqueResource === 'object' ? editUniqueResource : {};
    const normalizedResource = normalizeUniqueResourceDefinition(rawResource);
    if (rawResource.enabled === true) {
      if (!String(rawResource.name || '').trim()) errors.push('고유 자원 이름을 입력해 주세요.');
      if (!Number.isFinite(Number(rawResource.maxValue)) || Number(rawResource.maxValue) < 1 || Number(rawResource.maxValue) > 10000) errors.push('고유 자원 최대치는 1~10000이어야 합니다.');
      if (!Number.isFinite(Number(rawResource.startValue)) || Number(rawResource.startValue) < 0 || Number(rawResource.startValue) > Number(rawResource.maxValue)) errors.push('고유 자원 시작치는 0 이상 최대치 이하여야 합니다.');
      if (!Number.isFinite(Number(rawResource.regenPerSec)) || Number(rawResource.regenPerSec) < 0 || Number(rawResource.regenPerSec) > 100) errors.push('고유 자원 초당 회복은 0~100이어야 합니다.');
    }
    for (const slot of CHARACTER_SKILL_SLOTS) {
      const skill = editCharacterSkills[slot] || {};
      if (!skill.enabled) continue;
      if (!normalizedResource.enabled && (Number(skill.resourceCost || 0) > 0 || Number(skill.resourceGain || 0) > 0)) {
        errors.push(`${CHARACTER_SKILL_SLOT_LABELS[slot]}: 고유 자원 소비·획득을 쓰려면 고유 자원을 먼저 켜 주세요.`);
      }
      if (Number(skill.resourceCost || 0) > 10000 || Number(skill.resourceGain || 0) > 10000) {
        errors.push(`${CHARACTER_SKILL_SLOT_LABELS[slot]}: 고유 자원 소비·획득은 10000 이하여야 합니다.`);
      }
    }
    if (errors.length) {
      setSkillCompileNotice({ tone: 'warning', title: '저장하지 않았습니다', lines: errors });
      return;
    }
    setCharacters((prev) =>
      prev.map((char) => {
        const id = characterId(char);
        if (String(id) !== String(configCharId)) return char;
        return {
          ...char,
          goalGearTier: 6,
          tacticalSkill: normalizeSupportedTacSkill(editTacticalSkill),
          characterSkillCode: String(editCharacterSkillCode || '').trim(),
          characterSkillLevel: editCharacterSkillLevels.q,
          characterSkillLevels: normalizeCharacterSkillLevels(editCharacterSkillLevels),
          characterSkills: normalizeCharacterSkillsForEditor(editCharacterSkills),
          uniqueResource: normalizedResource,
        };
      })
    );
    closeConfigModal();
  };

  return {
    activeSkillSlot,
    closeConfigModal,
    compileEditSkillDescription,
    configChar,
    editCharacterSkillCode,
    editCharacterSkillLevels,
    editCharacterSkills,
    editUniqueResource,
    editTacticalSkill,
    manualSkillInputEnabled,
    openConfigModal,
    saveConfigModal,
    setActiveSkillSlot,
    setEditCharacterSkillCode,
    setEditCharacterSkillLevels,
    setEditUniqueResource,
    setEditTacticalSkill,
    setManualSkillInputEnabled,
    skillCompileNotice,
    updateEditSkill,
    updateEditSkillLevelValue,
  };
}
