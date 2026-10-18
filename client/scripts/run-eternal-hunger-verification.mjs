import { spawn } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, readdirSync, writeFileSync, createWriteStream } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

// Keep terminal output and the real exit code together across interrupted tool
// observations. A stale "running" result is NOT evidence of a live process.
const commands = {
  full: 'npm run check:eternal-hunger',
  unit: 'node scripts/check-character-status-skills.mjs',
  build: 'npm run build',
  'runtime-build': 'npm run check:runtime:full',
  execution: 'npm run check:growth-scheduling:match',
  'phase-worker-release': 'npm run check:auth-session && npm run postbuild && npm run check:simulation-replay && npm run check:runtime:sweep',
  'module-resolution-compat': 'node scripts/check-simulation-module-resolution.mjs && node scripts/check-phase-worker-build-entry.mjs',
  'custom-shared-growth-match': 'npm run check:custom-shared-growth:match',
  'custom-growth-expanded-match': 'npm run check:custom-shared-growth:match -- --expanded && npm run check:verification-fingerprint',
  'custom-growth-unit': 'node scripts/generate-simulation-version.mjs && node scripts/check-growth-plan.mjs && node scripts/check-growth-capacity.mjs && npm run check:deep-custom-recipes && node scripts/check-team-tactics.mjs && node scripts/check-team-regroup.mjs && node scripts/check-team-resource-goals.mjs && node scripts/check-team-purchase-goals.mjs && node scripts/check-match-distribution-metrics.mjs && npm run check:verification-fingerprint',
  'authored-opening-match': 'node scripts/generate-simulation-version.mjs && node scripts/check-growth-fulfillment-match.mjs && npm run check:custom-shared-growth:match && npm run check:verification-fingerprint',
  'authored-opening-unit': 'node scripts/generate-simulation-version.mjs && npm run check:authored-goal-material-reservation && node scripts/check-growth-plan.mjs && node scripts/check-growth-progress-inventory.mjs && node scripts/check-growth-observation.mjs && node scripts/check-custom-crafting.mjs && node scripts/check-growth-capacity.mjs && node scripts/check-growth-plan-shared-inventory-index.mjs && node scripts/check-growth-recipe-work-cache.mjs && node scripts/check-detonation-rules.mjs && node scripts/check-simulation-phase-worker-input.mjs && node scripts/check-boss-loot-sharing.mjs && node scripts/check-phase-runtime-performance.mjs && npm run check:late-growth && npm run check:team-tactics && npm run check:verification-fingerprint && npm run check:runtime:sweep',
  distribution: 'npm run diagnose:match-distribution -- --compare-observer=4402 4401 4402 4403 4404 4405 4406 4407 4408 4409 4410',
  'distribution-varied': 'npm run diagnose:match-distribution -- --rosters=BASELINE:roster-A,BASELINE:roster-B,BASELINE:roster-C 5501 5502',
  'distribution-unit': 'npm run check:team-regroup && npm run check:verification-fingerprint',
  'retreat-diagnostics-unit': 'npm run check:match-distribution-metrics && npm run check:verification-fingerprint',
  'tactical-effect-unit': 'node scripts/generate-simulation-version.mjs && node scripts/check-tactical-effect-evidence.mjs && npm run check:team-combat && npm run check:run-comparison && npm run check:team-observer && npm run check:verification-fingerprint && npm run check:runtime:sweep',
  'tactical-receipt-unit': 'node scripts/check-tactical-effect-evidence.mjs && npm run check:verification-fingerprint',
  'tactical-storage-unit': 'node scripts/check-tactical-effect-evidence.mjs && node scripts/check-combat-observation.mjs && node scripts/check-growth-observation.mjs && node scripts/check-custom-consumables.mjs && node scripts/check-custom-crafting.mjs && node scripts/check-equipment-account-recording.mjs && npm run check:verification-fingerprint',
  'strategy-comparison-unit': 'node scripts/check-strategy-comparison-contracts.mjs && npm run check:verification-fingerprint',
  'team-survival': 'npm run check:team-survival && npm run check:verification-fingerprint',
  'guest-equipment-unit': 'node scripts/generate-simulation-version.mjs && npm run check:guest-equipment-goals && node scripts/check-guest-item-catalog.mjs && node scripts/check-custom-roster.mjs && node scripts/check-initial-weapon-goals.mjs && npm run check:verification-fingerprint && npm run check:runtime:sweep',
  'guest-equipment-match': 'node scripts/generate-simulation-version.mjs && node scripts/check-guest-equipment-goals.mjs --match && node scripts/check-guest-character-profiles.mjs && npm run check:verification-fingerprint',
  'combat-path-observation': 'node scripts/generate-simulation-version.mjs && node scripts/check-combat-participation-observation.mjs',
  'late-combat-join': 'node scripts/check-late-combat-join.mjs',
  'recovery-combat-resume': 'node scripts/check-recovery-combat-resume.mjs',
  'combat-contact-prefix': 'node scripts/diagnose-combat-contact-prefix.mjs',
  'initial-weapon-goal-unit': 'npm run check:er-weapons && npm run check:recipe-only-gear && npm run check:growth-plan && npm run check:character-auto-setup && npm run check:team-observer && npm run check:verification-fingerprint && npm run check:runtime:sweep',
  'initial-weapon-goal-match': 'node scripts/check-initial-weapon-goals-match.mjs && npm run check:opening-deadline:match && npm run check:growth-scheduling:match',
  'world-step-contact-unit': 'node scripts/check-world-step-contact-diagnostics.mjs && node scripts/check-combat-participation-observation.mjs && node scripts/check-team-combat-participation-diagnostics.mjs && npm run check:verification-fingerprint && npm run check:runtime:sweep',
  'recovery-combat-unit': 'node scripts/generate-simulation-version.mjs && node scripts/check-recovery-combat-resume.mjs && node scripts/check-ai-recovery-forced-control.mjs && node scripts/check-forced-control.mjs && node scripts/check-status-protection.mjs && node scripts/check-action-states.mjs && node scripts/check-combat-spatial.mjs && node scripts/check-combat-timing.mjs && node scripts/check-character-casting.mjs && node scripts/check-team-combat.mjs && node scripts/check-late-combat-join.mjs && node scripts/check-combat-participation-observation.mjs && node scripts/check-team-combat-participation-diagnostics.mjs && node scripts/check-team-observer.mjs && node scripts/check-hunt-pvp-interruption.mjs && node scripts/check-hunt-pvp-handoff.mjs && npm run check:verification-fingerprint && npm run check:runtime:sweep',
  'team-participation-unit': 'node scripts/generate-simulation-version.mjs && node scripts/check-combat-participation-observation.mjs && node scripts/check-team-combat-participation-diagnostics.mjs && node scripts/check-late-combat-join.mjs && node scripts/check-team-survival-contribution.mjs && node scripts/check-combat-timing.mjs && node scripts/check-team-combat.mjs && node scripts/check-character-casting.mjs && node scripts/check-forced-control.mjs && node scripts/check-ai-recovery-forced-control.mjs && node scripts/check-action-states.mjs && node scripts/check-combat-spatial.mjs && node scripts/check-character-status-skills.mjs && node scripts/check-equipment-account-recording.mjs && node scripts/check-equipment-effect-combat.mjs && node scripts/check-guest-character-profiles.mjs && node scripts/check-status-protection.mjs && node scripts/check-wildlife-combat.mjs && node scripts/check-team-observer.mjs && npm run check:verification-fingerprint && npm run check:runtime:sweep',
  'hunt-pvp-interruption': 'node scripts/check-hunt-pvp-interruption.mjs',
  'hunt-pvp-unit': 'node scripts/generate-simulation-version.mjs && node scripts/check-hunt-pvp-interruption.mjs && node scripts/check-hunt-pvp-handoff.mjs && node scripts/check-wildlife-combat.mjs && node scripts/check-boss-team-combat.mjs && node scripts/check-boss-loot-sharing.mjs && node scripts/check-combat-timing.mjs && node scripts/check-character-casting.mjs && npm run check:verification-fingerprint && npm run check:runtime:sweep',
  'ai-recovery-forced': 'node scripts/check-ai-recovery-forced-control.mjs',
  'ai-recovery-forced-unit': 'node scripts/generate-simulation-version.mjs && node scripts/check-ai-recovery-forced-control.mjs && node scripts/check-forced-control.mjs && node scripts/check-status-protection.mjs && node scripts/check-action-states.mjs && node scripts/check-combat-spatial.mjs && node scripts/check-combat-timing.mjs && npm run check:team-combat && node scripts/check-character-casting.mjs && npm run check:verification-fingerprint && npm run check:runtime:sweep',
  'strategy-paired': 'npm run analyze:strategy-comparison -- --seeds=1101 --variants=baseline,one-tactical-skill --repeats=2',
  'formation-paired': 'npm run analyze:strategy-comparison -- --seeds=1101 --variants=baseline,one-formation-swap --repeats=2',
  'distribution-observer': 'npm run diagnose:match-distribution -- --compare-observer 4402',
  'movement-trace': 'npm run check:movement-reversal-trace && npm run diagnose:match-distribution -- --trace-movement --compare-observer 4407',
  'growth-planning-prefix': 'node scripts/diagnose-team-growth-planning.mjs',
  'preset-editor-unit': 'npm run check:skills && npm run check:er-weapons && node scripts/check-guest-character-profiles.mjs && node scripts/check-custom-roster.mjs && npm run check:verification-fingerprint && node node_modules/eslint/bin/eslint.js src/app/characters/page.js src/app/characters/_lib/characterEditorRuntime.js && npm run check:runtime:sweep',
  'phase-performance-unit': 'npm run check:phase-runtime-performance && node scripts/check-late-growth-decision-index.mjs && npm run check:verification-fingerprint && npm run check:runtime:sweep',
  'observer-evidence-unit': 'node scripts/generate-simulation-version.mjs && npm run check:observer-performance-guards && npm run check:observer-performance-probe && npm run check:lumia-minimap && node scripts/check-simulation-cooperative-yield.mjs && npm run check:verification-fingerprint && npm run check:runtime:sweep',
  'safe-route-unit': 'node scripts/generate-simulation-version.mjs && npm run check:team-tactics && npm run check:phase-runtime-performance && npm run check:verification-fingerprint && npm run check:runtime:sweep',
  'safe-route-match': 'npm run check:safe-route-facts && npm run check:verification-fingerprint',
  'kiosk-quote-unit': 'node scripts/generate-simulation-version.mjs && npm run check:procurement && npm run check:team-purchase-goals && node scripts/check-kiosk-movement-quote-cache.mjs --fixtures-only && npm run check:verification-fingerprint && npm run check:runtime:sweep',
  'kiosk-quote-match': 'npm run check:kiosk-movement-quote-cache && npm run check:verification-fingerprint',
  'move-power-sort': 'node scripts/check-planning-power-snapshot.mjs && npm run check:move-power-sort:match && npm run check:team-tactics && npm run check:live-frames && npm run check:verification-fingerprint && npm run check:runtime:sweep',
  'frame-transport': 'node scripts/check-simulation-cooperative-yield.mjs && node scripts/check-simulation-phase-worker-client.mjs && node scripts/check-simulation-phase-worker-input.mjs && node scripts/check-simulation-phase-executor-hook.mjs && npm run check:simulation-phase-worker:finite-transport && npm run check:verification-fingerprint && npm run check:runtime:sweep',
  'natural-procurement-unit': 'node scripts/check-natural-procurement-evidence.mjs && npm run check:verification-fingerprint',
  'natural-procurement': 'npm run check:natural-procurement-matrix -- --seeds=1101 --rosters=FIXTURE:initial-roster',
  'procurement-purpose-unit': 'node scripts/generate-simulation-version.mjs && npm run check:observer-purchase-scenario && npm run check:procurement && npm run check:team-observer && npm run check:verification-fingerprint && npm run check:runtime:sweep',
  'procurement-purpose-match': 'node scripts/generate-simulation-version.mjs && node scripts/check-procurement-purpose-match.mjs',
  'status-tick-unit': 'npm run check:status-tick-normalization && node scripts/check-detonation-rules.mjs && node scripts/check-live-frames.mjs && npm run check:verification-fingerprint && npm run check:runtime:sweep',
  'status-tick-match': 'npm run check:status-tick-normalization:match',
  'growth-focus-unit': 'npm run check:growth-plan && npm run check:team-tactics && npm run check:verification-fingerprint && npm run check:runtime:sweep',
  handoff: 'node scripts/check-boss-handoff-match.mjs --lifecycle-regression',
  'handoff-unit': 'node scripts/check-hunt-settlement.mjs && node scripts/check-wildlife-combat.mjs && node scripts/check-boss-team-combat.mjs && node scripts/check-boss-loot-sharing.mjs && node scripts/check-team-observer.mjs && node scripts/check-observer-tail-projection.mjs && node scripts/check-live-frames.mjs && node scripts/check-run-comparison.mjs && node scripts/check-character-casting.mjs && npm run check:verification-fingerprint && npm run check:runtime:sweep',
  growth: 'npm run check:growth-plan && npm run check:opening-deadline:match && npm run check:team-purchase-goals && npm run check:procurement && npm run check:character-auto-setup && npm run check:growth-scheduling:match && npm run check:simulation-replay && npm run check:runtime:sweep && npm run build',
  performance: 'npm run check:growth-plan && npm run check:team-observer && npm run check:live-frames && npm run check:display-pacing && npm run check:phase-runtime-performance && npm run check:opening-deadline:match && npm run check:team-purchase-goals && npm run check:procurement && npm run check:growth-scheduling:match && npm run check:simulation-replay && npm run check:runtime:sweep && npm run build',
};
const mode = process.argv[2] || 'full';
if (!Object.hasOwn(commands, mode)) throw Error(`Use one of: ${Object.keys(commands).join(', ')}.`);
// Resume only missing input-axis cases without rerunning completed matches.
// These comma-separated identifiers are deliberately shell-safe, not raw CLI.
if (mode === 'distribution-varied' && process.argv.length > 3) {
  const [rosters, seeds] = process.argv.slice(3);
  const identifiers = /^[A-Za-z0-9_:][A-Za-z0-9_:-]*(?:,[A-Za-z0-9_:][A-Za-z0-9_:-]*)*$/;
  if (process.argv.length !== 5 || !identifiers.test(rosters) || !identifiers.test(seeds)
    || rosters.trim() !== rosters || seeds.trim() !== seeds) {
    throw Error('Use distribution-varied <comma-separated roster seeds> <comma-separated match seeds>; identifiers allow letters, digits, underscore, colon and hyphen only.');
  }
  commands[mode] = `npm run diagnose:match-distribution -- --rosters=${rosters} ${seeds.split(',').join(' ')}`;
}
if (['strategy-paired', 'formation-paired'].includes(mode) && process.argv.length > 3) {
  const seedList = process.argv[3];
  if (process.argv.length !== 4 || !/^\d+(?:,\d+)*$/.test(seedList)
    || new Set(seedList.split(',')).size !== seedList.split(',').length) {
    throw Error('Use strategy-paired or formation-paired <comma-separated numeric seeds>.');
  }
  commands[mode] = commands[mode].replace('--seeds=1101', `--seeds=${seedList}`);
}
const root = fileURLToPath(new URL('../', import.meta.url));
const runId = `${new Date().toISOString().replaceAll(':', '-')}-${randomUUID()}`;
const directory = join(root, '.verification-runs', runId);
mkdirSync(directory, { recursive: true });
// runId contains only timestamp/UUID characters, so this relative argument is
// shell-safe without quotes. Windows npm otherwise forwards the quotes literally.
if (['strategy-paired', 'formation-paired'].includes(mode)) commands[mode] += ` --output=.verification-runs/${runId}/strategy-comparison.json`;
if (mode === 'combat-contact-prefix') commands[mode] += ` --output=.verification-runs/${runId}/combat-contact-prefix.json`;
const log = createWriteStream(join(directory, 'output.log'), { flags: 'wx' });
const resultPath = join(directory, 'result.json');
function fingerprint() {
  const paths = ['src/app/simulation/tacticalSkillTable.js', '../shared/marketItemPolicy.cjs'];
  for (const dir of ['src/app/simulation/_lib', 'src/utils']) {
    for (const file of readdirSync(join(root, dir))) if (file.endsWith('.js')) paths.push(`${dir}/${file}`);
  }
  const hash = createHash('sha256');
  for (const path of paths.sort()) hash.update(path).update('\0').update(readFileSync(join(root, path), 'utf8').replaceAll('\r\n', '\n')).update('\0');
  return hash.digest('hex');
}
function verificationSourceHashes() {
  const paths = ['scripts/run-eternal-hunger-verification.mjs', 'package.json',
    'scripts/lib/register-simulation-modules.mjs', 'scripts/lib/simulation-module-resolution.mjs'];
  if (['observer-evidence-unit', 'build', 'runtime-build', 'performance', 'full'].includes(mode)) paths.push(
    'scripts/generate-simulation-version.mjs', 'scripts/check-verification-fingerprint.mjs',
    'scripts/check-observer-performance-guards.mjs', 'scripts/check-observer-performance-probe.mjs',
    'scripts/check-observer-wait-measurement.mjs', 'scripts/check-observer-performance-report.mjs',
    'scripts/lib/observer-performance-report.mjs', 'scripts/analyze-observer-performance.mjs',
    'scripts/check-replay-history-lifetime.mjs', 'scripts/lib/hook-handler-harness.mjs',
    'scripts/check-lumia-minimap-geometry.mjs', 'scripts/check-minimap-team-presentation.mjs',
    'scripts/check-lumia-reference-map.mjs', 'scripts/check-minimap-interaction.mjs',
    'scripts/check-observer-layout.mjs', 'scripts/check-simulation-cooperative-yield.mjs',
    'src/app/simulation/_components/SimulationMinimapCanvas.js',
    'src/app/simulation/_components/SimulationMinimapPanel.js',
    'src/app/simulation/_components/SimulationMinimapHyperloopControl.js',
    'src/app/games/_components/GameActionIcon.js',
    'src/app/simulation/_components/SimulationControlPanel.js',
    'src/app/simulation/_components/SimulationMarketSeedCard.js',
    'src/app/simulation/_components/SimulationSurvivorBoard.js',
    'src/app/simulation/_components/SimulationObserverPerformancePanel.js',
    'src/app/simulation/_components/SimulationMainStage.js',
    'src/app/simulation/_components/SimulationGameScreen.js',
    'src/app/simulation/_components/SimulationScreenHeader.js',
    'src/app/simulation/_components/SimulationForbiddenStatusBar.js',
    'src/app/simulation/_components/SimulationEventFeedbackBar.js',
    'src/app/simulation/_components/SimulationWorldSpawnToolbar.js',
    'src/app/simulation/_components/SimulationPageView.js',
    'src/app/simulation/_components/SimulationReplayHistory.js',
    'src/app/simulation/_components/useObserverMemoryLifetime.js',
    'src/app/simulation/_components/simulationReplayHistoryLifetime.js',
    'src/app/simulation/_components/observerMemoryLifetime.js',
    'src/styles/ERSimulation.css', 'eslint.runtime.config.mjs');
  if (['authored-opening-unit', 'growth', 'performance', 'growth-focus-unit',
    'initial-weapon-goal-unit', 'full'].includes(mode)) paths.push('scripts/check-authored-goal-material-reservation.mjs');
  if (['guest-equipment-unit', 'guest-equipment-match', 'build', 'runtime-build', 'full'].includes(mode)) paths.push(
    'scripts/generate-simulation-version.mjs', 'scripts/check-verification-fingerprint.mjs',
    'scripts/check-guest-equipment-goals.mjs', 'scripts/check-guest-equipment-goals-ui.mjs',
    'scripts/lib/hook-handler-harness.mjs',
    'src/app/simulation/_components/SimulationGuestEquipmentGoals.js',
    'src/app/simulation/_components/SimulationLocalCharacterEditor.js',
    'src/app/simulation/_components/SimulationPregameRosterSetup.js',
    'src/app/simulation/_components/SimulationMainStage.js', 'src/styles/ERSimulation.css');
  if (mode === 'guest-equipment-unit') paths.push('scripts/check-guest-item-catalog.mjs',
    'scripts/check-custom-roster.mjs', 'scripts/check-initial-weapon-goals.mjs', 'eslint.runtime.config.mjs');
  if (mode === 'guest-equipment-match') paths.push('scripts/check-guest-character-profiles.mjs',
    'scripts/lib/run-combat-scenario.mjs', 'scripts/lib/run-random-isolation-match.mjs');
  if (['custom-growth-expanded-match', 'custom-growth-unit', 'custom-shared-growth-match',
    'authored-opening-match', 'full'].includes(mode)) paths.push(
    'scripts/generate-simulation-version.mjs', 'scripts/check-verification-fingerprint.mjs',
    'scripts/lib/run-random-isolation-match.mjs', 'scripts/lib/match-distribution-frame-tracker.mjs');
  if (mode === 'custom-growth-expanded-match') paths.push('scripts/check-custom-shared-growth-match.mjs');
  if (mode === 'custom-growth-unit') paths.push('scripts/check-growth-plan.mjs',
    'scripts/check-growth-capacity.mjs', 'scripts/check-deep-custom-recipe-routes.mjs',
    'scripts/check-deep-custom-recipe-growth.mjs', 'scripts/check-team-tactics.mjs',
    'scripts/check-team-regroup.mjs', 'scripts/check-team-resource-goals.mjs',
    'scripts/check-team-purchase-goals.mjs', 'scripts/lib/team-purchase-fixture.mjs',
    'scripts/check-match-distribution-metrics.mjs', 'scripts/lib/match-distribution-diagnostics.mjs',
    'scripts/lib/movement-reversal-trace.mjs');
  if (['kiosk-quote-unit', 'kiosk-quote-match', 'full'].includes(mode)) paths.push(
    'scripts/generate-simulation-version.mjs', 'scripts/check-kiosk-movement-quote-cache.mjs',
    'scripts/lib/run-random-isolation-match.mjs', 'scripts/check-verification-fingerprint.mjs',
    'scripts/lib/team-purchase-fixture.mjs');
  if (mode === 'kiosk-quote-unit') paths.push('scripts/check-procurement-transactions.mjs',
    'scripts/check-kiosk-catalog-contract.mjs', 'scripts/check-market-item-policy.mjs',
    'scripts/check-team-purchase-goals.mjs', 'scripts/check-default-kiosk-goals.mjs',
    'scripts/check-kiosk-material-identity.mjs', 'scripts/check-kiosk-exchange-inputs.mjs',
    'scripts/check-kiosk-goal-exchanges.mjs', 'eslint.runtime.config.mjs');
  if (['safe-route-unit', 'safe-route-match'].includes(mode)) paths.push(
    'scripts/generate-simulation-version.mjs', 'scripts/check-safe-route-facts.mjs',
    'scripts/lib/run-random-isolation-match.mjs', 'scripts/check-verification-fingerprint.mjs');
  if (mode === 'safe-route-unit') paths.push('scripts/check-team-tactics.mjs',
    'scripts/lib/team-purchase-fixture.mjs',
    'scripts/check-combat-decision-evidence.mjs', 'scripts/check-team-regroup.mjs',
    'scripts/check-team-regroup-lumia.mjs', 'scripts/check-team-isolation-tracker.mjs',
    'scripts/check-isolation-fixture.mjs', 'scripts/check-match-distribution-metrics.mjs',
    'scripts/check-team-retreat-diagnostics.mjs', 'scripts/check-movement-reversal-trace.mjs',
    'scripts/lib/match-distribution-diagnostics.mjs', 'scripts/lib/movement-reversal-trace.mjs',
    'scripts/check-team-resource-goals.mjs', 'scripts/check-team-purchase-goals.mjs',
    'scripts/check-default-kiosk-goals.mjs', 'scripts/check-kiosk-material-identity.mjs',
    'scripts/check-kiosk-exchange-inputs.mjs', 'scripts/check-kiosk-goal-exchanges.mjs',
    'scripts/check-team-boss-goals.mjs', 'scripts/check-phase-runtime-performance.mjs',
    'scripts/check-status-tick-normalization.mjs', 'scripts/check-planning-power-snapshot.mjs',
    'scripts/check-planning-roster-facts.mjs', 'scripts/check-region-loot-matching.mjs',
    'scripts/check-simulation-cooperative-yield.mjs', 'scripts/check-growth-scheduling.mjs',
    'scripts/check-high-speed-growth-yield.mjs', 'scripts/check-team-coordination-scheduling.mjs',
    'eslint.runtime.config.mjs');
  if (mode === 'authored-opening-match') paths.push('scripts/generate-simulation-version.mjs',
    'scripts/check-growth-fulfillment-match.mjs', 'scripts/check-custom-shared-growth-match.mjs',
    'scripts/lib/run-random-isolation-match.mjs', 'scripts/check-verification-fingerprint.mjs');
  if (mode === 'authored-opening-unit') paths.push('scripts/generate-simulation-version.mjs',
    'scripts/check-growth-plan.mjs', 'scripts/check-growth-progress-inventory.mjs', 'scripts/check-growth-observation.mjs',
    'scripts/check-custom-crafting.mjs', 'scripts/check-growth-capacity.mjs', 'scripts/check-growth-plan-shared-inventory-index.mjs',
    'scripts/check-growth-recipe-work-cache.mjs', 'scripts/check-detonation-rules.mjs',
    'scripts/check-boss-loot-sharing.mjs', 'scripts/check-phase-runtime-performance.mjs',
    'scripts/check-prepared-late-growth-catalog.mjs', 'scripts/check-late-growth-goals.mjs',
    'scripts/check-late-growth-focus.mjs', 'scripts/check-late-growth-decision-index.mjs',
    'scripts/check-team-tactics.mjs', 'scripts/check-combat-decision-evidence.mjs',
    'scripts/check-team-regroup.mjs', 'scripts/check-team-resource-goals.mjs',
    'scripts/check-team-purchase-goals.mjs', 'scripts/check-team-boss-goals.mjs',
    'scripts/check-simulation-phase-worker-input.mjs',
    'scripts/check-verification-fingerprint.mjs', 'eslint.runtime.config.mjs');
  if (mode === 'move-power-sort') paths.push('scripts/check-planning-power-snapshot.mjs',
    'scripts/check-move-power-sort-match.mjs', 'scripts/lib/run-random-isolation-match.mjs',
    'scripts/check-team-tactics.mjs', 'scripts/check-live-frames.mjs',
    'scripts/check-verification-fingerprint.mjs', 'eslint.runtime.config.mjs');
  if (mode === 'frame-transport') paths.push('scripts/check-simulation-cooperative-yield.mjs',
    'scripts/check-simulation-phase-worker-client.mjs', 'scripts/check-simulation-phase-worker-input.mjs',
    'scripts/check-simulation-phase-executor-hook.mjs', 'scripts/check-simulation-phase-worker-match.mjs',
    'scripts/lib/simulation-phase-worker-host.mjs', 'scripts/lib/hook-handler-harness.mjs',
    'scripts/lib/run-random-isolation-match.mjs', 'scripts/check-verification-fingerprint.mjs', 'eslint.runtime.config.mjs');
  if (['build', 'runtime-build', 'full', 'phase-worker-release', 'module-resolution-compat'].includes(mode)) paths.push(
    'scripts/check-phase-worker-build-entry.mjs', 'scripts/check-simulation-module-resolution.mjs');
  if (['phase-worker-release', 'full'].includes(mode)) paths.push('scripts/check-auth-session.mjs', 'scripts/check-proxy-session-contract.mjs');
  if (['custom-shared-growth-match', 'full'].includes(mode)) paths.push('scripts/check-custom-shared-growth-match.mjs',
    'scripts/lib/register-simulation-modules.mjs', 'scripts/lib/run-random-isolation-match.mjs');
  if (['phase-worker-release', 'full', 'performance', 'growth'].includes(mode)) paths.push(
    'scripts/check-simulation-phase-worker-input.mjs', 'scripts/check-simulation-phase-worker-client.mjs',
    'scripts/check-simulation-phase-executor-hook.mjs', 'scripts/check-simulation-phase-worker-match.mjs',
    'scripts/check-phase-result-readiness.mjs',
    'scripts/lib/simulation-phase-worker-host.mjs', 'scripts/lib/hook-handler-harness.mjs',
    'scripts/lib/register-simulation-modules.mjs', 'scripts/lib/run-random-isolation-match.mjs',
    'scripts/check-simulation-replay.mjs', 'scripts/check-replay-comparison-performance.mjs',
    'scripts/generate-simulation-version.mjs', 'eslint.runtime.config.mjs');
  if (['growth', 'performance', 'growth-focus-unit', 'initial-weapon-goal-unit', 'full'].includes(mode)) paths.push(
    'scripts/check-growth-progress-inventory.mjs', 'scripts/check-growth-fulfillment-match.mjs',
    'scripts/lib/run-random-isolation-match.mjs', 'scripts/lib/register-simulation-modules.mjs');
  if (['strategy-comparison-unit', 'full'].includes(mode)) paths.push(
    'scripts/check-strategy-comparison-contracts.mjs', 'scripts/lib/strategy-comparison-contracts.mjs',
    'scripts/lib/register-simulation-modules.mjs', 'scripts/check-verification-fingerprint.mjs');
  if (['initial-weapon-goal-unit', 'full'].includes(mode)) paths.push(
    'scripts/check-er-weapons.mjs', 'scripts/check-initial-weapon-goals.mjs',
    'scripts/check-recipe-only-gear.mjs', 'scripts/check-hunt-settlement.mjs',
    'scripts/check-growth-plan.mjs', 'scripts/check-character-auto-setup.mjs',
    'scripts/check-team-observer.mjs');
  if (['initial-weapon-goal-match', 'full'].includes(mode)) paths.push(
    'scripts/check-initial-weapon-goals-match.mjs', 'scripts/check-opening-deadline-match.mjs', 'scripts/check-growth-scheduling-match.mjs',
    'scripts/lib/run-random-isolation-match.mjs', 'scripts/lib/register-simulation-modules.mjs');
  if (['tactical-effect-unit', 'tactical-receipt-unit', 'tactical-storage-unit'].includes(mode)) {
    // The server sanitizer is outside the client engine fingerprint. Capture it
    // together with the actual fresh-receipt test so source drift cannot pass.
    paths.push('scripts/check-tactical-effect-evidence.mjs', '../server/routes/game.js');
  }
  if (mode === 'tactical-storage-unit') paths.push('scripts/check-combat-observation.mjs', 'scripts/check-growth-observation.mjs',
    'scripts/check-custom-consumables.mjs', 'scripts/check-custom-crafting.mjs', 'scripts/check-equipment-account-recording.mjs');
  if (['team-participation-unit', 'formation-paired', 'strategy-paired'].includes(mode)) paths.push(
    'scripts/analyze-strategy-comparison.mjs', 'scripts/lib/run-random-isolation-match.mjs',
    'scripts/lib/strategy-comparison-contracts.mjs', 'scripts/lib/team-combat-participation-diagnostics.mjs',
    'scripts/check-team-combat-participation-diagnostics.mjs');
  if (mode === 'team-participation-unit') paths.push('scripts/check-combat-participation-observation.mjs',
    'scripts/check-combat-timing.mjs', 'scripts/check-team-combat.mjs', 'scripts/check-team-observer.mjs',
    'scripts/check-character-casting.mjs', 'scripts/check-forced-control.mjs', 'scripts/check-ai-recovery-forced-control.mjs',
    'scripts/check-late-combat-join.mjs', 'scripts/check-action-states.mjs', 'scripts/check-combat-spatial.mjs',
    'scripts/check-character-status-skills.mjs', 'scripts/check-equipment-account-recording.mjs',
    'scripts/check-equipment-effect-combat.mjs', 'scripts/check-guest-character-profiles.mjs',
    'scripts/check-status-protection.mjs', 'scripts/check-wildlife-combat.mjs');
  if (['team-survival', 'team-participation-unit', 'full'].includes(mode)) paths.push(
    'scripts/check-team-survival-contribution.mjs', 'scripts/lib/run-combat-scenario.mjs');
  if (['team-survival', 'full'].includes(mode)) paths.push('scripts/check-team-retreat-survival.mjs',
    'scripts/check-verification-fingerprint.mjs');
  if (mode === 'combat-path-observation') paths.push('scripts/check-combat-participation-observation.mjs',
    'scripts/lib/run-combat-scenario.mjs', 'scripts/lib/team-combat-participation-diagnostics.mjs');
  if (mode === 'late-combat-join') paths.push('scripts/check-late-combat-join.mjs', 'scripts/lib/run-combat-scenario.mjs');
  if (['recovery-combat-resume', 'recovery-combat-unit', 'full'].includes(mode)) paths.push(
    'scripts/check-recovery-combat-resume.mjs', 'scripts/lib/run-combat-scenario.mjs');
  if (mode === 'combat-contact-prefix') paths.push('scripts/diagnose-combat-contact-prefix.mjs',
    'scripts/lib/run-random-isolation-match.mjs', 'scripts/lib/strategy-comparison-contracts.mjs',
    'scripts/lib/world-step-contact-diagnostics.mjs');
  if (['world-step-contact-unit', 'full'].includes(mode)) paths.push('scripts/check-world-step-contact-diagnostics.mjs',
    'scripts/lib/world-step-contact-diagnostics.mjs', 'scripts/check-combat-participation-observation.mjs',
    'scripts/lib/run-combat-scenario.mjs', 'scripts/lib/team-combat-participation-diagnostics.mjs',
    'scripts/check-team-combat-participation-diagnostics.mjs');
  if (mode === 'recovery-combat-unit') paths.push('scripts/check-ai-recovery-forced-control.mjs',
    'scripts/check-forced-control.mjs', 'scripts/check-status-protection.mjs', 'scripts/check-action-states.mjs',
    'scripts/check-combat-spatial.mjs', 'scripts/check-combat-timing.mjs', 'scripts/check-character-casting.mjs',
    'scripts/check-team-combat.mjs', 'scripts/check-late-combat-join.mjs',
    'scripts/check-combat-participation-observation.mjs', 'scripts/check-team-combat-participation-diagnostics.mjs',
    'scripts/lib/team-combat-participation-diagnostics.mjs', 'scripts/check-team-observer.mjs',
    'scripts/check-hunt-pvp-interruption.mjs', 'scripts/check-hunt-pvp-handoff.mjs');
  if (mode === 'full') paths.push('scripts/check-combat-participation-observation.mjs',
    'scripts/check-team-combat-participation-diagnostics.mjs', 'scripts/lib/team-combat-participation-diagnostics.mjs',
    'scripts/check-late-combat-join.mjs');
  if (['hunt-pvp-interruption', 'hunt-pvp-unit'].includes(mode)) paths.push('scripts/check-hunt-pvp-interruption.mjs');
  if (mode === 'hunt-pvp-unit') paths.push('scripts/check-hunt-pvp-handoff.mjs',
    'scripts/check-wildlife-combat.mjs', 'scripts/check-boss-team-combat.mjs',
    'scripts/check-boss-loot-sharing.mjs', 'scripts/check-combat-timing.mjs', 'scripts/check-character-casting.mjs');
  if (['ai-recovery-forced', 'ai-recovery-forced-unit', 'full'].includes(mode)) paths.push(
    'scripts/check-ai-recovery-forced-control.mjs', 'scripts/lib/run-combat-scenario.mjs');
  if (mode === 'full') paths.push('scripts/check-combat-timing.mjs');
  if (mode === 'ai-recovery-forced-unit') paths.push('scripts/check-forced-control.mjs',
    'scripts/check-status-protection.mjs', 'scripts/check-action-states.mjs',
    'scripts/check-combat-spatial.mjs', 'scripts/check-combat-timing.mjs',
    'scripts/check-team-combat.mjs', 'scripts/check-character-casting.mjs',
    'scripts/check-combat-participation-observation.mjs', 'scripts/check-team-combat-participation-diagnostics.mjs',
    'scripts/check-hunt-pvp-interruption.mjs', 'scripts/check-hunt-pvp-handoff.mjs');
  return Object.fromEntries(paths.map((path) => [path,
    createHash('sha256').update(readFileSync(join(root, path), 'utf8').replaceAll('\r\n', '\n')).digest('hex')]));
}
const result = { runId, command: commands[mode], startedAt: new Date().toISOString(), pid: process.pid,
  engineBefore: fingerprint(), verificationSourcesBefore: verificationSourceHashes(),
  status: 'running', scope: 'Named command only; not balance, fun or overall-goal acceptance.' };
