import './lib/register-simulation-modules.mjs';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { resolve, sep } from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';

const components = new Set([
  '../src/app/characters/_components/CharacterBasicEditModal.js',
  '../src/app/characters/_components/CharacterSkillConfigModal.js',
  '../src/app/characters/_components/CharacterSkillConfigFields.js',
  '../src/app/characters/_components/CharacterStatusEffectFields.js',
  '../src/components/HungerTraitFields.js',
].map(path => new URL(path, import.meta.url).href));
registerHooks({ resolve(specifier, context, nextResolve) {
  return nextResolve(specifier === 'next/image' ? 'next/image.js' : specifier === 'next/link' ? 'next/link.js' : specifier, context);
}, load(url, context, nextLoad) {
  if (!components.has(url)) return nextLoad(url, context);
  const source = readFileSync(new URL(url), 'utf8').replace("import Image from 'next/image';",
    "import NextImage from 'next/image'; const Image = NextImage.default || NextImage;")
    .replace("import Link from 'next/link';", "import NextLink from 'next/link'; const Link = NextLink.default || NextLink;");
  return { format: 'module', shortCircuit: true, source: ts.transpileModule(source, {
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext },
  }).outputText };
} });
const { default: BasicModal } = await import('../src/app/characters/_components/CharacterBasicEditModal.js');
const { default: SkillModal } = await import('../src/app/characters/_components/CharacterSkillConfigModal.js');
const { default: TraitFields } = await import('../src/components/HungerTraitFields.js');
const { HUNGER_TRAITS } = await import('../src/utils/hungerTraits.js');
const { WEAPON_TYPES_KO, createBlankCharacter, enableAllCharacterSkills } = await import('../src/app/characters/_lib/characterEditorRuntime.js');
const blank = createBlankCharacter('basic-layout-fixture');
const image = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="180" height="180"><rect width="180" height="180" fill="#e6f0f9"/><circle cx="90" cy="72" r="28" fill="#1766a8"/><path d="M35 160a55 55 0 0 1 110 0" fill="#1766a8"/></svg>');
const props = character => ({ character, onClose() {}, onBackdropPointerDown() {},
  onBackdropPointerUp() {}, onImageUpload() {}, onUpdateCharacter() {} });
const render = character => renderToStaticMarkup(React.createElement(BasicModal, props(character)));
const skillProps = { ...props(blank), editCharacterSkills: blank.characterSkills, activeSkillSlot: 'q',
  editTacticalSkill: '블링크', editUniqueResource: { enabled: false }, onUpdateSkill() {}, onEnableAllSkills() {},
  onSetUniqueResource() {}, onCompileSkillDescription() {}, onSetManualSkillInputEnabled() {} };
