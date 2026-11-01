import { LEGACY_SAVE_VERSION } from './autochessData.js';
import { isValidSave, restoreState, serializeState } from './autochessSave.js';
export function localSaveKey(owner) {
  if (typeof owner !== 'string' || !owner || owner.length > 180) throw new Error('저장 계정을 확인할 수 없습니다.');
  return 'eh:kivotos-autochess:v1:' + encodeURIComponent(owner);
}
export function readLocalRun(storage, owner, previous = false) {
  const raw = storage.getItem(localSaveKey(owner) + (previous ? ':previous' : ''));
  return raw ? restoreState(JSON.parse(raw)) : null;
}
export function writeLocalRun(storage, owner, state, backup = false) {
  const snapshot = serializeState(state);
  if (!isValidSave(snapshot)) throw new Error('대전 상태를 확인할 수 없어 저장하지 않았습니다.');
  const key = localSaveKey(owner), old = storage.getItem(key);
  if (old && snapshot.version !== LEGACY_SAVE_VERSION) {
    let prior;
    try { prior = JSON.parse(old); } catch { /* Unreadable originals remain untouched by migration. */ }
    const legacyKey = key + ':legacy-v1';
    if (prior?.version === LEGACY_SAVE_VERSION && isValidSave(prior) && !storage.getItem(legacyKey)) storage.setItem(legacyKey, old);
  }
  if (backup && old) {
    let valid = false;
    try { valid = isValidSave(JSON.parse(old)); } catch { /* Preserve unreadable bytes. */ }
    const backupKey = key + (valid ? ':previous' : ':unreadable');
    if (!valid && storage.getItem(backupKey) && storage.getItem(backupKey) !== old) throw new Error('기존 손상 자료를 먼저 보관해야 합니다.');
    storage.setItem(backupKey, old);
  }
  storage.setItem(key, JSON.stringify(snapshot));
  return snapshot;
}
