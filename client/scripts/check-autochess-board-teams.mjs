import assert from 'node:assert/strict';
import { boardTeamsFor } from '../src/app/games/kivotos-autochess/_lib/autochessBoardTeams.js';
let passed = 0;
const check = (name, fn) => { fn(); passed++; console.log('PASS ' + name); };
const player = { id: 'p0', name: '선생님' }, enemy = { id: 'p1', name: '상대 팀' };
check('planning identifies the human bottom half and opponent top half', () => {
  const [home, away] = boardTeamsFor(player, enemy, null);
  assert.equal(home.relation, 'ally'); assert.equal(home.tone, 'blue'); assert.equal(home.badge, '아군');
  assert.equal(away.relation, 'enemy'); assert.equal(away.tone, 'red'); assert.equal(away.badge, '적군');
  assert.equal(home.caption, '아군 진영 · 하단'); assert.equal(away.caption, '적군 진영 · 상단');
});
check('a human on frame side zero stays blue and friendly', () => {
  const teams = boardTeamsFor(player, enemy, { left: player, right: enemy });
  assert.equal(teams[0].relation, 'ally'); assert.equal(teams[1].relation, 'enemy');
});
check('a human on frame side one is blue at the top rather than marked enemy', () => {
  const [home, away] = boardTeamsFor(player, enemy, { left: enemy, right: player });
  assert.equal(home.tone, 'red'); assert.equal(home.relation, 'enemy');
  assert.equal(away.tone, 'blue'); assert.equal(away.relation, 'ally');
  assert.equal(away.caption, '아군 진영 · 상단'); assert.equal(home.caption, '적군 진영 · 하단');
});
check('AI-only spectator battles use positional team labels without a false ally', () => {
  const teams = boardTeamsFor(player, enemy, { left: enemy, right: { id: 'p2', name: '다른 팀' } });
  assert(teams.every(team => team.relation === 'spectator'));
  assert.deepEqual(teams.map(team => team.badge), ['하단', '상단']);
  assert.deepEqual(teams.map(team => team.tone), ['blue', 'red']);
  assert(teams.every(team => !team.caption.includes('아군') && !team.caption.includes('적군')));
});
check('ghost copies are not mistaken for the original human', () => {
  const ghost = { id: 'ghost-p0', name: '선생님의 고스트' };
  const teams = boardTeamsFor(player, enemy, { left: enemy, right: ghost });
  assert(teams.every(team => team.relation === 'spectator'));
});
check('team identity follows IDs even when both display names are identical', () => {
  const teams = boardTeamsFor(player, enemy, { left: { id: 'p1', name: player.name }, right: player });
  assert.equal(teams[0].relation, 'enemy'); assert.equal(teams[1].relation, 'ally');
});
check('presentation is not hardcoded to a particular player ID', () => {
  const another = { id: 'viewer', name: '관찰자' };
  const teams = boardTeamsFor(another, enemy, { left: enemy, right: another });
  assert.equal(teams[1].badge, '아군'); assert.equal(teams[0].badge, '적군');
});
check('presentation leaves player, opponent and sealed replay metadata unchanged', () => {
  const watch = { left: enemy, right: player, frames: [[0, [], []]] };
  const before = JSON.stringify({ player, enemy, watch });
  boardTeamsFor(player, enemy, watch); boardTeamsFor(player, null, null);
  assert.equal(JSON.stringify({ player, enemy, watch }), before);
});
console.log(JSON.stringify({ passed }));
