import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import nextImageModule from 'next/image.js';
import postcss from 'postcss';
import ts from 'typescript';
import './lib/register-simulation-modules.mjs';

const root = new URL('../', import.meta.url);
const directory = new URL('src/app/games/primitive-archive/_components/', root);
const urls = Object.fromEntries(['FoundersTab', 'PartyWorkspace', 'RunTab', 'Portrait'].map((name) =>
  [name, new URL(`PrimitiveArchive${name}.js`, directory).href]));
const transformed = new Set(Object.values(urls));
globalThis.__officialPortraitReact = React;
globalThis.__officialPortraitImage = nextImageModule.default;
const dataModule = (source) => ({ url: `data:text/javascript,${encodeURIComponent(source)}`, shortCircuit: true });
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (transformed.has(context.parentURL)) {
      if (specifier === 'next/image') return dataModule('export default globalThis.__officialPortraitImage;');
      if (specifier === 'next/link') return dataModule(`export default function Link(props) {
        return globalThis.__officialPortraitReact.createElement('a', props); }`);
      if (specifier === '../../_components/GamePlayPrimitives') return dataModule(`
        function Button(props) { return globalThis.__officialPortraitReact.createElement('button', {
          type: 'button', disabled: props.disabled, onClick: props.onClick,
          'data-action': props.action, children: props.children }); }
        export { Button as ActionButton, Button as GameControlButton };`);
      if (specifier === './PrimitiveArchiveVisuals') return dataModule(`
        export function PrimitiveArchivePanelTitle(props) { return globalThis.__officialPortraitReact.createElement('header', null,
          globalThis.__officialPortraitReact.createElement('h2', null, props.title), props.meta, props.children); }
        export function PrimitiveArchiveIconRow(props) { return globalThis.__officialPortraitReact.createElement('article', null, props.children); }`);
    }
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (!transformed.has(url)) return nextLoad(url, context);
    return { format: 'module', shortCircuit: true, source: ts.transpileModule(readFileSync(new URL(url), 'utf8'), {
      compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext },
    }).outputText };
  },
});
const { default: Founders } = await import(urls.FoundersTab);
const { default: Party } = await import(urls.PartyWorkspace);
const { default: RunTab } = await import(urls.RunTab);
const { default: Portrait } = await import(urls.Portrait);
const engine = await import('../src/app/games/primitive-archive/_lib/primitiveArchiveEngine.js');
const { STUDENTS } = await import('../src/app/games/primitive-archive/_lib/primitiveArchiveData.js');
const { founderHistoryRows } = await import('../src/app/games/primitive-archive/_lib/primitiveArchiveFounders.js');
const life = await import('../src/app/games/primitive-archive/_lib/primitiveArchiveLineage.js');
const faith = await import('../src/app/games/primitive-archive/_lib/primitiveArchiveAncestralFaith.js');
const { resolveArchivePortrait } = await import('../src/app/games/primitive-archive/_lib/primitiveArchivePortraits.js');
const freeze = (value) => {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value); Object.values(value).forEach(freeze);
  }
  return value;
};
const render = (Component, props) => renderToStaticMarkup(React.createElement(Component, props));
const images = (html) => [...html.matchAll(/<img\b[^>]*>/g)].map((match) => match[0]
  .replace(/\b(src|srcSet)="([^"]*)"/gi, (_, attribute, url) => `${attribute}="${decodeURIComponent(url)}"`));
const compactImages = (html) => [...html.matchAll(/(<span\b[^>]*>)(<img\b[^>]*>)/g)]
  .filter((match) => /class="primitive-archive-portrait[^\"]*"/.test(match[1])
    && /style="[^\"]*32px[^\"]*"/.test(match[1]))
  .flatMap((match) => images(match[2]));
const findNodes = (node, predicate) => {
  if (!node || typeof node !== 'object') return [];
  return [...(predicate(node) ? [node] : []), ...React.Children.toArray(node.props?.children).flatMap((child) => findNodes(child, predicate))];
};
const initial = freeze(engine.createNewState({ runId: 'official-portrait-ui',
  now: '2026-10-30T00:00:00.000Z', rng: () => 0.5 }));