const persist = () => writeFileSync(resultPath, `${JSON.stringify(result, null, 2)}\n`);
persist(); console.log(`VERIFICATION_RESULT ${resultPath}`);
try {
  const outcome = await new Promise((resolve, reject) => {
    const child = process.platform === 'win32'
      ? spawn(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', commands[mode]], { cwd: root, windowsHide: true })
      : spawn('/bin/sh', ['-c', commands[mode]], { cwd: root });
    child.stdout.on('data', (chunk) => { log.write(chunk); process.stdout.write(chunk); });
    child.stderr.on('data', (chunk) => { log.write(chunk); process.stderr.write(chunk); });
    child.once('error', reject); child.once('close', (code, signal) => resolve({ code, signal }));
  });
  result.exitCode = outcome.code; result.signal = outcome.signal;
  result.engineAfter = fingerprint(); result.sameEngine = result.engineBefore === result.engineAfter;
  result.verificationSourcesAfter = verificationSourceHashes();
  result.sameVerificationSources = JSON.stringify(result.verificationSourcesBefore) === JSON.stringify(result.verificationSourcesAfter);
  result.status = outcome.code === 0 && result.sameEngine && result.sameVerificationSources ? 'passed' : 'failed';
  process.exitCode = result.status === 'passed' ? 0 : outcome.code || 1;
} catch (error) {
  result.status = 'failed'; result.error = String(error); process.exitCode = 1;
} finally {
  await new Promise((resolve, reject) => { log.once('error', reject); log.end(resolve); });
  result.finishedAt = new Date().toISOString(); persist();
  console.log(`VERIFICATION_COMPLETE ${JSON.stringify(result)}`);
}
