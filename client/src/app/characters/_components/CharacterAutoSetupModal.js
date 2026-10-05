'use client';

import { useEffect, useRef, useState } from 'react';
import { apiPost } from '../../../utils/api.js';
import { getErSubjectPreset } from '../../../utils/erMeta.js';
import { ER_STAT_FIELDS } from '../../../utils/erStats.js';
import { CHARACTER_SKILL_SLOTS, CHARACTER_SKILL_SLOT_LABELS } from '../../../utils/characterSkillCompilerCore.js';
import { createCharacterSetupPatch, normalizeCharacterSetupDraft } from '../../../utils/characterSetupDraft.js';

const requestSetup = (input) => apiPost('/analyze/character-setup', input, { timeoutMs: 100000 });

export default function CharacterAutoSetupModal({ character, onClose, onApply, request = requestSetup }) {
  const [mode, setMode] = useState(() => getErSubjectPreset(character) ? 'er' : 'custom');
  const [name, setName] = useState(character.name || '');
  const [text, setText] = useState('');
  const [draft, setDraft] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [replaceExisting, setReplaceExisting] = useState(false);
  const generation = useRef({ revision: 0 });
  const panel = useRef(null);
  const preview = useRef(null);
  useEffect(() => {
    const lifecycle = generation.current;
    panel.current?.querySelector('input')?.focus();
    return () => { lifecycle.revision++; };
  }, []);
  useEffect(() => {
    if (!draft) return;
    preview.current?.focus({ preventScroll: true });
    preview.current?.scrollIntoView({ block: 'start' });
  }, [draft]);

  function change(setter, value) { generation.current.revision++; setter(value); setDraft(null); setMessage(''); }
  async function generate(event) {
    event.preventDefault();
    const revision = ++generation.current.revision;
    setBusy(true); setDraft(null); setMessage('');
    try {
      const response = await request({ mode, name: name.trim(), text: text.trim() });
      if (revision === generation.current.revision) setDraft(normalizeCharacterSetupDraft(response));
    } catch (error) {
      if (revision === generation.current.revision) setMessage(error?.message || '자동 설정 초안을 만들지 못했습니다. 기존 설정은 유지됩니다.');
    } finally { if (revision === generation.current.revision) setBusy(false); }
  }
  let plan = null, planError = '';
  if (draft) {
    try { plan = createCharacterSetupPatch(character, draft, { replaceExisting }); }
    catch (error) { planError = error.message; }
  }
  function apply() {
    if (!plan) return;
    const result = onApply(plan);
    if (result?.ok === false) setMessage(result.message || '적용하지 못했습니다. 기존 설정은 유지됩니다.');
    else onClose();
  }
  function keyboard(event) {
    if (event.key === 'Escape') { event.preventDefault(); onClose(); }
    if (event.key !== 'Tab') return;
    const controls = [...panel.current.querySelectorAll('button, input, textarea, select, summary, a[href]')]
      .filter(element => !element.disabled && element.getClientRects().length);
    if (event.shiftKey && document.activeElement === controls[0]) { event.preventDefault(); controls.at(-1)?.focus(); }
    else if (!event.shiftKey && document.activeElement === controls.at(-1)) { event.preventDefault(); controls[0]?.focus(); }
  }
  return (
    <div className="character-edit-backdrop">
      <section className="character-edit-modal character-setup-modal" role="dialog" aria-modal="true"
        aria-labelledby="character-setup-title" ref={panel} onKeyDown={keyboard}>
        <header className="character-edit-head">
          <div><p>수치는 자동으로 · 적용은 확인 후</p><h2 id="character-setup-title">캐릭터 자동 설정</h2></div>
          <button type="button" onClick={onClose} aria-label="자동 설정 닫기">×</button>
        </header>
        <p className="character-setup-notice">능력치·무기·QWER·패시브·고유 자원을 한 번에 제안합니다. 초안을 만들거나 취소하는 것만으로 기존 캐릭터나 서버 저장값은 바뀌지 않습니다.</p>
        <form onSubmit={generate} className="character-setup-form">
          <div className="character-setup-inputs">
            <label>캐릭터 종류<select value={mode} disabled={busy} onChange={event => change(setMode, event.target.value)}>
              <option value="custom">커스텀·다른 작품 캐릭터</option><option value="er">이터널 리턴 실험체</option>
            </select></label>
            <label>{mode === 'er' ? '실험체 이름' : '캐릭터 이름'}<input value={name} maxLength={40} disabled={busy}
              onChange={event => change(setName, event.target.value)} placeholder={mode === 'er' ? '예: 헤이즈' : '예: 작품명과 캐릭터 이름'} /></label>
          </div>
          <label><span>설정·스킬 설명 <small>(선택)</small></span><textarea rows={5} value={text} maxLength={12000} disabled={busy}
            onChange={event => change(setText, event.target.value)}
            placeholder="이미 알고 있는 설정이나 원작 설명을 한 번에 붙여넣어 주세요. 스킬별 수치를 직접 입력할 필요는 없습니다." /></label>
          <small>{mode === 'er' ? '설명을 비우면 공식 홈페이지에서 안내한 캐릭터 DB를 읽습니다. 자료를 가져오지 못하면 초안을 적용하지 않고 안내합니다.'
            : '이름만으로도 초안을 요청할 수 있습니다. 낯선 캐릭터·동명이인은 작품명이나 특징을 함께 적어 주세요. 추정된 능력은 표시됩니다.'}</small>
          <button type="submit" className="character-setup-generate" disabled={busy || name.trim().length < 2 && text.trim().length < 2}>
            {busy ? '초안 작성 중…' : draft ? '초안 다시 만들기' : '자동 설정 초안 만들기'}
          </button>
          {busy ? <p role="status">자료와 스킬을 정리하고 있습니다. 닫으면 이 화면에 적용하지 않습니다.</p> : null}
        </form>
        {message || planError ? <p className="character-setup-error" role="alert">{message || planError}</p> : null}
        {draft ? <section className="character-setup-preview" aria-label="적용 전 초안 미리보기" tabIndex={-1} ref={preview}>
          <h3>{draft.name} · 시뮬레이션용 AI 초안</h3>
          <p>{draft.summary}</p><p>무기: {draft.erWeapons.join(' · ')} · 고유 자원: {draft.uniqueResource.enabled
            ? `${draft.uniqueResource.name} · 시작 ${draft.uniqueResource.startValue}/${draft.uniqueResource.maxValue} · 초당 ${draft.uniqueResource.regenPerSec} 회복` : '없음'}</p>
          {draft.sources.length ? <p>참고 자료: {draft.sources.map(source => <a key={source.url} href={source.url} target="_blank" rel="noopener noreferrer">{source.title || '공식 안내 자료'}</a>)}</p> : null}
          <ul className="character-setup-warnings">{draft.warnings.map((warning, index) => <li key={index}>{warning}</li>)}</ul>
          <details><summary>능력치 수치 확인</summary><dl className="character-setup-stats">{ER_STAT_FIELDS.map(field =>
            <div key={field.key}><dt>{field.label}</dt><dd>{draft.stats[field.key]}</dd></div>)}</dl></details>
          <div className="character-setup-skills">{CHARACTER_SKILL_SLOTS.map(slot => {
            const skill = draft.characterSkills[slot];
            return <details key={slot}><summary>{CHARACTER_SKILL_SLOT_LABELS[slot]} · {skill.name || '효과 미지원'} · {skill.enabled ? '사용' : '비활성'}</summary>
              <p>{skill.sourceText || '지원 가능한 효과가 없습니다.'}</p>
              {slot === 'passive' ? <p>{Object.entries(skill.statModifiers).map(([key, value]) => `${ER_STAT_FIELDS.find(field => field.key === key)?.label || key} ${value}`).join(' · ') || '능력치 보정 없음'}</p>
                : <p>쿨타임 {skill.cooldownSec}초 · 피해 {skill.firstFlat.join('/')} · 계수 공격 {skill.attackPowerScale} / 스증 {skill.firstSkillAmpScale}
                  · 최대 체력 피해 {skill.maxHpPct.join('/')}% · 현재 체력 피해 {skill.currentHpPct.join('/')}%
                  · 회복 {skill.heal.join('/')} · 보호막 {skill.shield.join('/')}
                  · 상태 {skill.statusEffects.map(effect => `${effect.name} ${effect.durationSec}초`).join(', ') || '없음'}
                  · 이동 {skill.includesMovement ? `${skill.movementDistance}m (${skill.movementMode === 'away_from_target' ? '후퇴' : '접근'})` : '없음'}
                  · 사거리 {skill.range}m · 범위 {skill.radius}m · 시전/후딜 {skill.castDelaySec}/{skill.recoveryDelaySec}초
                  · 재발동 {skill.recastWindowSec}초 / 2차 피해 {skill.secondFlat.join('/')} / 계수 공격 {skill.secondAttackPowerScale}, 스증 {skill.secondSkillAmpScale}
                  · 2차 체력 피해 최대 {skill.secondMaxHpPct.join('/')}%, 현재 {skill.secondCurrentHpPct.join('/')}%
                  · 자원 비용/획득 {skill.resourceCost}/{skill.resourceGain}</p>}
            </details>;
          })}</div>
          <label className="character-setup-replace"><input type="checkbox" checked={replaceExisting}
            onChange={event => setReplaceExisting(event.target.checked)} />기존에 작성한 항목도 이 초안으로 교체</label>
          <p className="character-setup-plan">{plan ? `적용: ${plan.applied.join(' · ') || '없음'}${plan.preserved.length ? ` / 유지: ${plan.preserved.join(' · ')}` : ''}` : '스킬과 고유 자원의 조합을 확인해야 적용할 수 있습니다.'}</p>
        </section> : null}
        <footer className="character-edit-actions">
          <button type="button" onClick={onClose}>취소</button>
          <button type="button" disabled={!plan || busy || !plan.applied.length} onClick={apply}>확인한 초안 적용</button>
        </footer>
      </section>
    </div>
  );
}
