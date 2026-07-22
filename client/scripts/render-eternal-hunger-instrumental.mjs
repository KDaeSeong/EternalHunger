import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  gameBgmArrangementState,
  gameBgmChordRoot,
  gameBgmChordVoicing,
  gameBgmNoteFrequency,
  gameBgmProfile,
  gameBgmStepDuration,
} from '../src/app/games/_lib/gameBgmProfiles.js';
import {
  clearSampledOrchestraRenderCache,
  resetSampledOrchestraUsage,
  sampledOrchestraMetadata,
  sampledOrchestraPercussion,
  sampledOrchestraSupportsInstrument,
  sampledOrchestraTone,
  sampledOrchestraUsageSnapshot,
} from './audio/sampledOrchestra.mjs';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = path.resolve(SCRIPT_DIR, '..', 'public', 'audio', 'eternal-hunger');
const SAMPLE_RATE = 22_050;
const TABLE_SIZE = 8_192;
const TWO_PI = Math.PI * 2;
const SINE_TABLE = Float32Array.from(
  { length: TABLE_SIZE },
  (_, index) => Math.sin((index / TABLE_SIZE) * TWO_PI),
);

async function writeFileWithRetry(filePath, data, encoding) {
  const retryableCodes = new Set(['EBUSY', 'EPERM', 'EACCES', 'UNKNOWN']);
  let lastError = null;
  for (let attempt = 0; attempt < 8; attempt += 1) {
    try {
      await writeFile(filePath, data, encoding);
      return;
    } catch (error) {
      lastError = error;
      if (!retryableCodes.has(error?.code) || attempt === 7) throw error;
      await new Promise((resolve) => setTimeout(resolve, 120 * (attempt + 1)));
    }
  }
  throw lastError;
}

export const ETERNAL_HUNGER_RENDER_TRACKS = Object.freeze([
  {
    theme: 'eternal-ready', file: 'ready', title: '출전 대기', bars: 36,
    lead: 'piano', counter: 'clarinet', pad: 'strings', highStrings: 'violin', midStrings: 'viola',
    lowStrings: 'cello', woodwind: 'clarinet', brassSection: 'horn', lowBrass: 'trombone', harp: 'harp',
    percussion: 'orchestral', drumScale: 0.54, room: 0.25,
  },
  {
    theme: 'eternal-day', file: 'day', title: '루미아의 낮', bars: 40,
    lead: 'violin', counter: 'piano', pad: 'strings', highStrings: 'violin', midStrings: 'viola',
    lowStrings: 'cello', woodwind: 'flute', brassSection: 'horn', lowBrass: 'trombone', harp: 'harp',
    percussion: 'orchestral', drumScale: 0.82, room: 0.2,
  },
  {
    theme: 'eternal-night', file: 'night', title: '금지구역 경보', bars: 40,
    lead: 'viola', counter: 'horn', pad: 'choir', highStrings: 'violin', midStrings: 'viola',
    lowStrings: 'cello', woodwind: 'oboe', brassSection: 'horn', lowBrass: 'trombone', harp: 'harp',
    percussion: 'orchestral', drumScale: 1, room: 0.24,
  },
  {
    theme: 'eternal-combat', file: 'combat', title: '교전 개시', bars: 44,
    lead: 'violin', counter: 'trumpet', pad: 'strings', highStrings: 'violin', midStrings: 'viola',
    lowStrings: 'cello', woodwind: 'clarinet', brassSection: 'trumpet', lowBrass: 'trombone', harp: 'harp',
    percussion: 'hybrid-orchestra', drumScale: 1.18, room: 0.16,
  },
  {
    theme: 'eternal-rift', file: 'rift', title: '차원의 틈', bars: 44,
    lead: 'celesta', counter: 'harp', pad: 'choir', highStrings: 'violin', midStrings: 'viola',
    lowStrings: 'cello', woodwind: 'flute', brassSection: 'horn', lowBrass: 'trombone', harp: 'harp',
    percussion: 'hybrid-orchestra', drumScale: 1.02, room: 0.3,
  },
  {
    theme: 'eternal-boss', file: 'boss', title: '변이체 강림', bars: 48,
    lead: 'horn', counter: 'trumpet', pad: 'choir', highStrings: 'violin', midStrings: 'viola',
    lowStrings: 'cello', woodwind: 'oboe', brassSection: 'trumpet', lowBrass: 'trombone', harp: 'harp',
    percussion: 'hybrid-orchestra', drumScale: 1.24, room: 0.2,
  },
  {
    theme: 'eternal-final', file: 'final', title: '마지막 안전지대', bars: 48,
    lead: 'violin', counter: 'horn', pad: 'strings', highStrings: 'violin', midStrings: 'viola',
    lowStrings: 'cello', woodwind: 'flute', brassSection: 'trumpet', lowBrass: 'trombone', harp: 'harp',
    percussion: 'hybrid-orchestra', drumScale: 1.22, room: 0.19,
  },
  {
    theme: 'eternal-result', file: 'result', title: '생존 기록', bars: 32,
    lead: 'piano', counter: 'clarinet', pad: 'strings', highStrings: 'violin', midStrings: 'viola',
    lowStrings: 'cello', woodwind: 'flute', brassSection: 'horn', lowBrass: 'trombone', harp: 'harp',
    percussion: 'orchestral', drumScale: 0.3, room: 0.32,
  },
  {
    theme: 'eternal-defeat', file: 'defeat', title: '전멸 기록', bars: 32,
    lead: 'piano', counter: 'cello', pad: 'choir', highStrings: 'violin', midStrings: 'viola',
    lowStrings: 'cello', woodwind: 'bassoon', brassSection: 'horn', lowBrass: 'trombone', harp: 'harp',
    percussion: 'orchestral', drumScale: 0.2, room: 0.35,
  },
]);

const sampleCache = new Map();

