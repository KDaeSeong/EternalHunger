const RANDOM_ALGORITHM = 'fnv1a-mulberry32-v1';

function createRandomFromState(initialState, initialDraws = 0, initialIds = 0, initialNameHistory = []) {
  let state = initialState >>> 0;
  let draws = initialDraws;
  let ids = initialIds;
  const nameHistory = new Map(initialNameHistory.map(([key, names]) => [key, [...names]]));
  const random = () => {
    state |= 0;
    state = (state + 0x6D2B79F5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    draws += 1;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  // Name deduplication can change how many random draws equipment generation
  // takes. It therefore belongs to the run and its resumable random state.
  random.nameHistory = nameHistory;
  random.getState = () => ({ algorithm: RANDOM_ALGORITHM, state: state >>> 0, draws, ids,
    nameHistory: [...nameHistory].map(([key, names]) => [key, [...names]]),
  });
  random.nextId = (prefix) => {
    ids += 1;
    // Preserve the one draw previously used by generated equipment IDs, while
    // replacing wall-clock time with a per-run sequence that survives a save.
    return `${prefix}_run_${ids}_${Math.floor(random() * 1e9)}`;
  };
  return random;
}

export function createSeedRng(seedStr) {
  let hash = 2166136261;
  const seed = String(seedStr || '');
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }

  return createRandomFromState(hash);
}

export function restoreSeedRng(snapshot) {
  const nameHistory = snapshot?.nameHistory;
  if (snapshot?.algorithm !== RANDOM_ALGORITHM
    || !Number.isInteger(snapshot.state) || snapshot.state < 0 || snapshot.state > 0xffffffff
    || !Number.isSafeInteger(snapshot.draws) || snapshot.draws < 0
    || !Number.isSafeInteger(snapshot.ids) || snapshot.ids < 0 || snapshot.ids > snapshot.draws
    || !Array.isArray(nameHistory) || nameHistory.length > 256
    || nameHistory.some((row) => !Array.isArray(row) || row.length !== 2
      || typeof row[0] !== 'string' || row[0].length > 128
      || !Array.isArray(row[1]) || row[1].length > 32
      || row[1].some((name) => typeof name !== 'string' || name.length > 128))
    || new Set(nameHistory.map(([key]) => key)).size !== nameHistory.length) {
    throw new TypeError('Invalid or unsupported simulation random state.');
  }
  return createRandomFromState(snapshot.state, snapshot.draws, snapshot.ids, nameHistory);
}
