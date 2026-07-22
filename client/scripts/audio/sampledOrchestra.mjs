import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { decodePcmWave } from './pcmWave.mjs';
import { VSCO2_CE_MINI_LIBRARY } from './vsco2CeMiniCatalog.mjs';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const SAMPLE_DIR = path.resolve(SCRIPT_DIR, '..', '..', 'audio-source', 'vsco2-ce-mini');
const TARGET_SAMPLE_RATE = VSCO2_CE_MINI_LIBRARY.sampleRate;
const decodedCache = new Map();
const renderedCache = new Map();
let usageEvents = 0;
const usageByInstrument = new Map();
const usageByFile = new Map();

const sustain = (...rows) => Object.freeze(rows.map(([file, rootMidi]) => Object.freeze({ file, rootMidi, loop: true })));
const short = (...rows) => Object.freeze(rows.map(([file, rootMidi]) => Object.freeze({ file, rootMidi, loop: false })));

const TONAL_SAMPLES = Object.freeze({
  strings: sustain(
    ['LLVln_ArcoVib_A3_mf.wav', 57],
    ['LLVln_ArcoVib_A4_mf.wav', 69],
    ['CelloEns_susvib_C3_v1_1.wav', 48],
  ),
  violin: sustain(
    ['LLVln_ArcoVib_A3_mf.wav', 57],
    ['LLVln_ArcoVib_A4_mf.wav', 69],
    ['LLVln_ArcoVib_A5_mf.wav', 81],
  ),
  viola: sustain(
    ['LLVln_ArcoVib_A3_mf.wav', 57],
    ['LLVln_ArcoVib_A4_mf.wav', 69],
  ),
  cello: Object.freeze([
    ...sustain(['CelloEns_susvib_C1_v1_1.wav', 24], ['CelloEns_susvib_C3_v1_1.wav', 48]),
    ...short(['CelloEns_spic_C1_v2_5.wav', 24], ['CelloEns_spic_C3_v2_4.wav', 48]),
  ]),
  bass: sustain(
    ['CelloEns_susvib_C1_v1_1.wav', 24],
    ['Tuba2_sus_A#0_v3_1.wav', 22],
    ['Tuba2_sus_A#1_v3_1.wav', 34],
  ),
  flute: sustain(
    ['LDFlute_expvib_A3_v1_1.wav', 57],
    ['LDFlute_expvib_D4_v1_1.wav', 62],
    ['LDFlute_expvib_A4_v1_1.wav', 69],
    ['piccolo_C5_sustain1.wav', 72],
    ['piccolo_C6_sustain1.wav', 84],
  ),
  oboe: Object.freeze([
    ...sustain(['KHOboe_vib_Ab4_ff1.wav', 68], ['KHOboe_vib_D5_ff1.wav', 74], ['KHOboe_vib_Ab5_ff1.wav', 80]),
    ...short(['KHOboe_stac_Bb3_ff2.wav', 58], ['KHOboe_stac_D4_ff2.wav', 62], ['KHOboe_stac_Ab4_ff2.wav', 68]),
  ]),
  bassoon: sustain(['PSBassoon_A#0_v2_2.wav', 22], ['PSBassoon_A#1_v2_2.wav', 34]),
  horn: sustain(['Euph1_vib-solo_A#2_v1_1.wav', 46]),
  trumpet: sustain(['trumpet_loud_F5_1.wav', 77]),
  trombone: Object.freeze([
    ...sustain(['7TbnEns_Sus_Bb2_fff.wav', 46], ['7TbnEns_Sus_Bb3_fff.wav', 58]),
    ...short(['7TbnEns_Stac_Bb2_mf_2.wav', 46], ['7TbnEns_Stac_Bb2_ff_1.wav', 46]),
  ]),
  brass: sustain(['7TbnEns_Sus_Bb2_fff.wav', 46], ['7TbnEns_Sus_Bb3_fff.wav', 58]),
  harp: sustain(['KSHarp_A2_f1.wav', 45], ['KSHarp_A4_mf1.wav', 69]),
  bell: sustain(['TB_hit_A4_v4_1.wav', 69], ['TB_hit_F5_v2_2.wav', 77], ['glock_medium_C6_01.wav', 84]),
  celesta: sustain(['glock_medium_C6_01.wav', 84], ['TB_hit_A4_v4_1.wav', 69]),
  vibraphone: sustain(
    ['Marimba_hit_Outrigger_G2_loud_01.wav', 43],
    ['Marimba_hit_Outrigger_C4_loud_01.wav', 60],
    ['Xylo_Medium_G4_ff_01_far.wav', 67],
  ),
});