const ADDITIVE_INSTRUMENTS = Object.freeze({
  piano: Object.freeze({ partials: [[1, 1], [2.004, 0.56], [3.012, 0.31], [4.025, 0.17], [5.04, 0.09], [6.07, 0.045]], attack: 0.006, attackRatio: 1, release: 0.42, releaseRatio: 0.35, decay: 1.25, level: 0.62, transient: 0.18, partialDecay: 0.32 }),
  strings: Object.freeze({ partials: [[1, 1], [2, 0.38], [3, 0.22], [4, 0.13], [5, 0.08], [6, 0.045]], attack: 0.18, attackRatio: 0.2, release: 0.45, releaseRatio: 0.3, decay: 0.08, level: 0.54, vibrato: 0.0028, bowNoise: 0.009 }),
  violin: Object.freeze({ partials: [[1, 1], [2, 0.64], [3, 0.46], [4, 0.32], [5, 0.22], [6, 0.14], [7, 0.08]], attack: 0.095, attackRatio: 0.18, release: 0.38, releaseRatio: 0.3, decay: 0.055, level: 0.43, vibrato: 0.0038, vibratoRate: 5.25, bowNoise: 0.014 }),
  viola: Object.freeze({ partials: [[1, 1], [2, 0.5], [3, 0.34], [4, 0.22], [5, 0.13], [6, 0.07]], attack: 0.12, attackRatio: 0.2, release: 0.44, releaseRatio: 0.32, decay: 0.045, level: 0.5, vibrato: 0.0033, vibratoRate: 4.85, bowNoise: 0.012 }),
  cello: Object.freeze({ partials: [[1, 1], [2, 0.43], [3, 0.29], [4, 0.18], [5, 0.1], [6, 0.05]], attack: 0.14, attackRatio: 0.22, release: 0.52, releaseRatio: 0.36, decay: 0.04, level: 0.58, vibrato: 0.003, vibratoRate: 4.35, bowNoise: 0.01 }),
  brass: Object.freeze({ partials: [[1, 1], [2, 0.62], [3, 0.42], [4, 0.26], [5, 0.16], [6, 0.1]], attack: 0.065, attackRatio: 0.16, release: 0.2, releaseRatio: 0.25, decay: 0.16, level: 0.5, saturation: 0.9 }),
  horn: Object.freeze({ partials: [[1, 1], [2, 0.4], [3, 0.32], [4, 0.17], [5, 0.12], [6, 0.06]], attack: 0.09, attackRatio: 0.2, release: 0.35, releaseRatio: 0.3, decay: 0.08, level: 0.56, saturation: 0.66, vibrato: 0.0014, vibratoRate: 4.6 }),
  trumpet: Object.freeze({ partials: [[1, 1], [2, 0.72], [3, 0.54], [4, 0.37], [5, 0.25], [6, 0.15], [7, 0.08]], attack: 0.035, attackRatio: 0.14, release: 0.22, releaseRatio: 0.24, decay: 0.12, level: 0.4, saturation: 1.05, vibrato: 0.0013, vibratoRate: 5.1 }),
  trombone: Object.freeze({ partials: [[1, 1], [2, 0.56], [3, 0.39], [4, 0.24], [5, 0.14], [6, 0.08]], attack: 0.065, attackRatio: 0.18, release: 0.3, releaseRatio: 0.28, decay: 0.1, level: 0.5, saturation: 0.82, vibrato: 0.0012, vibratoRate: 4.45 }),
  choir: Object.freeze({ partials: [[1, 1], [2, 0.26], [3, 0.38], [4, 0.12], [5, 0.24], [6, 0.08], [7, 0.12]], attack: 0.28, attackRatio: 0.24, release: 0.55, releaseRatio: 0.36, decay: 0.03, level: 0.5, vibrato: 0.0021, vibratoRate: 4.2, airNoise: 0.006 }),
  flute: Object.freeze({ partials: [[1, 1], [2, 0.18], [3, 0.08], [4, 0.035]], attack: 0.055, attackRatio: 0.18, release: 0.24, releaseRatio: 0.28, decay: 0.12, level: 0.58, vibrato: 0.0018, vibratoRate: 5.15, airNoise: 0.018 }),
  oboe: Object.freeze({ partials: [[1, 0.86], [2, 0.31], [3, 0.58], [4, 0.2], [5, 0.34], [6, 0.1], [7, 0.16]], attack: 0.045, attackRatio: 0.16, release: 0.24, releaseRatio: 0.26, decay: 0.1, level: 0.46, vibrato: 0.0016, vibratoRate: 4.9, airNoise: 0.012 }),
  clarinet: Object.freeze({ partials: [[1, 1], [2, 0.08], [3, 0.56], [4, 0.04], [5, 0.3], [6, 0.025], [7, 0.16]], attack: 0.05, attackRatio: 0.17, release: 0.28, releaseRatio: 0.28, decay: 0.08, level: 0.52, vibrato: 0.0012, vibratoRate: 4.7, airNoise: 0.008 }),
  bassoon: Object.freeze({ partials: [[1, 1], [2, 0.42], [3, 0.54], [4, 0.2], [5, 0.31], [6, 0.12], [7, 0.14]], attack: 0.075, attackRatio: 0.2, release: 0.34, releaseRatio: 0.3, decay: 0.075, level: 0.56, vibrato: 0.0011, vibratoRate: 4.25, airNoise: 0.009 }),
  bell: Object.freeze({ partials: [[1, 1], [2.01, 0.52], [2.98, 0.34], [4.13, 0.22], [5.42, 0.14], [6.79, 0.07]], attack: 0.003, attackRatio: 1, release: 0.48, releaseRatio: 0.42, decay: 1.05, level: 0.58, partialDecay: 0.32 }),
  celesta: Object.freeze({ partials: [[1, 1], [2.015, 0.46], [3.04, 0.27], [4.11, 0.14], [5.28, 0.08]], attack: 0.004, attackRatio: 1, release: 0.5, releaseRatio: 0.4, decay: 0.82, level: 0.56, transient: 0.08, partialDecay: 0.24 }),
  vibraphone: Object.freeze({ partials: [[1, 1], [2.01, 0.34], [3.93, 0.28], [6.12, 0.15], [8.18, 0.08]], attack: 0.004, attackRatio: 1, release: 0.78, releaseRatio: 0.46, decay: 0.68, level: 0.56, transient: 0.06, partialDecay: 0.18, vibrato: 0.0015, vibratoRate: 5.8 }),
});

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, Number(value || 0)));
}

