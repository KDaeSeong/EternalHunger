'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import SiteHeader from '../../components/SiteHeader';
import { useToast } from '../../components/ToastProvider';
import { apiGet, apiPost, captureAuthSession, isCurrentAuthSession, captureStoredUserSnapshot,
  isCurrentStoredUserSnapshot, updateStoredUser } from '../../utils/api';
import { useAuthToken, useAuthUser, useHydrated } from '../../utils/client-auth';
import catalog from '../../../../shared/achievementCatalog.cjs';
import { achievementProgressPercent as percent, createAchievementRequests, filterAchievements } from './_lib/achievementRequests';
import '../../styles/Achievements.css';

const { ACHIEVEMENTS, CATALOG_VERSION, SECTIONS, buildAchievementRows } = catalog;
const PREVIEW_ROWS = buildAchievementRows();
const MAX_POINTS = ACHIEVEMENTS.reduce((sum, row) => sum + row.points, 0);
const PREVIEW = { achievements: PREVIEW_ROWS, next: [], user: null,
  season: { score: 0, maxScore: MAX_POINTS, completedCount: 0, totalCount: ACHIEVEMENTS.length },
  unclaimedRewards: { count: 0, lp: 0, credits: 0 }, onboarding: { next: [] } };
const number = (value) => (Number.isFinite(Number(value)) ? Number(value) : 0).toLocaleString('ko-KR');

function AchievementCard({ row, authenticated, busy, onClaim }) {
  const status = row.claimed ? '수령 완료' : row.claimable ? '보상 받기' : row.completed ? '달성' : '도전 중';
  return (
    <article className={'achievement-v2-card' + (row.completed ? ' is-earned' : '')}>
      <div className="achievement-v2-card-top">
        <span>{row.sectionLabel}</span>
        <span className={'achievement-v2-state' + (row.claimable ? ' is-ready' : '')}>{authenticated ? status : '도전 과제'}</span>
      </div>
      <h3>{row.title}</h3>
      <p className="achievement-v2-condition">{row.description}</p>
      <div className="achievement-v2-progress" role="progressbar" aria-label={row.title + ' 진행도'}
        aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent(row.progress)}>
        <span style={{ width: percent(row.progress) + '%' }} />
      </div>
      <div className="achievement-v2-progress-label">
        <span>{row.completed ? '달성 기록 보존' : number(row.value) + ' / ' + number(row.target)}</span>
        <strong>{number(row.points)}점</strong>
      </div>
      <div className="achievement-v2-reward">
        <strong>{number(row.reward?.lp)} LP</strong><span>+ {number(row.reward?.credits)} 크레딧</span>
      </div>
      <div className="achievement-v2-card-actions">
        {authenticated && row.claimable ? (
          <button type="button" className="achievement-v2-primary" disabled={busy} onClick={() => onClaim({ achievementIds: [row.id] })}>
            {busy ? '처리 중' : '보상 받기'}
          </button>
        ) : row.claimed ? <span className="achievement-v2-claimed">보상을 받았습니다</span> : null}
        <Link href={row.href}>{row.completed ? '관련 화면' : '도전하러 가기'} <span aria-hidden="true">↗</span></Link>
      </div>
    </article>
  );
}

