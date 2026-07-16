'use client';

import { useCallback, useMemo, useRef, useSyncExternalStore } from 'react';
import { usePathname } from 'next/navigation';
import { inferGameActionSemantic } from './gameActionSemantics';
import { resolveGameAudioTheme } from './gameAudioThemes';
import { GAME_BGM_DUCK_EVENT } from './gameBgmPreferences';
import {
  GAME_SFX_PREFERENCE_EVENT,
  gameSfxPreferenceKey,
  readGameSfxPreference,
  writeGameSfxPreference,
} from './gameSfxPreferences';

const CUE_PROFILES = {
  click: [
    { frequency: 520, endFrequency: 390, duration: 0.055, type: 'triangle', gain: 0.12 },
  ],
  tab: [
    { frequency: 540, duration: 0.042, type: 'sine', gain: 0.08 },
    { frequency: 760, start: 0.035, duration: 0.062, type: 'sine', gain: 0.07 },
  ],
  select: [
    { frequency: 420, endFrequency: 500, duration: 0.06, type: 'triangle', gain: 0.09 },
  ],
  toggle: [
    { frequency: 360, endFrequency: 460, duration: 0.075, type: 'sine', gain: 0.1 },
  ],
  audioOn: [
    { frequency: 440, endFrequency: 620, duration: 0.07, type: 'triangle', gain: 0.075 },
    { frequency: 880, start: 0.055, duration: 0.11, type: 'sine', gain: 0.05 },
  ],
  audioOff: [
    { frequency: 620, endFrequency: 360, duration: 0.085, type: 'triangle', gain: 0.065 },
    { frequency: 190, start: 0.065, duration: 0.08, type: 'sine', gain: 0.035 },
  ],
  nav: [
    { frequency: 620, endFrequency: 820, duration: 0.07, type: 'sine', gain: 0.08 },
  ],
  warning: [
    { frequency: 230, endFrequency: 170, duration: 0.09, type: 'sawtooth', gain: 0.05 },
  ],
  confirm: [
    { frequency: 610, duration: 0.04, type: 'triangle', gain: 0.08 },
    { frequency: 910, start: 0.036, duration: 0.09, type: 'sine', gain: 0.06 },
  ],
  start: [
    { frequency: 360, endFrequency: 520, duration: 0.06, type: 'triangle', gain: 0.075 },
    { frequency: 760, start: 0.05, duration: 0.085, type: 'sine', gain: 0.055 },
  ],
  save: [
    { frequency: 520, duration: 0.045, type: 'triangle', gain: 0.07 },
    { frequency: 780, start: 0.04, duration: 0.075, type: 'sine', gain: 0.05 },
  ],
  load: [
    { frequency: 760, endFrequency: 520, duration: 0.075, type: 'triangle', gain: 0.065 },
  ],
  sync: [
    { frequency: 760, endFrequency: 460, duration: 0.075, type: 'triangle', gain: 0.052 },
    { frequency: 520, endFrequency: 820, start: 0.07, duration: 0.11, type: 'sine', gain: 0.045 },
  ],
  archive: [
    { frequency: 460, duration: 0.04, type: 'triangle', gain: 0.06 },
    { frequency: 620, start: 0.038, duration: 0.055, type: 'triangle', gain: 0.05 },
    { frequency: 820, start: 0.082, duration: 0.075, type: 'sine', gain: 0.04 },
  ],
  gather: [
    { source: 'noise', filterType: 'bandpass', frequency: 820, q: 1.4, duration: 0.055, gain: 0.075 },
    { frequency: 260, endFrequency: 210, duration: 0.075, type: 'triangle', gain: 0.065 },
  ],
  survivalFail: [
    { source: 'noise', filterType: 'lowpass', frequency: 760, duration: 0.065, gain: 0.035 },
    { frequency: 220, endFrequency: 145, start: 0.025, duration: 0.13, type: 'triangle', gain: 0.05 },
    { frequency: 108, start: 0.11, duration: 0.09, type: 'sine', gain: 0.025 },
  ],
  combat: [
    { source: 'noise', filterType: 'lowpass', frequency: 900, duration: 0.07, gain: 0.085 },
    { frequency: 210, endFrequency: 125, duration: 0.105, type: 'sawtooth', gain: 0.055 },
  ],
  phaseDay: [
    { frequency: 360, endFrequency: 520, duration: 0.08, type: 'triangle', gain: 0.055 },
    { frequency: 780, start: 0.065, duration: 0.1, type: 'sine', gain: 0.04 },
  ],
  phaseNight: [
    { frequency: 420, endFrequency: 260, duration: 0.12, type: 'sine', gain: 0.05 },
    { frequency: 170, start: 0.08, duration: 0.15, type: 'triangle', gain: 0.038 },
  ],
  elimination: [
    { source: 'noise', filterType: 'lowpass', frequency: 720, duration: 0.08, gain: 0.07 },
    { frequency: 190, endFrequency: 90, duration: 0.15, type: 'sawtooth', gain: 0.06 },
  ],
  attackMiss: [
    { source: 'noise', filterType: 'highpass', frequency: 1500, duration: 0.045, gain: 0.035 },
    { frequency: 520, endFrequency: 260, start: 0.025, duration: 0.1, type: 'triangle', gain: 0.045 },
  ],
  unitDown: [
    { frequency: 260, endFrequency: 150, duration: 0.11, type: 'square', gain: 0.045 },
    { frequency: 130, start: 0.09, duration: 0.16, type: 'sine', gain: 0.05 },
  ],
  revive: [
    { frequency: 280, endFrequency: 460, duration: 0.09, type: 'triangle', gain: 0.05 },
    { frequency: 690, start: 0.075, duration: 0.12, type: 'sine', gain: 0.045 },
  ],
  zoneLock: [
    { frequency: 240, endFrequency: 170, duration: 0.09, type: 'square', gain: 0.045 },
    { frequency: 240, endFrequency: 150, start: 0.12, duration: 0.12, type: 'square', gain: 0.042 },
  ],
  hyperloopJump: [
    { source: 'noise', filterType: 'highpass', frequency: 1500, duration: 0.045, gain: 0.025 },
    { frequency: 360, endFrequency: 1080, duration: 0.16, type: 'sine', gain: 0.05 },
    { frequency: 720, endFrequency: 1320, start: 0.06, duration: 0.12, type: 'triangle', gain: 0.032 },
  ],
  kioskRevive: [
    { frequency: 260, endFrequency: 460, duration: 0.1, type: 'triangle', gain: 0.05 },
    { frequency: 640, start: 0.07, duration: 0.09, type: 'triangle', gain: 0.042 },
    { frequency: 920, start: 0.145, duration: 0.13, type: 'sine', gain: 0.035 },
  ],
  riftOpen: [
    { frequency: 94, endFrequency: 170, duration: 0.24, type: 'sine', gain: 0.05 },
    { source: 'noise', filterType: 'bandpass', frequency: 540, q: 2.4, start: 0.04, duration: 0.18, gain: 0.028 },
    { frequency: 420, endFrequency: 760, start: 0.12, duration: 0.15, type: 'triangle', gain: 0.03 },
  ],
  riftBattle: [
    { source: 'noise', filterType: 'lowpass', frequency: 860, duration: 0.1, gain: 0.065 },
    { frequency: 210, endFrequency: 92, duration: 0.17, type: 'sawtooth', gain: 0.052 },
    { frequency: 320, endFrequency: 160, start: 0.1, duration: 0.14, type: 'square', gain: 0.032 },
  ],
  bossSpawn: [
    { frequency: 118, duration: 0.12, type: 'sawtooth', gain: 0.052 },
    { frequency: 92, start: 0.15, duration: 0.14, type: 'sawtooth', gain: 0.05 },
    { source: 'noise', filterType: 'lowpass', frequency: 460, start: 0.04, duration: 0.2, gain: 0.028 },
  ],
  bossDefeat: [
    { frequency: 280, endFrequency: 420, duration: 0.07, type: 'triangle', gain: 0.045 },
    { frequency: 560, start: 0.06, duration: 0.08, type: 'triangle', gain: 0.043 },
    { frequency: 840, start: 0.13, duration: 0.13, type: 'sine', gain: 0.04 },
  ],
  objectiveSpawn: [
    { frequency: 430, endFrequency: 650, duration: 0.08, type: 'triangle', gain: 0.043 },
    { frequency: 910, start: 0.065, duration: 0.12, type: 'sine', gain: 0.037 },
  ],
  rareSupply: [
    { frequency: 420, duration: 0.045, type: 'square', gain: 0.038 },
    { frequency: 630, start: 0.04, duration: 0.06, type: 'triangle', gain: 0.04 },
    { frequency: 840, start: 0.095, duration: 0.1, type: 'sine', gain: 0.034 },
  ],
  transcendSupply: [
    { frequency: 520, duration: 0.04, type: 'triangle', gain: 0.04 },
    { frequency: 780, start: 0.036, duration: 0.055, type: 'triangle', gain: 0.042 },
    { frequency: 1170, start: 0.086, duration: 0.13, type: 'sine', gain: 0.038 },
  ],
  specialCraft: [
    { source: 'noise', filterType: 'highpass', frequency: 1700, duration: 0.035, gain: 0.025 },
    { frequency: 520, endFrequency: 390, duration: 0.05, type: 'square', gain: 0.038 },
    { frequency: 860, start: 0.045, duration: 0.07, type: 'triangle', gain: 0.042 },
    { frequency: 1290, start: 0.105, duration: 0.12, type: 'sine', gain: 0.035 },
  ],
  suddenDeath: [
    { frequency: 250, endFrequency: 180, duration: 0.09, type: 'square', gain: 0.05 },
    { frequency: 250, endFrequency: 150, start: 0.12, duration: 0.11, type: 'square', gain: 0.05 },
    { frequency: 82, start: 0.04, duration: 0.26, type: 'sawtooth', gain: 0.035 },
  ],
  craft: [
    { frequency: 560, endFrequency: 430, duration: 0.045, type: 'square', gain: 0.04 },
    { frequency: 1120, start: 0.035, duration: 0.065, type: 'triangle', gain: 0.045 },
  ],
  consume: [
    { frequency: 420, endFrequency: 560, duration: 0.07, type: 'sine', gain: 0.06 },
  ],
  cook: [
    { source: 'noise', filterType: 'highpass', frequency: 1500, q: 0.8, duration: 0.09, gain: 0.045 },
    { frequency: 620, endFrequency: 520, duration: 0.055, type: 'triangle', gain: 0.045 },
  ],
  fry: [
    { source: 'noise', filterType: 'highpass', frequency: 1850, q: 0.9, duration: 0.14, gain: 0.052 },
    { frequency: 740, endFrequency: 560, start: 0.025, duration: 0.075, type: 'triangle', gain: 0.04 },
  ],
  grill: [
    { source: 'noise', filterType: 'bandpass', frequency: 980, q: 1.3, duration: 0.12, gain: 0.048 },
    { frequency: 280, endFrequency: 220, start: 0.02, duration: 0.095, type: 'sawtooth', gain: 0.038 },
  ],
  boil: [
    { frequency: 360, endFrequency: 430, duration: 0.055, type: 'sine', gain: 0.042 },
    { frequency: 520, endFrequency: 610, start: 0.045, duration: 0.07, type: 'sine', gain: 0.038 },
    { source: 'noise', filterType: 'lowpass', frequency: 620, start: 0.035, duration: 0.1, gain: 0.026 },
  ],
  simmer: [
    { frequency: 310, duration: 0.05, type: 'triangle', gain: 0.04 },
    { frequency: 390, start: 0.055, duration: 0.055, type: 'triangle', gain: 0.038 },
    { frequency: 470, start: 0.115, duration: 0.08, type: 'sine', gain: 0.035 },
  ],
  sauce: [
    { source: 'noise', filterType: 'bandpass', frequency: 1350, q: 2.1, duration: 0.065, gain: 0.032 },
    { frequency: 480, endFrequency: 760, duration: 0.1, type: 'sine', gain: 0.043 },
  ],
  dessert: [
    { frequency: 660, duration: 0.04, type: 'triangle', gain: 0.045 },
    { frequency: 990, start: 0.038, duration: 0.055, type: 'triangle', gain: 0.043 },
    { frequency: 1320, start: 0.085, duration: 0.09, type: 'sine', gain: 0.037 },
  ],
  cookFail: [
    { source: 'noise', filterType: 'lowpass', frequency: 620, duration: 0.08, gain: 0.05 },
    { frequency: 390, endFrequency: 210, start: 0.035, duration: 0.13, type: 'triangle', gain: 0.045 },
  ],
  methodLevelUp: [
    { source: 'noise', filterType: 'highpass', frequency: 2100, duration: 0.04, gain: 0.025 },
    { frequency: 520, duration: 0.045, type: 'triangle', gain: 0.045 },
    { frequency: 780, start: 0.04, duration: 0.06, type: 'triangle', gain: 0.045 },
    { frequency: 1040, start: 0.095, duration: 0.12, type: 'sine', gain: 0.04 },
  ],
  serve: [
    { frequency: 920, duration: 0.035, type: 'sine', gain: 0.05 },
    { frequency: 1240, start: 0.03, duration: 0.065, type: 'sine', gain: 0.038 },
  ],
  sales: [
    { frequency: 980, duration: 0.032, type: 'square', gain: 0.04 },
    { frequency: 1320, start: 0.03, duration: 0.055, type: 'triangle', gain: 0.04 },
  ],
  order: [
    { source: 'noise', filterType: 'bandpass', frequency: 1100, q: 1.4, duration: 0.055, gain: 0.04 },
    { frequency: 740, start: 0.04, duration: 0.07, type: 'triangle', gain: 0.04 },
  ],
  orderComplete: [
    { source: 'noise', filterType: 'highpass', frequency: 1700, duration: 0.035, gain: 0.032 },
    { frequency: 620, duration: 0.035, type: 'square', gain: 0.038 },
    { frequency: 930, start: 0.032, duration: 0.06, type: 'triangle', gain: 0.042 },
  ],
  cashCollect: [
    { frequency: 980, duration: 0.028, type: 'square', gain: 0.038 },
    { frequency: 1320, start: 0.03, duration: 0.04, type: 'square', gain: 0.036 },
    { frequency: 1760, start: 0.068, duration: 0.075, type: 'sine', gain: 0.035 },
  ],
  taxPaid: [
    { source: 'noise', filterType: 'bandpass', frequency: 900, q: 2.2, duration: 0.03, gain: 0.035 },
    { frequency: 520, duration: 0.04, type: 'triangle', gain: 0.045 },
    { frequency: 780, start: 0.038, duration: 0.07, type: 'sine', gain: 0.04 },
  ],
  ledgerClose: [
    { source: 'noise', filterType: 'lowpass', frequency: 720, duration: 0.045, gain: 0.04 },
    { frequency: 390, duration: 0.055, type: 'triangle', gain: 0.05 },
    { frequency: 585, start: 0.05, duration: 0.07, type: 'triangle', gain: 0.047 },
    { frequency: 780, start: 0.115, duration: 0.12, type: 'sine', gain: 0.04 },
  ],
  globalSettle: [
    { frequency: 440, endFrequency: 560, duration: 0.07, type: 'sine', gain: 0.045 },
    { frequency: 740, start: 0.055, duration: 0.075, type: 'triangle', gain: 0.042 },
    { frequency: 1110, start: 0.12, duration: 0.1, type: 'sine', gain: 0.035 },
  ],
  capitalAction: [
    { source: 'noise', filterType: 'bandpass', frequency: 1250, q: 1.8, duration: 0.035, gain: 0.032 },
    { frequency: 520, duration: 0.04, type: 'triangle', gain: 0.043 },
    { frequency: 1040, start: 0.038, duration: 0.08, type: 'sine', gain: 0.038 },
  ],
  orderCreated: [
    { source: 'noise', filterType: 'highpass', frequency: 1450, duration: 0.028, gain: 0.026 },
    { frequency: 480, duration: 0.04, type: 'triangle', gain: 0.043 },
    { frequency: 720, start: 0.036, duration: 0.065, type: 'sine', gain: 0.038 },
  ],
  shipmentPosted: [
    { source: 'noise', filterType: 'bandpass', frequency: 980, q: 1.5, duration: 0.045, gain: 0.032 },
    { frequency: 360, endFrequency: 520, duration: 0.07, type: 'triangle', gain: 0.045 },
    { frequency: 820, start: 0.058, duration: 0.075, type: 'sine', gain: 0.035 },
  ],
  productionPosted: [
    { frequency: 310, endFrequency: 250, duration: 0.04, type: 'square', gain: 0.035 },
    { source: 'noise', filterType: 'highpass', frequency: 1700, start: 0.028, duration: 0.035, gain: 0.026 },
    { frequency: 620, start: 0.055, duration: 0.075, type: 'triangle', gain: 0.04 },
  ],
  inventoryValued: [
    { frequency: 420, duration: 0.045, type: 'triangle', gain: 0.04 },
    { frequency: 560, start: 0.04, duration: 0.055, type: 'triangle', gain: 0.038 },
    { frequency: 700, start: 0.09, duration: 0.085, type: 'sine', gain: 0.034 },
  ],
  campaignLaunched: [
    { frequency: 660, endFrequency: 880, duration: 0.075, type: 'triangle', gain: 0.042 },
    { frequency: 1180, start: 0.06, duration: 0.08, type: 'sine', gain: 0.034 },
  ],
  exportPlanned: [
    { frequency: 390, endFrequency: 620, duration: 0.08, type: 'sine', gain: 0.04 },
    { frequency: 930, start: 0.065, duration: 0.08, type: 'triangle', gain: 0.034 },
  ],
  importPlanned: [
    { frequency: 760, endFrequency: 500, duration: 0.075, type: 'triangle', gain: 0.04 },
    { frequency: 330, start: 0.06, duration: 0.08, type: 'sine', gain: 0.034 },
  ],
  hedgeSigned: [
    { source: 'noise', filterType: 'bandpass', frequency: 1100, q: 2, duration: 0.03, gain: 0.025 },
    { frequency: 440, duration: 0.05, type: 'triangle', gain: 0.042 },
    { frequency: 880, start: 0.045, duration: 0.085, type: 'sine', gain: 0.036 },
  ],
  disclosureFiled: [
    { source: 'noise', filterType: 'highpass', frequency: 1600, duration: 0.028, gain: 0.025 },
    { frequency: 520, duration: 0.045, type: 'triangle', gain: 0.04 },
    { frequency: 780, start: 0.04, duration: 0.07, type: 'sine', gain: 0.036 },
  ],
  dividendDeclared: [
    { frequency: 880, duration: 0.03, type: 'square', gain: 0.034 },
    { frequency: 1175, start: 0.03, duration: 0.04, type: 'square', gain: 0.032 },
    { frequency: 1568, start: 0.068, duration: 0.08, type: 'sine', gain: 0.032 },
  ],
  capitalRaised: [
    { frequency: 330, endFrequency: 440, duration: 0.06, type: 'triangle', gain: 0.045 },
    { frequency: 660, start: 0.052, duration: 0.065, type: 'triangle', gain: 0.04 },
    { frequency: 990, start: 0.11, duration: 0.09, type: 'sine', gain: 0.034 },
  ],
  capitalClosed: [
    { source: 'noise', filterType: 'lowpass', frequency: 680, duration: 0.04, gain: 0.03 },
    { frequency: 390, duration: 0.05, type: 'triangle', gain: 0.043 },
    { frequency: 585, start: 0.045, duration: 0.06, type: 'triangle', gain: 0.04 },
  ],
  snapshotSaved: [
    { source: 'noise', filterType: 'bandpass', frequency: 1250, q: 2.4, duration: 0.025, gain: 0.022 },
    { frequency: 460, duration: 0.04, type: 'triangle', gain: 0.04 },
    { frequency: 690, start: 0.038, duration: 0.07, type: 'sine', gain: 0.035 },
  ],
  restorePreview: [
    { frequency: 720, endFrequency: 480, duration: 0.075, type: 'triangle', gain: 0.038 },
    { frequency: 600, endFrequency: 820, start: 0.07, duration: 0.09, type: 'sine', gain: 0.034 },
  ],
  ledgerRestored: [
    { frequency: 360, endFrequency: 520, duration: 0.065, type: 'triangle', gain: 0.043 },
    { frequency: 720, start: 0.055, duration: 0.075, type: 'triangle', gain: 0.039 },
    { frequency: 960, start: 0.12, duration: 0.1, type: 'sine', gain: 0.034 },
  ],
  reportBookmarked: [
    { frequency: 660, duration: 0.04, type: 'triangle', gain: 0.04 },
    { frequency: 990, start: 0.038, duration: 0.075, type: 'sine', gain: 0.034 },
  ],
  reportExported: [
    { frequency: 740, endFrequency: 520, duration: 0.055, type: 'triangle', gain: 0.04 },
    { frequency: 820, endFrequency: 1120, start: 0.05, duration: 0.085, type: 'sine', gain: 0.034 },
  ],
  tournament: [
    { frequency: 390, duration: 0.045, type: 'triangle', gain: 0.05 },
    { frequency: 585, start: 0.04, duration: 0.06, type: 'triangle', gain: 0.048 },
    { frequency: 780, start: 0.09, duration: 0.1, type: 'sine', gain: 0.04 },
  ],
  verdict: [
    { source: 'noise', filterType: 'lowpass', frequency: 540, duration: 0.05, gain: 0.055 },
    { frequency: 210, endFrequency: 155, duration: 0.085, type: 'square', gain: 0.04 },
  ],
  judgeCorrect: [
    { frequency: 560, duration: 0.04, type: 'triangle', gain: 0.05 },
    { frequency: 840, start: 0.035, duration: 0.065, type: 'sine', gain: 0.045 },
  ],
  judgeWrong: [
    { frequency: 360, endFrequency: 250, duration: 0.09, type: 'triangle', gain: 0.05 },
    { frequency: 180, start: 0.07, duration: 0.1, type: 'sine', gain: 0.04 },
  ],
  rest: [
    { frequency: 520, endFrequency: 310, duration: 0.13, type: 'sine', gain: 0.055 },
  ],
  research: [
    { frequency: 480, duration: 0.04, type: 'sine', gain: 0.055 },
    { frequency: 720, start: 0.038, duration: 0.055, type: 'sine', gain: 0.05 },
    { frequency: 960, start: 0.086, duration: 0.075, type: 'sine', gain: 0.04 },
  ],
  eraAdvance: [
    { source: 'noise', filterType: 'bandpass', frequency: 760, q: 1.4, duration: 0.07, gain: 0.028 },
    { frequency: 196, endFrequency: 220, duration: 0.16, type: 'triangle', gain: 0.052 },
    { frequency: 392, start: 0.08, duration: 0.13, type: 'triangle', gain: 0.05 },
    { frequency: 587, start: 0.19, duration: 0.15, type: 'sine', gain: 0.045 },
    { frequency: 784, start: 0.31, duration: 0.2, type: 'sine', gain: 0.038 },
  ],
  inspiration: [
    { source: 'noise', filterType: 'highpass', frequency: 1700, duration: 0.04, gain: 0.025 },
    { frequency: 440, endFrequency: 660, duration: 0.08, type: 'sine', gain: 0.048 },
    { frequency: 880, start: 0.065, duration: 0.11, type: 'sine', gain: 0.04 },
  ],
  civicComplete: [
    { source: 'noise', filterType: 'bandpass', frequency: 980, q: 1.8, duration: 0.045, gain: 0.03 },
    { frequency: 330, duration: 0.05, type: 'triangle', gain: 0.05 },
    { frequency: 495, start: 0.045, duration: 0.065, type: 'triangle', gain: 0.048 },
    { frequency: 660, start: 0.105, duration: 0.085, type: 'sine', gain: 0.042 },
  ],
  discover: [
    { source: 'noise', filterType: 'highpass', frequency: 1500, duration: 0.055, gain: 0.035 },
    { frequency: 520, endFrequency: 720, duration: 0.08, type: 'sine', gain: 0.05 },
    { frequency: 980, start: 0.07, duration: 0.1, type: 'sine', gain: 0.04 },
  ],
  project: [
    { source: 'noise', filterType: 'bandpass', frequency: 720, q: 1.8, duration: 0.04, gain: 0.055 },
    { frequency: 250, endFrequency: 180, duration: 0.085, type: 'triangle', gain: 0.06 },
  ],
  projectComplete: [
    { frequency: 390, duration: 0.045, type: 'triangle', gain: 0.055 },
    { frequency: 590, start: 0.04, duration: 0.065, type: 'triangle', gain: 0.05 },
    { frequency: 880, start: 0.095, duration: 0.11, type: 'sine', gain: 0.045 },
  ],
  season: [
    { frequency: 330, endFrequency: 460, duration: 0.12, type: 'sine', gain: 0.045 },
    { frequency: 660, start: 0.08, duration: 0.13, type: 'sine', gain: 0.035 },
  ],
  assign: [
    { frequency: 380, duration: 0.035, type: 'square', gain: 0.035 },
    { frequency: 510, start: 0.03, duration: 0.045, type: 'triangle', gain: 0.045 },
  ],
  diplomacy: [
    { frequency: 420, endFrequency: 510, duration: 0.075, type: 'sine', gain: 0.045 },
    { frequency: 630, start: 0.055, duration: 0.085, type: 'triangle', gain: 0.04 },
  ],
  growth: [
    { frequency: 440, duration: 0.045, type: 'triangle', gain: 0.05 },
    { frequency: 660, start: 0.04, duration: 0.06, type: 'triangle', gain: 0.045 },
    { frequency: 880, start: 0.092, duration: 0.095, type: 'sine', gain: 0.04 },
  ],
  match: [
    { frequency: 520, duration: 0.032, type: 'square', gain: 0.038 },
    { frequency: 660, start: 0.04, duration: 0.04, type: 'square', gain: 0.036 },
    { frequency: 880, start: 0.09, duration: 0.08, type: 'triangle', gain: 0.045 },
  ],
  cupStart: [
    { source: 'noise', filterType: 'highpass', frequency: 1600, duration: 0.045, gain: 0.03 },
    { frequency: 440, duration: 0.045, type: 'triangle', gain: 0.05 },
    { frequency: 660, start: 0.04, duration: 0.055, type: 'triangle', gain: 0.047 },
    { frequency: 880, start: 0.092, duration: 0.1, type: 'sine', gain: 0.042 },
  ],
  cupMatch: [
    { frequency: 560, duration: 0.035, type: 'square', gain: 0.042 },
    { frequency: 740, start: 0.035, duration: 0.045, type: 'triangle', gain: 0.044 },
    { frequency: 930, start: 0.078, duration: 0.075, type: 'sine', gain: 0.04 },
  ],
  winnersStart: [
    { frequency: 220, endFrequency: 310, duration: 0.09, type: 'sawtooth', gain: 0.045 },
    { frequency: 440, start: 0.07, duration: 0.09, type: 'triangle', gain: 0.048 },
    { frequency: 660, start: 0.145, duration: 0.12, type: 'sine', gain: 0.04 },
  ],
  winnersSet: [
    { frequency: 320, duration: 0.04, type: 'square', gain: 0.043 },
    { frequency: 480, start: 0.035, duration: 0.045, type: 'square', gain: 0.04 },
    { frequency: 720, start: 0.08, duration: 0.08, type: 'triangle', gain: 0.043 },
  ],
  comeback: [
    { frequency: 260, endFrequency: 340, duration: 0.055, type: 'triangle', gain: 0.05 },
    { frequency: 520, start: 0.05, duration: 0.065, type: 'triangle', gain: 0.048 },
    { frequency: 780, start: 0.11, duration: 0.08, type: 'triangle', gain: 0.045 },
    { frequency: 1040, start: 0.18, duration: 0.12, type: 'sine', gain: 0.04 },
  ],
  victory: [
    { source: 'noise', filterType: 'highpass', frequency: 1900, duration: 0.07, gain: 0.035 },
    { frequency: 520, duration: 0.045, type: 'triangle', gain: 0.05 },
    { frequency: 780, start: 0.04, duration: 0.06, type: 'triangle', gain: 0.05 },
    { frequency: 1040, start: 0.095, duration: 0.12, type: 'sine', gain: 0.045 },
  ],
  defeat: [
    { frequency: 430, endFrequency: 330, duration: 0.1, type: 'triangle', gain: 0.05 },
    { frequency: 260, endFrequency: 180, start: 0.08, duration: 0.13, type: 'sine', gain: 0.045 },
  ],
  champion: [
    { source: 'noise', filterType: 'bandpass', frequency: 1450, q: 0.8, duration: 0.16, gain: 0.045 },
    { frequency: 390, duration: 0.055, type: 'triangle', gain: 0.052 },
    { frequency: 585, start: 0.05, duration: 0.075, type: 'triangle', gain: 0.05 },
    { frequency: 780, start: 0.12, duration: 0.09, type: 'triangle', gain: 0.05 },
    { frequency: 1170, start: 0.2, duration: 0.18, type: 'sine', gain: 0.045 },
  ],
  sponsor: [
    { frequency: 740, duration: 0.04, type: 'triangle', gain: 0.045 },
    { frequency: 1110, start: 0.036, duration: 0.07, type: 'sine', gain: 0.042 },
  ],
  contract: [
    { source: 'noise', filterType: 'bandpass', frequency: 1200, q: 2.2, duration: 0.035, gain: 0.045 },
    { frequency: 420, start: 0.032, duration: 0.065, type: 'triangle', gain: 0.045 },
  ],
  transfer: [
    { frequency: 460, endFrequency: 720, duration: 0.075, type: 'triangle', gain: 0.045 },
    { frequency: 920, start: 0.065, duration: 0.075, type: 'sine', gain: 0.04 },
  ],
  recruit: [
    { frequency: 520, duration: 0.04, type: 'triangle', gain: 0.05 },
    { frequency: 780, start: 0.04, duration: 0.055, type: 'triangle', gain: 0.046 },
    { frequency: 1040, start: 0.09, duration: 0.09, type: 'sine', gain: 0.04 },
  ],
  release: [
    { source: 'noise', filterType: 'bandpass', frequency: 820, q: 2, duration: 0.04, gain: 0.04 },
    { frequency: 420, endFrequency: 240, start: 0.025, duration: 0.12, type: 'triangle', gain: 0.045 },
  ],
  unequip: [
    { source: 'noise', filterType: 'highpass', frequency: 1400, duration: 0.035, gain: 0.035 },
    { frequency: 640, endFrequency: 420, start: 0.02, duration: 0.08, type: 'triangle', gain: 0.042 },
  ],
  tradeRejected: [
    { frequency: 310, endFrequency: 250, duration: 0.075, type: 'square', gain: 0.046 },
    { frequency: 190, start: 0.065, duration: 0.1, type: 'sine', gain: 0.04 },
  ],
  judge: [
    { frequency: 190, endFrequency: 130, duration: 0.085, type: 'square', gain: 0.05 },
    { source: 'noise', filterType: 'bandpass', frequency: 520, q: 2, start: 0.045, duration: 0.055, gain: 0.06 },
  ],
  upgrade: [
    { frequency: 440, duration: 0.04, type: 'triangle', gain: 0.06 },
    { frequency: 660, start: 0.035, duration: 0.052, type: 'triangle', gain: 0.05 },
    { frequency: 990, start: 0.078, duration: 0.07, type: 'sine', gain: 0.04 },
  ],
  trade: [
    { frequency: 980, duration: 0.035, type: 'square', gain: 0.035 },
    { frequency: 1320, start: 0.032, duration: 0.055, type: 'triangle', gain: 0.04 },
  ],
  training: [
    { frequency: 320, endFrequency: 390, duration: 0.055, type: 'triangle', gain: 0.06 },
    { frequency: 480, start: 0.052, duration: 0.055, type: 'triangle', gain: 0.045 },
  ],
  policy: [
    { source: 'noise', filterType: 'lowpass', frequency: 620, duration: 0.045, gain: 0.055 },
    { frequency: 250, endFrequency: 190, duration: 0.08, type: 'square', gain: 0.04 },
  ],
  counsel: [
    { frequency: 480, endFrequency: 560, duration: 0.08, type: 'sine', gain: 0.05 },
    { frequency: 720, start: 0.065, duration: 0.1, type: 'sine', gain: 0.04 },
  ],
  lesson: [
    { frequency: 740, duration: 0.05, type: 'sine', gain: 0.05 },
    { frequency: 1110, start: 0.045, duration: 0.11, type: 'sine', gain: 0.04 },
  ],
  festival: [
    { source: 'noise', filterType: 'highpass', frequency: 1800, duration: 0.06, gain: 0.035 },
    { frequency: 520, duration: 0.045, type: 'triangle', gain: 0.05 },
    { frequency: 780, start: 0.04, duration: 0.06, type: 'triangle', gain: 0.048 },
    { frequency: 1040, start: 0.095, duration: 0.12, type: 'sine', gain: 0.04 },
  ],
  semester: [
    { frequency: 660, duration: 0.08, type: 'sine', gain: 0.048 },
    { frequency: 880, start: 0.11, duration: 0.09, type: 'sine', gain: 0.045 },
    { frequency: 1100, start: 0.23, duration: 0.14, type: 'sine', gain: 0.04 },
  ],
  schoolBell: [
    { frequency: 740, duration: 0.055, type: 'sine', gain: 0.045 },
    { frequency: 1110, start: 0.07, duration: 0.12, type: 'sine', gain: 0.038 },
  ],
  schoolIncident: [
    { frequency: 620, endFrequency: 480, duration: 0.08, type: 'square', gain: 0.038 },
    { frequency: 620, endFrequency: 420, start: 0.11, duration: 0.1, type: 'square', gain: 0.035 },
  ],
  schoolResolution: [
    { frequency: 440, duration: 0.045, type: 'triangle', gain: 0.045 },
    { frequency: 660, start: 0.04, duration: 0.06, type: 'triangle', gain: 0.042 },
    { frequency: 880, start: 0.095, duration: 0.1, type: 'sine', gain: 0.036 },
  ],
  schoolCrisis: [
    { source: 'noise', filterType: 'lowpass', frequency: 620, duration: 0.055, gain: 0.04 },
    { frequency: 230, endFrequency: 150, duration: 0.12, type: 'sawtooth', gain: 0.045 },
    { frequency: 130, start: 0.1, duration: 0.14, type: 'sine', gain: 0.032 },
  ],
  schoolRecovery: [
    { frequency: 390, endFrequency: 520, duration: 0.08, type: 'sine', gain: 0.042 },
    { frequency: 780, start: 0.07, duration: 0.12, type: 'sine', gain: 0.036 },
  ],
  schoolNewRun: [
    { frequency: 440, duration: 0.06, type: 'triangle', gain: 0.042 },
    { frequency: 660, start: 0.055, duration: 0.075, type: 'triangle', gain: 0.04 },
    { frequency: 880, start: 0.125, duration: 0.13, type: 'sine', gain: 0.036 },
  ],
  schoolSemester: [
    { frequency: 520, duration: 0.07, type: 'sine', gain: 0.045 },
    { frequency: 660, start: 0.09, duration: 0.08, type: 'sine', gain: 0.042 },
    { frequency: 790, start: 0.19, duration: 0.14, type: 'sine', gain: 0.038 },
  ],
  schoolFestivalStart: [
    { source: 'noise', filterType: 'highpass', frequency: 1900, duration: 0.045, gain: 0.026 },
    { frequency: 660, endFrequency: 920, duration: 0.09, type: 'triangle', gain: 0.043 },
    { frequency: 1180, start: 0.075, duration: 0.12, type: 'sine', gain: 0.035 },
  ],
  schoolFestivalComplete: [
    { frequency: 520, duration: 0.04, type: 'triangle', gain: 0.04 },
    { frequency: 780, start: 0.038, duration: 0.055, type: 'triangle', gain: 0.042 },
    { frequency: 1040, start: 0.09, duration: 0.12, type: 'sine', gain: 0.038 },
  ],
  schoolPolicy: [
    { source: 'noise', filterType: 'bandpass', frequency: 760, q: 2.2, duration: 0.03, gain: 0.027 },
    { frequency: 360, duration: 0.055, type: 'square', gain: 0.038 },
    { frequency: 540, start: 0.05, duration: 0.085, type: 'triangle', gain: 0.04 },
  ],
  schoolBlocked: [
    { frequency: 310, endFrequency: 210, duration: 0.09, type: 'square', gain: 0.04 },
    { frequency: 160, start: 0.075, duration: 0.12, type: 'sine', gain: 0.03 },
  ],
  schoolCounseling: [
    { frequency: 350, endFrequency: 470, duration: 0.09, type: 'sine', gain: 0.04 },
    { frequency: 700, start: 0.075, duration: 0.13, type: 'sine', gain: 0.034 },
  ],
  schoolLesson: [
    { frequency: 540, duration: 0.045, type: 'triangle', gain: 0.04 },
    { frequency: 810, start: 0.042, duration: 0.08, type: 'sine', gain: 0.036 },
  ],
  schoolMaintenance: [
    { frequency: 280, endFrequency: 220, duration: 0.045, type: 'square', gain: 0.038 },
    { source: 'noise', filterType: 'highpass', frequency: 1600, start: 0.035, duration: 0.035, gain: 0.025 },
    { frequency: 620, start: 0.07, duration: 0.075, type: 'triangle', gain: 0.036 },
  ],
  schoolTeacher: [
    { frequency: 410, endFrequency: 520, duration: 0.075, type: 'triangle', gain: 0.04 },
    { frequency: 760, start: 0.065, duration: 0.1, type: 'sine', gain: 0.035 },
  ],
  schoolAdmission: [
    { frequency: 480, endFrequency: 680, duration: 0.075, type: 'triangle', gain: 0.041 },
    { frequency: 960, start: 0.065, duration: 0.1, type: 'sine', gain: 0.034 },
  ],
  schoolCareer: [
    { frequency: 390, endFrequency: 560, duration: 0.08, type: 'sine', gain: 0.04 },
    { frequency: 840, start: 0.07, duration: 0.11, type: 'triangle', gain: 0.035 },
  ],
  schoolClub: [
    { frequency: 260, duration: 0.04, type: 'square', gain: 0.036 },
    { frequency: 520, start: 0.04, duration: 0.06, type: 'triangle', gain: 0.04 },
    { frequency: 780, start: 0.095, duration: 0.09, type: 'sine', gain: 0.034 },
  ],
  schoolRest: [
    { frequency: 520, endFrequency: 390, duration: 0.11, type: 'sine', gain: 0.038 },
    { frequency: 260, start: 0.09, duration: 0.13, type: 'sine', gain: 0.03 },
  ],
  schoolVision: [
    { frequency: 420, endFrequency: 700, duration: 0.12, type: 'sine', gain: 0.038 },
    { frequency: 1050, start: 0.1, duration: 0.14, type: 'sine', gain: 0.032 },
  ],
  schoolOperation: [
    { frequency: 430, endFrequency: 560, duration: 0.055, type: 'triangle', gain: 0.04 },
    { frequency: 720, start: 0.05, duration: 0.075, type: 'sine', gain: 0.035 },
  ],
  advance: [
    { frequency: 430, endFrequency: 620, duration: 0.075, type: 'triangle', gain: 0.06 },
    { frequency: 860, start: 0.06, duration: 0.07, type: 'sine', gain: 0.045 },
  ],
  dispatch: [
    { source: 'noise', filterType: 'highpass', frequency: 1600, duration: 0.04, gain: 0.055 },
    { frequency: 310, duration: 0.055, type: 'triangle', gain: 0.06 },
    { frequency: 390, start: 0.052, duration: 0.065, type: 'triangle', gain: 0.05 },
  ],
  railStep: [
    { source: 'noise', filterType: 'bandpass', frequency: 920, q: 2.4, duration: 0.028, gain: 0.035 },
    { frequency: 240, duration: 0.034, type: 'triangle', gain: 0.042 },
    { frequency: 320, start: 0.035, duration: 0.038, type: 'triangle', gain: 0.038 },
  ],
  trainDepart: [
    { source: 'noise', filterType: 'highpass', frequency: 1450, duration: 0.045, gain: 0.03 },
    { frequency: 420, endFrequency: 690, duration: 0.09, type: 'sine', gain: 0.047 },
    { frequency: 820, start: 0.07, duration: 0.075, type: 'triangle', gain: 0.035 },
  ],
  stationArrive: [
    { frequency: 880, duration: 0.04, type: 'sine', gain: 0.044 },
    { frequency: 660, start: 0.038, duration: 0.05, type: 'sine', gain: 0.042 },
    { frequency: 440, start: 0.084, duration: 0.075, type: 'sine', gain: 0.038 },
  ],
  delayedArrival: [
    { frequency: 700, endFrequency: 520, duration: 0.07, type: 'triangle', gain: 0.04 },
    { frequency: 350, start: 0.07, duration: 0.09, type: 'square', gain: 0.034 },
    { frequency: 260, start: 0.15, duration: 0.11, type: 'sine', gain: 0.032 },
  ],
  signalStop: [
    { frequency: 260, endFrequency: 190, duration: 0.085, type: 'square', gain: 0.045 },
    { frequency: 145, start: 0.065, duration: 0.12, type: 'sine', gain: 0.04 },
  ],
  tokenWait: [
    { frequency: 310, duration: 0.055, type: 'square', gain: 0.04 },
    { frequency: 230, start: 0.07, duration: 0.065, type: 'square', gain: 0.038 },
    { frequency: 310, start: 0.145, duration: 0.07, type: 'triangle', gain: 0.035 },
  ],
  blockConflict: [
    { source: 'noise', filterType: 'bandpass', frequency: 720, q: 3.2, duration: 0.045, gain: 0.045 },
    { frequency: 280, endFrequency: 165, duration: 0.1, type: 'square', gain: 0.045 },
    { frequency: 180, start: 0.085, duration: 0.13, type: 'sawtooth', gain: 0.034 },
  ],
  signalClear: [
    { frequency: 430, duration: 0.04, type: 'triangle', gain: 0.043 },
    { frequency: 650, start: 0.038, duration: 0.065, type: 'sine', gain: 0.04 },
  ],
  railDelay: [
    { source: 'noise', filterType: 'highpass', frequency: 1800, duration: 0.025, gain: 0.024 },
    { frequency: 320, duration: 0.045, type: 'square', gain: 0.034 },
    { frequency: 320, start: 0.11, duration: 0.045, type: 'square', gain: 0.034 },
  ],
  signalAdjust: [
    { source: 'noise', filterType: 'bandpass', frequency: 1150, q: 2.6, duration: 0.03, gain: 0.035 },
    { frequency: 520, duration: 0.035, type: 'square', gain: 0.038 },
    { frequency: 780, start: 0.034, duration: 0.06, type: 'triangle', gain: 0.037 },
  ],
  trainComplete: [
    { frequency: 470, duration: 0.04, type: 'triangle', gain: 0.045 },
    { frequency: 705, start: 0.038, duration: 0.06, type: 'triangle', gain: 0.043 },
    { frequency: 940, start: 0.09, duration: 0.09, type: 'sine', gain: 0.038 },
  ],
  serviceComplete: [
    { source: 'noise', filterType: 'highpass', frequency: 1700, duration: 0.05, gain: 0.026 },
    { frequency: 390, duration: 0.045, type: 'triangle', gain: 0.046 },
    { frequency: 585, start: 0.042, duration: 0.06, type: 'triangle', gain: 0.045 },
    { frequency: 780, start: 0.095, duration: 0.08, type: 'triangle', gain: 0.043 },
    { frequency: 1170, start: 0.17, duration: 0.14, type: 'sine', gain: 0.038 },
  ],
  logoAudit: [
    { frequency: 860, endFrequency: 430, duration: 0.065, type: 'sawtooth', gain: 0.03 },
    { frequency: 520, start: 0.065, duration: 0.045, type: 'triangle', gain: 0.042 },
    { frequency: 690, start: 0.105, duration: 0.065, type: 'sine', gain: 0.036 },
  ],
  logoAuditPerfect: [
    { source: 'noise', filterType: 'highpass', frequency: 1850, duration: 0.04, gain: 0.026 },
    { frequency: 520, duration: 0.04, type: 'triangle', gain: 0.045 },
    { frequency: 780, start: 0.038, duration: 0.06, type: 'triangle', gain: 0.044 },
    { frequency: 1040, start: 0.09, duration: 0.11, type: 'sine', gain: 0.038 },
  ],
  packApply: [
    { source: 'noise', filterType: 'bandpass', frequency: 1280, q: 2.2, duration: 0.035, gain: 0.03 },
    { frequency: 420, duration: 0.04, type: 'square', gain: 0.035 },
    { frequency: 630, start: 0.038, duration: 0.055, type: 'triangle', gain: 0.042 },
    { frequency: 840, start: 0.086, duration: 0.075, type: 'sine', gain: 0.034 },
  ],
  packClear: [
    { source: 'noise', filterType: 'lowpass', frequency: 720, duration: 0.06, gain: 0.04 },
    { frequency: 420, endFrequency: 220, duration: 0.11, type: 'triangle', gain: 0.042 },
  ],
  packInvalid: [
    { frequency: 360, endFrequency: 250, duration: 0.075, type: 'square', gain: 0.04 },
    { frequency: 170, start: 0.06, duration: 0.12, type: 'sine', gain: 0.04 },
  ],
  raceCard: [
    { source: 'noise', filterType: 'highpass', frequency: 1550, duration: 0.04, gain: 0.03 },
    { frequency: 330, endFrequency: 520, duration: 0.055, type: 'sawtooth', gain: 0.034 },
    { frequency: 780, start: 0.052, duration: 0.075, type: 'triangle', gain: 0.042 },
  ],
  seasonCard: [
    { source: 'noise', filterType: 'highpass', frequency: 1750, duration: 0.05, gain: 0.028 },
    { frequency: 390, duration: 0.045, type: 'triangle', gain: 0.045 },
    { frequency: 585, start: 0.042, duration: 0.06, type: 'triangle', gain: 0.044 },
    { frequency: 780, start: 0.095, duration: 0.08, type: 'triangle', gain: 0.042 },
    { frequency: 1040, start: 0.165, duration: 0.12, type: 'sine', gain: 0.036 },
  ],
  dataPackReady: [
    { source: 'noise', filterType: 'highpass', frequency: 2100, duration: 0.055, gain: 0.026 },
    { frequency: 392, duration: 0.05, type: 'triangle', gain: 0.045 },
    { frequency: 523, start: 0.045, duration: 0.065, type: 'triangle', gain: 0.044 },
    { frequency: 784, start: 0.105, duration: 0.085, type: 'triangle', gain: 0.042 },
    { frequency: 1046, start: 0.18, duration: 0.15, type: 'sine', gain: 0.037 },
  ],
  draftLoaded: [
    { source: 'noise', filterType: 'bandpass', frequency: 1450, q: 2.4, duration: 0.03, gain: 0.025 },
    { frequency: 480, duration: 0.045, type: 'square', gain: 0.035 },
    { frequency: 720, start: 0.04, duration: 0.07, type: 'triangle', gain: 0.038 },
  ],
  vanguardStart: [
    { source: 'noise', filterType: 'highpass', frequency: 1600, duration: 0.045, gain: 0.024 },
    { frequency: 330, duration: 0.055, type: 'triangle', gain: 0.04 },
    { frequency: 495, start: 0.05, duration: 0.07, type: 'triangle', gain: 0.04 },
    { frequency: 660, start: 0.115, duration: 0.11, type: 'sine', gain: 0.036 },
  ],
  vanguardPhase: [
    { frequency: 520, endFrequency: 620, duration: 0.045, type: 'triangle', gain: 0.04 },
  ],
  vanguardInvalid: [
    { frequency: 310, endFrequency: 220, duration: 0.075, type: 'square', gain: 0.038 },
    { frequency: 180, start: 0.065, duration: 0.11, type: 'sine', gain: 0.038 },
  ],
  vanguardTurn: [
    { frequency: 390, duration: 0.045, type: 'triangle', gain: 0.042 },
    { frequency: 585, start: 0.04, duration: 0.075, type: 'sine', gain: 0.038 },
  ],
  vanguardDraw: [
    { source: 'noise', filterType: 'highpass', frequency: 1250, duration: 0.055, gain: 0.032 },
    { frequency: 620, endFrequency: 760, start: 0.025, duration: 0.065, type: 'triangle', gain: 0.035 },
  ],
  vanguardRide: [
    { frequency: 330, endFrequency: 660, duration: 0.09, type: 'sawtooth', gain: 0.035 },
    { frequency: 990, start: 0.085, duration: 0.08, type: 'sine', gain: 0.035 },
  ],
  vanguardStride: [
    { source: 'noise', filterType: 'bandpass', frequency: 720, q: 1.8, duration: 0.075, gain: 0.035 },
    { frequency: 220, endFrequency: 660, duration: 0.13, type: 'sawtooth', gain: 0.038 },
    { frequency: 880, start: 0.12, duration: 0.12, type: 'triangle', gain: 0.035 },
  ],
  vanguardCall: [
    { frequency: 440, duration: 0.04, type: 'triangle', gain: 0.04 },
    { frequency: 660, start: 0.036, duration: 0.06, type: 'sine', gain: 0.035 },
  ],
  vanguardSkill: [
    { frequency: 760, endFrequency: 1040, duration: 0.065, type: 'square', gain: 0.028 },
    { frequency: 520, start: 0.055, duration: 0.095, type: 'triangle', gain: 0.038 },
  ],
  vanguardAttack: [
    { source: 'noise', filterType: 'highpass', frequency: 1100, duration: 0.055, gain: 0.038 },
    { frequency: 300, endFrequency: 620, duration: 0.075, type: 'sawtooth', gain: 0.035 },
  ],
  vanguardGuardWindow: [
    { frequency: 260, duration: 0.06, type: 'square', gain: 0.035 },
    { frequency: 390, start: 0.065, duration: 0.08, type: 'triangle', gain: 0.038 },
  ],
  vanguardGuard: [
    { source: 'noise', filterType: 'highpass', frequency: 2100, duration: 0.035, gain: 0.028 },
    { frequency: 720, endFrequency: 480, duration: 0.08, type: 'triangle', gain: 0.042 },
  ],
  vanguardPerfectGuard: [
    { source: 'noise', filterType: 'highpass', frequency: 2400, duration: 0.04, gain: 0.03 },
    { frequency: 520, duration: 0.04, type: 'triangle', gain: 0.042 },
    { frequency: 780, start: 0.038, duration: 0.06, type: 'triangle', gain: 0.042 },
    { frequency: 1040, start: 0.09, duration: 0.11, type: 'sine', gain: 0.036 },
  ],
  vanguardBlocked: [
    { source: 'noise', filterType: 'lowpass', frequency: 600, duration: 0.07, gain: 0.035 },
    { frequency: 430, endFrequency: 240, duration: 0.11, type: 'triangle', gain: 0.04 },
  ],
  vanguardTrigger: [
    { source: 'noise', filterType: 'highpass', frequency: 2600, duration: 0.035, gain: 0.026 },
    { frequency: 880, duration: 0.045, type: 'sine', gain: 0.038 },
    { frequency: 1320, start: 0.04, duration: 0.075, type: 'sine', gain: 0.032 },
  ],
  vanguardHit: [
    { source: 'noise', filterType: 'bandpass', frequency: 820, q: 1.4, duration: 0.055, gain: 0.042 },
    { frequency: 260, endFrequency: 520, duration: 0.08, type: 'sawtooth', gain: 0.04 },
  ],
  vanguardDamage: [
    { source: 'noise', filterType: 'lowpass', frequency: 520, duration: 0.075, gain: 0.045 },
    { frequency: 280, endFrequency: 150, duration: 0.13, type: 'sawtooth', gain: 0.04 },
  ],
  vanguardVictory: [
    { source: 'noise', filterType: 'highpass', frequency: 1900, duration: 0.05, gain: 0.027 },
    { frequency: 440, duration: 0.05, type: 'triangle', gain: 0.043 },
    { frequency: 660, start: 0.045, duration: 0.065, type: 'triangle', gain: 0.043 },
    { frequency: 880, start: 0.105, duration: 0.08, type: 'triangle', gain: 0.041 },
    { frequency: 1320, start: 0.18, duration: 0.16, type: 'sine', gain: 0.035 },
  ],
  vanguardDefeat: [
    { source: 'noise', filterType: 'lowpass', frequency: 420, duration: 0.08, gain: 0.04 },
    { frequency: 440, endFrequency: 330, duration: 0.1, type: 'triangle', gain: 0.04 },
    { frequency: 260, endFrequency: 150, start: 0.09, duration: 0.16, type: 'sine', gain: 0.04 },
  ],
  vanguardRetire: [
    { source: 'noise', filterType: 'bandpass', frequency: 760, q: 1.8, duration: 0.045, gain: 0.033 },
    { frequency: 520, endFrequency: 260, duration: 0.09, type: 'triangle', gain: 0.04 },
  ],
  vanguardDeckOut: [
    { source: 'noise', filterType: 'highpass', frequency: 1500, duration: 0.07, gain: 0.032 },
    { frequency: 420, endFrequency: 210, start: 0.045, duration: 0.14, type: 'sawtooth', gain: 0.035 },
    { frequency: 150, start: 0.16, duration: 0.13, type: 'sine', gain: 0.038 },
  ],
  vanguardReplay: [
    { source: 'noise', filterType: 'highpass', frequency: 1800, duration: 0.035, gain: 0.024 },
    { frequency: 440, duration: 0.04, type: 'square', gain: 0.032 },
    { frequency: 660, start: 0.04, duration: 0.055, type: 'triangle', gain: 0.038 },
    { frequency: 880, start: 0.095, duration: 0.08, type: 'sine', gain: 0.034 },
  ],
  code: [
    { frequency: 520, duration: 0.028, type: 'square', gain: 0.035 },
    { frequency: 780, start: 0.032, duration: 0.035, type: 'square', gain: 0.03 },
    { frequency: 1040, start: 0.07, duration: 0.055, type: 'triangle', gain: 0.035 },
  ],
  codePerfect: [
    { frequency: 660, duration: 0.035, type: 'square', gain: 0.04 },
    { frequency: 990, start: 0.034, duration: 0.05, type: 'triangle', gain: 0.043 },
    { frequency: 1320, start: 0.082, duration: 0.095, type: 'sine', gain: 0.038 },
  ],
  codePass: [
    { frequency: 520, duration: 0.035, type: 'square', gain: 0.038 },
    { frequency: 780, start: 0.034, duration: 0.075, type: 'triangle', gain: 0.04 },
  ],
  codeFail: [
    { frequency: 360, endFrequency: 250, duration: 0.08, type: 'square', gain: 0.038 },
    { frequency: 180, start: 0.065, duration: 0.11, type: 'sine', gain: 0.04 },
  ],
  projectApproved: [
    { source: 'noise', filterType: 'highpass', frequency: 1700, duration: 0.04, gain: 0.028 },
    { frequency: 440, duration: 0.04, type: 'triangle', gain: 0.045 },
    { frequency: 660, start: 0.038, duration: 0.06, type: 'triangle', gain: 0.043 },
    { frequency: 990, start: 0.09, duration: 0.11, type: 'sine', gain: 0.038 },
  ],
  projectRejected: [
    { source: 'noise', filterType: 'lowpass', frequency: 620, duration: 0.055, gain: 0.045 },
    { frequency: 300, endFrequency: 210, duration: 0.09, type: 'square', gain: 0.04 },
    { frequency: 150, start: 0.075, duration: 0.12, type: 'sine', gain: 0.038 },
  ],
  hintOpen: [
    { frequency: 740, duration: 0.04, type: 'sine', gain: 0.04 },
    { frequency: 1110, start: 0.038, duration: 0.075, type: 'sine', gain: 0.038 },
  ],
  taskSelect: [
    { frequency: 460, duration: 0.035, type: 'square', gain: 0.034 },
    { frequency: 690, start: 0.034, duration: 0.055, type: 'triangle', gain: 0.036 },
  ],
  taskReset: [
    { frequency: 700, endFrequency: 420, duration: 0.075, type: 'triangle', gain: 0.037 },
    { frequency: 280, start: 0.07, duration: 0.09, type: 'square', gain: 0.034 },
  ],
  documentReview: [
    { source: 'noise', filterType: 'highpass', frequency: 2100, duration: 0.025, gain: 0.02 },
    { frequency: 620, duration: 0.035, type: 'triangle', gain: 0.037 },
    { frequency: 930, start: 0.035, duration: 0.06, type: 'sine', gain: 0.034 },
  ],
  documentReviewUndo: [
    { frequency: 620, endFrequency: 410, duration: 0.065, type: 'triangle', gain: 0.034 },
    { source: 'noise', filterType: 'highpass', frequency: 1700, start: 0.055, duration: 0.025, gain: 0.018 },
  ],
  support: [
    { frequency: 420, duration: 0.04, type: 'triangle', gain: 0.04 },
    { frequency: 630, start: 0.035, duration: 0.055, type: 'triangle', gain: 0.04 },
    { frequency: 840, start: 0.082, duration: 0.075, type: 'sine', gain: 0.035 },
  ],
  supportHint: [
    { frequency: 660, duration: 0.035, type: 'sine', gain: 0.038 },
    { frequency: 990, start: 0.035, duration: 0.055, type: 'sine', gain: 0.039 },
    { frequency: 1320, start: 0.085, duration: 0.075, type: 'sine', gain: 0.031 },
  ],
  supportRisk: [
    { frequency: 330, duration: 0.045, type: 'square', gain: 0.037 },
    { frequency: 495, start: 0.04, duration: 0.06, type: 'triangle', gain: 0.04 },
    { frequency: 660, start: 0.095, duration: 0.08, type: 'sine', gain: 0.036 },
  ],
  projectSelect: [
    { frequency: 520, duration: 0.035, type: 'square', gain: 0.036 },
    { frequency: 780, start: 0.04, duration: 0.055, type: 'triangle', gain: 0.038 },
    { frequency: 1040, start: 0.09, duration: 0.075, type: 'sine', gain: 0.033 },
  ],
  summon: [
    { source: 'noise', filterType: 'highpass', frequency: 1700, duration: 0.045, gain: 0.045 },
    { frequency: 420, endFrequency: 720, duration: 0.075, type: 'triangle', gain: 0.055 },
    { frequency: 1080, start: 0.06, duration: 0.07, type: 'sine', gain: 0.04 },
  ],
  chain: [
    { frequency: 520, endFrequency: 650, duration: 0.05, type: 'triangle', gain: 0.05 },
    { frequency: 780, endFrequency: 980, start: 0.045, duration: 0.06, type: 'triangle', gain: 0.045 },
  ],
  tcgStart: [
    { source: 'noise', filterType: 'highpass', frequency: 1700, duration: 0.045, gain: 0.026 },
    { frequency: 330, duration: 0.05, type: 'triangle', gain: 0.045 },
    { frequency: 495, start: 0.045, duration: 0.065, type: 'triangle', gain: 0.043 },
    { frequency: 990, start: 0.105, duration: 0.12, type: 'sine', gain: 0.036 },
  ],
  tcgDraw: [
    { source: 'noise', filterType: 'highpass', frequency: 1350, duration: 0.055, gain: 0.032 },
    { frequency: 560, endFrequency: 760, start: 0.025, duration: 0.065, type: 'triangle', gain: 0.038 },
  ],
  tcgSummon: [
    { source: 'noise', filterType: 'bandpass', frequency: 920, q: 1.6, duration: 0.055, gain: 0.036 },
    { frequency: 280, endFrequency: 620, duration: 0.09, type: 'sawtooth', gain: 0.034 },
    { frequency: 930, start: 0.085, duration: 0.085, type: 'sine', gain: 0.036 },
  ],
  tcgSet: [
    { source: 'noise', filterType: 'lowpass', frequency: 760, duration: 0.04, gain: 0.035 },
    { frequency: 420, endFrequency: 300, duration: 0.07, type: 'triangle', gain: 0.04 },
  ],
  tcgEffect: [
    { frequency: 720, endFrequency: 1080, duration: 0.065, type: 'square', gain: 0.026 },
    { frequency: 520, start: 0.055, duration: 0.1, type: 'triangle', gain: 0.04 },
  ],
  tcgChain: [
    { frequency: 520, endFrequency: 650, duration: 0.045, type: 'triangle', gain: 0.043 },
    { frequency: 780, endFrequency: 980, start: 0.042, duration: 0.055, type: 'triangle', gain: 0.04 },
    { frequency: 1170, start: 0.09, duration: 0.07, type: 'sine', gain: 0.034 },
  ],
  tcgAttack: [
    { source: 'noise', filterType: 'bandpass', frequency: 980, q: 1.2, duration: 0.055, gain: 0.055 },
    { frequency: 260, endFrequency: 150, duration: 0.1, type: 'sawtooth', gain: 0.042 },
  ],
  tcgHit: [
    { source: 'noise', filterType: 'lowpass', frequency: 680, duration: 0.075, gain: 0.065 },
    { frequency: 190, endFrequency: 110, duration: 0.115, type: 'square', gain: 0.042 },
  ],
  tcgDamage: [
    { frequency: 360, endFrequency: 220, duration: 0.09, type: 'square', gain: 0.043 },
    { frequency: 150, start: 0.07, duration: 0.13, type: 'sine', gain: 0.04 },
  ],
  tcgDestroy: [
    { source: 'noise', filterType: 'lowpass', frequency: 920, duration: 0.095, gain: 0.07 },
    { frequency: 240, endFrequency: 95, duration: 0.14, type: 'sawtooth', gain: 0.042 },
  ],
  tcgNegate: [
    { frequency: 980, endFrequency: 380, duration: 0.07, type: 'square', gain: 0.035 },
    { source: 'noise', filterType: 'bandpass', frequency: 640, q: 2.4, start: 0.05, duration: 0.07, gain: 0.045 },
  ],
  tcgMikaCost: [
    { frequency: 330, endFrequency: 190, duration: 0.08, type: 'triangle', gain: 0.042 },
    { source: 'noise', filterType: 'lowpass', frequency: 520, start: 0.055, duration: 0.07, gain: 0.038 },
  ],
  tcgMikaNegate: [
    { frequency: 1180, endFrequency: 420, duration: 0.075, type: 'square', gain: 0.038 },
    { source: 'noise', filterType: 'bandpass', frequency: 880, q: 3.1, start: 0.045, duration: 0.065, gain: 0.05 },
    { frequency: 220, start: 0.095, duration: 0.11, type: 'sine', gain: 0.042 },
  ],
  tcgMikaBurst: [
    { frequency: 410, endFrequency: 920, duration: 0.09, type: 'sawtooth', gain: 0.036 },
    { frequency: 1230, start: 0.07, duration: 0.09, type: 'triangle', gain: 0.042 },
    { source: 'noise', filterType: 'highpass', frequency: 1700, start: 0.12, duration: 0.045, gain: 0.034 },
  ],
  tcgHinaDiscipline: [
    { source: 'noise', filterType: 'bandpass', frequency: 1250, q: 1.8, duration: 0.055, gain: 0.06 },
    { frequency: 260, endFrequency: 105, duration: 0.12, type: 'sawtooth', gain: 0.046 },
  ],
  tcgHinaRecover: [
    { frequency: 440, duration: 0.045, type: 'sine', gain: 0.038 },
    { frequency: 660, start: 0.04, duration: 0.065, type: 'sine', gain: 0.041 },
    { frequency: 880, start: 0.1, duration: 0.09, type: 'sine', gain: 0.035 },
  ],
  tcgYuukaGuard: [
    { frequency: 520, endFrequency: 760, duration: 0.075, type: 'triangle', gain: 0.04 },
    { frequency: 1040, start: 0.065, duration: 0.11, type: 'sine', gain: 0.04 },
  ],
  tcgYuukaSearch: [
    { frequency: 680, endFrequency: 920, duration: 0.05, type: 'square', gain: 0.026 },
    { frequency: 920, endFrequency: 1180, start: 0.045, duration: 0.055, type: 'square', gain: 0.024 },
    { frequency: 1360, start: 0.1, duration: 0.075, type: 'sine', gain: 0.032 },
  ],
  tcgPosition: [
    { frequency: 420, endFrequency: 620, duration: 0.055, type: 'triangle', gain: 0.04 },
    { frequency: 620, endFrequency: 420, start: 0.05, duration: 0.055, type: 'triangle', gain: 0.038 },
  ],
  tcgPhase: [
    { frequency: 520, endFrequency: 680, duration: 0.05, type: 'triangle', gain: 0.04 },
  ],
  tcgTurn: [
    { frequency: 390, duration: 0.045, type: 'triangle', gain: 0.042 },
    { frequency: 585, start: 0.04, duration: 0.075, type: 'sine', gain: 0.038 },
  ],
  tcgPrompt: [
    { frequency: 740, duration: 0.04, type: 'sine', gain: 0.038 },
    { frequency: 1110, start: 0.038, duration: 0.075, type: 'sine', gain: 0.036 },
  ],
  tcgInvalid: [
    { frequency: 310, endFrequency: 220, duration: 0.075, type: 'square', gain: 0.04 },
    { frequency: 180, start: 0.065, duration: 0.11, type: 'sine', gain: 0.038 },
  ],
  tcgDeckSave: [
    { source: 'noise', filterType: 'highpass', frequency: 1500, duration: 0.035, gain: 0.025 },
    { frequency: 520, duration: 0.04, type: 'triangle', gain: 0.043 },
    { frequency: 780, start: 0.038, duration: 0.075, type: 'sine', gain: 0.038 },
  ],
  tcgVictory: [
    { source: 'noise', filterType: 'highpass', frequency: 1900, duration: 0.07, gain: 0.035 },
    { frequency: 520, duration: 0.045, type: 'triangle', gain: 0.05 },
    { frequency: 780, start: 0.04, duration: 0.065, type: 'triangle', gain: 0.048 },
    { frequency: 1040, start: 0.1, duration: 0.13, type: 'sine', gain: 0.042 },
  ],
  tcgDefeat: [
    { frequency: 430, endFrequency: 320, duration: 0.1, type: 'triangle', gain: 0.05 },
    { frequency: 250, endFrequency: 170, start: 0.08, duration: 0.14, type: 'sine', gain: 0.044 },
  ],
  twentyRoomCreate: [
    { source: 'noise', filterType: 'highpass', frequency: 1800, duration: 0.04, gain: 0.025 },
    { frequency: 440, duration: 0.04, type: 'sine', gain: 0.045 },
    { frequency: 660, start: 0.038, duration: 0.06, type: 'sine', gain: 0.043 },
    { frequency: 880, start: 0.09, duration: 0.1, type: 'sine', gain: 0.038 },
  ],
  twentyQuestion: [
    { frequency: 620, duration: 0.04, type: 'sine', gain: 0.042 },
    { frequency: 930, start: 0.04, duration: 0.08, type: 'sine', gain: 0.038 },
  ],
  twentyAnswerYes: [
    { frequency: 560, duration: 0.04, type: 'triangle', gain: 0.045 },
    { frequency: 840, start: 0.036, duration: 0.075, type: 'sine', gain: 0.04 },
  ],
  twentyAnswerNo: [
    { frequency: 360, endFrequency: 250, duration: 0.08, type: 'triangle', gain: 0.045 },
    { frequency: 180, start: 0.065, duration: 0.1, type: 'sine', gain: 0.038 },
  ],
  twentyAnswerMaybe: [
    { frequency: 520, duration: 0.045, type: 'sine', gain: 0.04 },
    { frequency: 620, start: 0.07, duration: 0.05, type: 'sine', gain: 0.036 },
    { frequency: 520, start: 0.145, duration: 0.07, type: 'sine', gain: 0.034 },
  ],
  twentyCorrect: [
    { source: 'noise', filterType: 'highpass', frequency: 1900, duration: 0.065, gain: 0.032 },
    { frequency: 520, duration: 0.045, type: 'triangle', gain: 0.048 },
    { frequency: 780, start: 0.04, duration: 0.06, type: 'triangle', gain: 0.047 },
    { frequency: 1040, start: 0.095, duration: 0.13, type: 'sine', gain: 0.042 },
  ],
  twentyWrong: [
    { frequency: 430, endFrequency: 310, duration: 0.09, type: 'triangle', gain: 0.045 },
    { frequency: 230, start: 0.075, duration: 0.12, type: 'sine', gain: 0.04 },
  ],
  twentyHint: [
    { source: 'noise', filterType: 'highpass', frequency: 1650, duration: 0.035, gain: 0.022 },
    { frequency: 660, endFrequency: 880, duration: 0.07, type: 'sine', gain: 0.042 },
    { frequency: 1100, start: 0.065, duration: 0.09, type: 'sine', gain: 0.035 },
  ],
  twentyRoomClose: [
    { frequency: 520, endFrequency: 360, duration: 0.08, type: 'triangle', gain: 0.043 },
    { frequency: 260, start: 0.07, duration: 0.11, type: 'sine', gain: 0.038 },
  ],
  twentyRefresh: [
    { frequency: 480, endFrequency: 620, duration: 0.055, type: 'triangle', gain: 0.04 },
    { frequency: 760, start: 0.05, duration: 0.07, type: 'sine', gain: 0.036 },
  ],
  twentyInvalid: [
    { frequency: 300, endFrequency: 210, duration: 0.075, type: 'square', gain: 0.04 },
    { frequency: 160, start: 0.065, duration: 0.11, type: 'sine', gain: 0.038 },
  ],
  pass: [
    { frequency: 620, endFrequency: 360, duration: 0.08, type: 'sine', gain: 0.05 },
  ],
  shuffle: [
    { source: 'noise', filterType: 'bandpass', frequency: 1450, q: 0.8, duration: 0.1, gain: 0.065 },
    { frequency: 720, endFrequency: 560, duration: 0.06, type: 'triangle', gain: 0.035 },
  ],
  ride: [
    { frequency: 360, duration: 0.04, type: 'triangle', gain: 0.055 },
    { frequency: 540, start: 0.035, duration: 0.05, type: 'triangle', gain: 0.05 },
    { frequency: 900, start: 0.078, duration: 0.075, type: 'sine', gain: 0.04 },
  ],
  guard: [
    { source: 'noise', filterType: 'bandpass', frequency: 620, q: 1.8, duration: 0.055, gain: 0.06 },
    { frequency: 240, endFrequency: 190, duration: 0.1, type: 'triangle', gain: 0.055 },
  ],
  overwatch: [
    { frequency: 520, duration: 0.035, type: 'square', gain: 0.035 },
    { frequency: 760, start: 0.045, duration: 0.04, type: 'square', gain: 0.035 },
    { frequency: 980, start: 0.095, duration: 0.075, type: 'sine', gain: 0.032 },
  ],
  reactionShot: [
    { source: 'noise', filterType: 'bandpass', frequency: 1350, q: 1.7, duration: 0.045, gain: 0.075 },
    { frequency: 260, endFrequency: 150, duration: 0.085, type: 'sawtooth', gain: 0.05 },
  ],
  smoke: [
    { source: 'noise', filterType: 'lowpass', frequency: 920, q: 0.8, duration: 0.18, gain: 0.055 },
    { frequency: 240, endFrequency: 180, duration: 0.14, type: 'sine', gain: 0.025 },
  ],
  coverBreak: [
    { source: 'noise', filterType: 'bandpass', frequency: 780, q: 1.1, duration: 0.075, gain: 0.08 },
    { source: 'noise', filterType: 'lowpass', frequency: 420, start: 0.045, duration: 0.11, gain: 0.055 },
    { frequency: 150, endFrequency: 95, start: 0.025, duration: 0.14, type: 'square', gain: 0.04 },
  ],
  buff: [
    { frequency: 460, endFrequency: 620, duration: 0.07, type: 'triangle', gain: 0.045 },
    { frequency: 820, start: 0.06, duration: 0.09, type: 'sine', gain: 0.04 },
    { frequency: 1080, start: 0.13, duration: 0.1, type: 'sine', gain: 0.028 },
  ],
  debuff: [
    { frequency: 620, endFrequency: 390, duration: 0.09, type: 'triangle', gain: 0.042 },
    { frequency: 210, start: 0.07, duration: 0.13, type: 'sine', gain: 0.038 },
  ],
  statusApply: [
    { frequency: 680, endFrequency: 880, duration: 0.06, type: 'sawtooth', gain: 0.03 },
    { frequency: 1120, start: 0.055, duration: 0.08, type: 'sine', gain: 0.032 },
  ],
  statusResist: [
    { frequency: 510, endFrequency: 340, duration: 0.075, type: 'triangle', gain: 0.038 },
    { source: 'noise', filterType: 'highpass', frequency: 1300, start: 0.04, duration: 0.045, gain: 0.022 },
  ],
  burst: [
    { source: 'noise', filterType: 'bandpass', frequency: 1450, q: 1.7, duration: 0.038, gain: 0.065 },
    { frequency: 250, endFrequency: 160, duration: 0.065, type: 'sawtooth', gain: 0.042 },
    { source: 'noise', filterType: 'bandpass', frequency: 1450, q: 1.7, start: 0.085, duration: 0.038, gain: 0.065 },
    { frequency: 250, endFrequency: 160, start: 0.085, duration: 0.065, type: 'sawtooth', gain: 0.042 },
  ],
  skill: [
    { frequency: 720, endFrequency: 1080, duration: 0.06, type: 'sawtooth', gain: 0.035 },
    { frequency: 1360, start: 0.05, duration: 0.075, type: 'sine', gain: 0.035 },
  ],
  deploy: [
    { frequency: 280, duration: 0.045, type: 'square', gain: 0.045 },
    { frequency: 460, start: 0.04, duration: 0.055, type: 'triangle', gain: 0.055 },
    { frequency: 760, start: 0.088, duration: 0.085, type: 'sine', gain: 0.04 },
  ],
  formation: [
    { frequency: 420, duration: 0.035, type: 'square', gain: 0.035 },
    { frequency: 520, start: 0.035, duration: 0.035, type: 'square', gain: 0.035 },
    { frequency: 680, start: 0.07, duration: 0.055, type: 'triangle', gain: 0.04 },
  ],
  move: [
    { frequency: 330, endFrequency: 470, duration: 0.055, type: 'triangle', gain: 0.05 },
  ],
  wait: [
    { frequency: 520, endFrequency: 330, duration: 0.095, type: 'sine', gain: 0.045 },
  ],
  turn: [
    { frequency: 540, endFrequency: 360, duration: 0.06, type: 'triangle', gain: 0.045 },
    { frequency: 720, start: 0.055, duration: 0.065, type: 'sine', gain: 0.04 },
  ],
  auto: [
    { frequency: 430, duration: 0.032, type: 'square', gain: 0.035 },
    { frequency: 560, start: 0.03, duration: 0.032, type: 'square', gain: 0.035 },
    { frequency: 760, start: 0.06, duration: 0.055, type: 'triangle', gain: 0.04 },
  ],
  property: [
    { frequency: 560, duration: 0.045, type: 'triangle', gain: 0.045 },
    { frequency: 840, start: 0.04, duration: 0.06, type: 'triangle', gain: 0.04 },
  ],
  edict: [
    { source: 'noise', filterType: 'lowpass', frequency: 520, duration: 0.045, gain: 0.055 },
    { frequency: 260, endFrequency: 190, duration: 0.08, type: 'square', gain: 0.04 },
  ],
  equip: [
    { source: 'noise', filterType: 'bandpass', frequency: 1500, q: 2.4, duration: 0.035, gain: 0.05 },
    { frequency: 620, start: 0.025, duration: 0.06, type: 'triangle', gain: 0.045 },
  ],
  favorite: [
    { frequency: 920, duration: 0.035, type: 'triangle', gain: 0.04 },
    { frequency: 1380, start: 0.032, duration: 0.055, type: 'sine', gain: 0.036 },
    { frequency: 1840, start: 0.08, duration: 0.08, type: 'sine', gain: 0.028 },
  ],
  claim: [
    { frequency: 620, duration: 0.035, type: 'triangle', gain: 0.045 },
    { frequency: 900, start: 0.034, duration: 0.045, type: 'triangle', gain: 0.04 },
    { frequency: 1240, start: 0.075, duration: 0.07, type: 'sine', gain: 0.035 },
  ],
  shop: [
    { frequency: 880, duration: 0.032, type: 'square', gain: 0.035 },
    { frequency: 1160, start: 0.03, duration: 0.052, type: 'triangle', gain: 0.04 },
  ],
  shopRefresh: [
    { source: 'noise', filterType: 'bandpass', frequency: 1180, q: 1.6, duration: 0.075, gain: 0.045 },
    { frequency: 520, endFrequency: 860, duration: 0.08, type: 'triangle', gain: 0.04 },
    { frequency: 1120, start: 0.075, duration: 0.065, type: 'sine', gain: 0.034 },
  ],
  event: [
    { frequency: 680, endFrequency: 940, duration: 0.065, type: 'sawtooth', gain: 0.04 },
    { frequency: 1240, start: 0.055, duration: 0.075, type: 'sine', gain: 0.035 },
  ],
  camp: [
    { source: 'noise', filterType: 'bandpass', frequency: 980, q: 1.2, duration: 0.095, gain: 0.05 },
    { frequency: 230, endFrequency: 190, duration: 0.12, type: 'triangle', gain: 0.05 },
  ],
  complete: [
    { frequency: 520, duration: 0.045, type: 'triangle', gain: 0.055 },
    { frequency: 780, start: 0.04, duration: 0.06, type: 'triangle', gain: 0.05 },
    { frequency: 1040, start: 0.092, duration: 0.105, type: 'sine', gain: 0.045 },
  ],
  settle: [
    { frequency: 940, duration: 0.035, type: 'square', gain: 0.035 },
    { frequency: 1260, start: 0.032, duration: 0.045, type: 'triangle', gain: 0.04 },
    { frequency: 720, start: 0.075, duration: 0.075, type: 'sine', gain: 0.04 },
  ],
  reroll: [
    { source: 'noise', filterType: 'bandpass', frequency: 1320, q: 1.7, duration: 0.09, gain: 0.055 },
    { frequency: 460, endFrequency: 720, duration: 0.085, type: 'triangle', gain: 0.045 },
  ],
  salvage: [
    { source: 'noise', filterType: 'lowpass', frequency: 760, duration: 0.075, gain: 0.07 },
    { frequency: 280, endFrequency: 145, duration: 0.11, type: 'sawtooth', gain: 0.045 },
  ],
  tower: [
    { frequency: 190, duration: 0.08, type: 'triangle', gain: 0.055 },
    { frequency: 380, start: 0.065, duration: 0.09, type: 'triangle', gain: 0.045 },
    { frequency: 760, start: 0.14, duration: 0.1, type: 'sine', gain: 0.035 },
  ],
  lock: [
    { frequency: 310, endFrequency: 240, duration: 0.04, type: 'square', gain: 0.04 },
    { frequency: 760, start: 0.032, duration: 0.055, type: 'triangle', gain: 0.04 },
  ],
  preset: [
    { frequency: 440, duration: 0.035, type: 'triangle', gain: 0.045 },
    { frequency: 660, start: 0.032, duration: 0.045, type: 'triangle', gain: 0.04 },
    { frequency: 880, start: 0.072, duration: 0.065, type: 'sine', gain: 0.035 },
  ],
  dutyComplete: [
    { frequency: 420, duration: 0.04, type: 'triangle', gain: 0.045 },
    { frequency: 630, start: 0.035, duration: 0.055, type: 'triangle', gain: 0.043 },
    { frequency: 840, start: 0.08, duration: 0.09, type: 'sine', gain: 0.038 },
  ],
  towerClear: [
    { source: 'noise', filterType: 'highpass', frequency: 1700, duration: 0.055, gain: 0.03 },
    { frequency: 330, duration: 0.045, type: 'triangle', gain: 0.05 },
    { frequency: 550, start: 0.04, duration: 0.06, type: 'triangle', gain: 0.048 },
    { frequency: 880, start: 0.095, duration: 0.11, type: 'sine', gain: 0.04 },
  ],
  towerFail: [
    { frequency: 410, endFrequency: 290, duration: 0.09, type: 'triangle', gain: 0.05 },
    { frequency: 210, endFrequency: 145, start: 0.07, duration: 0.12, type: 'sine', gain: 0.043 },
  ],
  enhanceSuccess: [
    { source: 'noise', filterType: 'bandpass', frequency: 1850, q: 2.4, duration: 0.035, gain: 0.042 },
    { frequency: 620, duration: 0.035, type: 'triangle', gain: 0.048 },
    { frequency: 1040, start: 0.032, duration: 0.075, type: 'sine', gain: 0.04 },
  ],
  enhancePity: [
    { source: 'noise', filterType: 'highpass', frequency: 2100, q: 1.7, duration: 0.055, gain: 0.035 },
    { frequency: 520, duration: 0.045, type: 'triangle', gain: 0.05 },
    { frequency: 780, start: 0.04, duration: 0.06, type: 'triangle', gain: 0.048 },
    { frequency: 1170, start: 0.095, duration: 0.12, type: 'sine', gain: 0.042 },
  ],
  enhanceProtected: [
    { source: 'noise', filterType: 'bandpass', frequency: 720, q: 2.3, duration: 0.045, gain: 0.05 },
    { frequency: 245, endFrequency: 195, duration: 0.055, type: 'square', gain: 0.034 },
    { frequency: 760, start: 0.052, duration: 0.075, type: 'triangle', gain: 0.045 },
    { frequency: 1140, start: 0.11, duration: 0.075, type: 'sine', gain: 0.035 },
  ],
  enhanceDowngrade: [
    { source: 'noise', filterType: 'lowpass', frequency: 680, duration: 0.055, gain: 0.05 },
    { frequency: 510, endFrequency: 360, duration: 0.075, type: 'triangle', gain: 0.045 },
    { frequency: 290, endFrequency: 205, start: 0.06, duration: 0.105, type: 'sine', gain: 0.04 },
  ],
  enhanceDestroyed: [
    { source: 'noise', filterType: 'lowpass', frequency: 360, duration: 0.12, gain: 0.09 },
    { frequency: 150, endFrequency: 72, duration: 0.18, type: 'sawtooth', gain: 0.055 },
    { frequency: 92, endFrequency: 54, start: 0.08, duration: 0.2, type: 'sine', gain: 0.045 },
  ],
  enhanceFail: [
    { source: 'noise', filterType: 'lowpass', frequency: 520, duration: 0.065, gain: 0.06 },
    { frequency: 230, endFrequency: 155, duration: 0.1, type: 'square', gain: 0.036 },
  ],
  craftComplete: [
    { source: 'noise', filterType: 'bandpass', frequency: 1350, q: 2, duration: 0.04, gain: 0.04 },
    { frequency: 520, duration: 0.04, type: 'triangle', gain: 0.045 },
    { frequency: 920, start: 0.04, duration: 0.07, type: 'sine', gain: 0.038 },
  ],
  reward: [
    { frequency: 980, duration: 0.03, type: 'square', gain: 0.035 },
    { frequency: 1320, start: 0.028, duration: 0.045, type: 'triangle', gain: 0.04 },
    { frequency: 1760, start: 0.07, duration: 0.075, type: 'sine', gain: 0.032 },
  ],
};

