import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { combatPresentation } from '../src/app/games/kivotos-autochess/_lib/autochessCombatEffects.js';
import { boardTeamsFor } from '../src/app/games/kivotos-autochess/_lib/autochessBoardTeams.js';
import { STUDENT_BY_ID } from '../src/app/games/kivotos-autochess/_lib/autochessData.js';
import { simulateBattle } from '../src/app/games/kivotos-autochess/_lib/autochessCombat.js';
import { restoreState, serializeState } from '../src/app/games/kivotos-autochess/_lib/autochessSave.js';

let passed = 0;
const check = (name, run) => { run(); passed++; console.log('PASS ' + name); };
const player = { id: 'p0', name: '선생님' }, enemy = { id: 'p1', name: '상대 팀' };
const teams = boardTeamsFor(player, enemy, { left: enemy, right: player });
const actor = (uid, id, side, x, y, hp = 100) => [uid, id, side, x, y, hp, 1000, 0, 0, 1];
const units = [
  actor('p0-u1', 'serika', 1, 2, 1), actor('p1-u1', 'serika', 0, 2, 5),
  actor('p0-u2', 'nonomi', 1, 3, 1), actor('p0-u3', 'aris', 1, 4, 1),
  actor('p0-u4', 'ayane', 1, 1, 1), actor('p0-u5', 'yuuka', 1, 0, 1),
  actor('p0-u6', 'ako', 1, 5, 1), actor('p1-u2', 'haruka', 0, 3, 5),
];
const present = rows => combatPresentation([1.2, units, rows], teams);
check('direction and team colors follow attacker identity even with the human on top', () => {
  const { effects } = present([['p0-u1', 'p1-u1', 'attack', 35], ['p1-u1', 'p0-u1', 'attack', 42]]);
  assert.equal(effects[0].from.badge, '아군'); assert.equal(effects[0].from.tone, 'blue');
  assert.equal(effects[1].from.tone, 'red'); assert.notEqual(effects[0].color, effects[1].color);
  assert.equal(effects[0].to.uid, 'p1-u1'); assert(effects[0].link.y1 < effects[0].link.y2);
  assert(effects[1].link.y1 > effects[1].link.y2);
});
check('identical character names on opposing sides remain distinct by unit ID', () => {
  const fx = present([['p0-u1', 'p1-u1', 'attack', 50]]).effects[0];
  assert.equal(fx.from.name, fx.to.name); assert.notEqual(fx.from.uid, fx.to.uid);
  assert.notEqual(fx.from.badge, fx.to.badge);
});
check('projectiles stop before portraits and all arrow coordinates are finite', () => {
  const fx = present([['p0-u1', 'p1-u1', 'attack', 35]]).effects[0];
  assert(fx.link.y1 > fx.from.point.y); assert(fx.link.y2 < fx.to.point.y);
  assert(fx.link.arrow.split(/[ ,]/).every(value => Number.isFinite(Number(value))));
});
check('blast and piercing skills use the actual caster skill names and separate variants', () => {
  const effects = present([['p0-u2', 'p1-u1', 'skill', 123], ['p0-u3', 'p1-u1', 'skill', 320]]).effects;
  assert.equal(effects[0].variant, 'blast'); assert.equal(effects[0].label, STUDENT_BY_ID.nonomi.skillName);
  assert.equal(effects[1].variant, 'pierce'); assert.equal(effects[1].label, STUDENT_BY_ID.aris.skillName);
});
check('area attacks group the caster and list every actual target without inventing a radius', () => {
  const result = present([['p0-u2', 'p1-u1', 'skill', 123], ['p0-u2', 'p1-u2', 'skill', 125]]);
  assert.equal(result.actions.length, 1); assert.equal(result.actions[0].targets.length, 2);
  assert.equal(result.effects.length, 2); assert.equal(result.casts.length, 1);
});
check('healing, shielding and rally have distinct symbols, colors and skill names', () => {
  const result = present([['p0-u4', 'p0-u1', 'heal', 90], ['p0-u5', 'p0-u1', 'shield', 120], ['p0-u6', 'p0-u6', 'buff', 20]]);
  assert.deepEqual(result.effects.map(fx => fx.amountLabel), ['+90', '◇120', '강화']);
  assert.equal(new Set(result.effects.map(fx => fx.color)).size, 3);
  assert.equal(result.actions[0].label, STUDENT_BY_ID.ako.skillName);
});
check('self-casts produce visible impact and cast labels without zero-length projectiles', () => {
  const result = present([['p0-u5', 'p0-u5', 'shield', 123]]);
  assert.equal(result.effects[0].link, undefined); assert.equal(result.casts.length, 1);
  assert(Math.abs(result.effects[0].x - 100 / 12) < 1e-9); assert(result.effects[0].y > 0);
});
check('passive NTE shields are labeled separately from the caster active skill', () => {
  const result = present([['p0-u2', 'p0-u2', 'shield', 120], ['p0-u2', 'p1-u1', 'skill', 125]]);
  assert.equal(result.effects[0].label, '이상 차폐');
  assert.equal(result.casts[0].label, STUDENT_BY_ID.nonomi.skillName);
});
check('several hits on the same unit occupy separate number lanes', () => {
  const result = present([['p0-u2', 'p1-u1', 'skill', 123], ['p0-u1', 'p1-u1', 'attack', 35]]);
  assert.deepEqual(result.effects.map(fx => fx.stack), [0, 1]);
});
check('dead targets retain their recorded location and show a single defeat label', () => {
  const dead = units.map(unit => [...unit]); dead[1][5] = 0;
  const result = combatPresentation([1.2, dead, [['p0-u1', 'p1-u1', 'attack', 50], ['p0-u2', 'p1-u1', 'skill', 125]]], teams);
  assert.equal(result.effects.length, 2); assert.equal(result.fallen.length, 1);
  assert.equal(result.fallen[0].uid, 'p1-u1'); assert.deepEqual(result.fallen[0].point, { x: 250, y: 550 });
});
check('empty frames and skipped malformed references produce no stale effects', () => {
  const result = present([['missing', 'p1-u1', 'attack', 5]]);
  assert.equal(result.effects.length, 0);
  assert.deepEqual(combatPresentation([0, [], []], teams), { effects: [], actions: [], casts: [], fallen: [] });
  assert.equal(combatPresentation(null, teams).effects.length, 0);
});
check('presentation remains bounded by twelve events even for a long supplied list', () => {
  const result = present(Array.from({ length: 200 }, () => ['p0-u1', 'p1-u1', 'attack', 35]));
  assert.equal(result.effects.length, 12); assert.equal(result.actions.length, 1);
});
check('neutral spectator labels are not presented as a false friendly team', () => {
  const spectator = boardTeamsFor({ id: 'p7' }, enemy, { left: enemy, right: player });
  const result = combatPresentation([0, units, [['p0-u1', 'p1-u1', 'attack', 5]]], spectator);
  assert.equal(result.effects[0].from.badge, '상단'); assert.equal(result.effects[0].to.badge, '하단');
});
check('reading and rewinding effects does not mutate the sealed frame or team metadata', () => {
  const frame = [1.2, units, [['p0-u2', 'p1-u1', 'skill', 123]]], before = JSON.stringify({ frame, teams });
  combatPresentation(frame, teams); combatPresentation([0, units, []], teams); combatPresentation(frame, teams);
  assert.equal(JSON.stringify({ frame, teams }), before);
});

