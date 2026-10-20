'use client';

import { useRef, useState } from 'react';
import { apiGet, apiPost, apiPut, clearApiGetCache } from '../../../../utils/api';
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

  const saveRun = async () => {
    if (busyRef.current) return;
    if (!token) {
      setMessage('로그인하면 런을 서버 저장 슬롯에 저장할 수 있습니다.');
      return;
    }
    busyRef.current = 'save';
    setBusy('save');
    try {
      await apiPut(`/game-saves/${GAME_SLUG}/${QUICK_SAVE_SLOT}`, {
        saveName: `Civilization Archive Day ${state.day}`,
        version: SAVE_VERSION,
        summary: summaryForState(state),
        payload: { state },
        lastPlayedAt: new Date().toISOString(),
      }, { timeoutMs: 15000 });
      clearApiGetCache('/game-saves');
      setMessage('런을 저장했습니다.');
      setActionResult('런을 서버 저장 슬롯에 저장했습니다.');
      showToast({ tone: 'success', message: '문명 아카이브 런을 저장했습니다.' });
    } catch (err) {
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
    try {
      const list = await apiGet(`/game-saves?gameSlug=${GAME_SLUG}`, { timeoutMs: 12000 });
      const quickSave = Array.isArray(list?.saves) ? list.saves.find((save) => save.slotKey === QUICK_SAVE_SLOT) : null;
      if (!quickSave?.id) {
        setMessage('저장된 문명 아카이브 런이 없습니다.');
        return;
      }
      const detail = await apiGet(`/game-saves/${quickSave.id}`, { timeoutMs: 12000 });
      const nextState = normalizeState(detail?.save?.payload?.state);
      setState(nextState);
      setNewRunDifficulty(nextState.difficulty || 'normal');
      setActionResult(nextState.log?.[0] || '');
      setMessage('저장된 런을 불러왔습니다.');
      showToast({ tone: 'success', message: '저장된 런을 불러왔습니다.' });
    } catch (err) {
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
    const snapshot = normalizeState(state);
    const status = runRecordStatus(snapshot);
    if (!status.canRecord) {
      setMessage(status.reason);
      setActionResult(status.reason);
      return;
    }
    busyRef.current = 'record';
    setBusy('record');
    try {
      await apiPost(`/game-records/${GAME_SLUG}`, {
        title: `문명 아카이브 · ${snapshot.day}일 · ${status.label}`,
        mode: 'survival-loop',
        result: status.result,
        score: scoreState(snapshot),
        playTimeSec: getPlayTimeSec(snapshot),
        summary: summaryForState(snapshot),
        payload: { state: snapshot },
      }, { timeoutMs: 15000 });
      clearApiGetCache('/game-records');
      const nextMessage = `${status.label} 결과를 전적에 기록했습니다.`;
      setMessage(nextMessage);
      showToast({ tone: 'success', message: nextMessage });
      setActionResult(nextMessage);
    } catch (err) {
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
