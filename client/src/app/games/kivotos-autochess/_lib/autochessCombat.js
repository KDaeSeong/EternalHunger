import { BOARD, MAX_FRAMES, STUDENT_BY_ID } from './autochessData.js';
import { fieldUnits, synergiesFor, randomStep } from './autochessMarket.js';
const distance = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
function battleTeam(player, side) {
  const traits = synergiesFor(player);
  const trait = (type, id) => traits[type].find(t => t.id === id).tier;
  const abydos = trait('academy', 'abydos'), gehenna = trait('academy', 'gehenna');
  const millennium = trait('academy', 'millennium'), trinity = trait('academy', 'trinity');
  return fieldUnits(player).map(unit => {
    const student = STUDENT_BY_ID[unit.studentId], starHp = [0, 1, 1.8, 3.3][unit.star], starAtk = [0, 1, 1.7, 2.9][unit.star];
    const guard = student.role === 'guard' ? trait('roles', 'guard') : 0;
    const shooter = student.role === 'shooter' ? trait('roles', 'shooter') : 0;
    const support = student.role === 'support' ? trait('roles', 'support') : 0;
    const maxHp = Math.round(student.hp * starHp * (1 + guard * .2));
    return {
      uid: unit.uid, studentId: unit.studentId, side, star: unit.star,
      x: side === 0 ? unit.position.x : BOARD.cols - 1 - unit.position.x,
      y: side === 0 ? 4 + unit.position.y : 3 - unit.position.y,
      hp: maxHp, maxHp, atk: student.atk * starAtk * [1, 1.12, 1.25][gehenna],
      armor: student.role === 'guard' ? 28 : 8, range: student.range,
      interval: student.interval / (1 + shooter * .15), cooldown: 0,
      mp: Math.min(100, millennium * 15 + (student.role === 'support' ? 20 : 0)),
      manaMul: 1 + millennium * .2, skillMul: 1 + support * .2,
      shield: Math.round(maxHp * [0, .15, .28][abydos]), lifesteal: [0, .1, .22][trinity],
      skill: student.skill, moveCooldown: 0, buffUntil: 0, buffPower: 1,
    };
  });
}
function nextMove(actor, target, actors) {
  const blocked = new Set(actors.filter(a => a.hp > 0 && a !== actor).map(a => a.x + ',' + a.y));
  const visited = new Set([actor.x + ',' + actor.y]);
  const queue = [{ x: actor.x, y: actor.y, first: null }];
  for (let index = 0; index < queue.length; index++) {
    const cell = queue[index];
    if (cell.first && distance(cell, target) <= actor.range) return cell.first;
    const forward = actor.side === 0 ? -1 : 1;
    const candidates = [{ x: cell.x, y: cell.y + forward }, { x: cell.x - 1, y: cell.y }, { x: cell.x + 1, y: cell.y }, { x: cell.x, y: cell.y - forward }]
      .filter(p => p.x >= 0 && p.x < BOARD.cols && p.y >= 0 && p.y < BOARD.rows)
      .sort((a, b) => distance(a, target) - distance(b, target));
    for (const candidate of candidates) {
      const key = candidate.x + ',' + candidate.y;
      if (blocked.has(key) || visited.has(key)) continue;
      visited.add(key);
      queue.push({ ...candidate, first: cell.first || candidate });
    }
  }
  return null;
}
function compactFrame(time, actors, effects) {
  return [Math.round(time * 10) / 10, actors.map(a => [
    a.uid, a.studentId, a.side, a.x, a.y, Math.max(0, Math.round(a.hp)), a.maxHp,
    Math.round(a.mp), Math.round(a.shield), a.star,
  ]), effects.slice(-12)];
}
function simulateBattle(left, right, seed, trace = true) {
  let rng = seed >>> 0 || 1;
  const random = () => { const r = randomStep(rng); rng = r.seed; return r.value; };
  const actors = [...battleTeam(left, 0), ...battleTeam(right, 1)];
  for (const a of actors) a.cooldown = .15 + random() * .4;
  const frames = trace ? [compactFrame(0, actors, [])] : [];
  let effects = [], tick = 0;
  const deal = (from, target, amount, kind, pierce = false) => {
    if (!target || target.hp <= 0) return 0;
    const damage = Math.max(1, Math.round(amount * (pierce ? 1 : 100 / (100 + target.armor))));
    const absorbed = Math.min(target.shield, damage);
    target.shield -= absorbed;
    const hpDamage = Math.min(target.hp, damage - absorbed);
    target.hp -= hpDamage; target.mp = Math.min(100, target.mp + 5 * target.manaMul);
    effects.push([from.uid, target.uid, kind, damage]);
    return hpDamage;
  };
  for (tick = 1; tick <= 300; tick++) {
    if (!actors.some(a => a.side === 0 && a.hp > 0) || !actors.some(a => a.side === 1 && a.hp > 0)) break;
    const time = tick * .2;
    if (tick % 2 === 1) effects = [];
    const order = actors.map((a, i) => ({ a, key: random(), i })).sort((a, b) => a.key - b.key || a.i - b.i).map(row => row.a);
    for (const actor of order) {
      if (actor.hp <= 0) continue;
      actor.cooldown = Math.max(0, actor.cooldown - .2); actor.moveCooldown = Math.max(0, actor.moveCooldown - .2);
      const enemies = actors.filter(a => a.side !== actor.side && a.hp > 0);
      if (!enemies.length) continue;
      enemies.sort((a, b) => distance(actor, a) - distance(actor, b) || a.hp / a.maxHp - b.hp / b.maxHp || a.uid.localeCompare(b.uid));
      const target = enemies[0];
      if (distance(actor, target) > actor.range) {
        if (actor.moveCooldown <= 0) {
          const move = nextMove(actor, target, actors);
          if (move) { actor.x = move.x; actor.y = move.y; actor.moveCooldown = .4; }
        }
        continue;
      }
      if (actor.cooldown > 0) continue;
      const power = actor.atk * (actor.buffUntil > time ? actor.buffPower : 1);
      if (actor.mp >= 100) {
        actor.mp = 0;
        const allies = actors.filter(a => a.side === actor.side && a.hp > 0);
        if (actor.skill === 'heal') {
          const injured = [...allies].sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp).slice(0, 3);
          for (const ally of injured) {
            const heal = Math.round((power * 2.3 + 50) * actor.skillMul), actual = Math.min(heal, ally.maxHp - ally.hp);
            ally.hp += actual; effects.push([actor.uid, ally.uid, 'heal', actual]);
          }
        } else if (actor.skill === 'shield') {
          for (const ally of allies.filter(a => a === actor || distance(actor, a) <= 1)) {
            const shield = Math.round(ally.maxHp * (ally === actor ? .35 : .15) * actor.skillMul);
            ally.shield = Math.min(ally.maxHp * .6, ally.shield + shield);
            effects.push([actor.uid, ally.uid, 'shield', shield]);
          }
        } else if (actor.skill === 'rally') {
          for (const ally of allies) {
            ally.buffPower = Math.max(ally.buffUntil > time ? ally.buffPower : 1, 1 + .2 * actor.skillMul);
            ally.buffUntil = time + 6; ally.mp = Math.min(100, ally.mp + 15 * actor.skillMul);
          }
          effects.push([actor.uid, actor.uid, 'buff', Math.round(20 * actor.skillMul)]);
        } else if (actor.skill === 'blast') {
          for (const enemy of enemies.filter(e => distance(e, target) <= 1)) deal(actor, enemy, power * 2.15 * actor.skillMul, 'skill');
        } else if (actor.skill === 'pierce') {
          for (const enemy of enemies.filter(e => Math.abs(e.x - target.x) <= 1).slice(0, 3)) deal(actor, enemy, power * 2.4 * actor.skillMul, 'skill', true);
        } else deal(actor, target, power * 3.2 * actor.skillMul, 'skill');
      } else {
        const dealt = deal(actor, target, power * (random() < .1 ? 1.5 : 1), 'attack');
        actor.mp = Math.min(100, actor.mp + 20 * actor.manaMul);
        actor.hp = Math.min(actor.maxHp, actor.hp + dealt * actor.lifesteal);
      }
      actor.cooldown = actor.interval;
    }
    if (trace && tick % 2 === 0) frames.push(compactFrame(time, actors, effects));
  }
  const alive = [0, 1].map(side => actors.filter(a => a.side === side && a.hp > 0));
  let winnerSide, reason = '격파';
  if (!alive[0].length && alive[1].length) winnerSide = 1;
  else if (!alive[1].length && alive[0].length) winnerSide = 0;
  else {
    reason = '제한시간 판정';
    const strength = alive.map(rows => rows.reduce((n, a) => n + a.hp / a.maxHp + a.star * .02, 0));
    winnerSide = Math.abs(strength[0] - strength[1]) < .0001 ? (random() < .5 ? 0 : 1) : strength[0] > strength[1] ? 0 : 1;
  }
  if (trace && (frames.at(-1)?.[0] !== Math.min(60, tick * .2))) frames.push(compactFrame(Math.min(60, tick * .2), actors, effects));
  return {
    winnerSide, winnerId: winnerSide === 0 ? left.id : right.id, reason,
    survivors: alive[winnerSide].length, starTotal: alive[winnerSide].reduce((n, a) => n + a.star, 0),
    duration: Math.min(60, tick * .2), frames: frames.slice(0, MAX_FRAMES),
  };
}

export { battleTeam, nextMove, compactFrame, simulateBattle };
