import { SAVE_VERSION, LEGACY_SAVE_VERSION, LEGACY_STUDENT_IDS, MAX_MINERS, STEP_SECONDS, OFFLINE_CAP_SECONDS, ROUTE, PADS, STAT_DEFS, STUDENTS, ENEMY_TYPES } from './infiniteDefenseData.js';

const MAX_LOG = 36;
const MAX_FX = 24;
const MAX_ENEMIES = 100;
const MAX_CURRENCY = 1e12;
const ROUTE_LENGTH = ROUTE.slice(1).reduce((n, p, i) => n + Math.hypot(p.x - ROUTE[i].x, p.y - ROUTE[i].y), 0);
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
function finite(value, fallback = 0) { return Number.isFinite(Number(value)) ? Number(value) : fallback; }
function getStudent(id) { return STUDENTS.find(s => s.id === id); }
function round(value) { return Math.round(value * 1000) / 1000; }
function createNewState(options = {}) {
  const now = finite(options.now, Date.now());
  return {
    version: SAVE_VERSION, runId: options.runId || 'def-' + now.toString(36) + '-' + Math.random().toString(36).slice(2, 8),
    createdAt: now, savedAt: now, phase: 'build', paused: false, wave: 0, clearedWave: 0, firstClear: false,
    coins: 230, baseHp: 25, maxBaseHp: 25, mineLevel: 0, elapsed: 0, kills: 0, score: 0,
    nextEnemyId: 1, spawnIndex: 0, waveTime: 0, enemies: [], effects: [], upgrades: {},
    assignments: Object.fromEntries(STUDENTS.map(s => [s.id, { mode: 'reserve', padId: '', paid: false, power: 0, cooldown: 0 }])),
    log: [{ id: 0, text: '캐릭터를 방어 거점과 채굴장에 배치한 뒤 첫 웨이브를 시작하세요.' }], logId: 1,
  };
}
function addLog(state, text) {
  const id = state.logId;
  return { ...state, logId: id + 1, log: [{ id, text }, ...state.log].slice(0, MAX_LOG) };
}
function trainingFor(state, id) {
  const row = state.upgrades[id] || {};
  return Object.fromEntries(STAT_DEFS.map(s => [s.id, clamp(Math.floor(finite(row[s.id])), 0, 30)]));
}
function studentStats(state, id) {
  const student = getStudent(id);
  if (!student) return null;
  const training = trainingFor(state, id);
  const assignment = state.assignments[id];
  const dexterity = student.stats.dexterity + training.dexterity;
  const shooting = student.stats.shooting + training.shooting;
  const agility = student.stats.agility + training.agility;
  return {
    ...student, dexterity, shooting, agility,
    damage: round(student.damage * (1 + assignment.power * 0.32)),
    range: round(student.range + training.shooting * 0.12),
    interval: round(student.interval / (1 + training.agility * 0.075)),
    miningRate: round(student.mining * (1 + dexterity * 0.06)),
  };
}
function miningRate(state) {
  const workers = STUDENTS.reduce((n, s) => n + (state.assignments[s.id].mode === 'mine' ? studentStats(state, s.id).miningRate : 0), 0);
  return round((0.6 + workers) * (1 + state.mineLevel * 0.2));
}
function trainingCost(state, id, stat) {
  if (!getStudent(id) || !STAT_DEFS.some(s => s.id === stat)) return Infinity;
  const level = trainingFor(state, id)[stat];
  return level >= 30 ? Infinity : Math.round(32 * Math.pow(1.24, level));
}
function powerCost(state, id) {
  const student = getStudent(id);
  if (!student) return Infinity;
  const level = state.assignments[id].power;
  return level >= 12 ? Infinity : Math.round(student.cost * 0.65 * Math.pow(1.45, level));
}
function mineCost(state) { return state.mineLevel >= 20 ? Infinity : Math.round(90 * Math.pow(1.55, state.mineLevel)); }
function canManage(state) { return state.phase !== 'defeat'; }
function assignStudent(state, id, mode, padId = '') {
  const student = getStudent(id);
  if (!student || !['reserve', 'mine', 'defend'].includes(mode) || !canManage(state)) return state;
  const old = state.assignments[id];
  if (mode === 'mine' && old.mode !== 'mine' && STUDENTS.filter(s => state.assignments[s.id].mode === 'mine').length >= MAX_MINERS) return state;
  if (mode === 'defend' && (!PADS.some(p => p.id === padId)
      || STUDENTS.some(s => s.id !== id && state.assignments[s.id].mode === 'defend' && state.assignments[s.id].padId === padId))) return state;
  if (old.mode === mode && (mode !== 'defend' || old.padId === padId)) return state;
  const cost = mode === 'defend' && !old.paid ? student.cost : 0;
  if (state.coins < cost) return state;
  return addLog({
    ...state, coins: round(state.coins - cost),
    assignments: { ...state.assignments, [id]: { ...old, mode, padId: mode === 'defend' ? padId : '', paid: old.paid || mode === 'defend' } },
  }, student.name + ': ' + (mode === 'defend' ? padId.slice(1) + '번 거점 배치' : mode === 'mine' ? '채굴 시작' : '대기 전환'));
}
function trainStudent(state, id, stat) {
  const cost = trainingCost(state, id, stat);
  if (!canManage(state) || !Number.isFinite(cost) || state.coins < cost) return state;
  const row = trainingFor(state, id);
  return addLog({ ...state, coins: round(state.coins - cost), upgrades: { ...state.upgrades, [id]: { ...row, [stat]: row[stat] + 1 } } },
    getStudent(id).name + ' · ' + STAT_DEFS.find(s => s.id === stat).name + ' 훈련 +1');
}
function upgradePower(state, id) {
  const cost = powerCost(state, id);
  if (!canManage(state) || !Number.isFinite(cost) || state.coins < cost) return state;
  const row = state.assignments[id];
  return addLog({ ...state, coins: round(state.coins - cost), assignments: { ...state.assignments, [id]: { ...row, power: row.power + 1 } } },
    getStudent(id).name + ' 화력 강화 +' + (row.power + 1));
}
function upgradeMine(state) {
  const cost = mineCost(state);
  if (!canManage(state) || !Number.isFinite(cost) || state.coins < cost) return state;
  return addLog({ ...state, coins: round(state.coins - cost), mineLevel: state.mineLevel + 1 }, '채굴 설비 강화 +' + (state.mineLevel + 1));
}
function repairBase(state) {
  const cost = 55;
  if (!canManage(state) || state.phase === 'wave' || state.baseHp >= state.maxBaseHp || state.coins < cost) return state;
  return addLog({ ...state, coins: round(state.coins - cost), baseHp: Math.min(state.maxBaseHp, state.baseHp + 5) }, '거점 내구도 5 회복');
}
function wavePlan(wave) {
  const w = Math.max(1, Math.floor(finite(wave, 1)));
  const count = Math.min(48, 6 + Math.floor(w * 0.8));
  const bossWave = w % 20 === 0;
  const plan = [];
  for (let i = 0; i < count; i++) {
    const type = w >= 5 && i % 4 === 3 ? 'armored'
      : w >= 3 && i % 4 === 2 ? 'runner'
      : w >= 2 && i % 4 === 1 ? 'swarm' : 'scout';
    plan.push({ type, at: round(i * Math.max(0.35, 0.9 - w * 0.012)) });
  }
  if (bossWave) plan.push({ type: 'boss', at: 3.5 });
  return plan.sort((a, b) => a.at - b.at);
}
function spawnEnemy(type, wave, id) {
  const base = ENEMY_TYPES[type];
  const scale = Math.pow(1.115, Math.min(wave - 1, 100)) * (wave > 101 ? 1 + (wave - 101) * 0.35 : 1);
  const hp = round(base.hp * (type === 'boss' ? Math.pow(1.115, Math.max(0, Math.min(wave - 20, 81))) * (wave > 101 ? 1 + (wave - 101) * 0.35 : 1) : scale));
  return { id, type, hp, maxHp: hp, armor: round(base.armor * (1 + (wave - 1) * 0.025)),
    speed: base.speed * Math.min(1.6, 1 + wave * 0.006), reward: Math.round(base.reward * (1 + wave * 0.04)),
    leak: base.leak, distance: 0, slowUntil: 0, slowFactor: 0 };
}
function pointAt(distance) {
  let remaining = clamp(finite(distance), 0, ROUTE_LENGTH);
  for (let i = 1; i < ROUTE.length; i++) {
    const a = ROUTE[i - 1], b = ROUTE[i], length = Math.hypot(b.x - a.x, b.y - a.y);
    if (remaining <= length) return { x: a.x + (b.x - a.x) * remaining / length, y: a.y + (b.y - a.y) * remaining / length };
    remaining -= length;
  }
  return { ...ROUTE.at(-1) };
}
function startWave(state) {
  if (!['build', 'intermission', 'victory'].includes(state.phase) || state.baseHp <= 0 || state.paused) return state;
  if (!STUDENTS.some(s => state.assignments[s.id].mode === 'defend')) return state;
  const wave = state.wave + 1;
  return addLog({ ...state, phase: 'wave', wave, spawnIndex: 0, waveTime: 0, enemies: [], effects: [] },
    wave + '웨이브 시작' + (wave % 20 === 0 ? ' · 거점 파괴자 출현!' : wave > 20 ? ' · 무한 모드' : ''));
}
function setPaused(state, paused) { return state.phase === 'defeat' ? state : { ...state, paused: Boolean(paused) }; }
function step(state, dt) {
  const elapsed = round(state.elapsed + dt);
  let next = { ...state, elapsed, coins: Math.min(MAX_CURRENCY, round(state.coins + miningRate(state) * dt)),
    effects: state.effects.filter(fx => fx.until > elapsed), assignments: Object.fromEntries(STUDENTS.map(s => {
      const row = state.assignments[s.id];
      return [s.id, { ...row, cooldown: Math.max(0, round(row.cooldown - dt)) }];
    })) };
  if (state.phase !== 'wave') return next;
  next.waveTime = round(state.waveTime + dt);
  const plan = wavePlan(state.wave);
  next.enemies = state.enemies.map(e => ({ ...e }));
  while (next.spawnIndex < plan.length && plan[next.spawnIndex].at <= next.waveTime && next.enemies.length < MAX_ENEMIES) {
    next.enemies.push(spawnEnemy(plan[next.spawnIndex].type, state.wave, next.nextEnemyId++));
    next.spawnIndex++;
  }
  for (const student of STUDENTS) {
    const row = next.assignments[student.id];
    if (row.mode !== 'defend' || row.cooldown > 0) continue;
    const pad = PADS.find(p => p.id === row.padId);
    const stats = studentStats(next, student.id);
    const targets = next.enemies.filter(e => {
      const p = pointAt(e.distance);
      return e.hp > 0 && Math.hypot(p.x - pad.x, p.y - pad.y) <= stats.range;
    }).sort((a, b) => b.distance - a.distance || a.id - b.id);
    const target = targets[0];
    if (!target) continue;
    const targetPoint = pointAt(target.distance);
    const victims = stats.splash > 0 ? next.enemies.filter(e => e.hp > 0 && (() => {
      const p = pointAt(e.distance);
      return Math.hypot(p.x - targetPoint.x, p.y - targetPoint.y) <= stats.splash;
    })()) : [target];
    for (const victim of victims) {
      victim.hp = round(victim.hp - Math.max(1, stats.damage - victim.armor * (1 - stats.pierce)));
      if (stats.slow && victim.type !== 'boss') {
        victim.slowUntil = elapsed + 1.5;
        victim.slowFactor = stats.slow;
      }
    }
    row.cooldown = stats.interval;
    next.effects.push({ id: student.id + '-' + elapsed, from: { x: pad.x, y: pad.y }, to: targetPoint, color: student.color, until: elapsed + 0.22 });
  }
  let leaks = 0, killed = 0, bounty = 0;
  next.enemies = next.enemies.filter(e => {
    if (e.hp <= 0) { killed++; bounty += e.reward; return false; }
    const slow = e.slowUntil > elapsed ? 1 - e.slowFactor : 1;
    e.distance = round(e.distance + e.speed * slow * dt);
    if (e.distance >= ROUTE_LENGTH) { leaks += e.leak; return false; }
    return true;
  });
  next.effects = next.effects.slice(-MAX_FX);
  next.kills += killed;
  next.score += killed * 10 + bounty;
  next.coins = Math.min(MAX_CURRENCY, round(next.coins + bounty));
  next.baseHp = Math.max(0, next.baseHp - leaks);
  if (next.baseHp <= 0) return addLog({ ...next, phase: 'defeat', enemies: [], effects: [], paused: false }, next.wave + '웨이브에서 거점 방어 실패. 새 작전에서 다시 도전할 수 있습니다.');
  if (next.spawnIndex === plan.length && !next.enemies.length) {
    const reward = 35 + next.wave * 8;
    const firstClear = next.firstClear || next.wave >= 20;
    const phase = next.wave === 20 && !next.firstClear ? 'victory' : 'intermission';
    return addLog({ ...next, phase, clearedWave: next.wave, firstClear, coins: Math.min(MAX_CURRENCY, next.coins + reward), score: next.score + reward * 2 },
      next.wave + '웨이브 방어 성공 · 보급 +' + reward + (phase === 'victory' ? ' · 20웨이브 완수! 무한 모드가 열렸습니다.' : ''));
  }
  return next;
}
function advanceTime(state, seconds) {
  if (state.paused || state.phase === 'defeat') return state;
  const count = Math.floor(clamp(finite(seconds), 0, 60) / STEP_SECONDS + 1e-6);
  let next = state;
  for (let i = 0; i < count; i++) {
    next = step(next, STEP_SECONDS);
    if (next.phase === 'defeat' || (state.phase === 'wave' && next.phase !== 'wave')) break;
  }
  return next;
}
function applyOfflineMining(state, now = Date.now()) {
  const timestamp = finite(now, state.savedAt);
  const seconds = clamp((timestamp - state.savedAt) / 1000, 0, OFFLINE_CAP_SECONDS);
  if (seconds < 1 || state.phase === 'defeat') return { ...state, savedAt: Math.max(state.savedAt, timestamp), paused: false };
  const earned = round(seconds * miningRate(state));
  return addLog({ ...state, coins: Math.min(MAX_CURRENCY, round(state.coins + earned)), savedAt: Math.max(state.savedAt, timestamp), paused: false },
    '복귀 채굴 정산 +' + Math.floor(earned) + ' · 전투 진행은 그대로 유지됩니다. (최대 8시간)');
}
function serializeState(state, now = Date.now()) {
  return { ...state, savedAt: finite(now, Date.now()), effects: [], paused: Boolean(state.paused) };
}
function migrateSave(value) {
  if (value?.version === SAVE_VERSION) return value;
  if (value?.version !== LEGACY_SAVE_VERSION) return null;
  try {
    const allowed = new Set(LEGACY_STUDENT_IDS);
    if (!value.assignments || Array.isArray(value.assignments) || Object.keys(value.assignments).length !== allowed.size ||
        Object.keys(value.assignments).some(id => !allowed.has(id)) || !value.upgrades || Array.isArray(value.upgrades) ||
        Object.keys(value.upgrades).some(id => !allowed.has(id))) return null;
    const state = JSON.parse(JSON.stringify(value));
    state.version = SAVE_VERSION;
    for (const student of STUDENTS) if (!allowed.has(student.id)) {
      state.assignments[student.id] = { mode: 'reserve', padId: '', paid: false, power: 0, cooldown: 0 };
    }
    return state;
  } catch { return null; }
}
function isValidSave(value) {
  if (value?.version === LEGACY_SAVE_VERSION) return isValidSave(migrateSave(value));
  if (!value || typeof value !== 'object' || Array.isArray(value) || value.version !== SAVE_VERSION) return false;
  if (typeof value.runId !== 'string' || !value.runId || value.runId.length > 160) return false;
  const numeric = ['createdAt', 'savedAt', 'coins', 'baseHp', 'maxBaseHp', 'mineLevel', 'wave', 'clearedWave', 'elapsed', 'kills', 'score', 'nextEnemyId', 'spawnIndex', 'waveTime'];
  if (numeric.some(k => !Number.isFinite(value[k]) || value[k] < 0)) return false;
  if (value.coins > MAX_CURRENCY || value.maxBaseHp !== 25 || value.baseHp > 25 || value.mineLevel > 20) return false;
  if (!['build', 'wave', 'intermission', 'victory', 'defeat'].includes(value.phase)) return false;
  if (!Number.isInteger(value.wave) || value.clearedWave > value.wave || value.wave > 1000000) return false;
  if (value.phase === 'defeat' ? value.baseHp !== 0 : value.baseHp <= 0) return false;
  if (typeof value.firstClear !== 'boolean' || !value.assignments || !value.upgrades) return false;
  if (value.firstClear !== (value.clearedWave >= 20)) return false;
  if (Array.isArray(value.assignments) || Array.isArray(value.upgrades) || Object.keys(value.assignments).length !== STUDENTS.length ||
      Object.keys(value.assignments).some(id => !getStudent(id)) || Object.keys(value.upgrades).some(id => !getStudent(id))) return false;
  if (STUDENTS.filter(student => value.assignments[student.id]?.mode === 'mine').length > MAX_MINERS) return false;
  if (value.phase === 'build' && (value.wave !== 0 || value.clearedWave !== 0)) return false;
  if (value.phase === 'victory' && (value.wave !== 20 || value.clearedWave !== 20)) return false;
  if (value.phase === 'intermission' && value.wave !== value.clearedWave) return false;
  if (value.phase === 'wave' && value.wave !== value.clearedWave + 1) return false;
  const occupied = new Set();
  for (const student of STUDENTS) {
    const row = value.assignments[student.id];
    if (!row || !['reserve', 'mine', 'defend'].includes(row.mode) || typeof row.paid !== 'boolean'
        || !Number.isInteger(row.power) || row.power < 0 || row.power > 12 || !Number.isFinite(row.cooldown) || row.cooldown < 0 || row.cooldown > 10) return false;
    if (row.mode === 'defend') {
      if (!row.paid || !PADS.some(p => p.id === row.padId) || occupied.has(row.padId)) return false;
      occupied.add(row.padId);
    } else if (row.padId !== '') return false;
    const training = value.upgrades[student.id];
    if (training && STAT_DEFS.some(s => !Number.isInteger(training[s.id]) || training[s.id] < 0 || training[s.id] > 30)) return false;
  }
  if (!Array.isArray(value.enemies) || value.enemies.length > MAX_ENEMIES || !Array.isArray(value.log) || value.log.length > MAX_LOG) return false;
  if (value.phase !== 'wave' && value.enemies.length) return false;
  if (!Number.isInteger(value.spawnIndex) || value.spawnIndex > wavePlan(value.wave).length) return false;
  if (value.log.some(row => !row || !Number.isInteger(row.id) || typeof row.text !== 'string' || row.text.length > 500)) return false;
  const ids = new Set();
  for (const e of value.enemies) {
    if (!e || !ENEMY_TYPES[e.type] || !Number.isInteger(e.id) || e.id < 1 || ids.has(e.id) || e.id >= value.nextEnemyId) return false;
    ids.add(e.id);
    if (['hp', 'maxHp', 'armor', 'speed', 'reward', 'leak', 'distance', 'slowUntil', 'slowFactor'].some(k => !Number.isFinite(e[k]) || e[k] < 0)) return false;
    if (e.hp <= 0 || e.hp > e.maxHp || e.distance >= ROUTE_LENGTH || e.slowFactor > 0.9 || e.speed > 10 || e.maxHp > 1e12 || e.leak > 100) return false;
  }
  return true;
}
function restoreState(value, now = Date.now()) {
  const migrated = migrateSave(value);
  if (!isValidSave(migrated)) throw new Error('저장 형식이나 버전이 맞지 않아 불러오기를 중단했습니다. 현재 진행은 유지됩니다.');
  const copy = JSON.parse(JSON.stringify(migrated));
  const base = createNewState({ now: copy.createdAt, runId: copy.runId });
  const state = { ...base, ...copy, effects: [], paused: false, logId: Math.max(finite(copy.logId, 0), ...copy.log.map(row => row.id + 1), 1) };
  return { ...applyOfflineMining(state, now), paused: state.phase === 'wave' || Boolean(copy.paused) };
}
function scoreState(state) { return Math.floor(state.score + state.clearedWave * 100 + state.baseHp * 5); }
function summaryForState(state) {
  return { wave: state.wave, clearedWave: state.clearedWave, baseHp: state.baseHp, kills: state.kills,
    miningPerSecond: miningRate(state), firstClear: state.firstClear, phase: state.phase, score: scoreState(state) };
}

export { ROUTE_LENGTH, MAX_LOG, MAX_FX, MAX_ENEMIES, createNewState, getStudent, studentStats, miningRate, trainingCost, powerCost, mineCost, assignStudent, trainStudent, upgradePower, upgradeMine, repairBase, wavePlan, pointAt, startWave, setPaused, advanceTime, applyOfflineMining, serializeState, migrateSave, isValidSave, restoreState, scoreState, summaryForState };
