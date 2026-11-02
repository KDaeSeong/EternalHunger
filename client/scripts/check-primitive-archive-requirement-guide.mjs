import assert from 'node:assert/strict';
import './lib/register-simulation-modules.mjs';

const engine = await import('../src/app/games/primitive-archive/_lib/primitiveArchiveEngine.js');
const { campRequirementGuide } = await import('../src/app/games/primitive-archive/_lib/primitiveArchiveCampRequirementGuide.js');
const supported = ['wood', 'stone', 'fiber', 'hide', 'clay', 'resin'];
const freeze = value => {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value); Object.values(value).forEach(freeze);
  }
  return value;
};
const fresh = () => engine.createNewState({ runId: 'requirement-guide-fresh', now: '2026-11-02T00:00:00.000Z', rng: () => 0.5 });
let checks = 0;
const check = (name, run) => { run(); checks++; console.log('PASS ' + name); };
const materialsAction = ids => ({ id: 'material-check', materialRows: ids.map(id => ({ id, name: engine.itemName(id), current: 0, required: 3, met: false })) });

check('all six supported materials use only revealed real gather or hunt sources with their actual danger labels', () => {
  const state = fresh();
  state.exploration.revealed = Object.fromEntries(engine.WORLD_REGIONS.map(region => [region.id, true]));
  const regions = engine.regionRows(state);
  const guide = campRequirementGuide({ action: materialsAction(supported), regions });
  assert.equal(guide.materials.length, 6);
  for (const material of guide.materials) {
    assert.equal(material.supported, true);
    assert.equal(material.missing, 3);
    const expected = regions.filter(region => region.revealed && !region.safe).flatMap(region =>
      ['gather', 'hunt'].filter(action => (region.zone?.[action] || []).some(row => row[0] === material.resourceId))
        .map(action => [region.id, region.name, action, region.dangerLabel]));
    assert.deepEqual(material.sources.map(source => [source.regionId, source.regionName, source.action, source.dangerLabel]).sort(), expected.sort());
    assert.ok(material.sources.length > 0);
    assert.ok(material.sources.every(source => source.actionLabel && !('probability' in source) && !('chance' in source)));
  }
  assert.ok(guide.materials.find(row => row.resourceId === 'hide').sources.every(source => source.action === 'hunt'));
});

check('undiscovered names, landmarks and hidden yields never leak through the returned guide', () => {
  const state = fresh(), regions = engine.regionRows(state);
  const hidden = regions.filter(row => !row.revealed);
  assert.ok(hidden.length > 0);
  const guide = campRequirementGuide({ action: materialsAction(supported), regions });
  const serialized = JSON.stringify(guide);
  for (const row of hidden) {
    assert.ok(!serialized.includes(row.id), row.id);
    assert.ok(!serialized.includes(row.name), row.name);
    if (row.landmark) assert.ok(!serialized.includes(row.landmark), row.landmark);
  }
});

check('missing routes and unsupported resources remain empty rather than borrowing hidden or invented sources', () => {
  const action = materialsAction([...supported, 'unknown-material', 'camp_fuel']);
  const guide = campRequirementGuide({ action, regions: [] });
  for (const row of guide.materials) {
    assert.equal(row.supported, supported.includes(row.resourceId));
    assert.deepEqual(row.sources, []);
  }
  const state = fresh();
  const hiddenOnly = engine.regionRows(state).map(row => ({ ...row, revealed: false }));
  assert.ok(campRequirementGuide({ action, regions: hiddenOnly }).materials.every(row => !row.sources.length));
});

check('the shelf research hint comes from actual technology unlocks.camp and never changes the selected target', () => {
  const state = fresh(), selected = state.research.selectedTechId;
  const facility = engine.campFacilityRows(state).find(row => row.id === 'library_shelf');
  const expected = engine.TECHNOLOGY_TREE.filter(tech => (tech.unlocks?.camp || []).includes(facility.id));
  assert.ok(expected.length > 0);
  const guide = campRequirementGuide({ action: facility, regions: engine.regionRows(state) });
  assert.deepEqual(guide.research.map(row => [row.technologyId, row.name]), expected.map(row => [row.id, row.name]));
  assert.equal(state.research.selectedTechId, selected);
  assert.deepEqual(campRequirementGuide({ action: { ...facility, unlocked: true } }).research, []);
});

check('satisfied costs and completed facilities do not advertise unnecessary gathering or research', () => {
  const action = { id: 'library_shelf', unlocked: false, materialRows: [
    { id: 'wood', name: '나무', current: 4, required: 4, met: true },
    { id: 'clay', name: '점토', current: 5, required: 2, met: true },
    { id: 'fiber', name: '섬유', current: 1, required: 4, met: false },
  ] };
  const guide = campRequirementGuide({ action });
  assert.deepEqual(guide.materials.map(row => row.resourceId), ['fiber']);
  assert.equal(guide.materials[0].missing, 3);
  const maxed = campRequirementGuide({ action: { ...action, maxed: true } });
  assert.deepEqual(maxed.materials, []); assert.deepEqual(maxed.research, []); assert.equal(maxed.hasHelp, false);
});

check('reading fresh, AP-zero, ended and updated camp requirements mutates no state, region, research, log or RNG', () => {
  for (const changes of [{}, { ap: 0 }, { ended: true, ap: 0 }, { inventory: { wood: 100, stone: 100, fiber: 100, hide: 100, clay: 100, resin: 100 } }]) {
    const state = Object.assign(fresh(), changes);
    const actions = [...engine.campActionRows(state), ...engine.campFacilityRows(state)];
    const regions = engine.regionRows(state);
    const before = JSON.stringify({ state, actions, regions });
    freeze(state); freeze(actions); freeze(regions);
    const random = Math.random; let draws = 0;
    Math.random = () => { draws++; throw new Error('Requirement help consumed RNG'); };
    try { for (const action of actions) campRequirementGuide({ action, regions }); }
    finally { Math.random = random; }
    assert.equal(draws, 0); assert.equal(JSON.stringify({ state, actions, regions }), before);
  }
});

console.log(JSON.stringify({ pass: true, checks, scope: 'Current pure guide helper and fresh real engine fixtures only. No saved result input, source mutation, build, live account or database access.' }));
