'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import SiteHeader from '../../../components/SiteHeader';
import { useToast } from '../../../components/ToastProvider';
import { apiDelete, apiGet, apiGetCached, apiPut, clearApiGetCache } from '../../../utils/api';
import { useAuthUser, useHydrated } from '../../../utils/client-auth';
import { GAME_CATALOG, GAME_ROADMAP } from '../_lib/gameCatalog';

const DEFAULT_PAYLOAD = JSON.stringify({
  createdFrom: 'games-save-manager',
  state: {},
}, null, 2);

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

function formatBytes(value) {
  const bytes = Number(value || 0);
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  if (bytes >= 1024 * 1024) return `${Math.round((bytes / 1024 / 1024) * 10) / 10} MB`;
  if (bytes >= 1024) return `${Math.round((bytes / 1024) * 10) / 10} KB`;
  return `${Math.floor(bytes)} B`;
}

function getGameOptions() {
  const map = new Map();
  [...GAME_CATALOG, ...GAME_ROADMAP].forEach((game) => {
    if (!game?.slug) return;
    map.set(game.slug, {
      slug: game.slug,
      title: game.title || game.slug,
      subtitle: game.subtitle || '',
    });
  });
  return Array.from(map.values());
}

function summarizeSave(save) {
  const summary = save?.summary && typeof save.summary === 'object' ? save.summary : {};
  const rows = Object.entries(summary)
    .filter(([, value]) => value !== undefined && value !== null && String(value).trim() !== '')
    .slice(0, 4);
  return rows.length ? rows.map(([key, value]) => `${key}: ${String(value)}`).join(' · ') : '요약 없음';
}

function saveRoomHref(save) {
  const summary = save?.summary && typeof save.summary === 'object' ? save.summary : {};
  const roomId = String(summary.roomId || '').trim();
  return summary.source === 'game-room' && roomId ? `/games/rooms/${roomId}` : '';
}

