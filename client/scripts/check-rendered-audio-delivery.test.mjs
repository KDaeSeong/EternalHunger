import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm, lstat } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { checkRenderedAudioDelivery } from './check-rendered-audio-delivery.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const clientRoot = path.resolve(here, '..');
const assetModule = pathToFileURL(path.join(clientRoot, 'src/app/games/_lib/gameBgmAudioAssets.js')).href;
const originalModule = pathToFileURL(path.join(clientRoot, 'scripts/lib/rendered-audio-local-assets.mjs')).href;
const { gameBgmAudioUrl, GAME_BGM_AUDIO_CONFIGURATION } = await import(assetModule);
const baseName = 'NEXT_PUBLIC_GAME_BGM_AUDIO_BASE_URL';
const formatName = 'NEXT_PUBLIC_GAME_BGM_AUDIO_FORMAT';
const key = 'audio/fixture/menu.wav';

if (process.argv[2] === '--quality-original') {
  const { renderedAudioLocalFile } = await import(originalModule);
  const track = { assetKey: key, src: gameBgmAudioUrl(key) };
  const selected = renderedAudioLocalFile(process.argv[3], track);
  await assert.rejects(readFile(selected), { code: 'ENOENT' });
  console.log('missing-original-rejected');
} else {
  const fixture = await mkdtemp(path.join(os.tmpdir(), 'eh-audio-delivery-'));
  const publicRoot = path.join(fixture, 'public');
  const originalRoot = path.join(fixture, 'originals');
  const wav = path.join(publicRoot, ...key.split('/'));
  const mp3 = wav.replace(/\.wav$/, '.mp3');
  const fakeBytes = Buffer.from('generated-existence-fixture');
  const tests = [];
  const localWav = Object.freeze({ base: '', format: 'wav' });
  const run = (configuration = localWav, tracks = [{ assetKey: key }], root = publicRoot) =>
    checkRenderedAudioDelivery({ publicRoot: root, tracks, gameBgmAudioUrl, configuration });
  const test = async (name, fn) => { await fn(); tests.push(name); };
  try {
    await mkdir(path.dirname(wav), { recursive: true });
    await mkdir(path.join(originalRoot, 'fixture'), { recursive: true });
    await writeFile(wav, fakeBytes);
    await writeFile(mp3, fakeBytes);
    await test('actual shared frozen configuration selects delivery mode', async () => {
      assert.equal(Object.isFrozen(GAME_BGM_AUDIO_CONFIGURATION), true);
      assert.equal((await run(GAME_BGM_AUDIO_CONFIGURATION)).mode, GAME_BGM_AUDIO_CONFIGURATION.base ? 'remote' : 'local');
    });
    await rm(mp3);
    await test('present local WAV succeeds', async () => assert.equal((await run()).checkedLocalPlaybackFiles, 1));
    await rm(wav);
    await writeFile(path.join(originalRoot, 'fixture/menu.wav'), fakeBytes);
    await test('explicit local configuration fails missing public WAV despite preserved originals elsewhere', async () => {
      await assert.rejects(run(localWav), /Missing selected local/);
    });
    await writeFile(mp3, fakeBytes);
    await test('present local MP3 succeeds without public WAV', async () => assert.equal((await run({ base: '', format: 'mp3' })).format, 'mp3'));
    await rm(mp3);
    await writeFile(wav, fakeBytes);
    await test('missing selected MP3 fails despite public WAV', async () => {
      await assert.rejects(run({ base: '', format: 'mp3' }), /Missing selected local/);
    });
    await rm(wav);
    for (const format of ['wav', 'mp3']) {
      await test(`explicit remote ${format} needs no local public files`, async () => {
        const result = await run({ base: 'https://example.invalid/music/', format });
        assert.equal(result.mode, 'remote');
        assert.equal(result.checkedLocalPlaybackFiles, 0);
        assert.equal(result.networkRequests, 0);
      });
    }
    await test('invalid delivery configuration fails', async () => {
      for (const base of ['http://example.invalid', '//example.invalid', 'https:example.invalid', 'https://user:pw@example.invalid', 'https://example.invalid/?']) {
        await assert.rejects(run({ base, format: 'wav' }));
      }
      for (const format of ['ogg', 'MP3', '', ' ']) await assert.rejects(run({ base: '', format }));
      for (const configuration of [null, {}, { base: '' }, { format: 'mp3' }]) await assert.rejects(run(configuration), /shared rendered audio configuration/);
    });
    await test('relative traversal and noncanonical asset paths fail', async () => {
      for (const assetKey of ['../menu.wav', '/audio/fixture/menu.wav', 'audio/../menu.wav', 'audio/fixture/../menu.wav', 'audio/fixture/%2e%2e.wav', 'audio\\fixture\\menu.wav']) {
        await assert.rejects(run(localWav, [{ assetKey }]));
        await assert.rejects(run({ base: 'https://example.invalid', format: 'mp3' }, [{ assetKey }]));
      }
      await assert.rejects(run(localWav, [{ assetKey: key }], 'relative/public'), /must be absolute/);
      await assert.rejects(run(localWav, []), /must not be empty/);
      await assert.rejects(run(localWav, [{ assetKey: key, src: 'https://example.invalid/wrong.mp3' }]), /selected shared configuration/);
    });
    await test('directory cannot masquerade as playback file', async () => {
      await mkdir(wav);
      await assert.rejects(run(), /Unexpected playback path type/);
      await rm(wav, { recursive: true });
    });
    await test('remote playback never skips missing-original quality reads', async () => {
      // This uses the current real quality helper in fresh processes for both formats.
      await rm(path.join(originalRoot, 'fixture/menu.wav'));
      for (const format of ['wav', 'mp3']) {
        const result = spawnSync(process.execPath, [fileURLToPath(import.meta.url), '--quality-original', publicRoot], {
          env: { ...process.env, [baseName]: 'https://example.invalid/music', [formatName]: format, EH_RENDERED_AUDIO_ROOT: originalRoot },
          encoding: 'utf8', timeout: 10000, maxBuffer: 16384,
        });
        assert.equal(result.error, undefined);
        assert.equal(result.status, 0, result.stderr);
        assert.match(result.stdout, /missing-original-rejected/);
      }
    });
  } finally {
    assert.equal(path.dirname(fixture), os.tmpdir());
    assert.ok(path.basename(fixture).startsWith('eh-audio-delivery-'));
    await rm(fixture, { recursive: true, force: true });
    await assert.rejects(lstat(fixture), { code: 'ENOENT' });
  }
  const result = { recordedUtc: new Date().toISOString(), pass: true, tests,
    networkRequests: 0, realAudioFilesModified: 0,
    fixture: { root: fixture, removed: true, generatedBytesPerFile: fakeBytes.length,
      sha256: crypto.createHash('sha256').update(fakeBytes).digest('hex') },
    sharedAssetModule: assetModule };
  console.log(JSON.stringify(result));
}