export default function AchievementsPage() {
  const hydrated = useHydrated();
  const token = useAuthToken();
  const authUser = useAuthUser();
  const { showToast } = useToast();
  const userId = String(authUser?._id || authUser?.id || '');
  const ownerKey = token ? userId + ':' + token : null;
  const [view, setView] = useState({ ownerKey: null, payload: PREVIEW, loading: false, claiming: false, error: '' });
  const [section, setSection] = useState('all');
  const [status, setStatus] = useState('all');
  const [search, setSearch] = useState('');
  const controller = useMemo(() => createAchievementRequests({ preview: PREVIEW, catalogVersion: CATALOG_VERSION,
    getSession: () => ({ auth: captureAuthSession(), userSnapshot: captureStoredUserSnapshot() }),
    isCurrentSession: (session) => isCurrentAuthSession(session.auth),
    read: () => apiGet('/achievements', { timeoutMs: 20000 }),
    post: (selection) => apiPost('/achievements/claim', selection, { timeoutMs: 30000 }),
    onChange: setView,
    onWallet: (progress, session) => {
      if (progress && isCurrentStoredUserSnapshot(session.userSnapshot)) updateStoredUser(progress, { session: session.auth });
    },
    onClaim: (payload) => {
      const receipt = payload.claim || {};
      const balance = payload.userProgress || {};
      const message = receipt.count > 0
        ? '업적 ' + number(receipt.count) + '개 보상: ' + number(receipt.lp) + ' LP · ' + number(receipt.credits) + ' 크레딧을 받았습니다.'
        : receipt.alreadyClaimedCount > 0
          ? '이미 받은 보상: ' + number(receipt.previouslyAwarded?.lp) + ' LP · ' + number(receipt.previouslyAwarded?.credits) + ' 크레딧입니다.'
          : '지금 받을 수 있는 업적 보상이 없습니다.';
      showToast({ tone: 'success', message: message + ' 현재 잔액: ' + number(balance.lp) + ' LP · ' + number(balance.credits) + ' 크레딧.' });
    },
  }), [showToast]);

  useEffect(() => {
    if (!hydrated) return undefined;
    controller.reset(ownerKey ? { key: ownerKey, userId } : null);
    if (ownerKey) void controller.load();
    return () => controller.invalidate();
  }, [controller, hydrated, ownerKey, userId]);

  const authenticated = Boolean(hydrated && token);
  const ownView = view.ownerKey === ownerKey;
  const payload = ownView ? view.payload : PREVIEW;
  const loading = authenticated && (!ownView || view.loading);
  const claiming = ownView && view.claiming;
  const error = ownView ? view.error : '';
  const rows = payload.achievements;
  const visible = useMemo(() => filterAchievements(rows, { section, status, search }), [rows, section, status, search]);
  const groups = useMemo(() => SECTIONS.map((group) => ({ ...group, rows: visible.filter((row) => row.section === group.id) }))
    .filter((group) => group.rows.length > 0), [visible]);
  const season = payload.season;
  const rewards = payload.unclaimedRewards;
  const sectionCounts = useMemo(() => Object.fromEntries(SECTIONS.map((group) => [group.id, {
    total: rows.filter((row) => row.section === group.id).length,
    earned: rows.filter((row) => row.section === group.id && row.completed).length,
  }])), [rows]);

  return (
    <main className="achievements-page-shell achievements-v2">
      <SiteHeader />
      <div className="achievement-v2-page">
        <header className="achievement-v2-hero">
          <div><p className="achievement-v2-kicker">플레이가 쌓이는 곳</p><h1>업적</h1>
            <p>새로운 게임에 도전하고, 쌓인 기록으로 보상을 받으세요.</p>
            <small>달성은 영구 보존 · 보상은 계정당 업적별 한 번</small>
          </div>
          <div className="achievement-v2-hero-actions">
            {authenticated ? <button type="button" onClick={() => void controller.load()} disabled={loading || claiming}>{loading ? '불러오는 중' : '진행도 새로고침'}</button>
              : <Link href="/login" className="achievement-v2-primary">로그인하고 도전</Link>}
            <Link href="/games">게임 고르기 ↗</Link>
          </div>
        </header>

        {!authenticated && <div className="achievement-v2-notice">전체 {number(ACHIEVEMENTS.length)}개 업적을 미리 볼 수 있습니다. 로그인하면 내 진행도와 받을 보상이 표시됩니다.</div>}
        {loading && <div className="achievement-v2-notice" role="status">내 기록으로 업적을 확인하고 있습니다.</div>}
        {error && <div className="achievement-v2-error" role="alert"><span>{error}</span>
          <button type="button" onClick={() => void controller.load()} disabled={loading || claiming}>다시 불러오기</button></div>}
        {authenticated && !loading && !payload.user && <div className="achievement-v2-notice">아래 목록은 미리보기입니다. 내 기록을 불러오면 실제 진행도와 보상이 표시됩니다.</div>}

        <section className="achievement-v2-summary" aria-label="내 업적 요약">
          <div><span>달성한 업적</span><strong>{number(season.completedCount)} <small>/ {number(season.totalCount)}</small></strong>
            <p>{authenticated ? percent(season.completedCount / season.totalCount) + '% 달성' : '로그인하면 내 기록을 불러옵니다'}</p></div>
          <div><span>업적 점수</span><strong>{number(season.score)} <small>/ {number(season.maxScore)}점</small></strong>
            <p>달성 기록을 모은 점수이며, LP와 별개입니다</p></div>
          <div className="achievement-v2-summary-rewards"><span>받을 수 있는 보상 · {number(rewards.count)}개</span>
            <strong>{number(rewards.lp)} LP</strong><p>{number(rewards.credits)} 크레딧</p>
            <button type="button" className="achievement-v2-primary" disabled={!authenticated || loading || claiming || rewards.count === 0}
              onClick={() => void controller.claim({ all: true })}>{claiming ? '보상 처리 중' : '보상 모두 받기'}</button></div>
        </section>

        {authenticated && payload.next?.length > 0 && <section className="achievement-v2-recommendations" aria-label="다음 도전">
          <div><h2>다음 도전</h2><p>지금 기록에서 가까운 목표입니다.</p></div>
          <div className="achievement-v2-next-list">{payload.next.map((row) => <Link key={row.id} href={row.href}>
            <span>{row.sectionLabel}</span><strong>{row.title}</strong><small>{number(row.value)} / {number(row.target)} · {number(row.reward?.lp)} LP</small>
          </Link>)}</div>
        </section>}

        <section className="achievement-v2-catalog" aria-label="업적 목록">
          <div className="achievement-v2-catalog-heading"><h2>도전 과제</h2><span role="status">{number(visible.length)}개 표시</span>
            <label className="achievement-v2-search"><span className="achievement-v2-sr-only">업적 검색</span>
              <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="업적 이름·조건 검색" /></label></div>
          <div className="achievement-v2-sections" aria-label="업적 분야">
            <button type="button" aria-pressed={section === 'all'} onClick={() => setSection('all')}>전체 <span>{number(rows.length)}</span></button>
            {SECTIONS.map((group) => <button type="button" key={group.id} aria-pressed={section === group.id} onClick={() => setSection(group.id)}>
              {group.label} <span>{authenticated ? number(sectionCounts[group.id].earned) + '/' : ''}{number(sectionCounts[group.id].total)}</span></button>)}
          </div>
          <div className="achievement-v2-statuses" aria-label="업적 상태">
            {[['all', '전체'], ['progress', '도전 중'], ['claimable', '보상 받기'], ['complete', '달성']].map(([id, label]) => (
              <button type="button" key={id} aria-pressed={status === id} onClick={() => setStatus(id)}>{label}</button>
            ))}
          </div>
          <div className="achievement-v2-groups" aria-busy={loading || claiming}>
            {groups.map((group) => <section key={group.id} className="achievement-v2-group">
              <h3>{group.label} <small>{number(group.rows.length)}개</small></h3>
              <div className="achievement-v2-card-grid">{group.rows.map((row) => <AchievementCard key={row.id} row={row}
                authenticated={authenticated} busy={loading || claiming} onClaim={(selection) => void controller.claim(selection)} />)}</div>
            </section>)}
            {groups.length === 0 && <div className="achievement-v2-empty"><h3>{status === 'claimable' ? '지금 받을 보상이 없습니다' : '조건에 맞는 업적이 없습니다'}</h3>
              <p>다른 분야나 상태를 선택하거나 검색어를 바꿔보세요.</p>
              <button type="button" onClick={() => { setSection('all'); setStatus('all'); setSearch(''); }}>전체 업적 보기</button></div>}
          </div>
        </section>

        <details className="achievement-v2-help"><summary>달성과 보상은 어떻게 계산하나요?</summary>
          <p>업적 화면을 열거나 진행도를 새로고침하면 저장된 전적과 계정 활동으로 달성을 확인합니다. 기존 기록도 조건을 충족하면 반영하며, 확인된 달성 뒤 재화를 쓰거나 캐릭터를 삭제해도 업적은 취소되지 않습니다.</p>
          <p>업적 점수는 기록용 점수입니다. 보상은 업적 점수 1점당 5 LP·10 크레딧이며, 받기 버튼을 누르면 계정에 지급됩니다. 같은 업적의 보상은 한 번만 받을 수 있습니다.</p>
          <p>문명 아카이브는 개발자 보정 없는 완주 정산 기록을 사용합니다. 기본 완주 보상과 업적 보상은 따로 지급됩니다. 다른 마이애니메 게임은 플레이 기록을 남긴 뒤 진행도를 새로고침해주세요.</p>
          {authenticated && payload.onboarding?.next?.length > 0 && <div className="achievement-v2-start-links">
            {payload.onboarding.next.map((step) => <Link href={step.href} key={step.id}>{step.title} ↗</Link>)}</div>}
        </details>
      </div>
    </main>
  );
}
