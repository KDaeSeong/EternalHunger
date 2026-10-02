'use client';

import { useState } from 'react';
import HungerTraitFields from '../../../components/HungerTraitFields';
import { HUNGER_CAUSES, HUNGER_EFFECTS, HUNGER_LABELS, HUNGER_LOCATIONS, HUNGER_PHASES, HUNGER_RELATIONS, HUNGER_WEATHER, normalizeHungerEvent } from '../_lib/hungerGameContract.js';
import { createHungerDraft } from '../_lib/hungerGamePresets.js';
import { inspectHungerEvent, resolveHungerEvent } from '../_lib/hungerGameRuntime.js';
import { createHungerPreview } from '../_lib/hungerGamePreview.js';
import { hungerEffectLabel } from '../_lib/hungerGameText.js';
import styles from '../HungerGames.module.css';

const label = (key) => HUNGER_LABELS[key] || key;
function Options({ value, onChange, options }) {
  return <div className={styles.checks}>{options.map((key) => <label key={key}><input type="checkbox" checked={value.includes(key)} onChange={() => onChange(value.includes(key) ? value.filter((entry) => entry !== key) : [...value, key])} />{label(key)}</label>)}</div>;
}
function Select({ value, onChange, options, ...props }) {
  return <select {...props} value={value} onChange={(event) => onChange(event.target.value)}>{options.map((option) => <option key={option.value ?? option} value={option.value ?? option}>{option.label ?? label(option)}</option>)}</select>;
}

