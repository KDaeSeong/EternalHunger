import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { createRequire, registerHooks } from 'node:module';
import { pathToFileURL } from 'node:url';
import { engine, lineage, identityFixture, preparedIdentityFixture, chainIdentityFixture,
  naturalDeathIdentityFixture, annualIdentityFixture } from './lib/primitive-archive-identity-fixtures.mjs';
import { createHandlerHarness, elements, textOf } from './lib/hook-handler-harness.mjs';
const require = createRequire(new URL('../package.json', import.meta.url));
const React = require('react'), ts = require('typescript'), postcss = require('postcss');
const { renderToStaticMarkup } = require('react-dom/server');
const nextImage = require('next/image');
globalThis.__identityActualNextImage = nextImage.default || nextImage;
const base = new URL('../src/app/games/primitive-archive/', import.meta.url);
const partyUrl = new URL('_components/PrimitiveArchivePartyWorkspace.js', base).href;
const foundersUrl = new URL('_components/PrimitiveArchiveFoundersTab.js', base).href;
const hooksUrl = new URL('./lib/hook-handler-harness.mjs', import.meta.url).href;
registerHooks({ resolve(specifier, context, nextResolve) {
  if (specifier === 'next/image') return { shortCircuit: true, url: 'data:text/javascript,export default globalThis.__identityActualNextImage;' };
  if (specifier.startsWith('next/')) return { shortCircuit: true, url: pathToFileURL(require.resolve(specifier)).href };
  return nextResolve(specifier, context);
}, load(url, context, nextLoad) {
  if (!url.includes('/src/') || !url.includes('/_components/') || !url.endsWith('.js')) return nextLoad(url, context);
  let source = readFileSync(new URL(url), 'utf8');
  if (url === partyUrl || url === foundersUrl) source = source.replace("from 'react';", `from '${hooksUrl}';`);
  return { shortCircuit: true, format: 'module', source: ts.transpileModule(source, {
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext },
  }).outputText };
} });
const { default: Party } = await import(partyUrl), { default: Founders } = await import(foundersUrl);
const { default: Person } = await import(new URL('_components/PrimitiveArchivePersonIdentity.js', base));
const { default: Portrait } = await import(new URL('_components/PrimitiveArchivePortrait.js', base));
const { default: GameActionIcon, resolveGameAction } = await import('../src/app/games/_components/GameActionIcon.js');
const { archiveIdentityIndex } = await import(new URL('_lib/primitiveArchiveIdentity.js', base));
const { resolveArchivePortrait } = await import(new URL('_lib/primitiveArchivePortraits.js', base));
const calendar = await import(new URL('_lib/primitiveArchiveCalendar.js', base));
function partyProps(state, overrides = {}) {
  return { state, actorId: state.party[0].id, hydrated: true, busy: false, partyCap: 8, partySort: 'default',
    partyView: state.party.map(member => ({ member, chances: { gather: 0.5, hunt: 0.5, craft: 0.5 }, basisAction: 'gather', basisChance: 0.5, badges: [] })),
    archiveVictory: engine.archiveVictorySummary(state), recruitCandidates: [], selectedRecruit: null,
    setActorId() {}, setPartySort() {}, setSelectedRecruitId() {}, recruitMember() {}, completeRun() {}, ...overrides };
}
function foundersProps(state, overrides = {}) {
  const annual = engine.annualSettlementSummary(state), summary = lineage.lineageSummary(state);
  return { state, foundersRows: engine.founderHistoryRows(state), annual,
    lineage: { ...summary, rows: summary.rows.map(row => ({ ...row,
      ...(annual.annualMode ? { annual: calendar.annualPersonSummary(state, row.actorId) } : {}) })) },
    ancestralRows: [], busy: false, prepareSuccessor() {}, retireFounder() {}, ...overrides };
}
function render(component, props) { const harness = createHandlerHarness(component, props); return { harness, tree: harness.render() }; }
function assertValidNativeNesting(html) {
  const stack = [], voidTags = new Set(['img', 'input', 'br', 'hr', 'meta', 'link', 'source', 'wbr']);
  for (const token of html.matchAll(/<(\/)?([a-z][a-z0-9-]*)(?:\s[^<>]*?)?\s*(\/)?\s*>/gi)) {
    const [, close, name, selfClosing] = token;
    if (close) { const index = stack.lastIndexOf(name); if (index >= 0) stack.splice(index); continue; }
    if (name === 'button') assert.ok(!stack.includes('button'), 'Identity content must not nest a button in a party button');
    if (['div', 'article', 'section', 'p', 'ul', 'table', 'h3', 'h4'].includes(name)) assert.ok(!stack.includes('p'), `Invalid block ${name} inside p`);
    if (!voidTags.has(name) && !selfClosing) stack.push(name);
  }
}
let checks = 0;
function check(name, callback) { callback(); checks++; console.log(`PASS ${name}`); }
check('real party cards keep a unique actor selection and personal portrait separate from the root reference', () => {
  const { state, rootId, ids } = chainIdentityFixture(1), selected = [];
  const { tree } = render(Party, partyProps(state, { setActorId: id => selected.push(id) }));
  const cards = elements(tree, node => node.type === 'button' && node.props.className?.includes('primitive-party-member'));
  assert.equal(cards.length, state.party.length);
  const card = cards.find(node => textOf(node).includes(state.party.find(row => row.id === ids[1]).name)); assert.ok(card);
  card.props.onClick(); assert.deepEqual(selected, [ids[1]]);
  const portraits = elements(card, node => node.type === Portrait); assert.equal(portraits[0].props.member.id, ids[1]);
  assert.equal(portraits[0].props.member.portrait, state.party.find(row => row.id === ids[1]).portrait);
  assert.notEqual(portraits[0].props.member.id, rootId);
  const html = renderToStaticMarkup(tree); assert.match(html, /후계 본인/); assert.match(html, /1세대 후계/);
  assert.match(html, /계보의 창건자/); assert.match(html, /의 참고 초상, 현재 후계/); assert.match(html, /의 초상이 아님/);
  assertValidNativeNesting(html);
});
check('actual identity component supplies a role icon and text and remains phrasing content inside existing buttons', () => {
  const { state, successorId } = preparedIdentityFixture(), index = archiveIdentityIndex(state);
  const tree = Person({ identity: index[successorId] });
  assert.equal(tree.type, 'span'); assert.equal(tree.props['data-role-key'], index[successorId].roleKey);
  assert.equal(elements(tree, node => node.type === 'button' || node.type === 'a').length, 0);
  const html = renderToStaticMarkup(React.createElement('button', { type: 'button' }, tree));
  assert.match(html, /지도자/); assert.ok(html.includes(index[successorId].role)); assert.match(html, /svg/);
  assertValidNativeNesting(html);
  for (const [roleKey, expected] of Object.entries({ scout: 'primitive-survey', hunt: 'primitive-hunt', craft: 'primitive-craft', support: 'primitive-camp', neutral: 'primitive-job' })) {
    const roleTree = Person({ identity: { ...index[successorId], roleKey } });
    const icon = elements(roleTree, node => node.type === GameActionIcon)[0]; assert.ok(icon);
    assert.equal(icon.props.action, expected); assert.equal(resolveGameAction(icon.props.action).kind, expected, 'Use a registered role icon rather than semantic fallback');
  }
  const unknown = Person({ identity: { ...index[successorId], roleKey: '__proto__', kind: 'constructor' } });
  assert.equal(unknown.props['data-role-key'], 'neutral');
  assert.match(renderToStaticMarkup(unknown), /인물 기록 확인 필요/);
});
check('daily and annual founders views render actual prepared and prior generations without inventing observation years', () => {
  for (const annualMode of [false, true]) {
    const prepared = preparedIdentityFixture();
    const state = annualMode ? annualIdentityFixture(prepared.state) : prepared.state;
    const { tree } = render(Founders, foundersProps(state)), html = renderToStaticMarkup(tree);
    assert.match(html, /준비된 후계/); assert.match(html, /1세대 후계/); assert.match(html, /공동 배식에 포함/);
    assert.match(html, annualMode ? /관찰 0년/ : /1일차 준비/); assertValidNativeNesting(html);
    const chain = chainIdentityFixture(3), past = annualMode ? annualIdentityFixture(chain.state) : chain.state;
    const pastHtml = renderToStaticMarkup(render(Founders, foundersProps(past)).tree);
    assert.match(pastHtml, /3세대 후계/); assert.match(pastHtml, /은퇴·사망한 인물/); assert.match(pastHtml, /은퇴·생존/);
    assertValidNativeNesting(pastHtml);
  }
  const dead = naturalDeathIdentityFixture();
  assert.match(renderToStaticMarkup(render(Founders, foundersProps(dead.state)).tree), /사망/);
});
check('actual retirement confirmation token prevents duplicate stale or busy confirmation and preserves cancellation', () => {
  const { state, rootId } = preparedIdentityFixture(), calls = [];
  const props = foundersProps(state, { retireFounder: id => calls.push(id) }), view = createHandlerHarness(Founders, props);
  view.render();
  const button = label => elements(view.tree, node => node.type === 'button' && node.props['aria-label'] === label)[0];
  const rootName = state.party.find(row => row.id === rootId).name;
  button(`${rootName}의 은퇴 인계`).props.onClick(); view.flush();
  const confirm = button(`${rootName}의 은퇴·인계 확정`); assert.ok(confirm);
  confirm.props.onClick(); confirm.props.onClick(); assert.deepEqual(calls, [rootId]); view.flush();
  button(`${rootName}의 은퇴 인계`).props.onClick(); view.flush();
  const stale = button(`${rootName}의 은퇴·인계 확정`); button(`${rootName}의 은퇴 취소`).props.onClick();
  stale.props.onClick(); assert.deepEqual(calls, [rootId]); view.flush();
  props.busy = true; view.render(); assert.equal(button(`${rootName}의 은퇴 인계`).props.disabled, true);
  button(`${rootName}의 은퇴 인계`).props.onClick(); view.flush(); assert.equal(button(`${rootName}의 은퇴·인계 확정`), undefined);
});
check('current successors link to observed mentors roots dates and durable focusable records without changing the run', () => {
  const { state, rootId, ids } = chainIdentityFixture(3), before = structuredClone(state);
  const { tree } = render(Founders, foundersProps(state)), html = renderToStaticMarkup(tree);
  const active = elements(tree, node => node.props?.id === 'primitive-archive-active-people')[0];
  assert.equal(active.props.tabIndex, -1); assert.equal(active.props['aria-label'], '현역 대원');
  assert.match(html, /현장 인계 기록: 1일차/); assert.match(html, /HP 100 · ST 100/);
  const linkComponents = elements(active, node => node.type?.name === 'PersonRecordLink');
  assert.ok(linkComponents.some(node => node.props.person.actorId === rootId));
  assert.ok(linkComponents.some(node => node.props.person.actorId === ids[2]));
  const past = elements(tree, node => node.type === 'details' && node.props.className === 'primitive-founders__past')[0];
  assert.ok(elements(past, node => node.type?.name === 'PersonRecordLink').some(node => node.props.person.actorId === ids[3]), 'recorded predecessor links forward to its actual successor');
  const rootLink = linkComponents.find(node => node.props.person.actorId === rootId);
  const nativeLink = rootLink.type(rootLink.props), calls = [];
  const outer = { tagName: 'DETAILS', open: false, parentElement: null };
  const target = { tagName: 'DETAILS', open: false, parentElement: outer,
    focus: () => calls.push('focus'), scrollIntoView: () => calls.push('scroll') };
  nativeLink.props.onClick({ currentTarget: { ownerDocument: { getElementById: id => {
    assert.equal(id, `primitive-archive-person-${encodeURIComponent(rootId)}`); return target;
  } } }, preventDefault: () => calls.push('prevent') });
  assert.equal(target.open, true); assert.equal(outer.open, true); assert.deepEqual(calls, ['prevent', 'focus', 'scroll']);
  const idsInMarkup = [...html.matchAll(/\sid="([^"]+)"/g)].map(match => match[1]);
  assert.equal(new Set(idsInMarkup).size, idsInMarkup.length);
  for (const match of html.matchAll(/href="#(primitive-archive-person-[^"]+)"/g)) assert.ok(idsInMarkup.includes(match[1]));
  assert.deepEqual(state, before); assertValidNativeNesting(html);
});
check('annual people preserve actual current HP ST while withholding daily hunger and unconfirmed legacy links', () => {
  const chain = chainIdentityFixture(1), state = annualIdentityFixture(chain.state), before = structuredClone(state);
  state.party[0] = { ...state.party[0], hp: 73, stamina: 42, hunger: 91 };
  const active = elements(render(Founders, foundersProps(state)).tree, node => node.props?.id === 'primitive-archive-active-people')[0];
  assert.match(renderToStaticMarkup(active), /HP 73 · ST 42/);
  assert.doesNotMatch(renderToStaticMarkup(active), /허기 91/); assert.match(renderToStaticMarkup(active), /현재 보존 상태/);
  const unknown = identityFixture(); unknown.lineage = undefined; unknown.founderHistory = undefined;
  const html = renderToStaticMarkup(render(Founders, foundersProps(unknown)).tree);
  assert.doesNotMatch(html, /현장 인계 기록|인계한 지도자:/);
  assert.deepEqual(state.calendar, before.calendar);
});
check('real paid project tradition appears under its recorded person and pending or malformed credit never becomes history', () => {
  let state = identityFixture(), actorId = state.party[0].id;
  state.research.completed = { ...state.research.completed, GATHERING: true, HUNTING: true, CORDAGE: true };
  state.tribe.assignments = Object.fromEntries(engine.TRIBE_JOBS.map(job => [job.id, job.id === 'builder' ? 1 : job.id === 'forager' ? 3 : 0]));
  state.tribe.autoAssignments = Object.fromEntries(engine.TRIBE_JOBS.map(job => [job.id, 0]));
  for (let index = 0; index < 3; index++) state = engine.runCampAction(state, actorId, 'fuel', { rng: () => 0.5 });
  state = engine.ancestralRiteAction(state, actorId, actorId);
  assert.equal(engine.projectTraditionSummary(state, actorId).canReserve, true);
  state = engine.reserveProjectTraditionAction(state, actorId);
  assert.doesNotMatch(renderToStaticMarkup(render(Founders, foundersProps(state)).tree), /실제 정산에 남은 전승 기여/);
  state = engine.advanceDay(state, { rng: () => 0.5 });
  assert.equal(state.projects.resourceCommitted['drying-rack'], true);
  assert.equal(state.projectTradition.records[0].appliedWork, 1);
  const before = structuredClone(state), html = renderToStaticMarkup(render(Founders, foundersProps(state)).tree);
  assert.match(html, /실제 정산에 남은 전승 기여/); assert.match(html, /실제 전승 작업 \+1/);
  assert.match(html, /후계 본인이 수행한 활동으로 바꾸어 세지 않습니다/); assert.deepEqual(state, before);
  const broken = structuredClone(state); broken.projectTradition.records[0].appliedWork = -1;
  assert.doesNotMatch(renderToStaticMarkup(render(Founders, foundersProps(broken)).tree), /실제 정산에 남은 전승 기여/);
});
check('living retirement remains teaching and only confirmed natural death becomes ancestral blessing with the same person record link', () => {
  const retired = chainIdentityFixture(1), dead = naturalDeathIdentityFixture();
  for (const [state, rootId, expected, forbidden] of [
    [retired.state, retired.rootId, /은퇴한 인물의 가르침/, /사후 시조신의 가호/],
    [dead.state, dead.rootId, /사후 시조신의 가호/, /은퇴한 인물의 가르침/],
  ]) {
    const faith = engine.ancestralFaithRows(state).find(row => row.founderId === rootId);
    assert.ok(faith);
    const { tree } = render(Founders, foundersProps(state, { ancestralRows: [faith], ancestralFaith: engine.ancestralFaithSummary(state) }));
    const card = elements(tree, node => node.type === 'article' && node.props.className === 'primitive-founders__faith')[0];
    const html = renderToStaticMarkup(card); assert.match(html, expected); assert.doesNotMatch(html, forbidden);
    const link = elements(card, node => node.type?.name === 'PersonRecordLink')[0];
    assert.equal(link.props.person.actorId, rootId);
  }
});
check('personal custom portrait and custom root portrait both reach the unchanged real portrait resolver', () => {
  let state = identityFixture(), rootId = state.party[0].id; state.party[0].portrait = '/custom/root-identity.png';
  state = engine.prepareSuccessorAction(state, rootId, { rng: () => 0.5 });
  const person = state.lineage.prepared[0].actor; person.portrait = '/custom/heir-identity.png';
  const identity = archiveIdentityIndex(state)[person.id], tree = Person({ identity });
  const referencePortrait = elements(tree, node => node.type === Portrait)[0]; assert.ok(referencePortrait);
  assert.equal(referencePortrait.props.member.actorId, rootId);
  assert.equal(resolveArchivePortrait(person).src, '/custom/heir-identity.png');
  assert.equal(resolveArchivePortrait(referencePortrait.props.member).src, '/custom/root-identity.png');
  const ownImage = Portrait({ member: person, alt: person.name });
  const rootImage = Portrait(referencePortrait.props);
  assert.equal(ownImage.props.children.props.src, '/custom/heir-identity.png');
  assert.equal(rootImage.props.children.props.src, '/custom/root-identity.png');
  assert.notEqual(ownImage.props.children.props.src, rootImage.props.children.props.src);
});
check('unknown generations render unrecorded evidence and never display numeric NaN Infinity or a fabricated founder badge', () => {
  const source = identityFixture(); source.lineage = undefined; source.founderHistory = undefined;
  const row = archiveIdentityIndex(source)[source.party[0].id];
  const html = renderToStaticMarkup(React.createElement(Person, { identity: row }));
  assert.match(html, /세대 미기록/); assert.match(html, /인물 기록 확인 필요/);
  assert.doesNotMatch(html, /NaN|Infinity|창건자 본인|0세대/);
});
check('identity CSS keeps era colors keyboard focus mobile wrapping and selectors scoped to identity content', () => {
  const styles = new URL('../src/styles/', import.meta.url);
  const candidates = readdirSync(styles).filter(name => name.endsWith('.css') && readFileSync(new URL(name, styles), 'utf8').includes('.primitive-person-identity'));
  assert.ok(candidates.length > 0, 'Identity styles must be part of current tracked styles');
  const selectors = [], focusSelectors = [], declarations = [], media = [];
  for (const name of candidates) {
    const parsed = postcss.parse(readFileSync(new URL(name, styles), 'utf8'));
    parsed.walkRules(rule => {
      if (rule.selector.includes('focus-visible') && rule.selector.includes('primitive-era') && rule.selector.includes('button')) focusSelectors.push(rule.selector);
      if (rule.selector.includes('primitive-person-identity')) {
      selectors.push(rule.selector); rule.walkDecls(decl => declarations.push([decl.prop, decl.value]));
    } }); parsed.walkAtRules('media', rule => media.push(rule.params));
  }
  assert.ok(selectors.every(selector => selector.split(',').every(part => part.includes('primitive-person-identity'))));
  assert.ok(focusSelectors.length > 0, 'Existing era shell button focus covers party selection; identity adds no interactive element');
  assert.ok(declarations.some(([prop, value]) => prop === 'flex-wrap' && value === 'wrap'));
  assert.ok(declarations.some(([prop, value]) => prop === 'overflow-wrap' && ['anywhere', 'break-word'].includes(value)));
  assert.ok(media.some(params => /max-width/.test(params)));
  for (const [prop, value] of declarations) {
    if (prop.startsWith('--identity-role-')) assert.match(value, /var\(--era-/);
    if (/^(color|background|border-color)/.test(prop)) assert.match(value, /var\(--(?:era-|identity-role-)/);
  }
});
console.log(JSON.stringify({ pass: true, checks, mode: 'actual-current-components-and-controlled-hook-handlers',
  scope: 'Real party/founders/person identity JSX, original portrait resolver and retirement callbacks with a small hook model. SSR and static CSS/markup checks only; no mounted browser, geometry, persistence or human acceptance.', resultFiles: 0 }));
