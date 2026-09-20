import assert from 'node:assert/strict';
import {
  buildMinimapTeamLegend,
  getMinimapTeamPresentation,
  layoutMinimapZoneActors,
  MINIMAP_TEAM_PALETTE,
} from '../src/app/simulation/_lib/minimapTeamPresentationRuntime.js';

function actor(id, teamNo, hp = 100) {
  return {
    _id: id,
    name: id,
    hp,
    maxHp: 100,
    teamId: `team:${teamNo}`,
    teamName: `${teamNo}팀`,
  };
}

const team1 = getMinimapTeamPresentation(actor('a', 1));
const team2 = getMinimapTeamPresentation(actor('b', 2));
assert.equal(team1.shortLabel, '1');
assert.equal(team2.shortLabel, '2');
assert.notEqual(team1.color, team2.color, 'adjacent teams need distinct minimap colors');
assert.equal(getMinimapTeamPresentation(actor('a2', 1)).color, team1.color, 'team color must stay deterministic');
assert.equal(MINIMAP_TEAM_PALETTE.length, 8, 'squad evaluation supports eight distinct team colors');

const actors = [
  actor('one-a', 1), actor('one-b', 1), actor('one-c', 1),
  actor('two-a', 2), actor('two-b', 2), actor('two-c', 2, 20),
  actor('three-a', 3), actor('three-b', 3, 0),
];
const tracked = new Set(['two-a', 'two-b', 'two-c']);
const legend = buildMinimapTeamLegend(actors, tracked);
assert.deepEqual(legend.map((row) => row.teamNumber), [1, 2, 3]);
assert.deepEqual(legend.map((row) => row.aliveCount), [3, 3, 1]);
assert.equal(legend.find((row) => row.teamNumber === 2)?.selected, true);
assert.equal(legend.filter((row) => row.selected).length, 1);

const layout = layoutMinimapZoneActors(actors, tracked);
const team2Layout = layout.filter((row) => row.teamNumber === 2);
const team1Layout = layout.filter((row) => row.teamNumber === 1);
assert.equal(new Set(team2Layout.map((row) => row.dy)).size, 1, 'one team must occupy one readable row');
assert.equal(new Set(team1Layout.map((row) => row.dy)).size, 1, 'one team must occupy one readable row');
assert.ok(team2Layout[0].dy < team1Layout[0].dy, 'tracked team row must be placed first');
assert.equal(new Set(layout.map((row) => `${row.dx}:${row.dy}`)).size, layout.length, 'actor markers must not overlap');
assert.ok(team2Layout.every((row) => row.tracked), 'tracked actors must keep their presentation state');

const crowdedActors = Array.from({ length: 8 }, (_, teamIndex) => (
  Array.from({ length: 3 }, (_, memberIndex) => actor(`team-${teamIndex + 1}-${memberIndex + 1}`, teamIndex + 1))
)).flat();
const crowdedLayout = layoutMinimapZoneActors(crowdedActors, ['team-1-1', 'team-1-2', 'team-1-3']);
assert.equal(crowdedLayout.length, 8, 'crowded zones must collapse to one marker per team');
assert.ok(crowdedLayout.every((row) => row.aggregate && row.count === 3), 'crowded team markers must preserve member counts');
assert.equal(new Set(crowdedLayout.map((row) => `${row.dx}:${row.dy}`)).size, 8, 'crowded team markers must not overlap');
assert.ok(Math.max(...crowdedLayout.map((row) => Math.abs(row.dx))) <= 6, 'crowded layout must stay compact horizontally');
assert.ok(Math.max(...crowdedLayout.map((row) => Math.abs(row.dy))) <= 9, 'crowded layout must stay compact vertically');

const soloActors = Array.from({ length: 6 }, (_, index) => ({ _id: `solo-${index}`, name: `솔로 ${index}`, hp: 100 }));
assert.deepEqual(buildMinimapTeamLegend(soloActors), [], 'solo mode must not render a team legend');
const soloLayout = layoutMinimapZoneActors(soloActors);
assert.equal(new Set(soloLayout.map((row) => `${row.dx}:${row.dy}`)).size, soloActors.length, 'solo markers must use distinct grid cells');
assert.ok(soloLayout.every((row) => row.aggregate === false && row.hpRatio === 1), 'solo markers must keep actor HP presentation');

console.log(JSON.stringify({
  paletteColors: MINIMAP_TEAM_PALETTE.length,
  legendTeams: legend.length,
  collisionFreeMarkers: layout.length,
  crowdedTeamsCollapsed: crowdedLayout.length,
  trackedTeamFirst: true,
  soloLegendHidden: true,
}, null, 2));
