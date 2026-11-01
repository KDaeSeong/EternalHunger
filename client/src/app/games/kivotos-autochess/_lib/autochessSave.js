import { SAVE_VERSION, STUDENTS, STUDENT_BY_ID, COPIES_BY_COST, ACADEMIES, MAX_LEVEL, MAX_ROUNDS, MAX_FRAMES, BENCH_SIZE, BOARD } from './autochessData.js';
import { getPlayer, copiesOf, fieldUnits } from './autochessMarket.js';
function int(n, min, max) { return Number.isInteger(n) && n >= min && n <= max; }
function number(n, min, max) { return Number.isFinite(n) && n >= min && n <= max; }
function poolConserved(state) {
  const counts = Object.fromEntries(STUDENTS.map(s => [s.id, state.pool?.[s.id]]));
  if (Object.keys(state.pool || {}).length !== STUDENTS.length || Object.values(counts).some(n => !int(n, 0, 100))) return false;
  for (const player of state.players || []) {
    for (const id of player.shop || []) if (id) { if (!(id in counts)) return false; counts[id]++; }
    for (const unit of player.units || []) { if (!(unit.studentId in counts) || !int(unit.star, 1, 3)) return false; counts[unit.studentId] += copiesOf(unit); }
  }
  return STUDENTS.every(s => counts[s.id] === COPIES_BY_COST[s.cost]);
}
function validTrace(watch) {
  if (!watch || !int(watch.round, 1, MAX_ROUNDS) || !Array.isArray(watch.frames) || !watch.frames.length || watch.frames.length > MAX_FRAMES) return false;
  if (!watch.left || !watch.right || ![watch.left, watch.right].every(p => typeof p.id === 'string' && p.id.length <= 30 && typeof p.name === 'string' && p.name.length <= 100)) return false;
  if (![0, 1].includes(watch.winnerSide) || typeof watch.humanMatch !== 'boolean' || !number(watch.duration, 0, 60)) return false;
  let previousTime = -1, signatures = null;
  for (const frame of watch.frames) {
    if (!Array.isArray(frame) || frame.length !== 3 || !number(frame[0], 0, 60) || frame[0] < previousTime) return false;
    previousTime = frame[0];
    if (!Array.isArray(frame[1]) || frame[1].length > 16 || !Array.isArray(frame[2]) || frame[2].length > 12) return false;
    const ids = new Set(), cells = new Set(), sig = [];
    for (const a of frame[1]) {
      if (!Array.isArray(a) || a.length !== 10 || typeof a[0] !== 'string' || !/^p[0-7]-u\d+$/.test(a[0]) || ids.has(a[0]) || !STUDENT_BY_ID[a[1]]) return false;
      ids.add(a[0]);
      if (!int(a[2], 0, 1) || !int(a[3], 0, BOARD.cols - 1) || !int(a[4], 0, BOARD.rows - 1) || !number(a[5], 0, a[6]) || !number(a[6], 1, 100000) || !number(a[7], 0, 100) || !number(a[8], 0, 100000) || !int(a[9], 1, 3)) return false;
      const cell = a[3] + ',' + a[4];
      if (a[5] > 0 && cells.has(cell)) return false;
      if (a[5] > 0) cells.add(cell);
      sig.push([a[0], a[1], a[2], a[6], a[9]].join(':'));
    }
    sig.sort();
    if (signatures !== null && signatures !== sig.join('|')) return false;
    signatures = sig.join('|');
    for (const fx of frame[2]) if (!Array.isArray(fx) || fx.length !== 4 || !ids.has(fx[0]) || !ids.has(fx[1]) || !['attack', 'skill', 'heal', 'shield', 'buff'].includes(fx[2]) || !number(fx[3], 0, 1000000)) return false;
  }
  return true;
}
function isValidSave(state) {
  try {
    if (!state || state.version !== SAVE_VERSION || typeof state.runId !== 'string' || !state.runId || state.runId.length > 160 || /[\u0000-\u001f]/.test(state.runId)) return false;
    if (!number(state.createdAt, 0, 1e15) || !number(state.savedAt, 0, 1e15) || !int(state.rng, 1, 4294967295) || !int(state.round, 1, MAX_ROUNDS) || !int(state.nextUnitId, 1, 1000000) || !int(state.nextLogId, 1, 1000000)) return false;
    if (!['planning', 'battle', 'spectate', 'finished'].includes(state.phase) || typeof state.paused !== 'boolean' || !Array.isArray(state.players) || state.players.length !== 8) return false;
    const playerIds = new Set(), unitIds = new Set(), ranks = new Set();
    for (const player of state.players) {
      if (!/^p[0-7]$/.test(player.id) || playerIds.has(player.id) || typeof player.name !== 'string' || player.name.length > 80) return false;
      playerIds.add(player.id);
      if (!int(player.hp, 0, 40) || !int(player.gold, 0, 1000) || !int(player.level, 3, MAX_LEVEL) || !int(player.xp, 0, 40) || !int(player.streak, -30, 30) || !int(player.rank, 0, 8)) return false;
      if (player.rank && ranks.has(player.rank)) return false;
      if (player.rank) ranks.add(player.rank);
      if (player.hp === 0 && player.rank < 2) return false;
      if (player.hp > 0 && player.rank !== (state.phase === 'finished' ? 1 : 0)) return false;
      if (![...Object.keys(ACADEMIES), 'balanced'].includes(player.focus) || typeof player.locked !== 'boolean' || !player.commander || !int(player.commander.intelligence, 0, 5) || !int(player.commander.luck, 0, 5)) return false;
      if (!Array.isArray(player.shop) || player.shop.length !== 5 || player.shop.some(id => id !== null && !STUDENT_BY_ID[id])) return false;
      if (!Array.isArray(player.units) || player.units.length > player.level + BENCH_SIZE) return false;
      if (player.hp === 0 && (player.units.length || player.shop.some(Boolean))) return false;
      const positions = new Set();
      for (const unit of player.units) {
        if (typeof unit.uid !== 'string' || !unit.uid.startsWith(player.id + '-u') || !/^p[0-7]-u\d+$/.test(unit.uid) || unitIds.has(unit.uid) || !STUDENT_BY_ID[unit.studentId] || !int(unit.star, 1, 3)) return false;
        if (!int(Number(unit.uid.split('-u')[1]), 1, state.nextUnitId - 1)) return false;
        unitIds.add(unit.uid);
        const pos = unit.position;
        if (!pos || !['field', 'bench'].includes(pos.kind)) return false;
        if (pos.kind === 'field' ? !int(pos.x, 0, BOARD.cols - 1) || !int(pos.y, 0, 3) : !int(pos.slot, 0, BENCH_SIZE - 1)) return false;
        const key = pos.kind === 'field' ? 'f' + pos.x + ',' + pos.y : 'b' + pos.slot;
        if (positions.has(key)) return false;
        positions.add(key);
      }
      if (fieldUnits(player).length > player.level || player.units.filter(u => u.position.kind === 'bench').length > BENCH_SIZE) return false;
    }
    if (!poolConserved(state) || !Array.isArray(state.log) || state.log.length > 36 || state.log.some(row => !row || !int(row.id, 1, 1000000) || !int(row.round, 1, MAX_ROUNDS) || typeof row.text !== 'string' || row.text.length > 700)) return false;
    if (!Array.isArray(state.resultHistory) || state.resultHistory.length > 12 || state.resultHistory.some(r => !r || !int(r.round, 1, MAX_ROUNDS) || ![true, false, null].includes(r.won) || !int(r.gold, 0, 30) || !Array.isArray(r.eliminated))) return false;
    if (state.lastIncome !== null) {
      const income = state.lastIncome;
      if (!income || !['base', 'interest', 'streak', 'victory', 'total'].every(key => int(income[key], 0, 30))) return false;
      if (income.total !== income.base + income.interest + income.streak + income.victory) return false;
    }
    const human = getPlayer(state);
    if (state.phase === 'planning' && human.hp <= 0 || state.phase === 'spectate' && human.hp > 0) return false;
    const live = state.players.filter(p => p.hp > 0);
    if (state.phase === 'finished' && (live.length !== 1 || live[0].rank !== 1 || ranks.size !== 8)) return false;
    if (state.phase !== 'finished' && live.length < 2) return false;
    if (!Array.isArray(state.pairings) || state.pairings.length > 4) return false;
    if (state.phase !== 'finished') {
      const participants = new Set();
      for (const pair of state.pairings) {
        if (!pair || !playerIds.has(pair.a) || !playerIds.has(pair.b) || pair.a === pair.b || typeof pair.ghost !== 'boolean') return false;
        if (!getPlayer(state, pair.a)?.hp || !getPlayer(state, pair.b)?.hp || participants.has(pair.a) || (!pair.ghost && participants.has(pair.b))) return false;
        participants.add(pair.a); if (!pair.ghost) participants.add(pair.b);
      }
      if (participants.size !== live.length) return false;
    }
    if (!int(state.frameIndex, 0, MAX_FRAMES - 1)) return false;
    if (state.phase === 'battle') {
      const pending = state.pending;
      if (!pending || pending.round !== state.round || !Array.isArray(pending.results) || pending.results.length !== state.pairings.length || !validTrace(pending.watch) || pending.watch.round !== state.round || state.frameIndex >= pending.watch.frames.length) return false;
      for (let i = 0; i < state.pairings.length; i++) {
        const pair = state.pairings[i], result = pending.results[i];
        if (!result || result.a !== pair.a || result.b !== pair.b || result.ghost !== pair.ghost || !int(result.winnerSide, 0, 1) || !int(result.damage, 1, 100) || !int(result.survivors, 0, 8) || !int(result.starTotal, 0, 24)) return false;
      }
    } else if (state.pending !== null) return false;
    if (state.lastBattle !== null && !validTrace(state.lastBattle)) return false;
    if (new TextEncoder().encode(JSON.stringify(state)).length > 500 * 1024) return false;
    return true;
  } catch { return false; }
}
function serializeState(state, now = Date.now()) { return { ...state, savedAt: now }; }
function restoreState(value, now = Date.now()) {
  if (!isValidSave(value)) throw new Error('대전 저장 형식이나 버전이 맞지 않습니다. 현재 진행은 유지됩니다.');
  const state = JSON.parse(JSON.stringify(value));
  state.paused = state.phase === 'battle';
  state.savedAt = now;
  return state;
}

export { poolConserved, validTrace, isValidSave, serializeState, restoreState };
