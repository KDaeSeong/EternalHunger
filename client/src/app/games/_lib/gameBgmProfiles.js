const PATTERN_STEPS = 16;

export const GAME_BGM_LAYER_ROLES = Object.freeze([
  'lead',
  'harmony',
  'octave',
  'counter',
  'arpeggio',
  'bass',
  'pad',
  'string-ostinato',
  'brass-stab',
  'bell-accent',
  'choir-pad',
  'sub-bass',
  'string-ensemble',
  'synth-pulse',
  'kick',
  'snare',
  'ghost-snare',
  'hi-hat',
  'ride-cymbal',
  'percussion',
  'tom-fill',
  'transition-fx',
]);

const MODES = Object.freeze({
  major: Object.freeze([0, 2, 4, 5, 7, 9, 11]),
  minor: Object.freeze([0, 2, 3, 5, 7, 8, 10]),
  harmonicMinor: Object.freeze([0, 2, 3, 5, 7, 8, 11]),
  dorian: Object.freeze([0, 2, 3, 5, 7, 9, 10]),
  mixolydian: Object.freeze([0, 2, 4, 5, 7, 9, 10]),
  majorPentatonic: Object.freeze([0, 2, 4, 7, 9]),
  minorPentatonic: Object.freeze([0, 3, 5, 7, 10]),
});

function freezePattern(values, fallback = []) {
  return Object.freeze(Array.from({ length: PATTERN_STEPS }, (_, index) => (
    values?.[index] !== undefined ? values[index] : fallback?.[index] ?? null
  )));
}

function groove(patterns) {
  return Object.freeze({
    kick: freezePattern(patterns.kick),
    snare: freezePattern(patterns.snare),
    hat: freezePattern(patterns.hat),
    perc: freezePattern(patterns.perc),
  });
}

const DRUM_GROOVES = Object.freeze({
  cinematic: groove({
    kick: [1, 0, 0, 0, 0.55, 0, 0, 0, 1, 0, 0, 0.35, 0.65, 0, 0, 0.45],
    snare: [0, 0, 0, 0, 1, 0, 0, 0.2, 0, 0, 0, 0, 1, 0, 0.25, 0],
    hat: [0.5, 0.22, 0.32, 0.22, 0.48, 0.22, 0.35, 0.22, 0.5, 0.22, 0.32, 0.22, 0.55, 0.25, 0.4, 0.3],
    perc: [0, 0, 0.3, 0, 0, 0, 0.25, 0, 0, 0, 0.3, 0, 0, 0.25, 0, 0.45],
  }),
  curious: groove({
    kick: [0.8, 0, 0, 0.25, 0, 0, 0.5, 0, 0.75, 0, 0.25, 0, 0, 0.4, 0, 0.25],
    snare: [0, 0, 0, 0, 0.75, 0, 0.25, 0, 0, 0, 0, 0, 0.8, 0, 0.3, 0],
    hat: [0.28, 0.18, 0.34, 0.18, 0.28, 0.18, 0.42, 0.18, 0.28, 0.18, 0.34, 0.18, 0.28, 0.2, 0.5, 0.22],
    perc: [0, 0.35, 0, 0, 0, 0, 0.3, 0, 0, 0.25, 0, 0, 0, 0, 0.45, 0],
  }),
  duel: groove({
    kick: [1, 0, 0.35, 0, 0, 0.55, 0, 0, 1, 0, 0.45, 0, 0, 0.6, 0, 0.35],
    snare: [0, 0, 0, 0, 1, 0, 0, 0.3, 0, 0, 0, 0, 1, 0, 0.45, 0],
    hat: [0.55, 0.32, 0.45, 0.32, 0.6, 0.32, 0.48, 0.35, 0.55, 0.32, 0.45, 0.32, 0.65, 0.38, 0.55, 0.42],
    perc: [0, 0, 0, 0.35, 0, 0, 0, 0.35, 0, 0.25, 0, 0.35, 0, 0, 0.25, 0.55],
  }),
  tribal: groove({
    kick: [0.85, 0, 0, 0.35, 0, 0.55, 0, 0, 0.8, 0, 0.3, 0, 0, 0.5, 0, 0.4],
    snare: [0, 0, 0, 0, 0.55, 0, 0, 0.25, 0, 0, 0, 0, 0.65, 0, 0.2, 0],
    hat: [0.18, 0, 0.25, 0, 0.18, 0, 0.3, 0, 0.18, 0, 0.25, 0, 0.2, 0, 0.35, 0],
    perc: [0, 0.4, 0, 0, 0.3, 0, 0.5, 0, 0, 0.35, 0, 0.25, 0, 0.45, 0, 0.6],
  }),
  shuffle: groove({
    kick: [0.85, 0, 0, 0.35, 0, 0.45, 0, 0, 0.8, 0, 0.3, 0, 0, 0.5, 0, 0.3],
    snare: [0, 0, 0, 0, 0.8, 0, 0.25, 0, 0, 0, 0, 0, 0.85, 0, 0.35, 0],
    hat: [0.32, 0.15, 0.4, 0.18, 0.32, 0.16, 0.45, 0.2, 0.32, 0.15, 0.4, 0.18, 0.35, 0.2, 0.5, 0.24],
    perc: [0, 0, 0.28, 0, 0, 0.35, 0, 0, 0, 0, 0.28, 0, 0, 0.35, 0, 0.45],
  }),
  ambient: groove({
    kick: [0.55, 0, 0, 0, 0, 0, 0, 0, 0.45, 0, 0, 0, 0, 0, 0, 0],
    snare: [0, 0, 0, 0, 0.3, 0, 0, 0, 0, 0, 0, 0, 0.32, 0, 0, 0],
    hat: [0.12, 0, 0.16, 0, 0.12, 0, 0.16, 0, 0.12, 0, 0.16, 0, 0.12, 0, 0.2, 0],
    perc: [0, 0, 0, 0, 0, 0, 0.22, 0, 0, 0, 0, 0, 0, 0, 0.28, 0],
  }),
  march: groove({
    kick: [1, 0, 0, 0, 0.7, 0, 0, 0, 1, 0, 0, 0, 0.75, 0, 0, 0.4],
    snare: [0, 0.28, 0, 0.28, 0.8, 0.3, 0, 0.3, 0, 0.3, 0, 0.3, 0.85, 0.35, 0, 0.55],
    hat: [0.38, 0.22, 0.38, 0.22, 0.45, 0.22, 0.4, 0.22, 0.38, 0.22, 0.38, 0.22, 0.48, 0.25, 0.42, 0.3],
    perc: [0, 0, 0.32, 0, 0, 0, 0.32, 0, 0, 0, 0.32, 0, 0, 0, 0.38, 0.55],
  }),
  digital: groove({
    kick: [0.9, 0, 0.25, 0, 0, 0.45, 0, 0, 0.85, 0, 0.3, 0, 0, 0.5, 0, 0.35],
    snare: [0, 0, 0, 0, 0.75, 0, 0, 0.35, 0, 0, 0, 0, 0.8, 0, 0.45, 0],
    hat: [0.45, 0.25, 0.4, 0.25, 0.45, 0.25, 0.5, 0.25, 0.45, 0.25, 0.4, 0.25, 0.5, 0.3, 0.55, 0.35],
    perc: [0, 0.3, 0, 0, 0, 0, 0.4, 0, 0, 0.3, 0, 0, 0, 0, 0.45, 0.6],
  }),
  rail: groove({
    kick: [0.75, 0, 0.3, 0, 0.55, 0, 0.3, 0, 0.75, 0, 0.3, 0, 0.55, 0, 0.35, 0],
    snare: [0, 0, 0, 0, 0.65, 0, 0, 0, 0, 0, 0, 0, 0.7, 0, 0.25, 0],
    hat: [0.36, 0.2, 0.36, 0.2, 0.4, 0.2, 0.36, 0.2, 0.36, 0.2, 0.36, 0.2, 0.42, 0.22, 0.4, 0.25],
    perc: [0, 0.25, 0, 0.25, 0, 0.25, 0, 0.3, 0, 0.25, 0, 0.25, 0, 0.3, 0, 0.4],
  }),
  drive: groove({
    kick: [1, 0, 0.45, 0, 0.7, 0, 0.4, 0, 1, 0, 0.5, 0, 0.75, 0, 0.5, 0.35],
    snare: [0, 0, 0, 0, 1, 0, 0, 0.35, 0, 0, 0, 0, 1, 0, 0.45, 0],
    hat: [0.62, 0.38, 0.55, 0.38, 0.65, 0.38, 0.58, 0.4, 0.62, 0.38, 0.55, 0.38, 0.7, 0.42, 0.65, 0.48],
    perc: [0, 0, 0.35, 0, 0, 0.35, 0, 0.45, 0, 0, 0.35, 0, 0, 0.4, 0.35, 0.65],
  }),
  assault: groove({
    kick: [1, 0, 0.48, 0.22, 0.72, 0, 0.42, 0, 1, 0.18, 0.55, 0, 0.8, 0.24, 0.5, 0.36],
    snare: [0, 0, 0.16, 0, 1, 0, 0.24, 0, 0, 0, 0.18, 0, 1, 0, 0.34, 0.24],
    hat: [0.72, 0.48, 0.64, 0.48, 0.76, 0.5, 0.68, 0.52, 0.74, 0.5, 0.66, 0.5, 0.82, 0.56, 0.74, 0.62],
    perc: [0, 0.26, 0.42, 0, 0, 0.34, 0.44, 0.52, 0, 0.28, 0.42, 0, 0, 0.38, 0.5, 0.72],
  }),
});

