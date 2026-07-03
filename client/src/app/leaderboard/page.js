'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import SiteHeader from '../../components/SiteHeader';
import { useToast } from '../../components/ToastProvider';
import { apiGetCached } from '../../utils/api';

const EMPTY_LEADERBOARD = {
  counts: { users: 0, characters: 0, teams: 0 },
  users: [],
  characters: [],
  teams: [],
};

function normalizeList(value) {
  return Array.isArray(value) ? value : [];
}

function normalizePayload(payload) {
  const src = payload && typeof payload === 'object' ? payload : {};
  return {
    counts: { ...EMPTY_LEADERBOARD.counts, ...(src.counts || {}) },
    users: normalizeList(src.users),
    characters: normalizeList(src.characters),
    teams: normalizeList(src.teams),
  };
}

function safeText(value, fallback = '') {
  const text = String(value || '').trim();
  return text || fallback;
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString('ko-KR');
}

function formatRate(value) {
  return `${Math.round(Number(value || 0) * 1000) / 10}%`;
}

function userHref(user) {
  const id = user?._id || user?.id;
  return id ? `/users/${id}` : '';
}

function rankMedal(index) {
  if (index === 0) return '1';
  if (index === 1) return '2';
  if (index === 2) return '3';
  return String(index + 1);
}

function LeaderboardPanel({ title, subtitle, rows, empty, renderRow }) {
  return (
    <section className="leaderboard-panel">
      <div className="leaderboard-panel-title">
        <div>
          <h2>{title}</h2>
          <p>{subtitle}</p>
        </div>
        <span>{formatNumber(rows.length)}</span>
      </div>
      {rows.length ? (
        <ol className="leaderboard-list">
          {rows.map((row, index) => renderRow(row, index))}
        </ol>
      ) : (
        <div className="leaderboard-empty">{empty}</div>
      )}
    </section>
  );
}

