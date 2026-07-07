'use client';

import { useState } from 'react';
import { apiGet, apiPost, apiPut, clearApiGetCache } from '../../../../utils/api';
import {
  GAME_SLUG,
  QUICK_SAVE_SLOT,
  SAVE_VERSION,
  applyOfflineProgressAction,
  getPlayTimeSec,
  normalizeState,
  summaryForState,
} from '../_lib/schaleIdleEngine';

export default function useSchaleIdlePersistence({
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
      setMessage('로그인하면 Schale Idle RPG 진행 상태를 서버 저장 슬롯에 저장할 수 있습니다.');
      return;
    }
    setBusy('save');
    try {
      const savedAt = new Date().toISOString();
      const stateForSave = { ...state, lastSavedAt: savedAt, updatedAt: savedAt };
      await apiPut(`/game-saves/${GAME_SLUG}/${QUICK_SAVE_SLOT}`, {
        saveName: `Schale Idle F${stateForSave.maxClearedFloor} T${stateForSave.towerMaxCleared}`,
        version: SAVE_VERSION,
        summary: summaryForState(stateForSave),
        payload: { state: stateForSave },
        lastPlayedAt: savedAt,
      }, { timeoutMs: 15000 });
      setState(stateForSave);
      clearApiGetCache('/game-saves');
      setMessage('Schale Idle RPG 진행 상태를 저장했습니다.');
      showToast({ tone: 'success', message: 'Schale Idle RPG 진행 상태를 저장했습니다.' });
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
      setMessage('로그인하면 저장된 Schale Idle RPG 진행 상태를 불러올 수 있습니다.');
      return;
    }
    setBusy('load');
    try {
      const list = await apiGet(`/game-saves?gameSlug=${GAME_SLUG}`, { timeoutMs: 12000 });
      const quickSave = Array.isArray(list?.saves) ? list.saves.find((save) => save.slotKey === QUICK_SAVE_SLOT) : null;
      if (!quickSave?.id) {
        setMessage('저장된 Schale Idle RPG 진행 상태가 없습니다.');
        return;
      }
      const detail = await apiGet(`/game-saves/${quickSave.id}`, { timeoutMs: 12000 });
      const restored = applyOfflineProgressAction(normalizeState(detail?.save?.payload?.state));
      setState(restored);
      onLoaded?.(restored);
      const offline = restored.offlineLastSummary;
      const loadedMessage = offline?.waves
        ? `저장된 Schale Idle RPG 진행 상태를 불러왔습니다. 오프라인 ${offline.waves}웨이브 보상을 반영했습니다.`
        : '저장된 Schale Idle RPG 진행 상태를 불러왔습니다.';
      setMessage(loadedMessage);
      showToast({ tone: 'success', message: loadedMessage });
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
      setMessage('로그인하면 Schale Idle RPG 진행 스냅샷을 전적에 남길 수 있습니다.');
      return;
    }
    setBusy('record');
    try {
      await apiPost(`/game-records/${GAME_SLUG}`, {
        title: `Schale Idle RPG Floor ${state.maxClearedFloor}`,
        mode: 'idle-rpg',
        result: 'account-progress',
        score,
        playTimeSec: getPlayTimeSec(state),
        summary: summaryForState(state),
        payload: { state },
      }, { timeoutMs: 15000 });
      clearApiGetCache('/game-records');
      setMessage('Schale Idle RPG 진행 스냅샷을 전적에 기록했습니다.');
      showToast({ tone: 'success', message: 'Schale Idle RPG 진행 스냅샷을 전적에 기록했습니다.' });
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
