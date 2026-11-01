import { SAVE_VERSION, ACADEMIES, STUDENTS, STUDENT_BY_ID, COPIES_BY_COST, BOT_NAMES, BOARD, MAX_LEVEL, MAX_ROUNDS, BENCH_SIZE } from './autochessData.js';
import { takeRandom, copiesOf, getPlayer, fieldUnits, appendLog, fillShop, restoreShopCopies, buyOffer, sellOwnedUnit, purchaseXp, applyExperience, nextInterest, trainingPrice, unitPower, planBot, autoArrange } from './autochessMarket.js';
import { simulateBattle } from './autochessCombat.js';
function cloneState(state) {
  return { ...state, pool: { ...state.pool }, log: [...state.log], players: state.players.map(p => ({
    ...p, commander: { ...p.commander }, shop: [...p.shop],
    units: p.units.map(u => ({ ...u, position: { ...u.position } })),
  })) };
}
function shuffle(state, values) {
  const result = [...values];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(takeRandom(state) * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
function preparePlanning(state) {
  const alive = state.players.filter(p => p.hp > 0);
  for (const player of shuffle(state, alive)) if (!player.locked || player.id !== 'p0') fillShop(state, player);
  for (const player of alive) if (player.id !== 'p0') planBot(state, player);
  const order = shuffle(state, alive.map(p => p.id));
  state.pairings = [];
  for (let i = 0; i < order.length; i += 2) {
    const a = order[i], b = order[i + 1] || order.find(id => id !== a);
    if (b) state.pairings.push({ a, b, ghost: !order[i + 1] });
  }
  state.phase = getPlayer(state).hp > 0 ? 'planning' : 'spectate';
  state.pending = null; state.frameIndex = 0; state.paused = false;
}
function createNewState(options = {}) {
  const now = Number.isFinite(options.now) ? options.now : Date.now();
  const seed = Number.isInteger(options.seed) ? options.seed >>> 0 || 1 : (now >>> 0 || 8675309);
  const academyKeys = Object.keys(ACADEMIES);
  const state = {
    version: SAVE_VERSION, runId: options.runId || 'ac-' + now.toString(36) + '-' + seed.toString(36),
    createdAt: now, savedAt: now, rng: seed, round: 1, phase: 'planning', paused: false,
    nextUnitId: 1, nextLogId: 1, pool: Object.fromEntries(STUDENTS.map(s => [s.id, COPIES_BY_COST[s.cost]])),
    players: Array.from({ length: 8 }, (_, i) => ({
      id: 'p' + i, name: i === 0 ? '선생님' : BOT_NAMES[i - 1], hp: 40, gold: 12, level: 3, xp: 0,
      streak: 0, rank: 0, focus: i === 0 ? 'balanced' : academyKeys[(i - 1 + 4) % 4],
      commander: { intelligence: 0, luck: 0 }, shop: Array(5).fill(null), locked: false, units: [],
    })),
    pairings: [], pending: null, lastBattle: null, frameIndex: 0, lastIncome: null, resultHistory: [], log: [],
  };
  preparePlanning(state);
  appendLog(state, '학생을 구매하고 전장에 편성한 뒤 전투를 시작하세요. AI 7명과 같은 기물 풀을 사용합니다.');
  return state;
}
function canPlan(state) { return state.phase === 'planning' && getPlayer(state).hp > 0; }
function planAction(state, callback) {
  if (!canPlan(state)) return state;
  const next = cloneState(state);
  const text = callback(next, getPlayer(next));
  if (!text) return state;
  appendLog(next, text); return next;
}
function buyUnit(state, index) {
  return planAction(state, (next, player) => {
    const result = buyOffer(next, player, index);
    return result.ok ? result.student.name + ' 구매' + (result.merged ? ' · 자동 합성 ' + result.merged + '회' : '') : result.reason;
  });
}
function rerollShop(state) {
  return planAction(state, (next, player) => {
    if (player.gold < 2) return '리롤하려면 2골드가 필요합니다.';
    player.gold -= 2;
    const refunded = takeRandom(next) < player.commander.intelligence * .04;
    if (refunded) player.gold += 2;
    fillShop(next, player);
    return '상점을 리롤했습니다.' + (refunded ? ' 지능 보정으로 2골드를 환급했습니다.' : ' 비용 2골드.');
  });
}
function toggleShopLock(state) {
  return planAction(state, (_, player) => { player.locked = !player.locked; return player.locked ? '다음 라운드까지 상점 구성을 잠갔습니다.' : '상점 잠금을 해제했습니다.'; });
}
function buyExperience(state) {
  return planAction(state, (_, player) => {
    const level = player.level;
    if (!purchaseXp(player)) return player.level >= MAX_LEVEL ? '최고 레벨입니다.' : '경험치 구매에 4골드가 필요합니다.';
    return '경험치 +4 · 비용 4골드' + (player.level > level ? ' · 레벨 ' + player.level + ' 달성!' : '');
  });
}
function trainCommander(state, stat) {
  if (!['intelligence', 'luck'].includes(stat)) return state;
  return planAction(state, (_, player) => {
    const price = trainingPrice(player, stat);
    if (!Number.isFinite(price)) return '지휘 훈련은 각 5단계까지 가능합니다.';
    if (player.gold < price) return '지휘 훈련 골드가 부족합니다.';
    player.gold -= price; player.commander[stat]++;
    return (stat === 'intelligence' ? '지능' : '행운') + ' 훈련 +1 · 비용 ' + price + '골드';
  });
}
function moveUnit(state, uid, target) {
  if (!target || !['field', 'bench'].includes(target.kind)) return state;
  if (target.kind === 'field' && (!Number.isInteger(target.x) || target.x < 0 || target.x >= BOARD.cols || !Number.isInteger(target.y) || target.y < 0 || target.y > 3)) return state;
  if (target.kind === 'bench' && (!Number.isInteger(target.slot) || target.slot < 0 || target.slot >= BENCH_SIZE)) return state;
  return planAction(state, (_, player) => {
    const unit = player.units.find(u => u.uid === uid);
    if (!unit) return '';
    const same = pos => pos.kind === target.kind && (pos.kind === 'field' ? pos.x === target.x && pos.y === target.y : pos.slot === target.slot);
    if (same(unit.position)) return '';
    const occupied = player.units.find(u => u.uid !== uid && same(u.position));
    if (unit.position.kind === 'bench' && target.kind === 'field' && !occupied && fieldUnits(player).length >= player.level) return '전장 정원이 가득 찼습니다. 레벨을 올리거나 위치를 교환하세요.';
    const previous = { ...unit.position };
    unit.position = { ...target };
    if (occupied) occupied.position = previous;
    return STUDENT_BY_ID[unit.studentId].name + (target.kind === 'field' ? ' 전장 배치' : ' 대기석 이동') + (occupied ? ' · 위치 교환' : '');
  });
}
function autoFormation(state) {
  return planAction(state, (_, player) => {
    if (!player.units.length) return '먼저 상점에서 학생을 구매하세요.';
    autoArrange(player);
    return '보유 학생 중 전투력이 높은 학생을 자동 편성했습니다. 골드를 사용하지 않습니다.';
  });
}
function sellUnit(state, uid) {
  return planAction(state, (next, player) => {
    const unit = player.units.find(u => u.uid === uid);
    if (!unit) return '';
    const label = STUDENT_BY_ID[unit.studentId].name + ' ' + unit.star + '성';
    sellOwnedUnit(next, player, uid);
    return label + ' 판매 · 기물을 공용 풀로 반환했습니다.';
  });
}
function beginCombat(state) {
  if (!['planning', 'spectate'].includes(state.phase)) return state;
  if (getPlayer(state).hp > 0 && !fieldUnits(getPlayer(state)).length) {
    const next = cloneState(state); appendLog(next, '전장에 학생을 한 명 이상 편성하세요.'); return next;
  }
  const next = cloneState(state), results = [];
  let watch = null;
  for (const pair of next.pairings) {
    const left = getPlayer(next, pair.a), originalRight = getPlayer(next, pair.b);
    const right = pair.ghost ? { ...originalRight, id: 'ghost-' + originalRight.id, name: originalRight.name + '의 고스트' } : originalRight;
    const isHumanMatch = pair.a === 'p0' || (!pair.ghost && pair.b === 'p0');
    const keepTrace = isHumanMatch || (getPlayer(next).hp <= 0 && !watch);
    const seed = Math.floor(takeRandom(next) * 4294967295) || 1;
    const battle = simulateBattle(left, right, seed, keepTrace);
    const damage = 2 + Math.floor(next.round / 3) + Math.max(1, Math.ceil(battle.starTotal / 2)) + Math.max(0, next.round - 15) * 2;
    results.push({ ...pair, winnerSide: battle.winnerSide, survivors: battle.survivors, starTotal: battle.starTotal, damage, reason: battle.reason });
    if (keepTrace) watch = {
      round: next.round, left: { id: left.id, name: left.name }, right: { id: right.id, name: right.name },
      humanMatch: isHumanMatch, winnerSide: battle.winnerSide, reason: battle.reason,
      duration: battle.duration, frames: battle.frames,
    };
  }
  next.phase = 'battle'; next.frameIndex = 0; next.paused = false; next.lastBattle = null;
  next.pending = { round: next.round, results, watch };
  appendLog(next, next.round + '라운드 자동 전투 시작. 전투 결과는 한 번만 확정됩니다.');
  return next;
}
function releasePlayer(state, player) {
  restoreShopCopies(state, player);
  for (const unit of player.units) state.pool[unit.studentId] += copiesOf(unit);
  player.units = [];
}
function finishBattle(state) {
  if (state.phase !== 'battle' || !state.pending || state.pending.round !== state.round) return state;
  const next = cloneState(state), pending = next.pending;
  const aliveBefore = next.players.filter(p => p.hp > 0), priorHp = new Map(aliveBefore.map(p => [p.id, p.hp]));
  const priorPower = new Map(aliveBefore.map(p => [p.id, p.units.reduce((n, u) => n + unitPower(u), 0)]));
  for (const result of pending.results) {
    const a = getPlayer(next, result.a), b = result.ghost ? null : getPlayer(next, result.b);
    const winner = result.winnerSide === 0 ? a : b, loser = result.winnerSide === 0 ? b : a;
    if (winner) winner.streak = winner.streak > 0 ? winner.streak + 1 : 1;
    if (loser) { loser.streak = loser.streak < 0 ? loser.streak - 1 : -1; loser.hp = Math.max(0, loser.hp - result.damage); }
  }
  const eliminated = aliveBefore.filter(p => p.hp <= 0).sort((a, b) => priorHp.get(a.id) - priorHp.get(b.id) || priorPower.get(a.id) - priorPower.get(b.id) || a.id.localeCompare(b.id));
  let rank = aliveBefore.length;
  for (const player of eliminated) { player.rank = rank--; releasePlayer(next, player); }
  next.lastIncome = { base: 0, interest: 0, streak: 0, victory: 0, total: 0 };
  for (const player of next.players.filter(p => p.hp > 0)) {
    const income = { base: 5, interest: nextInterest(player), streak: Math.min(3, Math.floor(Math.abs(player.streak) / 2)), victory: player.streak > 0 ? 1 : 0 };
    income.total = income.base + income.interest + income.streak + income.victory;
    player.gold = Math.min(1000, player.gold + income.total); player.xp += 2; applyExperience(player);
    if (player.id === 'p0') next.lastIncome = income;
  }
  const humanResult = pending.results.find(r => r.a === 'p0' || (!r.ghost && r.b === 'p0'));
  const humanWon = humanResult ? (humanResult.a === 'p0' ? humanResult.winnerSide === 0 : humanResult.winnerSide === 1) : null;
  next.resultHistory = [{ round: next.round, won: humanWon, gold: next.lastIncome.total, eliminated: eliminated.map(p => p.name) }, ...next.resultHistory].slice(0, 12);
  next.lastBattle = pending.watch;
  next.pending = null; next.frameIndex = 0; next.paused = false;
  const alive = next.players.filter(p => p.hp > 0);
  appendLog(next, next.round + '라운드 ' + (humanWon === null ? '관전 종료' : humanWon ? '승리' : '패배') + ' · 수입 +' + next.lastIncome.total + (eliminated.length ? ' · 탈락 ' + eliminated.map(p => p.name).join(', ') : ''));
  if (alive.length <= 1 || next.round >= MAX_ROUNDS) {
    const ranked = [...alive].sort((a, b) => b.hp - a.hp || b.units.reduce((n, u) => n + unitPower(u), 0) - a.units.reduce((n, u) => n + unitPower(u), 0) || a.id.localeCompare(b.id));
    ranked.forEach((p, i) => { p.rank = i + 1; if (i > 0) { p.hp = 0; releasePlayer(next, p); } });
    next.phase = 'finished';
    appendLog(next, '최종 ' + getPlayer(next).rank + '위 · 우승 ' + (ranked[0]?.name || '판정 종료'));
  } else { next.round++; preparePlanning(next); }
  return next;
}
function advancePlayback(state) {
  if (state.phase !== 'battle' || state.paused || !state.pending?.watch) return state;
  if (state.frameIndex >= state.pending.watch.frames.length - 1) return finishBattle(state);
  return { ...state, frameIndex: state.frameIndex + 1 };
}
function setPaused(state, paused) { return state.phase === 'battle' ? { ...state, paused: Boolean(paused) } : state; }
function finishSpectating(state) {
  if (state.phase !== 'spectate') return state;
  let next = state;
  for (let i = 0; i < MAX_ROUNDS && next.phase !== 'finished'; i++) next = finishBattle(beginCombat(next));
  return next;
}
function standings(state) {
  return [...state.players].sort((a, b) => (b.hp > 0 ? 1 : 0) - (a.hp > 0 ? 1 : 0) || (a.hp > 0 ? b.hp - a.hp : a.rank - b.rank) || a.id.localeCompare(b.id));
}
function nextOpponent(state) {
  const match = state.pairings.find(p => p.a === 'p0' || (!p.ghost && p.b === 'p0'));
  if (!match) return null;
  const id = match.a === 'p0' ? match.b : match.a;
  return { player: getPlayer(state, id), ghost: match.ghost && match.a === 'p0' };
}
function scoreState(state) {
  const human = getPlayer(state);
  return Math.max(0, (human.rank ? 9 - human.rank : 0) * 1000 + state.round * 50 + human.hp * 10);
}
function summaryForState(state) {
  const human = getPlayer(state);
  return { round: state.round, hp: human.hp, gold: human.gold, level: human.level, rank: human.rank, alive: state.players.filter(p => p.hp > 0).length, phase: state.phase, score: scoreState(state) };
}

function setPreferredAcademy(state, academy) {
  if (![...Object.keys(ACADEMIES), 'balanced'].includes(academy)) return state;
  return planAction(state, (_, player) => { player.focus = academy; return '자동 편성 선호: ' + (ACADEMIES[academy]?.name || '균형'); });
}

export { cloneState, createNewState, setPreferredAcademy, buyUnit, rerollShop, toggleShopLock, buyExperience, trainCommander, moveUnit, autoFormation, sellUnit, beginCombat, finishBattle, advancePlayback, setPaused, finishSpectating, standings, nextOpponent, scoreState, summaryForState };
