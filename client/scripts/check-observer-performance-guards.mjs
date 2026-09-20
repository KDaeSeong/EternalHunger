import './lib/register-simulation-modules.mjs';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const { appendVisibleRunEvents, emitSimulationRunEvent, RUN_EVENT_VIEW_LIMIT } = await import('../src/app/simulation/_lib/logActionRuntime.js');
const { getCombatDetailLogs, getKillLogs, LOG_DETAIL_RENDER_LIMIT } = await import('../src/app/simulation/_lib/logPresentation.js');
const { buildTeamObserverModel, getObserverVisibleActors } = await import('../src/app/simulation/_lib/teamObserverRuntime.js');
const observerSource = readFileSync(new URL('../src/app/simulation/_lib/teamObserverRuntime.js', import.meta.url), 'utf8');
const minimapSource = readFileSync(new URL('../src/app/simulation/_components/SimulationMinimapCanvas.js', import.meta.url), 'utf8');
const pageViewSource = readFileSync(new URL('../src/app/simulation/_components/SimulationPageView.js', import.meta.url), 'utf8');

let checks = 0;
function check(name, run) {
  run();
  checks += 1;
  console.log(`PASS ${name}`);
}

check('a visible event batch keeps only the newest ordered window without mutating inputs', () => {
  const previous = Array.from({ length: RUN_EVENT_VIEW_LIMIT - 10 }, (_, id) => ({ id }));
  const incoming = Array.from({ length: 30 }, (_, offset) => ({ id: previous.length + offset }));
  const beforePrevious = structuredClone(previous);
  const beforeIncoming = structuredClone(incoming);
  const visible = appendVisibleRunEvents(previous, incoming);
  assert.equal(visible.length, RUN_EVENT_VIEW_LIMIT);
  assert.equal(visible[0].id, 20);
  assert.equal(visible.at(-1).id, RUN_EVENT_VIEW_LIMIT + 19);
  assert.deepEqual(previous, beforePrevious);
  assert.deepEqual(incoming, beforeIncoming);
});

check('the event emitter can enqueue one UI batch item while preserving the full replay journal', () => {
  const fullRunEventsRef = { current: [] };
  const queued = [];
  let directUpdates = 0;
  emitSimulationRunEvent({
    kind: 'move',
    payload: { who: 'a', from: 'alpha', to: 'beta' },
    at: { day: 1, phase: 'morning', sec: 4 },
    refs: { fullRunEventsRef },
    actions: {
      enqueueRunEvent: (event) => queued.push(event),
      setRunEvents: () => { directUpdates += 1; },
    },
  });
  assert.equal(queued.length, 1);
  assert.equal(directUpdates, 0);
  assert.equal(fullRunEventsRef.current.length, 1);
  assert.deepEqual(fullRunEventsRef.current[0], queued[0]);
  assert.notEqual(fullRunEventsRef.current[0], queued[0]);
});

check('kill and combat detail views scan from the tail and cap rendered rows', () => {
  const kills = Array.from({ length: 260 }, (_, index) => ({ id: `kill-${index}`, type: 'death', text: `+1 킬 ${index}` }));
  const details = Array.from({ length: 460 }, (_, index) => ({ id: `detail-${index}`, type: 'combat-detail', text: `피해: ${index}` }));
  const visibleKills = getKillLogs(kills, { limit: LOG_DETAIL_RENDER_LIMIT });
  const visibleDetails = getCombatDetailLogs(details, { limit: LOG_DETAIL_RENDER_LIMIT });
  assert.equal(visibleKills.length, LOG_DETAIL_RENDER_LIMIT);
  assert.equal(visibleKills[0].id, 'kill-60');
  assert.equal(visibleKills.at(-1).id, 'kill-259');
  assert.equal(visibleDetails.length, LOG_DETAIL_RENDER_LIMIT);
  assert.equal(visibleDetails[0].id, 'detail-260');
  assert.equal(visibleDetails.at(-1).id, 'detail-459');
});

