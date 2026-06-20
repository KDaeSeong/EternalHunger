function bfsNextStepToAnyTarget(startZoneId, targetSet, zoneGraph, forbiddenIds) {
  const start = String(startZoneId || '');
  const forb = forbiddenIds instanceof Set ? forbiddenIds : new Set();

  const targets =
    targetSet instanceof Set
      ? new Set([...targetSet].map((z) => String(z)))
      : new Set(Array.isArray(targetSet) ? targetSet.map((z) => String(z)) : []);

  if (!start || targets.size === 0) return { nextStep: null, target: null };
  if (targets.has(start)) return { nextStep: start, target: start };

  if (!zoneGraph || typeof zoneGraph !== 'object') return { nextStep: null, target: null };

  const q = [start];
  const parent = new Map();
  parent.set(start, null);

  while (q.length) {
    const cur = q.shift();
    const neighbors = Array.isArray(zoneGraph[cur]) ? zoneGraph[cur] : [];
    for (const n0 of neighbors) {
      const n = String(n0 || '');
      if (!n || parent.has(n)) continue;
      if (forb.has(n)) continue;

      parent.set(n, cur);

      if (targets.has(n)) {
        let x = n;
        let prev = parent.get(x);
        while (prev && prev !== start) {
          x = prev;
          prev = parent.get(x);
        }
        return { nextStep: x, target: n };
      }

      q.push(n);
    }
  }

  return { nextStep: null, target: null };
}

function bfsPickSafestZone(startZoneId, zoneGraph, forbiddenIds, zonePop, opts) {
  const start = String(startZoneId || '');
  const forb = forbiddenIds instanceof Set ? forbiddenIds : new Set();
  const pop = (zonePop && typeof zonePop === 'object') ? zonePop : {};
  const maxDepth = Math.max(1, Math.floor(Number(opts?.maxDepth ?? 3)));
  const minDelta = Math.max(0, Math.floor(Number(opts?.minDelta ?? 1)));

  if (!start || !zoneGraph || typeof zoneGraph !== 'object') return { target: null, nextStep: null, dist: null };
  if (forb.has(start)) return { target: null, nextStep: null, dist: null };

  const startPop = Number(pop[start] ?? 0);

  const q = [start];
  const parent = new Map([[start, null]]);
  const depth = new Map([[start, 0]]);

  let bestAny = start;
  let bestAnyPop = startPop;
  let bestAnyDist = 0;

  let bestCand = null;
  let bestCandPop = Infinity;
  let bestCandDist = Infinity;

  while (q.length) {
    const cur = q.shift();
    const d = Number(depth.get(cur) ?? 0);
    const pCur = Number(pop[cur] ?? 0);

    if (pCur < bestAnyPop || (pCur === bestAnyPop && d < bestAnyDist)) {
      bestAny = cur;
      bestAnyPop = pCur;
      bestAnyDist = d;
    }

    if (d > 0 && pCur <= (startPop - minDelta)) {
      if (d < bestCandDist || (d === bestCandDist && pCur < bestCandPop)) {
        bestCand = cur;
        bestCandDist = d;
        bestCandPop = pCur;
      }
    }

    if (d >= maxDepth) continue;

    const neighbors = Array.isArray(zoneGraph[cur]) ? zoneGraph[cur] : [];
    for (const n0 of neighbors) {
      const n = String(n0 || '');
      if (!n || parent.has(n)) continue;
      if (forb.has(n)) continue;

      parent.set(n, cur);
      depth.set(n, d + 1);
      q.push(n);
    }
  }

  const target = bestCand || bestAny || null;
  if (!target) return { target: null, nextStep: null, dist: null };

  let x = target;
  let prev = parent.get(x);
  while (prev && prev !== start) {
    x = prev;
    prev = parent.get(x);
  }

  return { target, nextStep: x, dist: Number(depth.get(target) ?? 0) };
}

export {
  bfsNextStepToAnyTarget,
  bfsPickSafestZone,
};