const SECTION_FLOURISHES = Object.freeze({
  intro: Object.freeze({ crash: 0.42, harmony: 0, octave: 0, pump: 0.1, riser: 0.12, stabs: false, ostinato: 0.18, brass: 0.08, bell: 0.28, choir: 0.16, sub: 0.3, toms: 0.08, strings: 0.2, pulse: 0.1, cymbal: 0.08, ghost: 0.04 }),
  'theme-a': Object.freeze({ crash: 0.3, harmony: 0.14, octave: 0, pump: 0.24, riser: 0.24, stabs: false, ostinato: 0.62, brass: 0.26, bell: 0.24, choir: 0.2, sub: 0.58, toms: 0.24, strings: 0.54, pulse: 0.42, cymbal: 0.34, ghost: 0.22 }),
  turn: Object.freeze({ crash: 0.12, harmony: 0.12, octave: 0, pump: 0.1, riser: 0.72, stabs: false, ostinato: 0.38, brass: 0.05, bell: 0.38, choir: 0.18, sub: 0.18, toms: 0.36, strings: 0.26, pulse: 0.18, cymbal: 0.18, ghost: 0.14 }),
  break: Object.freeze({ crash: 0.1, harmony: 0.18, octave: 0.08, pump: 0.08, riser: 0.78, stabs: false, ostinato: 0.22, brass: 0.08, bell: 0.42, choir: 0.4, sub: 0.15, toms: 0.42, strings: 0.46, pulse: 0.12, cymbal: 0.12, ghost: 0.08 }),
  bridge: Object.freeze({ crash: 0.16, harmony: 0.24, octave: 0.1, pump: 0.14, riser: 0.68, stabs: false, ostinato: 0.34, brass: 0.16, bell: 0.35, choir: 0.48, sub: 0.32, toms: 0.4, strings: 0.62, pulse: 0.36, cymbal: 0.3, ghost: 0.2 }),
  'theme-b': Object.freeze({ crash: 0.86, harmony: 0.58, octave: 0.3, pump: 0.38, riser: 0.36, stabs: true, ostinato: 0.92, brass: 0.76, bell: 0.5, choir: 0.58, sub: 0.88, toms: 0.68, strings: 0.82, pulse: 0.78, cymbal: 0.7, ghost: 0.5 }),
  return: Object.freeze({ crash: 0.58, harmony: 0.44, octave: 0.24, pump: 0.32, riser: 0.46, stabs: true, ostinato: 0.78, brass: 0.64, bell: 0.44, choir: 0.5, sub: 0.76, toms: 0.56, strings: 0.74, pulse: 0.66, cymbal: 0.58, ghost: 0.4 }),
  climax: Object.freeze({ crash: 0.78, harmony: 0.72, octave: 0.42, pump: 0.42, riser: 0.84, stabs: true, ostinato: 1, brass: 0.92, bell: 0.68, choir: 0.82, sub: 1, toms: 0.86, strings: 1, pulse: 0.96, cymbal: 0.94, ghost: 0.7 }),
  finale: Object.freeze({ crash: 1, harmony: 0.8, octave: 0.52, pump: 0.46, riser: 1, stabs: true, ostinato: 1, brass: 1, bell: 0.82, choir: 0.9, sub: 1, toms: 1, strings: 1, pulse: 1, cymbal: 1, ghost: 0.78 }),
  'drift-a': Object.freeze({ crash: 0.16, harmony: 0.1, octave: 0, pump: 0.06, riser: 0.14, stabs: false, ostinato: 0.28, brass: 0.05, bell: 0.32, choir: 0.34, sub: 0.32, toms: 0.12, strings: 0.5, pulse: 0.2, cymbal: 0.14, ghost: 0.06 }),
  interlude: Object.freeze({ crash: 0.08, harmony: 0.2, octave: 0.08, pump: 0.04, riser: 0.54, stabs: false, ostinato: 0.16, brass: 0.04, bell: 0.48, choir: 0.52, sub: 0.12, toms: 0.2, strings: 0.68, pulse: 0.08, cymbal: 0.08, ghost: 0.04 }),
  'drift-b': Object.freeze({ crash: 0.36, harmony: 0.38, octave: 0.18, pump: 0.12, riser: 0.34, stabs: false, ostinato: 0.48, brass: 0.14, bell: 0.42, choir: 0.58, sub: 0.48, toms: 0.28, strings: 0.72, pulse: 0.32, cymbal: 0.26, ghost: 0.12 }),
});

const DRUM_FLOURISH = Object.freeze({
  ambient: 0.56,
  cinematic: 1.05,
  curious: 0.88,
  digital: 1.04,
  drive: 1.18,
  assault: 1.3,
  duel: 1.1,
  march: 1,
  rail: 0.84,
  shuffle: 0.92,
  tribal: 0.72,
});

function orchestraPalette(options) {
  return Object.freeze({
    ostinatoGain: 0.026,
    ostinatoWave: 'triangle',
    brassGain: 0.026,
    brassWave: 'sawtooth',
    bellGain: 0.018,
    bellWave: 'sine',
    choirGain: 0.018,
    choirWave: 'triangle',
    subGain: 0.042,
    tomGain: 0.034,
    stringGain: 0,
    stringWave: 'triangle',
    pulseGain: 0,
    pulseWave: 'sawtooth',
    cymbalGain: 0,
    ghostGain: 0,
    ...options,
  });
}

const ORCHESTRATION_PALETTES = Object.freeze({
  ambient: orchestraPalette({
    ostinatoGain: 0.014, brassGain: 0.009, bellGain: 0.022,
    choirGain: 0.028, subGain: 0.034, tomGain: 0.018,
  }),
  cinematic: orchestraPalette({
    ostinatoGain: 0.035, ostinatoWave: 'sawtooth', brassGain: 0.045,
    bellGain: 0.012, choirGain: 0.022, subGain: 0.055, tomGain: 0.042,
  }),
  curious: orchestraPalette({
    ostinatoGain: 0.022, brassGain: 0.018, bellGain: 0.025,
    choirGain: 0.012, subGain: 0.032, tomGain: 0.026,
  }),
  digital: orchestraPalette({
    ostinatoGain: 0.035, ostinatoWave: 'square', brassGain: 0.022,
    brassWave: 'square', bellGain: 0.024, choirGain: 0.012,
    subGain: 0.052, tomGain: 0.034,
  }),
  drive: orchestraPalette({
    ostinatoGain: 0.04, ostinatoWave: 'sawtooth', brassGain: 0.036,
    bellGain: 0.018, choirGain: 0.012, subGain: 0.06, tomGain: 0.045,
  }),
  duel: orchestraPalette({
    ostinatoGain: 0.032, brassGain: 0.034, bellGain: 0.018,
    choirGain: 0.016, subGain: 0.052, tomGain: 0.038,
  }),
  march: orchestraPalette({
    ostinatoGain: 0.034, ostinatoWave: 'sawtooth', brassGain: 0.048,
    bellGain: 0.012, choirGain: 0.022, subGain: 0.052, tomGain: 0.052,
  }),
  rail: orchestraPalette({
    ostinatoGain: 0.03, brassGain: 0.025, bellGain: 0.018,
    choirGain: 0.014, subGain: 0.046, tomGain: 0.032,
  }),
  shuffle: orchestraPalette({
    ostinatoGain: 0.026, brassGain: 0.019, bellGain: 0.03,
    choirGain: 0.014, subGain: 0.034, tomGain: 0.026,
  }),
  tribal: orchestraPalette({
    ostinatoGain: 0.018, brassGain: 0.016, bellGain: 0.014,
    choirGain: 0.026, subGain: 0.044, tomGain: 0.052,
  }),
  eternalAmbient: orchestraPalette({
    ostinatoGain: 0.018, brassGain: 0.012, bellGain: 0.032,
    choirGain: 0.036, subGain: 0.038, tomGain: 0.02,
    stringGain: 0.034, pulseGain: 0.012, cymbalGain: 0.012, ghostGain: 0.008,
  }),
  eternalField: orchestraPalette({
    ostinatoGain: 0.032, brassGain: 0.03, bellGain: 0.027,
    choirGain: 0.018, subGain: 0.046, tomGain: 0.034,
    stringGain: 0.038, pulseGain: 0.024, cymbalGain: 0.022, ghostGain: 0.016,
  }),
  eternalThreat: orchestraPalette({
    ostinatoGain: 0.042, ostinatoWave: 'sawtooth', brassGain: 0.048,
    bellGain: 0.018, choirGain: 0.032, subGain: 0.062, tomGain: 0.048,
    stringGain: 0.044, pulseGain: 0.03, cymbalGain: 0.03, ghostGain: 0.024,
  }),
  eternalAssault: orchestraPalette({
    ostinatoGain: 0.05, ostinatoWave: 'sawtooth', brassGain: 0.052,
    bellGain: 0.018, choirGain: 0.018, subGain: 0.07, tomGain: 0.06,
    stringGain: 0.038, pulseGain: 0.04, pulseWave: 'square',
    cymbalGain: 0.038, ghostGain: 0.03,
  }),
  eternalFinale: orchestraPalette({
    ostinatoGain: 0.055, ostinatoWave: 'sawtooth', brassGain: 0.06,
    bellGain: 0.026, choirGain: 0.04, subGain: 0.075, tomGain: 0.066,
    stringGain: 0.05, stringWave: 'sawtooth', pulseGain: 0.042,
    cymbalGain: 0.042, ghostGain: 0.034,
  }),
  eternalMemory: orchestraPalette({
    ostinatoGain: 0.014, brassGain: 0.008, bellGain: 0.038,
    choirGain: 0.044, subGain: 0.03, tomGain: 0.014,
    stringGain: 0.04, pulseGain: 0.01, cymbalGain: 0.01, ghostGain: 0.006,
  }),
});

