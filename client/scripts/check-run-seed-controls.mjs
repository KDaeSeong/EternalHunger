import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import './lib/register-simulation-modules.mjs';

const seedHookSource = readFileSync(new URL('../src/app/simulation/_lib/useSimulationRunSeed.js', import.meta.url), 'utf8');
const seedCardSource = readFileSync(new URL('../src/app/simulation/_components/SimulationMarketSeedCard.js', import.meta.url), 'utf8');
const gameScreenSource = readFileSync(new URL('../src/app/simulation/_components/SimulationGameScreen.js', import.meta.url), 'utf8');
const marketHeaderSource = readFileSync(new URL('../src/app/simulation/_components/SimulationMarketHeaderPanel.js', import.meta.url), 'utf8');
const devGuardSource = readFileSync(new URL('../src/app/simulation/_lib/useSimulationDevRunGuard.js', import.meta.url), 'utf8');
const controllerSource = readFileSync(new URL('../src/app/simulation/_lib/useSimulationPageController.js', import.meta.url), 'utf8');
const pageSource = readFileSync(new URL('../src/app/simulation/page.js', import.meta.url), 'utf8');
const initialDataSource = readFileSync(new URL('../src/app/simulation/_lib/useSimulationInitialData.js', import.meta.url), 'utf8');
const { createNewSimulationSeed } = await import('../src/app/simulation/_lib/useSimulationRunSeed.js');

let checks = 0;
function check(name, run) {
  run();
  checks += 1;
  console.log(`PASS ${name}`);
}

check('a fresh seed is different even when the button is clicked in the same millisecond', () => {
  const originalNow = Date.now;
  Date.now = () => 1788542576577;
  try {
    const first = createNewSimulationSeed('1788542576577');
    const second = createNewSimulationSeed(first);
    const third = createNewSimulationSeed(second);
    assert.equal(first, '1788542576577-new-1');
    assert.equal(second, '1788542576577-new-2');
    assert.equal(third, '1788542576577-new-3');
    assert.equal(new Set([first, second, third]).size, 3);
  } finally {
    Date.now = originalNow;
  }
});

check('normal new runs keep the current seed available through local storage', () => {
  assert.match(seedHookSource, /const SEED_STORAGE_KEY = 'eh_run_seed'/);
  assert.match(seedHookSource, /savedSeed \?\? getInitialSeed\(\)/);
  assert.match(seedHookSource, /if \(savedSeed !== undefined\) return;/);
  assert.match(seedHookSource, /localStorage\.setItem\(SEED_STORAGE_KEY/);
  assert.match(seedHookSource, /const value = window\.localStorage\.getItem\(SEED_STORAGE_KEY\)/);
  assert.match(seedHookSource, /catch \{\s*return String\(Date\.now\(\)\);/);
  assert.match(seedHookSource, /catch \{\s*\/\/ ignore storage errors/);
});

check('replays, editable variants, and isolated evaluation runs select their intended seed without cross-mode leakage', () => {
  assert.match(controllerSource, /const sourceRecord = replayRecord \|\| draftRecord;/);
  assert.match(controllerSource, /const replayMode = Boolean\(replayRecord\);/);
  assert.match(controllerSource, /const draftMode = Boolean\(draftRecord\);/);
  assert.match(
    controllerSource,
    /useSimulationRunSeed\(\s*sourceRecord\?\.input\?\.runSeed \?\? \(evaluationMode \? evaluationSeed : undefined\)\s*\)/,
  );
  assert.match(controllerSource, /for \(const key of \['onToggleDevTools'[\s\S]*?'setRunSeed'\]\)/);
  assert.match(pageSource, /key=\{session\.key\}/);
  assert.match(pageSource, /draftRecord=\{session\.mode === 'variant' \? session\.record : null\}/);
  assert.match(initialDataSource, /prepareSimulationRunInput\(replayRecord\.input\)/);
  assert.match(initialDataSource, /editableCopy/);
});

check('the pregame card exposes current seed and an explicit new-seed action', () => {
  assert.match(seedCardSource, /현재 시드:/);
  assert.match(seedCardSource, /createNewSimulationSeed\(latestSeedRef\.current\)/);
  assert.match(seedCardSource, /String\(seedDraft \|\| ''\)\.trim\(\) \|\| createNewSimulationSeed\(latestSeedRef\.current\)/);
  assert.match(seedCardSource, /setSeedDraft\(nextSeed\)/);
  assert.match(seedCardSource, /commitSeed\(nextSeed\)/);
});

check('replay and started games disable every seed edit control', () => {
  assert.match(seedCardSource, /const locked = replayMode \|\| isAdvancing \|\| isGameOver \|\| day !== 0 \|\| matchSec !== 0;/);
  assert.match(seedCardSource, /const latestSeedRef = useRef\(runSeed\)/);
  assert.equal((seedCardSource.match(/disabled=\{locked\}/g) || []).length, 3);
  assert.match(seedCardSource, /replayMode = false/);
});

check('the seed card is rendered in the ordinary game screen rather than the developer panel', () => {
  assert.match(gameScreenSource, /import SimulationMarketSeedCard from '\.\/SimulationMarketSeedCard';/);
  assert.match(gameScreenSource, /<SimulationMarketSeedCard[\s\S]*?replayMode=\{replayMode\}[\s\S]*?setSeedDraft=\{setSeedDraft\}/);
  assert.doesNotMatch(marketHeaderSource, /SimulationMarketSeedCard/);
});

check('changing the seed is a clean pregame input and never marks the run as developer-tainted', () => {
  assert.doesNotMatch(seedCardSource, /markDevRunTainted|devRunTainted/);
  assert.doesNotMatch(seedHookSource, /markDevRunTainted|devRunTainted/);
});

check('opening developer tools does not taint a run by itself', () => {
  const toggle = devGuardSource.match(/function handleDevToolsToggle\(\) \{([\s\S]*?)\n  \}/)?.[1] || '';
  assert.match(toggle, /setShowMarketPanel/);
  assert.doesNotMatch(toggle, /markDevRunTainted|setDevRunTainted/);
});

console.log(`Run-seed control checks: ${checks}`);
