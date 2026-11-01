import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import './lib/register-simulation-modules.mjs';
const { STUDENTS } = await import('../src/app/games/primitive-archive/_lib/primitiveArchiveData.js');
const { createNewState } = await import('../src/app/games/primitive-archive/_lib/primitiveArchiveEngine.js');
const { ARCHIVE_OFFICIAL_PORTRAITS, resolveArchivePortrait } = await import('../src/app/games/primitive-archive/_lib/primitiveArchivePortraits.js');

const folder = new URL('../public/games/primitive-archive/portraits/official/', import.meta.url);
const manifest = JSON.parse(readFileSync(new URL('sources.json', folder), 'utf8'));
const ids = ['shiroko', 'hina', 'noa', 'hoshino', 'nonomi', 'ako', 'fuuka', 'yuuka'];
const variants = ['수영복', '드레스', '파자마', '무장', '수영복', '드레스', '새해', '파자마'];
assert.deepEqual(STUDENTS.map(member => member.id), ids);
assert.deepEqual(manifest.rows.map(row => row.id), ids);
assert.deepEqual(Object.keys(ARCHIVE_OFFICIAL_PORTRAITS), ids);
let checks = 0;
for (const row of manifest.rows) {
  const actor = STUDENTS.find(member => member.id === row.id);
  const portrait = resolveArchivePortrait(actor);
  assert.equal(actor.portrait, `/games/primitive-archive/portraits/official/${row.file}`);
  assert.equal(portrait.src, actor.portrait);
  assert.equal(row.variant, variants[ids.indexOf(row.id)]);
  assert.equal(portrait.variant, row.variant);
  assert.equal(portrait.label, `${actor.name}(${row.variant})`);
  assert.ok(/^[a-z]+-[a-z]+\.(png|jpg)$/.test(row.file));
  const bytes = readFileSync(new URL(row.file, folder));
  assert.equal(bytes.length, row.bytes);
  assert.equal(createHash('sha256').update(bytes).digest('hex'), row.sha256);
  const metadata = await sharp(bytes).metadata();
  assert.equal(metadata.width, row.width);
  assert.equal(metadata.height, row.height);
  assert.equal(metadata.format, row.format);
  assert.equal(portrait.width, metadata.width);
  assert.equal(portrait.height, metadata.height);
  assert.ok(portrait.crop.x > 0 && portrait.crop.x < 100);
  assert.ok(portrait.crop.y > 0 && portrait.crop.y < 100);
  assert.ok(portrait.crop.zoom >= 1 && portrait.crop.zoom <= 8);
  const source = new URL(row.sourceUrl);
  const publication = new URL(row.officialPublication);
  assert.equal(source.protocol, 'https:');
  if (row.artType === 'official-character-introduction-card') {
    if (source.hostname === 'pbs.twimg.com') {
      assert.equal(publication.hostname, 'x.com');
      assert.match(publication.pathname, /^\/Blue_ArchiveJP\/status\/\d+$/);
    } else {
      assert.equal(source.hostname, 'dszw1qtcnsa5e.cloudfront.net');
      assert.equal(publication.hostname, 'forum.nexon.com');
      assert.equal(publication.pathname, '/bluearchive/board_view');
      assert.match(publication.searchParams.get('thread'), /^\d+$/);
    }
  } else {
    assert.equal(source.hostname, 'lwi.nexon.com');
    assert.equal(publication.hostname, 'ssl.nexon.com');
    assert.equal(new URL(row.renderingSource).hostname, 'bluearchive.nexon.com');
  }
  checks += 1;
  console.log(`PASS current original asset, catalog, dimensions, hash and CSS focus: ${row.id}`);
}

const old = Object.freeze({ id: 'shiroko', name: '시로코', portrait: '/games/primitive-archive/portraits/shiroko.svg', hp: 71 });
const oldBefore = JSON.stringify(old);
assert.equal(resolveArchivePortrait(old).src, ARCHIVE_OFFICIAL_PORTRAITS.shiroko.src);
assert.equal(JSON.stringify(old), oldBefore);
for (const actor of STUDENTS) {
  const saved = Object.freeze({ actorId: actor.id, portrait: '/games/primitive-archive/portraits/placeholder.svg' });
  assert.equal(resolveArchivePortrait(saved).src, actor.portrait);
  const basePath = `/games/primitive-archive/portraits/official/${actor.id}.${['noa', 'ako'].includes(actor.id) ? 'jpg' : 'png'}`;
  assert.equal(resolveArchivePortrait({ id: actor.id, portrait: basePath }).src, actor.portrait);
}
console.log('PASS old built-in party/history paths resolve at display time without rewriting any saved record');
checks += 1;

for (const portrait of ['https://example.test/custom.png', '/custom-original.svg']) {
  assert.equal(resolveArchivePortrait({ id: 'shiroko', portrait }).src, portrait);
  assert.equal(resolveArchivePortrait({ actorId: 'noa', portrait }).src, portrait);
}
const heir = { id: 'example-run:heir:1', lineageRootId: 'shiroko', name: '시로코 계보 · 1세대 후계',
  portrait: '/games/primitive-archive/portraits/placeholder.svg' };
assert.equal(resolveArchivePortrait(heir).src, heir.portrait);
assert.equal(resolveArchivePortrait(heir).crop, null);
assert.match(resolveArchivePortrait({}).src, /placeholder\.svg$/);
for (const id of ['toString', 'constructor', '__proto__']) {
  assert.match(resolveArchivePortrait({ id }).src, /placeholder\.svg$/);
}
console.log('PASS custom artwork and generated heirs retain their distinct current portraits');
checks += 1;

const state = createNewState({ runId: 'official-art-new-run', rng: () => 0.5 });
assert.deepEqual(state.party.map(member => member.portrait), STUDENTS.slice(0, 3).map(member => member.portrait));
assert.deepEqual(state.founderHistory.members.map(member => member.portrait), state.party.map(member => member.portrait));
assert.equal(state.lineage.mode, 'hybrid');
console.log('PASS actual new-run party and founding record share official catalog paths');
checks += 1;
console.log(JSON.stringify({ pass: true, checks, files: manifest.rows.length,
  bytes: manifest.rows.reduce((sum, row) => sum + row.bytes, 0),
  scope: 'Current asset input manifest, source bytes and image decoding, catalog, non-mutating display migration and new-run snapshots; no network or browser calls. Official publication attribution was acquired separately.' }));