const THEME_CUE_PROFILES = {
  battle: {
    accent: [{ frequency: 120, endFrequency: 95, duration: 0.09, type: 'sine', gain: 0.025 }],
    click: [{ frequency: 260, endFrequency: 210, duration: 0.055, type: 'sawtooth', gain: 0.065 }],
    confirm: [
      { frequency: 360, duration: 0.04, type: 'square', gain: 0.05 },
      { frequency: 720, start: 0.035, duration: 0.065, type: 'triangle', gain: 0.06 },
    ],
    warning: [
      { frequency: 180, endFrequency: 130, duration: 0.12, type: 'sawtooth', gain: 0.06 },
      { frequency: 360, start: 0.04, duration: 0.07, type: 'square', gain: 0.035 },
    ],
  },
  twenty: {
    accent: [{ frequency: 820, duration: 0.055, type: 'sine', gain: 0.025 }],
    click: [{ frequency: 620, endFrequency: 700, duration: 0.055, type: 'sine', gain: 0.08 }],
    tab: [
      { frequency: 660, duration: 0.045, type: 'sine', gain: 0.06 },
      { frequency: 880, start: 0.04, duration: 0.06, type: 'sine', gain: 0.055 },
    ],
  },
  card: {
    accent: [{ frequency: 1380, duration: 0.035, type: 'triangle', gain: 0.022 }],
    click: [{ frequency: 720, endFrequency: 540, duration: 0.045, type: 'triangle', gain: 0.08 }],
    select: [
      { frequency: 520, duration: 0.036, type: 'triangle', gain: 0.06 },
      { frequency: 1040, start: 0.028, duration: 0.052, type: 'sine', gain: 0.045 },
    ],
    confirm: [
      { frequency: 440, duration: 0.045, type: 'triangle', gain: 0.06 },
      { frequency: 1320, start: 0.036, duration: 0.08, type: 'sine', gain: 0.04 },
    ],
  },
  survival: {
    accent: [{ frequency: 240, endFrequency: 210, duration: 0.07, type: 'triangle', gain: 0.025 }],
    click: [{ frequency: 330, endFrequency: 300, duration: 0.065, type: 'triangle', gain: 0.075 }],
    confirm: [
      { frequency: 280, duration: 0.05, type: 'triangle', gain: 0.06 },
      { frequency: 420, start: 0.045, duration: 0.075, type: 'sine', gain: 0.045 },
    ],
  },
  kitchen: {
    accent: [{ frequency: 1080, duration: 0.04, type: 'sine', gain: 0.024 }],
    click: [{ frequency: 760, endFrequency: 920, duration: 0.045, type: 'sine', gain: 0.07 }],
    confirm: [
      { frequency: 840, duration: 0.04, type: 'triangle', gain: 0.06 },
      { frequency: 1260, start: 0.035, duration: 0.06, type: 'sine', gain: 0.045 },
    ],
  },
  idle: {
    accent: [{ frequency: 880, duration: 0.065, type: 'sine', gain: 0.022 }],
    click: [{ frequency: 590, endFrequency: 830, duration: 0.07, type: 'sine', gain: 0.06 }],
    confirm: [
      { frequency: 740, duration: 0.05, type: 'sine', gain: 0.055 },
      { frequency: 1180, start: 0.04, duration: 0.075, type: 'sine', gain: 0.04 },
    ],
  },
  tactical: {
    accent: [{ frequency: 300, duration: 0.04, type: 'square', gain: 0.02 }],
    click: [{ frequency: 480, endFrequency: 360, duration: 0.042, type: 'square', gain: 0.045 }],
    select: [{ frequency: 520, endFrequency: 620, duration: 0.05, type: 'triangle', gain: 0.065 }],
    warning: [{ frequency: 220, endFrequency: 165, duration: 0.1, type: 'square', gain: 0.05 }],
  },
  broadcast: {
    accent: [{ frequency: 920, duration: 0.045, type: 'sine', gain: 0.022 }],
    click: [{ frequency: 500, endFrequency: 620, duration: 0.045, type: 'triangle', gain: 0.06 }],
    nav: [
      { frequency: 640, duration: 0.04, type: 'sine', gain: 0.05 },
      { frequency: 960, start: 0.035, duration: 0.07, type: 'sine', gain: 0.04 },
    ],
  },
  school: {
    accent: [{ frequency: 740, duration: 0.055, type: 'triangle', gain: 0.022 }],
    click: [{ frequency: 640, endFrequency: 720, duration: 0.055, type: 'triangle', gain: 0.065 }],
    confirm: [
      { frequency: 720, duration: 0.045, type: 'sine', gain: 0.05 },
      { frequency: 960, start: 0.04, duration: 0.06, type: 'sine', gain: 0.04 },
    ],
  },
  coding: {
    accent: [{ frequency: 1280, duration: 0.03, type: 'square', gain: 0.018 }],
    click: [{ frequency: 410, endFrequency: 520, duration: 0.038, type: 'square', gain: 0.04 }],
    confirm: [
      { frequency: 520, duration: 0.035, type: 'square', gain: 0.035 },
      { frequency: 1040, start: 0.035, duration: 0.06, type: 'triangle', gain: 0.035 },
    ],
  },
  rail: {
    accent: [{ frequency: 180, endFrequency: 150, duration: 0.08, type: 'triangle', gain: 0.025 }],
    click: [{ frequency: 300, endFrequency: 360, duration: 0.06, type: 'triangle', gain: 0.06 }],
    nav: [
      { frequency: 360, duration: 0.055, type: 'sine', gain: 0.05 },
      { frequency: 540, start: 0.052, duration: 0.072, type: 'sine', gain: 0.038 },
    ],
  },
  ledger: {
    accent: [{ frequency: 500, duration: 0.045, type: 'triangle', gain: 0.022 }],
    click: [{ frequency: 440, endFrequency: 390, duration: 0.045, type: 'triangle', gain: 0.055 }],
    tab: [
      { frequency: 520, duration: 0.035, type: 'triangle', gain: 0.045 },
      { frequency: 700, start: 0.032, duration: 0.055, type: 'sine', gain: 0.035 },
    ],
    select: [{ frequency: 480, endFrequency: 620, duration: 0.055, type: 'triangle', gain: 0.052 }],
    confirm: [
      { frequency: 520, duration: 0.045, type: 'triangle', gain: 0.05 },
      { frequency: 660, start: 0.04, duration: 0.07, type: 'sine', gain: 0.035 },
    ],
  },
  racing: {
    accent: [{ frequency: 980, endFrequency: 720, duration: 0.05, type: 'sawtooth', gain: 0.018 }],
    click: [{ frequency: 690, endFrequency: 420, duration: 0.05, type: 'sawtooth', gain: 0.045 }],
    confirm: [
      { frequency: 520, endFrequency: 780, duration: 0.05, type: 'triangle', gain: 0.052 },
      { frequency: 1040, start: 0.045, duration: 0.06, type: 'sine', gain: 0.035 },
    ],
  },
};

