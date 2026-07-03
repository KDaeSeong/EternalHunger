import {
  CHARACTER_ACTIVE_SKILL_TYPE_OPTIONS,
  CHARACTER_SKILL_SLOT_LABELS,
  CHARACTER_SKILL_SLOTS,
  normalizeCharacterSkillType,
} from '../../../utils/characterSkillCompiler';
import {
  SKILL_LEVEL_COUNT,
  cleanNumber,
} from '../_lib/characterEditorRuntime';

const LEVEL_FIELDS = [
  ['firstFlat', '1차 피해', 1],
  ['currentHpPct', '1차 현재 체력 %', 0.5],
  ['maxHpPct', '1차 최대 체력 %', 0.5],
  ['secondFlat', '재발동 피해', 1],
  ['secondCurrentHpPct', '재발동 현재 체력 %', 0.5],
  ['secondMaxHpPct', '재발동 최대 체력 %', 0.5],
  ['heal', '회복량', 1],
  ['shield', '보호막', 1],
];

const PASSIVE_STAT_FIELDS = [
  ['maxHp', '체력', 1],
  ['attackPower', '공격력', 0.5],
  ['skillAmp', '스킬증폭', 0.5],
  ['defense', '방어력', 0.5],
  ['attackRange', '사정거리', 0.1],
  ['sightRange', '시야', 0.1],
  ['attackSpeed', '공격속도', 0.01],
];

const TARGET_PRIORITY_OPTIONS = [
  ['auto', '자동'],
  ['damage', '피해량'],
  ['killable', '처치 가능'],
  ['lowest_hp', '낮은 체력'],
  ['highest_max_hp', '높은 최대 체력'],
  ['cluster', '광역 가치'],
];

const USE_CONDITION_OPTIONS = [
  ['auto', '자동'],
  ['harass', '견제'],
  ['finish', '마무리'],
  ['defensive', '방어적'],
];

export function normalizeSkillSlot(slot) {
  const key = String(slot || 'q').trim().toLowerCase();
  return CHARACTER_SKILL_SLOTS.includes(key) ? key : 'q';
}

export function skillPlaceholder(slot) {
  if (slot === 'passive') {
    return '패시브: 공격력 +10, 스킬증폭 +15, 시야 +1';
  }
  return `${CHARACTER_SKILL_SLOT_LABELS[slot]}: 적 1인에게 10/20/30/40/50 피해, 쿨타임 7초, 5초 안에 다시 발동하면 20/30/40/50/60 피해, 범위 1, 대상 현재 체력의 1/1/2/2/3% 추가 피해`;
}