const fixturePath = process.argv[2];
if (fixturePath) {
  const raw = await fs.readFile(fixturePath, 'utf8'), save = restoreState(JSON.parse(raw), 1000);
  assert(save);
  check('existing saved replays remain valid and byte-for-byte unchanged after presentation', () => {
    const before = JSON.stringify(save), watch = save.lastBattle || save.pending?.watch;
    assert(watch);
    const savedTeams = boardTeamsFor(save.players[0], null, watch);
    for (const frame of watch.frames) combatPresentation(frame, savedTeams);
    assert.equal(JSON.stringify(save), before); assert(restoreState(serializeState(save, 1000), 1000));
  });
  check('simulated crossover battles present every recorded event without changing outcomes', () => {
    const left = save.players[0], right = save.players[1];
    const battle = simulateBattle(left, right, 2187), before = JSON.stringify(battle);
    const battleTeams = boardTeamsFor(left, right, { left, right });
    for (const frame of battle.frames) {
      const result = combatPresentation(frame, battleTeams);
      assert.equal(result.effects.length, frame[2].length);
      assert(result.effects.every(fx => fx.from.uid && fx.to.uid));
    }
    assert.equal(JSON.stringify(battle), before);
    assert.deepEqual(simulateBattle(left, right, 2187), battle);
  });
}
console.log(JSON.stringify({ passed }));