function section(id, label, bars, options = {}) {
  return Object.freeze({
    bell: 0,
    brass: 0,
    choir: 0,
    crash: 0,
    harmony: 0,
    octave: 0,
    ostinato: 0,
    pump: 0,
    riser: 0,
    stabs: false,
    sub: 0,
    toms: 0,
    strings: 0,
    pulse: 0,
    cymbal: 0,
    ghost: 0,
    brightness: 1,
    keyShift: 0,
    ...(SECTION_FLOURISHES[id] || {}),
    id,
    label,
    bars,
    ...options,
  });
}

const ARRANGEMENTS = Object.freeze({
  action: Object.freeze([
    section('intro', '인트로', 2, { lead: false, counter: false, bass: true, arp: true, pad: true, drums: 0.38, energy: 0.48, chords: 'a' }),
    section('theme-a', 'A 테마', 4, { lead: 'a', counter: false, bass: true, arp: true, pad: true, drums: 0.78, energy: 0.78, chords: 'a' }),
    section('break', '브레이크', 2, { lead: false, counter: true, bass: false, arp: true, pad: true, drums: 0.28, energy: 0.42, chords: 'b' }),
    section('theme-b', 'B 테마', 4, { lead: 'b', counter: true, bass: true, arp: true, pad: true, drums: 1, energy: 1, chords: 'b' }),
    section('return', '리프라이즈', 2, { lead: 'a', counter: true, bass: true, arp: false, pad: true, drums: 0.88, energy: 0.9, chords: 'a' }),
    section('climax', '클라이맥스', 2, { lead: 'b', counter: true, bass: true, arp: true, pad: true, drums: 1.05, energy: 1.06, chords: 'b', fill: true }),
    section('finale', '피날레', 2, { lead: 'b', counter: true, bass: true, arp: true, pad: true, drums: 1.08, energy: 1.08, chords: 'b', fill: true }),
  ]),
  playful: Object.freeze([
    section('intro', '인트로', 2, { lead: false, counter: true, bass: true, arp: true, pad: true, drums: 0.32, energy: 0.5, chords: 'a' }),
    section('theme-a', 'A 테마', 3, { lead: 'a', counter: false, bass: true, arp: true, pad: true, drums: 0.72, energy: 0.78, chords: 'a' }),
    section('turn', '전환', 1, { lead: false, counter: true, bass: false, arp: true, pad: false, drums: 0.42, energy: 0.56, chords: 'b' }),
    section('theme-b', 'B 테마', 4, { lead: 'b', counter: true, bass: true, arp: true, pad: true, drums: 0.9, energy: 0.96, chords: 'b' }),
    section('break', '브레이크', 2, { lead: 'a', counter: false, bass: false, arp: true, pad: true, drums: 0.26, energy: 0.48, chords: 'a' }),
    section('climax', '클라이맥스', 2, { lead: 'b', counter: true, bass: true, arp: true, pad: true, drums: 0.96, energy: 1.02, chords: 'b', fill: true }),
    section('finale', '피날레', 4, { lead: 'b', counter: true, bass: true, arp: true, pad: true, drums: 1, energy: 1.04, chords: 'b', fill: true }),
  ]),
  ambient: Object.freeze([
    section('intro', '여백', 2, { lead: false, counter: false, bass: true, arp: true, pad: true, drums: 0.16, energy: 0.38, chords: 'a' }),
    section('drift-a', 'A 흐름', 4, { lead: 'a', counter: false, bass: true, arp: true, pad: true, drums: 0.36, energy: 0.58, chords: 'a' }),
    section('interlude', '간주', 2, { lead: false, counter: true, bass: false, arp: true, pad: true, drums: 0.12, energy: 0.34, chords: 'b' }),
    section('drift-b', 'B 흐름', 4, { lead: 'b', counter: true, bass: true, arp: true, pad: true, drums: 0.42, energy: 0.68, chords: 'b' }),
    section('climax', '물결 고조', 2, { lead: 'b', counter: true, bass: true, arp: true, pad: true, drums: 0.48, energy: 0.78, chords: 'b', fill: true }),
    section('return', '귀환', 4, { lead: 'a', counter: true, bass: true, arp: false, pad: true, drums: 0.28, energy: 0.54, chords: 'a', fill: true }),
  ]),
  steady: Object.freeze([
    section('intro', '도입', 2, { lead: false, counter: false, bass: true, arp: true, pad: true, drums: 0.28, energy: 0.45, chords: 'a' }),
    section('theme-a', 'A 테마', 4, { lead: 'a', counter: false, bass: true, arp: true, pad: true, drums: 0.62, energy: 0.7, chords: 'a' }),
    section('bridge', '브리지', 2, { lead: false, counter: true, bass: true, arp: false, pad: true, drums: 0.34, energy: 0.48, chords: 'b' }),
    section('theme-b', 'B 테마', 4, { lead: 'b', counter: true, bass: true, arp: true, pad: true, drums: 0.76, energy: 0.84, chords: 'b' }),
    section('return', '리프라이즈', 2, { lead: 'a', counter: true, bass: true, arp: true, pad: true, drums: 0.68, energy: 0.76, chords: 'a' }),
    section('climax', '클라이맥스', 2, { lead: 'b', counter: true, bass: true, arp: true, pad: true, drums: 0.82, energy: 0.9, chords: 'b', fill: true }),
    section('finale', '마감', 2, { lead: 'b', counter: true, bass: true, arp: false, pad: true, drums: 0.86, energy: 0.92, chords: 'b', fill: true }),
  ]),
  eternalReady: Object.freeze([
    section('intro', '신호 수신', 2, { lead: false, counter: false, bass: true, arp: true, pad: true, drums: 0.06, energy: 0.24, chords: 'a', strings: 0.38, pulse: 0.04, brightness: 0.72 }),
    section('drift-a', '출전 준비', 5, { lead: 'a', leadSequence: ['a', 'a', 'c', 'a', 'a'], counter: false, bass: true, arp: true, pad: true, drums: 0.18, energy: 0.46, chords: 'a', strings: 0.68, pulse: 0.16 }),
    section('theme-a', '작전 확인', 4, { lead: 'a', leadSequence: ['a', 'c', 'a', 'b'], counter: true, bass: true, arp: true, pad: true, drums: 0.34, energy: 0.63, chords: 'a', strings: 0.76, pulse: 0.28 }),
    section('interlude', '잠깐의 정적', 2, { lead: false, counter: true, bass: false, arp: true, pad: true, drums: 0.05, energy: 0.28, chords: 'b', strings: 0.86, pulse: 0.02, brightness: 0.78 }),
    section('bridge', '출발선', 3, { lead: 'c', leadSequence: ['c', 'c', 'a'], counter: true, bass: true, arp: false, pad: true, drums: 0.26, energy: 0.55, chords: 'b', strings: 0.82, pulse: 0.22 }),
    section('drift-b', '루미아 호출', 5, { lead: 'b', leadSequence: ['b', 'c', 'b', 'a', 'b'], counter: true, bass: true, arp: true, pad: true, drums: 0.4, energy: 0.7, chords: 'b', strings: 0.84, pulse: 0.36 }),
    section('break', '장비 점검', 2, { lead: 'c', counter: false, bass: false, arp: true, pad: true, drums: 0.12, energy: 0.38, chords: 'a', strings: 0.74, pulse: 0.08 }),
    section('return', '출전 카운트다운', 5, { lead: 'a', leadSequence: ['a', 'c', 'a', 'b', 'a'], counter: true, bass: true, arp: true, pad: true, drums: 0.5, energy: 0.76, chords: 'a', strings: 0.9, pulse: 0.46 }),
    section('climax', '작전 개시', 4, { lead: 'b', leadSequence: ['b', 'c', 'b', 'b'], counter: true, bass: true, arp: true, pad: true, drums: 0.62, energy: 0.9, chords: 'b', keyShift: 1, brightness: 1.12, fill: true }),
    section('finale', '준비 완료', 4, { lead: 'a', leadSequence: ['a', 'c', 'b', 'a'], counter: true, bass: true, arp: true, pad: true, drums: 0.5, energy: 0.84, chords: 'a', keyShift: 1, brightness: 1.06, fill: true }),
  ]),
  eternalDay: Object.freeze([
    section('intro', '여명', 2, { lead: false, counter: true, bass: true, arp: true, pad: true, drums: 0.1, energy: 0.28, chords: 'a', strings: 0.48, pulse: 0.12, brightness: 0.86 }),
    section('theme-a', '루트 탐색', 6, { lead: 'a', leadSequence: ['a', 'a', 'c', 'a', 'c', 'a'], counter: false, bass: true, arp: true, pad: true, drums: 0.46, energy: 0.6, chords: 'a', pulse: 0.48 }),
    section('turn', '발견', 2, { lead: false, counter: true, bass: false, arp: true, pad: false, drums: 0.28, energy: 0.44, chords: 'b', pulse: 0.22 }),
    section('bridge', '이동 경로', 4, { lead: 'c', leadSequence: ['c', 'a', 'c', 'b'], counter: true, bass: true, arp: false, pad: true, drums: 0.5, energy: 0.66, chords: 'b', strings: 0.72, pulse: 0.42 }),
    section('theme-b', '장비 완성', 6, { lead: 'b', leadSequence: ['b', 'b', 'c', 'b', 'a', 'b'], counter: true, bass: true, arp: true, pad: true, drums: 0.74, energy: 0.84, chords: 'b', pulse: 0.76 }),
    section('break', '숨 고르기', 2, { lead: 'c', counter: false, bass: false, arp: true, pad: true, drums: 0.14, energy: 0.36, chords: 'a', strings: 0.8, pulse: 0.08, brightness: 0.84 }),
    section('return', '다음 구역', 5, { lead: 'a', leadSequence: ['a', 'c', 'a', 'b', 'a'], counter: true, bass: true, arp: true, pad: true, drums: 0.7, energy: 0.88, chords: 'a', pulse: 0.7 }),
    section('turn', '하이퍼루프', 1, { lead: false, counter: true, bass: false, arp: true, pad: false, drums: 0.36, energy: 0.5, chords: 'b', riser: 0.92 }),
    section('climax', '오브젝트 쟁탈', 6, { lead: 'b', leadSequence: ['b', 'c', 'b', 'a', 'c', 'b'], counter: true, bass: true, arp: true, pad: true, drums: 0.92, energy: 1.04, chords: 'b', keyShift: 1, brightness: 1.24, fill: true }),
    section('finale', '해 질 녘', 6, { lead: 'a', leadSequence: ['a', 'c', 'b', 'a', 'b', 'a'], counter: true, bass: true, arp: true, pad: true, drums: 0.8, energy: 0.94, chords: 'a', keyShift: 1, brightness: 1.12, fill: true }),
  ]),
  eternalNight: Object.freeze([
    section('intro', '야간 경보', 2, { lead: false, counter: false, bass: true, arp: true, pad: true, drums: 0.12, energy: 0.3, chords: 'a', strings: 0.7, pulse: 0.08, brightness: 0.62 }),
    section('theme-a', '어둠 속 이동', 5, { lead: 'a', leadSequence: ['a', 'c', 'a', 'a', 'c'], counter: false, bass: true, arp: true, pad: true, drums: 0.54, energy: 0.66, chords: 'a', strings: 0.78, pulse: 0.46, brightness: 0.82 }),
    section('turn', '접근 신호', 2, { lead: false, counter: true, bass: false, arp: true, pad: false, drums: 0.42, energy: 0.52, chords: 'b', riser: 0.9, pulse: 0.3 }),
    section('theme-b', '금지구역 확장', 6, { lead: 'b', leadSequence: ['b', 'b', 'c', 'b', 'a', 'b'], counter: true, bass: true, arp: true, pad: true, drums: 0.9, energy: 0.94, chords: 'b', pulse: 0.82 }),
    section('break', '시야 차단', 3, { lead: 'c', counter: false, bass: false, arp: true, pad: true, drums: 0.18, energy: 0.34, chords: 'a', strings: 0.92, pulse: 0.06, brightness: 0.58 }),
    section('bridge', '추적', 4, { lead: 'c', leadSequence: ['c', 'a', 'c', 'b'], counter: true, bass: true, arp: false, pad: true, drums: 0.62, energy: 0.72, chords: 'b', pulse: 0.5 }),
    section('drift-b', '빛 없는 골목', 4, { lead: 'a', leadSequence: ['a', 'c', 'b', 'c'], counter: true, bass: true, arp: true, pad: true, drums: 0.52, energy: 0.78, chords: 'a', strings: 0.88, pulse: 0.44, brightness: 0.76 }),
    section('return', '생존자 추적', 4, { lead: 'a', leadSequence: ['a', 'b', 'c', 'a'], counter: true, bass: true, arp: true, pad: true, drums: 0.82, energy: 0.9, chords: 'a', pulse: 0.74 }),
    section('climax', '위험 구역', 6, { lead: 'b', leadSequence: ['b', 'c', 'b', 'a', 'c', 'b'], counter: true, bass: true, arp: true, pad: true, drums: 1, energy: 1.06, chords: 'b', keyShift: 1, brightness: 1.15, fill: true }),
    section('finale', '새벽 직전', 4, { lead: 'a', leadSequence: ['a', 'c', 'b', 'a'], counter: true, bass: true, arp: true, pad: true, drums: 0.76, energy: 0.82, chords: 'a', brightness: 0.88, fill: true }),
  ]),
  eternalCombat: Object.freeze([
    section('intro', '교전 개시', 2, { lead: false, counter: false, bass: true, arp: true, pad: true, drums: 0.58, energy: 0.5, chords: 'a', strings: 0.5, pulse: 0.46, brightness: 0.9 }),
    section('theme-a', '선제 압박', 5, { lead: 'a', leadSequence: ['a', 'c', 'a', 'b', 'a'], counter: false, bass: true, arp: true, pad: true, drums: 1, energy: 0.98, chords: 'a', pulse: 0.92 }),
    section('turn', '반격', 1, { lead: 'c', counter: true, bass: false, arp: true, pad: false, drums: 0.82, energy: 0.76, chords: 'b', riser: 0.95 }),
    section('theme-b', '화력 집중', 6, { lead: 'b', leadSequence: ['b', 'b', 'c', 'b', 'a', 'b'], counter: true, bass: true, arp: true, pad: true, drums: 1.1, energy: 1.08, chords: 'b', pulse: 1, brightness: 1.16 }),
    section('break', '재정비', 2, { lead: false, counter: true, bass: false, arp: true, pad: true, drums: 0.32, energy: 0.45, chords: 'a', strings: 0.82, pulse: 0.12, brightness: 0.74 }),
    section('return', '전선 복귀', 5, { lead: 'a', leadSequence: ['a', 'c', 'a', 'b', 'a'], counter: true, bass: true, arp: true, pad: true, drums: 1.06, energy: 1.04, chords: 'a', pulse: 0.96 }),
    section('bridge', '결정타 준비', 4, { lead: 'c', leadSequence: ['c', 'a', 'c', 'b'], counter: true, bass: true, arp: false, pad: true, drums: 0.88, energy: 0.86, chords: 'b', pulse: 0.72, riser: 0.9 }),
    section('interlude', '사선 이탈', 2, { lead: 'c', counter: true, bass: false, arp: true, pad: true, drums: 0.36, energy: 0.48, chords: 'a', strings: 0.84, pulse: 0.08, brightness: 0.7 }),
    section('climax', '결정 교전', 6, { lead: 'b', leadSequence: ['b', 'c', 'b', 'a', 'c', 'b'], counter: true, bass: true, arp: true, pad: true, drums: 1.14, energy: 1.13, chords: 'b', keyShift: 1, brightness: 1.3, fill: true }),
    section('return', '승부처', 4, { lead: 'a', leadSequence: ['a', 'b', 'c', 'a'], counter: true, bass: true, arp: true, pad: true, drums: 1.1, energy: 1.1, chords: 'a', keyShift: 1, brightness: 1.22, fill: true }),
    section('finale', '승부 확정', 7, { lead: 'b', leadSequence: ['b', 'c', 'b', 'a', 'b', 'c', 'b'], counter: true, bass: true, arp: true, pad: true, drums: 1.16, energy: 1.15, chords: 'b', keyShift: 1, brightness: 1.34, fill: true }),
  ]),
  eternalFinal: Object.freeze([
    section('intro', '최종 경보', 2, { lead: false, counter: false, bass: true, arp: true, pad: true, drums: 0.62, energy: 0.55, chords: 'a', strings: 0.72, pulse: 0.44, brightness: 0.82 }),
    section('theme-a', '안전지대 수축', 5, { lead: 'a', leadSequence: ['a', 'c', 'a', 'b', 'a'], counter: false, bass: true, arp: true, pad: true, drums: 1, energy: 0.98, chords: 'a', pulse: 0.92 }),
    section('turn', '생존자 포착', 1, { lead: 'c', counter: true, bass: false, arp: true, pad: false, drums: 0.86, energy: 0.82, chords: 'b', riser: 1 }),
    section('theme-b', '최후의 추적', 6, { lead: 'b', leadSequence: ['b', 'b', 'c', 'b', 'a', 'b'], counter: true, bass: true, arp: true, pad: true, drums: 1.12, energy: 1.1, chords: 'b', pulse: 1, brightness: 1.2 }),
    section('break', '한계선', 2, { lead: false, counter: true, bass: false, arp: true, pad: true, drums: 0.34, energy: 0.48, chords: 'a', strings: 0.96, pulse: 0.08, brightness: 0.68 }),
    section('bridge', '남은 한 팀', 4, { lead: 'c', leadSequence: ['c', 'a', 'c', 'b'], counter: true, bass: true, arp: false, pad: true, drums: 0.98, energy: 1, chords: 'b', pulse: 0.8, riser: 0.94 }),
    section('return', '결판', 5, { lead: 'a', leadSequence: ['a', 'b', 'c', 'a', 'b'], counter: true, bass: true, arp: true, pad: true, drums: 1.1, energy: 1.08, chords: 'a', pulse: 0.96 }),
    section('interlude', '정적', 2, { lead: 'c', counter: true, bass: false, arp: true, pad: true, drums: 0.28, energy: 0.52, chords: 'a', strings: 1, pulse: 0.04, brightness: 0.62 }),
    section('climax', '마지막 안전지대', 7, { lead: 'b', leadSequence: ['b', 'c', 'b', 'a', 'c', 'b', 'b'], counter: true, bass: true, arp: true, pad: true, drums: 1.16, energy: 1.15, chords: 'b', keyShift: 1, brightness: 1.34, fill: true }),
    section('return', '최후 생존', 5, { lead: 'a', leadSequence: ['a', 'c', 'b', 'a', 'b'], counter: true, bass: true, arp: true, pad: true, drums: 1.14, energy: 1.12, chords: 'a', keyShift: 1, brightness: 1.28, fill: true }),
    section('finale', '최후의 일격', 9, { lead: 'b', leadSequence: ['b', 'c', 'b', 'a', 'b', 'c', 'b', 'a', 'b'], counter: true, bass: true, arp: true, pad: true, drums: 1.18, energy: 1.17, chords: 'b', keyShift: 2, brightness: 1.38, fill: true }),
  ]),
  eternalResult: Object.freeze([
    section('intro', '전투 종료', 2, { lead: false, counter: false, bass: true, arp: true, pad: true, drums: 0.03, energy: 0.22, chords: 'a', strings: 0.72, pulse: 0.02, brightness: 0.72 }),
    section('drift-a', '생존 기록', 5, { lead: 'a', leadSequence: ['a', 'a', 'c', 'a', 'c'], counter: false, bass: true, arp: true, pad: true, drums: 0.1, energy: 0.44, chords: 'a', strings: 0.88, pulse: 0.1 }),
    section('theme-a', '귀환', 4, { lead: 'a', leadSequence: ['a', 'c', 'a', 'b'], counter: true, bass: true, arp: true, pad: true, drums: 0.16, energy: 0.58, chords: 'a', strings: 0.94, pulse: 0.18 }),
    section('interlude', '빈 자리', 3, { lead: 'c', counter: true, bass: false, arp: true, pad: true, drums: 0.03, energy: 0.25, chords: 'b', strings: 1, pulse: 0, brightness: 0.64 }),
    section('drift-b', '남겨진 이름', 5, { lead: 'b', leadSequence: ['b', 'c', 'b', 'a', 'b'], counter: true, bass: true, arp: true, pad: true, drums: 0.16, energy: 0.62, chords: 'b', strings: 0.96, pulse: 0.16 }),
    section('bridge', '기록 정리', 3, { lead: 'c', leadSequence: ['c', 'a', 'c'], counter: true, bass: true, arp: false, pad: true, drums: 0.08, energy: 0.42, chords: 'a', strings: 0.92, pulse: 0.08 }),
    section('return', '다음 출전', 4, { lead: 'a', leadSequence: ['a', 'c', 'b', 'a'], counter: true, bass: true, arp: true, pad: true, drums: 0.18, energy: 0.68, chords: 'a', strings: 1, pulse: 0.2 }),
    section('climax', '생존자의 이름', 3, { lead: 'b', leadSequence: ['b', 'c', 'b'], counter: true, bass: true, arp: true, pad: true, drums: 0.24, energy: 0.78, chords: 'b', keyShift: 1, brightness: 1.08, fill: true }),
    section('finale', '이터널 헝거', 3, { lead: 'a', leadSequence: ['a', 'c', 'a'], counter: true, bass: true, arp: false, pad: true, drums: 0.12, energy: 0.58, chords: 'a', keyShift: 1, strings: 1, pulse: 0.08, fill: true }),
  ]),
});

