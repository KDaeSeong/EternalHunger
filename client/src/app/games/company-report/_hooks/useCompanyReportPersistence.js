'use client';

import { useEffect, useRef, useState } from 'react';
import { apiGet, apiPost, apiPut, captureAuthSession, isCurrentAuthSession, clearApiGetCache } from '../../../../utils/api';
import { GAME_SLUG, QUICK_SAVE_SLOT, SAVE_VERSION, getPlayTimeSec, normalizeState,
  scoreState, summaryForState } from '../_lib/companyReportEngine';
import { normalizeCompanyReportGuidanceLevel } from '../_components/CompanyReportGuidancePanel';

export default function useCompanyReportPersistence({ guidanceLevel, onLoaded,
  setActionResult, setGuidanceLevel, setState, showToast, stateRef, token }) {
  const [busyRequest, setBusyRequest] = useState(null);
  const [messageEntry, setMessageEntry] = useState(null);
  const [, refresh] = useState(0);
  const live = useRef({ active: false, epoch: 0, owner: null, request: null });
  const session = captureAuthSession();
  const scope = live.current;
  if (!scope.owner || scope.owner.token !== token || ['scope', 'revision', 'csrfToken']
    .some(key => scope.owner.session[key] !== session[key])) {
    scope.owner = { token, session };
    scope.request = null;
  }
  const owner = scope.owner;
  useEffect(() => {
    const scope = live.current;
    scope.active = true;
    scope.epoch++;
    scope.request = null;
    setBusyRequest(null);
    return () => {
      scope.active = false;
      scope.epoch++;
      scope.request = null;
    };
  }, []);

  const contextCurrent = () => live.current.active && live.current.owner === owner
    && isCurrentAuthSession(owner.session);
  const owns = request => contextCurrent() && live.current.request === request
    && live.current.epoch === request.epoch && isCurrentAuthSession(request.session);
  const setMessage = value => {
    if (!contextCurrent()) return;
    setMessageEntry(previous => ({ owner, text: typeof value === 'function'
      ? value(previous?.owner === owner ? previous.text : '') : value }));
  };
  const publish = text => { setMessage(text); setActionResult(text); };
  const start = kind => {
    if (!contextCurrent()) {
      if (live.current.active && live.current.owner === owner && !isCurrentAuthSession(owner.session)) {
        live.current.request = null;
        refresh(value => value + 1);
      }
      return null;
    }
    const scope = live.current;
    // Silent session replacement retires the old lock without adopting any
    // old response. A subsequent explicit click may start the new operation.
    if (scope.request && !isCurrentAuthSession(scope.request.session)) {
      scope.request = null;
      scope.epoch++;
      setBusyRequest(null);
    }
    if (!owner.token) {
      publish(kind === 'save' ? '로그인하면 Company Report 원장 상태를 저장할 수 있습니다.'
        : kind === 'load' ? '로그인하면 저장된 Company Report 원장 상태를 불러올 수 있습니다.'
          : '로그인하면 Company Report 결산 기록을 전적에 남길 수 있습니다.');
      return null;
    }
    if (scope.request) return null;
    const request = { kind, owner, epoch: scope.epoch, session: captureAuthSession(),
      source: stateRef.current, guidanceLevel };
    scope.request = request;
    setBusyRequest(request);
    return request;
  };
  const finish = request => {
    if (!live.current.active || live.current.request !== request) return;
    live.current.request = null;
    setBusyRequest(current => current === request ? null : current);
    if (!isCurrentAuthSession(request.session)) refresh(value => value + 1);
  };
  const failed = (request, error, fallback) => {
    if (!owns(request)) return;
    const text = error?.message || fallback;
    publish(text);
    showToast({ tone: 'danger', message: text });
  };
  const changedLoad = request => {
    if (!owns(request)) return true;
    if (stateRef.current === request.source) return false;
    publish('불러오는 동안 원장이 변경되어 현재 진행을 유지했습니다. 다시 불러오려면 불러오기를 선택하세요.');
    return true;
  };
  const saveRun = async () => {
    const request = start('save');
    if (!request) return;
    try {
      if (!owns(request)) return;
      const state = request.source;
      await apiPut(`/game-saves/${GAME_SLUG}/${QUICK_SAVE_SLOT}`, {
        saveName: `Company Report ${state.company.year}-${String(state.company.month).padStart(2, '0')}`,
        version: SAVE_VERSION, summary: summaryForState(state),
        payload: { state, guidanceLevel: request.guidanceLevel }, lastPlayedAt: new Date().toISOString(),
      }, { timeoutMs: 15000 });
      if (!owns(request)) return;
      clearApiGetCache('/game-saves');
      publish('Company Report 원장 상태를 빠른 저장 슬롯에 저장했습니다.');
      showToast({ tone: 'success', message: 'Company Report 원장 상태를 저장했습니다.' });
    } catch (error) { failed(request, error, '저장에 실패했습니다.'); }
    finally { finish(request); }
  };
  const loadRun = async () => {
    const request = start('load');
    if (!request) return;
    try {
      if (!owns(request)) return;
      const list = await apiGet(`/game-saves?gameSlug=${GAME_SLUG}`, { timeoutMs: 12000 });
      if (changedLoad(request)) return;
      const plain = value => value !== null && typeof value === 'object'
        && !Array.isArray(value) && [Object.prototype, null].includes(Object.getPrototypeOf(value));
      const versionKey = value => value === undefined || value === null ? ''
        : typeof value === 'string' && !value.trim() ? '' : value;
      const versionAllowed = value => versionKey(value) === '' || versionKey(value) === SAVE_VERSION;
      const quickSave = Array.isArray(list?.saves) ? list.saves.find(save => plain(save)
        && save.gameSlug === GAME_SLUG && save.slotKey === QUICK_SAVE_SLOT
        && typeof save.id === 'string' && save.id.trim().length > 0) : null;
      if (!quickSave?.id) { publish('저장된 Company Report 원장 상태가 없습니다.'); return; }
      if (!versionAllowed(quickSave.version)) throw new Error('지원하지 않는 저장 원장 버전이므로 불러올 수 없습니다.');
      if (!owns(request)) return;
      const detail = await apiGet(`/game-saves/${quickSave.id}`, { timeoutMs: 12000 });
      if (changedLoad(request)) return;
      const save = detail?.save;
      const payload = save?.payload;
      const saved = payload?.state;
      if (!plain(save) || save.id !== quickSave.id || save.gameSlug !== GAME_SLUG
        || save.slotKey !== QUICK_SAVE_SLOT
        || !versionAllowed(save.version)
        || (versionKey(quickSave.version) && versionKey(save.version)
          && versionKey(quickSave.version) !== versionKey(save.version))
        || !plain(payload) || !plain(saved) || typeof saved.runId !== 'string' || !saved.runId
        || !plain(saved.company) || !Number.isFinite(saved.company.cashKrw)
        || !Number.isInteger(saved.company.year) || saved.company.year < 1
        || !Number.isInteger(saved.company.month) || saved.company.month < 1 || saved.company.month > 12
        || !plain(saved.inventory) || !['orders', 'receivables', 'settlements'].every(key => Array.isArray(saved[key]))) {
        throw new Error('저장 원장의 정보가 올바르지 않아 불러올 수 없습니다. 현재 진행을 유지합니다.');
      }
      const nextState = normalizeState(payload.state);
      if (changedLoad(request)) return;
      stateRef.current = nextState;
      setState(nextState);
      setGuidanceLevel(normalizeCompanyReportGuidanceLevel(payload.guidanceLevel));
      onLoaded?.(nextState);
      publish('저장된 Company Report 원장 상태를 불러왔습니다.');
      showToast({ tone: 'success', message: '저장된 Company Report 원장 상태를 불러왔습니다.' });
    } catch (error) { failed(request, error, '불러오기에 실패했습니다.'); }
    finally { finish(request); }
  };
  const recordRun = async () => {
    const request = start('record');
    if (!request) return;
    try {
      if (!owns(request)) return;
      const state = request.source;
      await apiPost(`/game-records/${GAME_SLUG}`, {
        title: `Company Report - ${state.company.year}-${String(state.company.month).padStart(2, '0')}`,
        mode: 'business-ledger', result: 'ledger-score', score: scoreState(state),
        playTimeSec: getPlayTimeSec(state), summary: summaryForState(state),
        payload: { state, guidanceLevel: request.guidanceLevel },
      }, { timeoutMs: 15000 });
      if (!owns(request)) return;
      clearApiGetCache('/game-records');
      publish('Company Report 결산 기록을 전적에 남겼습니다.');
      showToast({ tone: 'success', message: 'Company Report 결산 기록을 전적에 남겼습니다.' });
    } catch (error) { failed(request, error, '전적 기록에 실패했습니다.'); }
    finally { finish(request); }
  };
  const busy = busyRequest && busyRequest.owner === owner && live.current.request === busyRequest
    && contextCurrent() && busyRequest.epoch === live.current.epoch ? busyRequest.kind : '';
  const message = messageEntry?.owner === owner && isCurrentAuthSession(owner.session) ? messageEntry.text : '';
  return { busy, loadRun, message, recordRun, saveRun, setMessage };
}
