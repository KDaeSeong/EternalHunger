import { CHARACTER_STATUS_EFFECT_OPTIONS, MAX_CHARACTER_STATUS_EFFECTS, getCharacterStatusSkillError,
  isStatusSupportSkill } from '../../../utils/characterStatusSkillDefinition.js';

export default function CharacterStatusEffectFields({ skill, slot, disabled, onUpdateSkill }) {
  const entries = skill.statusEffects || [];
  const support = isStatusSupportSkill(skill);
  const error = getCharacterStatusSkillError(skill, slot);
  const update = (index, next) => onUpdateSkill(slot, 'statusEffects', entries.map((row, i) => i === index ? next : row));
  const choose = (name) => {
    const harmful = CHARACTER_STATUS_EFFECT_OPTIONS.find((row) => row.value === name)?.harmful;
    return { name, target: harmful || support ? 'target' : 'self', durationSec: name === '해로운 효과 제거' ? 0 : 2 };
  };
  return <fieldset className="character-status-effect-editor" disabled={disabled}>
    <legend>실제로 부여할 상태 효과</legend>
    <p>최대 4개 · 위에서 아래 순서로 적용합니다. 상태만 있는 스킬도 사용할 수 있습니다. 보호·정화 타입은 지원 대상 중 한 명을 선택하며 피해를 주지 않습니다.</p>
    {entries.map((entry, index) => {
      const harmful = CHARACTER_STATUS_EFFECT_OPTIONS.find((row) => row.value === entry.name)?.harmful;
      return <div className="character-status-effect-editor__row" key={index}>
        <div className="character-skill-inline-grid">
          <label>상태 {index + 1}<select value={entry.name} onChange={(event) => update(index, choose(event.target.value))}>
            {CHARACTER_STATUS_EFFECT_OPTIONS.map((option) => <option key={option.value} value={option.value} disabled={support && option.harmful}>{option.label}</option>)}
          </select></label>
          <label>적용 대상 {index + 1}<select value={entry.target} onChange={(event) => update(index, { ...entry, target: event.target.value })}>
            <option value="target" disabled={!harmful && !support}>{support ? '선택된 아군' : '공격 대상'}</option>
            <option value="self" disabled={harmful}>자신</option>
          </select></label>
          <label>상태 지속 시간 {index + 1} (초)<input type="number" min={entry.name === '해로운 효과 제거' ? '0' : '0.001'} max="60" step="0.001"
            value={entry.durationSec} disabled={entry.name === '해로운 효과 제거'} onChange={(event) => update(index, { ...entry, durationSec: Number(event.target.value) })} /></label>
          {entry.name === '수면' && <label>수면 추가 피해 {index + 1} (%)<input type="number" min="0" max="100" step="1"
            value={(entry.wakeDamagePct ?? 0.2) * 100} onChange={(event) => update(index, { ...entry, wakeDamagePct: Number(event.target.value) / 100 })} /></label>}
          {['변이', '이동 속도 감소'].includes(entry.name) && <label>이동 속도 감소 {index + 1} (%)<input type="number" min="0" max="75" step="1"
            value={-(entry.moveSpeedBonus ?? (entry.name === '변이' ? -0.5 : -0.18)) * 100}
            onChange={(event) => update(index, { ...entry, moveSpeedBonus: -Number(event.target.value) / 100 })} /></label>}
        </div>
        <button type="button" onClick={() => onUpdateSkill(slot, 'statusEffects', entries.filter((_, i) => i !== index))}>상태 {index + 1} 삭제</button>
      </div>;
    })}
    <button type="button" disabled={disabled || entries.length >= MAX_CHARACTER_STATUS_EFFECTS}
      onClick={() => onUpdateSkill(slot, 'statusEffects', [...entries, choose(support ? '회피' : '기절')])}>상태 효과 추가</button>
    {error && <p role="alert">{error}</p>}
    <small>일반 스킬은 시전 완료 후, 기본 공격 강화는 실제 적중한 공격의 피해 처리 후 상태를 부여합니다. 공격 광역은 범위 안 적에게만 적용하며 자신 효과는 한 번만 적용합니다. 수면 기본 추가 피해 20%·변이 감속 50%는 원작 확정값이 아닌 프로젝트 기본값입니다. AI는 면역과 남은 지속 시간을 확인하고, 정화는 제거할 해로운 상태가 있을 때 선택합니다.</small>
  </fieldset>;
}
