import { validateSimulationReplayRecord } from './simulationReplayRuntime';

export const REPLAY_HISTORY_LIMIT = 10;
const DATABASE_NAME = 'eh_simulation_replays_v1';

export function classifySimulationReplayStorageError(error) {
  const name = error?.name || '';
  const message = String(error?.message || '');
  if (name === 'QuotaExceededError' || /quota|storage.?full|공간 부족/i.test(message)) {
    return { kind: 'quota', text: '브라우저 저장 공간이 부족해 경기 보관에 실패했습니다. 다른 사이트 데이터나 오래된 기록을 정리한 뒤 다시 저장하세요.' };
  }
  if (name === 'BlockedError' || /blocked|사용 중|차단/i.test(message)) {
    return { kind: 'blocked', text: '다른 탭이 경기 보관함을 사용 중이라 저장하지 못했습니다. 다른 탭을 닫거나 새로고침한 뒤 다시 저장하세요.' };
  }
  if (name === 'VersionError') {
    return { kind: 'unavailable', text: '경기 보관함 버전이 현재 앱과 맞지 않습니다. 페이지를 새로고침하거나 앱을 업데이트한 뒤 다시 시도하세요.' };
  }
  if (name === 'SecurityError' || name === 'NotAllowedError' || name === 'NotSupportedError') {
    return { kind: 'unavailable', text: '브라우저가 이 환경의 경기 보관을 허용하지 않았습니다. 일반 창에서 다시 시도하세요.' };
  }
  if (/브라우저.*보관함|indexeddb/i.test(message)) {
    return { kind: 'unavailable', text: message };
  }
  return { kind: 'unknown', text: message || '브라우저 저장 공간을 확인한 뒤 다시 시도하세요.' };
}

function openDatabase(factory = globalThis.indexedDB) {
  return new Promise((resolve, reject) => {
    if (!factory) { const error = new Error('이 브라우저에서 경기 보관함을 사용할 수 없습니다.'); error.name = 'NotSupportedError'; reject(error); return; }
    const request = factory.open(DATABASE_NAME, 1);
    let blocked = false;
    request.onupgradeneeded = () => {
      const store = request.result.createObjectStore('runs', { keyPath: 'id' });
      store.createIndex('finishedAt', 'finishedAt');
    };
    request.onerror = () => reject(request.error);
    request.onblocked = () => { blocked = true; const error = new Error('다른 탭이 경기 보관함을 사용 중입니다.'); error.name = 'BlockedError'; reject(error); };
    request.onsuccess = () => {
      if (blocked) { request.result.close(); return; }
      request.result.onversionchange = () => request.result.close();
      resolve(request.result);
    };
  });
}

export async function saveSimulationReplay(record, factory) {
  validateSimulationReplayRecord(record);
  const db = await openDatabase(factory);
  try {
    await new Promise((resolve, reject) => {
      const tx = db.transaction('runs', 'readwrite');
      const store = tx.objectStore('runs');
      store.put(record);
      let count = 0;
      store.index('finishedAt').openCursor(null, 'prev').onsuccess = (event) => {
        const cursor = event.target.result;
        if (!cursor) return;
        count += 1;
        if (count > REPLAY_HISTORY_LIMIT) cursor.delete();
        cursor.continue();
      };
      // Quota errors abort the put AND pruning. Earlier records stay intact.
      tx.oncomplete = () => resolve();
      tx.onabort = () => reject(tx.error || new Error('경기를 저장하지 못했습니다.'));
      tx.onerror = () => {};
    });
  } finally { db.close(); }
}

export async function listSimulationReplays(factory) {
  const db = await openDatabase(factory);
  try {
    return await new Promise((resolve, reject) => {
      const rows = [];
      const request = db.transaction('runs', 'readonly').objectStore('runs').index('finishedAt').openCursor(null, 'prev');
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const cursor = request.result;
        if (!cursor) { resolve(rows); return; }
        const { id, finishedAt, summary, input } = cursor.value;
        let unavailable = '';
        try { validateSimulationReplayRecord(cursor.value); } catch (error) { unavailable = error.message; }
        rows.push({ id, finishedAt, summary, runSeed: input?.runSeed, unavailable });
        cursor.continue();
      };
    });
  } finally { db.close(); }
}

export async function loadSimulationReplay(id, factory) {
  const db = await openDatabase(factory);
  try {
    const record = await new Promise((resolve, reject) => {
      const request = db.transaction('runs', 'readonly').objectStore('runs').get(String(id));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    validateSimulationReplayRecord(record);
    return record;
  } finally { db.close(); }
}