const THEME_SPATIAL_MIXES = {
  default: { panSpread: 0.24, reverb: 0.1 },
  battle: { panSpread: 0.34, reverb: 0.08 },
  twenty: { panSpread: 0.18, reverb: 0.2 },
  card: { panSpread: 0.42, reverb: 0.14 },
  survival: { panSpread: 0.28, reverb: 0.18 },
  kitchen: { panSpread: 0.3, reverb: 0.11 },
  idle: { panSpread: 0.4, reverb: 0.23 },
  tactical: { panSpread: 0.46, reverb: 0.07 },
  broadcast: { panSpread: 0.3, reverb: 0.19 },
  school: { panSpread: 0.24, reverb: 0.18 },
  coding: { panSpread: 0.38, reverb: 0.06 },
  rail: { panSpread: 0.44, reverb: 0.15 },
  ledger: { panSpread: 0.18, reverb: 0.12 },
  racing: { panSpread: 0.48, reverb: 0.08 },
};

let sharedSfxSession = null;

function cueProfile(cue, theme) {
  const key = String(cue || 'click');
  const themeKey = String(theme || 'default');
  const themedProfile = THEME_CUE_PROFILES[themeKey]?.[key];
  if (themedProfile) return themedProfile;
  const baseProfile = CUE_PROFILES[key] || CUE_PROFILES.click;
  const accentProfile = key === 'click' ? [] : (THEME_CUE_PROFILES[themeKey]?.accent || []);
  return [...baseProfile, ...accentProfile];
}

