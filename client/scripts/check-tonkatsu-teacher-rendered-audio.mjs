import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  GAME_BGM_RENDERED_TRACKS,
  gameBgmRenderedTrack,
} from '../src/app/games/_lib/gameBgmRenderedTracks.js';
import {
  TONKATSU_TEACHER_SOUNDTRACK,
} from '../src/app/games/tonkatsu-teacher/_lib/tonkatsuTeacherSoundtrack.js';

const clientRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const publicRoot = path.join(clientRoot, 'public');
const rendererSource = await readFile(
  path.join(clientRoot, 'scripts', 'render-tonkatsu-teacher-instrumental.mjs'),
  'utf8',
);
const manifest = JSON.parse(await readFile(
  path.join(publicRoot, 'audio', 'tonkatsu-teacher', 'manifest.json'),
  'utf8',
));

assert.equal(manifest.renderer, 'physical-model-v2-orchestra');
assert.equal(manifest.tracks.length, 8, '돈가스 선생 렌더 트랙은 8곡이어야 합니다.');
assert.equal(
  Object.keys(GAME_BGM_RENDERED_TRACKS).filter((theme) => theme.startsWith('tonkatsu-')).length,
  8,
  '돈가스 선생 런타임 렌더 트랙 매핑은 8곡이어야 합니다.',
);
assert.equal(new Set(manifest.tracks.map((track) => track.file)).size, 8);

let totalBytes = 0;
const soundtrackInstruments = new Set();
for (const soundtrackRow of TONKATSU_TEACHER_SOUNDTRACK) {
  const renderedTrack = gameBgmRenderedTrack(soundtrackRow.theme);
  const manifestTrack = manifest.tracks.find((track) => track.theme === soundtrackRow.theme);
  assert.ok(renderedTrack, `렌더 트랙 매핑 누락: ${soundtrackRow.theme}`);
  assert.ok(manifestTrack, `렌더 manifest 누락: ${soundtrackRow.theme}`);
  assert.equal(renderedTrack.renderer, 'physical-model-v2-orchestra');
  assert.equal(renderedTrack.loop, true);
  assert.equal(renderedTrack.loopStartSeconds, 0.85);
  assert.match(renderedTrack.src, /^\/audio\/tonkatsu-teacher\/[a-z-]+\.wav$/);
  assert.equal(manifestTrack.channels, 2, `스테레오 manifest 오류: ${soundtrackRow.theme}`);
  assert.equal(manifestTrack.sampleRate, 22_050, `샘플레이트 오류: ${soundtrackRow.theme}`);
  assert.equal(manifestTrack.instruments.length >= 15, true, `장면 오케스트라 편성이 부족합니다: ${soundtrackRow.theme}`);
  for (const instrument of manifestTrack.instruments) soundtrackInstruments.add(instrument);

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

assert.equal(totalBytes >= 50_000_000 && totalBytes <= 65_000_000, true, '돈가스 선생 렌더 음원 용량이 예상 범위를 벗어났습니다.');
for (const instrument of [
  'piano', 'guitar', 'violin', 'viola', 'cello', 'flute', 'oboe', 'clarinet', 'horn',
  'trumpet', 'trombone', 'harp', 'celesta', 'choir', 'timpani', 'taiko',
]) {
  assert.equal(soundtrackInstruments.has(instrument), true, `전체 편성 악기 누락: ${instrument}`);
}
assert.match(rendererSource, /theme: 'tonkatsu-kitchen'[\s\S]*lead: 'guitar'/, '주방 장면에 기타가 필요합니다.');
assert.match(rendererSource, /theme: 'tonkatsu-contest'[\s\S]*lead: 'trumpet'/, '대회 장면에 트럼펫이 필요합니다.');
assert.match(rendererSource, /theme: 'tonkatsu-judge'[\s\S]*lead: 'oboe'/, '심사 장면에 오보에가 필요합니다.');
assert.match(rendererSource, /percussion: 'hybrid-orchestra'/, '대회 장면에 하이브리드 오케스트라 타악기가 필요합니다.');
assert.match(rendererSource, /channels: 2/, '스테레오 렌더링 설정이 필요합니다.');

console.log(JSON.stringify({
  renderedTracks: manifest.tracks.length,
  durationSeconds: manifest.tracks.map((track) => track.durationSeconds),
  totalMiB: Number((totalBytes / 1_048_576).toFixed(2)),
  instrumentCount: soundtrackInstruments.size,
  renderer: manifest.renderer,
}, null, 2));
