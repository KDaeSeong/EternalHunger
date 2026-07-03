import Link from 'next/link';
import {
  CHARACTER_SKILL_SLOT_LABELS,
  CHARACTER_SKILL_SLOTS,
  buildSkillCodePreview,
} from '../../../utils/characterSkillCompiler';
import { TACTICAL_SKILL_OPTIONS_KO } from '../../simulation/tacticalSkillTable';
import {
  GOAL_GEAR_TIERS,
  SKILL_LEVEL_COUNT,
  cleanNumber,
  normalizeCharacterSkillLevels,
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

function normalizeSkillSlot(slot) {
  const key = String(slot || 'q').trim().toLowerCase();
  return CHARACTER_SKILL_SLOTS.includes(key) ? key : 'q';
}

function skillPlaceholder(slot) {
  if (slot === 'passive') {
    return '패시브: 공격력 +10, 스킬증폭 +15, 시야 +1';
  }
  return `${CHARACTER_SKILL_SLOT_LABELS[slot]}: 적 1인에게 10/20/30/40/50 피해, 쿨타임 7초, 5초 안에 다시 발동하면 20/30/40/50/60 피해, 범위 1, 대상 현재 체력의 1/1/2/2/3% 추가 피해`;
}

function CharacterSkillConfigModal({
  character,
  editCharacterSkillCode,
  editCharacterSkillLevels,
  editCharacterSkills,
  activeSkillSlot,
  editGoalGearTier,
  editTacticalSkill,
  onBackdropPointerDown,
  onBackdropPointerUp,
  onClose,
  onCompileSkillDescription,
  onSave,
  onSetActiveSkillSlot,
  onSetCharacterSkillCode,
  onSetCharacterSkillLevels,
  onSetGoalGearTier,
  onSetTacticalSkill,
  onUpdateSkill,
  onUpdateSkillLevelValue,
}) {
  if (!character) return null;

  const slot = normalizeSkillSlot(activeSkillSlot);
  const skill = editCharacterSkills?.[slot] || {};
  const isPassive = slot === 'passive';
  const disabled = skill.enabled !== true;

  const updatePassiveStat = (stat, value) => {
    onUpdateSkill(slot, 'statModifiers', {
      ...(skill.statModifiers || {}),
      [stat]: cleanNumber(value, 0),
    });
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="character-edit-backdrop"
      onPointerDown={onBackdropPointerDown}
      onPointerUp={(event) => onBackdropPointerUp(event, onClose)}
    >
      <div className="character-edit-modal">
        <div className="character-edit-head">
          <div>
            <p>목표/스킬 설정</p>
            <h2>{character.name || '이름 없음'}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="닫기">x</button>
        </div>

        <div className="character-edit-fields">
          <label>
            <span className="character-field-help">
              목표 장비 등급
              <Link href="/help" className="inline-help-link" title="목표 장비 등급 안내">?</Link>
            </span>
            <select value={String(editGoalGearTier)} onChange={(event) => onSetGoalGearTier(Number(event.target.value))}>
              {GOAL_GEAR_TIERS.map((tier) => (
                <option key={tier.value} value={String(tier.value)}>{tier.label}</option>
              ))}
            </select>
          </label>

          <label>
            <span className="character-field-help">
              전술 스킬
              <Link href="/help" className="inline-help-link" title="전술 스킬 안내">?</Link>
            </span>
            <select value={String(editTacticalSkill)} onChange={(event) => onSetTacticalSkill(event.target.value)}>
              {TACTICAL_SKILL_OPTIONS_KO.map((tacticalSkill) => (
                <option key={tacticalSkill} value={tacticalSkill}>{tacticalSkill}</option>
              ))}
            </select>
          </label>

          <div className="character-skill-section">
            <div className="character-skill-section-head">
              <strong>캐릭터 스킬</strong>
              <label className="character-skill-toggle">
                <input
                  type="checkbox"
                  checked={skill.enabled === true}
                  onChange={(event) => onUpdateSkill(slot, 'enabled', event.target.checked)}
                />
                <span>사용</span>
              </label>
            </div>

            <div className="character-skill-tabs" role="tablist" aria-label="스킬 슬롯">
              {CHARACTER_SKILL_SLOTS.map((skillSlot) => (
                <button
                  type="button"
                  role="tab"
                  key={skillSlot}
                  className={slot === skillSlot ? 'active' : ''}
                  aria-selected={slot === skillSlot}
                  onClick={() => onSetActiveSkillSlot(skillSlot)}
                >
                  {CHARACTER_SKILL_SLOT_LABELS[skillSlot]}
                </button>
              ))}
            </div>

            <div className="character-skill-compiler">
              <label>
                {CHARACTER_SKILL_SLOT_LABELS[slot]} 설명
                <textarea
                  value={skill.sourceText || ''}
                  onChange={(event) => onUpdateSkill(slot, 'sourceText', event.target.value)}
                  placeholder={skillPlaceholder(slot)}
                />
              </label>
              <div className="character-skill-compiler-actions">
                <button type="button" onClick={() => onCompileSkillDescription(slot)}>자동 작성</button>
              </div>
              <pre>{buildSkillCodePreview(skill)}</pre>
            </div>

            <div className="character-skill-inline-grid">
              <label>
                스킬 코드
                <input
                  type="text"
                  value={editCharacterSkillCode}
                  onChange={(event) => onSetCharacterSkillCode(event.target.value)}
                  placeholder="예: bihyung"
                />
              </label>

              {!isPassive ? (
                <label>
                  {CHARACTER_SKILL_SLOT_LABELS[slot]} 레벨
                  <input
                    type="number"
                    min="1"
                    max="5"
                    step="1"
                    value={editCharacterSkillLevels?.[slot] || 1}
                    onChange={(event) => onSetCharacterSkillLevels((prev) => ({
                      ...normalizeCharacterSkillLevels(prev),
                      [slot]: Math.max(1, Math.min(5, Math.floor(cleanNumber(event.target.value, 1)))),
                    }))}
                  />
                </label>
              ) : null}
            </div>

            <label>
              스킬 이름
              <input
                type="text"
                value={skill.name || ''}
                onChange={(event) => onUpdateSkill(slot, 'name', event.target.value)}
                placeholder={isPassive ? '패시브 이름' : `${CHARACTER_SKILL_SLOT_LABELS[slot]} 이름`}
                disabled={disabled}
              />
            </label>

            {!isPassive ? (
              <>
                <div className="character-skill-inline-grid">
                  <label>
                    타입
                    <select
                      value={skill.type || (slot === 'q' ? 'basic_attack_recast' : 'combat_effect')}
                      onChange={(event) => onUpdateSkill(slot, 'type', event.target.value)}
                      disabled={disabled}
                    >
                      <option value="combat_effect">일반 전투 효과</option>
                      <option value="basic_attack_recast">기본 공격/재발동</option>
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
            ) : (
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
            )}
          </div>
        </div>

        <div className="character-edit-actions">
          <button type="button" onClick={onClose}>취소</button>
          <button type="button" className="primary" onClick={onSave}>적용</button>
        </div>
      </div>
    </div>
  );
}

export default CharacterSkillConfigModal;