function cueDuckEnvelope(profile) {
  const durationMs = Math.ceil(Math.max(
    0.08,
    ...profile.map((spec) => Number(spec.start || 0) + Number(spec.duration || 0.06)),
  ) * 1000) + 110;
  return {
    durationMs,
    multiplier: profile.length >= 3 ? 0.3 : profile.length === 2 ? 0.42 : 0.58,
  };
}

function getAudioContext() {
  if (typeof window === 'undefined') return null;
  const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextCtor) return null;
  return AudioContextCtor;
}

function createSfxReverbImpulse(ctx) {
  const duration = 0.34;
  const frameCount = Math.max(1, Math.ceil(ctx.sampleRate * duration));
  const buffer = ctx.createBuffer(2, frameCount, ctx.sampleRate);
  for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
    const samples = buffer.getChannelData(channel);
    for (let index = 0; index < frameCount; index += 1) {
      const decay = Math.pow(1 - index / frameCount, 3.2);
      samples[index] = (Math.random() * 2 - 1) * decay;
    }
  }
  return buffer;
}

function createSfxSession(AudioContextCtor) {
  const ctx = new AudioContextCtor();
  const dryGain = ctx.createGain();
  const convolver = ctx.createConvolver();
  const wetGain = ctx.createGain();
  const compressor = ctx.createDynamicsCompressor();

  dryGain.gain.value = 0.94;
  convolver.buffer = createSfxReverbImpulse(ctx);
  wetGain.gain.value = 0.72;
  compressor.threshold.value = -16;
  compressor.knee.value = 12;
  compressor.ratio.value = 4;
  compressor.attack.value = 0.004;
  compressor.release.value = 0.16;

  dryGain.connect(compressor);
  convolver.connect(wetGain);
  wetGain.connect(compressor);
  compressor.connect(ctx.destination);
  return { compressor, convolver, ctx, dryGain };
}

