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

assert.equal(manifest.renderer, 'physical-model-v2-orchestra', '오케스트라 렌더러 버전이 기록되어야 합니다.');
assert.equal(manifest.tracks.length, 9, '이터널 헝거 렌더 트랙은 9곡이어야 합니다.');
assert.equal(
  Object.keys(GAME_BGM_RENDERED_TRACKS).filter((theme) => theme.startsWith('eternal-')).length,
  9,
  '이터널 헝거 런타임 렌더 트랙 매핑은 9곡이어야 합니다.',
);
assert.equal(new Set(manifest.tracks.map((track) => track.file)).size, 9, '렌더 트랙 파일명이 중복되면 안 됩니다.');

let totalBytes = 0;
const manifestInstruments = new Set();
for (const soundtrackRow of ETERNAL_HUNGER_SOUNDTRACK) {
  const renderedTrack = gameBgmRenderedTrack(soundtrackRow.theme);
  const manifestTrack = manifest.tracks.find((track) => track.theme === soundtrackRow.theme);
  assert.ok(renderedTrack, `렌더 트랙 매핑 누락: ${soundtrackRow.theme}`);
  assert.ok(manifestTrack, `렌더 manifest 누락: ${soundtrackRow.theme}`);
  assert.equal(renderedTrack.renderer, 'physical-model-v2-orchestra');
  assert.equal(renderedTrack.loop, true);
  assert.equal(renderedTrack.loopStartSeconds, 0.85);
  assert.match(renderedTrack.src, /^\/audio\/eternal-hunger\/[a-z-]+\.wav$/);
  assert.equal(manifestTrack.channels, 2, `manifest 채널 오류: ${soundtrackRow.theme}`);
  assert.equal(manifestTrack.sampleRate, 22_050, `manifest 샘플레이트 오류: ${soundtrackRow.theme}`);
  assert.equal(manifestTrack.instruments.length >= 14, true, `오케스트라 편성이 부족합니다: ${soundtrackRow.theme}`);
  for (const instrument of manifestTrack.instruments) manifestInstruments.add(instrument);

  const filePath = path.join(publicRoot, ...renderedTrack.src.split('/').filter(Boolean));
  const wave = await readFile(filePath);
  assert.equal(wave.toString('ascii', 0, 4), 'RIFF', `RIFF 헤더 누락: ${renderedTrack.src}`);
  assert.equal(wave.toString('ascii', 8, 12), 'WAVE', `WAVE 헤더 누락: ${renderedTrack.src}`);
  assert.equal(wave.readUInt16LE(20), 1, `PCM 포맷이 아닙니다: ${renderedTrack.src}`);
  assert.equal(wave.readUInt16LE(22), 2, `스테레오 트랙이어야 합니다: ${renderedTrack.src}`);
  assert.equal(wave.readUInt32LE(24), 22_050, `샘플레이트 오류: ${renderedTrack.src}`);
  assert.equal(wave.readUInt32LE(28), 22_050 * 4, `바이트레이트 오류: ${renderedTrack.src}`);
  assert.equal(wave.readUInt16LE(32), 4, `블록 정렬 오류: ${renderedTrack.src}`);
  assert.equal(wave.readUInt16LE(34), 16, `16비트 PCM이어야 합니다: ${renderedTrack.src}`);
  const dataBytes = wave.readUInt32LE(40);
  const durationSeconds = dataBytes / (22_050 * 2 * 2);
  assert.equal(wave.length, dataBytes + 44, `WAV 데이터 길이 오류: ${renderedTrack.src}`);
  assert.equal(durationSeconds >= 70, true, `트랙이 너무 짧습니다: ${renderedTrack.src}`);
  assert.equal(durationSeconds <= 115, true, `트랙이 지나치게 큽니다: ${renderedTrack.src}`);
  let sumSquares = 0;
  let stereoDifferenceSquares = 0;
  let peak = 0;
  let clippedSamples = 0;
  const sampleCount = dataBytes / 2;
  const frameCount = sampleCount / 2;
  for (let frame = 0; frame < frameCount; frame += 1) {
    const left = wave.readInt16LE(44 + frame * 4) / 32_768;
    const right = wave.readInt16LE(46 + frame * 4) / 32_768;
    sumSquares += left * left + right * right;
    stereoDifferenceSquares += (left - right) ** 2;
    peak = Math.max(peak, Math.abs(left), Math.abs(right));
    if (Math.abs(left) >= 0.995) clippedSamples += 1;
    if (Math.abs(right) >= 0.995) clippedSamples += 1;
  }
  const rms = Math.sqrt(sumSquares / sampleCount);
  const stereoDifference = Math.sqrt(stereoDifferenceSquares / frameCount);
  assert.equal(rms >= 0.025, true, `실질적으로 무음인 트랙입니다: ${renderedTrack.src}`);
  assert.equal(rms <= 0.32, true, `평균 음압이 지나치게 큽니다: ${renderedTrack.src}`);
  assert.equal(stereoDifference >= 0.008, true, `좌우 공간 배치가 부족합니다: ${renderedTrack.src}`);
  assert.equal(peak >= 0.82 && peak <= 0.92, true, `마스터 피크가 잘못되었습니다: ${renderedTrack.src}`);
  assert.equal(clippedSamples / sampleCount < 0.0001, true, `디지털 클리핑이 감지되었습니다: ${renderedTrack.src}`);
  totalBytes += wave.length;
}