export default function HungerEventEditor({ events, roster, matchMode, onChange, onNotice, draft: controlledDraft, onDraftChange, onPresetsReset }) {
  const draft = controlledDraft || events[0] || createHungerDraft('custom-first');
  const setDraft = onDraftChange;
  const [preview, setPreview] = useState(null);
  const [casting, setCasting] = useState({});
  const [previewInjured, setPreviewInjured] = useState({});
  const [previewSurvivors, setPreviewSurvivors] = useState('');
  const [previewDuelPhases, setPreviewDuelPhases] = useState(0);
  const [context, setContext] = useState({ day: 1, phase: 'day', weather: 'storm', location: 'forest' });
  const [previewIndex, setPreviewIndex] = useState(0);
  const [jsonText, setJsonText] = useState('');
  const update = (patch) => { setDraft({ ...draft, ...patch }); setPreview(null); };
  const updateRole = (index, patch) => update({ roles: draft.roles.map((role, offset) => offset === index ? { ...role, ...patch } : role) });
  const updateOutcome = (index, patch) => update({ outcomes: draft.outcomes.map((outcome, offset) => offset === index ? { ...outcome, ...patch } : outcome) });
  const updateEffect = (outcomeIndex, effectIndex, patch) => updateOutcome(outcomeIndex, { effects: draft.outcomes[outcomeIndex].effects.map((effect, offset) => offset === effectIndex ? { ...effect, ...patch } : effect) });
  const updateRequirement = (outcomeIndex, requirementIndex, patch) => updateOutcome(outcomeIndex, { requirements: draft.outcomes[outcomeIndex].requirements.map((requirement, offset) => offset === requirementIndex ? { ...requirement, ...patch } : requirement) });
  const choose = (event) => {
    const saved = events.find((row) => row.id === draft.id);
    if (JSON.stringify(saved) !== JSON.stringify(draft) && !window.confirm('편집 중인 내용을 버리고 다른 이벤트를 열까요?')) return;
    setDraft(structuredClone(event)); setPreview(null); setCasting({}); setPreviewInjured({}); setPreviewSurvivors(''); setPreviewDuelPhases(0); setJsonText('');
  };
  const save = () => {
    try {
      const normalized = normalizeHungerEvent(draft);
      if (!events.some((event) => event.id === normalized.id) && events.length >= 200) throw new Error('이벤트는 200개까지 등록할 수 있습니다.');
      onChange(events.some((event) => event.id === normalized.id) ? events.map((event) => event.id === normalized.id ? normalized : event) : [...events, normalized]);
      setDraft(normalized); onNotice('이벤트를 저장했습니다. 다음 경기부터 적용됩니다.');
    } catch (error) { onNotice(error.message); }
  };
  const roleOptions = draft.roles.map((role) => ({ value: role.key, label: role.label + ' {' + role.key + '}' }));
  const testEvent = () => {
    try {
      const normalized = normalizeHungerEvent(draft);
      const { state, assigned } = createHungerPreview({ roster, matchMode, event: normalized, casting, context, injuredByRole: previewInjured,
        survivors: previewSurvivors === '' ? roster.length : previewSurvivors, duelPhases: previewDuelPhases, seed: 'preview-' + previewIndex });
      const inspection = inspectHungerEvent(state, normalized, assigned);
      const result = resolveHungerEvent(state, normalized, assigned);
      setPreview({ ...inspection, row: result.row }); setPreviewIndex((index) => index + 1);
    } catch (error) { setPreview({ eligible: false, reason: error.message, outcomes: [] }); }
  };
  const removeRole = (key) => {
    const referenced = draft.relations.some((row) => row.left === key || row.right === key) || draft.outcomes.some((row) => row.when?.role === key || row.text.includes('{' + key + '}') || row.requirements?.some((requirement) => requirement.role === key) || row.effects.some((effect) => [effect.target, effect.other, effect.source].includes(key)));
    if (referenced) { onNotice('이 역할을 사용하는 문구·효과·관계 조건을 먼저 수정해 주세요.'); return; }
    update({ roles: draft.roles.filter((role) => role.key !== key) });
  };
  return (
    <div className={styles.editorLayout}>
      <aside className={styles.panel}>
        <div className={styles.toolbar}><h2>이벤트 {events.length}개</h2><button type="button" disabled={events.length >= 200} onClick={() => choose(createHungerDraft('custom-' + crypto.randomUUID()))}>추가</button></div>
        <button type="button" onClick={() => { if (onPresetsReset()) { setPreview(null); setCasting({}); setPreviewInjured({}); setPreviewSurvivors(''); setPreviewDuelPhases(0); setJsonText(''); } }}>기본 사건 업데이트</button>
        <div className={styles.eventList}>
          {events.map((event) => <button type="button" aria-pressed={draft.id === event.id} className={draft.id === event.id ? styles.selected : ''} key={event.id} onClick={() => choose(event)}>{event.enabled ? '● ' : '○ '}{event.title}<small>{event.roles.length}명 · 분기 {event.outcomes.length}개</small></button>)}
        </div>
      </aside>
      <section className={styles.panel}>
        <div className={styles.toolbar}><h2>이벤트 편집</h2><div className={styles.actions}>
          <button type="button" className={styles.primary} onClick={save}>이벤트 저장</button>
          {events.some((event) => event.id === draft.id) ? <button type="button" onClick={() => {
            if (!window.confirm('이 이벤트를 삭제할까요?')) return;
            const next = events.filter((event) => event.id !== draft.id); onChange(next); setDraft(structuredClone(next[0] || createHungerDraft('custom-' + crypto.randomUUID()))); setPreview(null);
          }}>삭제</button> : null}
        </div></div>
        <p className={styles.note}>편집 후 이벤트 저장을 눌러 적용합니다. 문구의 {'{역할키}'}에는 해당 참가자의 이름이 들어갑니다.</p>
        <p className={styles.note}>이름 바로 뒤의 은/는, 이/가, 을/를, 과/와, 으로/로, 이랑/랑, 아/야는 받침에 맞게 바뀝니다. {'{actor}은(는)'}처럼 쓸 수도 있습니다. 복합 조사에는 {'{actor}으로(로)부터'}처럼 쌍을 표시하세요.</p>
        <div className={styles.fields}>
          <label className={styles.field}>이벤트 이름<input value={draft.title} maxLength={120} onChange={(event) => update({ title: event.target.value })} /></label>
          <label className={styles.field}>등장 빈도<input type="number" min="0.01" max="1000" step="0.1" value={draft.weight} onChange={(event) => update({ weight: event.target.value })} /></label>
          <label className={styles.field}>시작 일차<input type="number" min="0" max="60" value={draft.minDay} onChange={(event) => update({ minDay: event.target.value })} /></label>
          <label className={styles.field}>마지막 일차<input type="number" min="0" max="60" value={draft.maxDay} onChange={(event) => update({ maxDay: event.target.value })} /></label>
          <label className={styles.field}>최소 생존자<input type="number" min="2" max="64" value={draft.minSurvivors} onChange={(event) => update({ minSurvivors: event.target.value })} /></label>
          <label className={styles.field}>최대 생존자<input type="number" min="2" max="64" value={draft.maxSurvivors} onChange={(event) => update({ maxSurvivors: event.target.value })} /></label>
          <label className={styles.field}>최종 2인 대치 최소 페이즈 (0: 제한 없음)<input type="number" min="0" max="120" value={draft.minDuelPhases} onChange={(event) => update({ minDuelPhases: event.target.value, ...(Number(event.target.value) > 0 ? { minSurvivors: 2, maxSurvivors: 2 } : {}) })} /></label>
          <label className={styles.field}>쉬어 갈 페이즈 수 (0: 연속 허용)<input type="number" min="0" max="120" value={draft.cooldownPhases} onChange={(event) => update({ cooldownPhases: event.target.value })} /></label>
          <label className={styles.field}>최대 등장 횟수 (0: 제한 없음)<input type="number" min="0" max="1000" value={draft.maxUses} onChange={(event) => update({ maxUses: event.target.value })} /></label>
        </div>
        <label className={styles.inline}><input type="checkbox" checked={draft.enabled} onChange={(event) => update({ enabled: event.target.checked })} />경기에서 사용</label>
        <fieldset className={styles.group}><legend>발생 시점</legend><Options value={draft.phases} options={HUNGER_PHASES} onChange={(phases) => update({ phases })} /></fieldset>
        <fieldset className={styles.group}><legend>날씨</legend><Options value={draft.weather} options={HUNGER_WEATHER} onChange={(weather) => update({ weather })} /></fieldset>
        <fieldset className={styles.group}><legend>장소</legend><Options value={draft.locations} options={HUNGER_LOCATIONS} onChange={(locations) => update({ locations })} /></fieldset>
        <div className={styles.toolbar}><h3>참가자 역할</h3><button type="button" disabled={draft.roles.length >= 4} onClick={() => {
          const key = ['actor', 'role2', 'role3', 'role4'].find((entry) => !draft.roles.some((role) => role.key === entry));
          update({ roles: [...draft.roles, { key, label: '참가자 ' + (draft.roles.length + 1), allTraits: [], noneTraits: [], status: 'any', requiredItem: '' }] });
        }}>역할 추가</button></div>
        {draft.roles.map((role, index) => <fieldset className={styles.group} key={role.key}>
          <legend>{'{' + role.key + '}'}</legend>
          <div className={styles.fields}>
            <label className={styles.field}>역할 이름<input value={role.label} maxLength={40} onChange={(event) => updateRole(index, { label: event.target.value })} /></label>
            <label className={styles.field}>상태<Select value={role.status} options={[{ value: 'any', label: '제한 없음' }, { value: 'healthy', label: '건강함' }, { value: 'injured', label: '부상 중' }]} onChange={(status) => updateRole(index, { status })} /></label>
            <label className={styles.field}>필요 아이템<input value={role.requiredItem} placeholder="비워 두면 제한 없음" maxLength={60} onChange={(event) => updateRole(index, { requiredItem: event.target.value })} /></label>
            <button type="button" disabled={draft.roles.length === 1} onClick={() => removeRole(role.key)}>역할 삭제</button>
          </div>
          <HungerTraitFields legend="모두 필요한 특성" value={role.allTraits} onChange={(allTraits) => updateRole(index, { allTraits })} />
          <HungerTraitFields legend="하나라도 있으면 제외" value={role.noneTraits} onChange={(noneTraits) => updateRole(index, { noneTraits })} />
        </fieldset>)}
        <div className={styles.toolbar}><h3>참가자 관계 조건</h3><button type="button" disabled={draft.roles.length < 2 || draft.relations.length >= 6} onClick={() => update({ relations: [...draft.relations, { left: draft.roles[0].key, right: draft.roles[1].key, kind: 'not_teammate' }] })}>조건 추가</button></div>
        {draft.relations.map((relation, index) => <div className={styles.effectRow} key={index}>
          <Select aria-label="관계 왼쪽 역할" value={relation.left} options={roleOptions} onChange={(left) => update({ relations: draft.relations.map((row, offset) => offset === index ? { ...row, left } : row) })} />
          <Select aria-label="관계 조건" value={relation.kind} options={HUNGER_RELATIONS} onChange={(kind) => update({ relations: draft.relations.map((row, offset) => offset === index ? { ...row, kind } : row) })} />
          <Select aria-label="관계 오른쪽 역할" value={relation.right} options={roleOptions} onChange={(right) => update({ relations: draft.relations.map((row, offset) => offset === index ? { ...row, right } : row) })} />
          <button type="button" onClick={() => update({ relations: draft.relations.filter((_, offset) => offset !== index) })}>조건 삭제</button>
        </div>)}
        <div className={styles.toolbar}><h3>결과 분기</h3><button type="button" disabled={draft.outcomes.length >= 12} onClick={() => update({ outcomes: [...draft.outcomes, { label: '새 결과', weight: 1, when: null, requirements: [], text: '{' + draft.roles[0].key + '}은 주변을 살핀다.', effects: [] }] })}>분기 추가</button></div>
        <p className={styles.note}>빈도는 가능한 사건·결과끼리 비교하는 상대 비중입니다. 면역은 해당 피해를 제외하고, 저항은 사망 비중을 1/5로 줄입니다. 공격자를 지정하면 전투 숙련과 부상 상태도 반영합니다. 최근 반복된 사건의 비중은 낮아집니다.</p>
        {draft.outcomes.map((outcome, index) => <fieldset className={styles.group} key={index}>
          <legend>{index + 1}. {outcome.label}</legend>
          <div className={styles.fields}>
            <label className={styles.field}>분기 이름<input maxLength={60} value={outcome.label} onChange={(event) => updateOutcome(index, { label: event.target.value })} /></label>
            <label className={styles.field}>분기 빈도<input type="number" min="0.01" max="1000" step="0.1" value={outcome.weight} onChange={(event) => updateOutcome(index, { weight: event.target.value })} /></label>
            <label className={styles.field}>면역 조건<Select value={outcome.when?.protection || 'any'} options={['any', 'immune', 'resistant', 'normal']} onChange={(protection) => updateOutcome(index, { when: protection === 'any' ? null : { role: outcome.when?.role || draft.roles[0].key, cause: outcome.when?.cause || 'lightning', protection } })} /></label>
          </div>
          {outcome.when ? <div className={styles.fields}>
            <label className={styles.field}>조건 대상<Select value={outcome.when.role} options={roleOptions} onChange={(targetRole) => updateOutcome(index, { when: { ...outcome.when, role: targetRole } })} /></label>
            <label className={styles.field}>조건 원인<Select value={outcome.when.cause} options={HUNGER_CAUSES} onChange={(cause) => updateOutcome(index, { when: { ...outcome.when, cause } })} /></label>
          </div> : null}
          <label className={styles.field}>결과 문구<textarea rows={3} maxLength={2000} value={outcome.text} onChange={(event) => updateOutcome(index, { text: event.target.value })} /></label>
          <details className={styles.group}>
            <summary>분기 참가자 조건 {(outcome.requirements || []).length}개</summary>
            <p className={styles.note}>모든 조건이 맞는 경우에만 이 분기가 등장합니다. 신체별 문구나 능력별 반격에 사용합니다.</p>
            {(outcome.requirements || []).map((requirement, offset) => <fieldset className={styles.group} key={offset}>
              <legend>조건 {offset + 1}</legend>
              <div className={styles.fields}>
                <label className={styles.field}>대상 역할<Select value={requirement.role} options={roleOptions.filter((option) => option.value === requirement.role || !outcome.requirements.some((row) => row.role === option.value))} onChange={(targetRole) => updateRequirement(index, offset, { role: targetRole })} /></label>
                <label className={styles.field}>상태<Select value={requirement.status} options={['any', 'healthy', 'injured']} onChange={(status) => updateRequirement(index, offset, { status })} /></label>
                <label className={styles.field}>필요 아이템<input maxLength={60} value={requirement.requiredItem} onChange={(event) => updateRequirement(index, offset, { requiredItem: event.target.value })} /></label>
              </div>
              <HungerTraitFields legend="모두 필요한 특성" value={requirement.allTraits} onChange={(allTraits) => updateRequirement(index, offset, { allTraits })} />
              <HungerTraitFields legend="하나라도 있으면 제외" value={requirement.noneTraits} onChange={(noneTraits) => updateRequirement(index, offset, { noneTraits })} />
              <button type="button" onClick={() => updateOutcome(index, { requirements: outcome.requirements.filter((_, requirementOffset) => requirementOffset !== offset) })}>조건 삭제</button>
            </fieldset>)}
            <button type="button" disabled={(outcome.requirements || []).length >= draft.roles.length} onClick={() => updateOutcome(index, { requirements: [...(outcome.requirements || []), { role: draft.roles.find((role) => !outcome.requirements?.some((row) => row.role === role.key)).key, allTraits: [], noneTraits: [], status: 'any', requiredItem: '' }] })}>분기 조건 추가</button>
          </details>
          {outcome.effects.map((effect, offset) => <div className={styles.effectRow} key={offset}>
            <Select aria-label="효과 종류" value={effect.type} options={HUNGER_EFFECTS} onChange={(type) => updateEffect(index, offset, { type, cause: effect.cause || 'combat', item: effect.item || '식량', other: effect.other || draft.roles.find((role) => role.key !== effect.target)?.key || effect.target })} />
            <Select aria-label="효과 대상" value={effect.target} options={roleOptions} onChange={(target) => updateEffect(index, offset, { target })} />
            {['death', 'injure'].includes(effect.type) ? <Select aria-label="피해 원인" value={effect.cause || 'combat'} options={HUNGER_CAUSES} onChange={(cause) => updateEffect(index, offset, { cause })} /> : null}
            {['death', 'injure'].includes(effect.type) ? <Select aria-label="공격자" value={effect.source || ''} options={[{ value: '', label: '공격자 없음' }, ...roleOptions.filter((role) => role.value !== effect.target)]} onChange={(source) => updateEffect(index, offset, { source })} /> : null}
            {['gain_item', 'lose_item'].includes(effect.type) ? <input aria-label="효과 아이템" maxLength={60} value={effect.item || ''} onChange={(event) => updateEffect(index, offset, { item: event.target.value })} /> : null}
            {['ally', 'enemy'].includes(effect.type) ? <Select aria-label="관계 상대" value={effect.other || ''} options={roleOptions.filter((role) => role.value !== effect.target)} onChange={(other) => updateEffect(index, offset, { other })} /> : null}
            <button type="button" onClick={() => updateOutcome(index, { effects: outcome.effects.filter((_, effectOffset) => effectOffset !== offset) })}>효과 삭제</button>
          </div>)}
          <div className={styles.actions}>
            <button type="button" disabled={outcome.effects.length >= 12} onClick={() => updateOutcome(index, { effects: [...outcome.effects, { type: 'injure', target: draft.roles[0].key, cause: 'accident' }] })}>효과 추가</button>
            <button type="button" disabled={draft.outcomes.length === 1} onClick={() => update({ outcomes: draft.outcomes.filter((_, offset) => offset !== index) })}>분기 삭제</button>
          </div>
        </fieldset>)}
        <fieldset className={styles.group}><legend>시험 판정</legend>
          <p>실제 경기에는 반영하지 않고, 지정한 참가자와 상황으로 결과를 확인합니다.</p>
          <div className={styles.fields}>
            {draft.roles.map((role, index) => <div className={styles.field} key={role.key}><label>{role.label}<Select value={casting[role.key] || roster[index]?.id || ''} options={roster.map((actor) => ({ value: actor.id, label: actor.name }))} onChange={(id) => setCasting((previous) => ({ ...previous, [role.key]: id }))} /></label><label className={styles.inline}><input type="checkbox" checked={Boolean(previewInjured[role.key])} onChange={(event) => setPreviewInjured((previous) => ({ ...previous, [role.key]: event.target.checked }))} />부상 상태로 시험</label></div>)}
            <label className={styles.field}>일차<input type="number" min="0" max="60" value={context.day} onChange={(event) => setContext({ ...context, day: Number(event.target.value) })} /></label>
            <label className={styles.field}>시점<Select value={context.phase} options={HUNGER_PHASES} onChange={(phase) => setContext({ ...context, phase })} /></label>
            <label className={styles.field}>날씨<Select value={context.weather} options={HUNGER_WEATHER} onChange={(weather) => setContext({ ...context, weather })} /></label>
            <label className={styles.field}>장소<Select value={context.location} options={HUNGER_LOCATIONS} onChange={(location) => setContext({ ...context, location })} /></label>
            <label className={styles.field}>시험 생존자 수<input type="number" min="2" max={roster.length} value={previewSurvivors === '' ? roster.length : previewSurvivors} onChange={(event) => setPreviewSurvivors(event.target.value)} /></label>
            <label className={styles.field}>최종 2인 대치 경과 페이즈<input type="number" min="0" max="120" value={previewDuelPhases} onChange={(event) => setPreviewDuelPhases(event.target.value)} /></label>
          </div>
          <button type="button" onClick={testEvent}>시험 판정</button>
          {preview ? <div className={styles.preview} role="status">
            {preview.row ? <><p>{preview.row.text}</p><small>가능한 분기: {preview.outcomes.map((row) => row.label + ' (' + row.weight + ')').join(', ')}</small><p>{preview.row.effects.length ? preview.row.effects.map((effect) => effect.actorName + ': ' + hungerEffectLabel(roster.find((actor) => actor.id === effect.actorId), effect.type) + (effect.cause ? ' · ' + label(effect.cause) : '')).join(' / ') : '상태 변화 없이 생존'}</p></> : preview.reason}
          </div> : null}
        </fieldset>
        <details className={styles.group}><summary>고급 JSON 편집</summary>
          <button type="button" onClick={() => setJsonText(JSON.stringify(draft, null, 2))}>현재 편집 내용 가져오기</button>
          <textarea className={styles.json} aria-label="이벤트 JSON" rows={12} value={jsonText} onChange={(event) => setJsonText(event.target.value)} />
          <button type="button" onClick={() => { try { const event = normalizeHungerEvent(JSON.parse(jsonText)); setDraft(event); setPreview(null); onNotice('JSON을 편집기에 적용했습니다. 이벤트 저장을 눌러 등록해 주세요.'); } catch (error) { onNotice(error.message); } }}>편집기에 적용</button>
        </details>
      </section>
    </div>
  );
}