function getSharedSfxSession() {
  const AudioContextCtor = getAudioContext();
  if (!AudioContextCtor) return null;
  if (!sharedSfxSession || sharedSfxSession.ctx.state === 'closed') {
    sharedSfxSession = createSfxSession(AudioContextCtor);
  }
  return sharedSfxSession;
}

function sfxSpatialMix(theme, voiceCount) {
  const base = THEME_SPATIAL_MIXES[String(theme || 'default')] || THEME_SPATIAL_MIXES.default;
  return {
    panSpread: base.panSpread,
    reverb: Math.min(0.28, base.reverb + Math.max(0, Number(voiceCount || 1) - 2) * 0.015),
  };
}

function connectSfxVoice(session, output, spec, mix, voiceIndex, voiceCount, start) {
  const { ctx } = session;
  let spatialOutput = output;
  if (typeof ctx.createStereoPanner === 'function') {
    const panner = ctx.createStereoPanner();
    const normalizedIndex = voiceCount > 1 ? (voiceIndex / (voiceCount - 1)) * 2 - 1 : 0;
    const pan = Number.isFinite(Number(spec.pan))
      ? Math.max(-1, Math.min(1, Number(spec.pan)))
      : normalizedIndex * mix.panSpread;
    panner.pan.setValueAtTime(pan, start);
    output.connect(panner);
    spatialOutput = panner;
  }

  const reverbSend = ctx.createGain();
  reverbSend.gain.setValueAtTime(
    Math.max(0, Math.min(0.34, Number(spec.reverb ?? mix.reverb))),
    start,
  );
  spatialOutput.connect(session.dryGain);
  spatialOutput.connect(reverbSend);
  reverbSend.connect(session.convolver);
}

