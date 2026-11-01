import { isValidSave, restoreState, serializeState } from './infiniteDefenseEngine.js';

export function localSaveKey(owner) {
  if (typeof owner !== 'string' || !owner || owner.length > 180) throw new Error('저장 계정을 확인할 수 없습니다.');
  return 'eh:infinite-defense:v1:' + encodeURIComponent(owner);
}
export function readLocalRun(storage, owner, now = Date.now(), previous = false) {
  const raw = storage.getItem(localSaveKey(owner) + (previous ? ':previous' : ''));
  return raw ? restoreState(JSON.parse(raw), now) : null;
}
export function writeLocalRun(storage, owner, state, now = Date.now(), backup = false) {
  const snapshot = serializeState(state, now);
  if (!isValidSave(snapshot)) throw new Error('현재 작전 상태를 확인할 수 없어 저장하지 않았습니다.');
  const key = localSaveKey(owner);
  const old = storage.getItem(key);
  if (backup && old) {
    let valid = false;
    try { valid = isValidSave(JSON.parse(old)); } catch { /* Preserve unreadable source bytes separately. */ }
    const backupKey = key + (valid ? ':previous' : ':unreadable');
    const held = storage.getItem(backupKey);
    if (!valid && held && held !== old) throw new Error('기존 손상 자료가 있어 교체를 중단했습니다.');
    storage.setItem(backupKey, old);
  }
  storage.setItem(key, JSON.stringify(snapshot));
  return snapshot;
}
