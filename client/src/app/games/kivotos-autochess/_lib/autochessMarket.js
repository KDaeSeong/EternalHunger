import { STUDENTS, STUDENT_BY_ID, ACADEMIES, ROLES, SHOP_ODDS, BENCH_SIZE, MAX_LEVEL, XP_THRESHOLDS } from './autochessData.js';
function randomStep(seed) {
  let x = seed >>> 0;
  x ^= x << 13; x ^= x >>> 17; x ^= x << 5;
  return { seed: x >>> 0 || 1, value: (x >>> 0) / 4294967296 };
}
function takeRandom(state) { const r = randomStep(state.rng); state.rng = r.seed; return r.value; }
function copiesOf(unit) { return 3 ** (unit.star - 1); }
function getPlayer(state, id = 'p0') { return state.players.find(p => p.id === id); }
function fieldUnits(player) { return player.units.filter(u => u.position.kind === 'field'); }
function benchUnits(player) { return player.units.filter(u => u.position.kind === 'bench'); }
function appendLog(state, text) {
  state.log.unshift({ id: state.nextLogId++, round: state.round, text });
  state.log = state.log.slice(0, 36);
}
function oddsFor(player) {
  const weights = [...SHOP_ODDS[player.level]];
  const available = weights.map((w, i) => w > 0 ? i : -1).filter(i => i >= 0);
  const highest = available.at(-1);
  const shift = Math.min(weights[0] - 1, player.commander.luck * 2);
  if (highest > 0 && shift > 0) {
    weights[0] -= shift;
    if (highest === 1) weights[highest] += shift;
    else { weights[highest] += shift * .7; weights[highest - 1] += shift * .3; }
  }
  return weights.map(n => Math.round(n * 100) / 100);
}
function restoreShopCopies(state, player) {
  for (const id of player.shop) if (id) state.pool[id]++;
  player.shop = Array(5).fill(null);
}
function fillShop(state, player) {
  restoreShopCopies(state, player);
  const odds = oddsFor(player);
  for (let slot = 0; slot < 5; slot++) {
    const available = STUDENTS.filter(s => state.pool[s.id] > 0 && odds[s.cost - 1] > 0);
    if (!available.length) continue;
    const tiers = [...new Set(available.map(s => s.cost))];
    const sum = tiers.reduce((n, tier) => n + odds[tier - 1], 0);
    let roll = takeRandom(state) * sum, tier = tiers.at(-1);
    for (const candidate of tiers) { roll -= odds[candidate - 1]; if (roll < 0) { tier = candidate; break; } }
    const choices = available.filter(s => s.cost === tier);
    let bagRoll = takeRandom(state) * choices.reduce((n, s) => n + state.pool[s.id], 0);
    let chosen = choices.at(-1);
    for (const student of choices) { bagRoll -= state.pool[student.id]; if (bagRoll < 0) { chosen = student; break; } }
    player.shop[slot] = chosen.id; state.pool[chosen.id]--;
  }
}
function firstBenchSlot(player) {
  const occupied = new Set(benchUnits(player).map(u => u.position.slot));
  for (let i = 0; i < BENCH_SIZE; i++) if (!occupied.has(i)) return i;
  return -1;
}
function mergeUnits(player) {
  let merged = 0;
  for (const student of STUDENTS) for (let star = 1; star < 3; star++) {
    let matches = player.units.filter(u => u.studentId === student.id && u.star === star);
    while (matches.length >= 3) {
      matches.sort((a, b) => (a.position.kind === 'field' ? 0 : 1) - (b.position.kind === 'field' ? 0 : 1) || a.uid.localeCompare(b.uid));
      const [base, ...others] = matches.slice(0, 3);
      const removed = new Set(others.map(u => u.uid));
      base.star++;
      if (base.position.kind === 'bench' && base.position.slot < 0) {
        const donor = others.find(u => u.position.kind === 'bench' && u.position.slot >= 0);
        base.position.slot = donor ? donor.position.slot : 0;
      }
      player.units = player.units.filter(u => !removed.has(u.uid));
      merged++; matches = player.units.filter(u => u.studentId === student.id && u.star === star);
    }
  }
  return merged;
}
function buyOffer(state, player, index) {
  if (!Number.isInteger(index) || index < 0 || index > 4) return { ok: false, reason: '상점 칸을 확인하세요.' };
  const id = player.shop[index], student = STUDENT_BY_ID[id];
  if (!student) return { ok: false, reason: '이미 구매한 상점 칸입니다.' };
  if (player.gold < student.cost) return { ok: false, reason: '골드가 부족합니다.' };
  const benchSlot = firstBenchSlot(player);
  if (benchSlot < 0 && player.units.filter(u => u.studentId === id && u.star === 1).length < 2) return { ok: false, reason: '대기석이 가득 찼습니다. 배치하거나 판매해 공간을 확보하세요.' };
  player.gold -= student.cost; player.shop[index] = null;
  const unit = { uid: player.id + '-u' + state.nextUnitId++, studentId: id, star: 1, position: { kind: 'bench', slot: benchSlot } };
  player.units.push(unit);
  const merged = mergeUnits(player);
  return { ok: true, student, merged };
}
function sellOwnedUnit(state, player, uid) {
  const unit = player.units.find(u => u.uid === uid);
  if (!unit) return false;
  const count = copiesOf(unit);
  player.gold = Math.min(1000, player.gold + STUDENT_BY_ID[unit.studentId].cost * count);
  state.pool[unit.studentId] += count;
  player.units = player.units.filter(u => u.uid !== uid);
  return true;
}
function purchaseXp(player) {
  if (player.gold < 4 || player.level >= MAX_LEVEL) return false;
  player.gold -= 4; player.xp += 4;
  applyExperience(player);
  return true;
}
function applyExperience(player) {
  while (player.level < MAX_LEVEL && player.xp >= XP_THRESHOLDS[player.level]) {
    player.xp -= XP_THRESHOLDS[player.level]; player.level++;
  }
  if (player.level === MAX_LEVEL) player.xp = 0;
}
function nextInterest(player) { return Math.min(5 + Math.floor(player.commander.intelligence / 2), Math.floor(player.gold / 10)); }
function trainingPrice(player, stat) {
  const level = player.commander[stat];
  return Number.isInteger(level) && level < 5 ? 4 + level * 2 : Infinity;
}
function synergiesFor(player) {
  const ids = new Set(fieldUnits(player).map(u => u.studentId));
  const units = [...ids].map(id => STUDENT_BY_ID[id]);
  const academy = Object.entries(ACADEMIES).map(([id, def]) => {
    const count = units.filter(s => s.academy === id).length;
    return { id, ...def, count, tier: count >= 4 ? 2 : count >= 2 ? 1 : 0 };
  });
  const roles = Object.entries(ROLES).map(([id, def]) => {
    const count = units.filter(s => s.role === id).length;
    return { id, ...def, count, tier: count >= 4 ? 2 : count >= 2 ? 1 : 0 };
  });
  return { academy, roles };
}
function unitPower(unit) {
  const s = STUDENT_BY_ID[unit.studentId];
  return (s.cost + 1.5) * (unit.star === 3 ? 6.5 : unit.star === 2 ? 2.6 : 1);
}
function planBot(state, player) {
  if (player.hp <= 0) return;
  if (state.round > 1 && player.gold >= 14 && player.level < Math.min(8, 3 + Math.floor(state.round / 2))) purchaseXp(player);
  for (let attempt = 0; attempt < 16; attempt++) {
    const candidates = player.shop.map((id, i) => {
      const student = STUDENT_BY_ID[id];
      if (!student || player.gold < student.cost) return null;
      const owned = player.units.filter(u => u.studentId === id && u.star === 1).length;
      const focus = student.academy === player.focus ? 3 : 0;
      return { i, score: owned * 3.5 + focus + student.cost + takeRandom(state) * .8, student };
    }).filter(Boolean).sort((a, b) => b.score - a.score);
    if (!candidates.length || player.units.length >= player.level + 6) break;
    if (firstBenchSlot(player) < 0) {
      const sale = benchUnits(player).sort((a, b) => unitPower(a) - unitPower(b)).find(u => u.star === 1 && STUDENT_BY_ID[u.studentId].academy !== player.focus);
      if (sale) sellOwnedUnit(state, player, sale.uid);
    }
    const bought = buyOffer(state, player, candidates[0].i);
    if (!bought.ok) break;
    if (player.shop.every(s => !s) && player.gold >= 9) { player.gold -= 2; fillShop(state, player); }
  }
  if (state.round > 3 && player.gold >= 20) {
    player.gold -= 2; fillShop(state, player);
    for (let i = 0; i < 5; i++) {
      const id = player.shop[i], student = STUDENT_BY_ID[id];
      if (student && (student.academy === player.focus || player.units.some(u => u.studentId === id))) buyOffer(state, player, i);
    }
  }
  autoArrange(player);
}

