// --- 운석 + 생명의 나무 수액 → 포스 코어(간단 자동 조합) ---
const MAT_METEOR_ID = 'mat_meteor';
const MAT_TREE_ID = 'mat_world_tree';
const MAT_FORCE_CORE_ID = 'mat_force_core';

function invKey(it) {
  return String(it?.itemId || it?.id || it?._id || '');
}

function invDecOne(list, id) {
  const arr = Array.isArray(list) ? [...list] : [];
  const key = String(id || '');
  for (let i = 0; i < arr.length; i++) {
    if (invKey(arr[i]) !== key) continue;
    const q = Math.max(0, Number(arr[i]?.qty || 1));
    if (q > 1) arr[i] = { ...arr[i], qty: q - 1 };
    else arr.splice(i, 1);
    return arr;
  }
  return arr;
}

function invHasOne(list, id) {
  const key = String(id || '');
  return (Array.isArray(list) ? list : []).some((it) => invKey(it) === key && Math.max(0, Number(it?.qty || 1)) > 0);
}

function makeForceCore(day) {
  return { id: MAT_FORCE_CORE_ID, text: '포스 코어', type: 'material', tags: ['material', 'core', 'force_core'], acquiredDay: day };
}

// incomingId가 mat일 경우, 인벤에 저장하지 않아도 그 1개를 재료로 간주해 조합 가능
function tryAutoCraftForceCore(inventory, day, incomingId = '') {
  const inc = String(incomingId || '');
  const haveMeteor = inc === MAT_METEOR_ID || invHasOne(inventory, MAT_METEOR_ID);
  const haveTree = inc === MAT_TREE_ID || invHasOne(inventory, MAT_TREE_ID);
  if (!haveMeteor || !haveTree) return null;

  let next = Array.isArray(inventory) ? [...inventory] : [];
  if (inc !== MAT_METEOR_ID) next = invDecOne(next, MAT_METEOR_ID);
  if (inc !== MAT_TREE_ID) next = invDecOne(next, MAT_TREE_ID);
  next = [...next, makeForceCore(day)];
  return { inventory: next, log: '🧬 포스 코어 조합: 운석 파편 + 생명의 나무 수액 → 포스 코어 x1' };
}

export {
  MAT_METEOR_ID,
  MAT_TREE_ID,
  MAT_FORCE_CORE_ID,
  invKey,
  invDecOne,
  invHasOne,
  makeForceCore,
  tryAutoCraftForceCore,
};