export function CharacterActiveSkillFields({
  disabled,
  onUpdateSkill,
  onUpdateSkillLevelValue,
  skill = {},
  slot,
}) {
  return (
    <>
      <div className="character-skill-inline-grid">
        <label>
          타입
          <select
            value={normalizeCharacterSkillType(skill.type, slot)}
            onChange={(event) => onUpdateSkill(slot, 'type', event.target.value)}
            disabled={disabled}
          >
            {CHARACTER_ACTIVE_SKILL_TYPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>

        <label>
          쿨타임(초)
          <input
            type="number"
            min="1"
            step="0.5"
            value={skill.cooldownSec ?? 7}
            onChange={(event) => onUpdateSkill(slot, 'cooldownSec', Math.max(1, cleanNumber(event.target.value, 7)))}
            disabled={disabled}
          />
        </label>

        <label>
          재발동 시간(초)
          <input
            type="number"
            min="0"
            step="0.5"
            value={skill.recastWindowSec ?? 0}
            onChange={(event) => onUpdateSkill(slot, 'recastWindowSec', Math.max(0, cleanNumber(event.target.value, 0)))}
            disabled={disabled}
          />
        </label>

        <label>
          광역 범위
          <input
            type="number"
            min="0"
            step="0.5"
            value={skill.radius ?? 0}
            onChange={(event) => onUpdateSkill(slot, 'radius', Math.max(0, cleanNumber(event.target.value, 0)))}
            disabled={disabled}
          />
        </label>
      </div>

      <div className="character-skill-inline-grid">
        <label>
          사거리
          <input
            type="number"
            min="0"
            step="0.1"
            value={skill.range ?? 0}
            onChange={(event) => onUpdateSkill(slot, 'range', Math.max(0, cleanNumber(event.target.value, 0)))}
            disabled={disabled}
          />
        </label>

        <label>
          선딜(초)
          <input
            type="number"
            min="0"
            step="0.05"
            value={skill.castDelaySec ?? 0}
            onChange={(event) => onUpdateSkill(slot, 'castDelaySec', Math.max(0, cleanNumber(event.target.value, 0)))}
            disabled={disabled}
          />
        </label>

        <label>
          후딜(초)
          <input
            type="number"
            min="0"
            step="0.05"
            value={skill.recoveryDelaySec ?? 0}
            onChange={(event) => onUpdateSkill(slot, 'recoveryDelaySec', Math.max(0, cleanNumber(event.target.value, 0)))}
            disabled={disabled}
          />
        </label>

        <label>
          대상 AI
          <select
            value={skill.targetPriority || 'auto'}
            onChange={(event) => onUpdateSkill(slot, 'targetPriority', event.target.value)}
            disabled={disabled}
          >
            {TARGET_PRIORITY_OPTIONS.map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="character-skill-inline-grid">
        <label>
          사용 조건
          <select
            value={skill.useCondition || 'auto'}
            onChange={(event) => onUpdateSkill(slot, 'useCondition', event.target.value)}
            disabled={disabled}
          >
            {USE_CONDITION_OPTIONS.map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </label>

        <label>
          최소 기대 피해
          <input
            type="number"
            min="0"
            step="1"
            value={skill.minExpectedDamage ?? 1}
            onChange={(event) => onUpdateSkill(slot, 'minExpectedDamage', Math.max(0, cleanNumber(event.target.value, 1)))}
            disabled={disabled}
          />
        </label>

        <label>
          최소 광역 대상
          <input
            type="number"
            min="0"
            step="1"
            value={skill.minSplashTargets ?? 0}
            onChange={(event) => onUpdateSkill(slot, 'minSplashTargets', Math.max(0, Math.floor(cleanNumber(event.target.value, 0))))}
            disabled={disabled}
          />
        </label>
      </div>

      {LEVEL_FIELDS.map(([field, label, step]) => (
        <div className="character-skill-level-editor" key={`${slot}-${field}`}>
          <span>{label}</span>
          <div className="character-skill-level-grid">
            {Array.from({ length: SKILL_LEVEL_COUNT }).map((_, index) => (
              <label key={`${field}-${index}`}>
                Lv.{index + 1}
                <input
                  type="number"
                  min="0"
                  step={String(step)}
                  value={skill?.[field]?.[index] ?? 0}
                  onChange={(event) => onUpdateSkillLevelValue(slot, field, index, event.target.value)}
                  disabled={disabled}
                />
              </label>
            ))}
          </div>
        </div>
      ))}

      <div className="character-skill-inline-grid">
        <label>
          1차 스증 계수
          <input
            type="number"
            min="0"
            step="0.05"
            value={skill.firstSkillAmpScale ?? 0}
            onChange={(event) => onUpdateSkill(slot, 'firstSkillAmpScale', Math.max(0, cleanNumber(event.target.value, 0)))}
            disabled={disabled}
          />
        </label>

        <label>
          재발동 스증 계수
          <input
            type="number"
            min="0"
            step="0.05"
            value={skill.secondSkillAmpScale ?? 0}
            onChange={(event) => onUpdateSkill(slot, 'secondSkillAmpScale', Math.max(0, cleanNumber(event.target.value, 0)))}
            disabled={disabled}
          />
        </label>
      </div>
    </>
  );
}

export function CharacterPassiveSkillFields({
  disabled,
  onUpdateSkill,
  skill = {},
  slot,
}) {
  const updatePassiveStat = (stat, value) => {
    onUpdateSkill(slot, 'statModifiers', {
      ...(skill.statModifiers || {}),
      [stat]: cleanNumber(value, 0),
    });
  };

  return (
    <div className="character-skill-level-editor">
      <span>패시브 스탯</span>
      <div className="character-skill-level-grid passive">
        {PASSIVE_STAT_FIELDS.map(([field, label, step]) => (
          <label key={field}>
            {label}
            <input
              type="number"
              step={String(step)}
              value={skill.statModifiers?.[field] ?? 0}
              onChange={(event) => updatePassiveStat(field, event.target.value)}
              disabled={disabled}
            />
          </label>
        ))}
      </div>
    </div>
  );
}