function playNoiseVoice(session, spec, volume, spatial) {
  const { ctx } = session;
  const start = ctx.currentTime + 0.004 + Number(spec.start || 0);
  const duration = Math.max(0.025, Number(spec.duration || 0.06));
  const end = start + duration;
  const frameCount = Math.max(1, Math.ceil(ctx.sampleRate * duration));
  const buffer = ctx.createBuffer(1, frameCount, ctx.sampleRate);
  const samples = buffer.getChannelData(0);
  const source = ctx.createBufferSource();
  const filter = ctx.createBiquadFilter();
  const gain = ctx.createGain();
  const peakGain = Math.max(0.001, Number(volume || 0.12) * Number(spec.gain || 0.08));

  for (let index = 0; index < frameCount; index += 1) {
    samples[index] = (Math.random() * 2 - 1) * (1 - index / frameCount);
  }
  source.buffer = buffer;
  filter.type = spec.filterType || 'bandpass';
  filter.frequency.setValueAtTime(Number(spec.frequency || 900), start);
  filter.Q.setValueAtTime(Number(spec.q || 1), start);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(peakGain, start + 0.006);
  gain.gain.exponentialRampToValueAtTime(0.0001, end);
  source.connect(filter);
  filter.connect(gain);
  connectSfxVoice(session, gain, spec, spatial.mix, spatial.index, spatial.count, start);
  source.start(start);
  source.stop(end + 0.01);
}