function descendants(element, predicate) {
  if (!React.isValidElement(element)) return [];
  return [...(predicate(element) ? [element] : []),
    ...React.Children.toArray(element.props.children).flatMap(child => descendants(child, predicate))];
}
let passed = 0;
const check = (name, run) => { run(); passed++; console.log(`PASS ${name}`); };
check('a closed basic modal renders no stale form', () => assert.equal(render(null), ''));
check('blank characters retain name, sex, all weapon choices and all narrative traits', () => {
  const html = render(blank);
  assert.match(html, /이름 없음/); assert.match(html, /이미지 없음/);
  assert.equal((html.match(/type="checkbox"/g) || []).length, WEAPON_TYPES_KO.length + HUNGER_TRAITS.length);
  for (const label of [...WEAPON_TYPES_KO, ...HUNGER_TRAITS.map(trait => trait.label)]) assert.ok(html.includes(label), label);
  assert.match(html, /type="text"/); assert.match(html, /<select/); assert.match(html, /type="file"/);
});
check('a supplied portrait uses the real Image component without changing character data', () => {
  const character = { ...blank, previewImage: image }, before = structuredClone(character);
  const html = render(character);
  assert.match(html, /alt="미리보기"/); assert.doesNotMatch(html, /이미지 없음/);
  assert.deepEqual(character, before);
});
check('weapon toggles preserve the characters API patch contract', () => {
  const calls = [], character = { ...blank, erWeapons: ['권총'], weaponType: '권총' };
  const tree = BasicModal({ ...props(character), onUpdateCharacter: (...args) => calls.push(args) });
  const box = descendants(tree, node => node.type === 'input' && node.props.type === 'checkbox')[0];
  assert.equal(box.props.checked, true); box.props.onChange();
  assert.deepEqual(calls, [['basic-layout-fixture', { erWeapons: [], weaponType: '' }]]);
  assert.deepEqual(character.erWeapons, ['권총']);
});
check('known and unknown traits remain editable without mutating the source array', () => {
  const value = ['lightning_control', 'authored_trait'], before = [...value], changed = [];
  const tree = TraitFields({ value, onChange: next => changed.push(next) });
  const boxes = descendants(tree, node => node.type === 'input' && node.props.type === 'checkbox');
  assert.equal(boxes.length, HUNGER_TRAITS.length + 1); assert.equal(boxes[0].props.checked, true);
  boxes[0].props.onChange(); assert.deepEqual(changed[0], ['authored_trait']);
  boxes.at(-1).props.onChange(); assert.deepEqual(changed[1], ['lightning_control']);
  assert.deepEqual(value, before);
});
check('disabled trait editors keep their fieldset-level interaction lock', () => {
  const tree = TraitFields({ value: [], disabled: true, onChange() {} });
  assert.equal(tree.type, 'fieldset'); assert.equal(tree.props.disabled, true);
});
check('enable all preserves every authored draft and leaves the source untouched', () => {
  const drafts = { ...blank.characterSkills, q: { ...blank.characterSkills.q, enabled: false,
    sourceText: '작성 중인 Q 설명', firstFlat: [1, 2, 3, 4, 5], statusEffects: [{ name: '수정 중인 상태' }] } };
  const before = structuredClone(drafts), next = enableAllCharacterSkills(drafts);
  for (const slot of ['q', 'w', 'e', 'r', 'passive']) {
    assert.equal(next[slot].enabled, true); assert.deepEqual(next[slot], { ...drafts[slot], enabled: true });
  }
  assert.deepEqual(drafts, before); assert.deepEqual(enableAllCharacterSkills(next), next);
});
check('enable all fills missing slots without adding or enabling a resource definition', () => {
  const next = enableAllCharacterSkills({ q: { name: 'Q 초안' } });
  assert.deepEqual(Object.keys(next), ['q', 'w', 'e', 'r', 'passive']);
  assert.ok(Object.values(next).every(skill => skill.enabled)); assert.equal(next.q.name, 'Q 초안');
  assert.equal(Object.hasOwn(next, 'uniqueResource'), false);
});
check('the real modal exposes the bulk handler and disables it only when all five slots are enabled', () => {
  const calls = [];
  const tree = SkillModal({ ...skillProps, onEnableAllSkills: () => calls.push('enable') });
  const button = descendants(tree, node => node.type === 'button' && node.props.children === '전부 사용')[0];
  assert.ok(button); assert.equal(button.props.disabled, false); button.props.onClick(); assert.deepEqual(calls, ['enable']);
  const enabled = SkillModal({ ...skillProps, editCharacterSkills: enableAllCharacterSkills(blank.characterSkills) });
  assert.equal(descendants(enabled, node => node.type === 'button' && node.props.children === '전부 사용')[0].props.disabled, true);
});
console.log(`Character basic layout component checks passed: ${passed}`);

// Optional loopback-only visual fixture: the actual component with the actual
// production /characters CSS, not an authenticated account, API or saved roster.
// Rebuild and restart this preview after changing the component or styles.
if (process.argv.includes('--preview')) {
  const staticRoot = resolve(fileURLToPath(new URL('../.next/static/', import.meta.url)));
  const builtPage = readFileSync(new URL('../.next/server/app/characters.html', import.meta.url), 'utf8');
  const cssLinks = [...new Set([...builtPage.matchAll(/href="(\/_next\/static\/css\/[^"?]+\.css)"/g)].map(match => match[1]))];
  assert.ok(cssLinks.length, 'Run npm run build before inspecting production CSS.');
  const buildId = readFileSync(new URL('../.next/BUILD_ID', import.meta.url), 'utf8').trim();
  const server = createServer((request, response) => {
    const url = new URL(request.url, 'http://127.0.0.1:3117');
    if (url.pathname.startsWith('/_next/static/')) {
      const file = resolve(staticRoot, decodeURIComponent(url.pathname.slice('/_next/static/'.length)));
      if (!file.startsWith(staticRoot + sep)) { response.writeHead(403).end(); return; }
      try {
        response.setHeader('Content-Type', file.endsWith('.css') ? 'text/css' : 'font/woff2');
        response.end(readFileSync(file));
      } catch { response.writeHead(404).end(); }
      return;
    }
    response.setHeader('Content-Type', 'text/html; charset=utf-8');
    const content = url.searchParams.has('skills')
      ? renderToStaticMarkup(React.createElement(SkillModal, skillProps))
      : render(url.searchParams.has('image') ? { ...blank, previewImage: image } : blank);
    response.end(`<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>캐릭터 편집 레이아웃 확인</title>${cssLinks.map(href => `<link rel="stylesheet" href="${href}">`).join('')}</head><body>${content}</body></html>`);
  });
  server.listen(3117, '127.0.0.1', () => console.log(`BASIC_LAYOUT_PREVIEW http://127.0.0.1:3117/ build=${buildId}`));
}
