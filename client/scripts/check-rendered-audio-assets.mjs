import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const clientRoot = path.resolve(scriptDirectory, '..');
const libraryRoot = path.join(clientRoot, 'src/app/games/_lib');
const helperUrl = pathToFileURL(path.join(libraryRoot, 'gameBgmAudioAssets.js')).href;
const baseName = 'NEXT_PUBLIC_GAME_BGM_AUDIO_BASE_URL';
const formatName = 'NEXT_PUBLIC_GAME_BGM_AUDIO_FORMAT';
const publicRoot = path.join(clientRoot, 'public');
const defaultRoot = 'https://pub-38fd672431c94a81bb1c23804abd21da.r2.dev';
const alternateRoot = 'https://example.invalid/music';

async function checkScenario(scenario) {
  const registryUrl = pathToFileURL(path.join(libraryRoot, 'gameBgmRenderedTracks.js')).href;
  if (scenario.invalid) {
    await assert.rejects(import(registryUrl));
    return 0;
  }
  const { gameBgmAudioUrl, GAME_BGM_AUDIO_CONFIGURATION, DEFAULT_GAME_BGM_AUDIO_BASE_URL, DEFAULT_GAME_BGM_AUDIO_FORMAT } = await import(helperUrl);
  const { GAME_BGM_RENDERED_TRACKS, gameBgmRenderedTrack } = await import(registryUrl);
  const { renderedAudioAssetPath, renderedAudioLocalFile } = await import(pathToFileURL(path.join(clientRoot, 'scripts/lib/rendered-audio-local-assets.mjs')).href);
  assert.equal(DEFAULT_GAME_BGM_AUDIO_BASE_URL, defaultRoot);
  assert.equal(DEFAULT_GAME_BGM_AUDIO_FORMAT, 'mp3');
  assert.equal(Object.isFrozen(GAME_BGM_AUDIO_CONFIGURATION), true);
  assert.deepEqual(GAME_BGM_AUDIO_CONFIGURATION, {
    base: scenario.baseEnv === undefined ? defaultRoot : scenario.baseEnv.trim(),
    format: scenario.format,
  });
  const tracks = Object.entries(GAME_BGM_RENDERED_TRACKS);
  assert.equal(tracks.length, 104);
  assert.equal(new Set(tracks.map(([, track]) => track.assetKey)).size, 104);
  const manifests = new Map();
  for (const [theme, track] of tracks) {
    assert.equal(Object.isFrozen(track), true);
    assert.equal(gameBgmRenderedTrack(theme), track);
    assert.match(track.assetKey, /^audio\/[a-z0-9-]+\/[a-z0-9-]+\.wav$/);
    const [, folder, file] = track.assetKey.split('/');
    const playbackFile = `${file.slice(0, -4)}.${scenario.format}`;
    const expectedSource = scenario.root
      ? `${scenario.root}/${folder}/${playbackFile}`
      : `/audio/${folder}/${playbackFile}`;
    assert.equal(track.src, expectedSource);
    assert.equal(renderedAudioAssetPath(track), `/${track.assetKey}`);
    assert.equal(renderedAudioLocalFile(publicRoot, track), path.join(publicRoot, ...track.assetKey.split('/')));
    if (!manifests.has(folder)) {
      manifests.set(folder, JSON.parse(await readFile(path.join(publicRoot, 'audio', folder, 'manifest.json'), 'utf8')));
    }
    assert.ok(manifests.get(folder).tracks.some(row => row.file === file), `Missing original manifest entry: ${track.assetKey}`);
  }
  assert.equal(manifests.size, 14);
  assert.equal(GAME_BGM_RENDERED_TRACKS['srpg-battle'].assetKey, 'audio/ba-srpg/battle.wav');
  if (scenario.name === 'default-r2-mp3') {
    // This independent literal is the user's confirmed object URL. It catches
    // a resolver and registry that accidentally agree on an extra /audio/.
    assert.equal(GAME_BGM_RENDERED_TRACKS['srpg-battle'].src, 'https://pub-38fd672431c94a81bb1c23804abd21da.r2.dev/ba-srpg/battle.mp3');
  }
  if (scenario.name === 'explicit-local-wav') assert.equal(GAME_BGM_RENDERED_TRACKS['srpg-battle'].src, '/audio/ba-srpg/battle.wav');

  const track = tracks[0][1];
  const originalRoot = path.join(clientRoot, `.missing-rendered-audio-contract-${process.pid}`);
  try {
    process.env.EH_RENDERED_AUDIO_ROOT = originalRoot;
    const originalFile = renderedAudioLocalFile(publicRoot, track);
    assert.equal(originalFile, path.join(originalRoot, ...track.assetKey.split('/').slice(1)));
    await assert.rejects(readFile(originalFile), { code: 'ENOENT' });
    for (const invalidRoot of ['', ' ', 'relative/audio']) {
      process.env.EH_RENDERED_AUDIO_ROOT = invalidRoot;
      assert.throws(() => renderedAudioLocalFile(publicRoot, track), /EH_RENDERED_AUDIO_ROOT/);
    }
  } finally {
    delete process.env.EH_RENDERED_AUDIO_ROOT;
  }
  assert.throws(() => renderedAudioAssetPath({ ...track, src: 'https://example.invalid/wrong.mp3' }), /Playback URL/);
  assert.throws(() => renderedAudioLocalFile(publicRoot, { ...track, assetKey: 'audio/../menu.wav' }));
  if (scenario.name === 'default-r2-mp3') {
    const key = 'audio/eternal-hunger/menu.wav';
    assert.equal(gameBgmAudioUrl(key, '', 'wav'), '/audio/eternal-hunger/menu.wav');
    assert.equal(gameBgmAudioUrl(key, '', 'mp3'), '/audio/eternal-hunger/menu.mp3');
    assert.equal(gameBgmAudioUrl(key, alternateRoot, 'wav'), 'https://example.invalid/music/eternal-hunger/menu.wav');
    assert.equal(gameBgmAudioUrl(key, `${alternateRoot}///`, 'mp3'), 'https://example.invalid/music/eternal-hunger/menu.mp3');
    assert.equal(gameBgmAudioUrl(key, `${alternateRoot}/audio/`, 'mp3'), 'https://example.invalid/music/audio/eternal-hunger/menu.mp3');
    for (const invalidFormat of ['ogg', 'MP3', '', ' mp3 ', null]) assert.throws(() => gameBgmAudioUrl(key, alternateRoot, invalidFormat), /Invalid rendered audio format/);
    for (const invalidKey of ['../menu.wav', 'audio/game/../menu.wav', 'audio/game/menu.mp3', 'audio/game/menu.wav?x', 'audio/game/%2e%2e.wav']) {
      assert.throws(() => gameBgmAudioUrl(invalidKey, alternateRoot, 'mp3'), /Invalid rendered audio asset key/);
    }
  }
  return tracks.length;
}