assert.equal(totalBytes >= 55_000_000, true, '9곡의 전체 길이 스테레오 PCM 음원이 생성되어야 합니다.');
assert.equal(totalBytes <= 90_000_000, true, '정적 음원 크기는 90MB 이하여야 합니다.');

for (const instrument of [
  'piano', 'violin', 'viola', 'cello', 'flute', 'oboe', 'clarinet', 'horn', 'trumpet',
  'trombone', 'harp', 'celesta', 'choir', 'timpani', 'taiko',
]) {
  assert.equal(manifestInstruments.has(instrument), true, `전체 오케스트라 편성 누락: ${instrument}`);
}

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

for (const instrument of [
  'piano', 'strings', 'violin', 'viola', 'cello', 'brass', 'horn', 'trumpet', 'trombone',
  'choir', 'bell', 'celesta', 'flute', 'oboe', 'clarinet', 'harp', 'pluck', 'guitar', 'bass',
]) {
  assert.match(rendererSource, new RegExp(`'${instrument}'`), `악기 모델 누락: ${instrument}`);
}
for (const drum of ['kick', 'snare', 'orchestral-snare', 'hat', 'cymbal', 'tom', 'timpani', 'taiko']) {
  assert.match(rendererSource, new RegExp(`${drum}`), `타악기 모델 누락: ${drum}`);
}
assert.match(rendererSource, /pluckedSample/, '현 진동 모델링이 필요합니다.');
assert.match(rendererSource, /applyCircularRoom/, '루프형 공간 잔향 처리가 필요합니다.');
assert.match(rendererSource, /applyStereoRoom/, '스테레오 공간 잔향 처리가 필요합니다.');
assert.match(rendererSource, /masterTrack/, '마스터링 단계가 필요합니다.');
assert.match(rendererSource, /masterStereoTrack/, '스테레오 마스터링 단계가 필요합니다.');
assert.match(rendererSource, /physical-model-v2-orchestra/, '오케스트라 렌더러 식별자가 필요합니다.');
assert.match(rendererSource, /SAMPLE_RATE \* 0\.85/, '루프 크로스페이드 길이는 0.85초여야 합니다.');

console.log(JSON.stringify({
  renderedTracks: manifest.tracks.length,
  durationSeconds: manifest.tracks.map((track) => track.durationSeconds),
  totalMiB: Number((totalBytes / 1_048_576).toFixed(2)),
  renderer: manifest.renderer,
}, null, 2));
