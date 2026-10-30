import Image from 'next/image';
import { ITEMS, TECH_TREE, TRIBE_PROJECTS, WORLD_REGIONS, ZONES } from '../_lib/primitiveArchiveData';

const FIELD_LABELS = {
  gather: '채집', hunt: '사냥', craft: '제작', camp: '캠프 관리', project: '공동 사업',
  diplomacy: '외교', research_contribution: '연구 기여', civic_contribution: '제도 기여',
  recovery: '회복 지원', utility: '도구 활용', specialized: '전문 활동',
};
const TARGET_NAMES = new Map([
  ...Object.entries(ITEMS).map(([id, item]) => [id, item.name]),
  ...[TECH_TREE, TRIBE_PROJECTS, WORLD_REGIONS, ZONES].flat().map((row) => [row.id, row.name]),
]);
const positiveCount = (value) => Number.isFinite(Number(value)) && Number(value) > 0
  ? Math.floor(Number(value)) : 0;
const dayText = (value) => positiveCount(value) ? `${positiveCount(value)}일차` : '날짜 미상';

function deathText(record) {
  if (!record) return '';
  const source = record.source === 'night' ? '밤 정산' : record.source === 'action' ? '행동 중' : '';
  const parts = [dayText(record.day), source, record.reason || '사망 원인 미상'];
  if (positiveCount(record.damage)) parts.push(`HP 피해 ${positiveCount(record.damage)}`);
  return parts.filter(Boolean).join(' · ');
}

function deedText(deed) {
  const target = TARGET_NAMES.get(deed.target);
  const gains = (Array.isArray(deed.gains) ? deed.gains : []).filter((row) => Array.isArray(row)
    && ITEMS[row[0]] && positiveCount(row[1])).map(([id, count]) => `${ITEMS[id].name} ${positiveCount(count)}개`);
  return [FIELD_LABELS[deed.kind] || '활동 기록', target, gains.length ? `획득: ${gains.join(', ')}` : '']
    .filter(Boolean).join(' · ');
}

export default function PrimitiveArchiveFoundersTab({ foundersRows = [], state }) {
  const rows = Array.isArray(foundersRows) ? foundersRows : [];
  const history = state?.founderHistory || rows[0];
  const foundersKnown = history?.foundersKnown === true;
  const foundingCount = rows.filter((row) => row.isFounder === true).length;

  return (
    <section className="primitive-founders" aria-labelledby="primitive-founders-title">
      <header className="games-panel primitive-founders__intro">
        <p className="primitive-founders__eyebrow">함께 시작한 사람들의 기록</p>
        <h2 id="primitive-founders-title">창건자·전승</h2>
        <p>이름과 역할, 확인된 활동을 보존합니다. 최근 주요 기록은 인물마다 최대 8건을 표시합니다.</p>
        <dl className="primitive-founders__overview">
          <div><dt>기록 시작</dt><dd>{history ? dayText(history.observedFromDay) : '관찰 전'}</dd></div>
          <div><dt>창건 명단</dt><dd>{foundersKnown ? `${foundingCount}명 확정` : '미상'}</dd></div>
          <div><dt>관찰된 인물</dt><dd>{rows.length}명</dd></div>
        </dl>
        {history?.origin === 'observed_legacy' ? (
          <p className="primitive-founders__notice">이전 저장은 관찰을 시작한 날부터 기록합니다. 과거 창건 명단과 기록되지 않은 업적은 추정하지 않습니다.</p>
        ) : null}
      </header>

      {rows.length ? (
        <div className="primitive-founders__list">
          {rows.map((row, index) => {
            const fields = Object.entries(FIELD_LABELS).filter(([kind]) => positiveCount(row.tallies?.[kind]));
            const deeds = (Array.isArray(row.recentDeeds) ? row.recentDeeds : []).slice(-8).reverse();
            const status = row.deathRecord ? '사망 기록' : row.living ? '생존' : '생존 미확인';
            const origin = row.isFounder === true ? '창건 인물' : row.foundersKnown ? '합류 인물' : '관찰된 인물';
            return (
              <details className="games-panel primitive-founders__person" key={row.actorId || index} open={index === 0}>
                <summary>
                  <span className="primitive-founders__identity">
                    {row.portrait ? (
                      <Image className="primitive-founders__portrait" src={row.portrait} alt="" width={56} height={56} />
                    ) : <span className="primitive-founders__portrait primitive-founders__portrait--empty" aria-hidden="true">{String(row.name || '?').slice(0, 1)}</span>}
                    <span className="primitive-founders__identity-copy">
                      <strong>{row.name || '이름 미상'}</strong>
                      <span>{row.role || '역할 기록 없음'} · {origin}</span>
                      <small>{dayText(row.firstObservedDay)}부터 관찰 · {status}</small>
                    </span>
                  </span>
                  <span className="primitive-founders__toggle" aria-hidden="true">⌄</span>
                </summary>
                <div className="primitive-founders__record">
                  <section aria-label={`${row.name || '이름 미상'}의 분야별 활동`}>
                    <h3>분야별 활동 기록</h3>
                    {fields.length ? <dl className="primitive-founders__fields">{fields.map(([kind, label]) => (
                      <div key={kind}><dt>{label}</dt><dd>{positiveCount(row.tallies[kind])}회</dd></div>
                    ))}</dl> : <p className="primitive-founders__muted">관찰 시작 후 기록된 활동이 없습니다.</p>}
                  </section>
                  <section aria-label={`${row.name || '이름 미상'}의 최근 주요 기록`}>
                    <h3>최근 주요 기록</h3>
                    {deeds.length ? <ol className="primitive-founders__deeds">{deeds.map((deed, deedIndex) => (
                      <li key={`${deed.day}-${deed.kind}-${deedIndex}`}><span>{dayText(deed.day)}</span><p>{deedText(deed)}</p></li>
                    ))}</ol> : <p className="primitive-founders__muted">남겨진 주요 기록이 없습니다.</p>}
                  </section>
                  {row.deathRecord ? <section className="primitive-founders__death" aria-label={`${row.name || '이름 미상'}의 사망 기록`}>
                    <h3>사망 기록</h3><p>{deathText(row.deathRecord)}</p>
                  </section> : null}
                </div>
              </details>
            );
          })}
        </div>
      ) : <p className="games-panel primitive-founders__empty">아직 관찰된 인물 기록이 없습니다.</p>}

      <aside className="games-panel primitive-founders__future" aria-labelledby="primitive-founders-future-title">
        <h3 id="primitive-founders-future-title">전승과 계승</h3>
        <p>현재는 인물의 생전 활동을 기록합니다. 조상신 숭배·가호·후대 계승 기능은 아직 제공하지 않습니다.</p>
      </aside>
    </section>
  );
}
