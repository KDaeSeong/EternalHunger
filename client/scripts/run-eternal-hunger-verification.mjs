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
  distribution: 'npm run diagnose:match-distribution -- --compare-observer=4402 4401 4402 4403 4404 4405 4406 4407 4408 4409 4410',
  'distribution-varied': 'npm run diagnose:match-distribution -- --rosters=BASELINE:roster-A,BASELINE:roster-B,BASELINE:roster-C 5501 5502',
  'distribution-unit': 'npm run check:team-regroup && npm run check:verification-fingerprint',
  'distribution-observer': 'npm run diagnose:match-distribution -- --compare-observer 4402',
  'movement-trace': 'npm run check:movement-reversal-trace && npm run diagnose:match-distribution -- --trace-movement --compare-observer 4407',
  'growth-planning-prefix': 'node scripts/diagnose-team-growth-planning.mjs',
  'growth-focus-unit': 'npm run check:growth-plan && npm run check:team-tactics && npm run check:verification-fingerprint && npm run check:runtime:sweep',
  handoff: 'node scripts/check-boss-handoff-match.mjs --lifecycle-regression',
  'handoff-unit': 'node scripts/check-hunt-settlement.mjs && node scripts/check-wildlife-combat.mjs && node scripts/check-boss-team-combat.mjs && node scripts/check-boss-loot-sharing.mjs && node scripts/check-team-observer.mjs && node scripts/check-observer-tail-projection.mjs && node scripts/check-live-frames.mjs && node scripts/check-run-comparison.mjs && node scripts/check-character-casting.mjs && npm run check:verification-fingerprint && npm run check:runtime:sweep',
  growth: 'npm run check:growth-plan && npm run check:opening-deadline:match && npm run check:team-purchase-goals && npm run check:procurement && npm run check:character-auto-setup && npm run check:growth-scheduling:match && npm run check:simulation-replay && npm run check:runtime:sweep && npm run build',
  performance: 'npm run check:growth-plan && npm run check:team-observer && npm run check:live-frames && npm run check:display-pacing && npm run check:phase-runtime-performance && npm run check:opening-deadline:match && npm run check:team-purchase-goals && npm run check:procurement && npm run check:growth-scheduling:match && npm run check:simulation-replay && npm run check:runtime:sweep && npm run build',
};
const mode = process.argv[2] || 'full';
if (!Object.hasOwn(commands, mode)) throw Error('Use full, unit, growth, growth-focus-unit, performance, execution, distribution, distribution-varied, distribution-unit, distribution-observer, movement-trace, growth-planning-prefix, handoff, handoff-unit, build or runtime-build.');
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
const root = fileURLToPath(new URL('../', import.meta.url));
const runId = `${new Date().toISOString().replaceAll(':', '-')}-${randomUUID()}`;
const directory = join(root, '.verification-runs', runId);
mkdirSync(directory, { recursive: true });
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
const result = { runId, command: commands[mode], startedAt: new Date().toISOString(), pid: process.pid,
  engineBefore: fingerprint(), status: 'running', scope: 'Named command only; not balance, fun or overall-goal acceptance.' };
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
  result.status = outcome.code === 0 && result.sameEngine ? 'passed' : 'failed';
  process.exitCode = result.status === 'passed' ? 0 : outcome.code || 1;
} catch (error) {
  result.status = 'failed'; result.error = String(error); process.exitCode = 1;
} finally {
  await new Promise((resolve, reject) => { log.once('error', reject); log.end(resolve); });
  result.finishedAt = new Date().toISOString(); persist();
  console.log(`VERIFICATION_COMPLETE ${JSON.stringify(result)}`);
}