if (process.argv[2] === '--scenario') {
  console.log(JSON.stringify({ mappings: await checkScenario(JSON.parse(process.argv[3])) }));
} else {
  const scenarios = [
    { name: 'default-r2-mp3', root: defaultRoot, format: 'mp3' },
    { name: 'explicit-local-wav', baseEnv: '', formatEnv: 'wav', format: 'wav' },
    { name: 'explicit-local-mp3', baseEnv: '', formatEnv: 'mp3', format: 'mp3' },
    { name: 'empty-base-default-format', baseEnv: '', format: 'mp3' },
    { name: 'default-root-wav-override', formatEnv: 'wav', root: defaultRoot, format: 'wav' },
    { name: 'alternate-cdn-root', baseEnv: `${alternateRoot}/`, root: alternateRoot, format: 'mp3' },
    { name: 'alternate-cdn-audio-path', baseEnv: `${alternateRoot}/audio/`, root: `${alternateRoot}/audio`, format: 'mp3' },
    { name: 'trimmed-alternate-cdn-wav', baseEnv: ` ${alternateRoot}/ `, formatEnv: ' wav ', root: alternateRoot, format: 'wav' },
    ...[
      'not-a-url', 'http://example.invalid', '//example.invalid', 'https:example.invalid',
      'https://name:password@example.invalid', 'https://example.invalid/?x=1',
      'https://example.invalid/?', 'https://example.invalid/#section', 'https://example.invalid/#',
    ].map(baseEnv => ({ name: `invalid-base:${baseEnv}`, baseEnv, invalid: true })),
    ...['ogg', 'MP3', '', ' '].map(formatEnv => ({ name: `invalid-format:${JSON.stringify(formatEnv)}`, formatEnv, invalid: true })),
  ];
  let trackMappings = 0;
  for (const scenario of scenarios) {
    const env = { ...process.env };
    for (const name of [baseName, formatName, 'EH_RENDERED_AUDIO_ROOT']) delete env[name];
    if (scenario.baseEnv !== undefined) env[baseName] = scenario.baseEnv;
    if (scenario.formatEnv !== undefined) env[formatName] = scenario.formatEnv;
    const result = spawnSync(process.execPath, [fileURLToPath(import.meta.url), '--scenario', JSON.stringify(scenario)], {
      cwd: clientRoot, env, encoding: 'utf8', timeout: 15_000, maxBuffer: 64 * 1024,
    });
    assert.equal(result.error, undefined, `${scenario.name}: ${result.error?.message}`);
    assert.equal(result.status, 0, `${scenario.name}: ${result.stderr}`);
    trackMappings += JSON.parse(result.stdout).mappings;
  }
  const examplePath = path.join(clientRoot, '.env.local.example');
  const example = readFileSync(examplePath, 'utf8');
  assert.doesNotMatch(example, /^NEXT_PUBLIC_GAME_BGM_AUDIO_(?:BASE_URL|FORMAT)=/m, 'A fresh example copy must retain the public defaults');
  assert.match(example, /^# NEXT_PUBLIC_GAME_BGM_AUDIO_BASE_URL=$/m);
  assert.match(example, /^# NEXT_PUBLIC_GAME_BGM_AUDIO_FORMAT=wav$/m);
  console.log(JSON.stringify({ passed: true, scenarios: scenarios.length, trackMappings, networkRequests: 0, wavFilesRead: 0, generatedFiles: 0 }));
}
