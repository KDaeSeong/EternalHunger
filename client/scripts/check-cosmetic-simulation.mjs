import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import ts from 'typescript';
import './lib/register-simulation-modules.mjs';
import { createHandlerHarness, elements, textOf } from './lib/hook-handler-harness.mjs';

// Execute the actual JSX boundaries with a controlled account snapshot. Layout
// and authentication storage are verified separately in the browser.
const componentBase = new URL('../src/app/simulation/_components/', import.meta.url);
const componentUrls = new Set(['SimulationResultModal.js', 'SimulationLogPanel.js', 'SimulationSurvivorBoard.js']
  .map((name) => new URL(name, componentBase).href));
const harnessUrl = new URL('./lib/hook-handler-harness.mjs', import.meta.url).href;
const jsxUrl = `data:text/javascript,${encodeURIComponent(`
  export const Fragment = Symbol.for('test.fragment');
  export const jsx = (type, props) => ({type, props: props || {}});
  export const jsxs = jsx;
`)}`;
const authUrl = `data:text/javascript,${encodeURIComponent('export const useAuthUser = () => globalThis.cosmeticTestAccount;')}`;
const emptyUrl = `data:text/javascript,${encodeURIComponent('export default function Child() { return null; }')}`;
const imageUrl = `data:text/javascript,${encodeURIComponent('export default function Image(props) { return {type:"img", props}; }')}`;
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (componentUrls.has(context.parentURL)) {
      if (specifier === 'react/jsx-runtime') return { url: jsxUrl, shortCircuit: true };
      if (specifier === 'react') return { url: harnessUrl, shortCircuit: true };
      if (specifier.endsWith('/client-auth')) return { url: authUrl, shortCircuit: true };
      if (specifier.endsWith('.css') || specifier.endsWith('/GameActionIcon')) return { url: emptyUrl, shortCircuit: true };
      if (specifier === 'next/image') return { url: imageUrl, shortCircuit: true };
    }
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (!componentUrls.has(url)) return nextLoad(url, context);
    return {
      format: 'module', shortCircuit: true,
      source: ts.transpileModule(readFileSync(new URL(url), 'utf8'), {
        compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext },
      }).outputText,
    };
  },
});

const { default: Result } = await import(new URL('SimulationResultModal.js', componentBase));
const { default: Logs } = await import(new URL('SimulationLogPanel.js', componentBase));
const { default: Board } = await import(new URL('SimulationSurvivorBoard.js', componentBase));
const actor = { _id: 'actor', name: '테스트 생존자', hp: 90, maxHp: 100, stats: { attackPower: 10 }, previewImage: '/Images/default_image.svg' };
const resultProps = { open: true, winner: actor, resultSummary: { participantsCount: 24, matchMode: 'solo' } };
const logProps = { day: 0, logs: [{ id: 1, type: 'kill', text: '[테스트 생존자] 처치' }],
  actorAvatarByName: { '테스트 생존자': actor.previewImage }, extractActorNameFromLog: () => actor.name };
const boardProps = { survivors: [actor], dead: [{ ...actor, _id: 'dead', hp: 0 }], settings: { matchMode: 'solo' } };
const originalActor = structuredClone(actor);
const classNodes = (tree, name) => elements(tree, (node) => String(node.props?.className || '').split(/\s+/).includes(name));

for (const frame of ['SKYLINE', 'GOLDLINE']) {
  globalThis.cosmeticTestAccount = { perks: [`COS_FRAME_${frame}`] };
  const result = Result(resultProps);
  assert.equal(classNodes(result, `perk-frame--${frame.toLowerCase()}`).length, 1, 'winner image consumes the owned frame');
  const board = Board(boardProps);
  const cards = elements(board, (node) => typeof node.type === 'function' && node.props?.actor);
  assert.equal(cards.length, 2);
  for (const card of cards) assert.equal(card.props.frameClass, `perk-frame--${frame.toLowerCase()}`, 'both living and dead card boundaries receive the frame');
  const harness = createHandlerHarness(Logs, logProps);
  harness.render();
  const message = elements(harness.tree, (node) => typeof node.type === 'function' && node.props?.log)[0];
  assert.ok(message);
  assert.equal(classNodes(message.type(message.props), `perk-frame--${frame.toLowerCase()}`).length, 1, 'actual log avatar consumes the frame');
  harness.unmount();
}
console.log('PASS both original frames reach winner, living/dead cards and actual log avatars');

globalThis.cosmeticTestAccount = { perks: ['COS_TITLE_ROOKIE', 'COS_TITLE_NIGHT_RUNNER', 'COS_BADGE_ALPHA', 'COS_BADGE_WEAKLINE', 'COS_LOG_CYAN', 'COS_VICTORY_SPOTLIGHT'] };
let result = Result(resultProps);
assert.match(textOf(result), /관전자 치장.*야간 루퍼.*알파 추적자 배지.*위클라인 감시자 배지/);
assert.ok(!textOf(result).includes('루미아 신입 생존자'), 'only one active title is displayed');
assert.equal(classNodes(result, 'perk-victory--spotlight').length, 1);
assert.equal(classNodes(Result({ ...resultProps, winner: null }), 'perk-victory--spotlight').length, 0, 'no false victory effect when no survivor remains');
let harness = createHandlerHarness(Logs, logProps);
harness.render();
assert.equal(classNodes(harness.tree, 'perk-log--cyan').length, 1);
const message = elements(harness.tree, (node) => typeof node.type === 'function' && node.props?.log)[0];
assert.equal(classNodes(message.type(message.props), 'kill').length, 1, 'log event type and text remain unchanged');
harness.unmount();
console.log('PASS purchased title, both badges, cyan logs and winner-only spotlight are consumed');

globalThis.cosmeticTestAccount = { perks: ['COS_TITLE_ROOKIE', 'COS_TITLE_NIGHT_RUNNER'], cosmeticLoadout: { title: 'COS_TITLE_ROOKIE' } };
result = Result(resultProps);
assert.match(textOf(result), /루미아 신입 생존자/);
assert.ok(!textOf(result).includes('야간 루퍼'));
globalThis.cosmeticTestAccount.cosmeticLoadout.title = '';
assert.equal(elements(Result(resultProps), (node) => node.props?.['aria-label'] === '관전자 치장').length, 0);
globalThis.cosmeticTestAccount = null;
assert.equal(classNodes(Result(resultProps), 'perk-victory--spotlight').length, 0);
harness = createHandlerHarness(Logs, logProps);
harness.render();
assert.equal(classNodes(harness.tree, 'perk-log--cyan').length, 0);
harness.unmount();
assert.deepEqual(actor, originalActor, 'cosmetics never change combat stats, health, credits or actor state');
delete globalThis.cosmeticTestAccount;
console.log('PASS explicit title selection, unequip and account logout clear display without changing game state');
