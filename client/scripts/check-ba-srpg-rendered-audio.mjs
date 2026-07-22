import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  GAME_BGM_RENDERED_TRACKS,
  gameBgmRenderedTrack,
} from '../src/app/games/_lib/gameBgmRenderedTracks.js';
import {
  BA_SRPG_SOUNDTRACK,
} from '../src/app/games/ba-srpg/_lib/baSrpgSoundtrack.js';

const clientRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const publicRoot = path.join(clientRoot, 'public');
const rendererSource = await readFile(
  path.join(clientRoot, 'scripts', 'render-ba-srpg-instrumental.mjs'),
  'utf8',
);
const manifest = JSON.parse(await readFile(
  path.join(publicRoot, 'audio', 'ba-srpg', 'manifest.json'),
  'utf8',
));

assert.equal(manifest.renderer, 'sampled-orchestra-v3-vsco2-ce');
assert.equal(manifest.sampleLibrary?.name, 'VS Chamber Orchestra 2 Community Edition - 50 Sample Pack');
assert.equal(manifest.sampleLibrary?.license, 'CC0-1.0');
assert.equal(manifest.sampleLibrary?.sampledTonalInstruments?.length >= 15, true);
assert.equal(manifest.sampleLibrary?.sampledPercussion?.length >= 6, true);
assert.equal(manifest.tracks.length, 7, 'BA SRPG 렌더 트랙은 7곡이어야 합니다.');
assert.equal(
  Object.keys(GAME_BGM_RENDERED_TRACKS).filter((theme) => theme.startsWith('srpg-')).length,
  7,
  'BA SRPG 런타임 렌더 트랙 매핑은 7곡이어야 합니다.',
);
assert.equal(new Set(manifest.tracks.map((track) => track.file)).size, 7);

let totalBytes = 0;
const soundtrackInstruments = new Set();
const sampledInstruments = new Set();
const sampledSourceFiles = new Set();
let sampledEvents = 0;
for (const soundtrackRow of BA_SRPG_SOUNDTRACK) {
  const renderedTrack = gameBgmRenderedTrack(soundtrackRow.theme);
  const manifestTrack = manifest.tracks.find((track) => track.theme === soundtrackRow.theme);
  assert.ok(renderedTrack, `렌더 트랙 매핑 누락: ${soundtrackRow.theme}`);
  assert.ok(manifestTrack, `렌더 manifest 누락: ${soundtrackRow.theme}`);
  assert.equal(renderedTrack.renderer, 'sampled-orchestra-v3-vsco2-ce');
  assert.equal(renderedTrack.loop, true);
  assert.equal(renderedTrack.loopStartSeconds, 0.85);
  assert.match(renderedTrack.src, /^\/audio\/ba-srpg\/[a-z-]+\.wav$/);
  assert.equal(manifestTrack.channels, 2, `스테레오 manifest 오류: ${soundtrackRow.theme}`);
  assert.equal(manifestTrack.sampleRate, 22_050, `샘플레이트 오류: ${soundtrackRow.theme}`);
  assert.equal(manifestTrack.instruments.length >= 15, true, `장면 오케스트라 편성이 부족합니다: ${soundtrackRow.theme}`);
  assert.equal(manifestTrack.sampleUsage?.events >= 90, true, `실제 연주 샘플 이벤트가 부족합니다: ${soundtrackRow.theme}`);
  assert.equal(
    Object.keys(manifestTrack.sampleUsage?.instruments || {}).length >= 12,
    true,
    `실제로 소리 난 샘플 악기 종류가 부족합니다: ${soundtrackRow.theme}`,
  );
  assert.equal(
    Object.keys(manifestTrack.sampleUsage?.files || {}).length >= 16,
    true,
    `실제로 소리 난 원본 샘플 종류가 부족합니다: ${soundtrackRow.theme}`,
  );
  for (const instrument of manifestTrack.instruments) soundtrackInstruments.add(instrument);
  for (const instrument of manifestTrack.sampledInstruments) sampledInstruments.add(instrument);
  for (const file of Object.keys(manifestTrack.sampleUsage.files)) sampledSourceFiles.add(file);
  sampledEvents += manifestTrack.sampleUsage.events;

  const filePath = path.join(publicRoot, ...renderedTrack.src.split('/').filter(Boolean));
  const wave = await readFile(filePath);
  assert.equal(wave.toString('ascii', 0, 4), 'RIFF');
  assert.equal(wave.toString('ascii', 8, 12), 'WAVE');
  assert.equal(wave.readUInt16LE(20), 1, `PCM 포맷 오류: ${renderedTrack.src}`);
  assert.equal(wave.readUInt16LE(22), 2, `스테레오 채널 오류: ${renderedTrack.src}`);
  assert.equal(wave.readUInt32LE(24), 22_050, `샘플레이트 오류: ${renderedTrack.src}`);
  assert.equal(wave.readUInt32LE(28), 22_050 * 4, `바이트레이트 오류: ${renderedTrack.src}`);
  assert.equal(wave.readUInt16LE(32), 4, `블록 정렬 오류: ${renderedTrack.src}`);
  assert.equal(wave.readUInt16LE(34), 16, `비트 심도 오류: ${renderedTrack.src}`);
  const dataBytes = wave.readUInt32LE(40);
  const frameCount = dataBytes / 4;
  const durationSeconds = frameCount / 22_050;
  assert.equal(wave.length, dataBytes + 44, `WAV 길이 오류: ${renderedTrack.src}`);
  assert.equal(durationSeconds >= 65 && durationSeconds <= 95, true, `게임 루프 길이 오류: ${renderedTrack.src}`);

  let sumSquares = 0;
  let stereoDifferenceSquares = 0;
  let peak = 0;
  let clippedSamples = 0;
  for (let frame = 0; frame < frameCount; frame += 1) {
    const left = wave.readInt16LE(44 + frame * 4) / 32_768;
    const right = wave.readInt16LE(46 + frame * 4) / 32_768;
    sumSquares += left * left + right * right;
    stereoDifferenceSquares += (left - right) ** 2;
    peak = Math.max(peak, Math.abs(left), Math.abs(right));
    if (Math.abs(left) >= 0.995) clippedSamples += 1;
    if (Math.abs(right) >= 0.995) clippedSamples += 1;
  }
  const rms = Math.sqrt(sumSquares / (frameCount * 2));
  const stereoDifference = Math.sqrt(stereoDifferenceSquares / frameCount);
  assert.equal(rms >= 0.025 && rms <= 0.32, true, `평균 음압 오류: ${renderedTrack.src}`);
  assert.equal(stereoDifference >= 0.008, true, `좌우 공간 배치가 부족합니다: ${renderedTrack.src}`);
  assert.equal(peak >= 0.82 && peak <= 0.92, true, `마스터 피크 오류: ${renderedTrack.src}`);
  assert.equal(clippedSamples / (frameCount * 2) < 0.0001, true, `디지털 클리핑 감지: ${renderedTrack.src}`);
  totalBytes += wave.length;
}