function autoArrange(player) {
  const ranked = [...player.units].sort((a, b) => {
    const score = u => unitPower(u) + (STUDENT_BY_ID[u.studentId].academy === player.focus ? 2 : 0);
    return score(b) - score(a);
  });
  const team = ranked.slice(0, player.level), bench = ranked.slice(player.level);
  const used = new Set(), columnOrder = [2, 3, 1, 4, 0, 5];
  for (const unit of team) {
    const student = STUDENT_BY_ID[unit.studentId];
    const rowOrder = student.role === 'guard' ? [0, 1, 2, 3] : [2, 3, 1, 0];
    let spot;
    for (const y of rowOrder) {
      for (const x of columnOrder) if (!used.has(x + ',' + y)) { spot = { x, y }; break; }
      if (spot) break;
    }
    used.add(spot.x + ',' + spot.y); unit.position = { kind: 'field', ...spot };
  }
  bench.forEach((unit, slot) => { unit.position = { kind: 'bench', slot }; });
}

export { randomStep, takeRandom, copiesOf, getPlayer, fieldUnits, benchUnits, appendLog, oddsFor, fillShop, restoreShopCopies, firstBenchSlot, mergeUnits, buyOffer, sellOwnedUnit, purchaseXp, applyExperience, nextInterest, trainingPrice, synergiesFor, unitPower, planBot, autoArrange };