const DEFAULT_ARP = [0, 2, 4, 2, 1, 3, 5, 3, 0, 2, 4, 5, 1, 3, 5, 4];
const DEFAULT_PULSE = [0, null, 2, null, 4, null, 2, null, 1, null, 3, null, 5, null, 3, null];

function deriveLeadB(lead) {
  return lead.map((degree, index) => {
    const shifted = lead[(index + 8) % lead.length];
    if (shifted === null || shifted === undefined) return shifted;
    return Number(shifted) + (index >= 12 ? 1 : 0);
  });
}

function deriveLeadC(lead) {
  return lead.map((degree, index) => {
    const shifted = lead[(index + 4) % lead.length];
    if (shifted === null || shifted === undefined) return shifted;
    return Number(shifted) + (index >= 8 ? 1 : 0);
  });
}

function deriveCounter(lead) {
  return lead.map((degree, index) => (
    index % 4 === 2 && degree !== null && degree !== undefined ? Number(degree) + 4 : null
  ));
}

function profile(options) {
  const lead = freezePattern(options.lead);
  const arrangement = ARRANGEMENTS[options.arrangement || 'steady'] || ARRANGEMENTS.steady;
  const drumStyle = options.drumStyle || 'cinematic';
  const orchestrationBase = ORCHESTRATION_PALETTES[options.orchestrationStyle || drumStyle]
    || ORCHESTRATION_PALETTES.cinematic;
  const orchestration = Object.freeze({
    ...orchestrationBase,
    ...(options.orchestration || {}),
  });
  const chordRoots = Object.freeze([...(options.chordRoots || [0, 3, 1, 4])]);
  const chordRootsB = Object.freeze([...(options.chordRootsB || [...chordRoots.slice(1), chordRoots[0]])]);
  return Object.freeze({
    patternSteps: PATTERN_STEPS,
    steps: arrangement.reduce((sum, row) => sum + row.bars * PATTERN_STEPS, 0),
    leadWave: 'triangle',
    counterWave: 'sine',
    bassWave: 'sine',
    arpWave: 'triangle',
    leadGain: 0.12,
    counterGain: 0.052,
    bassGain: 0.105,
    arpGain: 0.038,
    padGain: 0.026,
    drumGain: 0.11,
    fxGain: 0.082,
    harmonyGain: 0.034,
    octaveGain: 0.02,
    leadOctave: 1,
    counterOctave: 1,
    bassOctave: -1,
    arpOctave: 1,
    padOctave: 0,
    ostinatoOctave: 0,
    brassOctave: 0,
    bellOctave: 2,
    choirOctave: 0,
    subOctave: -2,
    stringOctave: 1,
    pulseOctave: 0,
    leadLength: 1.85,
    counterLength: 1.35,
    arpLength: 0.72,
    pulseLength: 0.42,
    swing: 0,
    filterFrequency: 1800,
    filterPeak: 0.65,
    delayMix: 0.055,
    delayTime: 0.24,
    delayFeedback: 0.2,
    reverbMix: 0.065,
    flourish: DRUM_FLOURISH[drumStyle] || 0.9,
    harmonyInterval: 2,
    chordExtension: 6,
    padWave: 'sine',
    padDetune: 5,
    pumpDepth: 0.28,
    chordVoicing: Object.freeze([0, 2, 4]),
    ...options,
    lead,
    leadB: freezePattern(options.leadB, deriveLeadB(lead)),
    leadC: freezePattern(options.leadC, deriveLeadC(lead)),
    counter: freezePattern(options.counter, deriveCounter(lead)),
    bass: freezePattern(options.bass),
    arp: freezePattern(options.arp, DEFAULT_ARP),
    pulse: freezePattern(options.pulse, DEFAULT_PULSE),
    chordRoots,
    chordRootsB,
    chordVoicing: Object.freeze([...(options.chordVoicing || [0, 2, 4])]),
    arrangement,
    drums: DRUM_GROOVES[drumStyle] || DRUM_GROOVES.cinematic,
    orchestration,
  });
}

