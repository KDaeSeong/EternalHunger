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
} from '../_lib/companyReportEngine';
import { normalizeCompanyReportGuidanceLevel } from '../_components/CompanyReportGuidancePanel';

export default function useCompanyReportPersistence({
  guidanceLevel,
  onLoaded,
  score,
  setActionResult,
  setGuidanceLevel,
  setState,
  showToast,
  state,
  token,
}) {
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');
  const publishResult = (nextMessage) => {
    setMessage(nextMessage);
    setActionResult(nextMessage);
  };

  const saveRun = async () => {
    if (!token || busy) {
      publishResult('로그인하면 Company Report 원장 상태를 저장할 수 있습니다.');
      return;
    }
    setBusy('save');
    try {
      await apiPut(`/game-saves/${GAME_SLUG}/${QUICK_SAVE_SLOT}`, {
        saveName: `Company Report ${state.company.year}-${String(state.company.month).padStart(2, '0')}`,
        version: SAVE_VERSION,
        summary: summaryForState(state),
        payload: { state, guidanceLevel },
        lastPlayedAt: new Date().toISOString(),
      }, { timeoutMs: 15000 });
      clearApiGetCache('/game-saves');
      publishResult('Company Report 원장 상태를 빠른 저장 슬롯에 저장했습니다.');
      showToast({ tone: 'success', message: 'Company Report 원장 상태를 저장했습니다.' });
    } catch (err) {
      const nextMessage = err?.message || '저장에 실패했습니다.';
      publishResult(nextMessage);
      showToast({ tone: 'danger', message: nextMessage });
    } finally {
      setBusy('');
    }
  };

  const loadRun = async () => {
    if (!token || busy) {
      publishResult('로그인하면 저장된 Company Report 원장 상태를 불러올 수 있습니다.');
      return;
    }
    setBusy('load');
    try {
      const list = await apiGet(`/game-saves?gameSlug=${GAME_SLUG}`, { timeoutMs: 12000 });
      const quickSave = Array.isArray(list?.saves) ? list.saves.find((save) => save.slotKey === QUICK_SAVE_SLOT) : null;
      if (!quickSave?.id) {
        publishResult('저장된 Company Report 원장 상태가 없습니다.');
        return;
      }
      const detail = await apiGet(`/game-saves/${quickSave.id}`, { timeoutMs: 12000 });
      const payload = detail?.save?.payload || {};
      const nextState = normalizeState(payload.state);
      setState(nextState);
      setGuidanceLevel(normalizeCompanyReportGuidanceLevel(payload.guidanceLevel));
      onLoaded?.(nextState);
      publishResult('저장된 Company Report 원장 상태를 불러왔습니다.');
      showToast({ tone: 'success', message: '저장된 Company Report 원장 상태를 불러왔습니다.' });
    } catch (err) {
      const nextMessage = err?.message || '불러오기에 실패했습니다.';
      publishResult(nextMessage);
      showToast({ tone: 'danger', message: nextMessage });
    } finally {
      setBusy('');
    }
  };

  const recordRun = async () => {
    if (!token || busy) {
      publishResult('로그인하면 Company Report 결산 기록을 전적에 남길 수 있습니다.');
      return;
    }
    setBusy('record');
    try {
      await apiPost(`/game-records/${GAME_SLUG}`, {
        title: `Company Report - ${state.company.year}-${String(state.company.month).padStart(2, '0')}`,
        mode: 'business-ledger',
        result: 'ledger-score',
        score,
        playTimeSec: getPlayTimeSec(state),
        summary: summaryForState(state),
        payload: { state, guidanceLevel },
      }, { timeoutMs: 15000 });
      clearApiGetCache('/game-records');
      publishResult('Company Report 결산 기록을 전적에 남겼습니다.');
      showToast({ tone: 'success', message: 'Company Report 결산 기록을 전적에 남겼습니다.' });
    } catch (err) {
      const nextMessage = err?.message || '전적 기록에 실패했습니다.';
      publishResult(nextMessage);
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