function SaveMetric({ label, value }) {
  return (
    <div className="games-metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function GameSavesContent() {
  const hydrated = useHydrated();
  const user = useAuthUser();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { showToast } = useToast();
  const gameOptions = useMemo(getGameOptions, []);
  const requestedGameSlug = cleanKey(searchParams.get('gameSlug'));
  const [saves, setSaves] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [gameSlug, setGameSlug] = useState(requestedGameSlug);
  const [form, setForm] = useState({
    gameSlug: requestedGameSlug || 'dual-academy-tcg',
    slotKey: 'slot-1',
    saveName: '기본 슬롯',
    version: '1',
    summaryText: JSON.stringify({ progress: 'new' }, null, 2),
    payloadText: DEFAULT_PAYLOAD,
  });

  useEffect(() => {
    setGameSlug(requestedGameSlug);
    if (requestedGameSlug) {
      setForm((current) => ({ ...current, gameSlug: requestedGameSlug }));
    }
  }, [requestedGameSlug]);

  const loadSaves = useCallback(async (options = {}) => {
    if (!user) {
      setSaves([]);
      return;
    }
    setLoading(true);
    setMessage('');
    try {
      const params = new URLSearchParams();
      if (gameSlug) params.set('gameSlug', gameSlug);
      const endpoint = `/game-saves${params.toString() ? `?${params.toString()}` : ''}`;
      const data = await apiGetCached(endpoint, {
        ttlMs: 15000,
        timeoutMs: 15000,
        storage: 'session',
        force: Boolean(options.force),
      });
      setSaves(normalizeList(data?.saves));
    } catch (err) {
      const nextMessage = err?.message || '저장 슬롯을 불러오지 못했습니다.';
      setMessage(nextMessage);
      showToast({ tone: 'danger', message: nextMessage });
    } finally {
      setLoading(false);
    }
  }, [gameSlug, showToast, user]);

  useEffect(() => {
    if (hydrated) void loadSaves();
  }, [hydrated, loadSaves]);

  const saveSlot = async (event) => {
    event.preventDefault();
    if (saving || !user) return;

    const gameSlug = cleanKey(form.gameSlug);
    const slotKey = cleanKey(form.slotKey, 'slot-1');
    if (!gameSlug || !slotKey) {
      const nextMessage = '게임과 슬롯 키를 입력해주세요.';
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
      const nextMessage = '요약 또는 저장 데이터 JSON을 확인해주세요.';
      setMessage(nextMessage);
      showToast({ tone: 'warning', message: nextMessage });
      return;
    }

    setSaving(true);
    setMessage('');
    try {
      const res = await apiPut(`/game-saves/${gameSlug}/${slotKey}`, {
        saveName: form.saveName,
        version: form.version,
        summary,
        payload,
      }, { timeoutMs: 20000 });
      clearApiGetCache('/game-saves');
      const nextMessage = res?.message || '저장 슬롯을 저장했습니다.';
      setMessage(nextMessage);
      showToast({ tone: 'success', message: nextMessage });
      void loadSaves({ force: true });
    } catch (err) {
      const nextMessage = err?.message || '저장 슬롯 저장에 실패했습니다.';
      setMessage(nextMessage);
      showToast({ tone: 'danger', message: nextMessage });
    } finally {
      setSaving(false);
    }
  };

  const deleteSlot = async (save) => {
    if (!save?.id) return;
    const ok = window.confirm(`"${save.saveName || save.slotKey}" 저장 슬롯을 삭제하시겠습니까?`);
    if (!ok) return;

    try {
      const res = await apiDelete(`/game-saves/${save.id}`, { timeoutMs: 15000 });
      clearApiGetCache('/game-saves');
      const nextMessage = res?.message || '저장 슬롯을 삭제했습니다.';
      setMessage(nextMessage);
      showToast({ tone: 'success', message: nextMessage });
      void loadSaves({ force: true });
    } catch (err) {
      const nextMessage = err?.message || '저장 슬롯 삭제에 실패했습니다.';
      setMessage(nextMessage);
      showToast({ tone: 'danger', message: nextMessage });
    }
  };

  const loadSlotIntoForm = async (save) => {
    if (!save?.id || saving) return;
    setSaving(true);
    setMessage('');
    try {
      const data = await apiGet(`/game-saves/${save.id}`, { timeoutMs: 15000 });
      const detail = data?.save || save;
      setForm({
        gameSlug: cleanKey(detail.gameSlug),
        slotKey: cleanKey(detail.slotKey, 'slot-1'),
        saveName: detail.saveName || '저장 슬롯',
        version: detail.version || '',
        summaryText: JSON.stringify(detail.summary || {}, null, 2),
        payloadText: JSON.stringify(detail.payload || {}, null, 2),
      });
      const nextMessage = '저장 슬롯을 편집 폼으로 불러왔습니다.';
      setMessage(nextMessage);
      showToast({ tone: 'success', message: nextMessage });
    } catch (err) {
      const nextMessage = err?.message || '저장 슬롯을 불러오지 못했습니다.';
      setMessage(nextMessage);
      showToast({ tone: 'danger', message: nextMessage });
    } finally {
      setSaving(false);
    }
  };

  const gameTitleBySlug = useMemo(() => {
    const map = new Map();
    gameOptions.forEach((game) => map.set(game.slug, game.title));
    return map;
  }, [gameOptions]);
  const selectedGameTitle = gameSlug ? gameTitleBySlug.get(gameSlug) || gameSlug : '전체 게임';
  const saveStats = useMemo(() => {
    const total = saves.length;
    const totalBytes = saves.reduce((sum, save) => sum + Number(save.payloadBytes || 0), 0);
    const latest = saves.reduce((best, save) => {
      const time = new Date(save.updatedAt || save.createdAt || 0).getTime();
      return Number.isFinite(time) && time > best ? time : best;
    }, 0);
    return { total, totalBytes, latest };
  }, [saves]);

  const updateGameFilter = (nextValue) => {
    const nextGameSlug = cleanKey(nextValue);
    setGameSlug(nextGameSlug);
    const href = nextGameSlug ? `/games/saves?gameSlug=${encodeURIComponent(nextGameSlug)}` : '/games/saves';
    router.push(href);
  };

  return (
    <main className="games-page-shell">
      <SiteHeader />
      <section className="games-page game-saves-page">
        <section className="games-hero game-saves-hero">
          <div>
            <p className="games-kicker">Saves</p>
            <h1>게임 저장 슬롯</h1>
            <p>이식 게임들이 공통으로 사용할 계정 저장 슬롯입니다.</p>
          </div>
          <div className="games-hero-actions">
            <button type="button" onClick={() => void loadSaves({ force: true })} disabled={loading || !user}>
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
            <section className="game-room-toolbar" aria-label="게임 저장 슬롯 필터">
              <select value={gameSlug} onChange={(event) => updateGameFilter(event.target.value)}>
                <option value="">전체 게임</option>
                {gameOptions.map((game) => <option value={game.slug} key={game.slug}>{game.title}</option>)}
              </select>
              {gameSlug ? <Link href={`/games/${gameSlug}`}>게임 상세</Link> : <Link href="/games">게임 허브</Link>}
              <Link href={`/games/rooms${gameSlug ? `?gameSlug=${gameSlug}` : ''}`}>게임방</Link>
              <Link href={`/games/records${gameSlug ? `?gameSlug=${gameSlug}` : ''}`}>전적</Link>
            </section>

            <section className="games-summary" aria-label="게임 저장 슬롯 요약">
              <SaveMetric label="범위" value={selectedGameTitle} />
              <SaveMetric label="저장 슬롯" value={`${Number(saveStats.total || 0).toLocaleString('ko-KR')}개`} />
              <SaveMetric label="데이터" value={formatBytes(saveStats.totalBytes)} />
              <SaveMetric label="최신 갱신" value={saveStats.latest ? formatDateTime(saveStats.latest) : '-'} />
            </section>

            <section className="games-dashboard game-saves-dashboard">
              <form className="games-panel game-save-editor" onSubmit={saveSlot}>
                <div className="games-panel-title">
                  <h2>슬롯 저장</h2>
                </div>
                <div className="game-save-form-grid">
                  <label>
                    <span>게임</span>
                    <select
                      value={form.gameSlug}
                      disabled={saving}
                      onChange={(event) => setForm({ ...form, gameSlug: event.target.value })}
                    >
                      {gameOptions.map((game) => (
                        <option value={game.slug} key={game.slug}>{game.title}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span>슬롯 키</span>
                    <input
                      value={form.slotKey}
                      disabled={saving}
                      onChange={(event) => setForm({ ...form, slotKey: cleanKey(event.target.value) })}
                    />
                  </label>
                  <label>
                    <span>저장 이름</span>
                    <input
                      value={form.saveName}
                      maxLength={80}
                      disabled={saving}
                      onChange={(event) => setForm({ ...form, saveName: event.target.value })}
                    />
                  </label>
                  <label>
                    <span>버전</span>
                    <input
                      value={form.version}
                      maxLength={40}
                      disabled={saving}
                      onChange={(event) => setForm({ ...form, version: event.target.value })}
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
                  <span>저장 데이터 JSON</span>
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
                  <h2>최근 슬롯</h2>
                </div>
                {saves.length ? (
                  <div className="game-save-list">
                    {saves.map((save) => (
                      <article className="game-save-row" key={save.id || `${save.gameSlug}-${save.slotKey}`}>
                        <div>
                          <span>{gameTitleBySlug.get(save.gameSlug) || save.gameSlug}</span>
                          <strong>{save.saveName || save.slotKey}</strong>
                          <small>{save.slotKey} · {formatBytes(save.payloadBytes)} · {formatDateTime(save.updatedAt)}</small>
                          <p>{summarizeSave(save)}</p>
                        </div>
                        <div className="game-save-row-actions">
                          <button type="button" onClick={() => void loadSlotIntoForm(save)} disabled={saving}>불러오기</button>
                          {saveRoomHref(save) ? <Link href={saveRoomHref(save)}>방 열기</Link> : null}
                          <button type="button" className="is-danger" onClick={() => void deleteSlot(save)}>삭제</button>
                        </div>
                      </article>
                    ))}
                  </div>
                ) : (
                  <div className="games-empty">{loading ? '저장 슬롯을 불러오는 중입니다.' : '저장 슬롯이 없습니다.'}</div>
                )}
              </section>
            </section>
          </>
        )}
      </section>
    </main>
  );
}

export default function GameSavesPage() {
  return (
    <Suspense fallback={(
      <main className="games-page-shell">
        <SiteHeader />
        <section className="games-page game-saves-page">
          <div className="games-empty">게임 저장 슬롯을 불러오는 중입니다.</div>
        </section>
      </main>
    )}>
      <GameSavesContent />
    </Suspense>
  );
}