// All motifs and arrangements are original procedural material. No samples or quoted music are used.
export const GAME_BGM_PROFILES = Object.freeze({
  default: profile({
    label: '게임개발소', bpm: 86, rootFrequency: 110, mode: MODES.majorPentatonic,
    arrangement: 'steady', drumStyle: 'curious', swing: 0.04,
    lead: [0, null, 2, null, 3, null, 2, null, 1, null, 3, null, 4, 3, 2, null],
    leadB: [0, 2, 3, null, 4, 3, 2, 1, 2, 3, 4, null, 5, 4, 3, 2],
    counter: [null, 4, null, 3, null, 5, null, 4, null, 3, null, 5, null, 6, null, 4],
    bass: [0, null, null, null, 3, null, null, null, 1, null, null, null, 4, null, null, null],
    chordRoots: [0, 3, 1, 4], chordRootsB: [1, 4, 3, 0],
  }),
  battle: profile({
    label: '이터널 헝거', bpm: 104, rootFrequency: 73.42, mode: MODES.minor,
    arrangement: 'action', drumStyle: 'cinematic', leadWave: 'sawtooth', counterWave: 'triangle',
    leadGain: 0.085, counterGain: 0.042, filterFrequency: 1450, filterPeak: 0.82,
    delayMix: 0.035, reverbMix: 0.075,
    lead: [0, null, 2, 3, 4, null, 3, 2, 0, null, 4, null, 5, 4, 3, 2],
    leadB: [0, 2, 3, 4, 5, 4, 3, 2, 6, 5, 4, 3, 2, 4, 5, 6],
    counter: [null, 5, null, 4, null, 3, null, 2, null, 6, null, 5, null, 4, null, 3],
    bass: [0, null, 0, null, 5, null, 5, null, 3, null, 3, null, 4, null, 5, null],
    arp: [0, 2, 4, 2, 0, 2, 5, 2, 0, 3, 5, 3, 1, 3, 5, 4],
    chordRoots: [0, 5, 3, 4], chordRootsB: [0, 3, 5, 4],
  }),
  'eternal-ready': profile({
    label: '이터널 헝거 OST · 출전 대기', bpm: 82, rootFrequency: 73.42, mode: MODES.dorian,
    arrangement: 'eternalReady', drumStyle: 'ambient', orchestrationStyle: 'eternalAmbient',
    leadWave: 'sine', counterWave: 'triangle', bassWave: 'sine', padWave: 'triangle',
    leadGain: 0.082, counterGain: 0.034, bassGain: 0.082, arpGain: 0.026, padGain: 0.04,
    drumGain: 0.068, filterFrequency: 1420, filterPeak: 0.58,
    delayMix: 0.09, delayTime: 0.34, delayFeedback: 0.27, reverbMix: 0.15,
    leadLength: 2.35, counterLength: 1.8, arpLength: 0.84,
    fadeInSeconds: 1.35, crossfadeSeconds: 1.1, orchestraLevel: 0.88,
    lead: [0, null, 2, null, 3, null, 2, null, 0, null, 4, 3, 2, null, 1, null],
    leadB: [0, null, 2, 3, 4, null, 3, 2, 1, null, 3, 4, 5, 4, 2, null],
    leadC: [3, null, 4, null, 5, 4, 3, null, 2, null, 4, 3, 1, null, 0, null],
    counter: [null, 4, null, 3, null, 5, null, 4, null, 3, null, 5, null, 4, null, 2],
    bass: [0, null, null, null, 5, null, null, null, 3, null, null, null, 4, null, null, null],
    arp: [0, null, 2, 4, 1, null, 3, 5, 0, null, 3, 5, 1, null, 4, 5],
    pulse: [0, null, 2, null, 4, null, 2, null, 1, null, 3, null, 5, null, 3, null],
    chordRoots: [0, 5, 3, 4, 0, 3, 5, 4],
    chordRootsB: [3, 4, 0, 5, 3, 0, 4, 5],
    chordVoicing: [0, 2, 4, 6], chordExtension: 8, harmonyInterval: 2,
    orchestration: { bellGain: 0.03, choirGain: 0.034, ostinatoGain: 0.017 },
  }),
  'eternal-day': profile({
    label: '이터널 헝거 OST · 루미아의 낮', bpm: 106, rootFrequency: 82.41, mode: MODES.dorian,
    arrangement: 'eternalDay', drumStyle: 'curious', orchestrationStyle: 'eternalField', swing: 0.035,
    leadWave: 'triangle', counterWave: 'sine', bassWave: 'triangle', arpWave: 'triangle',
    leadGain: 0.092, counterGain: 0.04, bassGain: 0.09, arpGain: 0.032, padGain: 0.032,
    drumGain: 0.096, filterFrequency: 2380, filterPeak: 0.7,
    delayMix: 0.07, delayTime: 0.27, delayFeedback: 0.22, reverbMix: 0.095,
    leadLength: 1.95, counterLength: 1.5, fadeInSeconds: 1.05, crossfadeSeconds: 0.95,
    orchestraLevel: 0.9,
    lead: [0, null, 2, 3, 4, null, 3, 2, 0, null, 5, 4, 3, null, 2, null],
    leadB: [0, 2, 3, 4, 5, 4, 3, 2, 1, 3, 5, 6, 5, 4, 2, null],
    leadC: [3, null, 4, 5, 6, 5, 4, null, 2, 3, 4, null, 1, 2, 0, null],
    counter: [null, 5, null, 4, null, 6, null, 5, null, 4, null, 6, null, 5, null, 3],
    bass: [0, null, 0, null, 5, null, 5, null, 3, null, 3, null, 4, null, 4, null],
    arp: [0, 2, 4, 2, 1, 3, 5, 3, 0, 3, 5, 3, 1, 4, 6, 4],
    pulse: [0, null, 2, null, 4, null, 5, null, 0, null, 3, null, 5, null, 4, null],
    chordRoots: [0, 5, 3, 4, 0, 6, 3, 4],
    chordRootsB: [3, 4, 0, 5, 1, 4, 0, 6],
    chordVoicing: [0, 2, 4, 6], chordExtension: 8, harmonyInterval: 2,
    orchestration: { ostinatoGain: 0.029, bellGain: 0.026, brassGain: 0.026 },
  }),
  'eternal-night': profile({
    label: '이터널 헝거 OST · 금지구역 경보', bpm: 114, rootFrequency: 73.42, mode: MODES.minor,
    arrangement: 'eternalNight', drumStyle: 'cinematic', orchestrationStyle: 'eternalThreat',
    leadWave: 'sawtooth', counterWave: 'triangle', bassWave: 'sine', arpWave: 'square',
    leadGain: 0.072, counterGain: 0.038, bassGain: 0.105, arpGain: 0.024, padGain: 0.03,
    drumGain: 0.115, filterFrequency: 1570, filterPeak: 0.88,
    delayMix: 0.045, delayTime: 0.22, delayFeedback: 0.2, reverbMix: 0.09,
    leadLength: 1.72, counterLength: 1.25, fadeInSeconds: 0.9, crossfadeSeconds: 0.82,
    orchestraLevel: 0.92,
    lead: [0, null, 2, 3, 4, null, 3, 2, 0, null, 5, 4, 3, null, 2, null],
    leadB: [0, 2, 3, 4, 5, 4, 3, 2, 6, 5, 4, 3, 2, 4, 5, 6],
    leadC: [3, 4, 5, null, 6, 5, 4, 2, 1, 3, 4, null, 5, 3, 2, 0],
    counter: [null, 5, null, 4, null, 3, null, 2, null, 6, null, 5, null, 4, null, 3],
    bass: [0, null, 0, null, 5, null, 5, null, 3, null, 3, null, 4, null, 5, null],
    arp: [0, 2, 4, 6, 0, 3, 5, 3, 1, 3, 5, 6, 1, 4, 5, 4],
    pulse: [0, null, 0, null, 5, null, 3, null, 0, null, 4, null, 6, null, 3, null],
    chordRoots: [0, 5, 3, 4, 0, 6, 5, 4],
    chordRootsB: [0, 3, 5, 4, 1, 5, 3, 4],
    chordVoicing: [0, 2, 4, 6], chordExtension: 8, harmonyInterval: 2,
    orchestration: { ostinatoGain: 0.038, brassGain: 0.044, choirGain: 0.025, subGain: 0.058 },
  }),
  'eternal-combat': profile({
    label: '이터널 헝거 OST · 교전 개시', bpm: 149, rootFrequency: 73.42, mode: MODES.harmonicMinor,
    arrangement: 'eternalCombat', drumStyle: 'assault', orchestrationStyle: 'eternalAssault', swing: 0.012,
    leadWave: 'sawtooth', counterWave: 'square', bassWave: 'sawtooth', arpWave: 'square',
    leadGain: 0.064, counterGain: 0.028, bassGain: 0.108, arpGain: 0.024, padGain: 0.024,
    drumGain: 0.136, filterFrequency: 2680, filterPeak: 1.08,
    delayMix: 0.032, delayTime: 0.16, delayFeedback: 0.16, reverbMix: 0.06,
    leadLength: 1.45, counterLength: 1.1, arpLength: 0.58,
    fadeInSeconds: 0.62, crossfadeSeconds: 0.58, pumpDepth: 0.38, orchestraLevel: 0.94,
    lead: [0, 2, 3, 4, 3, 2, 0, 2, 4, 5, 4, 3, 2, 3, 4, 6],
    leadB: [0, 2, 4, 5, 6, 5, 4, 3, 2, 4, 5, 7, 6, 5, 4, 2],
    leadC: [3, 4, 5, 6, 7, 6, 5, 4, 2, 3, 5, 4, 3, 2, 1, 0],
    counter: [null, 5, null, 4, null, 6, null, 5, null, 4, null, 7, null, 6, null, 5],
    bass: [0, null, 0, null, 3, null, 3, null, 4, null, 4, null, 2, null, 3, null],
    arp: [0, 2, 4, 6, 1, 3, 5, 7, 0, 3, 5, 7, 1, 4, 6, 8],
    pulse: [0, null, 2, null, 4, null, 6, null, 0, null, 3, null, 5, null, 7, null],
    chordRoots: [0, 3, 4, 2, 0, 5, 3, 4],
    chordRootsB: [0, 4, 3, 2, 1, 4, 5, 3],
    chordVoicing: [0, 2, 4, 6], chordExtension: 8, harmonyInterval: 2,
    orchestration: { ostinatoGain: 0.046, brassGain: 0.048, subGain: 0.066, tomGain: 0.052 },
  }),
  'eternal-final': profile({
    label: '이터널 헝거 OST · 마지막 안전지대', bpm: 154, rootFrequency: 65.41, mode: MODES.harmonicMinor,
    arrangement: 'eternalFinal', drumStyle: 'assault', orchestrationStyle: 'eternalFinale',
    leadWave: 'sawtooth', counterWave: 'triangle', bassWave: 'sawtooth', arpWave: 'square',
    leadGain: 0.066, counterGain: 0.032, bassGain: 0.112, arpGain: 0.026, padGain: 0.028,
    drumGain: 0.142, filterFrequency: 2360, filterPeak: 1.12,
    delayMix: 0.04, delayTime: 0.17, delayFeedback: 0.17, reverbMix: 0.075,
    leadLength: 1.5, counterLength: 1.15, arpLength: 0.55,
    fadeInSeconds: 0.72, crossfadeSeconds: 0.66, pumpDepth: 0.42, orchestraLevel: 0.98,
    lead: [0, 2, 3, 4, 5, 4, 3, 2, 0, 3, 5, 4, 3, 2, 1, 0],
    leadB: [0, 2, 4, 5, 6, 7, 6, 5, 4, 6, 7, 8, 7, 6, 5, 4],
    leadC: [3, 5, 6, 7, 8, 7, 6, 4, 2, 4, 5, 6, 5, 3, 2, 0],
    counter: [null, 6, null, 5, null, 7, null, 6, null, 5, null, 8, null, 7, null, 5],
    bass: [0, null, 0, null, 5, null, 5, null, 3, null, 3, null, 4, null, 4, null],
    arp: [0, 2, 4, 6, 1, 3, 5, 7, 0, 3, 5, 7, 2, 4, 6, 8],
    pulse: [0, null, 2, null, 4, null, 7, null, 0, null, 3, null, 6, null, 8, null],
    chordRoots: [0, 5, 3, 4, 0, 6, 5, 4],
    chordRootsB: [0, 3, 5, 4, 1, 6, 3, 5],
    chordVoicing: [0, 2, 4, 6], chordExtension: 8, harmonyInterval: 2,
    orchestration: { ostinatoGain: 0.05, brassGain: 0.055, bellGain: 0.024, choirGain: 0.032, subGain: 0.07, tomGain: 0.06 },
  }),
  'eternal-result': profile({
    label: '이터널 헝거 OST · 생존 기록', bpm: 78, rootFrequency: 82.41, mode: MODES.majorPentatonic,
    arrangement: 'eternalResult', drumStyle: 'ambient', orchestrationStyle: 'eternalMemory',
    leadWave: 'sine', counterWave: 'triangle', bassWave: 'sine', arpWave: 'triangle', padWave: 'sine',
    leadGain: 0.084, counterGain: 0.038, bassGain: 0.072, arpGain: 0.022, padGain: 0.046,
    drumGain: 0.05, filterFrequency: 1320, filterPeak: 0.5,
    delayMix: 0.11, delayTime: 0.38, delayFeedback: 0.3, reverbMix: 0.17,
    leadLength: 2.8, counterLength: 2.1, arpLength: 0.92,
    fadeInSeconds: 1.6, crossfadeSeconds: 1.35, orchestraLevel: 0.9,
    lead: [0, null, 2, null, 3, null, 2, null, 0, null, 4, 3, 2, null, 1, null],
    leadB: [0, null, 2, 3, 4, null, 3, 2, 1, null, 3, 4, 5, 4, 2, null],
    leadC: [3, null, 4, null, 5, 4, 3, null, 2, null, 4, 3, 1, null, 0, null],
    counter: [null, 4, null, 3, null, 5, null, 4, null, 3, null, 5, null, 4, null, 2],
    bass: [0, null, null, null, 4, null, null, null, 3, null, null, null, 1, null, null, null],
    arp: [0, null, 2, 4, 1, null, 3, 4, 0, null, 3, 4, 1, null, 2, 4],
    pulse: [0, null, null, null, 2, null, null, null, 4, null, null, null, 3, null, null, null],
    chordRoots: [0, 4, 3, 1, 0, 2, 4, 1],
    chordRootsB: [3, 1, 0, 4, 2, 4, 0, 3],
    chordVoicing: [0, 2, 4, 6], chordExtension: 8, harmonyInterval: 2,
    orchestration: { ostinatoGain: 0.012, brassGain: 0.008, bellGain: 0.034, choirGain: 0.04, subGain: 0.026, tomGain: 0.012 },
  }),
  twenty: profile({
    label: '스무고개', bpm: 112, rootFrequency: 130.81, mode: MODES.majorPentatonic,
    arrangement: 'playful', drumStyle: 'curious', swing: 0.08, filterFrequency: 2500,
    delayMix: 0.09, delayTime: 0.19, reverbMix: 0.045,
    lead: [0, 2, null, 3, 4, null, 3, null, 1, 2, null, 4, 3, null, 2, null],
    leadB: [2, 3, 4, null, 5, 4, 2, null, 1, 3, 5, 4, 3, 2, 1, null],
    counter: [null, 5, null, 4, null, 6, null, 5, null, 4, null, 6, null, 5, null, 3],
    bass: [0, null, null, null, 3, null, null, null, 1, null, null, null, 4, null, null, null],
    chordRoots: [0, 3, 1, 4], chordRootsB: [1, 4, 0, 3],
  }),
  card: profile({
    label: '카드 듀얼', bpm: 98, rootFrequency: 110, mode: MODES.minor,
    arrangement: 'action', drumStyle: 'duel', filterFrequency: 1850,
    delayMix: 0.08, delayTime: 0.22, reverbMix: 0.08,
    lead: [0, null, 4, 3, 2, null, 5, null, 0, 2, 3, null, 6, 5, 4, null],
    leadB: [0, 2, 4, 5, 6, 5, 4, 3, 2, 4, 6, 5, 4, 3, 2, 1],
    counter: [null, 6, null, 5, null, 4, null, 3, null, 5, null, 6, null, 4, null, 2],
    bass: [0, null, null, null, 4, null, null, null, 5, null, null, null, 3, null, null, null],
    arp: [0, 4, 2, 4, 1, 5, 3, 5, 0, 4, 2, 6, 1, 5, 3, 4],
    chordRoots: [0, 4, 5, 3], chordRootsB: [0, 5, 4, 3],
  }),
  survival: profile({
    label: '문명 아카이브', bpm: 76, rootFrequency: 73.42, mode: MODES.minorPentatonic,
    arrangement: 'ambient', drumStyle: 'tribal', leadWave: 'sine', counterWave: 'triangle',
    leadGain: 0.1, padGain: 0.035, drumGain: 0.085, filterFrequency: 1250,
    delayMix: 0.07, delayTime: 0.31, reverbMix: 0.13,
    lead: [0, null, null, 2, null, 3, null, null, 1, null, null, 4, 3, null, 2, null],
    leadB: [0, null, 2, null, 4, null, 3, 2, 1, null, 3, null, 5, 4, 2, null],
    counter: [null, null, 4, null, null, 5, null, 3, null, null, 4, null, null, 6, null, 5],
    bass: [0, null, null, null, 3, null, null, null, 1, null, null, null, 4, null, null, null],
    arp: [0, null, 2, null, 4, null, 2, null, 1, null, 3, null, 5, null, 3, null],
    chordRoots: [0, 3, 1, 4], chordRootsB: [0, 4, 3, 1],
  }),
  kitchen: profile({
    label: '돈가스 선생', bpm: 122, rootFrequency: 130.81, mode: MODES.mixolydian,
    arrangement: 'playful', drumStyle: 'shuffle', swing: 0.11, filterFrequency: 2850,
    delayMix: 0.045, reverbMix: 0.04,
    lead: [0, 1, 2, null, 4, 3, 2, null, 1, 2, 4, null, 5, 4, 2, null],
    leadB: [0, 2, 4, 5, 4, 3, 2, 1, 3, 5, 6, 5, 4, 2, 1, null],
    counter: [null, 5, null, 4, null, 6, null, 5, null, 4, null, 6, null, 5, null, 3],
    bass: [0, null, 0, null, 4, null, 4, null, 1, null, 1, null, 5, null, 4, null],
    chordRoots: [0, 4, 1, 5], chordRootsB: [1, 5, 0, 4],
  }),
  idle: profile({
    label: '샬레 방치형 RPG', bpm: 70, rootFrequency: 98, mode: MODES.majorPentatonic,
    arrangement: 'ambient', drumStyle: 'ambient', leadWave: 'sine', counterWave: 'sine',
    leadGain: 0.095, padGain: 0.04, filterFrequency: 1650,
    delayMix: 0.1, delayTime: 0.34, reverbMix: 0.14,
    lead: [0, null, 2, null, 4, null, null, 3, 1, null, 2, null, 3, null, null, null],
    leadB: [0, null, 1, 2, null, 4, 3, null, 2, null, 3, 4, null, 5, 3, null],
    counter: [null, 4, null, null, 5, null, 4, null, null, 3, null, 5, null, 4, null, null],
    bass: [0, null, null, null, 3, null, null, null, 1, null, null, null, 4, null, null, null],
    chordRoots: [0, 3, 1, 4], chordRootsB: [1, 4, 0, 3],
  }),
  tactical: profile({
    label: 'BA SRPG', bpm: 108, rootFrequency: 82.41, mode: MODES.dorian,
    arrangement: 'action', drumStyle: 'march', leadWave: 'square', counterWave: 'triangle',
    leadGain: 0.06, counterGain: 0.04, filterFrequency: 1350, filterPeak: 0.95,
    delayMix: 0.035, reverbMix: 0.07,
    lead: [0, null, 2, null, 3, 4, 3, null, 0, null, 5, 4, 3, null, 2, null],
    leadB: [0, 2, 3, 4, 5, 3, 4, 2, 6, 5, 4, 3, 2, 4, 5, 3],
    counter: [null, 5, null, 4, null, 6, null, 5, null, 4, null, 6, null, 5, null, 3],
    bass: [0, null, 0, null, 5, null, 5, null, 3, null, 3, null, 4, null, 4, null],
    arp: [0, 2, 4, 2, 1, 3, 5, 3, 0, 3, 5, 3, 1, 4, 5, 4],
    chordRoots: [0, 5, 3, 4], chordRootsB: [0, 3, 5, 4],
  }),
  broadcast: profile({
    label: '스타리그', bpm: 126, rootFrequency: 110, mode: MODES.mixolydian,
    arrangement: 'action', drumStyle: 'drive', filterFrequency: 3100,
    leadGain: 0.105, delayMix: 0.07, delayTime: 0.18, reverbMix: 0.055,
    lead: [0, 2, 4, null, 5, 4, 2, null, 1, 3, 5, null, 6, 5, 4, 2],
    leadB: [0, 2, 4, 5, 6, 5, 4, 2, 1, 3, 5, 6, 7, 6, 5, 4],
    counter: [null, 5, null, 6, null, 4, null, 5, null, 6, null, 7, null, 5, null, 4],
    bass: [0, null, 0, null, 4, null, 4, null, 1, null, 1, null, 5, null, 4, null],
    chordRoots: [0, 4, 1, 5], chordRootsB: [1, 5, 0, 4],
  }),
  school: profile({
    label: '학교 시뮬레이터', bpm: 110, rootFrequency: 130.81, mode: MODES.major,
    arrangement: 'playful', drumStyle: 'shuffle', swing: 0.055, filterFrequency: 2650,
    delayMix: 0.055, reverbMix: 0.06,
    lead: [0, 1, 2, 4, 3, null, 2, null, 1, 2, 3, 5, 4, 3, 2, null],
    leadB: [0, 2, 4, 5, 4, 3, 2, 1, 2, 4, 6, 5, 4, 3, 2, 1],
    counter: [null, 5, null, 4, null, 6, null, 5, null, 4, null, 6, null, 5, null, 3],
    bass: [0, null, null, null, 3, null, null, null, 4, null, null, null, 1, null, null, null],
    chordRoots: [0, 3, 4, 1], chordRootsB: [1, 4, 3, 0],
  }),
  coding: profile({
    label: 'SI 코딩', bpm: 118, rootFrequency: 110, mode: MODES.dorian,
    arrangement: 'steady', drumStyle: 'digital', leadWave: 'square', counterWave: 'triangle',
    leadGain: 0.055, counterGain: 0.035, arpWave: 'square', arpGain: 0.025,
    filterFrequency: 1650, filterPeak: 1.05, delayMix: 0.1, delayTime: 0.16, reverbMix: 0.035,
    lead: [0, 2, 4, 6, 4, 2, 1, 3, 5, 3, 1, 0, 2, 4, 3, 1],
    leadB: [0, 2, 3, 5, 6, 4, 2, 1, 3, 5, 7, 5, 4, 2, 1, 0],
    counter: [null, 6, null, 5, null, 7, null, 6, null, 5, null, 4, null, 6, null, 5],
    bass: [0, null, null, null, 5, null, null, null, 3, null, null, null, 4, null, null, null],
    arp: [0, 2, 4, 6, 1, 3, 5, 3, 0, 2, 5, 2, 1, 4, 6, 4],
    chordRoots: [0, 5, 3, 4], chordRootsB: [0, 3, 5, 4],
  }),
  rail: profile({
    label: 'Rail3D', bpm: 108, rootFrequency: 87.31, mode: MODES.dorian,
    arrangement: 'steady', drumStyle: 'rail', filterFrequency: 1950,
    delayMix: 0.075, delayTime: 0.28, reverbMix: 0.07,
    lead: [0, null, 1, null, 2, null, 3, null, 4, null, 3, null, 2, 1, 0, null],
    leadB: [0, 1, 2, 3, 4, 5, 4, 3, 2, 3, 4, 5, 6, 5, 4, 2],
    counter: [null, 4, null, 5, null, 6, null, 5, null, 4, null, 6, null, 5, null, 3],
    bass: [0, null, 0, null, 3, null, 3, null, 4, null, 4, null, 1, null, 1, null],
    chordRoots: [0, 3, 4, 1], chordRootsB: [1, 4, 3, 0],
  }),
  ledger: profile({
    label: '회사 리포트', bpm: 84, rootFrequency: 98, mode: MODES.majorPentatonic,
    arrangement: 'ambient', drumStyle: 'ambient', leadWave: 'sine', counterWave: 'triangle',
    filterFrequency: 1550, delayMix: 0.065, delayTime: 0.3, reverbMix: 0.09,
    lead: [0, null, 1, 2, null, 3, null, 2, 1, null, 2, 3, null, 4, 3, null],
    leadB: [0, 1, 2, null, 3, 4, 3, 2, 1, 2, 3, null, 5, 4, 3, 2],
    counter: [null, 4, null, 3, null, 5, null, 4, null, 3, null, 5, null, 4, null, 2],
    bass: [0, null, null, null, 3, null, null, null, 1, null, null, null, 4, null, null, null],
    chordRoots: [0, 3, 1, 4], chordRootsB: [1, 4, 3, 0],
  }),
  racing: profile({
    label: '레이싱 로고', bpm: 144, rootFrequency: 82.41, mode: MODES.minorPentatonic,
    arrangement: 'action', drumStyle: 'drive', leadWave: 'sawtooth', counterWave: 'square',
    leadGain: 0.065, counterGain: 0.03, filterFrequency: 2100, filterPeak: 0.9,
    delayMix: 0.045, delayTime: 0.15, reverbMix: 0.04,
    lead: [0, 2, 3, 4, 3, 2, 0, 2, 4, 5, 4, 3, 2, 3, 4, 6],
    leadB: [0, 2, 4, 5, 6, 5, 4, 3, 2, 4, 5, 7, 6, 5, 4, 2],
    counter: [null, 5, null, 4, null, 6, null, 5, null, 4, null, 7, null, 6, null, 5],
    bass: [0, null, 0, null, 3, null, 3, null, 4, null, 4, null, 2, null, 3, null],
    arp: [0, 2, 4, 2, 1, 3, 5, 3, 0, 3, 5, 3, 2, 4, 6, 4],
    chordRoots: [0, 3, 4, 2], chordRootsB: [0, 4, 3, 2],
  }),
});

