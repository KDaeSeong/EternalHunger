'use client';

import { useRef, useState } from 'react';
import { isValidRunState } from '../_lib/primitiveArchiveCheckpoint';
import {
  apiGet, apiPost, apiPut, captureAuthSession, clearApiGetCache, isCurrentAuthSession,
} from '../../../../utils/api';
import {
  GAME_SLUG,
  QUICK_SAVE_SLOT,
  SAVE_VERSION,
  getPlayTimeSec,
  normalizeState,
  runRecordStatus,
  scoreState,
  summaryForState,
} from '../_lib/primitiveArchiveEngine';

function persistenceErrorMessage(err, fallback) {
  return err?.isAuthError
    ? '로그인이 만료되었습니다. 현재 런은 유지되며, 다시 로그인한 뒤 저장할 수 있습니다.'
    : err?.message || fallback;
}

export default function usePrimitiveArchivePersistence({
  latestStateRef,
  replaceRun,
  setActionResult,
  setNewRunDifficulty,
  setState,
  showToast,
  state,
  token,
}) {
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');
  const busyRef = useRef('');
  const captureRequest = () => ({ session: captureAuthSession(), state: latestStateRef?.current || state });
  const requestIsCurrent = (request) => isCurrentAuthSession(request.session)
    && (!latestStateRef || latestStateRef.current === request.state);

  const saveRun = async () => {
    if (busyRef.current) return;
    if (!token) {
      setMessage('로그인하면 런을 서버 저장 슬롯에 저장할 수 있습니다.');
      return;
    }
    busyRef.current = 'save';
    setBusy('save');
    const request = captureRequest();
    try {
      await apiPut(`/game-saves/${GAME_SLUG}/${QUICK_SAVE_SLOT}`, {
        saveName: `Civilization Archive Day ${request.state.day}`,
        version: SAVE_VERSION,
        summary: summaryForState(request.state),
        payload: { state: request.state },
        lastPlayedAt: new Date().toISOString(),
      }, { timeoutMs: 15000 });
      if (!requestIsCurrent(request)) return;
      clearApiGetCache('/game-saves');
      setMessage('런을 저장했습니다.');
      setActionResult('런을 서버 저장 슬롯에 저장했습니다.');
      showToast({ tone: 'success', message: '문명 아카이브 런을 저장했습니다.' });
    } catch (err) {
      if (!requestIsCurrent(request)) return;
      const nextMessage = persistenceErrorMessage(err, '런 저장에 실패했습니다.');
      setMessage(nextMessage);
      showToast({ tone: 'danger', message: nextMessage });
    } finally {
      busyRef.current = '';
      setBusy('');
    }
  };

  const loadRun = async () => {
    if (busyRef.current) return;
    if (!token) {
      setMessage('로그인하면 저장된 런을 불러올 수 있습니다.');
      return;
    }
    busyRef.current = 'load';
    setBusy('load');
    const request = captureRequest();
    try {
      const list = await apiGet(`/game-saves?gameSlug=${GAME_SLUG}`, { timeoutMs: 12000 });
      if (!requestIsCurrent(request)) return;
      const quickSave = Array.isArray(list?.saves) ? list.saves.find((save) => save.slotKey === QUICK_SAVE_SLOT) : null;
      if (!quickSave?.id) {
        setMessage('저장된 문명 아카이브 런이 없습니다.');
        return;
      }
      const detail = await apiGet(`/game-saves/${quickSave.id}`, { timeoutMs: 12000 });
      if (!requestIsCurrent(request)) return;
      const raw = detail?.save?.payload?.state;
      if (!isValidRunState(raw)
        || (detail.save.version && detail.save.version !== SAVE_VERSION)) {
        throw new Error('저장된 런의 형식이나 버전을 확인할 수 없습니다. 현재 진행은 유지됩니다.');
      }
      const nextState = normalizeState(raw);
      if (replaceRun) {
        const replacement = replaceRun(nextState);
        if (!replacement?.ok) {
          setMessage(replacement?.message || '현재 진행을 보호하지 못해 불러오기를 중단했습니다.');
          return;
        }
      } else {
        setState(nextState);
      }
      setNewRunDifficulty(nextState.difficulty || 'normal');
      setActionResult(nextState.log?.[0] || '');
      setMessage('저장된 런을 불러왔습니다.');
      showToast({ tone: 'success', message: '저장된 런을 불러왔습니다.' });
    } catch (err) {
      if (!requestIsCurrent(request)) return;
      const nextMessage = persistenceErrorMessage(err, '런 불러오기에 실패했습니다.');
      setMessage(nextMessage);
      showToast({ tone: 'danger', message: nextMessage });
    } finally {
      busyRef.current = '';
      setBusy('');
    }
  };

  const recordRun = async () => {
    if (busyRef.current) return;
    if (!token) {
      setMessage('로그인하면 런 결과를 전적에 남길 수 있습니다.');
      return;
    }
    const request = captureRequest();
    const snapshot = normalizeState(request.state);
    const status = runRecordStatus(snapshot);
    if (!status.canRecord) {
      setMessage(status.reason);
      setActionResult(status.reason);
      return;
    }
    busyRef.current = 'record';
    setBusy('record');
    try {
      const response = await apiPost(`/game-records/${GAME_SLUG}`, {
        title: `문명 아카이브 · ${snapshot.day}일 · ${status.label}`,
        mode: 'survival-loop',
        result: status.result,
        score: scoreState(snapshot),
        playTimeSec: getPlayTimeSec(snapshot),
        summary: summaryForState(snapshot),
        payload: { state: snapshot },
      }, { timeoutMs: 15000 });
      if (!requestIsCurrent(request)) return;
      clearApiGetCache('/game-records');
      const nextMessage = response?.replayed === true
        ? '이 런의 전적은 이미 저장되어 있습니다. 중복 기록을 추가하지 않았습니다.'
        : `${status.label} 결과를 전적에 기록했습니다.`;
      setMessage(nextMessage);
      showToast({ tone: 'success', message: nextMessage });
      setActionResult(nextMessage);
    } catch (err) {
      if (!requestIsCurrent(request)) return;
      const nextMessage = persistenceErrorMessage(err, '전적 기록에 실패했습니다.');
      setMessage(nextMessage);
      showToast({ tone: 'danger', message: nextMessage });
    } finally {
      busyRef.current = '';
      setBusy('');
    }
  };

  return {
    busy,
    loadRun,
    message,
    recordRun,
    saveRun,
    setMessage,
  };
}
