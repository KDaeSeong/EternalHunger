import { classifySimulationReplayStorageError } from '../_lib/simulationReplayStorage.js';

const DATABASE_NAME = 'eh_simulation_replays_v1';

export function classifySimulationReplayDeletionError(error) {
  const classified = classifySimulationReplayStorageError(error);
  if (classified.kind === 'blocked') {
    return { ...classified, text: '다른 탭이 경기 보관함을 사용 중이라 기록을 삭제하지 못했습니다. 다른 탭을 닫거나 새로고침한 뒤 다시 시도하세요.' };
  }
  if (classified.kind === 'quota') {
    return { ...classified, text: '브라우저 저장 공간 문제로 경기 기록을 삭제하지 못했습니다. 다른 사이트 탭을 닫거나 브라우저 저장 공간을 확인한 뒤 다시 시도하세요.' };
  }
  if (classified.kind === 'unavailable') {
    return { ...classified, text: '이 브라우저에서 경기 기록을 삭제할 수 없습니다. 페이지를 새로고침하거나 일반 창에서 다시 시도하세요.' };
  }
  return { ...classified, text: '경기 기록을 삭제하지 못했습니다. 기록 목록은 변경하지 않았습니다.' };
}

function openReplayDatabase(factory = globalThis.indexedDB) {
  return new Promise((resolve, reject) => {
    if (!factory) {
      const error = new Error('이 브라우저에서 경기 보관함을 사용할 수 없습니다.');
      error.name = 'NotSupportedError';
      reject(error);
      return;
    }
    const request = factory.open(DATABASE_NAME, 1);
    let blocked = false;
    request.onupgradeneeded = () => {
      const store = request.result.createObjectStore('runs', { keyPath: 'id' });
      store.createIndex('finishedAt', 'finishedAt');
    };
    request.onerror = () => reject(request.error || new Error('경기 보관함을 열지 못했습니다.'));
    request.onblocked = () => {
      blocked = true;
      const error = new Error('다른 탭이 경기 보관함을 사용 중입니다.');
      error.name = 'BlockedError';
      reject(error);
    };
    request.onsuccess = () => {
      if (blocked) { request.result.close(); return; }
      request.result.onversionchange = () => request.result.close();
      resolve(request.result);
    };
  });
}

export async function deleteSimulationReplay(id, factory) {
  const key = String(id || '').trim();
  if (!key) throw new Error('삭제할 경기 기록 ID가 없습니다.');
  const db = await openReplayDatabase(factory);
  try {
    await new Promise((resolve, reject) => {
      const tx = db.transaction('runs', 'readwrite');
      tx.objectStore('runs').delete(key);
      tx.oncomplete = () => resolve();
      tx.onabort = () => reject(tx.error || new Error('경기 기록을 삭제하지 못했습니다.'));
      tx.onerror = () => {};
    });
  } finally { db.close(); }
}
