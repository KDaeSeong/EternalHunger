import { findItemByKeywords, pickWeighted } from './simulationCommon';
import { isAtOrAfterWorldTime } from './worldTime';

function getLegendaryCoreCandidates(publicItems, weightsByKey = null) {
  const w = (weightsByKey && typeof weightsByKey === 'object') ? weightsByKey : {};

  const meteor = findItemByKeywords(publicItems, ['운석', 'meteor']);
  const tree = findItemByKeywords(publicItems, ['생명의 나무', '생나', 'tree of life', 'life tree']);
  const mithril = findItemByKeywords(publicItems, ['미스릴', 'mithril']);
  const forceCore = findItemByKeywords(publicItems, ['포스 코어', 'force core', 'forcecore']);

  const out = [];
  if (meteor?._id) out.push({ key: 'meteor', item: meteor, weight: Math.max(0.01, Number(w.meteor ?? 3)) });
  if (tree?._id) out.push({ key: 'life_tree', item: tree, weight: Math.max(0.01, Number(w.life_tree ?? 3)) });
  if (mithril?._id) out.push({ key: 'mithril', item: mithril, weight: Math.max(0.01, Number(w.mithril ?? 2)) });
  if (forceCore?._id) out.push({ key: 'force_core', item: forceCore, weight: Math.max(0.01, Number(w.force_core ?? 1)) });
  return out;
}

function resolveLegendaryDropWeights(opts = {}, ruleset = null) {
  if (opts?.dropWeightsByKey && typeof opts.dropWeightsByKey === 'object') return opts.dropWeightsByKey;
  if (opts?.weightsByKey && typeof opts.weightsByKey === 'object') return opts.weightsByKey;
  return ruleset?.worldSpawns?.legendaryCrate?.dropWeightsByKey || null;
}

function rollLegendaryCrateLoot(mapObj, zoneId, publicItems, curDay, curPhase, opts = {}) {
  if (!isAtOrAfterWorldTime(curDay, curPhase, 3, 'day')) return null;

  const moved = !!opts.moved;
  const chance = moved ? 0.09 : 0.03;
  if (Math.random() >= chance) return null;

  const legendaryWeights = resolveLegendaryDropWeights(opts, opts?.ruleset || null);
  const candidates = getLegendaryCoreCandidates(publicItems, legendaryWeights);
  if (!candidates.length) return null;

  const picked = pickWeighted(candidates);
  const item = picked?.item || null;
  if (!item?._id) return null;

  return { item, itemId: String(item._id), qty: 1, crateType: 'legendary_material', zoneId: String(zoneId || '') };
}

export {
  getLegendaryCoreCandidates,
  resolveLegendaryDropWeights,
  rollLegendaryCrateLoot,
};
