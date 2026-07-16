const MODES = Object.freeze({
  major: Object.freeze([0, 2, 4, 5, 7, 9, 11]),
  minor: Object.freeze([0, 2, 3, 5, 7, 8, 10]),
  dorian: Object.freeze([0, 2, 3, 5, 7, 9, 10]),
  mixolydian: Object.freeze([0, 2, 4, 5, 7, 9, 10]),
  majorPentatonic: Object.freeze([0, 2, 4, 7, 9]),
  minorPentatonic: Object.freeze([0, 3, 5, 7, 10]),
});

function profile(options) {
  return Object.freeze({
    steps: 16,
    leadWave: 'triangle',
    bassWave: 'sine',
    leadGain: 0.19,
    bassGain: 0.16,
    padGain: 0.045,
    filterFrequency: 1800,
    ...options,
  });
}

// These short procedural motifs are original and intentionally avoid sampled or quoted music.
export const GAME_BGM_PROFILES = Object.freeze({
  default: profile({
    label: '게임개발소', bpm: 82, rootFrequency: 110, mode: MODES.majorPentatonic,
    lead: [0, null, 2, null, 3, null, 2, null, 1, null, 3, null, 4, 3, 2, null],
    bass: [0, null, null, null, 3, null, null, null, 1, null, null, null, 4, null, null, null],
    chordRoots: [0, 3, 1, 4],
  }),
  battle: profile({
    label: '이터널 헝거', bpm: 96, rootFrequency: 73.42, mode: MODES.minor,
    leadWave: 'sawtooth', leadGain: 0.12, filterFrequency: 1250,
    lead: [0, null, 2, 3, 4, null, 3, 2, 0, null, 4, null, 5, 4, 3, 2],
    bass: [0, null, 0, null, 5, null, 5, null, 3, null, 3, null, 4, null, 5, null],
    chordRoots: [0, 5, 3, 4],
  }),
  twenty: profile({
    label: '스무고개', bpm: 108, rootFrequency: 130.81, mode: MODES.majorPentatonic,
    lead: [0, 2, null, 3, 4, null, 3, null, 1, 2, null, 4, 3, null, 2, null],
    bass: [0, null, null, null, 3, null, null, null, 1, null, null, null, 4, null, null, null],
    chordRoots: [0, 3, 1, 4], filterFrequency: 2300,
  }),
  card: profile({
    label: '카드 듀얼', bpm: 90, rootFrequency: 110, mode: MODES.minor,
    lead: [0, null, 4, 3, 2, null, 5, null, 0, 2, 3, null, 6, 5, 4, null],
    bass: [0, null, null, null, 4, null, null, null, 5, null, null, null, 3, null, null, null],
    chordRoots: [0, 4, 5, 3], filterFrequency: 1700,
  }),
  survival: profile({
    label: '원시 아카이브', bpm: 72, rootFrequency: 73.42, mode: MODES.minorPentatonic,
    leadWave: 'sine', leadGain: 0.16,
    lead: [0, null, null, 2, null, 3, null, null, 1, null, null, 4, 3, null, 2, null],
    bass: [0, null, null, null, 3, null, null, null, 1, null, null, null, 4, null, null, null],
    chordRoots: [0, 3, 1, 4], filterFrequency: 1100,
  }),
  kitchen: profile({
    label: '돈가스 선생', bpm: 116, rootFrequency: 130.81, mode: MODES.mixolydian,
    lead: [0, 1, 2, null, 4, 3, 2, null, 1, 2, 4, null, 5, 4, 2, null],
    bass: [0, null, 0, null, 4, null, 4, null, 1, null, 1, null, 5, null, 4, null],
    chordRoots: [0, 4, 1, 5], filterFrequency: 2600,
  }),
  idle: profile({
    label: '샬레 방치형 RPG', bpm: 66, rootFrequency: 98, mode: MODES.majorPentatonic,
    leadWave: 'sine', leadGain: 0.15, padGain: 0.055,
    lead: [0, null, 2, null, 4, null, null, 3, 1, null, 2, null, 3, null, null, null],
    bass: [0, null, null, null, 3, null, null, null, 1, null, null, null, 4, null, null, null],
    chordRoots: [0, 3, 1, 4], filterFrequency: 1500,
  }),
  tactical: profile({
    label: 'BA SRPG', bpm: 100, rootFrequency: 82.41, mode: MODES.dorian,
    leadWave: 'square', leadGain: 0.075, filterFrequency: 1150,
    lead: [0, null, 2, null, 3, 4, 3, null, 0, null, 5, 4, 3, null, 2, null],
    bass: [0, null, 0, null, 5, null, 5, null, 3, null, 3, null, 4, null, 4, null],
    chordRoots: [0, 5, 3, 4],
  }),
  broadcast: profile({
    label: '스타리그', bpm: 120, rootFrequency: 110, mode: MODES.mixolydian,
    lead: [0, 2, 4, null, 5, 4, 2, null, 1, 3, 5, null, 6, 5, 4, 2],
    bass: [0, null, 0, null, 4, null, 4, null, 1, null, 1, null, 5, null, 4, null],
    chordRoots: [0, 4, 1, 5], filterFrequency: 2800,
  }),
  school: profile({
    label: '학교 시뮬레이터', bpm: 104, rootFrequency: 130.81, mode: MODES.major,
    lead: [0, 1, 2, 4, 3, null, 2, null, 1, 2, 3, 5, 4, 3, 2, null],
    bass: [0, null, null, null, 3, null, null, null, 4, null, null, null, 1, null, null, null],
    chordRoots: [0, 3, 4, 1], filterFrequency: 2400,
  }),
  coding: profile({
    label: 'SI 코딩', bpm: 112, rootFrequency: 110, mode: MODES.dorian,
    leadWave: 'square', leadGain: 0.07, filterFrequency: 1450,
    lead: [0, 2, 4, 6, 4, 2, 1, 3, 5, 3, 1, 0, 2, 4, 3, 1],
    bass: [0, null, null, null, 5, null, null, null, 3, null, null, null, 4, null, null, null],
    chordRoots: [0, 5, 3, 4],
  }),
  rail: profile({
    label: 'Rail3D', bpm: 102, rootFrequency: 87.31, mode: MODES.dorian,
    lead: [0, null, 1, null, 2, null, 3, null, 4, null, 3, null, 2, 1, 0, null],
    bass: [0, null, 0, null, 3, null, 3, null, 4, null, 4, null, 1, null, 1, null],
    chordRoots: [0, 3, 4, 1], filterFrequency: 1700,
  }),
  ledger: profile({
    label: '회사 리포트', bpm: 78, rootFrequency: 98, mode: MODES.majorPentatonic,
    leadWave: 'sine',
    lead: [0, null, 1, 2, null, 3, null, 2, 1, null, 2, 3, null, 4, 3, null],
    bass: [0, null, null, null, 3, null, null, null, 1, null, null, null, 4, null, null, null],
    chordRoots: [0, 3, 1, 4], filterFrequency: 1400,
  }),
  racing: profile({
    label: '레이싱 로고', bpm: 138, rootFrequency: 82.41, mode: MODES.minorPentatonic,
    leadWave: 'sawtooth', leadGain: 0.09, filterFrequency: 1750,
    lead: [0, 2, 3, 4, 3, 2, 0, 2, 4, 5, 4, 3, 2, 3, 4, 6],
    bass: [0, null, 0, null, 3, null, 3, null, 4, null, 4, null, 2, null, 3, null],
    chordRoots: [0, 3, 4, 2],
  }),
});

export const GAME_BGM_PROFILE_KEYS = Object.freeze(Object.keys(GAME_BGM_PROFILES));

export function gameBgmProfile(theme) {
  return GAME_BGM_PROFILES[String(theme || '').toLowerCase()] || GAME_BGM_PROFILES.default;
}

export function gameBgmStepDuration(profileValue) {
  const bpm = Math.max(40, Number(profileValue?.bpm || 80));
  return 60 / bpm / 2;
}

export function gameBgmNoteFrequency(profileValue, degree, octaveShift = 0) {
  const mode = profileValue?.mode?.length ? profileValue.mode : MODES.majorPentatonic;
  const numericDegree = Math.trunc(Number(degree || 0));
  const modeIndex = ((numericDegree % mode.length) + mode.length) % mode.length;
  const octave = Math.floor(numericDegree / mode.length) + Number(octaveShift || 0);
  const semitones = Number(mode[modeIndex] || 0) + octave * 12;
  return Number(profileValue?.rootFrequency || 110) * (2 ** (semitones / 12));
}