export const GAME_BGM_PROFILE_KEYS = Object.freeze(Object.keys(GAME_BGM_PROFILES));

export function gameBgmProfile(theme) {
  return GAME_BGM_PROFILES[String(theme || '').toLowerCase()] || GAME_BGM_PROFILES.default;
}

export function gameBgmStepDuration(profileValue) {
  const bpm = Math.max(40, Number(profileValue?.bpm || 80));
  return 60 / bpm / 4;
}

export function gameBgmArrangementState(profileValue, absoluteStep = 0) {
  const arrangement = profileValue?.arrangement?.length ? profileValue.arrangement : ARRANGEMENTS.steady;
  const totalSteps = Math.max(PATTERN_STEPS, Number(profileValue?.steps || PATTERN_STEPS));
  const cycleStep = ((Math.trunc(Number(absoluteStep || 0)) % totalSteps) + totalSteps) % totalSteps;
  let cursor = 0;
  for (let sectionIndex = 0; sectionIndex < arrangement.length; sectionIndex += 1) {
    const current = arrangement[sectionIndex];
    const sectionSteps = Math.max(PATTERN_STEPS, Number(current.bars || 1) * PATTERN_STEPS);
    if (cycleStep < cursor + sectionSteps) {
      const sectionStep = cycleStep - cursor;
      return {
        section: current,
        sectionIndex,
        sectionStep,
        sectionSteps,
        cycleStep,
        patternStep: sectionStep % PATTERN_STEPS,
        barIndex: Math.floor(cycleStep / PATTERN_STEPS),
        sectionBarIndex: Math.floor(sectionStep / PATTERN_STEPS),
      };
    }
    cursor += sectionSteps;
  }
  return gameBgmArrangementState({ ...profileValue, arrangement: ARRANGEMENTS.steady, steps: PATTERN_STEPS }, 0);
}

