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

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = path.resolve(SCRIPT_DIR, '..', 'public', 'audio', 'eternal-hunger');
const SAMPLE_RATE = 22_050;
const TABLE_SIZE = 8_192;
const TWO_PI = Math.PI * 2;
const SINE_TABLE = Float32Array.from(
  { length: TABLE_SIZE },
  (_, index) => Math.sin((index / TABLE_SIZE) * TWO_PI),
);

const TRACKS = Object.freeze([
  { theme: 'eternal-ready', file: 'ready', title: '출전 대기', bars: 20, lead: 'piano', counter: 'bell', pad: 'strings', drumScale: 0.54, room: 0.2 },
  { theme: 'eternal-day', file: 'day', title: '루미아의 낮', bars: 24, lead: 'pluck', counter: 'piano', pad: 'strings', drumScale: 0.82, room: 0.15 },
  { theme: 'eternal-night', file: 'night', title: '금지구역 경보', bars: 24, lead: 'strings', counter: 'brass', pad: 'choir', drumScale: 1, room: 0.18 },
  { theme: 'eternal-combat', file: 'combat', title: '교전 개시', bars: 28, lead: 'guitar', counter: 'brass', pad: 'strings', drumScale: 1.18, room: 0.1 },
  { theme: 'eternal-rift', file: 'rift', title: '차원의 틈', bars: 24, lead: 'bell', counter: 'pluck', pad: 'choir', drumScale: 1.02, room: 0.24 },
  { theme: 'eternal-boss', file: 'boss', title: '변이체 강림', bars: 28, lead: 'brass', counter: 'guitar', pad: 'choir', drumScale: 1.24, room: 0.16 },
  { theme: 'eternal-final', file: 'final', title: '마지막 안전지대', bars: 28, lead: 'guitar', counter: 'strings', pad: 'strings', drumScale: 1.22, room: 0.14 },
  { theme: 'eternal-result', file: 'result', title: '생존 기록', bars: 20, lead: 'piano', counter: 'bell', pad: 'strings', drumScale: 0.3, room: 0.26 },
  { theme: 'eternal-defeat', file: 'defeat', title: '전멸 기록', bars: 20, lead: 'piano', counter: 'strings', pad: 'choir', drumScale: 0.2, room: 0.3 },
]);

const sampleCache = new Map();

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
  let partials;
  let attack;
  let release;
  let decay;

  if (kind === 'piano') {
    partials = [[1, 1], [2.004, 0.56], [3.012, 0.31], [4.025, 0.17], [5.04, 0.09], [6.07, 0.045]];
    attack = 0.006;
    release = Math.min(0.42, duration * 0.35);
    decay = 1.25;
  } else if (kind === 'strings') {
    partials = [[1, 1], [2, 0.38], [3, 0.22], [4, 0.13], [5, 0.08], [6, 0.045]];
    attack = Math.min(0.18, duration * 0.2);
    release = Math.min(0.45, duration * 0.3);
    decay = 0.08;
  } else if (kind === 'brass') {
    partials = [[1, 1], [2, 0.62], [3, 0.42], [4, 0.26], [5, 0.16], [6, 0.1]];
    attack = Math.min(0.065, duration * 0.16);
    release = Math.min(0.2, duration * 0.25);
    decay = 0.16;
  } else if (kind === 'choir') {
    partials = [[1, 1], [2, 0.26], [3, 0.38], [4, 0.12], [5, 0.24], [6, 0.08], [7, 0.12]];
    attack = Math.min(0.28, duration * 0.24);
    release = Math.min(0.55, duration * 0.36);
    decay = 0.03;
  } else if (kind === 'bell') {
    partials = [[1, 1], [2.01, 0.52], [2.98, 0.34], [4.13, 0.22], [5.42, 0.14], [6.79, 0.07]];
    attack = 0.003;
    release = Math.min(0.48, duration * 0.42);
    decay = 1.05;
  } else {
    partials = [[1, 1], [2, 0.22], [3, 0.1]];
    attack = 0.008;
    release = Math.min(0.2, duration * 0.3);
    decay = 0.55;
  }

  const phases = partials.map(() => random());
  for (let index = 0; index < frameCount; index += 1) {
    const t = index / SAMPLE_RATE;
    const vibrato = kind === 'strings' || kind === 'choir'
      ? 1 + sine(t * (4.7 + variant * 0.08)) * 0.0028
      : 1;
    let value = 0;
    for (let partialIndex = 0; partialIndex < partials.length; partialIndex += 1) {
      const [ratio, level] = partials[partialIndex];
      const partialDecay = kind === 'piano' || kind === 'bell'
        ? Math.exp(-t * partialIndex * 0.32)
        : 1;
      value += sine(t * frequency * ratio * vibrato + phases[partialIndex]) * level * partialDecay;
    }
    if (kind === 'piano' && t < 0.018) value += (random() * 2 - 1) * (1 - t / 0.018) * 0.18;
    const env = envelope(t, duration, attack, release, decay);
    const saturation = kind === 'brass' ? Math.tanh(value * 0.9) : value;
    samples[index] = saturation * env * (kind === 'choir' ? 0.52 : 0.62);
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
  const damping = kind === 'guitar' ? 0.9962 : kind === 'bass' ? 0.998 : 0.9948;
  for (let index = 0; index < frameCount; index += 1) {
    const ringIndex = index % delayLength;
    const nextIndex = (ringIndex + 1) % delayLength;
    const next = (ring[ringIndex] + ring[nextIndex]) * 0.5 * damping;
    ring[ringIndex] = next;
    const t = index / SAMPLE_RATE;
    const env = envelope(t, duration, 0.003, Math.min(0.28, duration * 0.34), kind === 'bass' ? 0.34 : 0.58);
    const body = next + sine(t * frequency) * (kind === 'bass' ? 0.34 : 0.08);
    output[index] = (kind === 'guitar' ? Math.tanh(body * 1.9) : body) * env * 0.72;
  }
  return output;
}