check('team observer output stays bounded on a long event window', () => {
  const actors = [
    { _id: 'a', name: 'A', teamId: 'team:1', hp: 100, maxHp: 100, zoneId: 'alpha', inventory: [] },
    { _id: 'b', name: 'B', teamId: 'team:2', hp: 100, maxHp: 100, zoneId: 'alpha', inventory: [] },
  ];
  const events = Array.from({ length: RUN_EVENT_VIEW_LIMIT }, (_, index) => ({
    kind: 'team_engagement', at: { day: 1, phase: 'morning', sec: index },
    zoneId: 'alpha', participants: ['a', 'b'],
  }));
  const model = buildTeamObserverModel({ survivors: actors, events, teamId: 'team:1', matchSec: RUN_EVENT_VIEW_LIMIT });
  assert.equal(model.recent.length, 10);
  assert.equal(model.turningPoints.length, 8);
  assert.equal(model.recent[0].sec, RUN_EVENT_VIEW_LIMIT - 1);
});

check('tracked observer IDs stay prioritized without sorting or null-event failures', () => {
  const visible = getObserverVisibleActors([{ id: 'plain-id' }, { _id: 'other-id' }], new Set(['plain-id']), 1);
  assert.equal(visible[0].id, 'plain-id');
  const model = buildTeamObserverModel({
    survivors: [{ _id: 'plain-id', name: 'A', teamId: 'team:1', hp: 10, maxHp: 10, inventory: [] }],
    events: [null],
    matchSec: 10,
  });
  assert.equal(model.team.id, 'team:1');
});

check('inactive observer tabs do not retain their expensive panel trees', () => {
  const source = readFileSync(new URL('../src/app/simulation/_components/SimulationMainStage.js', import.meta.url), 'utf8');
  assert.match(source, /observerTab === 'team'[\s\S]*?<SimulationTeamObserverPanel/);
  assert.match(source, /observerTab === 'match' \? <SimulationMatchStatusPanel/);
  assert.match(source, /observerTab === 'logs' \|\| uiModal === 'log' \? <SimulationLogPanel/);
  assert.match(source, /if \(observerTab !== 'team'\) return null;/);
  assert.match(source, /const observerTrackedActorIds = useMemo/);
  assert.match(source, /trackedActorIds=\{observerTrackedActorIds\}/);
});

check('the hidden survivor board mounts only for its character modal', () => {
  assert.match(pageViewSource, /uiModal === 'chars' \? <SimulationSurvivorBoard[\s\S]*?uiModal=\{uiModal\}/);
  assert.doesNotMatch(pageViewSource, /\n\s*<SimulationSurvivorBoard\n/);
});

check('observer and custom-map paths avoid repeated per-event and polygon string allocations', () => {
  assert.match(observerSource, /function observerEventInvolvesMember\(event, memberIds\)/);
  assert.match(observerSource, /observerEventInvolvesMember\(event, memberIds\)/);
  assert.doesNotMatch(observerSource, /observerEventActorIds\(event\)\.some\(\(id\) => memberIds\.has\(id\)\)/);
  assert.match(minimapSource, /const baseZonePolygonRows = useMemo/);
  assert.match(minimapSource, /const forbiddenZonePolygonRows = useMemo/);
  assert.match(minimapSource, /const renderedPassages = useMemo/);
  assert.match(minimapSource, /const mapOutlinePoints = useMemo/);
  assert.match(minimapSource, /String\(activeMapId \|\| ''\)\.startsWith\('local-map-'\)/);
  assert.match(minimapSource, /usesCustomGeometry \? buildCustomMapRenderGeometry\(zones, zoneEdges\) : null/);
  assert.match(observerSource, /trackedIds instanceof Set \? trackedIds : new Set\(list\(trackedIds\)\)/);
  assert.match(minimapSource, /const zoneMarkerLayouts = useMemo/);
  assert.match(minimapSource, /Object\.entries\(aliveByZone\)\.map\(\(\[id, actors\]\)/);
  assert.match(minimapSource, /getObserverVisibleActors\(actors, trackedSet, 24\)/);
  assert.match(minimapSource, /buildMinimapRegionPresentation\(actors, trackedSet, geometry, LUMIA_REFERENCE_LABEL_RECTS, visible\)/);
  assert.match(minimapSource, /getObserverVisibleActors\(deadByZone\[id\], trackedSet, 8\)/);
  assert.match(minimapSource, /function actorIdentity\(actor\)[\s\S]*?actor\?\._id \|\| actor\?\.id/);
  assert.match(minimapSource, /const staticMapFrame = useMemo/);
  assert.match(minimapSource, /const staticPassageLayer = useMemo/);
  assert.match(minimapSource, /const aliveByZone = useMemo/);
});

console.log(`OBSERVER_PERFORMANCE_GUARDS ${checks}/${checks}`);
