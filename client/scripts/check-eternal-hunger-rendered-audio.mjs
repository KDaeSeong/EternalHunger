import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  GAME_BGM_RENDERED_TRACKS,
  gameBgmRenderedTrack,
} from '../src/app/games/_lib/gameBgmRenderedTracks.js';
import {
  ETERNAL_HUNGER_SOUNDTRACK,
} from '../src/app/simulation/_lib/eternalHungerSoundtrack.js';

const clientRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const publicRoot = path.join(clientRoot, 'public');
const providerSource = await readFile(
  path.join(clientRoot, 'src', 'app', 'games', '_components', 'GameBgmProvider.js'),
  'utf8',
);
const rendererSource = await readFile(
  path.join(clientRoot, 'scripts', 'render-eternal-hunger-instrumental.mjs'),
  'utf8',
);
const manifest = JSON.parse(await readFile(
  path.join(publicRoot, 'audio', 'eternal-hunger', 'manifest.json'),
  'utf8',
));

assert.equal(manifest.renderer, 'physical-model-v1', '렌더러 버전이 기록되어야 합니다.');
assert.equal(manifest.tracks.length, 9, '이터널 헝거 렌더 트랙은 9곡이어야 합니다.');
assert.equal(
  Object.keys(GAME_BGM_RENDERED_TRACKS).filter((theme) => theme.startsWith('eternal-')).length,
  9,
  '이터널 헝거 런타임 렌더 트랙 매핑은 9곡이어야 합니다.',
);
assert.equal(new Set(manifest.tracks.map((track) => track.file)).size, 9, '렌더 트랙 파일명이 중복되면 안 됩니다.');

let totalBytes = 0;
for (const soundtrackRow of ETERNAL_HUNGER_SOUNDTRACK) {
  const renderedTrack = gameBgmRenderedTrack(soundtrackRow.theme);
  assert.ok(renderedTrack, `렌더 트랙 매핑 누락: ${soundtrackRow.theme}`);
  assert.equal(renderedTrack.renderer, 'physical-model-v1');
  assert.equal(renderedTrack.loop, true);
  assert.equal(renderedTrack.loopStartSeconds, 0.85);
  assert.match(renderedTrack.src, /^\/audio\/eternal-hunger\/[a-z-]+\.wav$/);

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
  assert.equal(durationSeconds >= 40, true, `트랙이 너무 짧습니다: ${renderedTrack.src}`);
  assert.equal(durationSeconds <= 70, true, `트랙이 지나치게 큽니다: ${renderedTrack.src}`);
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
  assert.equal(rms >= 0.025, true, `실질적으로 무음인 트랙입니다: ${renderedTrack.src}`);
  assert.equal(rms <= 0.32, true, `평균 음압이 지나치게 큽니다: ${renderedTrack.src}`);
  assert.equal(peak >= 0.82 && peak <= 0.92, true, `마스터 피크가 잘못되었습니다: ${renderedTrack.src}`);
  assert.equal(clippedSamples / sampleCount < 0.0001, true, `디지털 클리핑이 감지되었습니다: ${renderedTrack.src}`);
  totalBytes += wave.length;
}

assert.equal(totalBytes >= 15_000_000, true, '9곡의 실제 PCM 음원이 생성되어야 합니다.');
assert.equal(totalBytes <= 30_000_000, true, '정적 음원 크기는 30MB 이하여야 합니다.');

for (const token of [
  'gameBgmRenderedTrack',
  'loadRenderedTrackBuffer',
  'decodeAudioData',
  'createRenderedTrackSession',
  "gameBgmSource = 'synth'",
  "gameBgmSource = 'rendered'",
  "gameBgmAssetStatus = 'fallback'",
]) {
  assert.match(providerSource, new RegExp(token), `공용 렌더 트랙 재생 토큰 누락: ${token}`);
}

for (const instrument of ['piano', 'strings', 'brass', 'choir', 'bell', 'pluck', 'guitar', 'bass']) {
  assert.match(rendererSource, new RegExp(`'${instrument}'`), `악기 모델 누락: ${instrument}`);
}
for (const drum of ['kick', 'snare', 'hat', 'cymbal', 'tom']) {
  assert.match(rendererSource, new RegExp(`${drum}`), `타악기 모델 누락: ${drum}`);
}
assert.match(rendererSource, /pluckedSample/, '현 진동 모델링이 필요합니다.');
assert.match(rendererSource, /applyCircularRoom/, '루프형 공간 잔향 처리가 필요합니다.');
assert.match(rendererSource, /masterTrack/, '마스터링 단계가 필요합니다.');
assert.match(rendererSource, /SAMPLE_RATE \* 0\.85/, '루프 크로스페이드 길이는 0.85초여야 합니다.');

console.log(JSON.stringify({
  renderedTracks: manifest.tracks.length,
  durationSeconds: manifest.tracks.map((track) => track.durationSeconds),
  totalMiB: Number((totalBytes / 1_048_576).toFixed(2)),
  renderer: manifest.renderer,
}, null, 2));
