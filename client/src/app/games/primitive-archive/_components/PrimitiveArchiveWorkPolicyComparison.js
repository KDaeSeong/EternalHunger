const display = value => new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 2 }).format(value);

export default function PrimitiveArchiveWorkPolicyComparison({ comparison }) {
  if (!comparison) return null;
  if (!comparison.available) return <p>{comparison.reason}</p>;
  const policies = comparison.policies || [];
  const rows = policies[0]?.rows || [];
  return <details className="primitive-work-policy-comparison">
    <summary>{comparison.periodLabel} · 운영 방침별 실제 정산 전망</summary>
    {comparison.assumptions.map(text => <p key={text}>{text}</p>)}
    {comparison.warnings.map(text => <p key={text}>{text}</p>)}
    <div style={{ overflowX: 'auto' }}>
      <table>
        <caption>균형 운영 대비 증감 · 생산·배식·사업·연구와 남는 비축</caption>
        <thead><tr><th scope="col">정산 항목</th>{policies.map(policy => <th scope="col" key={policy.id}>{policy.label}</th>)}</tr></thead>
        <tbody>{rows.filter(row => !row.id.startsWith('stock:') || policies.some(policy => policy.rows.find(item => item.id === row.id)?.delta !== 0))
          .map(row => <tr key={row.id}><th scope="row">{row.label}</th>{policies.map(policy => {
            const value = policy.rows.find(item => item.id === row.id);
            return <td key={policy.id}>{display(value.value)} {row.unit}{policy.id !== 'balanced' ? ` (${value.delta > 0 ? '+' : ''}${display(value.delta)})` : ''}</td>;
          })}</tr>)}</tbody>
      </table>
    </div>
    <p>시작 비축과 직업 생산의 합계는 사업 보상·가공·교역 전 수치입니다. 실제 부족과 최종 비축은 공동 정산 전체를 반영합니다.</p>
  </details>;
}