const PERCUSSION_SAMPLES = Object.freeze({
  snare: Object.freeze(['snare3_f_1.wav', 'snareNew_hit_fff1.wav']),
  'orchestral-snare': Object.freeze(['snareNew_hit_fff1.wav', 'snare3_f_1.wav']),
  cymbal: Object.freeze(['cymbal_crash1_ff3.wav', 'cymbal_crash2_fff1.wav']),
  timpani: Object.freeze(['timpani_2_hit_ff2.wav', 'timpani_3_hit_fff4.wav']),
  taiko: Object.freeze(['timpani_3_hit_fff4.wav', 'timpani_2_hit_ff2.wav']),
  tom: Object.freeze(['timpani_2_hit_ff2.wav', 'timpani_3_hit_fff4.wav']),
});

const INSTRUMENT_RMS = Object.freeze({
  strings: 0.15,
  violin: 0.16,
  viola: 0.16,
  cello: 0.17,
  bass: 0.18,
  flute: 0.15,
  oboe: 0.16,
  bassoon: 0.17,
  horn: 0.19,
  trumpet: 0.2,
  trombone: 0.2,
  brass: 0.2,
  harp: 0.15,
  bell: 0.17,
  celesta: 0.16,
  vibraphone: 0.17,
});

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, Number(value || 0)));
}

function frequencyToMidi(frequency) {
  return 69 + 12 * Math.log2(Math.max(1, frequency) / 440);
}

function sampleFrameCount(sample) {
  return sample.left.length;
}

function sampleAt(channel, position) {
  const index = Math.floor(position);
  const nextIndex = Math.min(channel.length - 1, index + 1);
  const fraction = position - index;
  return channel[index] + (channel[nextIndex] - channel[index]) * fraction;
}

function readSample(file) {
  if (decodedCache.has(file)) return decodedCache.get(file);
  const filePath = path.join(SAMPLE_DIR, file);
  if (!existsSync(filePath)) return null;
  const decoded = decodePcmWave(readFileSync(filePath));
  if (decoded.sampleRate !== TARGET_SAMPLE_RATE) {
    throw new Error(`Prepared sample has the wrong sample rate: ${file}`);
  }
  decodedCache.set(file, decoded);
  return decoded;
}

function recordUsage(kind, file) {
  usageEvents += 1;
  usageByInstrument.set(kind, (usageByInstrument.get(kind) || 0) + 1);
  usageByFile.set(file, (usageByFile.get(file) || 0) + 1);
}

function sampleRms(sample) {
  let sum = 0;
  const stride = Math.max(1, Math.floor(sampleFrameCount(sample) / 18_000));
  let count = 0;
  for (let frame = 0; frame < sampleFrameCount(sample); frame += stride) {
    sum += sample.left[frame] ** 2 + sample.right[frame] ** 2;
    count += 2;
  }
  return Math.sqrt(sum / Math.max(1, count));
}

function renderPitchedSample(sample, {
  pitchRatio = 1,
  durationSeconds,
  loop = false,
  targetRms = 0.17,
  releaseSeconds = 0.16,
} = {}) {
  const sourceFrames = sampleFrameCount(sample);
  const outputFrames = Math.max(1, Math.ceil(durationSeconds * TARGET_SAMPLE_RATE));
  const left = new Float32Array(outputFrames);
  const right = new Float32Array(outputFrames);
  const loopStart = Math.floor(sourceFrames * 0.32);
  const loopEnd = Math.max(loopStart + 32, Math.floor(sourceFrames * 0.86));
  const loopLength = loopEnd - loopStart;
  const crossfadeFrames = Math.min(Math.round(TARGET_SAMPLE_RATE * 0.085), Math.floor(loopLength * 0.16));
  const sourceRms = sampleRms(sample);
  const peakGuard = sourceRms > 0 ? clamp(targetRms / sourceRms, 0.42, 3.2) : 1;

  const readLooped = (channel, rawPosition) => {
    if (!loop || rawPosition < loopEnd) {
      return rawPosition < sourceFrames - 1 ? sampleAt(channel, rawPosition) : 0;
    }
    const cycle = (rawPosition - loopStart) % loopLength;
    const position = loopStart + cycle;
    if (crossfadeFrames > 0 && cycle >= loopLength - crossfadeFrames) {
      const ratio = (cycle - (loopLength - crossfadeFrames)) / crossfadeFrames;
      const wrappedPosition = loopStart + cycle - (loopLength - crossfadeFrames);
      return sampleAt(channel, position) * (1 - ratio) + sampleAt(channel, wrappedPosition) * ratio;
    }
    return sampleAt(channel, position);
  };

  const attackFrames = Math.min(outputFrames, Math.round(TARGET_SAMPLE_RATE * 0.018));
  const releaseFrames = Math.min(outputFrames, Math.round(TARGET_SAMPLE_RATE * releaseSeconds));
  for (let frame = 0; frame < outputFrames; frame += 1) {
    const position = frame * pitchRatio;
    let envelope = 1;
    if (frame < attackFrames) envelope *= frame / Math.max(1, attackFrames - 1);
    if (frame >= outputFrames - releaseFrames) {
      envelope *= (outputFrames - frame - 1) / Math.max(1, releaseFrames - 1);
    }
    left[frame] = readLooped(sample.left, position) * peakGuard * envelope;
    right[frame] = readLooped(sample.right, position) * peakGuard * envelope;
  }
  return { channels: 2, left, right };
}

