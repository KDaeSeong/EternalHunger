'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import SiteHeader from '../../components/SiteHeader';
import { useToast } from '../../components/ToastProvider';
import { apiGet } from '../../utils/api';
import { useAuthToken, useHydrated } from '../../utils/client-auth';

const EMPTY_PAYLOAD = {
  user: null,
  season: {
    id: 'preseason',
    name: '프리시즌',
    title: '기반 시즌',
    summary: '누적 활동을 기준으로 업적 진행도를 계산합니다.',
    score: 0,
    maxScore: 0,
    completedCount: 0,
    totalCount: 0,
  },
  totals: {},
  sections: [],
  achievements: [],
  next: [],
};

function normalizeList(value) {
  return Array.isArray(value) ? value : [];
}

function toNumber(value) {
  const n = Number(value || 0);
  return Number.isFinite(n) ? n : 0;
}

function formatNumber(value) {
  return toNumber(value).toLocaleString('ko-KR');
}

function formatPercent(value) {
  return `${Math.round(Math.max(0, Math.min(1, toNumber(value))) * 100)}%`;
}

function safeText(value, fallback = '') {
  const text = String(value || '').trim();
  return text || fallback;
}

function normalizePayload(payload) {
  const src = payload && typeof payload === 'object' ? payload : {};
  const season = src.season && typeof src.season === 'object' ? src.season : {};
  return {
    user: src.user || null,
    season: { ...EMPTY_PAYLOAD.season, ...season },
    totals: src.totals && typeof src.totals === 'object' ? src.totals : {},
    sections: normalizeList(src.sections),
    achievements: normalizeList(src.achievements),
    next: normalizeList(src.next),
  };
}

function groupAchievements(rows) {
  return rows.reduce((acc, achievement) => {
    const key = safeText(achievement?.section, 'etc');
    if (!acc[key]) {
      acc[key] = {
        key,
        label: safeText(achievement?.sectionLabel, key),
        rows: [],
      };
    }
    acc[key].rows.push(achievement);
    return acc;
  }, {});
}

function Metric({ label, value, hint }) {
  return (
    <div className="achievements-metric">
      <span>{label}</span>
      <strong>{value}</strong>
      {hint ? <small>{hint}</small> : null}
    </div>
  );
}

function ProgressBar({ value }) {
  return (
    <div className="achievements-progress" aria-label={`진행도 ${formatPercent(value)}`}>
      <span style={{ width: formatPercent(value) }} />
    </div>
  );
}

function AchievementCard({ achievement, compact = false }) {
  const completed = Boolean(achievement?.completed);
  const href = safeText(achievement?.href, '');
  const title = safeText(achievement?.title, '업적');
  return (
    <article className={`achievements-card ${completed ? 'is-complete' : ''} ${compact ? 'is-compact' : ''}`}>
      <div className="achievements-card-title">
        <div>
          <span>{safeText(achievement?.sectionLabel, '업적')}</span>
          <h3>{title}</h3>
        </div>
        <strong>{formatNumber(achievement?.points)} pt</strong>
      </div>
      <p>{safeText(achievement?.description, '업적 조건을 달성하면 점수를 획득합니다.')}</p>
      <div className="achievements-card-progress">
        <ProgressBar value={achievement?.progress} />
        <small>
          {formatNumber(achievement?.value)} / {formatNumber(achievement?.target)}
        </small>
      </div>
      {href ? <Link href={href}>{completed ? '관련 화면 보기' : '진행하러 가기'}</Link> : null}
    </article>
  );
}

