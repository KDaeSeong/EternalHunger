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
} from '../_lib/schoolSimulatorEngine';
import { actionFeedbackText } from '../_lib/schoolSimulatorPlayHelpers';

export default function useSchoolSimulatorPersistence({
  onLoaded,
  score,
  setActionResult,
  setState,
  showToast,
  state,
  token,
}) {
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');

  const saveRun = async () => {
    if (!token || busy) {
      const nextMessage = '로그인하면 School Simulator 진행 상태를 저장할 수 있습니다.';
      setMessage(nextMessage);
      setActionResult(nextMessage);
      return;
    }
    setBusy('save');
    try {
      await apiPut(`/game-saves/${GAME_SLUG}/${QUICK_SAVE_SLOT}`, {
        saveName: `School Y${state.school.year}-${state.school.semester} W${state.school.week}`,
        version: SAVE_VERSION,
        summary: summaryForState(state),
        payload: { state },
        lastPlayedAt: new Date().toISOString(),
      }, { timeoutMs: 15000 });
      clearApiGetCache('/game-saves');
      setMessage('School Simulator 진행 상태를 저장했습니다.');
      setActionResult(`School Simulator 진행 상태를 저장했습니다. ${state.school.year}년 ${state.school.semester}학기 ${state.school.week}주차.`);
      showToast({ tone: 'success', message: 'School Simulator 진행 상태를 저장했습니다.' });
    } catch (err) {
      const nextMessage = err?.message || '저장에 실패했습니다.';
      setMessage(nextMessage);
      setActionResult(nextMessage);
      showToast({ tone: 'danger', message: nextMessage });
    } finally {
      setBusy('');
    }
  };

  const loadRun = async () => {
    if (!token || busy) {
      const nextMessage = '로그인하면 저장된 School Simulator 진행 상태를 불러올 수 있습니다.';
      setMessage(nextMessage);
      setActionResult(nextMessage);
      return;
    }
    setBusy('load');
    try {
      const list = await apiGet(`/game-saves?gameSlug=${GAME_SLUG}`, { timeoutMs: 12000 });
      const quickSave = Array.isArray(list?.saves) ? list.saves.find((save) => save.slotKey === QUICK_SAVE_SLOT) : null;
      if (!quickSave?.id) {
        setMessage('저장된 School Simulator 진행 상태가 없습니다.');
        setActionResult('저장된 School Simulator 진행 상태가 없습니다.');
        return;
      }
      const detail = await apiGet(`/game-saves/${quickSave.id}`, { timeoutMs: 12000 });
      const nextState = normalizeState(detail?.save?.payload?.state);
      setState(nextState);
      onLoaded?.(nextState);
      setMessage('저장된 School Simulator 진행 상태를 불러왔습니다.');
      setActionResult(actionFeedbackText(state, nextState, '불러오기', '저장된 School Simulator 진행 상태를 불러왔습니다.'));
      showToast({ tone: 'success', message: '저장된 School Simulator 진행 상태를 불러왔습니다.' });
    } catch (err) {
      const nextMessage = err?.message || '불러오기에 실패했습니다.';
      setMessage(nextMessage);
      setActionResult(nextMessage);
      showToast({ tone: 'danger', message: nextMessage });
    } finally {
      setBusy('');
    }
  };

  const recordRun = async () => {
    if (!token || busy) {
      const nextMessage = '로그인하면 School Simulator 운영 기록을 전적에 남길 수 있습니다.';
      setMessage(nextMessage);
      setActionResult(nextMessage);
      return;
    }
    setBusy('record');
    try {
      await apiPost(`/game-records/${GAME_SLUG}`, {
        title: `School Simulator - ${state.school.year}년 ${state.school.semester}학기 ${state.school.week}주`,
        mode: 'school-sim',
        result: 'term-report',
        score,
        playTimeSec: getPlayTimeSec(state),
        summary: summaryForState(state),
        payload: { state },
      }, { timeoutMs: 15000 });
      clearApiGetCache('/game-records');
      setMessage('School Simulator 운영 기록을 전적에 남겼습니다.');
      setActionResult(`School Simulator 운영 기록을 전적에 남겼습니다. 점수 ${score.toLocaleString('ko-KR')}.`);
      showToast({ tone: 'success', message: 'School Simulator 운영 기록을 전적에 남겼습니다.' });
    } catch (err) {
      const nextMessage = err?.message || '전적 기록에 실패했습니다.';
      setMessage(nextMessage);
      setActionResult(nextMessage);
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
