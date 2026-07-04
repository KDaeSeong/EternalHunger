'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import SiteHeader from '../../../components/SiteHeader';
import { useToast } from '../../../components/ToastProvider';
import { apiDelete, apiGetCached, apiPost, clearApiGetCache } from '../../../utils/api';
import { useAuthUser, useHydrated } from '../../../utils/client-auth';
import { GAME_CATALOG, GAME_ROADMAP } from '../_lib/gameCatalog';

const RESULT_LABELS = {
  win: '승리',
  loss: '패배',
  draw: '무승부',
  clear: '클리어',
  fail: '실패',
  none: '기록',
};

function normalizeList(value) {
  return Array.isArray(value) ? value : [];
}

function cleanKey(value, fallback = '') {
  return String(value || fallback)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function getGameOptions() {
  const map = new Map();
  [...GAME_CATALOG, ...GAME_ROADMAP].forEach((game) => {
    if (!game?.slug) return;
    map.set(game.slug, { slug: game.slug, title: game.title || game.slug });
  });
  return Array.from(map.values());
}

function formatDateTime(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('ko-KR', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString('ko-KR');
}

function formatDuration(sec) {
  const total = Math.max(0, Math.floor(Number(sec || 0)));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  if (hours > 0) return `${hours}시간 ${minutes}분`;
  return `${minutes}분`;
}

function summarizeRecord(record) {
  const summary = record?.summary && typeof record.summary === 'object' ? record.summary : {};
  const rows = Object.entries(summary)
    .filter(([, value]) => value !== undefined && value !== null && String(value).trim() !== '')
    .slice(0, 4);
  return rows.length ? rows.map(([key, value]) => `${key}: ${String(value)}`).join(' · ') : '요약 없음';
}

function RecordMetric({ label, value }) {
  return (
    <div className="games-metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function GameRecordsContent() {
  const hydrated = useHydrated();
  const user = useAuthUser();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { showToast } = useToast();
  const gameOptions = useMemo(getGameOptions, []);
  const requestedGameSlug = cleanKey(searchParams.get('gameSlug'));
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [gameSlug, setGameSlug] = useState(requestedGameSlug);
  const [form, setForm] = useState({
    gameSlug: requestedGameSlug || 'dual-academy-tcg',
    title: '테스트 매치',
    mode: 'solo',
    result: 'win',
    score: '100',
    playTimeSec: '300',
    summaryText: JSON.stringify({ deck: 'sample', opponent: 'ai' }, null, 2),
    payloadText: JSON.stringify({ events: [] }, null, 2),
  });

  useEffect(() => {
    setGameSlug(requestedGameSlug);
    if (requestedGameSlug) {
      setForm((current) => ({ ...current, gameSlug: requestedGameSlug }));
    }
  }, [requestedGameSlug]);

  const loadRecords = useCallback(async (options = {}) => {
    if (!user) {
      setRecords([]);
      return;
    }
    setLoading(true);
    setMessage('');
    try {
      const params = new URLSearchParams();
      if (gameSlug) params.set('gameSlug', gameSlug);
      const endpoint = `/game-records${params.toString() ? `?${params.toString()}` : ''}`;
      const data = await apiGetCached(endpoint, {
        ttlMs: 15000,
        timeoutMs: 15000,
        storage: 'session',
        force: Boolean(options.force),
      });
      setRecords(normalizeList(data?.records));
    } catch (err) {
      const nextMessage = err?.message || '게임 기록을 불러오지 못했습니다.';
      setMessage(nextMessage);
      showToast({ tone: 'danger', message: nextMessage });
    } finally {
      setLoading(false);
    }
  }, [gameSlug, showToast, user]);

  useEffect(() => {
    if (hydrated) void loadRecords();
  }, [hydrated, loadRecords]);

  const createRecord = async (event) => {
    event.preventDefault();
    if (saving || !user) return;

    const gameSlug = cleanKey(form.gameSlug);
    if (!gameSlug) {
      const nextMessage = '게임을 선택해주세요.';
      setMessage(nextMessage);
      showToast({ tone: 'warning', message: nextMessage });
      return;
    }

    let summary = {};
    let payload = {};
    try {
      summary = form.summaryText.trim() ? JSON.parse(form.summaryText) : {};
      payload = form.payloadText.trim() ? JSON.parse(form.payloadText) : {};
    } catch {
      const nextMessage = '요약 또는 기록 데이터 JSON을 확인해주세요.';
      setMessage(nextMessage);
      showToast({ tone: 'warning', message: nextMessage });
      return;
    }

    setSaving(true);
    setMessage('');
    try {
      const res = await apiPost(`/game-records/${gameSlug}`, {
        title: form.title,
        mode: form.mode,
        result: form.result,
        score: Number(form.score || 0),
        playTimeSec: Number(form.playTimeSec || 0),
        summary,
        payload,
      }, { timeoutMs: 20000 });
      clearApiGetCache('/game-records');
      const nextMessage = res?.message || '게임 기록을 저장했습니다.';
      setMessage(nextMessage);
      showToast({ tone: 'success', message: nextMessage });
      void loadRecords({ force: true });
    } catch (err) {
      const nextMessage = err?.message || '게임 기록 저장에 실패했습니다.';
      setMessage(nextMessage);
      showToast({ tone: 'danger', message: nextMessage });
    } finally {
      setSaving(false);
    }
  };

  const deleteRecord = async (record) => {
    if (!record?.id) return;
    const ok = window.confirm(`"${record.title || record.gameSlug}" 기록을 삭제하시겠습니까?`);
    if (!ok) return;

    try {
      const res = await apiDelete(`/game-records/${record.id}`, { timeoutMs: 15000 });
      clearApiGetCache('/game-records');
      const nextMessage = res?.message || '게임 기록을 삭제했습니다.';
      setMessage(nextMessage);
      showToast({ tone: 'success', message: nextMessage });
      void loadRecords({ force: true });
    } catch (err) {
      const nextMessage = err?.message || '게임 기록 삭제에 실패했습니다.';
      setMessage(nextMessage);
      showToast({ tone: 'danger', message: nextMessage });
    }
  };

  const gameTitleBySlug = useMemo(() => {
    const map = new Map();
    gameOptions.forEach((game) => map.set(game.slug, game.title));
    return map;
  }, [gameOptions]);
  const selectedGameTitle = gameSlug ? gameTitleBySlug.get(gameSlug) || gameSlug : '전체 게임';
  const recordStats = useMemo(() => {
    const total = records.length;
    const wins = records.filter((record) => ['win', 'clear'].includes(record.result)).length;
    const bestScore = records.reduce((best, record) => Math.max(best, Number(record.score || 0)), 0);
    const totalPlayTimeSec = records.reduce((sum, record) => sum + Number(record.playTimeSec || 0), 0);
    return { total, wins, bestScore, totalPlayTimeSec };
  }, [records]);

  const updateGameFilter = (nextValue) => {
    const nextGameSlug = cleanKey(nextValue);
    setGameSlug(nextGameSlug);
    const href = nextGameSlug ? `/games/records?gameSlug=${encodeURIComponent(nextGameSlug)}` : '/games/records';
    router.push(href);
  };

  return (
    <main className="games-page-shell">
      <SiteHeader />
      <section className="games-page game-records-page">
        <section className="games-hero">
          <div>
            <p className="games-kicker">Records</p>
            <h1>게임 기록</h1>
            <p>이식 게임들이 공통으로 남길 플레이 결과입니다.</p>
          </div>
          <div className="games-hero-actions">
            <button type="button" onClick={() => void loadRecords({ force: true })} disabled={loading || !user}>
              {loading ? '갱신 중...' : '새로고침'}
            </button>
            <Link href="/games">게임 허브</Link>
          </div>
        </section>

        {!hydrated ? (
          <div className="games-empty">계정 정보를 확인하는 중입니다.</div>
        ) : !user ? (
          <div className="games-empty">
            <span>로그인이 필요합니다.</span>
            <Link href="/login">로그인</Link>
          </div>
        ) : (
          <>
            <section className="game-room-toolbar" aria-label="게임 기록 필터">
              <select value={gameSlug} onChange={(event) => updateGameFilter(event.target.value)}>
                <option value="">전체 게임</option>
                {gameOptions.map((game) => <option value={game.slug} key={game.slug}>{game.title}</option>)}
              </select>
              {gameSlug ? <Link href={`/games/${gameSlug}`}>게임 상세</Link> : <Link href="/games">게임 허브</Link>}
              <Link href={`/games/rooms${gameSlug ? `?gameSlug=${gameSlug}` : ''}`}>게임방</Link>
            </section>

            <section className="games-summary" aria-label="게임 기록 요약">
              <RecordMetric label="범위" value={selectedGameTitle} />
              <RecordMetric label="기록" value={`${formatNumber(recordStats.total)}건`} />
              <RecordMetric label="승리/클리어" value={`${formatNumber(recordStats.wins)}건`} />
              <RecordMetric label="최고 점수" value={formatNumber(recordStats.bestScore)} />
              <RecordMetric label="플레이 시간" value={formatDuration(recordStats.totalPlayTimeSec)} />
            </section>

            <section className="games-dashboard game-saves-dashboard">
            <form className="games-panel game-save-editor" onSubmit={createRecord}>
              <div className="games-panel-title">
                <h2>기록 저장</h2>
              </div>
              <div className="game-save-form-grid">
                <label>
                  <span>게임</span>
                  <select
                    value={form.gameSlug}
                    disabled={saving}
                    onChange={(event) => setForm({ ...form, gameSlug: event.target.value })}
                  >
                    {gameOptions.map((game) => <option value={game.slug} key={game.slug}>{game.title}</option>)}
                  </select>
                </label>
                <label>
                  <span>제목</span>
                  <input
                    value={form.title}
                    maxLength={120}
                    disabled={saving}
                    onChange={(event) => setForm({ ...form, title: event.target.value })}
                  />
                </label>
                <label>
                  <span>모드</span>
                  <input
                    value={form.mode}
                    maxLength={80}
                    disabled={saving}
                    onChange={(event) => setForm({ ...form, mode: event.target.value })}
                  />
                </label>
                <label>
                  <span>결과</span>
                  <select
                    value={form.result}
                    disabled={saving}
                    onChange={(event) => setForm({ ...form, result: event.target.value })}
                  >
                    {Object.entries(RESULT_LABELS).map(([value, label]) => (
                      <option value={value} key={value}>{label}</option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>점수</span>
                  <input
                    type="number"
                    value={form.score}
                    disabled={saving}
                    onChange={(event) => setForm({ ...form, score: event.target.value })}
                  />
                </label>
                <label>
                  <span>플레이 시간(초)</span>
                  <input
                    type="number"
                    min="0"
                    value={form.playTimeSec}
                    disabled={saving}
                    onChange={(event) => setForm({ ...form, playTimeSec: event.target.value })}
                  />
                </label>
              </div>
              <label className="game-save-json-field">
                <span>요약 JSON</span>
                <textarea
                  value={form.summaryText}
                  rows={5}
                  disabled={saving}
                  onChange={(event) => setForm({ ...form, summaryText: event.target.value })}
                />
              </label>
              <label className="game-save-json-field">
                <span>기록 데이터 JSON</span>
                <textarea
                  value={form.payloadText}
                  rows={8}
                  disabled={saving}
                  onChange={(event) => setForm({ ...form, payloadText: event.target.value })}
                />
              </label>
              {message ? <div className="account-message">{message}</div> : null}
              <div className="account-actions">
                <button type="submit" disabled={saving}>{saving ? '저장 중...' : '저장'}</button>
              </div>
            </form>

            <section className="games-panel">
              <div className="games-panel-title">
                <h2>최근 기록</h2>
              </div>
              {records.length ? (
                <div className="game-save-list">
                  {records.map((record) => (
                    <article className="game-save-row" key={record.id || `${record.gameSlug}-${record.playedAt}`}>
                      <div>
                        <span>{gameTitleBySlug.get(record.gameSlug) || record.gameSlug}</span>
                        <strong>{record.title || '플레이 기록'}</strong>
                        <small>{RESULT_LABELS[record.result] || record.result} · {formatNumber(record.score)}점 · {formatDateTime(record.playedAt)}</small>
                        <p>{record.mode || '모드 없음'} · {summarizeRecord(record)}</p>
                      </div>
                      <button type="button" onClick={() => void deleteRecord(record)}>삭제</button>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="games-empty">{loading ? '게임 기록을 불러오는 중입니다.' : '게임 기록이 없습니다.'}</div>
              )}
            </section>
          </section>
          </>
        )}
      </section>
    </main>
  );
}

export default function GameRecordsPage() {
  return (
    <Suspense fallback={(
      <main className="games-page-shell">
        <SiteHeader />
        <section className="games-page game-records-page">
          <div className="games-empty">게임 기록을 불러오는 중입니다.</div>
        </section>
      </main>
    )}>
      <GameRecordsContent />
    </Suspense>
  );
}
