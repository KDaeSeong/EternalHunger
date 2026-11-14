import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import crypto from 'node:crypto';
import * as engine from '../src/app/games/myanimecraft/_lib/myAnimeCraftEngine.js';
const require = createRequire(new URL('../package.json', import.meta.url));
const ts = require('typescript');
const pageURL = new URL('../src/app/games/myanimecraft/play/page.js', import.meta.url);
const page = ts.createSourceFile('page.js', readFileSync(pageURL, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.JSX);
const component = page.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'MyAnimeCraftPlayPage');
assert.ok(component?.body, 'Actual page component is present');
const declarations = new Map();
for (const statement of component.body.statements) if (ts.isVariableStatement(statement)) {
  for (const item of statement.declarationList.declarations) if (ts.isIdentifier(item.name)) declarations.set(item.name.text, `const ${item.getText(page)};`);
}
const names = ['standings', 'selectedTeam', 'selectedPlayer', 'tradeTeams', 'tradeTargetTeam', 'tradeTargetPlayer', 'tradeInfo',
  'marketOfficeReport', 'selectedStanding', 'selectedCareer', 'freeAgentPreview', 'selectedEconomy', 'selectedContracts',
  'inventoryRows', 'equipmentRows', 'teamActions', 'played', 'total', 'score'];