function sine(cycles) {
  const normalized = cycles - Math.floor(cycles);
  return SINE_TABLE[Math.floor(normalized * TABLE_SIZE) % TABLE_SIZE];
}

function smoothstep(value) {
  const x = clamp(value, 0, 1);
  return x * x * (3 - 2 * x);
}

function seededRandom(seed) {
  let state = (Math.trunc(seed) || 1) >>> 0;
  return () => {
    state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0;
    return state / 0x1_0000_0000;
  };
}

function frequencyKey(frequency) {
  return Math.round(Number(frequency || 0) * 10) / 10;
}

function envelope(t, duration, attack, release, decay = 0) {
  const attackLevel = smoothstep(t / Math.max(0.002, attack));
  const releaseLevel = smoothstep((duration - t) / Math.max(0.005, release));
  const decayLevel = decay > 0 ? Math.exp(-t * decay) : 1;
  return attackLevel * releaseLevel * decayLevel;
}

function additiveSample(kind, frequency, duration, variant) {
  const frameCount = Math.max(1, Math.ceil(duration * SAMPLE_RATE));
  const samples = new Float32Array(frameCount);
  const random = seededRandom(variant * 9_973 + Math.round(frequency * 17));
  const preset = ADDITIVE_INSTRUMENTS[kind] || ADDITIVE_INSTRUMENTS.piano;
  const { partials } = preset;
  const attack = Math.min(preset.attack, duration * preset.attackRatio);
  const release = Math.min(preset.release, duration * preset.releaseRatio);

  const phases = partials.map(() => random());
  for (let index = 0; index < frameCount; index += 1) {
    const t = index / SAMPLE_RATE;
    const vibrato = preset.vibrato
      ? 1 + sine(t * ((preset.vibratoRate || 4.7) + variant * 0.08)) * preset.vibrato
      : 1;
    let value = 0;
    for (let partialIndex = 0; partialIndex < partials.length; partialIndex += 1) {
      const [ratio, level] = partials[partialIndex];
      const partialDecay = preset.partialDecay
        ? Math.exp(-t * partialIndex * preset.partialDecay)
        : 1;
      value += sine(t * frequency * ratio * vibrato + phases[partialIndex]) * level * partialDecay;
    }
    if (preset.transient && t < 0.018) {
      value += (random() * 2 - 1) * (1 - t / 0.018) * preset.transient;
    }
    if (preset.airNoise) value += (random() * 2 - 1) * preset.airNoise;
    if (preset.bowNoise) value += (random() * 2 - 1) * preset.bowNoise * (0.7 + 0.3 * sine(t * frequency));
    const env = envelope(t, duration, attack, release, preset.decay);
    const voiced = preset.saturation ? Math.tanh(value * preset.saturation) : value;
    samples[index] = voiced * env * preset.level;
  }
  return samples;
}

function pluckedSample(kind, frequency, duration, variant) {
  const frameCount = Math.max(1, Math.ceil(duration * SAMPLE_RATE));
  const delayLength = Math.max(2, Math.round(SAMPLE_RATE / Math.max(36, frequency)));
  const ring = new Float32Array(delayLength);
  const output = new Float32Array(frameCount);
  const random = seededRandom(variant * 7_919 + Math.round(frequency * 101));
  let previous = 0;
  for (let index = 0; index < ring.length; index += 1) {
    const noise = random() * 2 - 1;
    previous = previous * 0.42 + noise * 0.58;
    ring[index] = previous;
  }
  const damping = kind === 'guitar'
    ? 0.9962
    : kind === 'bass'
      ? 0.998
      : kind === 'harp'
        ? 0.9971
        : 0.9948;
  for (let index = 0; index < frameCount; index += 1) {
    const ringIndex = index % delayLength;
    const nextIndex = (ringIndex + 1) % delayLength;
    const next = (ring[ringIndex] + ring[nextIndex]) * 0.5 * damping;
    ring[ringIndex] = next;
    const t = index / SAMPLE_RATE;
    const env = envelope(
      t,
      duration,
      0.003,
      Math.min(kind === 'harp' ? 0.48 : 0.28, duration * 0.34),
      kind === 'bass' ? 0.34 : kind === 'harp' ? 0.42 : 0.58,
    );
    const body = next + sine(t * frequency) * (kind === 'bass' ? 0.34 : kind === 'harp' ? 0.14 : 0.08);
    const voiced = kind === 'guitar' ? Math.tanh(body * 1.9) : body;
    output[index] = voiced * env * (kind === 'harp' ? 0.62 : 0.72);
  }
  return output;
}

function tonalSample(kind, frequency, duration, variant = 0, useSampledOrchestra = false) {
  const safeKind = [
    'piano', 'strings', 'violin', 'viola', 'cello', 'brass', 'horn', 'trumpet', 'trombone',
    'choir', 'flute', 'oboe', 'clarinet', 'bassoon', 'bell', 'celesta', 'vibraphone',
    'harp', 'pluck', 'guitar', 'bass',
  ].includes(kind)
    ? kind
    : 'piano';
  const safeFrequency = clamp(frequencyKey(frequency), 28, 4_200);
  const safeDuration = clamp(Math.round(duration * 20) / 20, 0.08, 5.5);
  const safeVariant = Math.abs(Math.trunc(variant)) % 4;
  const key = `${useSampledOrchestra ? 'sampled' : 'synth'}:${safeKind}:${safeFrequency}:${safeDuration}:${safeVariant}`;
  if (!sampleCache.has(key)) {
    const sampled = useSampledOrchestra
      ? sampledOrchestraTone(safeKind, safeFrequency, safeDuration, safeVariant)
      : null;
    sampleCache.set(
      key,
      sampled || (
        ['harp', 'pluck', 'guitar', 'bass'].includes(safeKind)
          ? pluckedSample(safeKind, safeFrequency, safeDuration, safeVariant)
          : additiveSample(safeKind, safeFrequency, safeDuration, safeVariant)
      ),
    );
  }
  return sampleCache.get(key);
}