const difficulty = engine.difficultyRows().find((row) => row.key === initial.difficulty);
const legacyActors = freeze(STUDENTS.map((student) => ({ ...student,
  portrait: `/games/primitive-archive/portraits/${['shiroko', 'hina', 'noa'].includes(student.id) ? student.id : 'placeholder'}.svg`,
  hp: 100, hunger: 12, stamina: 100, bodyTemp: 37,
})));
const originalBytes = JSON.stringify({ initial, legacyActors });
const partyProps = (members) => ({ state: { ...initial, party: members }, actorId: members[0].id,
  partyCap: 8, partySort: 'default', recruitCandidates: [], hydrated: true, busy: false,
  archiveVictory: engine.archiveVictorySummary(initial), setPartySort: () => {},
  partyView: members.map((member) => ({ member, chances: { gather: 0.5, hunt: 0.5, craft: 0.5 },
    basisAction: 'gather', basisChance: 0.5, badges: [], nightSurvival: null })),
});
const recordRows = freeze(legacyActors.map((member) => ({ actorId: member.id, name: member.name,
  role: member.role, portrait: member.portrait, firstObservedDay: 1, observedFromDay: 1,
  foundersKnown: false, isFounder: false, living: true, tallies: {}, recentDeeds: [], deathRecord: null })));
