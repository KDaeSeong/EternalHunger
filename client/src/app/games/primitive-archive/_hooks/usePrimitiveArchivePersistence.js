'use client';

import { useState } from 'react';
import { apiGet, apiPost, apiPut, clearApiGetCache } from '../../../../utils/api';
import {
  GAME_SLUG,
  QUICK_SAVE_SLOT,
  SAVE_VERSION,
  getPlayTimeSec,
  normalizeState,
  settleRunAction,
  summaryForState,
} from '../_lib/primitiveArchiveEngine';

function persistenceErrorMessage(err, fallback) {
  return err?.isAuthError
    ? '로그인이 만료되었습니다. 현재 런은 유지되며, 다시 로그인한 뒤 저장할 수 있습니다.'
    : err?.message || fallback;
}

export default function usePrimitiveArchivePersistence({
  hp,
  score,
  setActionResult,
  setNewRunDifficulty,
  setState,
  showToast,
  state,
  token,
}) {
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');

  const saveRun = async () => {
    if (!token || busy) {
      setMessage('로그인하면 런을 서버 저장 슬롯에 저장할 수 있습니다.');
      return;
    }
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
      setBusy('');
    }
  };

  const loadRun = async () => {
    if (!token || busy) {
      setMessage('로그인하면 저장된 런을 불러올 수 있습니다.');
      return;
    }
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
      setBusy('');
    }
  };

  const recordRun = async () => {
    if (!token || busy) {
      setMessage('로그인하면 런 결과를 전적에 남길 수 있습니다.');
      return;
    }
    setBusy('record');
    try {
      const result = hp <= 0 ? 'fail' : 'clear';
      await apiPost(`/game-records/${GAME_SLUG}`, {
        title: `Civilization Archive Day ${state.day}`,
        mode: 'survival-loop',
        result,
        score,
        playTimeSec: getPlayTimeSec(state),
        summary: summaryForState(state),
        payload: { state },
      }, { timeoutMs: 15000 });
      clearApiGetCache('/game-records');
      setMessage('런 결과를 전적에 기록했습니다.');
      showToast({ tone: 'success', message: '런 결과를 전적에 기록했습니다.' });
      setState((current) => settleRunAction(current));
      setActionResult('런 결과를 전적에 기록하고 런을 정산했습니다.');
    } catch (err) {
      const nextMessage = persistenceErrorMessage(err, '전적 기록에 실패했습니다.');
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