function percussionSample(kind, variant = 0, useSampledOrchestra = false) {
  const key = `${useSampledOrchestra ? 'sampled' : 'synth'}:drum:${kind}:${variant % 4}`;
  if (sampleCache.has(key)) return sampleCache.get(key);
  if (useSampledOrchestra) {
    const sampled = sampledOrchestraPercussion(kind, variant);
    if (sampled) {
      sampleCache.set(key, sampled);
      return sampled;
    }
  }
  const durations = {
    kick: 0.42,
    snare: 0.34,
    'orchestral-snare': 0.42,
    hat: 0.12,
    cymbal: 1.35,
    tom: 0.5,
    timpani: 1.15,
    taiko: 0.82,
    'rail-clank': 0.68,
    'engine-pulse': 0.56,
  };
  const duration = durations[kind] || 0.25;
  const frameCount = Math.ceil(duration * SAMPLE_RATE);
  const output = new Float32Array(frameCount);
  const random = seededRandom(41_003 + variant * 1_013 + kind.length * 97);
  let previousNoise = 0;
  for (let index = 0; index < frameCount; index += 1) {
    const t = index / SAMPLE_RATE;
    const noise = random() * 2 - 1;
    const highNoise = noise - previousNoise * 0.86;
    previousNoise = noise;
    if (kind === 'kick') {
      const frequency = 142 * Math.exp(-t * 19) + 43;
      output[index] = (sine(t * frequency) * 0.92 + noise * Math.exp(-t * 70) * 0.13) * Math.exp(-t * 9.2);
    } else if (kind === 'snare' || kind === 'orchestral-snare') {
      output[index] = (highNoise * 0.72 + sine(t * 184) * 0.28) * Math.exp(-t * 12.5);
    } else if (kind === 'hat') {
      output[index] = highNoise * Math.exp(-t * 36) * 0.62;
    } else if (kind === 'cymbal') {
      const metal = highNoise * 0.48 + sine(t * 3_731) * 0.13 + sine(t * 5_069) * 0.09;
      output[index] = metal * Math.exp(-t * 3.4);
    } else if (kind === 'engine-pulse') {
      const rev = sine(t * (68 + t * 110)) * 0.72
        + sine(t * (136 + t * 168)) * 0.2
        + noise * Math.exp(-t * 16) * 0.1;
      output[index] = Math.tanh(rev * 1.3) * Math.exp(-t * 5.2);
    } else if (kind === 'rail-clank') {
      const metal = sine(t * 661) * 0.46
        + sine(t * 947) * 0.34
        + sine(t * 1_487) * 0.22
        + sine(t * 2_093) * 0.1
        + highNoise * 0.2;
      output[index] = Math.tanh(metal * 1.35) * Math.exp(-t * 7.6);
    } else if (kind === 'timpani') {
      const frequency = 104 * Math.exp(-t * 2.8) + 43;
      output[index] = (sine(t * frequency) * 0.86 + sine(t * frequency * 1.48) * 0.16 + noise * 0.08) * Math.exp(-t * 3.4);
    } else if (kind === 'taiko') {
      const frequency = 118 * Math.exp(-t * 4.2) + 48;
      output[index] = Math.tanh((sine(t * frequency) * 0.88 + noise * 0.16) * 1.45) * Math.exp(-t * 5.2);
    } else {
      const frequency = 164 * Math.exp(-t * 4.5) + 58;
      output[index] = (sine(t * frequency) * 0.8 + noise * 0.12) * Math.exp(-t * 7.4);
    }
  }
  sampleCache.set(key, output);
  return output;
}

function createMixTarget(frameCount, channels) {
  if (channels === 2) {
    return {
      channels: 2,
      left: new Float32Array(frameCount),
      right: new Float32Array(frameCount),
    };
  }
  return new Float32Array(frameCount);
}

function targetFrameCount(target) {
  return target instanceof Float32Array ? target.length : target.left.length;
}

function sourceFrameCount(sample) {
  return sample instanceof Float32Array ? sample.length : sample.left.length;
}

function sourceChannelSample(sample, channel, index) {
  if (sample instanceof Float32Array) return sample[index];
  return channel === 0 ? sample.left[index] : sample.right[index];
}

function wrappedFrame(index, frameCount, wrap) {
  if (index < 0) return null;
  if (index < frameCount) return index;
  if (!wrap) return null;
  return index % frameCount;
}

function mixSample(target, sample, startSeconds, gain = 1, wrap = true, pan = 0, widthSeconds = 0) {
  const startFrame = Math.round(startSeconds * SAMPLE_RATE);
  const frameCount = targetFrameCount(target);
  const sourceFrames = sourceFrameCount(sample);
  if (target instanceof Float32Array) {
    for (let index = 0; index < sourceFrames; index += 1) {
      const targetIndex = wrappedFrame(startFrame + index, frameCount, wrap);
      if (targetIndex === null) {
        if (!wrap && startFrame + index >= frameCount) break;
        continue;
      }
      const sourceValue = sample instanceof Float32Array
        ? sample[index]
        : (sample.left[index] + sample.right[index]) * 0.5;
      target[targetIndex] += sourceValue * gain;
    }
    return;
  }

  const safePan = clamp(pan, -1, 1);
  const angle = ((safePan + 1) * Math.PI) / 4;
  const leftGain = Math.cos(angle) * gain;
  const rightGain = Math.sin(angle) * gain;
  const widthFrames = Math.round(clamp(widthSeconds, 0, 0.03) * SAMPLE_RATE);
  const leftDelay = safePan > 0 ? widthFrames : 0;
  const rightDelay = safePan <= 0 ? widthFrames : 0;
  for (let index = 0; index < sourceFrames; index += 1) {
    const leftIndex = wrappedFrame(startFrame + index + leftDelay, frameCount, wrap);
    const rightIndex = wrappedFrame(startFrame + index + rightDelay, frameCount, wrap);
    if (leftIndex !== null) target.left[leftIndex] += sourceChannelSample(sample, 0, index) * leftGain;
    if (rightIndex !== null) target.right[rightIndex] += sourceChannelSample(sample, 1, index) * rightGain;
    if (!wrap && startFrame + index >= frameCount) break;
  }
}