for (const name of names) assert.ok(declarations.has(name), 'Actual page declaration ' + name);
const body = names.map(name => declarations.get(name)).join('\n') + `\nreturn { ${names.join(',')} };`;
const memoReads = {
  tradeTeams: 'tradeCandidateRows', tradeInfo: 'tradePreview', selectedCareer: 'careerSummary', freeAgentPreview: 'getFreeAgentPreview',
  selectedContracts: 'getTeamContractRows', inventoryRows: 'inventoryRowsForTeam', equipmentRows: 'equipmentRowsForPlayer',
  teamActions: 'teamActionRows', played: 'getPlayedCount', total: 'getTotalFixtureCount', score: 'scoreState', marketOfficeReport: 'getMarketOfficeReport',
};
const freeze = value => { if (value && typeof value === 'object' && !Object.isFrozen(value)) { Object.values(value).forEach(freeze); Object.freeze(value); } return value; };
const fixture = () => engine.createNewState({ now: '2026-11-14T00:00:00.000Z', runId: 'starleague-read-reuse-fixed' });
const clone = value => structuredClone(value);
function harness(source = freeze(fixture())) {
  const calls = {}, cells = []; let cursor = 0;
  const wrapped = Object.fromEntries(Object.entries(engine).map(([name, value]) => [name, typeof value === 'function'
    ? (...args) => { calls[name] = (calls[name] || 0) + 1; return value(...args); } : value]));
  const useMemo = (factory, deps) => {
    assert.ok(Array.isArray(deps), 'Memo dependencies are explicit');
    const index = cursor++, previous = cells[index];
    if (!previous || previous.deps.length !== deps.length || !deps.every((value, i) => Object.is(value, previous.deps[i]))) {
      cells[index] = { deps: [...deps], value: factory() };
    }
    return cells[index].value;
  };
  let input = { state: source, selectedTeamId: source.teams[0].id, selectedPlayerId: '', tradeTargetTeamId: source.teams[1].id,
    tradeTargetPlayerId: '', tradeCash: 0, activeTabId: 'league', busy: '', message: '', actionResult: '' };
  const view = { calls, input, output: null, render(patch = {}) {
    input = { ...input, ...patch }; cursor = 0;
    const before = clone(input.state), scope = { ...wrapped, ...input, useMemo };
    view.output = new Function(...Object.keys(scope), body)(...Object.values(scope)); view.input = input;
    assert.deepEqual(input.state, before, 'Actual selected reads preserve the frozen source'); return view.output;
  } };
  view.render(); return view;
}
function freshOracle(input) {
  const { state, selectedTeamId, selectedPlayerId, tradeTargetTeamId, tradeTargetPlayerId, tradeCash } = input;
  const standings = engine.getTopTeams(state, 10), selectedTeam = engine.getTeam(state, selectedTeamId);
  const selectedPlayer = selectedTeam.roster.find(row => row.id === selectedPlayerId) || selectedTeam.roster[0];
  const tradeTeams = engine.tradeCandidateRows(state, selectedTeam.id);
  const tradeTargetTeam = tradeTeams.find(row => row.teamId === tradeTargetTeamId) || tradeTeams[0];
  const tradeTargetPlayer = tradeTargetTeam?.roster.find(row => row.playerId === tradeTargetPlayerId) || tradeTargetTeam?.roster[0];
  return { standings, selectedTeam, selectedPlayer, tradeTeams, tradeTargetTeam, tradeTargetPlayer,
    tradeInfo: tradeTargetTeam && selectedPlayer && tradeTargetPlayer
      ? engine.tradePreview(state, selectedTeam.id, selectedPlayer.id, tradeTargetTeam.teamId, tradeTargetPlayer.playerId, tradeCash) : null,
    marketOfficeReport: tradeTargetTeam && selectedPlayer && tradeTargetPlayer
      ? engine.getMarketOfficeReport(state, selectedTeam.id, selectedPlayer.id, tradeTargetTeam.teamId, tradeTargetPlayer.playerId, tradeCash)
      : engine.getMarketOfficeReport(state, selectedTeam.id, selectedPlayer?.id || '', '', '', tradeCash),
    selectedStanding: standings.find(row => row.teamId === selectedTeam.id), selectedCareer: engine.careerSummary(state, selectedTeam.id),
    freeAgentPreview: engine.getFreeAgentPreview(state, selectedTeam.id), selectedEconomy: engine.econSummary(state, selectedTeam.id),
    selectedContracts: engine.getTeamContractRows(state, selectedTeam.id), inventoryRows: engine.inventoryRowsForTeam(state, selectedTeam.id),
    equipmentRows: selectedPlayer ? engine.equipmentRowsForPlayer(state, selectedTeam.id, selectedPlayer.id) : [],
    teamActions: selectedPlayer ? engine.teamActionRows(state, selectedTeam.id, selectedPlayer.id) : [],
    played: engine.getPlayedCount(state), total: engine.getTotalFixtureCount(state), score: engine.scoreState(state) };
}
function exact(view) {
  assert.deepEqual(view.output, freshOracle(view.input));
  assert.equal(view.output.selectedTeam, engine.getTeam(view.input.state, view.input.selectedTeamId));
  assert.ok(view.output.selectedTeam.roster.includes(view.output.selectedPlayer));
  assert.ok(view.output.tradeTeams.includes(view.output.tradeTargetTeam));
  assert.ok(view.output.tradeTargetTeam.roster.includes(view.output.tradeTargetPlayer));
}
const counts = view => ({ ...view.calls });
function reads(view, before, changed = []) {
  for (const field of Object.keys(memoReads)) assert.equal((view.calls[memoReads[field]] || 0) - (before[memoReads[field]] || 0),
    changed.includes(field) ? 1 : 0, 'Actual UI query count: ' + field);
}
function withNow(now, run) { const previous = Date.now; Date.now = () => now; try { return run(); } finally { Date.now = previous; } }
function observeAmbient(run) {
  const counts = { random: 0, clock: 0 }, restore = [];
  const watch = (owner, key, field) => {
    const original = owner[key], descriptor = Object.getOwnPropertyDescriptor(owner, key);
    Object.defineProperty(owner, key, { configurable: true, writable: true, value: (...args) => {
      counts[field]++; return original.apply(owner, args);
    } });
    restore.push(() => descriptor ? Object.defineProperty(owner, key, descriptor) : Reflect.deleteProperty(owner, key));
  };
  watch(Math, 'random', 'random'); watch(Date, 'now', 'clock'); watch(crypto, 'randomUUID', 'random');
  watch(crypto.webcrypto, 'randomUUID', 'random'); watch(crypto.webcrypto, 'getRandomValues', 'random');
  if (globalThis.crypto && globalThis.crypto !== crypto.webcrypto) {
    watch(globalThis.crypto, 'randomUUID', 'random'); watch(globalThis.crypto, 'getRandomValues', 'random');
  }
  try { return { value: run(), counts }; } finally { restore.reverse().forEach(fn => fn()); }
}
let checks = 0;
function check(name, run) { run(); checks++; console.log(`PASS ${name}`); }
check('cold actual page declarations equal independent fresh current API queries on the complete frozen current catalog', () => {
  const view = harness();
  assert.equal(view.input.state.teams.length, engine.TEAM_BLUEPRINTS.length);
  assert.deepEqual(view.input.state.teams.map(team => ({ id: team.id, roster: team.roster.map(member => member.id) })),
    engine.TEAM_BLUEPRINTS.map(team => ({ id: team.id, roster: team.roster.map(member => member.id) })));
  exact(view);
  for (const name of Object.values(memoReads)) assert.equal(view.calls[name], 1, name);
});
check('selection-independent render noise performs zero memoized UI reads and preserves derived references', () => {
  const view = harness(), previous = view.output;
  for (const noise of [{ activeTabId: 'market' }, { busy: 'save' }, { message: '표시만 변경' }, { actionResult: '표시 결과' }]) {
    const before = counts(view); view.render(noise); reads(view, before);
    for (const name of Object.keys(memoReads)) assert.equal(view.output[name], previous[name], name);
    assert.equal(view.calls.econSummary - before.econSummary, 1, 'Live legacy economic log getter remains uncached'); exact(view);
  }
});
check('team player target-team target-player and cash invalidate only the actual affected read partitions', () => {
  for (const kind of ['team', 'player', 'targetTeam', 'targetPlayer', 'cash']) {
    const view = harness(), before = counts(view); let patch, changed;
    if (kind === 'team') { patch = { selectedTeamId: view.input.state.teams[2].id }; changed = ['tradeTeams', 'tradeInfo', 'marketOfficeReport', 'selectedCareer', 'freeAgentPreview', 'selectedContracts', 'inventoryRows', 'equipmentRows', 'teamActions']; }
    if (kind === 'player') { patch = { selectedPlayerId: view.output.selectedTeam.roster[1].id }; changed = ['tradeInfo', 'marketOfficeReport', 'equipmentRows', 'teamActions']; }
    if (kind === 'targetTeam') { patch = { tradeTargetTeamId: view.input.state.teams[3].id }; changed = ['tradeInfo', 'marketOfficeReport']; }
    if (kind === 'targetPlayer') { patch = { tradeTargetPlayerId: view.output.tradeTargetTeam.roster[1].playerId }; changed = ['tradeInfo', 'marketOfficeReport']; }
    if (kind === 'cash') { patch = { tradeCash: 25.9 }; changed = ['tradeInfo', 'marketOfficeReport']; }
    view.render(patch); reads(view, before, changed); exact(view);
    if (kind === 'cash') assert.equal(view.output.tradeInfo.cashFromUs, 25);
  }
});
check('new outer state refreshes inventory equipment contracts economy and actions even with identical team and player references', () => {
  const view = harness(), old = view.output, state = view.input.state, player = old.selectedPlayer;
  const item = engine.ITEM_DEFS.find(row => row.kind === 'keyboard'); assert.ok(item);
  const next = freeze({ ...state,
    inventories: state.inventories.map(row => row.teamId === old.selectedTeam.id ? { ...row,
      items: [...row.items, { itemId: item.id, qty: 2 }], equipped: { ...row.equipped, [player.id]: { keyboard: item.id } } } : row),
    contracts: { ...state.contracts, [player.id]: { ...state.contracts[player.id], salary: state.contracts[player.id].salary + 17 } },
    standings: state.standings.map(row => row.teamId === old.selectedTeam.id ? { ...row, money: row.money + 55 } : row),
  });
  const before = counts(view); view.render({ state: next }); reads(view, before, Object.keys(memoReads)); exact(view);
  assert.equal(view.output.selectedTeam, old.selectedTeam); assert.equal(view.output.selectedPlayer, player);
  assert.notDeepEqual(view.output.inventoryRows, old.inventoryRows); assert.notDeepEqual(view.output.equipmentRows, old.equipmentRows);
  assert.notDeepEqual(view.output.selectedContracts, old.selectedContracts); assert.notDeepEqual(view.output.teamActions, old.teamActions);
});
check('trade candidate values stable ties and fallback selections keep current prices and order', () => {
  const source = fixture();
  for (const team of source.teams) for (const member of team.roster) {
    member.name = '동률 선수'; member.level = 3; member.fame = 100; member.salaryStep = 0;
    member.stats = Object.fromEntries(engine.CAREER_STAT_KEYS.map(key => [key, 500]));
  }
  const view = harness(freeze(source)); exact(view);
  for (const candidate of view.output.tradeTeams) {
    const team = source.teams.find(row => row.id === candidate.teamId);
    assert.deepEqual(candidate.roster.map(row => row.playerId), team.roster.map(row => row.id), 'Equal market value/name preserves roster order');
    for (const row of candidate.roster) assert.equal(row.marketValue, engine.calcPlayerMarketValue(team.roster.find(member => member.id === row.playerId)));
  }
  const selected = view.output, target = source.teams.find(row => row.id === selected.tradeTargetTeam.teamId).roster.find(row => row.id === selected.tradeTargetPlayer.playerId);
  assert.equal(selected.tradeInfo.ourValue, engine.calcPlayerMarketValue(selected.selectedPlayer)); assert.equal(selected.tradeInfo.theirValue, engine.calcPlayerMarketValue(target));
  view.render({ selectedTeamId: 'unknown', selectedPlayerId: 'unknown', tradeTargetTeamId: 'unknown', tradeTargetPlayerId: 'unknown' }); exact(view);
});
check('direct public getters still observe mutable legacy objects and the selected economy clock stays live', () => {
  const state = fixture(), team = state.teams[0], player = team.roster[0], item = engine.ITEM_DEFS.find(row => row.kind === 'keyboard');
  const oldInventory = engine.inventoryRowsForTeam(state, team.id), oldContracts = engine.getTeamContractRows(state, team.id);
  state.inventories[0].items.push({ itemId: item.id, qty: 3 }); state.contracts[player.id].salary += 19;
  assert.notDeepEqual(engine.inventoryRowsForTeam(state, team.id), oldInventory); assert.notDeepEqual(engine.getTeamContractRows(state, team.id), oldContracts);
  const legacy = fixture(); legacy.econLogs = [{ teamId: legacy.teams[0].id, amount: 5, seasonNo: 1, week: 1, note: '기록', id: '', at: 0 }];
  const now = Date.parse('2026-11-14T01:00:00.000Z'); let view;
  withNow(now, () => { view = harness(freeze(legacy)); });
  const previous = view.output.selectedEconomy; assert.equal(previous.last[0].at, now);
  withNow(now + 1000, () => view.render({ message: '시각만 진행' }));
  assert.equal(view.output.selectedEconomy.last[0].at, now + 1000); assert.notEqual(view.output.selectedEconomy.last[0].id, previous.last[0].id);
  assert.equal(withNow(now, () => engine.getPlayTimeSec(legacy)) + 1, withNow(now + 1000, () => engine.getPlayTimeSec(legacy)));
});
check('memoized and fresh query outputs preserve ambient RNG behavior while legacy clock sampling remains live', () => {
  const view = harness(), warm = observeAmbient(() => view.render({ activeTabId: 'market' }));
  const direct = observeAmbient(() => freshOracle(view.input));
  assert.deepEqual(warm.value, direct.value); assert.equal(warm.counts.random, direct.counts.random);
  assert.equal(warm.counts.random, 0); assert.ok(warm.counts.clock > 0, 'Uncached legacy-capable reads still consult the actual clock');
  assert.ok(warm.counts.clock <= direct.counts.clock);
});
check('fixed low/high-value trades preserve the real deterministic acceptance roll both outcomes and atomic roster transfers', () => {
  const source = ts.createSourceFile('engine.js', readFileSync(new URL('../src/app/games/myanimecraft/_lib/myAnimeCraftEngine.js', import.meta.url), 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const rngNode = source.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'createRng'); assert.ok(rngNode);
  const realRng = new Function(`return (${rngNode.getText(source)});`)();
  const outcomes = [];
  for (const highOffer of [false, true]) {
    const state = fixture(), ourTeam = state.teams[0], theirTeam = state.teams[1], our = ourTeam.roster[0], their = theirTeam.roster[0];
    const setValue = (member, high) => Object.assign(member, { level: high ? 20 : 1, condition: high ? 100 : 20,
      fame: high ? 3000 : 0, salaryStep: 0, stats: Object.fromEntries(engine.CAREER_STAT_KEYS.map(key => [key, high ? 820 : 260])) });
    setValue(our, highOffer); setValue(their, !highOffer);
    const item = engine.ITEM_DEFS.find(row => row.kind === 'keyboard');
    for (const [team, player] of [[ourTeam, our], [theirTeam, their]]) {
      const inventory = state.inventories.find(row => row.teamId === team.id); inventory.items = [{ itemId: item.id, qty: 1 }]; inventory.equipped[player.id] = { keyboard: item.id };
    }
    const before = clone(state); freeze(state);
    const preview = engine.tradePreview(state, ourTeam.id, our.id, theirTeam.id, their.id, 0);
    assert.equal(preview.ok, true); assert.equal(preview.canTrade, true); assert.equal(preview.cashFromUs, 0);
    const roll = realRng(`${state.runId}|trade|${state.seasonNo}|${state.week}|${our.id}|${their.id}|0`)();
    const accepted = roll < preview.acceptChance, observed = observeAmbient(() => engine.applyTradeAction(state, ourTeam.id, our.id, theirTeam.id, their.id, 0)), result = observed.value;
    assert.equal(observed.counts.random, 0, 'The real internal seeded trade roll does not consume ambient randomness');
    assert.deepEqual(state, before); outcomes.push(accepted);
    if (accepted) {
      assert.match(result.log[0], /트레이드 성사/);
      assert.deepEqual(engine.getTeam(result, ourTeam.id).roster.map(row => row.id), [...ourTeam.roster.filter(row => row.id !== our.id).map(row => row.id), their.id]);
      assert.deepEqual(engine.getTeam(result, theirTeam.id).roster.map(row => row.id), [...theirTeam.roster.filter(row => row.id !== their.id).map(row => row.id), our.id]);
      assert.equal(result.contracts[our.id].teamId, theirTeam.id); assert.equal(result.contracts[their.id].teamId, ourTeam.id);
      assert.ok(!Object.hasOwn(result.inventories.find(row => row.teamId === ourTeam.id).equipped, our.id));
      assert.ok(!Object.hasOwn(result.inventories.find(row => row.teamId === theirTeam.id).equipped, their.id));
      assert.deepEqual(result.standings, state.standings);
    } else { assert.match(result.log[0], /트레이드를 거절/); assert.deepEqual(result.teams, state.teams); assert.deepEqual(result.contracts, state.contracts); assert.deepEqual(result.inventories, state.inventories); }
  }
  assert.deepEqual(outcomes, [false, true], 'The one predeclared run/IDs must cover rejection and acceptance; a roll outside the fixture bounds is a reported fixture limitation, never a seed search');
});
check('financial rejection remains a real public action path without hidden force or random overrides', () => {
  const state = freeze(fixture()), a = state.teams[0], b = state.teams[1], cash = state.standings.find(row => row.teamId === a.id).money + 1;
  const preview = engine.tradePreview(state, a.id, a.roster[0].id, b.id, b.roster[0].id, cash); assert.equal(preview.canTrade, false);
  const result = engine.applyTradeAction(state, a.id, a.roster[0].id, b.id, b.roster[0].id, cash);
  assert.match(result.log[0], /트레이드 실패/); assert.deepEqual(result.teams, state.teams);
});
console.log(JSON.stringify({ passed: true, checks, mode: 'actual-current-page-reads-and-object-is-memo-model',
  scope: 'Current tracked page declarations and real current engine queries/actions with fresh fixed states. Counts observe exported UI read entries, not all nested engine work. No private baseline, historical match input, searched seed, extra season, mounted React, browser, HTTP or live-account acceptance.' }));
