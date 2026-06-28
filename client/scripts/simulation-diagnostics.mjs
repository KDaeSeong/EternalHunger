import fs from 'node:fs';
import path from 'node:path';

const DEFAULT_SEEDS = [1101, 1102, 1103, 1104, 1105, 2101, 2102, 2103, 3101, 4101];

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function listJsonFiles(dir) {
  return fs.readdirSync(dir)
    .filter((name) => name.toLowerCase().endsWith('.json'))
    .map((name) => path.join(dir, name));
}

function cleanStr(value) {
  return String(value || '').trim();
}

function num(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function phaseBand(event) {
  const at = event?.at && typeof event.at === 'object' ? event.at : event;
  const day = Math.max(0, Math.floor(num(at?.day, 0)));
  const phase = cleanStr(at?.phase || at?.timeOfDay || '') === 'night' ? 'night' : 'morning';
  if (!day) return 'unknown';
  if (day === 1) return 'opening';
  if (day === 2 && phase === 'morning') return 'early';
  if (day < 6) return 'mid';
  return 'end';
}

function inc(obj, key, amount = 1) {
  const k = cleanStr(key) || 'unknown';
  obj[k] = num(obj[k], 0) + amount;
}

function analyzePayload(payload) {
  const runEvents = Array.isArray(payload?.runEvents) ? payload.runEvents : [];
  const out = {
    schema: payload?.schema || 'unknown',
    logCount: Array.isArray(payload?.logs) ? payload.logs.length : 0,
    runEventCount: runEvents.length,
    deaths: { total: 0, pvp: 0, nonPvp: 0, byBand: { opening: 0, early: 0, mid: 0, end: 0, unknown: 0 } },
    chase: { total: 0, caught: 0, escaped: 0, blinkEscape: 0 },
    objectives: {},
    gains: {},
  };

  for (const event of runEvents) {
    const kind = cleanStr(event?.kind || event?.type || '');
    if (kind === 'death') {
      out.deaths.total += 1;
      inc(out.deaths.byBand, phaseBand(event));
      if (cleanStr(event?.by)) out.deaths.pvp += 1;
      else out.deaths.nonPvp += 1;
    } else if (kind === 'chase') {
      out.chase.total += 1;
      if (event?.caught || event?.outcome === 'caught') out.chase.caught += 1;
      if (event?.escaped || cleanStr(event?.outcome).includes('escape')) out.chase.escaped += 1;
      if (event?.outcome === 'blink_escape') out.chase.blinkEscape += 1;
    } else if (kind === 'objective') {
      inc(out.objectives, event?.objective || event?.target || event?.subkind || 'unknown');
    } else if (kind === 'gain') {
      inc(out.gains, event?.source || 'unknown', Math.max(0, num(event?.qty, 0)));
    }
  }

  return out;
}

function printOne(file, summary) {
  console.log(`\n# ${file}`);
  console.log(`events=${summary.runEventCount} logs=${summary.logCount}`);
  console.log(`deaths=${summary.deaths.total} pvp=${summary.deaths.pvp} nonPvp=${summary.deaths.nonPvp}`);
  console.log(`deathBands=${JSON.stringify(summary.deaths.byBand)}`);
  console.log(`chase=${JSON.stringify(summary.chase)}`);
  console.log(`objectives=${JSON.stringify(summary.objectives)}`);
  console.log(`gains=${JSON.stringify(summary.gains)}`);
}

function parseArgs(argv) {
  const args = { files: [], dir: '' };
  for (let i = 0; i < argv.length; i += 1) {
    const cur = argv[i];
    if (cur === '--file' || cur === '-f') args.files.push(argv[++i]);
    else if (cur === '--dir' || cur === '-d') args.dir = argv[++i];
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));
let files = args.files.filter(Boolean);
if (args.dir) files = [...files, ...listJsonFiles(args.dir)];

if (!files.length) {
  console.log('No exported battle-log JSON was provided.');
  console.log(`Suggested fixed seeds: ${DEFAULT_SEEDS.join(', ')}`);
  console.log('Usage: npm run diagnose:simulation -- --file path/to/export.json');
  console.log('Usage: npm run diagnose:simulation -- --dir path/to/exports');
  process.exit(0);
}

for (const file of files) {
  const payload = readJson(file);
  printOne(file, analyzePayload(payload));
}

