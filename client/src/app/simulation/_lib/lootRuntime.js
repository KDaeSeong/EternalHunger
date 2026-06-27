import { pickWeighted } from './simulationCommon';
import { classifySpecialByName } from './craftRuntime';
import { isItemExcludedFromFieldFarming } from '../../../utils/erItemFilters';

function pickFromAllCrates(mapObj, publicItems) {
  const crates = Array.isArray(mapObj?.itemCrates) ? mapObj.itemCrates : [];
  const pool = [];
  crates.forEach((c) => {
    const lt = Array.isArray(c?.lootTable) ? c.lootTable : [];
    lt.forEach((e) => {
      if (!e?.itemId) return;
      const item = (Array.isArray(publicItems) ? publicItems : []).find((it) => String(it?._id) === String(e.itemId)) || null;
      if (isItemExcludedFromFieldFarming(item)) return;
      pool.push({ itemId: String(e.itemId), weight: Math.max(0, Number(e?.weight || 1)), minQty: e?.minQty, maxQty: e?.maxQty });
    });
  });

  if (!pool.length) {
    const list = Array.isArray(publicItems) ? publicItems : [];
    for (const it of list) {
      if (!it?._id) continue;
      if (isItemExcludedFromFieldFarming(it)) continue;
      if (String(it?.type || '') !== '재료') continue;
      const tier = Number(it?.tier || 1);
      if (tier > 2) continue;
      if (classifySpecialByName(it?.name)) continue;

      const nm = String(it?.name || '').toLowerCase();
      const v = Number(it?.baseCreditValue ?? it?.value ?? 0);
      let w = 1;
      if (tier <= 1) w += 2;
      if (v > 0 && v <= 40) w += 1;
      if (nm.includes('천') || nm.includes('가죽') || nm.includes('돌') || nm.includes('나무') || nm.includes('철') || nm.includes('부품')) w += 1;

      pool.push({ itemId: String(it._id), weight: w, minQty: 1, maxQty: 1 });
    }
  }

  if (!pool.length) return null;
  return pickWeighted(pool);
}

export {
  pickFromAllCrates,
};
