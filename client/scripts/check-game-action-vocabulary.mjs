import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const clientRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const gamesRoot = path.join(clientRoot, 'src', 'app', 'games');

async function sourceAt(...segments) {
  return readFile(path.join(gamesRoot, ...segments), 'utf8');
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const iconSource = await sourceAt('_components', 'GameActionIcon.js');
const semanticSource = await sourceAt('_lib', 'gameActionSemantics.js');
const semanticModule = await import(
  `data:text/javascript;base64,${Buffer.from(semanticSource).toString('base64')}`
);

const vocabulary = [
  ['apply-lookahead', 'toggle', 'Radar'],
  ['collect-foreign', 'trade', 'CircleDollarSign'],
  ['collect-receivable', 'trade', 'BadgeDollarSign'],
  ['event-card', 'event', 'NotebookTabs'],
  ['focus-train', 'dispatch', 'TrainTrack'],
  ['hunt', 'combat', 'Binoculars'],
  ['library', 'archive', 'BookCopy'],
  ['pay-vat', 'trade', 'ReceiptText'],
  ['record', 'archive', 'BookOpenCheck'],
  ['restore-dry-run', 'load', 'FileClock'],
  ['run-5', 'advance', 'FastForward'],
  ['scribe', 'research', 'Feather'],
  ['settle-global', 'settle', 'Scale'],
  ['ship-order', 'order', 'FileOutput'],
  ['show-analysis', 'select', 'ScanSearch'],
  ['step', 'advance', 'StepForward'],
];

for (const [action, cue, icon] of vocabulary) {
  assert.deepEqual(
    semanticModule.inferGameActionSemantic(action),
    { kind: action, cue },
    `Action semantics must preserve ${action}.`,
  );
  const key = /^[A-Za-z][\w]*$/.test(action)
    ? `(?:${escapeRegExp(action)}|'${escapeRegExp(action)}')`
    : `'${escapeRegExp(action)}'`;
  assert.match(
    iconSource,
    new RegExp(`${key}\\s*:\\s*${escapeRegExp(icon)}\\b`),
    `Action icon must preserve ${action} as ${icon}.`,
  );
}

const companySource = await sourceAt('company-report', '_components', 'CompanyReportFeatureTabs.js');
assert.equal(
  (companySource.match(/action=\{item\.action \|\| 'execute'\}/g) || []).length,
  2,
  'Company operation rows and buttons must share their exact action vocabulary.',
);
assert.doesNotMatch(companySource, /OPERATION_ACTION_ICONS/);

const railSource = await sourceAt('rail3d-sim', '_components', 'Rail3dOperationsTab.js');
assert.equal(
  (railSource.match(/action=\{item\.action \|\| 'dispatch'\}/g) || []).length,
  2,
  'Rail dispatch rows and buttons must share their exact action vocabulary.',
);
assert.doesNotMatch(railSource, /DISPATCH_ACTION_ICONS/);

const racingSource = await sourceAt('racing-logos-demo', '_components', 'RacingLogosAuditTab.js');
assert.match(racingSource, /'event-card': 'event-card'/);

const primitiveSource = await sourceAt(
  'primitive-archive',
  '_components',
  'PrimitiveArchiveCampWorkspace.js',
);
assert.match(primitiveSource, /icon="scribe" label="필사대"/);
assert.match(primitiveSource, /icon="library" label="서가"/);

const vanguardSource = await sourceAt('ba-vanguard', '_components', 'BaVanguardDeckTab.js');
assert.match(vanguardSource, /action="library" title="카드 라이브러리"/);

assert.doesNotMatch(
  iconSource,
  /\b(?:UsersRound|Handshake|HeartHandshake|PersonStanding|UserRound)\b/,
  'Shared action vocabulary must remain object-only.',
);

console.log(JSON.stringify({
  checkedActions: vocabulary.length,
  integratedGames: 5,
  objectOnly: true,
}, null, 2));