function patternForLead(profile, section, sectionBarIndex) {
  const key = Array.isArray(section.leadSequence) && section.leadSequence.length > 0
    ? section.leadSequence[sectionBarIndex % section.leadSequence.length]
    : section.lead;
  if (!key) return null;
  if (key === 'b') return profile.leadB;
  if (key === 'c') return profile.leadC;
  return profile.lead;
}

const INSTRUMENT_PAN = Object.freeze({
  piano: -0.08,
  strings: 0,
  violin: -0.5,
  viola: -0.22,
  cello: 0.28,
  bass: 0,
  harp: -0.62,
  flute: -0.34,
  oboe: -0.12,
  clarinet: 0.16,
  bassoon: 0.08,
  horn: 0.34,
  trumpet: 0.5,
  trombone: 0.22,
  choir: 0,
  bell: 0.42,
  celesta: 0.46,
  vibraphone: 0.32,
  pluck: -0.36,
  guitar: 0.4,
});

function instrumentPan(kind, fallback = 0) {
  return Number.isFinite(INSTRUMENT_PAN[kind]) ? INSTRUMENT_PAN[kind] : fallback;
}

function renderTrack(config, { channels = 1, orchestral = false, sampled = false } = {}) {
  const profile = gameBgmProfile(config.theme);
  const stepDuration = gameBgmStepDuration(profile);
  const totalSteps = config.bars * 16;
  const duration = totalSteps * stepDuration;
  const target = createMixTarget(Math.ceil(duration * SAMPLE_RATE), channels);
  const human = seededRandom(config.theme.length * 65_537);
  const orchestraLevel = clamp(profile.orchestraLevel || 0.9, 0.5, 1.2);
  const tone = (kind, frequency, duration, variant = 0) => tonalSample(
    kind,
    frequency,
    duration,
    variant,
    sampled,
  );
  const drum = (kind, variant = 0) => percussionSample(kind, variant, sampled);

  for (let absoluteStep = 0; absoluteStep < totalSteps; absoluteStep += 1) {
    const state = gameBgmArrangementState(profile, absoluteStep);
    const { section, patternStep } = state;
    const energy = clamp(Number(section.energy || 0.5), 0.18, 1.25);
    const swing = patternStep % 2 ? stepDuration * Number(profile.swing || 0) : 0;
    const jitter = (human() - 0.5) * Math.min(0.009, stepDuration * 0.08);
    const start = absoluteStep * stepDuration + swing + jitter;
    const variant = (absoluteStep + state.sectionIndex) % 4;
    const chordRoot = gameBgmChordRoot(profile, state);
    const keyShift = Number(section.keyShift || 0);

    if (patternStep === 0 && section.pad) {
      const chordDuration = stepDuration * 16 + 0.7;
      const voicing = gameBgmChordVoicing(profile, state).slice(0, 5);
      for (let noteIndex = 0; noteIndex < voicing.length; noteIndex += 1) {
        const frequency = gameBgmNoteFrequency(profile, chordRoot + voicing[noteIndex], profile.padOctave + 1);
        const padGain = (config.pad === 'choir' ? 0.034 : 0.029) * energy / Math.sqrt(voicing.length);
        const padPan = (noteIndex - (voicing.length - 1) / 2) * 0.14;
        mixSample(target, tone(config.pad, frequency, chordDuration, noteIndex), start, padGain, true, padPan, 0.009);
      }
    }

    if (orchestral && patternStep === 0) {
      const chordDuration = stepDuration * 16 + 0.8;
      const voicing = gameBgmChordVoicing(profile, state).slice(0, 4);
      const sectionStrings = Number(section.strings || 0);
      const stringPresence = clamp(Math.max(sectionStrings, section.pad ? 0.34 : 0), 0, 1.15);
      if (stringPresence > 0.08) {
        const stringGain = stringPresence * energy * orchestraLevel;
        for (let noteIndex = 0; noteIndex < Math.min(3, voicing.length); noteIndex += 1) {
          const degree = chordRoot + voicing[noteIndex];
          const highFrequency = gameBgmNoteFrequency(profile, degree, profile.padOctave + 2);
          const midFrequency = gameBgmNoteFrequency(profile, degree, profile.padOctave + 1);
          mixSample(
            target,
            tone(config.highStrings, highFrequency, chordDuration, noteIndex),
            start,
            0.017 * stringGain / Math.sqrt(voicing.length),
            true,
            instrumentPan(config.highStrings, -0.46) + noteIndex * 0.05,
            0.012,
          );
          mixSample(
            target,
            tone(config.midStrings, midFrequency, chordDuration, noteIndex + 1),
            start + 0.012,
            0.019 * stringGain / Math.sqrt(voicing.length),
            true,
            instrumentPan(config.midStrings, -0.18) + noteIndex * 0.04,
            0.01,
          );
        }
        const lowFrequency = gameBgmNoteFrequency(profile, chordRoot, profile.padOctave);
        mixSample(
          target,
          tone(config.lowStrings, lowFrequency, chordDuration, state.sectionBarIndex),
          start + 0.018,
          0.025 * stringGain,
          true,
          instrumentPan(config.lowStrings, 0.28),
          0.008,
        );
      }

      const brassPresence = clamp(
        Math.max(Number(section.brass || 0), energy > 0.86 ? (energy - 0.72) * 0.9 : 0),
        0,
        1.15,
      );
      if (brassPresence > 0.1) {
        const brassDuration = stepDuration * (energy > 0.95 ? 7.5 : 5.5);
        const rootFrequency = gameBgmNoteFrequency(profile, chordRoot, profile.padOctave + 1);
        const lowFrequency = gameBgmNoteFrequency(profile, chordRoot + 4, profile.padOctave);
        mixSample(
          target,
          tone(config.brassSection, rootFrequency, brassDuration, variant),
          start,
          0.027 * brassPresence * orchestraLevel * energy,
          true,
          instrumentPan(config.brassSection, 0.36),
          0.008,
        );
        mixSample(
          target,
          tone(config.lowBrass, lowFrequency, brassDuration * 1.08, variant + 1),
          start + 0.016,
          0.021 * brassPresence * orchestraLevel * energy,
          true,
          instrumentPan(config.lowBrass, 0.2),
          0.006,
        );
      }

      const choirPresence = clamp(Math.max(Number(section.choir || 0), config.pad === 'choir' ? 0.38 : 0), 0, 1.1);
      if (choirPresence > 0.08) {
        for (let noteIndex = 0; noteIndex < Math.min(3, voicing.length); noteIndex += 1) {
          const frequency = gameBgmNoteFrequency(profile, chordRoot + voicing[noteIndex], profile.padOctave + 1);
          mixSample(
            target,
            tone('choir', frequency, chordDuration, noteIndex),
            start + 0.024,
            0.014 * choirPresence * orchestraLevel * energy,
            true,
            (noteIndex - 1) * 0.24,
            0.014,
          );
        }
      }
    }

    const bassDegree = section.bass ? profile.bass[patternStep] : null;
    if (bassDegree !== null && bassDegree !== undefined) {
      const frequency = gameBgmNoteFrequency(profile, bassDegree + keyShift, profile.bassOctave);
      mixSample(target, tone('bass', frequency, stepDuration * 2.8, variant), start, 0.105 * energy, true, 0, 0.002);
    }

    const arpDegree = section.arp ? profile.arp[patternStep] : null;
    if (arpDegree !== null && arpDegree !== undefined) {
      const frequency = gameBgmNoteFrequency(profile, arpDegree + keyShift, profile.arpOctave);
      const arpPan = patternStep % 4 < 2 ? -0.36 : 0.34;
      mixSample(target, tone('pluck', frequency, stepDuration * 1.5, variant), start, 0.044 * energy, true, arpPan, 0.004);
      if (orchestral && config.harp) {
        const harpFrequency = gameBgmNoteFrequency(profile, arpDegree + keyShift, profile.arpOctave + 1);
        const harpPresence = clamp(Math.max(Number(section.pluck || 0), 0.32), 0.2, 1);
        mixSample(
          target,
          tone(config.harp, harpFrequency, stepDuration * 2.1, variant + 1),
          start + stepDuration * 0.025,
          0.017 * energy * harpPresence * orchestraLevel,
          true,
          instrumentPan(config.harp, -0.62) + (patternStep % 4) * 0.04,
          0.009,
        );
      }
    }

    const leadPattern = patternForLead(profile, section, state.sectionBarIndex);
    const leadDegree = leadPattern?.[patternStep];
    if (leadDegree !== null && leadDegree !== undefined) {
      const frequency = gameBgmNoteFrequency(profile, leadDegree + keyShift, profile.leadOctave + (config.lead === 'bell' ? 1 : 0));
      const accent = patternStep % 4 === 0 ? 1.12 : 0.94;
      mixSample(
        target,
        tone(config.lead, frequency, stepDuration * Number(profile.leadLength || 1.8), variant),
        start,
        0.092 * energy * accent,
        true,
        instrumentPan(config.lead, -0.16),
        0.006,
      );
    }

    const counterDegree = section.counter ? profile.counter[patternStep] : null;
    if (counterDegree !== null && counterDegree !== undefined) {
      const frequency = gameBgmNoteFrequency(profile, counterDegree + keyShift, profile.counterOctave);
      mixSample(
        target,
        tone(config.counter, frequency, stepDuration * Number(profile.counterLength || 1.4), variant + 1),
        start + stepDuration * 0.07,
        0.055 * energy,
        true,
        instrumentPan(config.counter, 0.22),
        0.007,
      );
    }

    if (orchestral && config.woodwind && patternStep % 4 === 2 && (section.counter || section.lead)) {
      const sourceDegree = profile.counter[patternStep] ?? chordRoot + 4;
      const frequency = gameBgmNoteFrequency(profile, sourceDegree + keyShift, profile.counterOctave + 1);
      mixSample(
        target,
        tone(config.woodwind, frequency, stepDuration * 3.2, variant + 2),
        start + stepDuration * 0.04,
        0.018 * energy * orchestraLevel,
        true,
        instrumentPan(config.woodwind, -0.1),
        0.01,
      );
    }

    const drumLevel = clamp(Number(section.drums || 0), 0, 1.3) * config.drumScale;
    if (drumLevel > 0.015) {
      const kick = Number(profile.drums.kick[patternStep] || 0);
      const snare = Number(profile.drums.snare[patternStep] || 0);
      const hat = Number(profile.drums.hat[patternStep] || 0);
      const perc = Number(profile.drums.perc[patternStep] || 0);
      const usesOrchestra = config.percussion?.includes('orchestra');
      const usesIndustrial = config.percussion === 'industrial-orchestra';
      const usesMotorsport = config.percussion === 'motorsport-orchestra';
      const kickKind = config.percussion === 'tribal'
        ? 'tom'
        : config.percussion === 'hybrid-orchestra' || usesIndustrial || usesMotorsport
          ? 'taiko'
          : 'kick';
      const snareKind = usesOrchestra ? 'orchestral-snare' : 'snare';
      if (kick > 0) mixSample(target, drum(kickKind, variant), start, kick * drumLevel * (config.percussion === 'tribal' ? 0.2 : 0.28), true, -0.05, 0.002);
      if (snare > 0) mixSample(target, drum(snareKind, variant), start, snare * drumLevel * (config.percussion === 'tribal' ? 0.14 : 0.2), true, 0.08, 0.003);
      if (hat > 0) mixSample(target, drum('hat', variant), start, hat * drumLevel * 0.12, true, 0.5, 0.004);
      if (perc > 0) mixSample(target, drum('tom', variant), start, perc * drumLevel * 0.15, true, patternStep % 4 < 2 ? -0.28 : 0.3, 0.005);
      if (usesIndustrial && patternStep % 4 === 2) {
        mixSample(
          target,
          drum('rail-clank', variant),
          start + stepDuration * 0.08,
          drumLevel * (patternStep % 8 === 2 ? 0.085 : 0.065),
          true,
          patternStep % 8 === 2 ? -0.38 : 0.4,
          0.009,
        );
      }
      if (usesMotorsport && patternStep % 4 === 0) {
        mixSample(
          target,
          drum('engine-pulse', variant),
          start,
          drumLevel * (patternStep % 8 === 0 ? 0.07 : 0.05),
          true,
          patternStep % 8 === 0 ? -0.16 : 0.18,
          0.006,
        );
      }
      if (orchestral && usesOrchestra && (patternStep === 0 || patternStep === 8) && (kick > 0 || Number(section.timpani || 0) > 0.12)) {
        const timpaniGain = (0.1 + Number(section.timpani || 0) * 0.06) * drumLevel * orchestraLevel;
        mixSample(target, drum('timpani', variant), start, timpaniGain, true, 0.18, 0.006);
      }
      if (patternStep === 0 && state.sectionBarIndex === 0 && Number(section.energy || 0) >= 0.65) {
        mixSample(target, drum('cymbal', variant), start, drumLevel * 0.12, true, 0.42, 0.012);
      }
    }

    if (patternStep % 4 === 0 && (config.theme === 'eternal-boss' || config.theme === 'eternal-final')) {
      const frequency = gameBgmNoteFrequency(profile, chordRoot, -1);
      mixSample(target, tone('brass', frequency, stepDuration * 3.4, variant), start, 0.04 * energy, true, 0.18, 0.006);
    }
  }

  if (channels === 2) {
    applyStereoRoom(target, config.room);
    masterStereoTrack(target);
  } else {
    applyCircularRoom(target, config.room);
    masterTrack(target);
  }
  return { duration, profile, samples: target };
}

