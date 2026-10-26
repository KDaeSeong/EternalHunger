'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { AUTH_SYNC_EVENT } from '../../../../utils/api';
import {
  acquireCheckpointWriterLease,
  checkpointOwner,
  checkpointStorageKey,
  legacyCheckpointStorageKey,
  discardUnreadableCheckpoint,
  readCheckpoint,
  restorePreviousCheckpoint,
  writeCheckpoint,
} from '../_lib/primitiveArchiveCheckpoint';
import { createNewState } from '../_lib/primitiveArchiveEngine';

// Keep failed writes across SPA route mounts, without sharing them with another tab or SSR request.
const pendingSnapshotsByWindow = new WeakMap();

function windowPendingSnapshots() {
  if (typeof window === 'undefined') return new Map();
  let snapshots = pendingSnapshotsByWindow.get(window);
  if (!snapshots) {
    snapshots = new Map();
    pendingSnapshotsByWindow.set(window, snapshots);
  }
  return snapshots;
}

function checkpointMessage(status, error = '') {
  if (error === 'legacy-checkpoint-changed' || error === 'legacy-checkpoint-untracked') return '다른 버전의 게임 탭에서 이 기기의 진행 기록이 바뀌었습니다. 두 기록을 덮어쓰지 않도록 자동 저장을 멈췄습니다. 현재 진행은 이 탭에 유지되지만 새로고침하거나 닫기 전에 별도로 보관해야 합니다.';
  if (error === 'writer-busy') return '다른 탭에서 이 게임을 진행 중이므로 이 탭은 보기만 가능합니다. 기존 탭을 닫은 뒤 이 화면을 새로고침하면 이어서 진행할 수 있습니다.';
  if (error === 'writer-lock-unavailable') return '이 브라우저에서 기기 기록을 안전하게 갱신할 수 없어 진행을 멈췄습니다. 기존 기록은 보존됩니다. 최신 브라우저에서 다시 열어 주세요.';
  if (status === 'loading') return '이 기기의 진행 기록을 확인하는 중입니다.';
  if (status === 'owner-unknown' || error === 'owner-unknown') {
    return '계정 정보를 확인할 수 없어 자동 저장을 중단했습니다. 게스트 진행과 계정 진행은 섞지 않습니다.';
  }
  if (status === 'missing') return '이 기기에 저장된 런이 없습니다. 현재 진행은 이 기기에 자동 저장됩니다.';
  if (status === 'ready') return '이 기기 자동 저장이 준비되어 있습니다. 서버 저장과는 별개입니다.';
  if (error === 'backup-write-failed') return '손상 기록의 백업을 저장하지 못해 정리를 중단했습니다. 기존 기록은 그대로 보존했습니다. 브라우저 저장 공간과 저장 권한을 확인한 뒤 다시 시도해 주세요.';
  if (status === 'corrupt') return '기기 저장 기록을 읽을 수 없어 덮어쓰기를 중단했습니다. 기존 기록을 보존하고 있습니다. 기기 기록을 정리하면 지금 화면의 런부터 다시 자동 저장합니다.';
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

function sameLegacyFingerprint(left, right) {
  if (left === null || right === null) return left === right;
  return Boolean(left && right)
    && left.length === right.length
    && left.hashA === right.hashA
    && left.hashB === right.hashB;
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
  const legacyFingerprintRef = useRef(null);
  const legacyFingerprintTrackedRef = useRef(false);
  const requiredStateRef = useRef(null);
  const unsavedSnapshotsRef = useRef(windowPendingSnapshots());
  const writerLeasesRef = useRef(new Map());
  const suspendedCheckpointRef = useRef(null);
  const [writerEpoch, setWriterEpoch] = useState(0);

  const rememberLegacyFingerprint = useCallback((read) => {
    if (!read?.legacyFingerprintTracked) return;
    legacyFingerprintRef.current = read.legacyFingerprint;
    legacyFingerprintTrackedRef.current = true;
  }, []);

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

  const hasWriterLease = useCallback((owner) => (
    writerLeasesRef.current.get(owner)?.status === 'held'
  ), []);

  const writerFailure = useCallback((owner) => {
    const leaseStatus = writerLeasesRef.current.get(owner)?.status;
    const status = leaseStatus === 'pending' ? 'loading' : leaseStatus === 'busy' ? 'conflict' : 'unavailable';
    const error = leaseStatus === 'busy' ? 'writer-busy' : 'writer-lock-unavailable';
    return { ok: false, status, error, message: checkpointMessage(status, error) };
  }, []);

  const releaseWriterLease = useCallback((owner) => {
    const lease = writerLeasesRef.current.get(owner);
    writerLeasesRef.current.delete(owner);
    lease?.release();
  }, []);

  const releaseWriterLeases = useCallback(() => {
    const leases = [...writerLeasesRef.current.values()];
    writerLeasesRef.current.clear();
    for (const lease of leases) lease.release();
  }, []);

  const ensureWriterLease = useCallback((owner) => {
    const existing = writerLeasesRef.current.get(owner);
    if (existing) return existing;
    let locks;
    try { locks = typeof window === 'undefined' ? null : window.navigator?.locks; } catch { locks = null; }
    let lease;
    lease = acquireCheckpointWriterLease(owner, {
      locks,
      onStatus: () => queueMicrotask(() => {
        if (!mountedRef.current || activeOwnerRef.current !== owner || desiredOwnerRef.current !== owner
          || writerLeasesRef.current.get(owner) !== lease) return;
        setWriterEpoch((value) => value + 1);
      }),
    });
    writerLeasesRef.current.set(owner, lease);
    return lease;
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
    unsavedSnapshotsRef.current.delete(activeOwnerRef.current);
    setHasPreviousState(Boolean(result.checkpoint?.previous));
    setStatus('ready');
    return successResult('ready', result.revision, result.savedAt);
  }, [setStatus]);

  const writeOwnerState = useCallback((owner, currentState, expectedRevision, { forcePrevious = false } = {}) => {
    if (!hasWriterLease(owner)) return writerFailure(owner);
    const result = writeCheckpoint(storage(), owner, currentState, {
      expectedRevision,
      forcePrevious,
    });
    return result;
  }, [hasWriterLease, storage, writerFailure]);

  const flush = useCallback(() => {
    const owner = activeOwnerRef.current;
    const liveState = getLatestState();
    if (!mountedRef.current || !hydrated || !readyRef.current || owner === null || owner !== desiredOwnerRef.current) {
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
    if (!hasWriterLease(owner)) return writerFailure(owner);
    if (statusRef.current === 'ready' && liveState === lastSavedStateRef.current) {
      return successResult('ready', revisionRef.current, savedAtRef.current);
    }

    const result = writeOwnerState(owner, liveState, revisionRef.current);
    if (!result?.ok || result.status !== 'ready') {
      if (result?.status === 'unavailable' && Number.isInteger(revisionRef.current)) {
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
  }, [applyWriteResult, getLatestState, hasWriterLease, hydrated, setStatus, writeOwnerState, writerFailure]);

  const queueFlush = useCallback(() => {
    const generation = ownerUiGenerationRef.current;
    const owner = activeOwnerRef.current;
    queueMicrotask(() => {
      if (!mountedRef.current || !readyRef.current || !owner
        || ownerUiGenerationRef.current !== generation
        || activeOwnerRef.current !== owner || desiredOwnerRef.current !== owner) return;
      flush();
    });
  }, [flush]);

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
    const pendingSnapshots = unsavedSnapshotsRef.current;
    return () => {
      ownerUiGenerationRef.current += 1;
      try {
        const owner = activeOwnerRef.current;
        if (!initializedRef.current || !readyRef.current || !owner
          || owner !== desiredOwnerRef.current || !Number.isInteger(revisionRef.current)) return;

        const liveState = getLatestState();
        const pending = pendingSnapshots.get(owner);
        // A spectator has no new local action to preserve. Retain an existing
        // failed-writer snapshot, but never manufacture one from read-only data.
        if (!hasWriterLease(owner)) return;
        if (blockedRef.current || !['ready', 'missing'].includes(statusRef.current)) {
          if (pending || lastSavedStateRef.current) {
            pendingSnapshots.set(owner, {
              state: liveState,
              revision: pending?.revision ?? revisionRef.current,
              status: statusRef.current,
            });
          }
          return;
        }
        if (statusRef.current === 'ready' && liveState === lastSavedStateRef.current) return;

        // Finish a dirty action synchronously; never call React setters while unmounting.
        const write = writeOwnerState(owner, liveState, revisionRef.current);
        if (write?.ok && write.status === 'ready') {
          revisionRef.current = write.revision;
          savedAtRef.current = write.savedAt;
          lastSavedStateRef.current = liveState;
          pendingSnapshots.delete(owner);
        } else {
          pendingSnapshots.set(owner, {
            state: liveState,
            revision: revisionRef.current,
            status: write?.status || 'unavailable',
          });
        }
      } finally {
        mountedRef.current = false;
        readyRef.current = false;
        releaseWriterLeases();
      }
    };
  }, [getLatestState, hasWriterLease, releaseWriterLeases, writeOwnerState]);

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

    if (!ownerChanged && priorOwner === ownerKey && readyRef.current && hasWriterLease(ownerKey)) {
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
      queueFlush();
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
      legacyFingerprintRef.current = null;
      legacyFingerprintTrackedRef.current = false;
      const priorState = getLatestState();
      if (priorOwner && !blockedRef.current && Number.isInteger(revisionRef.current)) {
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
        if (priorOwner && Number.isInteger(revisionRef.current)
          && (hasWriterLease(priorOwner) || unsavedSnapshotsRef.current.has(priorOwner))) {
          const pending = unsavedSnapshotsRef.current.get(priorOwner);
          unsavedSnapshotsRef.current.set(priorOwner, {
            state: priorState,
            revision: pending?.revision ?? revisionRef.current,
            status: statusRef.current,
          });
        }
        scheduleUi(() => setTransitionWarningState('이전 계정의 저장 상태를 확인할 수 없습니다. 최신 진행은 이 탭 메모리에 보존되며 새 계정으로 복사되지 않습니다.'));
      }

      releaseWriterLease(priorOwner);
      suspendedCheckpointRef.current = null;
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
      legacyFingerprintRef.current = null;
      legacyFingerprintTrackedRef.current = false;
      blockedRef.current = true;
      readyRef.current = true;
      scheduleUi(() => {
        setReadyState(true);
        setStatus('owner-unknown', 'owner-unknown');
      });
      return;
    }

    const lease = ensureWriterLease(ownerKey);
    if (lease.status === 'pending') return;
    if (!hasWriterLease(ownerKey)) {
      const pending = unsavedSnapshotsRef.current.get(ownerKey);
      const readOnly = readCheckpoint(localStorage, ownerKey);
      rememberLegacyFingerprint(readOnly);
      const snapshot = pending?.state || readOnly.checkpoint?.current;
      revisionRef.current = pending?.revision ?? readOnly.revision;
      savedAtRef.current = readOnly.savedAt;
      lastSavedStateRef.current = pending ? null : readOnly.checkpoint?.current || null;
      requiredStateRef.current = snapshot || null;
      if (snapshot) {
        setTrackedState(snapshot);
        onRestoreRef.current?.(snapshot, { source: 'read-only', ownerKey });
      }
      readyRef.current = true;
      const failure = writerFailure(ownerKey);
      scheduleUi(() => {
        setReadyState(true);
        setHasPreviousState(false);
        setStatus(failure.status, failure.error);
      });
      return;
    }

    const suspended = suspendedCheckpointRef.current;
    if (suspended?.owner === ownerKey) {
      suspendedCheckpointRef.current = null;
      const read = readCheckpoint(localStorage, ownerKey);
      rememberLegacyFingerprint(read);
      if (suspended.saved && read.status === 'ready') {
        // All outgoing actions were acknowledged before freezing. It is safe
        // to adopt this owner's newer checkpoint without discarding dirty work.
        revisionRef.current = read.revision;
        savedAtRef.current = read.savedAt;
        lastSavedStateRef.current = read.checkpoint.current;
        requiredStateRef.current = read.checkpoint.current;
        blockedRef.current = false;
        readyRef.current = true;
        setTrackedState(read.checkpoint.current);
        onRestoreRef.current?.(read.checkpoint.current, { source: 'pageshow-current', ownerKey });
        scheduleUi(() => {
          setReadyState(true);
          setHasPreviousState(Boolean(read.checkpoint.previous));
          setStatus('ready');
        });
        return;
      }
      const unchanged = read.revision === suspended.revision && read.savedAt === suspended.savedAt
        && ['ready', 'missing'].includes(read.status);
      revisionRef.current = suspended.revision;
      savedAtRef.current = suspended.savedAt;
      lastSavedStateRef.current = suspended.saved ? getLatestState() : null;
      blockedRef.current = !unchanged || !suspended.saved;
      readyRef.current = true;
      scheduleUi(() => {
        setReadyState(true);
        setHasPreviousState(unchanged && suspended.saved && Boolean(read.checkpoint?.previous));
        setStatus(!unchanged ? (read.status === 'corrupt' || read.status === 'unavailable' ? read.status : 'conflict')
          : suspended.saved ? read.status : 'unavailable', !unchanged ? read.error || 'revision-conflict' : '');
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

      // A conflicting disk revision was not acknowledged by this in-memory run.
      revisionRef.current = unsavedSnapshot.revision;
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
    rememberLegacyFingerprint(read);
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
  }, [applyWriteResult, authenticated, ensureWriterLease, getLatestState, hasWriterLease, hydrated, ownerKey, queueFlush, rememberLegacyFingerprint, releaseWriterLease, resolvedOwner, setStatus, setTrackedState, storage, writerEpoch, writeOwnerState, writerFailure]);

  useEffect(() => {
    if (!hydrated || !readyState || !readyRef.current || activeOwnerRef.current !== ownerKey || !ownerKey) return undefined;
    const key = checkpointStorageKey(ownerKey);
    const legacyKey = legacyCheckpointStorageKey(ownerKey);
    const handleStorage = (event) => {
      if (event?.key !== key && event?.key !== legacyKey && event?.key !== null) return;
      const read = readCheckpoint(storage(), ownerKey);
      const changedLegacySource = event?.key === legacyKey
        && legacyFingerprintTrackedRef.current
        && read?.legacyFingerprintTracked
        && !sameLegacyFingerprint(legacyFingerprintRef.current, read.legacyFingerprint);
      if (read.status === 'ready'
        && read.revision === revisionRef.current
        && read.savedAt === savedAtRef.current
        && !changedLegacySource) return;
      if (read.status === 'missing' && revisionRef.current === 0) return;

      blockedRef.current = true;
      setHasPreviousState(false);
      const legacyChanged = event?.key === legacyKey
        && (changedLegacySource
          || read.error === 'legacy-checkpoint-changed'
          || read.error === 'legacy-checkpoint-untracked'
          || (read.status === 'ready'
            && (read.revision !== revisionRef.current || read.savedAt !== savedAtRef.current)));
      setStatus(read.status === 'corrupt' || read.status === 'unavailable' ? read.status : 'conflict',
        read.error || (legacyChanged ? 'legacy-checkpoint-changed' : 'revision-conflict'));
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, [activeOwnerState, hydrated, ownerKey, readyState, rememberLegacyFingerprint, setStatus, storage]);

  useEffect(() => {
    if (!hydrated || !readyRef.current || activeOwnerRef.current !== ownerKey) return;
    if (requiredStateRef.current && state !== requiredStateRef.current) return;
    if (requiredStateRef.current === state) requiredStateRef.current = null;
    queueFlush();
  }, [hydrated, ownerKey, queueFlush, state]);

  useEffect(() => {
    if (!hydrated) return undefined;
    const handlePageHide = (event) => {
      const saved = flush();
      if (!event?.persisted) return;
      suspendedCheckpointRef.current = { owner: activeOwnerRef.current, revision: revisionRef.current,
        savedAt: savedAtRef.current, saved: Boolean(saved.ok) };
      readyRef.current = false;
      releaseWriterLeases();
      setReadyState(false);
      setStatus('loading');
    };
    const handlePageShow = (event) => {
      if (event?.persisted && suspendedCheckpointRef.current) setWriterEpoch((value) => value + 1);
    };
    const handleBeforeUnload = (event) => {
      const owner = activeOwnerRef.current;
      const hasPendingSnapshot = unsavedSnapshotsRef.current.size > 0;
      if (!hasWriterLease(owner) && !hasPendingSnapshot) return;
      const result = flush();
      if (result.ok && unsavedSnapshotsRef.current.size === 0) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('pagehide', handlePageHide);
    window.addEventListener('pageshow', handlePageShow);
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('pagehide', handlePageHide);
      window.removeEventListener('pageshow', handlePageShow);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [flush, hasWriterLease, hydrated, releaseWriterLeases, setStatus]);

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
    if (!hasWriterLease(owner)) return writerFailure(owner);
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
  }, [flush, hasWriterLease, hydrated, setStatus, setTrackedState, storage, writerFailure]);

  const discardUnreadable = useCallback(() => {
    const owner = activeOwnerRef.current;
    if (!hydrated || !readyRef.current || owner === null || owner !== desiredOwnerRef.current) {
      return { ok: false, status: 'loading', message: checkpointMessage('loading') };
    }
    if (!hasWriterLease(owner)) return writerFailure(owner);
    if (statusRef.current !== 'corrupt') {
      return { ok: false, status: statusRef.current, message: checkpointMessage(statusRef.current) };
    }
    const cleared = discardUnreadableCheckpoint(storage(), owner);
    if (cleared.status !== 'missing') {
      setStatus(cleared.status, cleared.error || '');
      return { ok: false, status: cleared.status, message: resultMessage(cleared) };
    }

    revisionRef.current = 0;
    savedAtRef.current = null;
    lastSavedStateRef.current = null;
    requiredStateRef.current = null;
    unsavedSnapshotsRef.current.delete(owner);
    blockedRef.current = false;
    setHasPreviousState(false);
    setStatus('missing');
    const liveState = getLatestState();
    const saved = applyWriteResult(writeOwnerState(owner, liveState, 0), liveState);
    if (!saved.ok && saved.status === 'unavailable') {
      unsavedSnapshotsRef.current.set(owner, { state: liveState, revision: 0, status: 'unavailable' });
    }
    return { ...saved, backedUp: Boolean(cleared.backedUp) };
  }, [applyWriteResult, getLatestState, hasWriterLease, hydrated, setStatus, storage, writeOwnerState, writerFailure]);

  const ownerBootstrapSettled = hydrated && readyState && ownerKey === activeOwnerState;
  const currentOwnerReady = ownerBootstrapSettled && Boolean(ownerKey);
  const authExpiredMessage = !authenticated && expiredOwner
    ? '로그인이 만료되었습니다. 현재 런은 이 탭에서 유지되며, 서버 저장은 다시 로그인한 뒤 사용할 수 있습니다.'
    : '';
  return {
    ready: currentOwnerReady,
    exclusive: currentOwnerReady && hasWriterLease(ownerKey),
    status: ownerBootstrapSettled ? statusState : 'loading',
    message: ownerBootstrapSettled
      ? [messageState, transitionWarningState, authExpiredMessage].filter(Boolean).join(' ')
      : checkpointMessage('loading'),
    hasPrevious: currentOwnerReady && hasPreviousState,
    replaceRun,
    restorePrevious,
    discardUnreadable,
    flush,
  };
}
