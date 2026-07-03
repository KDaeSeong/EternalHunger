import Link from 'next/link';
import {
  CHARACTER_SKILL_SLOT_LABELS,
  CHARACTER_SKILL_SLOTS,
  buildSkillCodePreview,
} from '../../../utils/characterSkillCompiler';
import { TACTICAL_SKILL_OPTIONS_KO } from '../../simulation/tacticalSkillTable';
import {
  GOAL_GEAR_TIERS,
  cleanNumber,
  normalizeCharacterSkillLevels,
} from '../_lib/characterEditorRuntime';
import {
  CharacterActiveSkillFields,
  CharacterPassiveSkillFields,
  normalizeSkillSlot,
  skillPlaceholder,
} from './CharacterSkillConfigFields';

function CharacterSkillConfigModal({
  character,
  editCharacterSkillCode,
  editCharacterSkillLevels,
  editCharacterSkills,
  activeSkillSlot,
  editGoalGearTier,
  editTacticalSkill,
  manualSkillInputEnabled = false,
  onBackdropPointerDown,
  onBackdropPointerUp,
  onClose,
  onCompileSkillDescription,
  onSave,
  onSetActiveSkillSlot,
  onSetCharacterSkillCode,
  onSetCharacterSkillLevels,
  onSetGoalGearTier,
  onSetManualSkillInputEnabled = () => {},
  onSetTacticalSkill,
  onUpdateSkill,
  onUpdateSkillLevelValue,
}) {
  if (!character) return null;

  const slot = normalizeSkillSlot(activeSkillSlot);
  const skill = editCharacterSkills?.[slot] || {};
  const isPassive = slot === 'passive';
  const disabled = skill.enabled !== true;

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
                <label className="character-skill-toggle character-skill-manual-toggle">
                  <input
                    type="checkbox"
                    checked={manualSkillInputEnabled}
                    onChange={(event) => onSetManualSkillInputEnabled(event.target.checked)}
                  />
                  <span>수동 편집</span>
                </label>
              </div>
              {manualSkillInputEnabled ? (
                <pre>{buildSkillCodePreview(skill)}</pre>
              ) : null}
            </div>

            {manualSkillInputEnabled ? (
              <>
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
                      {CHARACTER_SKILL_SLOT_LABELS[slot]} 최대 레벨
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
                  <CharacterActiveSkillFields
                    disabled={disabled}
                    onUpdateSkill={onUpdateSkill}
                    onUpdateSkillLevelValue={onUpdateSkillLevelValue}
                    skill={skill}
                    slot={slot}
                  />
                ) : (
                  <CharacterPassiveSkillFields
                    disabled={disabled}
                    onUpdateSkill={onUpdateSkill}
                    skill={skill}
                    slot={slot}
                  />
                )}
              </>
            ) : null}
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
