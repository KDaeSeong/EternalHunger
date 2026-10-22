'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { AUTH_SYNC_EVENT } from '../../../../utils/api';
import {
  checkpointOwner,
  checkpointStorageKey,
  readCheckpoint,
  restorePreviousCheckpoint,
  writeCheckpoint,
} from '../_lib/primitiveArchiveCheckpoint';
import { createNewState } from '../_lib/primitiveArchiveEngine';

function checkpointMessage(status, error = '') {
  if (status === 'loading') return '이 기기의 진행 기록을 확인하는 중입니다.';
  if (status === 'owner-unknown' || error === 'owner-unknown') {
    return '계정 정보를 확인할 수 없어 자동 저장을 중단했습니다. 게스트 진행과 계정 진행은 섞지 않습니다.';
  }
  if (status === 'missing') return '이 기기에 저장된 런이 없습니다. 현재 진행은 이 기기에 자동 저장됩니다.';
  if (status === 'ready') return '이 기기 자동 저장이 준비되어 있습니다. 서버 저장과는 별개입니다.';
  if (status === 'corrupt') return '기기 저장 기록을 읽을 수 없어 덮어쓰기를 중단했습니다. 기존 기록을 보존하고 있습니다.';
  if (status === 'conflict') return '다른 탭에서 진행 기록이 바뀌어 자동 저장을 멈췄습니다. 이 탭은 기존 기록을 덮어쓰지 않습니다.';
  if (status === 'invalid-state') return '현재 런을 안전하게 저장하지 못해 상태 교체를 중단했습니다.';
  if (status === 'no-previous') return '복구할 이전 런이 없습니다.';
  return '브라우저 저장소를 사용할 수 없어 자동 저장과 런 교체를 중단했습니다.';
}

function resultMessage(result) {
  return checkpointMessage(result?.status, result?.error);
}

function successResult(status, revision, savedAt) {
  return { ok: true, status, message: checkpointMessage(status), revision, savedAt };
}