function playVoice(session, spec, volume, spatial) {
  if (spec.source === 'noise') {
    playNoiseVoice(session, spec, volume, spatial);
    return;
  }
  const { ctx } = session;
  const start = ctx.currentTime + 0.004 + Number(spec.start || 0);
  const duration = Math.max(0.025, Number(spec.duration || 0.06));
  const end = start + duration;
  const peakGain = Math.max(0.001, Number(volume || 0.12) * Number(spec.gain || 0.1));
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();

  oscillator.type = spec.type || 'sine';
  oscillator.frequency.setValueAtTime(Number(spec.frequency || 440), start);
  if (spec.endFrequency) {
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, Number(spec.endFrequency)), end);
  }

  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(peakGain, start + 0.009);
  gain.gain.exponentialRampToValueAtTime(0.0001, end);

  oscillator.connect(gain);
  connectSfxVoice(session, gain, spec, spatial.mix, spatial.index, spatial.count, start);
  oscillator.start(start);
  oscillator.stop(end + 0.025);
}

export default function useGameSfx({ enabled = true, theme = 'auto', volume = 0.16 } = {}) {
  const pathname = usePathname();
  const lastPlayedAtRef = useRef(0);
  const resolvedTheme = useMemo(() => resolveGameAudioTheme(theme, pathname), [pathname, theme]);

  return useCallback((cue = 'click') => {
    if (!enabled || !readGameSfxPreference(resolvedTheme)) return;
    const nowMs = Date.now();
    if (nowMs - lastPlayedAtRef.current < 28) return;
    lastPlayedAtRef.current = nowMs;
    if (typeof document !== 'undefined') {
      document.documentElement.dataset.gameSfxCue = String(cue || 'click');
      document.documentElement.dataset.gameSfxTheme = resolvedTheme;
    }

    try {
      const session = getSharedSfxSession();
      if (!session) return;
      if (session.ctx.state === 'suspended') void session.ctx.resume();
      const profile = cueProfile(cue, resolvedTheme);
      const spatialMix = sfxSpatialMix(resolvedTheme, profile.length);
      if (typeof document !== 'undefined') {
        document.documentElement.dataset.gameSfxMix = 'stereo-reverb';
        document.documentElement.dataset.gameSfxVoices = String(profile.length);
      }
      window.dispatchEvent(new CustomEvent(GAME_BGM_DUCK_EVENT, {
        detail: cueDuckEnvelope(profile),
      }));
      profile.forEach((spec, index) => playVoice(session, spec, volume, {
        count: profile.length,
        index,
        mix: spatialMix,
      }));
    } catch {
      // Audio failures should never block gameplay.
    }
  }, [enabled, resolvedTheme, volume]);
}

