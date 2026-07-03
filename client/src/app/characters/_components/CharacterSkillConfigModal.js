import Link from 'next/link';
import { buildQSkillCodePreview } from '../../../utils/characterSkillCompiler';
import { TACTICAL_SKILL_OPTIONS_KO } from '../../simulation/tacticalSkillTable';
import {
  GOAL_GEAR_TIERS,
  SKILL_LEVEL_COUNT,
  cleanNumber,
  normalizeCharacterSkillLevels,
} from '../_lib/characterEditorRuntime';

function CharacterSkillConfigModal({
  character,
  editCharacterSkillCode,
  editCharacterSkillLevels,
  editCharacterSkills,
  editGoalGearTier,
  editTacticalSkill,
  onBackdropPointerDown,
  onBackdropPointerUp,
  onClose,
  onCompileQSkillDescription,
  onSave,
  onSetCharacterSkillCode,
  onSetCharacterSkillLevels,
  onSetGoalGearTier,
  onSetTacticalSkill,
  onUpdateQSkill,
  onUpdateQSkillLevelValue,
}) {
  if (!character) return null;

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
          <button type="button" onClick={onClose} aria-label="닫기">×</button>
        </div>

        <div className="character-edit-fields">
          <label>
            <span className="character-field-help">
              목표 장비 등급
              <Link href="/help" className="inline-help-link" title="목표 장비 등급 도움말">?</Link>
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
              <Link href="/help" className="inline-help-link" title="전술 스킬 도움말">?</Link>
            </span>
            <select value={String(editTacticalSkill)} onChange={(event) => onSetTacticalSkill(event.target.value)}>
              {TACTICAL_SKILL_OPTIONS_KO.map((skill) => (
                <option key={skill} value={skill}>{skill}</option>
              ))}
            </select>
          </label>

          <div className="character-skill-section">
            <div className="character-skill-section-head">
              <strong>캐릭터 Q</strong>
              <label className="character-skill-toggle">
                <input
                  type="checkbox"
                  checked={editCharacterSkills?.q?.enabled === true}
                  onChange={(event) => onUpdateQSkill('enabled', event.target.checked)}
                />
                <span>사용</span>
              </label>
            </div>

            <div className="character-skill-compiler">
              <label>
                Q 설명
                <textarea
                  value={editCharacterSkills?.q?.sourceText || ''}
                  onChange={(event) => onUpdateQSkill('sourceText', event.target.value)}
                  placeholder="적 1인에게 10/20/30/40/50 피해, 5초 안에 한번 더 발동하면 20/30/40/50/60, 범위 1, 현재 체력의 1/1/2/2/3퍼센트 추가 피해"
                />
              </label>
              <div className="character-skill-compiler-actions">
                <button type="button" onClick={onCompileQSkillDescription}>생성</button>
              </div>
              <pre>{buildQSkillCodePreview(editCharacterSkills?.q)}</pre>
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

              <label>
                Q 레벨
                <input
                  type="number"
                  min="1"
                  max="5"
                  step="1"
                  value={editCharacterSkillLevels.q}
                  onChange={(event) => onSetCharacterSkillLevels((prev) => ({
                    ...normalizeCharacterSkillLevels(prev),
                    q: Math.max(1, Math.min(5, Math.floor(cleanNumber(event.target.value, 1)))),
                  }))}
                />
              </label>
            </div>

            <label>
              Q 이름
              <input
                type="text"
                value={editCharacterSkills?.q?.name || ''}
                onChange={(event) => onUpdateQSkill('name', event.target.value)}
                placeholder="예: 도깨비 장난"
                disabled={editCharacterSkills?.q?.enabled !== true}
              />
            </label>

            <div className="character-skill-inline-grid">
              <label>
                쿨다운(초)
                <input
                  type="number"
                  min="1"
                  step="0.5"
                  value={editCharacterSkills?.q?.cooldownSec ?? 7}
                  onChange={(event) => onUpdateQSkill('cooldownSec', Math.max(1, cleanNumber(event.target.value, 7)))}
                  disabled={editCharacterSkills?.q?.enabled !== true}
                />
              </label>

              <label>
                재시전 시간(초)
                <input
                  type="number"
                  min="1"
                  step="0.5"
                  value={editCharacterSkills?.q?.recastWindowSec ?? 5}
                  onChange={(event) => onUpdateQSkill('recastWindowSec', Math.max(1, cleanNumber(event.target.value, 5)))}
                  disabled={editCharacterSkills?.q?.enabled !== true}
                />
              </label>

              <label>
                Q2 광역 범위
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  value={editCharacterSkills?.q?.radius ?? 0}
                  onChange={(event) => onUpdateQSkill('radius', Math.max(0, cleanNumber(event.target.value, 0)))}
                  disabled={editCharacterSkills?.q?.enabled !== true}
                />
              </label>
            </div>

            {[
              ['firstFlat', 'Q1 추가 피해', 1],
              ['secondFlat', 'Q2 추가 피해', 1],
              ['secondCurrentHpPct', 'Q2 현재 체력 %', 0.5],
              ['secondMaxHpPct', 'Q2 최대 체력 %', 0.5],
            ].map(([field, label, step]) => (
              <div className="character-skill-level-editor" key={field}>
                <span>{label}</span>
                <div className="character-skill-level-grid">
                  {Array.from({ length: SKILL_LEVEL_COUNT }).map((_, index) => (
                    <label key={`${field}-${index}`}>
                      Lv.{index + 1}
                      <input
                        type="number"
                        min="0"
                        step={String(step)}
                        value={editCharacterSkills?.q?.[field]?.[index] ?? 0}
                        onChange={(event) => onUpdateQSkillLevelValue(field, index, event.target.value)}
                        disabled={editCharacterSkills?.q?.enabled !== true}
                      />
                    </label>
                  ))}
                </div>
              </div>
            ))}

            <div className="character-skill-inline-grid">
              <label>
                Q1 스증 계수
                <input
                  type="number"
                  min="0"
                  step="0.05"
                  value={editCharacterSkills?.q?.firstSkillAmpScale ?? 0}
                  onChange={(event) => onUpdateQSkill('firstSkillAmpScale', Math.max(0, cleanNumber(event.target.value, 0)))}
                  disabled={editCharacterSkills?.q?.enabled !== true}
                />
              </label>

              <label>
                Q2 스증 계수
                <input
                  type="number"
                  min="0"
                  step="0.05"
                  value={editCharacterSkills?.q?.secondSkillAmpScale ?? 0}
                  onChange={(event) => onUpdateQSkill('secondSkillAmpScale', Math.max(0, cleanNumber(event.target.value, 0)))}
                  disabled={editCharacterSkills?.q?.enabled !== true}
                />
              </label>
            </div>
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