export default function usePrimitiveArchiveCheckpoint({
  state,
  setState,
  hydrated,
  user,
  token,
  onRestore,
  latestStateRef,
}) {
  const authenticated = Boolean(token);
  const resolvedOwner = checkpointOwner({ user, authenticated });
  const [expiredOwner, setExpiredOwner] = useState(null);
  const ownerKey = !authenticated && expiredOwner
    ? expiredOwner
    : resolvedOwner;

  const [readyState, setReadyState] = useState(false);
  const [statusState, setStatusState] = useState('loading');
  const [messageState, setMessageState] = useState(checkpointMessage('loading'));
  const [hasPreviousState, setHasPreviousState] = useState(false);
  const [activeOwnerState, setActiveOwnerState] = useState(null);
  const [transitionWarningState, setTransitionWarningState] = useState('');

  const readyRef = useRef(false);
  const statusRef = useRef('loading');
  const blockedRef = useRef(true);
  const initializedRef = useRef(false);
  const mountedRef = useRef(false);
  const ownerUiGenerationRef = useRef(0);
  const activeOwnerRef = useRef(null);
  const authenticatedRef = useRef(authenticated);
  const desiredOwnerRef = useRef(ownerKey);
  const revisionRef = useRef(null);
  const savedAtRef = useRef(null);
  const lastSavedStateRef = useRef(null);
  const stateRef = useRef(state);
  const setStateRef = useRef(setState);
  const onRestoreRef = useRef(onRestore);
  const latestStateRefRef = useRef(latestStateRef);
  const storageRef = useRef(null);
  const requiredStateRef = useRef(null);
  const unsavedSnapshotsRef = useRef(new Map());

  const setStatus = useCallback((nextStatus, error = '') => {
    statusRef.current = nextStatus;
    setStatusState(nextStatus);
    setMessageState(checkpointMessage(nextStatus, error));
  }, []);

  const getLatestState = useCallback(() => (
    latestStateRefRef.current?.current ?? stateRef.current
  ), []);

  const setTrackedState = useCallback((nextState) => {
    stateRef.current = nextState;
    if (latestStateRefRef.current) latestStateRefRef.current.current = nextState;
    setStateRef.current(nextState);
  }, []);

  const storage = useCallback(() => {
    if (storageRef.current) return storageRef.current;
    if (typeof window === 'undefined') return null;
    try {
      storageRef.current = window.localStorage;
      return storageRef.current;
    } catch {
      return null;
    }
  }, []);

  const applyWriteResult = useCallback((result, sourceState) => {
    if (!result?.ok || result.status !== 'ready') {
      blockedRef.current = true;
      setHasPreviousState(false);
      setStatus(result?.status || 'unavailable', result?.error || '');
      return {
        ok: false,
        status: result?.status || 'unavailable',
        message: resultMessage(result),
        revision: result?.revision ?? revisionRef.current,
        savedAt: result?.savedAt ?? savedAtRef.current,
      };
    }

    revisionRef.current = result.revision;
    savedAtRef.current = result.savedAt;
    lastSavedStateRef.current = sourceState;
    blockedRef.current = false;
    setHasPreviousState(Boolean(result.checkpoint?.previous));
    setStatus('ready');
    return successResult('ready', result.revision, result.savedAt);
  }, [setStatus]);

  const writeOwnerState = useCallback((owner, currentState, expectedRevision, { forcePrevious = false } = {}) => {
    const result = writeCheckpoint(storage(), owner, currentState, {
      expectedRevision,
      forcePrevious,
    });
    return result;
  }, [storage]);

  const flush = useCallback(() => {
    const owner = activeOwnerRef.current;
    const liveState = getLatestState();
    if (!hydrated || !readyRef.current || owner === null || owner !== desiredOwnerRef.current) {
      return { ok: false, status: 'loading', message: checkpointMessage('loading') };
    }
    if (blockedRef.current || !['ready', 'missing'].includes(statusRef.current)) {
      return {
        ok: false,
        status: statusRef.current,
        message: checkpointMessage(statusRef.current),
        revision: revisionRef.current,
        savedAt: savedAtRef.current,
      };
    }
    if (statusRef.current === 'ready' && liveState === lastSavedStateRef.current) {
      return successResult('ready', revisionRef.current, savedAtRef.current);
    }

    const result = writeOwnerState(owner, liveState, revisionRef.current);
    if (!result?.ok || result.status !== 'ready') {
      if (owner !== 'guest' && result?.status === 'unavailable' && Number.isInteger(revisionRef.current)) {
        unsavedSnapshotsRef.current.set(owner, {
          state: liveState,
          revision: revisionRef.current,
          status: 'unavailable',
        });
      }
      blockedRef.current = true;
      setHasPreviousState(false);
      setStatus(result?.status || 'unavailable', result?.error || '');
      return {
        ok: false,
        status: result?.status || 'unavailable',
        message: resultMessage(result),
        revision: result?.revision ?? revisionRef.current,
        savedAt: result?.savedAt ?? savedAtRef.current,
      };
    }
    return applyWriteResult(result, liveState);
  }, [applyWriteResult, getLatestState, hydrated, setStatus, writeOwnerState]);

  useEffect(() => {
    desiredOwnerRef.current = ownerKey;
    stateRef.current = state;
    setStateRef.current = setState;
    onRestoreRef.current = onRestore;
    latestStateRefRef.current = latestStateRef;
  }, [latestStateRef, onRestore, ownerKey, setState, state]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const handleAuthSync = (event) => {
      const reason = event?.detail?.reason;
      if (reason === 'auth-invalidated') {
        const currentOwner = activeOwnerRef.current;
        if (currentOwner && currentOwner !== 'guest') {
          setExpiredOwner(currentOwner);
        }
        return;
      }

      setExpiredOwner(null);
    };
    window.addEventListener(AUTH_SYNC_EVENT, handleAuthSync);
    return () => window.removeEventListener(AUTH_SYNC_EVENT, handleAuthSync);
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const reauthenticated = authenticated && !authenticatedRef.current;
    authenticatedRef.current = authenticated;
    if (!hydrated) {
      readyRef.current = false;
      return;
    }

    const priorOwner = activeOwnerRef.current;
    const ownerChanged = initializedRef.current && priorOwner !== ownerKey;
    const localStorage = storage();

    if (!ownerChanged && priorOwner === ownerKey && readyRef.current) {
      const pending = unsavedSnapshotsRef.current.get(ownerKey);
      if (reauthenticated && ownerKey && ownerKey !== 'guest' && resolvedOwner === ownerKey
        && blockedRef.current && statusRef.current === 'unavailable'
        && pending?.status === 'unavailable' && Number.isInteger(pending.revision)) {
        const generation = ownerUiGenerationRef.current;
        queueMicrotask(() => {
          if (!mountedRef.current || !authenticatedRef.current || !readyRef.current
            || activeOwnerRef.current !== ownerKey || desiredOwnerRef.current !== ownerKey
            || ownerUiGenerationRef.current !== generation
            || !blockedRef.current || statusRef.current !== 'unavailable'
            || unsavedSnapshotsRef.current.get(ownerKey) !== pending) return;
          const liveState = getLatestState();
          const retry = writeOwnerState(ownerKey, liveState, pending.revision);
          if (retry?.ok && retry.status === 'ready') unsavedSnapshotsRef.current.delete(ownerKey);
          else if (retry?.status === 'unavailable') pending.state = liveState;
          applyWriteResult(retry, liveState);
        });
        return;
      }
      queueMicrotask(() => flush());
      return;
    }

    const generation = ++ownerUiGenerationRef.current;
    const scheduleUi = (update) => queueMicrotask(() => {
      if (!mountedRef.current
        || ownerUiGenerationRef.current !== generation
        || desiredOwnerRef.current !== ownerKey) return;
      update();
    });

    if (ownerChanged) {
      const priorState = getLatestState();
      if (!blockedRef.current && Number.isInteger(revisionRef.current)) {
        const priorWrite = writeOwnerState(priorOwner, priorState, revisionRef.current);
        if (priorWrite?.ok && priorWrite.status === 'ready') {
          lastSavedStateRef.current = priorState;
          unsavedSnapshotsRef.current.delete(priorOwner);
          scheduleUi(() => setTransitionWarningState(''));
        } else {
          unsavedSnapshotsRef.current.set(priorOwner, {
            state: priorState,
            revision: revisionRef.current,
            status: priorWrite?.status || 'unavailable',
          });
          scheduleUi(() => setTransitionWarningState('이전 계정의 마지막 진행 저장에 실패했습니다. 최신 진행은 이 탭 메모리에 보존되며 새 계정으로 복사되지 않습니다.'));
        }
      } else {
        unsavedSnapshotsRef.current.set(priorOwner, {
          state: priorState,
          revision: revisionRef.current,
          status: statusRef.current,
        });
        scheduleUi(() => setTransitionWarningState('이전 계정의 저장 상태를 확인할 수 없습니다. 최신 진행은 이 탭 메모리에 보존되며 새 계정으로 복사되지 않습니다.'));
      }

      const freshState = createNewState();
      requiredStateRef.current = freshState;
      lastSavedStateRef.current = null;
      setTrackedState(freshState);
      onRestoreRef.current?.(freshState, { source: 'owner-reset', ownerKey });
    }

    activeOwnerRef.current = ownerKey;
    initializedRef.current = true;
    readyRef.current = false;
    blockedRef.current = true;
    revisionRef.current = null;
    savedAtRef.current = null;
    scheduleUi(() => {
      setActiveOwnerState(ownerKey);
      setReadyState(false);
      setHasPreviousState(false);
      setStatus('loading');
    });

    if (authenticated && resolvedOwner) {
      scheduleUi(() => setExpiredOwner(null));
    }

    if (!ownerKey) {
      blockedRef.current = true;
      readyRef.current = true;
      scheduleUi(() => {
        setReadyState(true);
        setStatus('owner-unknown', 'owner-unknown');
      });
      return;
    }

    const unsavedSnapshot = unsavedSnapshotsRef.current.get(ownerKey);
    if (unsavedSnapshot) {
      const retry = writeOwnerState(ownerKey, unsavedSnapshot.state, unsavedSnapshot.revision);
      if (retry?.ok && retry.status === 'ready') {
        unsavedSnapshotsRef.current.delete(ownerKey);
        revisionRef.current = retry.revision;
        savedAtRef.current = retry.savedAt;
        lastSavedStateRef.current = retry.checkpoint.current;
        requiredStateRef.current = retry.checkpoint.current;
        blockedRef.current = false;
        scheduleUi(() => {
          setActiveOwnerState(ownerKey);
          setHasPreviousState(Boolean(retry.checkpoint.previous));
          setReadyState(true);
          setStatus('ready');
        });
        setTrackedState(retry.checkpoint.current);
        onRestoreRef.current?.(retry.checkpoint.current, { source: 'unsaved-memory', ownerKey });
        readyRef.current = true;
        return;
      }

      revisionRef.current = retry?.revision ?? unsavedSnapshot.revision;
      savedAtRef.current = retry?.savedAt ?? null;
      lastSavedStateRef.current = null;
      requiredStateRef.current = unsavedSnapshot.state;
      blockedRef.current = true;
      setTrackedState(unsavedSnapshot.state);
      scheduleUi(() => {
        setActiveOwnerState(ownerKey);
        setHasPreviousState(false);
        setReadyState(true);
        setStatus(retry?.status || unsavedSnapshot.status || 'unavailable', retry?.error || 'unsaved-memory');
        setTransitionWarningState('이 계정의 미저장 진행을 이 탭 메모리에서 복원했습니다. 기기 기록과 충돌할 수 있어 자동 덮어쓰기는 멈췄습니다.');
      });
      onRestoreRef.current?.(unsavedSnapshot.state, { source: 'unsaved-memory', ownerKey });
      readyRef.current = true;
      return;
    }

    const read = readCheckpoint(localStorage, ownerKey);
    if (read.status === 'ready') {
      revisionRef.current = read.revision;
      savedAtRef.current = read.savedAt;
      lastSavedStateRef.current = read.checkpoint.current;
      requiredStateRef.current = read.checkpoint.current;
      blockedRef.current = false;
      scheduleUi(() => {
        setActiveOwnerState(ownerKey);
        setHasPreviousState(Boolean(read.checkpoint.previous));
        setReadyState(true);
        setStatus('ready');
      });
      setTrackedState(read.checkpoint.current);
      onRestoreRef.current?.(read.checkpoint.current, { source: 'current', ownerKey });
      readyRef.current = true;
      return;
    }

    if (read.status === 'missing') {
      revisionRef.current = 0;
      blockedRef.current = false;
      lastSavedStateRef.current = null;
      if (!ownerChanged) requiredStateRef.current = null;
      readyRef.current = true;
      scheduleUi(() => {
        setActiveOwnerState(ownerKey);
        setReadyState(true);
        setStatus('missing');
      });
      return;
    }

    blockedRef.current = true;
    revisionRef.current = read.revision;
    readyRef.current = true;
    scheduleUi(() => {
      setActiveOwnerState(ownerKey);
      setReadyState(true);
      setStatus(read.status, read.error || '');
    });
  }, [applyWriteResult, authenticated, flush, getLatestState, hydrated, ownerKey, resolvedOwner, setStatus, setTrackedState, storage, writeOwnerState]);

  useEffect(() => {
    if (!hydrated || !readyRef.current || activeOwnerRef.current !== ownerKey || !ownerKey) return undefined;
    const key = checkpointStorageKey(ownerKey);
    const handleStorage = (event) => {
      if (event?.key !== key && event?.key !== null) return;
      const read = readCheckpoint(storage(), ownerKey);
      if (read.status === 'ready'
        && read.revision === revisionRef.current
        && read.savedAt === savedAtRef.current) return;
      if (read.status === 'missing' && revisionRef.current === 0) return;

      blockedRef.current = true;
      setHasPreviousState(false);
      setStatus(read.status === 'corrupt' || read.status === 'unavailable' ? read.status : 'conflict', read.error || 'revision-conflict');
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, [hydrated, ownerKey, setStatus, storage]);

  useEffect(() => {
    if (!hydrated || !readyRef.current || activeOwnerRef.current !== ownerKey) return;
    if (requiredStateRef.current && state !== requiredStateRef.current) return;
    if (requiredStateRef.current === state) requiredStateRef.current = null;
    queueMicrotask(() => flush());
  }, [flush, hydrated, ownerKey, state]);

  useEffect(() => {
    if (!hydrated) return undefined;
    const handlePageHide = () => flush();
    const handleBeforeUnload = (event) => {
      const result = flush();
      if (result.ok) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('pagehide', handlePageHide);
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('pagehide', handlePageHide);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [flush, hydrated]);

  const replaceRun = useCallback((nextState) => {
    const owner = activeOwnerRef.current;
    if (!hydrated || !readyRef.current || owner === null || owner !== desiredOwnerRef.current) {
      return { ok: false, status: 'loading', message: checkpointMessage('loading') };
    }
    if (blockedRef.current || !['ready', 'missing'].includes(statusRef.current)) {
      return {
        ok: false,
        status: statusRef.current,
        message: checkpointMessage(statusRef.current),
        revision: revisionRef.current,
        savedAt: savedAtRef.current,
      };
    }

    const previous = flush();
    if (!previous.ok) return previous;

    const write = writeOwnerState(owner, nextState, revisionRef.current, { forcePrevious: true });
    const saved = applyWriteResult(write, write?.checkpoint?.current || null);
    if (!saved.ok) return saved;

    requiredStateRef.current = write.checkpoint.current;
    setTrackedState(write.checkpoint.current);
    onRestoreRef.current?.(write.checkpoint.current, { source: 'replacement', ownerKey: owner });
    return saved;
  }, [applyWriteResult, flush, hydrated, setTrackedState, writeOwnerState]);

  const restorePrevious = useCallback(() => {
    const owner = activeOwnerRef.current;
    if (!hydrated || !readyRef.current || owner === null || owner !== desiredOwnerRef.current) {
      return { ok: false, status: 'loading', message: checkpointMessage('loading') };
    }
    if (blockedRef.current || statusRef.current !== 'ready') {
      return {
        ok: false,
        status: statusRef.current,
        message: checkpointMessage(statusRef.current),
        revision: revisionRef.current,
        savedAt: savedAtRef.current,
      };
    }

    const flushed = flush();
    if (!flushed.ok) return flushed;

    const result = restorePreviousCheckpoint(storage(), owner, { expectedRevision: revisionRef.current });
    if (!result?.ok || result.status !== 'ready') {
      if (result?.status === 'no-previous') {
        setHasPreviousState(false);
        setMessageState(checkpointMessage('no-previous', result.error || ''));
        return { ok: false, status: 'no-previous', message: checkpointMessage('no-previous'), revision: revisionRef.current, savedAt: savedAtRef.current };
      }
      blockedRef.current = true;
      setHasPreviousState(false);
      setStatus(result?.status || 'unavailable', result?.error || '');
      return { ok: false, status: result?.status || 'unavailable', message: resultMessage(result), revision: result?.revision ?? revisionRef.current, savedAt: result?.savedAt ?? savedAtRef.current };
    }

    revisionRef.current = result.revision;
    savedAtRef.current = result.savedAt;
    lastSavedStateRef.current = result.checkpoint.current;
    blockedRef.current = false;
    setHasPreviousState(Boolean(result.checkpoint.previous));
    setStatus('ready');
    requiredStateRef.current = result.checkpoint.current;
    setTrackedState(result.checkpoint.current);
    onRestoreRef.current?.(result.checkpoint.current, { source: 'previous', ownerKey: owner });
    return successResult('ready', result.revision, result.savedAt);
  }, [flush, hydrated, setStatus, setTrackedState, storage]);

  const ownerBootstrapSettled = hydrated && readyState && ownerKey === activeOwnerState;
  const currentOwnerReady = ownerBootstrapSettled && Boolean(ownerKey);
  const authExpiredMessage = !authenticated && expiredOwner
    ? '로그인이 만료되었습니다. 현재 런은 이 탭에서 유지되며, 서버 저장은 다시 로그인한 뒤 사용할 수 있습니다.'
    : '';
  return {
    ready: currentOwnerReady,
    status: ownerBootstrapSettled ? statusState : 'loading',
    message: ownerBootstrapSettled
      ? [messageState, transitionWarningState, authExpiredMessage].filter(Boolean).join(' ')
      : checkpointMessage('loading'),
    hasPrevious: currentOwnerReady && hasPreviousState,
    replaceRun,
    restorePrevious,
    flush,
  };
}