function nearestCandidate(candidates, targetMidi, durationSeconds, variant) {
  const wantsShort = durationSeconds <= 0.72;
  const preferred = candidates.filter((candidate) => candidate.loop !== wantsShort);
  const pool = preferred.length > 0 ? preferred : candidates;
  return [...pool].sort((left, right) => {
    const leftDistance = Math.abs(left.rootMidi - targetMidi);
    const rightDistance = Math.abs(right.rootMidi - targetMidi);
    if (leftDistance !== rightDistance) return leftDistance - rightDistance;
    return ((left.rootMidi + variant) % 5) - ((right.rootMidi + variant) % 5);
  })[0];
}

export function sampledOrchestraSupportsInstrument(kind) {
  return Boolean(TONAL_SAMPLES[kind] || PERCUSSION_SAMPLES[kind]);
}

export function sampledOrchestraTone(kind, frequency, durationSeconds, variant = 0) {
  const candidates = TONAL_SAMPLES[kind];
  if (!candidates) return null;
  const targetMidi = frequencyToMidi(frequency);
  const candidate = nearestCandidate(candidates, targetMidi, durationSeconds, variant);
  const key = `tone:${kind}:${candidate.file}:${Math.round(targetMidi * 10)}:${Math.round(durationSeconds * 20)}`;
  if (renderedCache.has(key)) return renderedCache.get(key);
  const source = readSample(candidate.file);
  if (!source) return null;
  recordUsage(kind, candidate.file);
  const rendered = renderPitchedSample(source, {
    pitchRatio: 2 ** ((targetMidi - candidate.rootMidi) / 12),
    durationSeconds,
    loop: candidate.loop && durationSeconds > 0.72,
    targetRms: INSTRUMENT_RMS[kind] || 0.17,
    releaseSeconds: candidate.loop ? 0.22 : 0.1,
  });
  renderedCache.set(key, rendered);
  return rendered;
}

export function sampledOrchestraPercussion(kind, variant = 0) {
  const candidates = PERCUSSION_SAMPLES[kind];
  if (!candidates) return null;
  const file = candidates[Math.abs(Math.trunc(variant)) % candidates.length];
  const key = `percussion:${kind}:${file}`;
  if (renderedCache.has(key)) return renderedCache.get(key);
  const source = readSample(file);
  if (!source) return null;
  recordUsage(kind, file);
  const pitchRatio = kind === 'taiko' ? 0.72 : kind === 'tom' ? 1.08 : 1;
  const durationSeconds = Math.min(5.5, source.left.length / TARGET_SAMPLE_RATE / pitchRatio);
  const rendered = renderPitchedSample(source, {
    pitchRatio,
    durationSeconds,
    loop: false,
    targetRms: kind === 'cymbal' ? 0.1 : kind === 'timpani' || kind === 'taiko' ? 0.19 : 0.17,
    releaseSeconds: Math.min(0.22, durationSeconds * 0.16),
  });
  renderedCache.set(key, rendered);
  return rendered;
}

export function sampledOrchestraMetadata() {
  return {
    ...VSCO2_CE_MINI_LIBRARY,
    sampleDirectory: path.relative(path.resolve(SCRIPT_DIR, '..', '..'), SAMPLE_DIR).replaceAll('\\', '/'),
    sampledTonalInstruments: Object.keys(TONAL_SAMPLES),
    sampledPercussion: Object.keys(PERCUSSION_SAMPLES),
  };
}

export function clearSampledOrchestraRenderCache() {
  renderedCache.clear();
}

export function resetSampledOrchestraUsage() {
  usageEvents = 0;
  usageByInstrument.clear();
  usageByFile.clear();
}

export function sampledOrchestraUsageSnapshot() {
  return {
    events: usageEvents,
    instruments: Object.fromEntries([...usageByInstrument.entries()].sort(([left], [right]) => left.localeCompare(right))),
    files: Object.fromEntries([...usageByFile.entries()].sort(([left], [right]) => left.localeCompare(right))),
  };
}
