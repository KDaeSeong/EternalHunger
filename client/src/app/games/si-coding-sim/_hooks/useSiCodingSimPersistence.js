'use client';

import { useState } from 'react';
import { apiGet, apiPost, apiPut, clearApiGetCache } from '../../../../utils/api';
import {
  GAME_SLUG,
  QUICK_SAVE_SLOT,
  SAVE_VERSION,
  getPlayTimeSec,
  normalizeState,
  summaryForState,
} from '../_lib/siCodingSimEngine';

export default function useSiCodingSimPersistence({
  onLoaded,
  score,
  setState,
  showToast,
  state,
  token,
}) {
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');

  const saveRun = async () => {
    if (!token || busy) {
      setMessage('로그인하면 SI Coding Sim 진행 상태를 저장할 수 있습니다.');
      return;
    }
    setBusy('save');
    try {
      const summary = summaryForState(state);
      await apiPut(`/game-saves/${GAME_SLUG}/${QUICK_SAVE_SLOT}`, {
        saveName: `SI Coding ${summary.submittedTasks}/${summary.totalTasks}`,
        version: SAVE_VERSION,
        summary,
        payload: { state },
        lastPlayedAt: new Date().toISOString(),
      }, { timeoutMs: 15000 });
      clearApiGetCache('/game-saves');
      setMessage('SI Coding Sim 진행 상태를 저장했습니다.');
      showToast({ tone: 'success', message: 'SI Coding Sim 진행 상태를 저장했습니다.' });
    } catch (err) {
      const nextMessage = err?.message || '저장에 실패했습니다.';
      setMessage(nextMessage);
      showToast({ tone: 'danger', message: nextMessage });
    } finally {
      setBusy('');
    }
  };

  const loadRun = async () => {
    if (!token || busy) {
      setMessage('로그인하면 저장된 SI Coding Sim 진행 상태를 불러올 수 있습니다.');
      return;
    }
    setBusy('load');
    try {
      const list = await apiGet(`/game-saves?gameSlug=${GAME_SLUG}`, { timeoutMs: 12000 });
      const quickSave = Array.isArray(list?.saves) ? list.saves.find((save) => save.slotKey === QUICK_SAVE_SLOT) : null;
      if (!quickSave?.id) {
        setMessage('저장된 SI Coding Sim 진행 상태가 없습니다.');
        return;
      }
      const detail = await apiGet(`/game-saves/${quickSave.id}`, { timeoutMs: 12000 });
      const nextState = normalizeState(detail?.save?.payload?.state);
      setState(nextState);
      onLoaded?.(nextState);
      setMessage('저장된 SI Coding Sim 진행 상태를 불러왔습니다.');
      showToast({ tone: 'success', message: '저장된 SI Coding Sim 진행 상태를 불러왔습니다.' });
    } catch (err) {
      const nextMessage = err?.message || '불러오기에 실패했습니다.';
      setMessage(nextMessage);
      showToast({ tone: 'danger', message: nextMessage });
    } finally {
      setBusy('');
    }
  };

  const recordRun = async () => {
    if (!token || busy) {
      setMessage('로그인하면 SI Coding Sim 납품 기록을 전적에 남길 수 있습니다.');
      return;
    }
    setBusy('record');
    try {
      await apiPost(`/game-records/${GAME_SLUG}`, {
        title: `SI Coding Sim - ${state.taskSet?.title || 'Project'}`,
        mode: 'si-coding',
        result: 'delivery-score',
        score,
        playTimeSec: getPlayTimeSec(state),
        summary: summaryForState(state),
        payload: { state },
      }, { timeoutMs: 15000 });
      clearApiGetCache('/game-records');
      setMessage('SI Coding Sim 납품 기록을 전적에 남겼습니다.');
      showToast({ tone: 'success', message: 'SI Coding Sim 납품 기록을 전적에 남겼습니다.' });
    } catch (err) {
      const nextMessage = err?.message || '전적 기록에 실패했습니다.';
      setMessage(nextMessage);
      showToast({ tone: 'danger', message: nextMessage });
    } finally {
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