assert.equal(totalBytes >= 43_000_000 && totalBytes <= 58_000_000, true, 'BA SRPG 렌더 음원 용량이 예상 범위를 벗어났습니다.');
for (const instrument of [
  'vibraphone', 'bell', 'violin', 'viola', 'cello', 'flute', 'oboe', 'bassoon', 'horn',
  'trumpet', 'trombone', 'harp', 'celesta', 'choir', 'timpani', 'taiko',
]) {
  assert.equal(soundtrackInstruments.has(instrument), true, `전체 편성 악기 누락: ${instrument}`);
}
for (const instrument of [
  'vibraphone', 'bell', 'violin', 'viola', 'cello', 'flute', 'oboe', 'bassoon', 'horn',
  'trumpet', 'trombone', 'harp', 'celesta', 'timpani', 'orchestral-snare', 'cymbal', 'tom',
]) {
  assert.equal(sampledInstruments.has(instrument), true, `실제 연주 샘플 편성 누락: ${instrument}`);
}
assert.equal(sampledSourceFiles.size >= 27, true, '전체 OST에서 실제 원본 샘플 종류가 부족합니다.');
assert.equal(sampledEvents >= 800, true, '전체 OST에서 실제 연주 샘플 이벤트가 부족합니다.');
assert.match(rendererSource, /theme: 'srpg-command'[\s\S]*counter: 'celesta'/, '작전실 장면에 셀레스타가 필요합니다.');
assert.match(rendererSource, /theme: 'srpg-deployment'[\s\S]*counter: 'bell'/, '출정 장면에 벨 편성이 필요합니다.');
assert.match(rendererSource, /theme: 'srpg-town'[\s\S]*lead: 'vibraphone'/, '거점 장면에 비브라폰이 필요합니다.');
assert.match(rendererSource, /theme: 'srpg-battle'[\s\S]*woodwind: 'bassoon'/, '전투 장면에 바순 편성이 필요합니다.');
assert.match(rendererSource, /theme: 'srpg-crisis'[\s\S]*pad: 'choir'/, '위기 장면에 합창이 필요합니다.');
assert.match(rendererSource, /percussion: 'hybrid-orchestra'/, '전투 장면에 하이브리드 오케스트라 타악기가 필요합니다.');
assert.match(rendererSource, /sampled-orchestra-v3-vsco2-ce/, '샘플 오케스트라 렌더러 식별자가 필요합니다.');
assert.match(rendererSource, /channels: 2/, '스테레오 렌더링 설정이 필요합니다.');

console.log(JSON.stringify({
  renderedTracks: manifest.tracks.length,
  durationSeconds: manifest.tracks.map((track) => track.durationSeconds),
  totalMiB: Number((totalBytes / 1_048_576).toFixed(2)),
  instrumentCount: soundtrackInstruments.size,
  sampledInstrumentCount: sampledInstruments.size,
  sampledSourceFiles: sampledSourceFiles.size,
  sampledEvents,
  renderer: manifest.renderer,
}, null, 2));