let selection = STUDENTS.slice(0, 3).map((member) => member.id);
const runProps = () => ({ state: initial, currentDifficulty: difficulty, selectedDifficulty: difficulty,
  newRunDifficulty: initial.difficulty, founderChoices: STUDENTS, newRunFounderIds: selection,
  setNewRunFounderIds: (update) => { selection = typeof update === 'function' ? update(selection) : update; },
  archiveVictory: engine.archiveVictorySummary(initial), busy: false, hydrated: true,
});
const assertOfficialImages = (html, members) => {
  const tags = images(html);
  for (const member of members) {
    const expected = resolveArchivePortrait(member);
    assert.match(expected.src, /^\/games\/primitive-archive\/portraits\/official\//);
    const tag = tags.find((image) => image.includes(expected.src));
    assert.ok(tag, `Missing displayed portrait for ${member.name}.`);
    assert.ok(tag.includes(`object-position:${expected.objectPosition}`), `Missing crop position for ${member.name}.`);
  }
};
let checks = 0;
const check = (name, run) => { run(); checks += 1; console.log(`PASS ${name}`); };

check('all eight founder choices render the current helper artwork and crop position', () => {
  assert.equal(STUDENTS.length, 8);
  const html = render(RunTab, runProps());
  assertOfficialImages(html, STUDENTS);
  assert.equal(images(html).length, 8);
  assert.equal((html.match(/type="checkbox"/g) || []).length, 8);
  assert.match(html, /primitive-founder-selection__portrait/);
  assert.match(html, /새 런에서는 정착 기반을 갖춘 뒤 생애와 후계가 이어집니다/);
  assert.match(html, /실제 기록을 남긴 창건자의 가르침/);
});
check('native founder selection still caps three, supports replacement and preserves order', () => {
  const inputs = () => findNodes(RunTab(runProps()), (node) => node.type === 'input');
  inputs()[3].props.onChange({ target: { checked: true } });
  assert.deepEqual(selection, STUDENTS.slice(0, 3).map((member) => member.id));
  inputs()[1].props.onChange({ target: { checked: false } });
  inputs()[3].props.onChange({ target: { checked: true } });
  assert.deepEqual(selection, [STUDENTS[0].id, STUDENTS[2].id, STUDENTS[3].id]);
});
check('saved built-in party portraits display official artwork without changing actor selection or saved bytes', () => {
  let selected;
  const props = { ...partyProps(legacyActors), setActorId: (id) => { selected = id; } };
  const html = render(Party, props);
  assertOfficialImages(html, legacyActors);
  const memberButtons = findNodes(Party(props), (node) => node.type === 'button' && node.props['data-game-sfx'] === 'select');
  assert.equal(memberButtons.length, 8);
  memberButtons[5].props.onClick();
  assert.equal(selected, legacyActors[5].id);
  assert.equal(JSON.stringify({ initial, legacyActors }), originalBytes);
});
check('historical actorId rows resolve all eight original portraits and retain the complete text record', () => {
  const html = render(Founders, { foundersRows: recordRows });
  assertOfficialImages(html, recordRows);
  assert.match(html, /창건 명단 미상/);
  assert.match(html, /이름·분야별 업적·최근 기록/);
  for (const member of recordRows) assert.ok(html.includes(member.name));
});
check('life and ancestral decision rows show small original portraits while generated heirs remain distinct', () => {
  const ready = { ...initial, camp: { ...initial.camp, shelterLevel: 1, fireLevel: 1, fuel: 3 },
    inventory: { ...initial.inventory, berry: 30 }, tribe: { ...initial.tribe, population: 4, morale: 60 },
    research: { ...initial.research, completed: { ...initial.research.completed, SETTLEMENT: true, FOOD_STORAGE: true } } };
  const prepared = life.prepareLineageSuccessor(ready, initial.party[0].id);
  assert.equal(prepared.ok, true);
  const retired = life.retireLineageActor(prepared.state, initial.party[0].id);
  assert.equal(retired.ok, true);
  const state = freeze(retired.state);
  const before = JSON.stringify(state);
  const props = { state, foundersRows: founderHistoryRows(state), lineage: life.lineageSummary(state),
    ancestralRows: faith.ancestralFaithRows(state, state.party[0].id), ancestralFaith: faith.ancestralFaithSummary(state) };
  const html = render(Founders, props);
  const tags = compactImages(html);
  const heir = state.party.find((actor) => actor.lineageGeneration > 0);
  assert.ok(heir);
  const heirPortrait = resolveArchivePortrait(heir);
  assert.equal(heirPortrait.src, '/games/primitive-archive/portraits/placeholder.svg');
  assert.ok(tags.some((image) => image.includes(heirPortrait.src)));
  for (const founder of initial.party) {
    const expected = resolveArchivePortrait(founder);
    assert.ok(tags.some((image) => image.includes(expected.src)));
  }
  assert.match(html, /은퇴한 인물의 가르침/);
  assert.ok(html.includes(heir.name));
  assert.equal(JSON.stringify(state), before);
});
check('custom external originals remain unchanged in party, historical and ancestral display paths', () => {
  const custom = freeze({ ...legacyActors[0], portrait: 'https://custom.invalid/own.svg' });
  const customRow = { ...recordRows[0], portrait: custom.portrait };
  const partyHtml = render(Party, { ...partyProps([custom]), setActorId: () => {} });
  const recordHtml = render(Founders, { foundersRows: [customRow],
    ancestralRows: [{ founderId: custom.id, name: custom.name, role: custom.role, portrait: custom.portrait,
      status: 'living', mode: 'teaching', contributionCount: 0, ready: false, message: '실제 기여가 필요합니다.' }] });
  for (const html of [partyHtml, recordHtml]) {
    const tags = images(html);
    assert.ok(tags.some((image) => image.includes(custom.portrait)));
    assert.ok(!tags.some((image) => image.includes(resolveArchivePortrait(STUDENTS[0]).src)));
  }
  assert.equal(custom.portrait, 'https://custom.invalid/own.svg');
});
check('shared portrait frames use actual source dimensions, crop geometry and zoom-aware image sizes', () => {
  for (const member of STUDENTS) {
    const expected = resolveArchivePortrait(member);
    const html = render(Portrait, { member, size: 44 });
    const image = images(html)[0];
    assert.ok(html.includes('var(--archive-portrait-frame-size, 44px)'));
    if (expected.crop) {
      assert.ok(image.includes(`width="${expected.width}"`));
      assert.ok(image.includes(`height="${expected.height}"`));
      assert.ok(image.includes(`sizes="${Math.ceil(44 * expected.crop.zoom)}px"`));
      assert.ok(image.includes(`width:${expected.crop.zoom * 100}%`));
      assert.ok(image.includes('height:auto'));
      assert.ok(image.includes('left:50%;top:50%'));
      assert.ok(image.includes(`transform:translate(-${expected.crop.x}%, -${expected.crop.y}%)`));
    } else {
      assert.ok(image.includes('object-fit:cover'));
    }
  }
});
check('portrait styles keep compact square thumbnails, wrapping and the existing checkbox affordance', () => {
  const css = readFileSync(new URL('src/styles/PrimitiveArchiveFounders.css', root), 'utf8');
  postcss.parse(css);
  assert.match(css, /primitive-founders__portrait--compact[^}]*width: 32px/);
  assert.match(css, /primitive-founder-selection__portrait[^}]*width: 40px[^}]*object-fit: cover/);
  assert.match(css, /primitive-founder-selection__choices input[^}]*width: 20px/);
  assert.match(css, /primitive-founders__actor-copy[^}]*min-width: 0/);
  assert.match(css, /primitive-archive-portrait[^}]*position: relative[^}]*overflow: hidden/);
  assert.match(css, /primitive-party-member > \.primitive-archive-portrait[^}]*--archive-portrait-frame-size: 38px/);
  assert.equal(JSON.stringify({ initial, legacyActors }), originalBytes);
});
delete globalThis.__officialPortraitReact; delete globalThis.__officialPortraitImage;
console.log(JSON.stringify({ pass: true, checks,
  scope: 'Actual Party/RunTab/Founders and Next Image SSR with real portrait helper; native selection handlers and immutable fixture checks. Presentation title/button/link wrappers only substituted. Not image provenance, portrait-framing visual QA, browser layout or live-game acceptance.' }));