function applyCircularRoom(samples, amount) {
  const dry = samples.slice();
  const taps = [
    [0.071, 0.18],
    [0.113, 0.13],
    [0.173, 0.095],
    [0.257, 0.065],
  ];
  for (const [delaySeconds, gain] of taps) {
    const delay = Math.round(delaySeconds * SAMPLE_RATE);
    for (let index = 0; index < samples.length; index += 1) {
      const sourceIndex = (index - delay + samples.length) % samples.length;
      samples[index] += dry[sourceIndex] * gain * amount;
    }
  }
}

function applyStereoRoom(target, amount) {
  const { left, right } = target;
  const dryLeft = left.slice();
  const dryRight = right.slice();
  const taps = [
    [0.061, 0.073, 0.17, 0.22],
    [0.109, 0.127, 0.13, 0.3],
    [0.181, 0.211, 0.095, 0.38],
    [0.271, 0.307, 0.065, 0.46],
  ];
  for (const [leftSeconds, rightSeconds, gain, crossfeed] of taps) {
    const leftDelay = Math.round(leftSeconds * SAMPLE_RATE);
    const rightDelay = Math.round(rightSeconds * SAMPLE_RATE);
    for (let index = 0; index < left.length; index += 1) {
      const leftIndex = (index - leftDelay + left.length) % left.length;
      const rightIndex = (index - rightDelay + right.length) % right.length;
      left[index] += (dryLeft[leftIndex] + dryRight[rightIndex] * crossfeed) * gain * amount;
      right[index] += (dryRight[rightIndex] + dryLeft[leftIndex] * crossfeed) * gain * amount;
    }
  }
}