export function useGameSfxPreference({ theme = 'auto' } = {}) {
  const pathname = usePathname();
  const resolvedTheme = useMemo(() => resolveGameAudioTheme(theme, pathname), [pathname, theme]);
  const subscribe = useCallback((notify) => {
    const handlePreference = (event) => {
      if (event?.detail?.theme && event.detail.theme !== resolvedTheme) return;
      notify();
    };
    const handleStorage = (event) => {
      if (event.key !== gameSfxPreferenceKey(resolvedTheme)) return;
      notify();
    };

    window.addEventListener(GAME_SFX_PREFERENCE_EVENT, handlePreference);
    window.addEventListener('storage', handleStorage);
    return () => {
      window.removeEventListener(GAME_SFX_PREFERENCE_EVENT, handlePreference);
      window.removeEventListener('storage', handleStorage);
    };
  }, [resolvedTheme]);
  const getSnapshot = useCallback(() => readGameSfxPreference(resolvedTheme), [resolvedTheme]);
  const getServerSnapshot = useCallback(() => true, []);
  const enabled = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const setPreference = useCallback((nextEnabled) => {
    const next = writeGameSfxPreference(resolvedTheme, nextEnabled);
    window.dispatchEvent(new CustomEvent(GAME_SFX_PREFERENCE_EVENT, {
      detail: { enabled: next, theme: resolvedTheme },
    }));
    return next;
  }, [resolvedTheme]);

  const toggle = useCallback(
    () => setPreference(!readGameSfxPreference(resolvedTheme)),
    [resolvedTheme, setPreference],
  );

  return {
    enabled,
    resolvedTheme,
    setPreference,
    toggle,
  };
}

export function isDisabledGameSfxControl(control) {
  if (!control) return true;
  return control.hasAttribute('disabled')
    || control.getAttribute('aria-disabled') === 'true'
    || control.getAttribute('data-disabled') === 'true';
}

export function getGameSfxCueFromControl(control) {
  const explicitCue = String(control?.getAttribute('data-game-sfx') || '').trim();
  if (explicitCue === 'off') return '';
  if (explicitCue) return explicitCue;

  const tagName = String(control?.tagName || '').toLowerCase();
  const role = String(control?.getAttribute('role') || '').toLowerCase();
  const className = String(control?.getAttribute('class') || '').toLowerCase();

  if (role === 'tab') return 'tab';
  if (tagName === 'summary') return 'toggle';
  if (className.includes('danger') || className.includes('delete') || className.includes('reset')) return 'warning';
  const semantic = inferGameActionSemantic(
    control?.textContent,
    control?.getAttribute('aria-label'),
    control?.getAttribute('title'),
  );
  if (semantic.kind !== 'action') return semantic.cue;
  if (tagName === 'a') return 'nav';
  if (className.includes('primary') || className.includes('save')) return 'confirm';
  return 'click';
}

export function useGameSfxEventHandlers(options) {
  const playGameSfx = useGameSfx(options);
  const handleGameSfxPointerDownCapture = useCallback((event) => {
    const target = event.target instanceof Element ? event.target : null;
    const control = target?.closest('button, a, summary, [role="tab"], [data-game-sfx]');
    if (!control || !event.currentTarget.contains(control) || isDisabledGameSfxControl(control)) return;
    const cue = getGameSfxCueFromControl(control);
    if (cue) playGameSfx(cue);
  }, [playGameSfx]);
  const handleGameSfxChangeCapture = useCallback((event) => {
    const target = event.target instanceof Element ? event.target : null;
    const control = target?.closest('select, input[type="checkbox"], input[type="radio"], input[type="range"], [data-game-sfx-change]');
    if (!control || !event.currentTarget.contains(control) || isDisabledGameSfxControl(control)) return;
    const explicitCue = String(control.getAttribute('data-game-sfx-change') || '').trim();
    playGameSfx(explicitCue || 'select');
  }, [playGameSfx]);

  return {
    handleGameSfxChangeCapture,
    handleGameSfxPointerDownCapture,
    playGameSfx,
  };
}