function tonalSample(kind, frequency, duration, variant = 0) {
  const safeKind = ['piano', 'strings', 'brass', 'choir', 'bell', 'pluck', 'guitar', 'bass'].includes(kind)
    ? kind
    : 'piano';
  const safeFrequency = clamp(frequencyKey(frequency), 28, 4_200);
  const safeDuration = clamp(Math.round(duration * 100) / 100, 0.08, 5.5);
  const safeVariant = Math.abs(Math.trunc(variant)) % 4;
  const key = `${safeKind}:${safeFrequency}:${safeDuration}:${safeVariant}`;
  if (!sampleCache.has(key)) {
    sampleCache.set(
      key,
      ['pluck', 'guitar', 'bass'].includes(safeKind)
        ? pluckedSample(safeKind, safeFrequency, safeDuration, safeVariant)
        : additiveSample(safeKind, safeFrequency, safeDuration, safeVariant),
    );
  }
  return sampleCache.get(key);
}

function percussionSample(kind, variant = 0) {
  const key = `drum:${kind}:${variant % 4}`;
  if (sampleCache.has(key)) return sampleCache.get(key);
  const durations = { kick: 0.42, snare: 0.34, hat: 0.12, cymbal: 1.35, tom: 0.5 };
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
    } else if (kind === 'snare') {
      output[index] = (highNoise * 0.72 + sine(t * 184) * 0.28) * Math.exp(-t * 12.5);
    } else if (kind === 'hat') {
      output[index] = highNoise * Math.exp(-t * 36) * 0.62;
    } else if (kind === 'cymbal') {
      const metal = highNoise * 0.48 + sine(t * 3_731) * 0.13 + sine(t * 5_069) * 0.09;
      output[index] = metal * Math.exp(-t * 3.4);
    } else {
      const frequency = 164 * Math.exp(-t * 4.5) + 58;
      output[index] = (sine(t * frequency) * 0.8 + noise * 0.12) * Math.exp(-t * 7.4);
    }
  }
  sampleCache.set(key, output);
  return output;
}