function masterTrack(samples) {
  let previousInput = 0;
  let previousOutput = 0;
  let peak = 0;
  for (let index = 0; index < samples.length; index += 1) {
    const highPassed = samples[index] - previousInput + previousOutput * 0.996;
    previousInput = samples[index];
    previousOutput = highPassed;
    const compressed = Math.tanh(highPassed * 1.18);
    samples[index] = compressed;
    peak = Math.max(peak, Math.abs(compressed));
  }
  const gain = peak > 0 ? 0.88 / peak : 1;
  for (let index = 0; index < samples.length; index += 1) samples[index] *= gain;

  const crossfadeFrames = Math.min(samples.length / 4, Math.round(SAMPLE_RATE * 0.85));
  const head = samples.slice(0, crossfadeFrames);
  for (let index = 0; index < crossfadeFrames; index += 1) {
    const ratio = smoothstep(index / Math.max(1, crossfadeFrames - 1));
    const tailIndex = samples.length - crossfadeFrames + index;
    samples[tailIndex] = samples[tailIndex] * (1 - ratio) + head[index] * ratio;
  }
}

function masterStereoTrack(target) {
  const { left, right } = target;
  let previousLeftInput = 0;
  let previousLeftOutput = 0;
  let previousRightInput = 0;
  let previousRightOutput = 0;
  let peak = 0;

  for (let index = 0; index < left.length; index += 1) {
    const highPassedLeft = left[index] - previousLeftInput + previousLeftOutput * 0.996;
    const highPassedRight = right[index] - previousRightInput + previousRightOutput * 0.996;
    previousLeftInput = left[index];
    previousRightInput = right[index];
    previousLeftOutput = highPassedLeft;
    previousRightOutput = highPassedRight;

    const mid = (highPassedLeft + highPassedRight) * 0.5;
    const side = (highPassedLeft - highPassedRight) * 0.55;
    const compressedLeft = Math.tanh((mid + side) * 1.12);
    const compressedRight = Math.tanh((mid - side) * 1.12);
    left[index] = compressedLeft;
    right[index] = compressedRight;
    peak = Math.max(peak, Math.abs(compressedLeft), Math.abs(compressedRight));
  }

  const gain = peak > 0 ? 0.88 / peak : 1;
  for (let index = 0; index < left.length; index += 1) {
    left[index] *= gain;
    right[index] *= gain;
  }

  const crossfadeFrames = Math.min(left.length / 4, Math.round(SAMPLE_RATE * 0.85));
  const headLeft = left.slice(0, crossfadeFrames);
  const headRight = right.slice(0, crossfadeFrames);
  for (let index = 0; index < crossfadeFrames; index += 1) {
    const ratio = smoothstep(index / Math.max(1, crossfadeFrames - 1));
    const tailIndex = left.length - crossfadeFrames + index;
    left[tailIndex] = left[tailIndex] * (1 - ratio) + headLeft[index] * ratio;
    right[tailIndex] = right[tailIndex] * (1 - ratio) + headRight[index] * ratio;
  }
}

