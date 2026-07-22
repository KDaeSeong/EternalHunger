import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { decodePcmWave, pcmWavePeak } from './audio/pcmWave.mjs';
import {
  sampledOrchestraMetadata,
  sampledOrchestraSupportsInstrument,
} from './audio/sampledOrchestra.mjs';
import {
  VSCO2_CE_MINI_FILES,
  VSCO2_CE_MINI_LIBRARY,
} from './audio/vsco2CeMiniCatalog.mjs';

const clientRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sampleRoot = path.join(clientRoot, 'audio-source', 'vsco2-ce-mini');
const manifest = JSON.parse(await readFile(path.join(sampleRoot, 'manifest.json'), 'utf8'));
const license = await readFile(path.join(sampleRoot, 'LICENSE.md'), 'utf8');
const rendererSource = await readFile(
  path.join(clientRoot, 'scripts', 'render-eternal-hunger-instrumental.mjs'),
  'utf8',
);
const samplerSource = await readFile(path.join(clientRoot, 'scripts', 'audio', 'sampledOrchestra.mjs'), 'utf8');

assert.equal(manifest.name, VSCO2_CE_MINI_LIBRARY.name);
assert.equal(manifest.version, VSCO2_CE_MINI_LIBRARY.version);
assert.equal(manifest.license, 'CC0-1.0');
assert.equal(manifest.sampleRate, 22_050);
assert.equal(manifest.preparedFormat, 'PCM 16-bit stereo WAV');
assert.deepEqual(manifest.files.map((row) => row.file), VSCO2_CE_MINI_FILES);
assert.equal(manifest.files.length, 50, '미니 샘플 뱅크는 공식 50개 팩을 모두 보존해야 합니다.');
assert.match(license, /Creative Commons Zero 1\.0 Universal/);
assert.match(license, /versilian-studios\.com\/vsco-community/);

let totalBytes = 0;
for (const row of manifest.files) {
  const buffer = await readFile(path.join(sampleRoot, row.file));
  const wave = decodePcmWave(buffer);
  assert.equal(wave.sampleRate, 22_050, `샘플레이트 오류: ${row.file}`);
  assert.equal(wave.bitsPerSample, 16, `비트 깊이 오류: ${row.file}`);
  assert.equal(wave.channels, 2, `스테레오 샘플이어야 합니다: ${row.file}`);
  assert.equal(wave.left.length, row.frames, `프레임 수 불일치: ${row.file}`);
  assert.equal(buffer.length, row.bytes, `파일 크기 불일치: ${row.file}`);
  assert.equal(pcmWavePeak(wave) > 0.005, true, `무음 샘플입니다: ${row.file}`);
  assert.equal(pcmWavePeak(wave) <= 1, true, `클리핑 샘플입니다: ${row.file}`);
  totalBytes += buffer.length;
}
assert.equal(totalBytes >= 20_000_000, true, '실제 연주 샘플 데이터가 충분하지 않습니다.');
assert.equal(totalBytes <= 35_000_000, true, '미니 샘플 뱅크는 35MB 이하여야 합니다.');

const metadata = sampledOrchestraMetadata();
assert.equal(metadata.license, 'CC0-1.0');
assert.equal(metadata.sampledTonalInstruments.length >= 15, true);
assert.equal(metadata.sampledPercussion.length >= 6, true);
for (const instrument of [
  'strings', 'violin', 'viola', 'cello', 'bass', 'flute', 'oboe', 'bassoon',
  'horn', 'trumpet', 'trombone', 'brass', 'harp', 'bell', 'celesta', 'vibraphone',
  'snare', 'orchestral-snare', 'cymbal', 'timpani', 'taiko', 'tom',
]) {
  assert.equal(sampledOrchestraSupportsInstrument(instrument), true, `샘플 악기 매핑 누락: ${instrument}`);
}

for (const token of [
  'renderPitchedSample',
  'nearestCandidate',
  'crossfadeFrames',
  'sampledOrchestraTone',
  'sampledOrchestraPercussion',
  'sampledOrchestraUsageSnapshot',
  'recordUsage',
  'sampleRms',
]) {
  assert.match(samplerSource, new RegExp(token), `샘플러 기능 누락: ${token}`);
}
assert.doesNotMatch(samplerSource, /gm\.dls/i, 'Windows 전용 시스템 음원에 의존하면 안 됩니다.');
assert.match(rendererSource, /sampled-orchestra-v3-vsco2-ce/);
assert.match(rendererSource, /synthesisFallbackInstruments/);

console.log(JSON.stringify({
  sampleFiles: manifest.files.length,
  totalMiB: Number((totalBytes / 1_048_576).toFixed(2)),
  tonalInstruments: metadata.sampledTonalInstruments,
  percussion: metadata.sampledPercussion,
  license: manifest.license,
}, null, 2));