export default function AchievementsPage() {
  const hydrated = useHydrated();
  const token = useAuthToken();
  const { showToast } = useToast();
  const [payload, setPayload] = useState(EMPTY_PAYLOAD);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadAchievements = useCallback(async () => {
    if (!token) {
      setPayload(EMPTY_PAYLOAD);
      setLoading(false);
      setError('');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const data = await apiGet('/achievements', { timeoutMs: 15000 });
      setPayload(normalizePayload(data));
    } catch (err) {
      const message = err?.message || '업적 정보를 불러오지 못했습니다.';
      setPayload(EMPTY_PAYLOAD);
      setError(message);
      showToast({ tone: 'danger', message });
    } finally {
      setLoading(false);
    }
  }, [showToast, token]);

  useEffect(() => {
    if (!hydrated) return;
    void loadAchievements();
  }, [hydrated, loadAchievements]);

  const grouped = useMemo(() => Object.values(groupAchievements(payload.achievements)), [payload.achievements]);
  const season = payload.season || EMPTY_PAYLOAD.season;
  const scoreRatio = season.maxScore ? season.score / season.maxScore : 0;
  const userName = safeText(payload.user?.nickname || payload.user?.username, '플레이어');

  return (
    <main className="achievements-page-shell">
      <SiteHeader />
      <section className="achievements-page">
        <section className="achievements-hero">
          <div>
            <p className="achievements-kicker">Season</p>
            <h1>업적</h1>
            <p>{safeText(season.summary, '누적 전적과 커뮤니티 활동을 기준으로 업적을 계산합니다.')}</p>
          </div>
          <div className="achievements-hero-actions">
            <button type="button" onClick={() => void loadAchievements()} disabled={!token || loading}>
              {loading ? '갱신 중...' : '새로고침'}
            </button>
            <Link href="/simulation">게임 시작</Link>
          </div>
        </section>

        {!hydrated || loading ? (
          <div className="achievements-empty">업적 정보를 확인하는 중입니다.</div>
        ) : !token ? (
          <div className="achievements-empty">
            <p>로그인하면 전적, 게시판 활동, 스무고개 기록을 기준으로 업적을 볼 수 있습니다.</p>
            <Link href="/login">로그인</Link>
          </div>
        ) : (
          <>
            <section className="achievements-summary" aria-label="업적 요약">
              <Metric
                label={safeText(season.name, '프리시즌')}
                value={`${formatNumber(season.score)} / ${formatNumber(season.maxScore)} pt`}
                hint={safeText(season.title, '기반 시즌')}
              />
              <Metric
                label="완료 업적"
                value={`${formatNumber(season.completedCount)} / ${formatNumber(season.totalCount)}`}
                hint={formatPercent(scoreRatio)}
              />
              <Metric
                label="LP"
                value={formatNumber(payload.user?.lp)}
                hint={userName}
              />
              <Metric
                label="크레딧"
                value={formatNumber(payload.user?.credits)}
                hint="특전/시즌 활동"
              />
            </section>

            {error ? (
              <div className="achievements-empty achievements-error">
                <p>{error}</p>
                <button type="button" onClick={() => void loadAchievements()}>다시 불러오기</button>
              </div>
            ) : null}

            <section className="achievements-panel">
              <div className="achievements-panel-title">
                <div>
                  <span>Next</span>
                  <h2>다음 목표</h2>
                </div>
                <Link href="/records">기록소 보기</Link>
              </div>
              {payload.next.length ? (
                <div className="achievements-next-grid">
                  {payload.next.map((achievement) => (
                    <AchievementCard achievement={achievement} compact key={achievement.id || achievement.title} />
                  ))}
                </div>
              ) : (
                <div className="achievements-empty">현재 등록된 업적을 모두 완료했습니다.</div>
              )}
            </section>

            <section className="achievements-section-grid" aria-label="분야별 진행도">
              {payload.sections.map((section) => (
                <article className="achievements-section-card" key={section.section || section.label}>
                  <span>{safeText(section.label || section.section, '업적')}</span>
                  <strong>{formatNumber(section.score)} / {formatNumber(section.maxScore)} pt</strong>
                  <ProgressBar value={section.maxScore ? section.score / section.maxScore : 0} />
                  <small>{formatNumber(section.completedCount)} / {formatNumber(section.totalCount)} 완료</small>
                </article>
              ))}
            </section>

            <section className="achievements-panel">
              <div className="achievements-panel-title">
                <div>
                  <span>Archive</span>
                  <h2>전체 업적</h2>
                </div>
              </div>
              {grouped.length ? (
                <div className="achievements-groups">
                  {grouped.map((group) => (
                    <section className="achievements-group" key={group.key}>
                      <h3>{group.label}</h3>
                      <div className="achievements-grid">
                        {group.rows.map((achievement) => (
                          <AchievementCard achievement={achievement} key={achievement.id || achievement.title} />
                        ))}
                      </div>
                    </section>
                  ))}
                </div>
              ) : (
                <div className="achievements-empty">표시할 업적이 없습니다.</div>
              )}
            </section>
          </>
        )}
      </section>
    </main>
  );
}