function mixSample(target, sample, startSeconds, gain = 1, wrap = true) {
  const startFrame = Math.round(startSeconds * SAMPLE_RATE);
  for (let index = 0; index < sample.length; index += 1) {
    let targetIndex = startFrame + index;
    if (targetIndex >= target.length) {
      if (!wrap) break;
      targetIndex %= target.length;
    }
    if (targetIndex < 0) continue;
    target[targetIndex] += sample[index] * gain;
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

function renderTrack(config) {
  const profile = gameBgmProfile(config.theme);
  const stepDuration = gameBgmStepDuration(profile);
  const totalSteps = config.bars * 16;
  const duration = totalSteps * stepDuration;
  const target = new Float32Array(Math.ceil(duration * SAMPLE_RATE));
  const human = seededRandom(config.theme.length * 65_537);

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
        mixSample(target, tonalSample(config.pad, frequency, chordDuration, noteIndex), start, padGain);
      }
    }

    const bassDegree = section.bass ? profile.bass[patternStep] : null;
    if (bassDegree !== null && bassDegree !== undefined) {
      const frequency = gameBgmNoteFrequency(profile, bassDegree + keyShift, profile.bassOctave);
      mixSample(target, tonalSample('bass', frequency, stepDuration * 2.8, variant), start, 0.105 * energy);
    }

    const arpDegree = section.arp ? profile.arp[patternStep] : null;
    if (arpDegree !== null && arpDegree !== undefined) {
      const frequency = gameBgmNoteFrequency(profile, arpDegree + keyShift, profile.arpOctave);
      mixSample(target, tonalSample('pluck', frequency, stepDuration * 1.5, variant), start, 0.044 * energy);
    }

    const leadPattern = patternForLead(profile, section, state.sectionBarIndex);
    const leadDegree = leadPattern?.[patternStep];
    if (leadDegree !== null && leadDegree !== undefined) {
      const frequency = gameBgmNoteFrequency(profile, leadDegree + keyShift, profile.leadOctave + (config.lead === 'bell' ? 1 : 0));
      const accent = patternStep % 4 === 0 ? 1.12 : 0.94;
      mixSample(
        target,
        tonalSample(config.lead, frequency, stepDuration * Number(profile.leadLength || 1.8), variant),
        start,
        0.092 * energy * accent,
      );
    }

    const counterDegree = section.counter ? profile.counter[patternStep] : null;
    if (counterDegree !== null && counterDegree !== undefined) {
      const frequency = gameBgmNoteFrequency(profile, counterDegree + keyShift, profile.counterOctave);
      mixSample(
        target,
        tonalSample(config.counter, frequency, stepDuration * Number(profile.counterLength || 1.4), variant + 1),
        start + stepDuration * 0.07,
        0.055 * energy,
      );
    }

    const drumLevel = clamp(Number(section.drums || 0), 0, 1.3) * config.drumScale;
    if (drumLevel > 0.015) {
      const kick = Number(profile.drums.kick[patternStep] || 0);
      const snare = Number(profile.drums.snare[patternStep] || 0);
      const hat = Number(profile.drums.hat[patternStep] || 0);
      const perc = Number(profile.drums.perc[patternStep] || 0);
      if (kick > 0) mixSample(target, percussionSample('kick', variant), start, kick * drumLevel * 0.28);
      if (snare > 0) mixSample(target, percussionSample('snare', variant), start, snare * drumLevel * 0.2);
      if (hat > 0) mixSample(target, percussionSample('hat', variant), start, hat * drumLevel * 0.12);
      if (perc > 0) mixSample(target, percussionSample('tom', variant), start, perc * drumLevel * 0.15);
      if (patternStep === 0 && state.sectionBarIndex === 0 && Number(section.energy || 0) >= 0.65) {
        mixSample(target, percussionSample('cymbal', variant), start, drumLevel * 0.12);
      }
    }

    if (patternStep % 4 === 0 && (config.theme === 'eternal-boss' || config.theme === 'eternal-final')) {
      const frequency = gameBgmNoteFrequency(profile, chordRoot, -1);
      mixSample(target, tonalSample('brass', frequency, stepDuration * 3.4, variant), start, 0.04 * energy);
    }
  }

  applyCircularRoom(target, config.room);
  masterTrack(target);
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

function encodePcmWave(samples) {
  const bytesPerSample = 2;
  const dataSize = samples.length * bytesPerSample;
  const output = Buffer.allocUnsafe(44 + dataSize);
  output.write('RIFF', 0, 'ascii');
  output.writeUInt32LE(36 + dataSize, 4);
  output.write('WAVE', 8, 'ascii');
  output.write('fmt ', 12, 'ascii');
  output.writeUInt32LE(16, 16);
  output.writeUInt16LE(1, 20);
  output.writeUInt16LE(1, 22);
  output.writeUInt32LE(SAMPLE_RATE, 24);
  output.writeUInt32LE(SAMPLE_RATE * bytesPerSample, 28);
  output.writeUInt16LE(bytesPerSample, 32);
  output.writeUInt16LE(16, 34);
  output.write('data', 36, 'ascii');
  output.writeUInt32LE(dataSize, 40);
  for (let index = 0; index < samples.length; index += 1) {
    const value = clamp(samples[index], -1, 1);
    output.writeInt16LE(Math.round(value * (value < 0 ? 32_768 : 32_767)), 44 + index * 2);
  }
  return output;
}

await mkdir(OUTPUT_DIR, { recursive: true });
const manifest = [];
for (const track of TRACKS) {
  const startedAt = performance.now();
  const rendered = renderTrack(track);
  const wave = encodePcmWave(rendered.samples);
  const outputPath = path.join(OUTPUT_DIR, `${track.file}.wav`);
  await writeFile(outputPath, wave);
  manifest.push({
    file: `${track.file}.wav`,
    theme: track.theme,
    title: track.title,
    bars: track.bars,
    bpm: rendered.profile.bpm,
    durationSeconds: Number(rendered.duration.toFixed(3)),
    sampleRate: SAMPLE_RATE,
    channels: 1,
    bytes: wave.length,
  });
  console.log(`${track.theme}: ${rendered.duration.toFixed(1)}s / ${(wave.length / 1_048_576).toFixed(2)} MiB / ${(performance.now() - startedAt).toFixed(0)}ms`);
}
await writeFile(
  path.join(OUTPUT_DIR, 'manifest.json'),
  `${JSON.stringify({ renderer: 'physical-model-v1', tracks: manifest }, null, 2)}\n`,
  'utf8',
);
console.log(`Rendered ${manifest.length} Eternal Hunger instrumental tracks.`);
