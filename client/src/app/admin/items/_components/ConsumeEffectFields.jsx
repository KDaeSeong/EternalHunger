'use client';

import { CONSUME_AMOUNT_FIELDS, CONSUME_STAT_FIELDS, describeConsumeEffect } from '../../../../utils/consumeEffectAuthoring.js';

export default function ConsumeEffectFields({ draft, onChange }) {
  const current = draft || { enabled: false, value: { version: 1 } };
  const value = current.value || {};
  const input = { width: '100%', padding: 8, background: '#102636', color: '#edf6ff', border: '1px solid #476378', borderRadius: 6 };
  const change = (key, amount, stat = false) => onChange({ ...current, value: stat
    ? { ...value, stats: { ...value.stats, [key]: amount } }
    : { ...value, [key]: amount } });
  return <section aria-label="소모품 사용 효과" style={{ marginTop: 16, padding: 14, border: '1px solid #476378', borderRadius: 10 }}>
    <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
      <input type="checkbox" checked={current.enabled} onChange={event => onChange({ ...current, enabled: event.target.checked })} />
      <strong>소모품 효과 직접 지정</strong>
    </label>
    <p style={{ fontSize: 13 }}>직접 지정하면 이름에서 추정한 음식·캡슐 효과 대신 아래 효과만 적용합니다. 끄면 기존 방식으로 돌아갑니다.</p>
    {current.enabled && <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 }}>
        {CONSUME_AMOUNT_FIELDS.map(([key, label]) => <label key={key}>{label}
          <input aria-label={label} style={input} type="number" min="0" step={key === 'durationSec' ? 'any' : '1'}
            value={value[key] ?? 0} onChange={event => change(key, event.target.value)} />
        </label>)}
      </div>
      <details style={{ marginTop: 12 }}><summary>일시 능력치 증가</summary>
        <p style={{ fontSize: 13 }}>지속 시간이 끝나면 원래 능력치로 돌아갑니다. 공격 속도는 초당 횟수, 확률은 0~1 단위입니다.</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 }}>
          {CONSUME_STAT_FIELDS.map(([key, label]) => <label key={key}>{label}
            <input aria-label={`일시 ${label}`} style={input} type="number" min="0" step="any"
              value={value.stats?.[key] ?? 0} onChange={event => change(key, event.target.value, true)} />
          </label>)}
        </div>
      </details>
      <p role="status" style={{ fontSize: 13 }}>{describeConsumeEffect(value)}</p>
      <p style={{ fontSize: 12 }}>회복은 실제 부족량까지만 적용합니다. 보호막·재생·능력치 강화에는 지속 시간이 필요합니다.</p>
    </>}
  </section>;
}