function encodePcmWave(samples, channels = 1) {
  const bytesPerSample = 2;
  const frameCount = samples instanceof Float32Array ? samples.length : samples.left.length;
  const dataSize = frameCount * channels * bytesPerSample;
  const output = Buffer.allocUnsafe(44 + dataSize);
  output.write('RIFF', 0, 'ascii');
  output.writeUInt32LE(36 + dataSize, 4);
  output.write('WAVE', 8, 'ascii');
  output.write('fmt ', 12, 'ascii');
  output.writeUInt32LE(16, 16);
  output.writeUInt16LE(1, 20);
  output.writeUInt16LE(channels, 22);
  output.writeUInt32LE(SAMPLE_RATE, 24);
  output.writeUInt32LE(SAMPLE_RATE * channels * bytesPerSample, 28);
  output.writeUInt16LE(channels * bytesPerSample, 32);
  output.writeUInt16LE(16, 34);
  output.write('data', 36, 'ascii');
  output.writeUInt32LE(dataSize, 40);
  for (let frame = 0; frame < frameCount; frame += 1) {
    for (let channel = 0; channel < channels; channel += 1) {
      const source = samples instanceof Float32Array
        ? samples[frame]
        : channel === 0
          ? samples.left[frame]
          : samples.right[frame];
      const value = clamp(source, -1, 1);
      const offset = 44 + (frame * channels + channel) * bytesPerSample;
      output.writeInt16LE(Math.round(value * (value < 0 ? 32_768 : 32_767)), offset);
    }
  }
  return output;
}

function trackInstrumentList(track, orchestral) {
  const instruments = [track.lead, track.counter, track.pad, 'bass', 'pluck'];
  if (orchestral) {
    instruments.push(
      track.highStrings,
      track.midStrings,
      track.lowStrings,
      track.woodwind,
      track.brassSection,
      track.lowBrass,
      track.harp,
      'choir',
      'timpani',
      'orchestral-snare',
    );
    if (['hybrid-orchestra', 'industrial-orchestra', 'motorsport-orchestra'].includes(track.percussion)) instruments.push('taiko');
    if (track.percussion === 'industrial-orchestra') instruments.push('rail-clank');
    if (track.percussion === 'motorsport-orchestra') instruments.push('engine-pulse');
  } else {
    instruments.push(track.percussion === 'tribal' ? 'tom' : 'kick', 'snare');
  }
  instruments.push('hat', 'cymbal', 'tom');
  return [...new Set(instruments.filter(Boolean))];
}

export async function renderPhysicalModelSoundtrack({
  tracks,
  outputDir,
  soundtrackName = 'game',
  renderer = 'physical-model-v1',
  channels = 1,
}) {
  if (![1, 2].includes(channels)) throw new Error(`Unsupported channel count: ${channels}`);
  const sampled = renderer === 'sampled-orchestra-v3-vsco2-ce';
  const orchestral = sampled || renderer === 'physical-model-v2-orchestra';
  await mkdir(outputDir, { recursive: true });
  const manifest = [];
  for (const track of tracks) {
    const startedAt = performance.now();
    resetSampledOrchestraUsage();
    const rendered = renderTrack(track, { channels, orchestral, sampled });
    const sampleUsage = sampled ? sampledOrchestraUsageSnapshot() : null;
    const wave = encodePcmWave(rendered.samples, channels);
    const outputPath = path.join(outputDir, `${track.file}.wav`);
    await writeFileWithRetry(outputPath, wave);
    manifest.push({
      file: `${track.file}.wav`,
      theme: track.theme,
      title: track.title,
      bars: track.bars,
      bpm: rendered.profile.bpm,
      durationSeconds: Number(rendered.duration.toFixed(3)),
      sampleRate: SAMPLE_RATE,
      channels,
      instruments: trackInstrumentList(track, orchestral),
      sampledInstruments: sampled
        ? trackInstrumentList(track, orchestral).filter(sampledOrchestraSupportsInstrument)
        : [],
      synthesisFallbackInstruments: sampled
        ? trackInstrumentList(track, orchestral).filter((instrument) => !sampledOrchestraSupportsInstrument(instrument))
        : trackInstrumentList(track, orchestral),
      sampleUsage,
      bytes: wave.length,
    });
    sampleCache.clear();
    clearSampledOrchestraRenderCache();
    console.log(`${track.theme}: ${rendered.duration.toFixed(1)}s / ${(wave.length / 1_048_576).toFixed(2)} MiB / ${(performance.now() - startedAt).toFixed(0)}ms`);
  }
  await writeFileWithRetry(
    path.join(outputDir, 'manifest.json'),
    `${JSON.stringify({
      renderer,
      sampleLibrary: sampled ? sampledOrchestraMetadata() : null,
      tracks: manifest,
    }, null, 2)}\n`,
    'utf8',
  );
  console.log(`Rendered ${manifest.length} ${soundtrackName} instrumental tracks.`);
  return manifest;
}

const isDirectRun = process.argv[1]
  && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectRun) {
  await renderPhysicalModelSoundtrack({
    tracks: ETERNAL_HUNGER_RENDER_TRACKS,
    outputDir: OUTPUT_DIR,
    soundtrackName: 'Eternal Hunger',
    renderer: 'sampled-orchestra-v3-vsco2-ce',
    channels: 2,
  });
}