export default function LeaderboardPage() {
  const { showToast } = useToast();
  const [payload, setPayload] = useState(() => normalizePayload(null));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadLeaderboard = useCallback(async (options = {}) => {
    setLoading(true);
    setError('');
    try {
      const data = await apiGetCached('/public/leaderboard', {
        ttlMs: 30000,
        timeoutMs: 15000,
        storage: 'session',
        force: Boolean(options.force),
      });
      setPayload(normalizePayload(data));
    } catch (err) {
      const message = err?.message || '리더보드를 불러오지 못했습니다.';
      setPayload(normalizePayload(null));
      setError(message);
      showToast({ tone: 'warning', message });
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    void loadLeaderboard();
  }, [loadLeaderboard]);

  const topUser = payload.users[0] || null;
  const topCharacter = payload.characters[0] || null;
  const topTeam = payload.teams[0] || null;
  const summary = useMemo(() => [
    { label: '랭킹 유저', value: payload.counts.users },
    { label: '기록 캐릭터', value: payload.counts.characters },
    { label: '기록 팀', value: payload.counts.teams },
    { label: '최고 LP', value: topUser?.lp || 0 },
  ], [payload.counts.characters, payload.counts.teams, payload.counts.users, topUser?.lp]);

  return (
    <main className="leaderboard-page-shell">
      <SiteHeader />
      <section className="leaderboard-page">
        <section className="leaderboard-hero">
          <div>
            <p className="leaderboard-kicker">Leaderboard</p>
            <h1>리더보드</h1>
            <p>LP, 캐릭터 전적, 팀 전적을 기준으로 사이트 전체 순위를 확인합니다.</p>
          </div>
          <div className="leaderboard-hero-actions">
            <button type="button" onClick={() => void loadLeaderboard({ force: true })} disabled={loading}>
              {loading ? '갱신 중' : '새로고침'}
            </button>
            <Link href="/records">내 기록소</Link>
          </div>
        </section>

        <section className="leaderboard-summary" aria-label="리더보드 요약">
          {summary.map((item) => (
            <div key={item.label}>
              <span>{item.label}</span>
              <strong>{formatNumber(item.value)}</strong>
            </div>
          ))}
        </section>

        {error ? (
          <div className="leaderboard-empty leaderboard-error">
            <p>{error}</p>
            <button type="button" onClick={() => void loadLeaderboard({ force: true })}>다시 불러오기</button>
          </div>
        ) : null}

        {loading ? <div className="leaderboard-empty">리더보드를 불러오는 중입니다.</div> : null}

        {!loading && !error ? (
          <>
            <section className="leaderboard-top-grid" aria-label="최고 기록">
              <article>
                <span>LP 1위</span>
                <strong>{safeText(topUser?.displayName || topUser?.nickname || topUser?.username, '기록 없음')}</strong>
                <p>{formatNumber(topUser?.lp)} LP</p>
              </article>
              <article>
                <span>캐릭터 1위</span>
                <strong>{safeText(topCharacter?.name, '기록 없음')}</strong>
                <p>{formatNumber(topCharacter?.totalWins)}승 · {formatNumber(topCharacter?.totalKills)}킬</p>
              </article>
              <article>
                <span>팀 1위</span>
                <strong>{safeText(topTeam?.teamName || normalizeList(topTeam?.rosterNames).join(' / '), '기록 없음')}</strong>
                <p>{formatNumber(topTeam?.totalWins)}승 · 승률 {formatRate(topTeam?.winRate)}</p>
              </article>
            </section>

            <div className="leaderboard-content-grid">
              <LeaderboardPanel
                title="LP 랭킹"
                subtitle="유저 누적 LP 기준"
                rows={payload.users}
                empty="아직 유저 랭킹이 없습니다."
                renderRow={(row, index) => {
                  const href = userHref(row);
                  const name = safeText(row.displayName || row.nickname || row.username, '사용자');
                  const body = (
                    <>
                      <span className="leaderboard-rank">{rankMedal(index)}</span>
                      <div>
                        <strong>{name}</strong>
                        <small>{formatNumber(row.totalGames)}전 · {formatNumber(row.totalWins)}승 · {formatNumber(row.totalKills)}킬</small>
                      </div>
                      <b>{formatNumber(row.lp)} LP</b>
                    </>
                  );
                  return href ? <li key={`user-${row._id}`}><Link href={href}>{body}</Link></li> : <li key={`user-${index}`}><div>{body}</div></li>;
                }}
              />

              <LeaderboardPanel
                title="캐릭터 랭킹"
                subtitle="승리, 킬, 참가 순 정렬"
                rows={payload.characters}
                empty="아직 캐릭터 기록이 없습니다."
                renderRow={(row, index) => {
                  const href = userHref(row.owner);
                  const body = (
                    <>
                      <span className="leaderboard-rank">{rankMedal(index)}</span>
                      <div>
                        <strong>{safeText(row.name, '캐릭터')}</strong>
                        <small>{safeText(row.weaponType, '무기 없음')} · {safeText(row.ownerName, '익명')}</small>
                      </div>
                      <b>{formatNumber(row.totalWins)}승</b>
                    </>
                  );
                  return href ? <li key={`character-${row._id}`}><Link href={href}>{body}</Link></li> : <li key={`character-${index}`}><div>{body}</div></li>;
                }}
              />

              <LeaderboardPanel
                title="팀 랭킹"
                subtitle="스쿼드 누적 전적 기준"
                rows={payload.teams}
                empty="아직 팀 기록이 없습니다."
                renderRow={(row, index) => {
                  const href = userHref(row.owner);
                  const teamName = safeText(row.teamName || normalizeList(row.rosterNames).join(' / '), '이름 없는 팀');
                  const body = (
                    <>
                      <span className="leaderboard-rank">{rankMedal(index)}</span>
                      <div>
                        <strong>{teamName}</strong>
                        <small>{normalizeList(row.rosterNames).join(' · ') || safeText(row.ownerName, '익명')}</small>
                      </div>
                      <b>{formatNumber(row.totalWins)}승</b>
                    </>
                  );
                  return href ? <li key={`team-${row._id}`}><Link href={href}>{body}</Link></li> : <li key={`team-${index}`}><div>{body}</div></li>;
                }}
              />
            </div>
          </>
        ) : null}
      </section>
    </main>
  );
}
