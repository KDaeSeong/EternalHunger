'use client';

import { useMemo, useRef, useState } from 'react';
import { ITEMS, TECH_TREE, TRIBE_PROJECTS, WORLD_REGIONS, ZONES } from '../_lib/primitiveArchiveData';
import PrimitiveArchivePortrait from './PrimitiveArchivePortrait';
import PrimitiveArchivePersonIdentity from './PrimitiveArchivePersonIdentity';
import { archiveIdentityIndex } from '../_lib/primitiveArchiveIdentity';
import { annualPersonSummary } from '../_lib/primitiveArchiveCalendar';

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
const dayText = (value, calendar) => {
  const day = positiveCount(value);
  if (!day) return '날짜 미상';
  return calendar?.mode === 'annual' && day > calendar.startedDay
    ? `정착 ${day - calendar.startedDay}년차` : `${day}일차`;
};

function deathText(record, calendar) {
  if (!record) return '';
  const source = record.source === 'night' ? '밤 정산' : record.source === 'action' ? '행동 중' : '';
  const parts = [dayText(record.day, calendar), source, record.reason || '사망 원인 미상'];
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

const STAGE_LABELS = { active: '활동 중', elder: '후계 인계 예고', retired: '은퇴·생존', deceased: '사망' };
const FAITH_STATUS_LABELS = { living: '생존 인물의 가르침', retired: '은퇴한 인물의 가르침',
  deceased: '사후 시조신의 가호', unconfirmed: '생애 상태 미확인' };

function FounderPortrait({ member, compact = false }) {
  const className = `primitive-founders__portrait${compact ? ' primitive-founders__portrait--compact' : ''}`;
  return <PrimitiveArchivePortrait className={className} member={member} size={compact ? 32 : 56} />;
}

export default function PrimitiveArchiveFoundersTab({ foundersRows = [], state, lineage, annual,
  ancestralFaith, ancestralRows = [], prepareSuccessor, retireFounder, runAncestralRite, busy = false }) {
  const [retirement, setRetirement] = useState(null);
  const retirementToken = useRef(null);
  const retirementButtons = useRef({});
  const identities = useMemo(() => archiveIdentityIndex(state), [state]);
  const rows = Array.isArray(foundersRows) ? foundersRows : [];
  const annualMode = Boolean(annual?.annualMode);
  const recordedLife = Array.isArray(lineage?.rows) ? lineage.rows : [];
  const lifeRows = annualMode && !recordedLife.length ? (state?.party || []).map(member => ({
    actorId: member.id, name: member.name, role: member.role, stage: member.hp > 0 ? 'active' : 'deceased',
    annual: annualPersonSummary(state, member.id), canPrepare: false, canRetire: false,
  })) : recordedLife;
  const faithRows = Array.isArray(ancestralRows) ? ancestralRows : [];
  const activeLife = lifeRows.filter((row) => row.stage === 'active' || row.stage === 'elder');
  const previousLife = lifeRows.filter((row) => row.stage === 'retired' || row.stage === 'deceased');
  const history = state?.founderHistory || rows[0];
  const foundersKnown = history?.foundersKnown === true;
  const foundingCount = rows.filter((row) => row.isFounder === true).length;
  const retirementKey = (row) => JSON.stringify([state?.runId, state?.day, row.actorId, row.generation,
    row.cycle, row.stage, row.successorId, row.successorName, state?.calendar?.completedYears ?? null,
    row.annual?.serviceYears ?? null, row.annual?.observedYears ?? null]);
  const selectedRetirement = activeLife.find((row) => row.canRetire && retirement?.key === retirementKey(row));
  const controlsBusy = Boolean(busy);
  const lifetimeText = annual?.observedLifetimeYears === null ? '자동 생애 종료 없음' : `관찰 생애 ${annual?.observedLifetimeYears ?? 60}년에 생애 종료`;
  const lifeText = row => annualMode ? row.annual?.observed
    ? `관찰 ${row.annual.observedYears}년 · ${row.annual.serviceYears === null ? '현장 활동 전' : `활동 ${row.annual.serviceYears}년`}`
    : '연간 관찰 전 기록' : `게임상 활동기 ${row.cycle}기`;

  return (
    <section className="primitive-founders" aria-labelledby="primitive-founders-title">
      <header className="games-panel primitive-founders__intro">
        <h2 id="primitive-founders-title">창건자·전승</h2>
        <p className="primitive-founders__muted">창건 명단 {foundersKnown ? `${foundingCount}명 확정` : '미상'} · {history ? `${dayText(history.observedFromDay, state?.calendar)}부터 관찰` : '관찰 전'} · 인물 기록 {rows.length}명</p>
        {history?.origin === 'observed_legacy' ? (
          <p className="primitive-founders__notice">이전 저장은 관찰을 시작한 날부터 기록합니다. 과거 창건 명단과 기록되지 않은 업적은 추정하지 않습니다.</p>
        ) : null}
      </header>

      <section className="games-panel primitive-founders__decisions" aria-labelledby="primitive-lineage-title">
        <div className="primitive-founders__section-head">
          <h3 id="primitive-lineage-title">생애와 후계</h3>
          <details className="primitive-founders__rules">
            <summary>{annualMode ? '연간 생애·인계 규칙' : '활동기·인계 규칙'}</summary>
            <p>{annualMode && lineage?.mode !== 'legacy' ? `1회 운영은 1년입니다. 활동 20년부터 인계를 안내하고 25년에는 준비된 후계에게 생전에 인계합니다. ${lifetimeText}. 실제 나이는 추정하지 않습니다.` : lineage?.ruleText || '생애 정보를 불러오면 게임상 활동기와 인계 조건을 확인할 수 있습니다.'}</p>
            {lineage?.prepareCostText ? <p>후계 준비: {lineage.prepareCostText}</p> : null}
            {lineage?.retireCostText ? <p>은퇴 인계: {lineage.retireCostText}</p> : null}
            <p>{annualMode ? '관찰 연수는 연간 운영을 시작한 뒤에만 쌓입니다. 이전 활동기를 년으로 환산하지 않습니다.' : '활동기는 정착 기반을 갖춘 뒤의 생애 흐름이며 원작 캐릭터의 나이가 아닙니다.'} 후계 준비는 공동체 일손 1명을 전환하며 준비된 후계와 은퇴자도 공동 식량을 소비합니다.</p>
          </details>
        </div>
        {!lineage?.enabled ? <p className="primitive-founders__muted">{lineage?.mode === 'legacy'
          ? '이전 런의 생애 전환은 비활성 상태입니다. 기존 대원과 진행을 유지합니다.'
          : '생애 상태를 불러오는 중입니다.'}</p> : null}
        {!annualMode && lineage?.enabled && !lineage.clockStarted ? <p className="primitive-founders__muted">정착 활동기 시작 전입니다. 정착·식량 저장·거처와 후계를 준비할 실제 일손·식량을 먼저 마련하세요.</p> : null}
        <div className="primitive-founders__life-list">
          {activeLife.map((row) => {
            const canPrepare = !controlsBusy && lineage?.enabled && row.canPrepare && typeof prepareSuccessor === 'function';
            const canRetire = !controlsBusy && lineage?.enabled && row.canRetire && typeof retireFounder === 'function';
            const confirming = selectedRetirement?.actorId === row.actorId;
            const confirmId = `primitive-retire-${encodeURIComponent(row.actorId)}`;
            const person = state?.party?.find((member) => member.id === row.actorId) || row.retiredSnapshot
              || rows.find((member) => member.actorId === row.actorId) || row;
            return <article className={`primitive-founders__life${row.warning ? ' is-warning' : ''}`} key={row.actorId}>
              <div className="primitive-founders__life-head">
                <div className="primitive-founders__actor"><FounderPortrait member={person} compact /><div className="primitive-founders__actor-copy"><strong>{row.name}</strong><small>{row.role} · {lifeText(row)} · {STAGE_LABELS[row.stage] || '상태 미확인'}</small></div></div>
                <div className="primitive-founders__actions">
                  <button type="button" disabled={!canPrepare} aria-label={`${row.name}의 후계 준비`} title={controlsBusy ? '저장 작업 중입니다.' : row.prepareReason || lineage.prepareCostText || '준비 비용 확인 필요'}
                    onClick={() => { if (canPrepare) prepareSuccessor(row.actorId); }}>후계 준비</button>
                  <button type="button" disabled={!canRetire} aria-label={`${row.name}의 은퇴 인계`} aria-expanded={confirming} aria-controls={confirming ? confirmId : undefined}
                    ref={(element) => { if (element) retirementButtons.current[row.actorId] = element; else delete retirementButtons.current[row.actorId]; }}
                    title={controlsBusy ? '저장 작업 중입니다.' : row.retireReason || lineage.retireCostText || `${row.name}의 현장 활동을 준비된 후계에게 인계합니다.`}
                    onClick={() => {
                      if (!canRetire) return;
                      const token = { key: retirementKey(row) };
                      retirementToken.current = token;
                      setRetirement(token);
                    }}>은퇴 인계</button>
                </div>
              </div>
              <PrimitiveArchivePersonIdentity identity={identities[row.actorId]} />
              <p className="primitive-founders__muted">{row.successorName ? `후계: ${row.successorName}` : row.prepareReason || lineage.prepareCostText || '준비 비용 확인 필요'}{row.retireReason ? ` · ${row.retireReason}` : ''}</p>
              {confirming ? <div className="primitive-founders__confirmation" id={confirmId} role="group" aria-labelledby={`${confirmId}-title`}>
                <h4 id={`${confirmId}-title`}>{row.name}의 은퇴를 확정할까요?</h4>
                <p>은퇴하는 인물: {row.name}. 생존한 채 은퇴하며, 현장 대원은 다음 후계자로 교체합니다: {row.successorName}. 장비는 후계에게 한 번 이전하며 원래 인물과 당시 장비의 기록은 보존합니다. 은퇴는 신격화나 사망이 아닙니다.</p>
                <div className="primitive-founders__actions">
                  <button type="button" disabled={!canRetire} aria-label={`${row.name}의 은퇴·인계 확정`} onClick={() => {
                    if (!canRetire || retirement?.key !== retirementKey(row) || retirementToken.current !== retirement) return;
                    retirementToken.current = null;
                    setRetirement(null); retireFounder(row.actorId);
                  }}>은퇴·인계 확정</button>
                  <button type="button" aria-label={`${row.name}의 은퇴 취소`} onClick={() => {
                    if (retirementToken.current !== retirement) return;
                    retirementToken.current = null;
                    setRetirement(null); retirementButtons.current[row.actorId]?.focus();
                  }}>취소</button>
                </div>
              </div> : null}
            </article>;
          })}
        </div>
        {state?.lineage?.prepared?.length ? <section className="primitive-founders__prepared" aria-label="준비된 후계">
          <h4>준비된 후계 · {state.lineage.prepared.length}명</h4>
          {state.lineage.prepared.map(candidate => {
            const observed = annualMode ? annualPersonSummary(state, candidate.actor.id) : null;
            const mentor = lifeRows.find(row => row.actorId === candidate.mentorId);
            return <article key={candidate.actor.id}>
              <div className="primitive-founders__actor"><FounderPortrait member={candidate.actor} compact />
                <strong>{candidate.actor.name}</strong></div>
              <PrimitiveArchivePersonIdentity identity={identities[candidate.actor.id]} />
              <p>{candidate.actor.role} · 지도자 {mentor?.name || '기록 확인 필요'} · {annualMode
                ? observed.observed ? `관찰 ${observed.observedYears}년` : '연간 관찰 전 기록'
                : `${candidate.preparedDay}일차 준비`} · 공동 배식에 포함</p>
            </article>;
          })}
        </section> : null}
        {previousLife.length ? <details className="primitive-founders__past"><summary>은퇴·사망한 인물 {previousLife.length}명</summary>
          {previousLife.map((row) => {
            const person = row.retiredSnapshot || state?.party?.find(member => member.id === row.actorId)
              || rows.find(member => member.actorId === row.actorId) || row;
            return <article key={row.actorId}>
              <div className="primitive-founders__actor"><FounderPortrait member={person} compact /><strong>{row.name}</strong></div>
              <PrimitiveArchivePersonIdentity identity={identities[row.actorId]} />
              <p>{STAGE_LABELS[row.stage]} · {lifeText(row)}{row.successorName ? ` · 후계 ${row.successorName}` : ''}</p>
            </article>;
          })}
        </details> : null}
      </section>

      <section className="games-panel primitive-founders__decisions" aria-labelledby="primitive-ancestral-title">
        <h3 id="primitive-ancestral-title">가르침과 시조신</h3>
        {ancestralFaith?.active ? <p className="primitive-founders__active" role="status">{ancestralFaith.activeFounderName} · {ancestralFaith.activeDomainLabel} · {ancestralFaith.activeEffectText || '효과 확인 필요'} · 오늘 {ancestralFaith.active.remaining}회 남음</p> : null}
        {ancestralFaith?.active && ancestralFaith.activeResponse ? <p className="primitive-founders__response">{ancestralFaith.activeFounderName}: “{ancestralFaith.activeResponse}”</p> : null}
        <details className="primitive-founders__rules"><summary>실제 비용·효과·사용 조건</summary>
          <p>{ancestralFaith?.costText || '비용 정보를 불러오는 중입니다.'}</p>
          <p>{ancestralFaith?.effectText || '효과 정보를 불러오는 중입니다.'}</p>
          <p>생존 중과 은퇴 뒤에는 본인의 가르침을, 실제 사망 뒤에는 같은 인물의 사후 가호를 이어갑니다.</p>
        </details>
        {ancestralFaith && !ancestralFaith.enabled ? <p className="primitive-founders__muted">이전 런에서는 조상신 효과를 새로 활성화하지 않습니다. 기존 진행을 유지합니다.</p> : null}
        <div className="primitive-founders__faith-list">
          {faithRows.map((row) => {
            const canUse = !controlsBusy && row.ready && ancestralFaith?.enabled && typeof runAncestralRite === 'function';
            const label = row.mode === 'blessing' ? '가호 의례' : row.mode === 'teaching' ? '가르침 받기' : '상태 미확인';
            return <article className="primitive-founders__faith" key={row.founderId}>
              <div className="primitive-founders__life-head"><div className="primitive-founders__actor"><FounderPortrait member={{ ...row, actorId: row.founderId }} compact /><div className="primitive-founders__actor-copy"><strong>{row.name}</strong><small>{FAITH_STATUS_LABELS[row.status] || '생애 상태 미확인'} · {row.domainLabel || '분야 기록 대기'} 기여 {row.contributionCount}회</small></div></div>
                <button type="button" disabled={!canUse} aria-label={`${row.name}의 ${label}`} title={controlsBusy ? '저장 작업 중입니다.' : row.message || `${ancestralFaith?.costText || '비용 확인 필요'} · ${ancestralFaith?.effectText || '효과 확인 필요'}`}
                  onClick={() => { if (canUse) runAncestralRite(row.founderId); }}>{label}</button>
              </div>
              {row.message ? <p className="primitive-founders__muted">{row.message}</p> : null}
              <details className="primitive-founders__rules"><summary>전승의 근거·효과·인물의 말</summary><p>{row.legend}</p>{row.effectText ? <p>{row.effectText}</p> : null}{row.response ? <p>{row.name}: “{row.response}”</p> : null}</details>
            </article>;
          })}
        </div>
      </section>

      <details className="games-panel primitive-founders__archive">
        <summary>이름·분야별 업적·최근 기록 ({rows.length}명)</summary>
        <p className="primitive-founders__muted">확인된 생전 활동을 보존합니다. 최근 주요 기록은 인물마다 최대 8건을 표시합니다.</p>
        {rows.length ? (
        <div className="primitive-founders__list">
          {rows.map((row, index) => {
            const fields = Object.entries(FIELD_LABELS).filter(([kind]) => positiveCount(row.tallies?.[kind]));
            const deeds = (Array.isArray(row.recentDeeds) ? row.recentDeeds : []).slice(-8).reverse();
            const life = lifeRows.find((member) => member.actorId === row.actorId);
            const status = row.deathRecord || life?.stage === 'deceased' ? '사망 기록' : life?.stage === 'retired' ? '은퇴·생존' : row.living ? '생존' : '생존 미확인';
            const origin = row.isFounder === true ? '창건 인물' : row.foundersKnown ? '합류 인물' : '관찰된 인물';
            return (
              <details className="games-panel primitive-founders__person" key={row.actorId || index} open={index === 0}>
                <summary>
                  <span className="primitive-founders__identity">
                    <FounderPortrait member={row} />
                    <span className="primitive-founders__identity-copy">
                      <strong>{row.name || '이름 미상'}</strong>
                      <span>{row.role || '역할 기록 없음'} · {origin}</span>
                      <small>{dayText(row.firstObservedDay, state?.calendar)}부터 관찰 · {status}</small>
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
                      <li key={`${deed.day}-${deed.kind}-${deedIndex}`}><span>{dayText(deed.day, state?.calendar)}</span><p>{deedText(deed)}</p></li>
                    ))}</ol> : <p className="primitive-founders__muted">남겨진 주요 기록이 없습니다.</p>}
                  </section>
                  {row.deathRecord ? <section className="primitive-founders__death" aria-label={`${row.name || '이름 미상'}의 사망 기록`}>
                    <h3>사망 기록</h3><p>{deathText(row.deathRecord, state?.calendar)}</p>
                  </section> : null}
                </div>
              </details>
            );
          })}
        </div>
        ) : <p className="primitive-founders__empty">아직 관찰된 인물 기록이 없습니다.</p>}
      </details>
    </section>
  );
}
