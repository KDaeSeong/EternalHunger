'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { apiGet, apiPost, apiPut, captureAuthSession, clearApiGetCache, isCurrentAuthSession } from '../../../../utils/api';
import { GAME_SLUG, QUICK_SAVE_SLOT, SAVE_VERSION } from '../_lib/infiniteDefenseData.js';
import { advanceTime, createNewState, restoreState, scoreState, serializeState, setPaused, summaryForState } from '../_lib/infiniteDefenseEngine.js';
import { localSaveKey, readLocalRun, writeLocalRun } from '../_lib/infiniteDefenseStorage.js';

export default function useInfiniteDefenseSession({ owner, hydrated, token, speed, autoWave, startWave }) {
  const [state, setState] = useState(() => createNewState({ now: 0, runId: 'pending' }));
  const [readyOwner, setReadyOwner] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState('');
  const [recorded, setRecorded] = useState(false);
  const latestRef = useRef(state);
  const ownerRef = useRef('');
  const busyRef = useRef('');
  const operationRef = useRef(0);
  const storageBlockedRef = useRef(false);
  const recordedRef = useRef(false);
  const intermissionRef = useRef(0);
  const replace = useCallback((value) => {
    const next = typeof value === 'function' ? value(latestRef.current) : value;
    latestRef.current = next;
    setState(next);
    return next;
  }, []);
  const act = useCallback((fn) => {
    if (!ownerRef.current || busyRef.current || storageBlockedRef.current) return;
    const before = latestRef.current;
    const after = replace(fn);
    if (after.logId !== before.logId) setMessage(after.log[0].text);
    else if (after.paused !== before.paused) setMessage(after.paused ? '작전을 일시정지했습니다.' : '전투와 채굴을 재개했습니다.');
  }, [replace]);

  const cancelRequests = useCallback(() => { operationRef.current++; }, []);

  useEffect(() => {
    if (!hydrated || !owner) return;
    let cancelled = false;
    ownerRef.current = owner;
    storageBlockedRef.current = false;
    const initialize = async () => {
      try {
        const loaded = await Promise.resolve().then(() => readLocalRun(window.localStorage, owner));
        if (cancelled) return;
        const next = loaded || createNewState();
        replace(next);
        recordedRef.current = window.localStorage.getItem(localSaveKey(owner) + ':recorded') === next.runId;
        setRecorded(recordedRef.current);
        setReadyOwner(owner);
        setBusy('');
        setMessage(loaded ? '기기에 저장된 작전을 복원했습니다. 진행 중 전투는 일시정지 상태입니다.' : '시로코를 1번 거점에, 노아를 채굴장에 배치해 보세요.');
      } catch {
        if (cancelled) return;
        storageBlockedRef.current = true;
        replace(createNewState());
        setReadyOwner(owner);
        setMessage('기기 저장소를 읽지 못했습니다. 기존 자료는 보존했습니다. 이전 작전 복구 또는 JSON 가져오기로 복원할 수 있습니다.');
      }
    };
    void initialize();
    return () => {
      cancelled = true;
      cancelRequests();
      if (ownerRef.current === owner) {
        if (!storageBlockedRef.current && !document.hidden) {
          try {
        const checkpoint = document.hidden && hiddenCheckpoint ? hiddenCheckpoint : null;
        writeLocalRun(window.localStorage, owner, checkpoint || latestRef.current, checkpoint ? checkpoint.savedAt : Date.now());
      } catch { /* Keep the previous checkpoint on storage failure. */ }
        }
        ownerRef.current = '';
        busyRef.current = '';
      }
    };
  }, [hydrated, owner, replace, cancelRequests]);

  const ready = hydrated && Boolean(owner) && readyOwner === owner;
  useEffect(() => {
    if (!ready) return;
    let last = performance.now(), remainder = 0;
    const timer = window.setInterval(() => {
      const now = performance.now();
      const delta = Math.min(0.4, Math.max(0, (now - last) / 1000));
      last = now;
      if (document.hidden || busyRef.current || storageBlockedRef.current || latestRef.current.paused || latestRef.current.phase === 'defeat') return;
      if (autoWave && latestRef.current.phase === 'intermission') {
        intermissionRef.current += delta;
        if (intermissionRef.current >= 4) {
          intermissionRef.current = 0;
          const started = replace(startWave);
          setMessage(started.log[0].text);
        }
      } else intermissionRef.current = 0;
      remainder += delta * speed;
      const seconds = Math.floor(remainder * 10 + 1e-6) / 10;
      if (seconds >= 0.1) {
        remainder -= seconds;
        const before = latestRef.current;
        const after = replace(current => advanceTime(current, seconds));
        if (after.logId !== before.logId) setMessage(after.log[0].text);
      }
    }, 100);
    return () => window.clearInterval(timer);
  }, [ready, speed, autoWave, replace, startWave]);

  useEffect(() => {
    if (!ready) return;
    let hiddenCheckpoint = null;
    const persist = () => {
      if (ownerRef.current !== owner || storageBlockedRef.current) return;
      try { writeLocalRun(window.localStorage, owner, latestRef.current); }
      catch {
        storageBlockedRef.current = true;
        replace(current => setPaused(current, true));
        setMessage('자동 저장을 완료하지 못해 진행을 멈췄습니다. JSON 내보내기로 현재 작전을 보관하세요.');
      }
    };
    const onVisibility = () => {
      if (document.hidden) {
        replace(current => setPaused(current, true));
        hiddenCheckpoint = serializeState(latestRef.current);
        persist();
      } else if (hiddenCheckpoint && hiddenCheckpoint.runId === latestRef.current.runId) {
        replace(restoreState(hiddenCheckpoint));
        hiddenCheckpoint = null;
        persist();
      }
    };
    const onStorage = event => {
      if (event.key === localSaveKey(owner) && event.newValue) {
        storageBlockedRef.current = true;
        replace(current => setPaused(current, true));
        setMessage('다른 탭에서 같은 작전이 변경되어 자동 저장을 멈췄습니다. 현재 작전을 내보낸 뒤 새로고침해 주세요.');
      }
    };
    const timer = window.setInterval(persist, 5000);
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', persist);
    window.addEventListener('storage', onStorage);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', persist);
      window.removeEventListener('storage', onStorage);
    };
  }, [ready, owner, replace]);

  const replaceProtected = useCallback(next => {
    const activeOwner = ownerRef.current;
    if (!activeOwner) return false;
    try {
      if (!storageBlockedRef.current) writeLocalRun(window.localStorage, activeOwner, latestRef.current);
      writeLocalRun(window.localStorage, activeOwner, next, Date.now(), true);
      replace(next);
      storageBlockedRef.current = false;
      recordedRef.current = window.localStorage.getItem(localSaveKey(activeOwner) + ':recorded') === next.runId;
      setRecorded(recordedRef.current);
      return true;
    } catch {
      setMessage('현재 작전을 보호하지 못해 교체를 중단했습니다. JSON 내보내기로 먼저 보관하세요.');
      return false;
    }
  }, [replace]);

  const newRun = () => {
    if (!busyRef.current && replaceProtected(createNewState())) setMessage('새 작전을 시작했습니다. 직전 작전은 이전 작전 복구로 되돌릴 수 있습니다.');
  };
  const recover = () => {
    if (busyRef.current || !ownerRef.current) return;
    try {
      const previous = readLocalRun(window.localStorage, ownerRef.current, Date.now(), true);
      if (!previous) { setMessage('복구할 이전 작전이 없습니다.'); return; }
      if (replaceProtected(previous)) setMessage('이전 작전을 복구했습니다.');
    } catch { setMessage('이전 작전의 형식을 확인할 수 없습니다. 현재 작전과 저장 자료는 유지됩니다.'); }
  };
  const exportRun = () => {
    const blob = new Blob([JSON.stringify(serializeState(latestRef.current), null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'infinite-defense-' + latestRef.current.runId + '.json';
    a.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setMessage('현재 작전을 JSON 파일로 내보냈습니다.');
  };
  const importRun = async file => {
    if (!file || busyRef.current || !ownerRef.current) return;
    if (file.size > 1024 * 1024) { setMessage('1MB 이하의 작전 JSON 파일만 가져올 수 있습니다.'); return; }
    busyRef.current = 'import'; setBusy('import');
    const targetOwner = ownerRef.current, operation = ++operationRef.current;
    replace(current => setPaused(current, true));
    try {
      const raw = await file.text();
      if (ownerRef.current !== targetOwner || operationRef.current !== operation) return;
      const next = restoreState(JSON.parse(raw));
      if (replaceProtected(next)) setMessage('작전을 가져왔습니다. 직전 진행은 이전 작전 복구에 보관했습니다.');
    } catch { if (ownerRef.current === targetOwner && operationRef.current === operation) setMessage('작전 파일의 형식이나 버전이 맞지 않습니다. 현재 진행은 유지됩니다.'); }
    finally {
      if (operationRef.current === operation) { busyRef.current = ''; setBusy(''); }
    }
  };

  const serverAction = async kind => {
    if (!token) { setMessage('로그인하면 계정 저장과 전적 기록을 사용할 수 있습니다. 기기 자동 저장은 계속됩니다.'); return; }
    if (busyRef.current || !ownerRef.current) return;
    const before = latestRef.current;
    if (kind === 'record' && (!before.firstClear && before.phase !== 'defeat')) {
      setMessage('20웨이브를 완수하거나 거점 방어가 끝난 뒤 전적을 기록할 수 있습니다.'); return;
    }
    if (kind === 'record' && recordedRef.current) { setMessage('이 작전은 이미 전적에 기록했습니다.'); return; }
    busyRef.current = kind; setBusy(kind);
    const session = captureAuthSession(), targetOwner = ownerRef.current, operation = ++operationRef.current;
    const currentRequest = () => isCurrentAuthSession(session) && ownerRef.current === targetOwner && operationRef.current === operation;
    replace(current => setPaused(current, true));
    const snapshot = serializeState(latestRef.current);
    try {
      if (kind === 'save') {
        await apiPut('/game-saves/' + GAME_SLUG + '/' + QUICK_SAVE_SLOT, {
          saveName: '무한 디펜스 · ' + snapshot.clearedWave + '웨이브', version: SAVE_VERSION,
          summary: summaryForState(snapshot), payload: { state: snapshot }, lastPlayedAt: new Date().toISOString(),
        }, { timeoutMs: 15000 });
        if (!currentRequest()) return;
        clearApiGetCache('/game-saves');
        setMessage('계정 저장 슬롯에 저장했습니다. 전투 재개를 눌러 이어갈 수 있습니다.');
      } else if (kind === 'load') {
        const list = await apiGet('/game-saves?gameSlug=' + GAME_SLUG, { timeoutMs: 12000 });
        if (!currentRequest()) return;
        const slot = list?.saves?.find(row => row.slotKey === QUICK_SAVE_SLOT);
        if (!slot?.id) { setMessage('계정에 저장된 무한 디펜스 작전이 없습니다.'); return; }
        const detail = await apiGet('/game-saves/' + slot.id, { timeoutMs: 12000 });
        if (!currentRequest()) return;
        if (detail.save?.version !== SAVE_VERSION) throw new Error('저장 버전이 맞지 않습니다.');
        if (replaceProtected(restoreState(detail.save?.payload?.state))) setMessage('계정 작전을 불러왔습니다. 직전 작전은 복구본으로 보관했습니다.');
      } else if (kind === 'record') {
        await apiPost('/game-records/' + GAME_SLUG, {
          title: '무한 디펜스 · ' + snapshot.clearedWave + '웨이브', mode: 'tower-defense',
          result: snapshot.firstClear ? 'clear' : 'fail', score: scoreState(snapshot), playTimeSec: Math.floor(snapshot.elapsed),
          summary: summaryForState(snapshot), payload: { state: snapshot },
        }, { timeoutMs: 15000 });
        if (!currentRequest()) return;
        recordedRef.current = true; setRecorded(true);
        window.localStorage.setItem(localSaveKey(targetOwner) + ':recorded', snapshot.runId);
        clearApiGetCache('/game-records');
        setMessage('전적에 작전 결과를 기록했습니다.');
      }
    } catch (error) {
      if (!currentRequest()) return;
      setMessage(error?.isAuthError ? '로그인이 만료되었습니다. 현재 작전은 유지됩니다. 다시 로그인한 뒤 저장할 수 있습니다.' : error?.message || '연결을 완료하지 못했습니다. 기기 저장은 유지됩니다.');
    } finally {
      if (operationRef.current === operation) { busyRef.current = ''; setBusy(''); }
    }
  };
  return { state, ready, message, busy, recorded, act, newRun, recover, exportRun, importRun, serverAction };
}
