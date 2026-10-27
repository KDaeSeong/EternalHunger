import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import ts from 'typescript';
import './lib/register-simulation-modules.mjs';
import { elements } from './lib/hook-handler-harness.mjs';

const screenUrl = new URL('../src/app/simulation/_components/SimulationGameScreen.js', import.meta.url).href;
const jsxRuntimeUrl = `data:text/javascript,${encodeURIComponent(`
  export const Fragment = Symbol.for('test.fragment');
  export function jsx(type, props) { return { type, props: props || {} }; }
  export function jsxs(type, props) { return { type, props: props || {} }; }
`)}`;
const engineUrl = `data:text/javascript,${encodeURIComponent(`
  export const getAliveTeams = () => [];
  export const getTimeOfDayFromPhase = () => 'night';
`)}`;
const mainStageUrl = `data:text/javascript,${encodeURIComponent(`
  export default function SimulationMainStage(props) { return { type: 'stage-rendered', props }; }
`)}`;
const childUrl = `data:text/javascript,${encodeURIComponent('export default function Child() { return null; }')}`;

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (context.parentURL === screenUrl && specifier === 'react/jsx-runtime') {
      return { url: jsxRuntimeUrl, shortCircuit: true };
    }
    if (context.parentURL === screenUrl && specifier === '../_lib/simulationEngine') {
      return { url: engineUrl, shortCircuit: true };
    }
    if (context.parentURL === screenUrl && specifier === './SimulationMainStage') {
      return { url: mainStageUrl, shortCircuit: true };
    }
    if (context.parentURL === screenUrl && specifier.startsWith('./')) {
      return { url: childUrl, shortCircuit: true };
    }
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (url !== screenUrl) return nextLoad(url, context);
    const source = readFileSync(new URL(url), 'utf8');
    return {
      format: 'module',
      shortCircuit: true,
      source: ts.transpileModule(source, {
        compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext },
      }).outputText,
    };
  },
});

const { default: SimulationGameScreen } = await import(screenUrl);
const { default: SimulationMainStage } = await import(mainStageUrl);
const marker = {
  gameplayPerks: { status: 'ready', equippedCodes: ['PLAY_EH_START_SPONSOR'] },
  sponsorTeamId: 'team:7',
  setSponsorTeamId: () => {},
  sponsorPerksWithoutPerks: true,
  setSponsorPerksWithoutPerks: () => {},
};
const tree = SimulationGameScreen({ ...marker, phase: 'night', survivors: [] });
const stageElement = elements(tree, (node) => node.type === SimulationMainStage)[0];
assert.ok(stageElement, 'the game screen renders its main stage');
const stage = SimulationMainStage(stageElement.props);
for (const [key, value] of Object.entries(marker)) assert.equal(stage.props[key], value, `${key} reaches the rendered main stage`);
console.log('PASS all five sponsor controls reach the rendered SimulationMainStage props.');
