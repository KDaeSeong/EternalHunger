import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  GAME_BGM_RENDERED_TRACKS,
  gameBgmRenderedTrack,
} from '../src/app/games/_lib/gameBgmRenderedTracks.js';
import {
  PRIMITIVE_ARCHIVE_SOUNDTRACK,
} from '../src/app/games/primitive-archive/_lib/primitiveArchiveSoundtrack.js';

const clientRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const publicRoot = path.join(clientRoot, 'public');
const rendererSource = await readFile(
  path.join(clientRoot, 'scripts', 'render-primitive-archive-instrumental.mjs'),
  'utf8',
);
const sharedRendererSource = await readFile(
  path.join(clientRoot, 'scripts', 'render-eternal-hunger-instrumental.mjs'),
  'utf8',
);
const manifest = JSON.parse(await readFile(
  path.join(publicRoot, 'audio', 'primitive-archive', 'manifest.json'),
  'utf8',
));

assert.equal(manifest.renderer, 'physical-model-v1');
assert.equal(manifest.tracks.length, 7, '문명 아카이브 렌더 트랙은 7곡이어야 합니다.');
assert.equal(
  Object.keys(GAME_BGM_RENDERED_TRACKS).filter((theme) => theme.startsWith('archive-')).length,
  7,
  '문명 아카이브 런타임 렌더 트랙 매핑은 7곡이어야 합니다.',
);
assert.equal(new Set(manifest.tracks.map((track) => track.file)).size, 7, '렌더 트랙 파일명이 중복되면 안 됩니다.');

let totalBytes = 0;
for (const soundtrackRow of PRIMITIVE_ARCHIVE_SOUNDTRACK) {
  const renderedTrack = gameBgmRenderedTrack(soundtrackRow.theme);
  assert.ok(renderedTrack, `렌더 트랙 매핑 누락: ${soundtrackRow.theme}`);
  assert.equal(renderedTrack.renderer, 'physical-model-v1');
  assert.equal(renderedTrack.loop, true);
  assert.equal(renderedTrack.loopStartSeconds, 0.85);
  assert.match(renderedTrack.src, /^\/audio\/primitive-archive\/[a-z-]+\.wav$/);

  const filePath = path.join(publicRoot, ...renderedTrack.src.split('/').filter(Boolean));
  const wave = await readFile(filePath);
  assert.equal(wave.toString('ascii', 0, 4), 'RIFF', `RIFF 헤더 누락: ${renderedTrack.src}`);
  assert.equal(wave.toString('ascii', 8, 12), 'WAVE', `WAVE 헤더 누락: ${renderedTrack.src}`);
  assert.equal(wave.readUInt16LE(20), 1, `PCM 포맷이 아닙니다: ${renderedTrack.src}`);
  assert.equal(wave.readUInt16LE(22), 1, `모노 트랙이어야 합니다: ${renderedTrack.src}`);
  assert.equal(wave.readUInt32LE(24), 22_050, `샘플레이트 오류: ${renderedTrack.src}`);
  assert.equal(wave.readUInt16LE(34), 16, `16비트 PCM이어야 합니다: ${renderedTrack.src}`);
  const dataBytes = wave.readUInt32LE(40);
  const durationSeconds = dataBytes / (22_050 * 2);
  assert.equal(wave.length, dataBytes + 44, `WAV 데이터 길이 오류: ${renderedTrack.src}`);
  assert.equal(durationSeconds >= 40 && durationSeconds <= 65, true, `트랙 길이 오류: ${renderedTrack.src}`);

  let sumSquares = 0;
  let peak = 0;
  let clippedSamples = 0;
  const sampleCount = dataBytes / 2;
  for (let sampleIndex = 0; sampleIndex < sampleCount; sampleIndex += 1) {
    const sample = wave.readInt16LE(44 + sampleIndex * 2) / 32_768;
    const magnitude = Math.abs(sample);
    sumSquares += sample * sample;
    peak = Math.max(peak, magnitude);
    if (magnitude >= 0.995) clippedSamples += 1;
  }
  const rms = Math.sqrt(sumSquares / sampleCount);
  assert.equal(rms >= 0.025 && rms <= 0.32, true, `평균 음압 오류: ${renderedTrack.src}`);
  assert.equal(peak >= 0.82 && peak <= 0.92, true, `마스터 피크 오류: ${renderedTrack.src}`);
  assert.equal(clippedSamples / sampleCount < 0.0001, true, `디지털 클리핑 감지: ${renderedTrack.src}`);
  totalBytes += wave.length;
}

assert.equal(totalBytes >= 12_000_000 && totalBytes <= 22_000_000, true, '문명 아카이브 7곡 용량이 예상 범위를 벗어났습니다.');
assert.match(rendererSource, /renderPhysicalModelSoundtrack/, '공용 물리 모델 렌더러를 사용해야 합니다.');
assert.match(rendererSource, /lead: 'flute'/, '개척 장면에 플루트 편성이 필요합니다.');
assert.match(rendererSource, /percussion: 'tribal'/, '부족 타악기 편성이 필요합니다.');
assert.match(sharedRendererSource, /flute: Object\.freeze/, '공용 렌더러에 플루트 음색이 필요합니다.');
assert.match(sharedRendererSource, /config\.percussion === 'tribal'/, '공용 렌더러에 부족 타악기 분기가 필요합니다.');

console.log(JSON.stringify({
  renderedTracks: manifest.tracks.length,
  durationSeconds: manifest.tracks.map((track) => track.durationSeconds),
  totalMiB: Number((totalBytes / 1_048_576).toFixed(2)),
  palette: ['flute', 'pluck', 'strings', 'choir', 'brass', 'tribal-percussion'],
}, null, 2));
