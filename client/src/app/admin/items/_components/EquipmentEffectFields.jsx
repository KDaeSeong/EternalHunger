'use client';
import { EQUIPMENT_TIMING_FIELDS, EQUIPMENT_DAMAGE_FIELDS, describeEquipmentEffects } from '../../../../utils/equipmentEffectAuthoring.js';

export default function EquipmentEffectFields({ draft, onChange }) {
  const current = draft, value = current.value?.[0] || {};
  const input = { width: '100%', padding: 8, background: '#102636', color: '#edf6ff', border: '1px solid #476378', borderRadius: 6 };
  const change = (key, amount, damage = false) => onChange({ ...current,
    value: [{ ...value, ...(damage ? { damage: { ...value.damage, [key]: amount } } : { [key]: amount }) }, ...(Array.isArray(current.value) ? current.value.slice(1) : [])] });
  return <section aria-label="장비 발동 효과" style={{ marginTop: 16, padding: 14, border: '1px solid #476378', borderRadius: 10 }}>
    <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
      <input type="checkbox" checked={current.enabled} onChange={event => onChange({ ...current, enabled: event.target.checked })} />
      <strong>파열 효과 직접 지정</strong>
    </label>
    <p style={{ fontSize: 13 }}>장착 중 적 실험체에게 스킬 피해를 맞히면 잠시 뒤 대상 주변에 광역 스킬 피해를 입힙니다. 아래 수치는 사용자 설정이며 원작 최신 수치의 자동 적용이 아닙니다.</p>
    {current.enabled && <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 160px), 1fr))', gap: 10 }}>
        {EQUIPMENT_TIMING_FIELDS.map(([key, label]) => <label key={key}>{label}
          <input aria-label={label} type="number" min="0.000001" step="any" style={input}
            value={value[key] ?? ''} onChange={event => change(key, event.target.value)} />
        </label>)}
      </div>
      <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 180px), 1fr))', gap: 10 }}>
        {EQUIPMENT_DAMAGE_FIELDS.map(([key, label]) => <label key={key}>{label}
          <input aria-label={label} type="number" min="0" step="any" style={input}
            value={value.damage?.[key] ?? ''} onChange={event => change(key, event.target.value, true)} />
        </label>)}
      </div>
      <p style={{ fontSize: 12, marginTop: 10 }}>계수 0.25는 해당 능력치의 25%입니다. 피해는 발동 시점 능력치로 계산하며 상대 방어력·보호막을 적용합니다.</p>
      <p role="status" style={{ fontSize: 13 }}>{describeEquipmentEffects(current.value)}</p>
      <details style={{ fontSize: 12, marginTop: 10 }}><summary>이 시뮬레이터의 발동 규칙</summary>
        <p>기본 공격·야생동물·무적으로 막힌 공격은 발동하지 않습니다. 보호막에 맞은 스킬은 발동합니다. 여러 장비에 있으면 예상 피해가 가장 큰 파열 하나만 발동하며 재사용 시간을 공유합니다.</p>
        <p>예약된 효과는 장비를 바꾸거나 기절해도 남으며 같은 전장 안의 현재 대상 위치를 따라갑니다. 시전자나 대상이 사망·전투 불능이 되거나 차원의 틈 등 다른 전장으로 바뀌면 취소합니다.</p>
      </details>
    </>}
  </section>;
}
