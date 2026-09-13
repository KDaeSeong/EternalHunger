'use client';

import { useEffect, useRef, useState } from 'react';
import { CHARACTER_SKILL_SLOTS, CHARACTER_SKILL_SLOT_LABELS, compileNaturalSkillDescription } from '../../../utils/characterSkillCompiler';
import { CharacterActiveSkillFields, CharacterPassiveSkillFields } from '../../characters/_components/CharacterSkillConfigFields';
import { TACTICAL_SKILL_OPTIONS_KO } from '../tacticalSkillTable';
import { normalizeGuestCharacterProfile } from '../_lib/guestCharacterProfileRuntime';

export default function SimulationLocalCharacterEditor({ actor, onClose, onSave }) {
  const [draft, setDraft] = useState(() => normalizeGuestCharacterProfile({ ...actor, id: actor._id || actor.id }));
  const [slot, setSlot] = useState('q');
  const [message, setMessage] = useState('');
  const [compileNotice, setCompileNotice] = useState('');
  const panel = useRef(null);
  const skill = draft.characterSkills[slot];
  const passive = slot === 'passive';
  const disabled = skill.enabled !== true;

  useEffect(() => { panel.current?.querySelector('input')?.focus(); }, []);

  function updateSkill(skillSlot, field, value) {
    setDraft((previous) => {
      const next = { ...previous.characterSkills[skillSlot], [field]: value };
      if (field === 'firstFlat') next.flatDamage = [...value];
      if (field === 'firstSkillAmpScale') next.skillAmpScale = value;
      return { ...previous, characterSkills: { ...previous.characterSkills, [skillSlot]: next } };
    });
    setMessage('');
  }

  function updateUniqueResource(field, value) {
    setDraft((previous) => ({
      ...previous,
      uniqueResource: { ...previous.uniqueResource, [field]: value },
    }));
    setMessage('');
  }

  function updateLevel(skillSlot, field, index, value) {
    const next = [...draft.characterSkills[skillSlot][field]];
    next[index] = Math.max(0, Number(value) || 0);
    updateSkill(skillSlot, field, next);
  }

  function compileDescription() {
    const result = compileNaturalSkillDescription(skill.sourceText, skill, slot);
    if (result.ok === false) {
      setCompileNotice(result.warnings.join(' '));
      return;
    }
    setDraft((previous) => ({ ...previous, characterSkills: { ...previous.characterSkills, [slot]: result.skill } }));
    setCompileNotice(['설명에서 인식한 수치를 아래 입력란에 반영했습니다. 실제 의도와 일치하는지 확인해 주세요.', ...result.warnings].join(' '));
  }

  function save() {
    const result = onSave(actor._id || actor.id, draft);
    if (result?.ok) onClose(`${result.profile.name}: 이름·스킬을 이 기기에 저장하고 현재 편성에 반영했습니다.`);
    else setMessage(result?.errors?.[0] || '저장하지 못했습니다.');
  }

  function containFocus(event) {
    if (event.key !== 'Tab') return;
    const items = [...panel.current.querySelectorAll('button, input, textarea, select, summary, [tabindex="0"]')]
      .filter((element) => !element.disabled && element.getClientRects().length > 0);
    const first = items[0]; const last = items.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  }

  return (
    <div className="simulation-roster-modal-backdrop">
      <section className="simulation-roster-modal simulation-local-character-editor" role="dialog" aria-modal="true"
        aria-labelledby="local-character-title" ref={panel} onKeyDown={containFocus}>
        <header className="simulation-roster-modal__header">
          <div><span>로그인 없이 · 이 기기에 저장</span><h2 id="local-character-title">이름·스킬 편집</h2></div>
          <button type="button" onClick={() => onClose()} aria-label="편집 취소">닫기</button>
        </header>
        <div className="simulation-local-character-editor__body">
          <p className="simulation-local-character-editor__notice">사용자가 작성하는 설정입니다. 원작 스킬을 자동 제공하지 않으며, 이름을 바꿔도 능력치·무기·숨은 원작 보정은 추가하지 않습니다. 저장하면 이 캐릭터의 이후 새 경기에도 사용됩니다.</p>
          <div className="character-skill-inline-grid">
            <label>캐릭터 이름<input value={draft.name} maxLength={80} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></label>
            <label>전술 스킬<select value={draft.tacticalSkill} onChange={(event) => setDraft({ ...draft, tacticalSkill: event.target.value })}>
              {TACTICAL_SKILL_OPTIONS_KO.map((value) => <option key={value}>{value}</option>)}
            </select></label>
          </div>
          <label className="simulation-local-character-editor__toggle"><input type="checkbox"
            checked={draft.uniqueResource.enabled === true}
            onChange={(event) => updateUniqueResource('enabled', event.target.checked)} />고유 자원 사용</label>
          {draft.uniqueResource.enabled ? <>
            <div className="character-skill-inline-grid">
              <label>자원 이름<input value={draft.uniqueResource.name} maxLength={30}
                onChange={(event) => updateUniqueResource('name', event.target.value)} /></label>
              <label>최대치<input type="number" min="1" max="10000" step="1" value={draft.uniqueResource.maxValue}
                onChange={(event) => updateUniqueResource('maxValue', Number(event.target.value))} /></label>
              <label>시작치<input type="number" min="0" max={draft.uniqueResource.maxValue} step="1" value={draft.uniqueResource.startValue}
                onChange={(event) => updateUniqueResource('startValue', Number(event.target.value))} /></label>
              <label>초당 회복<input type="number" min="0" max="100" step="0.1" value={draft.uniqueResource.regenPerSec}
                onChange={(event) => updateUniqueResource('regenPerSec', Number(event.target.value))} /></label>
            </div>
            <small>스킬 시전 시작 때 비용을 내며, 취소·중단되어도 반환되지 않습니다. 성공적으로 발동한 스킬만 획득치를 받습니다.</small>
          </> : null}
          <div className="simulation-local-character-editor__tabs" aria-label="편집할 스킬">
            {CHARACTER_SKILL_SLOTS.map((key) => <button type="button" key={key} aria-pressed={slot === key}
              onClick={() => { setSlot(key); setCompileNotice(''); }}>
              {CHARACTER_SKILL_SLOT_LABELS[key]} · {draft.characterSkills[key].enabled ? '사용' : '없음'}
            </button>)}
          </div>
          <label className="simulation-local-character-editor__toggle"><input type="checkbox" checked={skill.enabled}
            onChange={(event) => updateSkill(slot, 'enabled', event.target.checked)} />{CHARACTER_SKILL_SLOT_LABELS[slot]} 사용</label>
          <label>스킬 이름<input value={skill.name} maxLength={100} disabled={disabled}
            onChange={(event) => updateSkill(slot, 'name', event.target.value)} /></label>
          {!passive && <label>스킬 레벨<select value={draft.characterSkillLevels[slot] || 'auto'} disabled={disabled}
            onChange={(event) => {
              const levels = { ...draft.characterSkillLevels };
              if (event.target.value === 'auto') delete levels[slot]; else levels[slot] = Number(event.target.value);
              setDraft({ ...draft, characterSkillLevels: levels });
            }}><option value="auto">성장에 따라 자동 (1→5)</option>
              {[1, 2, 3, 4, 5].map((level) => <option key={level} value={level}>{level}레벨 고정</option>)}
            </select></label>}
          <details className="simulation-local-character-editor__description">
            <summary>설명에서 수치 입력 보조</summary>
            <p>지원되는 피해·회복·보호막·패시브 수치를 변환합니다. 상태 효과는 아래에서 직접 선택하며, 상태가 있는 스킬의 타입은 자동 변경하지 않습니다. 입력과 충돌하면 기존 내용을 유지합니다. 설명만으로 임의의 CC·이동 동작을 만들지는 않습니다.</p>
            <label>원문·작성 근거<textarea value={skill.sourceText} maxLength={5000}
              onChange={(event) => updateSkill(slot, 'sourceText', event.target.value)} /></label>
            <button type="button" onClick={compileDescription}>설명에서 수치 채우기</button>
            {compileNotice && <p role="status">{compileNotice}</p>}
          </details>
          <p className="simulation-local-character-editor__notice">사거리·광역·시야와 이동은 지역 내부 좌표의 실제 거리로 판정합니다. 각 지역은 이 프로젝트의 24m 정사각형이며 원작 지형·장애물·투사체 비행은 재현하지 않습니다. 이동 스킬은 실제 발동 순간 같은 전장 안에서만 움직이며, 재발동은 기본 공격 강화의 두 번째 사용에 적용됩니다.</p>
          {passive ? <CharacterPassiveSkillFields disabled={disabled} skill={skill} slot={slot} onUpdateSkill={updateSkill} />
            : <>
              <CharacterActiveSkillFields disabled={disabled} skill={skill} slot={slot} onUpdateSkill={updateSkill} onUpdateSkillLevelValue={updateLevel} />
              <div className="character-skill-inline-grid">
                <label>피해 종류<select value={skill.damageType} disabled={disabled} onChange={(event) => updateSkill(slot, 'damageType', event.target.value)}>
                  <option value="skill">스킬 피해</option><option value="basic">기본 공격 피해</option><option value="true">고정 피해</option>
                </select></label>
                <label>공격력 계수<input type="number" min="0" step="0.05" value={skill.attackPowerScale} disabled={disabled}
                  onChange={(event) => updateSkill(slot, 'attackPowerScale', Number(event.target.value))} /></label>
                <label>재발동 공격력 계수<input type="number" min="0" step="0.05" value={skill.secondAttackPowerScale} disabled={disabled}
                  onChange={(event) => updateSkill(slot, 'secondAttackPowerScale', Number(event.target.value))} /></label>
                <label>보호막·강화 유지(초)<input type="number" min="0" max="60" step="0.25" value={skill.durationSec} disabled={disabled}
                  onChange={(event) => updateSkill(slot, 'durationSec', Number(event.target.value))} /></label>
              </div>
              <small>유지 시간 0은 기본값을 사용합니다: 보호막 2초, 강화 5초(강화는 최소 1초). 사용 가능한 최대값: 쿨타임 180초, 선딜·후딜 각 10초, 유지 60초, 재발동 30초, 사거리 20, 광역 5, 이동 10m, 고유 자원 소비·획득 10000.</small>
            </>}
        </div>
        <footer className="simulation-roster-modal__footer">
          <p role="status">{message || '저장 전 변경은 편집 취소 시 버립니다. 경기 기록의 과거 입력은 바뀌지 않습니다.'}</p>
          <div><button type="button" onClick={() => onClose()}>편집 취소</button>
            <button type="button" className="is-primary" onClick={save}>기기에 저장하고 반영</button></div>
        </footer>
      </section>
    </div>
  );
}
