'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { apiGet, apiPut, apiPost, captureAuthSession, clearApiGetCache, isCurrentAuthSession } from '../../../../utils/api';
import { GAME_SLUG, SAVE_VERSION, QUICK_SAVE_SLOT } from '../_lib/autochessData.js';
import { createNewState, advancePlayback, setPaused, scoreState, summaryForState } from '../_lib/autochessEngine.js';
import { restoreState, serializeState } from '../_lib/autochessSave.js';
import { localSaveKey, readLocalRun, writeLocalRun } from '../_lib/autochessStorage.js';

export default function useAutochessSession({ owner, hydrated, token, speed }) {
  const [state, setState] = useState(() => createNewState({ now: 0, seed: 1, runId: 'pending' }));
  const [readyOwner, setReadyOwner] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState('');
  const [halted, setHalted] = useState(false);
  const [recorded, setRecorded] = useState(false);
  const latest = useRef(state), activeOwner = useRef(''), busyRef = useRef(''), blocked = useRef(false), dirty = useRef(false), operation = useRef(0);
  const replace = useCallback(value => {
    const before = latest.current, next = typeof value === 'function' ? value(before) : value;
    if (before !== next) { latest.current = next; dirty.current = true; setState(next); }
    return next;
  }, []);
  const apply = useCallback(fn => {
    const before = latest.current, next = replace(fn);
    if (next.nextLogId !== before.nextLogId) setMessage(next.log[0].text);
    else if (next.paused !== before.paused) setMessage(next.paused ? '전투 재생을 일시정지했습니다.' : '전투 재생을 재개했습니다.');
    return next;
  }, [replace]);
  const act = useCallback(fn => {
    if (!activeOwner.current || busyRef.current || blocked.current) return;
    apply(fn);
  }, [apply]);
  const invalidateRequests = useCallback(() => { operation.current++; busyRef.current = ''; }, []);
  const ready = hydrated && Boolean(owner) && readyOwner === owner;

  useEffect(() => {
    if (!hydrated || !owner) return;
    let cancelled = false;
    activeOwner.current = owner; blocked.current = false;
    const initialize = async () => {
      try {
        const restored = await Promise.resolve().then(() => readLocalRun(window.localStorage, owner));
        if (cancelled) return;
        const next = restored || createNewState();
        replace(next); setReadyOwner(owner); setHalted(false); setBusy('');
        setRecorded(window.localStorage.getItem(localSaveKey(owner) + ':recorded') === next.runId);
        setMessage(restored ? '대전을 복원했습니다. 진행 중 전투는 일시정지 상태입니다.' : '상점에서 학생을 구매하고 자동 편성 또는 직접 배치 후 전투를 시작하세요.');
      } catch {
        if (cancelled) return;
        blocked.current = true; setHalted(true); setReadyOwner(owner); setBusy('');
        replace(createNewState());
        setMessage('저장 자료를 읽지 못해 원문을 보존했습니다. 이전 대전 복구 또는 JSON 가져오기를 사용할 수 있습니다.');
      }
    };
    void initialize();
    return () => {
      cancelled = true; invalidateRequests();
      if (activeOwner.current === owner) {
        if (dirty.current && !blocked.current) {
          try { writeLocalRun(window.localStorage, owner, latest.current); } catch { /* Retain the previous checkpoint. */ }
        }
        activeOwner.current = '';
      }
    };
  }, [hydrated, owner, replace, invalidateRequests]);

  useEffect(() => {
    if (!ready) return;
    const flush = () => {
      if (activeOwner.current !== owner || blocked.current || !dirty.current) return;
      try { writeLocalRun(window.localStorage, owner, latest.current); dirty.current = false; }
      catch { blocked.current = true; setHalted(true); replace(s => setPaused(s, true)); setMessage('기기 저장을 완료하지 못해 진행을 멈췄습니다. JSON 내보내기로 대전을 보관하세요.'); }
    };
    const visibility = () => { if (document.hidden) { replace(s => setPaused(s, true)); flush(); } };
    const storage = event => {
      if (event.key === localSaveKey(owner) && event.newValue) {
        blocked.current = true; setHalted(true); replace(s => setPaused(s, true));
        setMessage('다른 탭에서 같은 저장이 변경되어 진행을 멈췄습니다. 현재 대전을 내보낸 뒤 새로고침해 주세요.');
      }
    };
    const timer = window.setInterval(flush, 5000);
    document.addEventListener('visibilitychange', visibility); window.addEventListener('pagehide', flush); window.addEventListener('storage', storage);
    return () => { window.clearInterval(timer); document.removeEventListener('visibilitychange', visibility); window.removeEventListener('pagehide', flush); window.removeEventListener('storage', storage); };
  }, [ready, owner, replace]);

  useEffect(() => {
    if (!ready || state.phase !== 'battle') return;
    const timer = window.setInterval(() => {
      if (!document.hidden && !busyRef.current && !blocked.current && !latest.current.paused) apply(advancePlayback);
    }, 400 / speed);
    return () => window.clearInterval(timer);
  }, [ready, state.phase, speed, apply]);

  const replaceProtected = next => {
    if (!activeOwner.current) return false;
    try {
      if (!blocked.current) writeLocalRun(window.localStorage, activeOwner.current, latest.current);
      writeLocalRun(window.localStorage, activeOwner.current, next, true);
      replace(next); blocked.current = false; dirty.current = false; setHalted(false);
      setRecorded(window.localStorage.getItem(localSaveKey(activeOwner.current) + ':recorded') === next.runId);
      return true;
    } catch { setMessage('현재 대전을 보호하지 못해 교체를 중단했습니다. JSON으로 먼저 보관하세요.'); return false; }
  };
  const newMatch = () => { if (!busyRef.current && replaceProtected(createNewState())) setMessage('새 대전을 시작했습니다. 직전 대전은 이전 대전 복구로 되돌릴 수 있습니다.'); };
  const recover = () => {
    if (!activeOwner.current || busyRef.current) return;
    try {
      const previous = readLocalRun(window.localStorage, activeOwner.current, true);
      if (!previous) { setMessage('복구할 이전 대전이 없습니다.'); return; }
      if (replaceProtected(previous)) setMessage('이전 대전을 복구했습니다.');
    } catch { setMessage('복구본 형식이 맞지 않습니다. 현재 대전과 원문을 유지합니다.'); }
  };
  const exportRun = () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(serializeState(latest.current))], { type: 'application/json' }));
    const a = document.createElement('a'); a.href = url; a.download = 'kivotos-autochess-' + latest.current.runId + '.json'; a.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000); setMessage('현재 대전을 JSON으로 내보냈습니다.');
  };
  const importRun = async file => {
    if (!file || busyRef.current || !activeOwner.current) return;
    if (file.size > 512 * 1024) { setMessage('512KB 이하의 대전 파일만 가져올 수 있습니다.'); return; }
    const who = activeOwner.current, ticket = ++operation.current;
    busyRef.current = 'import'; setBusy('import'); replace(s => setPaused(s, true));
    try {
      const text = await file.text();
      if (activeOwner.current !== who || operation.current !== ticket) return;
      if (replaceProtected(restoreState(JSON.parse(text)))) setMessage('대전을 가져왔습니다. 직전 진행은 복구본으로 보관했습니다.');
    } catch { if (activeOwner.current === who && operation.current === ticket) setMessage('대전 파일의 형식이나 버전이 맞지 않습니다. 현재 진행은 유지됩니다.'); }
    finally { if (operation.current === ticket) { busyRef.current = ''; setBusy(''); } }
  };
  const serverAction = async kind => {
    if (!token) { setMessage('로그인하면 계정 저장과 전적을 사용할 수 있습니다. 기기 자동 저장은 계속됩니다.'); return; }
    if (!activeOwner.current || busyRef.current) return;
    if (kind === 'record' && latest.current.phase !== 'finished') { setMessage('최종 순위가 확정된 뒤 전적을 기록할 수 있습니다.'); return; }
    if (kind === 'record' && recorded) { setMessage('이 대전은 이미 전적에 기록했습니다.'); return; }
    const who = activeOwner.current, ticket = ++operation.current, session = captureAuthSession();
    const current = () => activeOwner.current === who && operation.current === ticket && isCurrentAuthSession(session);
    busyRef.current = kind; setBusy(kind); replace(s => setPaused(s, true));
    const snapshot = serializeState(latest.current);
    try {
      if (kind === 'save') {
        await apiPut('/game-saves/' + GAME_SLUG + '/' + QUICK_SAVE_SLOT, {
          saveName: '키보토스 오토체스 · ' + snapshot.round + '라운드', version: SAVE_VERSION, summary: summaryForState(snapshot), payload: { state: snapshot }, lastPlayedAt: new Date().toISOString(),
        }, { timeoutMs: 15000 });
        if (!current()) return;
        clearApiGetCache('/game-saves'); setMessage('계정 전용 슬롯에 대전을 저장했습니다.');
      } else if (kind === 'load') {
        const list = await apiGet('/game-saves?gameSlug=' + GAME_SLUG, { timeoutMs: 12000 });
        if (!current()) return;
        const slot = list?.saves?.find(s => s.slotKey === QUICK_SAVE_SLOT);
        if (!slot?.id) { setMessage('계정에 저장된 키보토스 오토체스 대전이 없습니다.'); return; }
        const detail = await apiGet('/game-saves/' + slot.id, { timeoutMs: 12000 });
        if (!current()) return;
        if (detail?.save?.version !== SAVE_VERSION) throw new Error('저장 버전이 맞지 않습니다.');
        if (replaceProtected(restoreState(detail.save.payload.state))) setMessage('계정 대전을 불러왔습니다. 직전 진행은 복구본으로 보관했습니다.');
      } else if (kind === 'record') {
        const rank = snapshot.players.find(p => p.id === 'p0').rank;
        await apiPost('/game-records/' + GAME_SLUG, { title: '키보토스 오토체스 · ' + rank + '위', mode: 'auto-battler', result: rank === 1 ? 'win' : 'loss',
          score: scoreState(snapshot), playTimeSec: Math.max(0, Math.floor((Date.now() - snapshot.createdAt) / 1000)), summary: summaryForState(snapshot), payload: { state: snapshot } }, { timeoutMs: 15000 });
        if (!current()) return;
        setRecorded(true); window.localStorage.setItem(localSaveKey(who) + ':recorded', snapshot.runId); clearApiGetCache('/game-records');
        setMessage('최종 순위를 전적에 기록했습니다.');
      }
    } catch (error) { if (current()) setMessage(error?.isAuthError ? '로그인이 만료되었습니다. 대전은 유지됩니다. 다시 로그인한 뒤 저장할 수 있습니다.' : error?.message || '연결을 완료하지 못했습니다. 현재 대전은 유지됩니다.'); }
    finally { if (operation.current === ticket) { busyRef.current = ''; setBusy(''); } }
  };
  return { state, ready, message, busy, halted, recorded, act, newMatch, recover, exportRun, importRun, serverAction };
}
