import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  GAME_BGM_RENDERED_TRACKS,
  gameBgmRenderedTrack,
} from '../src/app/games/_lib/gameBgmRenderedTracks.js';
import {
  SCHALE_IDLE_SOUNDTRACK,
} from '../src/app/games/schale-idle-rpg/_lib/schaleIdleSoundtrack.js';

const clientRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const publicRoot = path.join(clientRoot, 'public');
const rendererSource = await readFile(
  path.join(clientRoot, 'scripts', 'render-schale-idle-instrumental.mjs'),
  'utf8',
);
const manifest = JSON.parse(await readFile(
  path.join(publicRoot, 'audio', 'schale-idle-rpg', 'manifest.json'),
  'utf8',
));

assert.equal(manifest.renderer, 'physical-model-v2-orchestra');
assert.equal(manifest.tracks.length, 7, '샬레 방치형 RPG 렌더 트랙은 7곡이어야 합니다.');
assert.equal(
  Object.keys(GAME_BGM_RENDERED_TRACKS).filter((theme) => theme.startsWith('idle-')).length,
  7,
  '샬레 방치형 RPG 렌더 트랙 매핑은 7곡이어야 합니다.',
);
assert.equal(new Set(manifest.tracks.map((track) => track.file)).size, 7);

let totalBytes = 0;
const soundtrackInstruments = new Set();
for (const soundtrackRow of SCHALE_IDLE_SOUNDTRACK) {
  const renderedTrack = gameBgmRenderedTrack(soundtrackRow.theme);
  const manifestTrack = manifest.tracks.find((track) => track.theme === soundtrackRow.theme);
  assert.ok(renderedTrack, `렌더 트랙 매핑 누락: ${soundtrackRow.theme}`);
  assert.ok(manifestTrack, `렌더 manifest 누락: ${soundtrackRow.theme}`);
  assert.equal(renderedTrack.renderer, 'physical-model-v2-orchestra');
  assert.equal(renderedTrack.loop, true);
  assert.equal(renderedTrack.loopStartSeconds, 0.85);
  assert.match(renderedTrack.src, /^\/audio\/schale-idle-rpg\/[a-z-]+\.wav$/);
  assert.equal(manifestTrack.channels, 2, `스테레오 manifest 오류: ${soundtrackRow.theme}`);
  assert.equal(manifestTrack.sampleRate, 22_050, `샘플레이트 오류: ${soundtrackRow.theme}`);
  assert.equal(
    manifestTrack.instruments.length >= 15,
    true,
    `장면 오케스트라 편성이 부족합니다: ${soundtrackRow.theme}`,
  );
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
  assert.equal(
    durationSeconds >= 70 && durationSeconds <= 100,
    true,
    `게임 루프 길이 오류: ${renderedTrack.src}`,
  );

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
  assert.equal(rms >= 0.025 && rms <= 0.32, true, `평균 음량 오류: ${renderedTrack.src}`);
  assert.equal(
    stereoDifference >= 0.008,
    true,
    `좌우 공간 배치가 부족합니다: ${renderedTrack.src}`,
  );
  assert.equal(peak >= 0.82 && peak <= 0.92, true, `마스터 피크 오류: ${renderedTrack.src}`);
  assert.equal(
    clippedSamples / (frameCount * 2) < 0.0001,
    true,
    `디지털 클리핑 감지: ${renderedTrack.src}`,
  );
  totalBytes += wave.length;
}

assert.equal(
  totalBytes >= 45_000_000 && totalBytes <= 60_000_000,
  true,
  '샬레 방치형 RPG 렌더 음원 용량이 예상 범위를 벗어났습니다.',
);
for (const instrument of [
  'piano', 'guitar', 'violin', 'viola', 'cello', 'flute', 'oboe', 'clarinet', 'horn',
  'trumpet', 'trombone', 'harp', 'celesta', 'choir', 'timpani', 'taiko',
]) {
  assert.equal(soundtrackInstruments.has(instrument), true, `전체 편성 악기 누락: ${instrument}`);
}
assert.match(
  rendererSource,
  /theme: 'idle-workshop'[\s\S]*lead: 'celesta'[\s\S]*counter: 'guitar'/,
  '공방 장면에는 첼레스타와 기타 편성이 필요합니다.',
);
assert.match(
  rendererSource,
  /theme: 'idle-tower'[\s\S]*lead: 'trumpet'[\s\S]*pad: 'choir'/,
  '시련의 탑 장면에는 트럼펫과 합창 편성이 필요합니다.',
);
assert.match(
  rendererSource,
  /theme: 'idle-reward'[\s\S]*lead: 'celesta'/,
  '보상 장면에는 첼레스타 주선율이 필요합니다.',
);
assert.match(rendererSource, /percussion: 'hybrid-orchestra'/, '전투 장면에는 하이브리드 타악기가 필요합니다.');
assert.match(rendererSource, /channels: 2/, '스테레오 렌더링 설정이 필요합니다.');

console.log(JSON.stringify({
  renderedTracks: manifest.tracks.length,
  durationSeconds: manifest.tracks.map((track) => track.durationSeconds),
  totalMiB: Number((totalBytes / 1_048_576).toFixed(2)),
  instrumentCount: soundtrackInstruments.size,
  renderer: manifest.renderer,
}, null, 2));
