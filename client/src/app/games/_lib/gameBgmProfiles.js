const PATTERN_STEPS = 16;

export const GAME_BGM_LAYER_ROLES = Object.freeze([
  'lead',
  'harmony',
  'octave',
  'counter',
  'arpeggio',
  'bass',
  'pad',
  'kick',
  'snare',
  'hi-hat',
  'percussion',
  'transition-fx',
]);

const MODES = Object.freeze({
  major: Object.freeze([0, 2, 4, 5, 7, 9, 11]),
  minor: Object.freeze([0, 2, 3, 5, 7, 8, 10]),
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
});

const SECTION_FLOURISHES = Object.freeze({
  intro: Object.freeze({ crash: 0.42, harmony: 0, octave: 0, pump: 0.1, riser: 0.12, stabs: false }),
  'theme-a': Object.freeze({ crash: 0.3, harmony: 0.14, octave: 0, pump: 0.24, riser: 0.24, stabs: false }),
  turn: Object.freeze({ crash: 0.12, harmony: 0.12, octave: 0, pump: 0.1, riser: 0.72, stabs: false }),
  break: Object.freeze({ crash: 0.1, harmony: 0.18, octave: 0.08, pump: 0.08, riser: 0.78, stabs: false }),
  bridge: Object.freeze({ crash: 0.16, harmony: 0.24, octave: 0.1, pump: 0.14, riser: 0.68, stabs: false }),
  'theme-b': Object.freeze({ crash: 0.86, harmony: 0.58, octave: 0.3, pump: 0.38, riser: 0.36, stabs: true }),
  return: Object.freeze({ crash: 0.58, harmony: 0.44, octave: 0.24, pump: 0.32, riser: 0.46, stabs: true }),
  finale: Object.freeze({ crash: 1, harmony: 0.8, octave: 0.52, pump: 0.46, riser: 1, stabs: true }),
  'drift-a': Object.freeze({ crash: 0.16, harmony: 0.1, octave: 0, pump: 0.06, riser: 0.14, stabs: false }),
  interlude: Object.freeze({ crash: 0.08, harmony: 0.2, octave: 0.08, pump: 0.04, riser: 0.54, stabs: false }),
  'drift-b': Object.freeze({ crash: 0.36, harmony: 0.38, octave: 0.18, pump: 0.12, riser: 0.34, stabs: false }),
});

const DRUM_FLOURISH = Object.freeze({
  ambient: 0.56,
  cinematic: 1.05,
  curious: 0.88,
  digital: 1.04,
  drive: 1.18,
  duel: 1.1,
  march: 1,
  rail: 0.84,
  shuffle: 0.92,
  tribal: 0.72,
});

function section(id, label, bars, options = {}) {
  return Object.freeze({
    crash: 0,
    harmony: 0,
    octave: 0,
    pump: 0,
    riser: 0,
    stabs: false,
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
    section('finale', '피날레', 2, { lead: 'b', counter: true, bass: true, arp: true, pad: true, drums: 1.08, energy: 1.08, chords: 'b', fill: true }),
  ]),
  playful: Object.freeze([
    section('intro', '인트로', 2, { lead: false, counter: true, bass: true, arp: true, pad: true, drums: 0.32, energy: 0.5, chords: 'a' }),
    section('theme-a', 'A 테마', 3, { lead: 'a', counter: false, bass: true, arp: true, pad: true, drums: 0.72, energy: 0.78, chords: 'a' }),
    section('turn', '전환', 1, { lead: false, counter: true, bass: false, arp: true, pad: false, drums: 0.42, energy: 0.56, chords: 'b' }),
    section('theme-b', 'B 테마', 4, { lead: 'b', counter: true, bass: true, arp: true, pad: true, drums: 0.9, energy: 0.96, chords: 'b' }),
    section('break', '브레이크', 2, { lead: 'a', counter: false, bass: false, arp: true, pad: true, drums: 0.26, energy: 0.48, chords: 'a' }),
    section('finale', '피날레', 4, { lead: 'b', counter: true, bass: true, arp: true, pad: true, drums: 1, energy: 1.04, chords: 'b', fill: true }),
  ]),
  ambient: Object.freeze([
    section('intro', '여백', 2, { lead: false, counter: false, bass: true, arp: true, pad: true, drums: 0.16, energy: 0.38, chords: 'a' }),
    section('drift-a', 'A 흐름', 4, { lead: 'a', counter: false, bass: true, arp: true, pad: true, drums: 0.36, energy: 0.58, chords: 'a' }),
    section('interlude', '간주', 2, { lead: false, counter: true, bass: false, arp: true, pad: true, drums: 0.12, energy: 0.34, chords: 'b' }),
    section('drift-b', 'B 흐름', 4, { lead: 'b', counter: true, bass: true, arp: true, pad: true, drums: 0.42, energy: 0.68, chords: 'b' }),
    section('return', '귀환', 4, { lead: 'a', counter: true, bass: true, arp: false, pad: true, drums: 0.28, energy: 0.54, chords: 'a', fill: true }),
  ]),
  steady: Object.freeze([
    section('intro', '도입', 2, { lead: false, counter: false, bass: true, arp: true, pad: true, drums: 0.28, energy: 0.45, chords: 'a' }),
    section('theme-a', 'A 테마', 4, { lead: 'a', counter: false, bass: true, arp: true, pad: true, drums: 0.62, energy: 0.7, chords: 'a' }),
    section('bridge', '브리지', 2, { lead: false, counter: true, bass: true, arp: false, pad: true, drums: 0.34, energy: 0.48, chords: 'b' }),
    section('theme-b', 'B 테마', 4, { lead: 'b', counter: true, bass: true, arp: true, pad: true, drums: 0.76, energy: 0.84, chords: 'b' }),
    section('return', '리프라이즈', 2, { lead: 'a', counter: true, bass: true, arp: true, pad: true, drums: 0.68, energy: 0.76, chords: 'a' }),
    section('finale', '마감', 2, { lead: 'b', counter: true, bass: true, arp: false, pad: true, drums: 0.86, energy: 0.92, chords: 'b', fill: true }),
  ]),
});

const DEFAULT_ARP = [0, 2, 4, 2, 1, 3, 5, 3, 0, 2, 4, 5, 1, 3, 5, 4];

function deriveLeadB(lead) {
  return lead.map((degree, index) => {
    const shifted = lead[(index + 8) % lead.length];
    if (shifted === null || shifted === undefined) return shifted;
    return Number(shifted) + (index >= 12 ? 1 : 0);
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
    leadLength: 1.85,
    counterLength: 1.35,
    arpLength: 0.72,
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
    counter: freezePattern(options.counter, deriveCounter(lead)),
    bass: freezePattern(options.bass),
    arp: freezePattern(options.arp, DEFAULT_ARP),
    chordRoots,
    chordRootsB,
    chordVoicing: Object.freeze([...(options.chordVoicing || [0, 2, 4])]),
    arrangement,
    drums: DRUM_GROOVES[drumStyle] || DRUM_GROOVES.cinematic,
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
  return Number(safeRoots[arrangementState?.barIndex % safeRoots.length] || 0);
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
