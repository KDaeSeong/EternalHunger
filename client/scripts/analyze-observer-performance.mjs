import { readFileSync, writeFileSync } from 'node:fs';
import { analyzeObserverPerformanceRuns } from './lib/observer-performance-report.mjs';

const args = process.argv.slice(2);
const option = name => args.find(arg => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
const numeric = name => option(name) == null ? undefined : Number(option(name));
const runs = [];
for (const path of args.filter(arg => !arg.startsWith('--'))) {
  const parsed = JSON.parse(readFileSync(path, 'utf8'));
  runs.push(...(Array.isArray(parsed) ? parsed : Array.isArray(parsed.runs) ? parsed.runs : [parsed]));
}
const result = analyzeObserverPerformanceRuns(runs, { expectedEngine: option('expected-engine'),
  maxLongTaskMs: numeric('max-long-task-ms'), maxRafP95Ms: numeric('max-raf-p95-ms'),
  maxRafGapMs: numeric('max-raf-gap-ms'), maxBaselineHeapGrowthBytes: numeric('max-baseline-heap-growth-bytes') });
const output = `${JSON.stringify(result, null, 2)}\n`;
if (option('output')) writeFileSync(option('output'), output);
else process.stdout.write(output);
process.exitCode = result.status === 'pass' ? 0 : result.status === 'fail' ? 1 : 2;
