function createInitialSpawnState(mapId = '') {
  return {
    mapId: String(mapId || ''),
    wildlife: {},
    wildlifeSpecies: {},
    legendaryCrates: [],
    transcendCrates: [],
    coreNodes: [],
    coreZoneHistory: {
      meteor: [],
      life_tree: [],
    },
    foodCrates: [],
    mutantWildlife: null,
    bosses: {
      alpha: null,
      omega: null,
      weakline: null,
    },
    spawnedDay: {
      legendary: -1,
      transcend: -1,
      core: -1,
      food: -1,
      alpha: -1,
      omega: -1,
      weakline: -1,
      wildlife: -1,
      mutantWildlife: -1,
    },
    counters: { crate: 0, transcend: 0, core: 0, food: 0 },
  };
}

function cloneSpawnState(state, mapId = '') {
  const safe = state && typeof state === 'object' ? state : null;
  const mid = String(mapId || '');
  if (!safe || String(safe.mapId || '') !== mid) return createInitialSpawnState(mid);

  const spawnedDay = {
    legendary: Number(safe?.spawnedDay?.legendary ?? -1),
    transcend: Number(safe?.spawnedDay?.transcend ?? -1),
    core: Number(safe?.spawnedDay?.core ?? -1),
    food: Number(safe?.spawnedDay?.food ?? -1),
    alpha: Number(safe?.spawnedDay?.alpha ?? -1),
    omega: Number(safe?.spawnedDay?.omega ?? -1),
    weakline: Number(safe?.spawnedDay?.weakline ?? -1),
    wildlife: Number(safe?.spawnedDay?.wildlife ?? -1),
    mutantWildlife: Number(safe?.spawnedDay?.mutantWildlife ?? -1),
  };

  const counters = {
    crate: Number(safe?.counters?.crate ?? 0),
    transcend: Number(safe?.counters?.transcend ?? 0),
    core: Number(safe?.counters?.core ?? 0),
    food: Number(safe?.counters?.food ?? 0),
  };

  return {
    mapId: String(safe.mapId || ''),
    wildlife: (safe.wildlife && typeof safe.wildlife === 'object') ? { ...safe.wildlife } : {},
    wildlifeSpecies: (safe.wildlifeSpecies && typeof safe.wildlifeSpecies === 'object')
      ? Object.fromEntries(Object.entries(safe.wildlifeSpecies).map(([zid, list]) => [
          String(zid),
          Array.isArray(list) ? list.map((x) => String(x || '').trim()).filter(Boolean) : [],
        ]))
      : {},
    legendaryCrates: Array.isArray(safe.legendaryCrates) ? safe.legendaryCrates.map((c) => ({ ...c })) : [],
    transcendCrates: Array.isArray(safe.transcendCrates) ? safe.transcendCrates.map((c) => ({ ...c })) : [],
    coreNodes: Array.isArray(safe.coreNodes) ? safe.coreNodes.map((n) => ({ ...n })) : [],
    coreZoneHistory: {
      meteor: Array.isArray(safe?.coreZoneHistory?.meteor)
        ? safe.coreZoneHistory.meteor.map((x) => String(x || '').trim()).filter(Boolean)
        : [],
      life_tree: Array.isArray(safe?.coreZoneHistory?.life_tree)
        ? safe.coreZoneHistory.life_tree.map((x) => String(x || '').trim()).filter(Boolean)
        : [],
    },
    foodCrates: Array.isArray(safe.foodCrates) ? safe.foodCrates.map((c) => ({ ...c })) : [],
    mutantWildlife: safe?.mutantWildlife ? { ...safe.mutantWildlife } : null,
    bosses: {
      alpha: safe?.bosses?.alpha ? { ...safe.bosses.alpha } : null,
      omega: safe?.bosses?.omega ? { ...safe.bosses.omega } : null,
      weakline: safe?.bosses?.weakline ? { ...safe.bosses.weakline } : null,
    },
    spawnedDay,
    counters,
  };
}

export {
  cloneSpawnState,
  createInitialSpawnState,
};