export function gameBgmChordRoot(profileValue, arrangementState) {
  const roots = arrangementState?.section?.chords === 'b'
    ? profileValue?.chordRootsB
    : profileValue?.chordRoots;
  const safeRoots = roots?.length ? roots : [0];
  return Number(safeRoots[arrangementState?.barIndex % safeRoots.length] || 0)
    + Number(arrangementState?.section?.keyShift || 0);
}

export function gameBgmChordVoicing(profileValue, arrangementState) {
  const modeLength = Math.max(1, Number(profileValue?.mode?.length || 5));
  const baseVoicing = [...(profileValue?.chordVoicing?.length ? profileValue.chordVoicing : [0, 2, 4])];
  if (
    Number(arrangementState?.section?.energy || 0) >= 0.9
    || Number(arrangementState?.section?.harmony || 0) >= 0.35
  ) {
    baseVoicing.push(Number(profileValue?.chordExtension || modeLength - 1));
  }
  const voicing = [...new Set(baseVoicing.map((degree) => Number(degree || 0)))];
  const inversionRange = Math.min(3, voicing.length);
  const inversion = inversionRange > 0
    ? (Number(arrangementState?.barIndex || 0) + Number(arrangementState?.sectionIndex || 0)) % inversionRange
    : 0;
  return voicing
    .map((degree, index) => degree + (index < inversion ? modeLength : 0))
    .sort((left, right) => left - right);
}

export function gameBgmNoteFrequency(profileValue, degree, octaveShift = 0) {
  const mode = profileValue?.mode?.length ? profileValue.mode : MODES.majorPentatonic;
  const numericDegree = Math.trunc(Number(degree || 0));
  const modeIndex = ((numericDegree % mode.length) + mode.length) % mode.length;
  const octave = Math.floor(numericDegree / mode.length) + Number(octaveShift || 0);
  const semitones = Number(mode[modeIndex] || 0) + octave * 12;
  return Number(profileValue?.rootFrequency || 110) * (2 ** (semitones / 12));
}
