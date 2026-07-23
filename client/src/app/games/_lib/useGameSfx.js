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
  farm: [
    { source: 'noise', filterType: 'lowpass', frequency: 620, duration: 0.06, gain: 0.032, pan: -0.24 },
    { frequency: 220, endFrequency: 275, duration: 0.075, type: 'triangle', gain: 0.044, pan: -0.14 },
    { frequency: 330, start: 0.06, duration: 0.085, type: 'sine', gain: 0.038, pan: 0.08 },
    { frequency: 440, start: 0.13, duration: 0.095, type: 'sine', gain: 0.032, pan: 0.28, reverb: 0.16 },
  ],
  herd: [
    { source: 'noise', filterType: 'bandpass', frequency: 480, q: 1.2, duration: 0.045, gain: 0.024, pan: -0.2 },
    { frequency: 392, duration: 0.08, type: 'triangle', gain: 0.043, pan: -0.16, reverb: 0.14 },
    { frequency: 587.33, start: 0.07, duration: 0.11, type: 'sine', gain: 0.036, pan: 0.2, reverb: 0.24 },
  ],
  fish: [
    { source: 'noise', filterType: 'highpass', frequency: 1550, duration: 0.055, gain: 0.03, pan: -0.26, reverb: 0.22 },
    { frequency: 520, endFrequency: 390, duration: 0.07, type: 'sine', gain: 0.041, pan: -0.14 },
    { frequency: 780, start: 0.065, duration: 0.09, type: 'sine', gain: 0.034, pan: 0.24, reverb: 0.28 },
  ],
  mine: [
    { source: 'noise', filterType: 'bandpass', frequency: 1050, q: 3.4, duration: 0.035, gain: 0.042, pan: -0.2 },
    { frequency: 185, endFrequency: 130, duration: 0.085, type: 'triangle', gain: 0.047, pan: -0.12 },
    { frequency: 1480, start: 0.025, duration: 0.07, type: 'sine', gain: 0.034, pan: 0.16, reverb: 0.2 },
    { frequency: 2220, start: 0.075, duration: 0.095, type: 'sine', gain: 0.025, pan: 0.3, reverb: 0.3 },
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
  businessMode: [
    { source: 'noise', filterType: 'highpass', frequency: 2200, duration: 0.045, gain: 0.022, pan: -0.32 },
    { frequency: 392, endFrequency: 523, duration: 0.065, type: 'triangle', gain: 0.043, pan: -0.2 },
    { frequency: 659, start: 0.06, duration: 0.08, type: 'triangle', gain: 0.042, pan: 0.12 },
    { frequency: 1047, start: 0.13, duration: 0.12, type: 'sine', gain: 0.034, pan: 0.32, reverb: 0.24 },
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
  foreignCashCollect: [
    { frequency: 740, duration: 0.04, type: 'triangle', gain: 0.038, pan: -0.32 },
    { frequency: 1110, start: 0.035, duration: 0.055, type: 'triangle', gain: 0.036, pan: 0.32 },
    { frequency: 1480, start: 0.085, duration: 0.09, type: 'sine', gain: 0.032, pan: 0.06, reverb: 0.22 },
  ],
  liquidityWarning: [
    { source: 'noise', filterType: 'lowpass', frequency: 520, q: 1.1, duration: 0.13, gain: 0.032, pan: -0.22 },
    { frequency: 330, endFrequency: 220, duration: 0.14, type: 'triangle', gain: 0.044, pan: -0.16 },
    { frequency: 165, start: 0.12, duration: 0.17, type: 'sine', gain: 0.038, pan: 0.18, reverb: 0.18 },
  ],
  inventoryAlert: [
    { source: 'noise', filterType: 'bandpass', frequency: 860, q: 2.2, duration: 0.06, gain: 0.03, pan: -0.34 },
    { frequency: 420, duration: 0.06, type: 'square', gain: 0.037, pan: -0.18 },
    { frequency: 315, start: 0.07, duration: 0.1, type: 'triangle', gain: 0.04, pan: 0.24 },
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
  inventoryWriteDown: [
    { source: 'noise', filterType: 'lowpass', frequency: 580, duration: 0.11, gain: 0.036, pan: -0.28, reverb: 0.16 },
    { frequency: 392, endFrequency: 294, duration: 0.1, type: 'triangle', gain: 0.042, pan: -0.18 },
    { frequency: 220, endFrequency: 147, start: 0.085, duration: 0.16, type: 'sine', gain: 0.04, pan: 0.16, reverb: 0.2 },
    { frequency: 98, start: 0.2, duration: 0.14, type: 'sine', gain: 0.034, pan: 0.28, reverb: 0.22 },
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
  railNetworkClear: [
    { source: 'noise', filterType: 'highpass', frequency: 2200, duration: 0.035, gain: 0.022 },
    { frequency: 390, duration: 0.045, type: 'triangle', gain: 0.04, pan: -0.24 },
    { frequency: 585, start: 0.04, duration: 0.06, type: 'triangle', gain: 0.041 },
    { frequency: 780, start: 0.095, duration: 0.11, type: 'sine', gain: 0.037, pan: 0.24 },
  ],
  railJunction: [
    { source: 'noise', filterType: 'bandpass', frequency: 980, q: 3, duration: 0.03, gain: 0.034, pan: -0.3 },
    { source: 'noise', filterType: 'bandpass', frequency: 1380, q: 3.2, start: 0.045, duration: 0.028, gain: 0.03, pan: 0.3 },
    { frequency: 330, endFrequency: 440, duration: 0.075, type: 'triangle', gain: 0.038, pan: -0.18 },
    { frequency: 660, endFrequency: 550, start: 0.055, duration: 0.09, type: 'sine', gain: 0.034, pan: 0.18 },
  ],
  railTokenHandoff: [
    { source: 'noise', filterType: 'highpass', frequency: 2600, duration: 0.025, gain: 0.02 },
    { frequency: 520, duration: 0.038, type: 'square', gain: 0.034, pan: -0.22 },
    { frequency: 780, start: 0.036, duration: 0.05, type: 'triangle', gain: 0.037 },
    { frequency: 1040, start: 0.082, duration: 0.08, type: 'sine', gain: 0.032, pan: 0.22 },
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
  raceSessionStart: [
    { source: 'noise', filterType: 'highpass', frequency: 1800, duration: 0.05, gain: 0.028 },
    { frequency: 330, duration: 0.05, type: 'square', gain: 0.042 },
    { frequency: 660, start: 0.08, duration: 0.08, type: 'triangle', gain: 0.04 },
  ],
  raceSegment: [
    { source: 'noise', filterType: 'bandpass', frequency: 460, q: 1.1, duration: 0.06, gain: 0.034 },
    { frequency: 150, duration: 0.045, type: 'triangle', gain: 0.04 },
    { frequency: 180, start: 0.065, duration: 0.045, type: 'triangle', gain: 0.038 },
  ],
  raceOvertake: [
    { frequency: 330, endFrequency: 520, duration: 0.08, type: 'sawtooth', gain: 0.04 },
    { frequency: 660, start: 0.075, duration: 0.08, type: 'triangle', gain: 0.042 },
    { frequency: 990, start: 0.145, duration: 0.1, type: 'sine', gain: 0.035 },
  ],
  raceBlocked: [
    { source: 'noise', filterType: 'lowpass', frequency: 520, duration: 0.1, gain: 0.045 },
    { frequency: 240, endFrequency: 150, duration: 0.12, type: 'square', gain: 0.045 },
  ],
  raceFinalSpurt: [
    { source: 'noise', filterType: 'bandpass', frequency: 780, q: 1.2, duration: 0.18, gain: 0.035 },
    { frequency: 260, duration: 0.04, type: 'triangle', gain: 0.044 },
    { frequency: 390, start: 0.055, duration: 0.045, type: 'triangle', gain: 0.044 },
    { frequency: 585, start: 0.115, duration: 0.06, type: 'triangle', gain: 0.042 },
  ],
  raceFinish: [
    { source: 'noise', filterType: 'highpass', frequency: 2200, duration: 0.09, gain: 0.03 },
    { frequency: 392, duration: 0.05, type: 'triangle', gain: 0.047 },
    { frequency: 523, start: 0.045, duration: 0.065, type: 'triangle', gain: 0.046 },
    { frequency: 784, start: 0.105, duration: 0.085, type: 'triangle', gain: 0.044 },
    { frequency: 1046, start: 0.18, duration: 0.15, type: 'sine', gain: 0.038 },
  ],
  raceStrategy: [
    { frequency: 420, duration: 0.04, type: 'square', gain: 0.037 },
    { frequency: 630, start: 0.04, duration: 0.065, type: 'triangle', gain: 0.04 },
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
  vanguardRideBlocked: [
    { source: 'noise', filterType: 'highpass', frequency: 1700, duration: 0.045, gain: 0.02, pan: -0.28 },
    { frequency: 520, endFrequency: 350, duration: 0.08, type: 'triangle', gain: 0.04 },
    { frequency: 220, start: 0.07, duration: 0.11, type: 'sine', gain: 0.036, pan: 0.24 },
  ],
  vanguardStrideBlocked: [
    { source: 'noise', filterType: 'bandpass', frequency: 620, q: 1.5, duration: 0.09, gain: 0.03, pan: -0.3 },
    { frequency: 330, endFrequency: 165, duration: 0.12, type: 'sawtooth', gain: 0.034 },
    { frequency: 110, start: 0.1, duration: 0.14, type: 'sine', gain: 0.038, pan: 0.25 },
  ],
  vanguardSkillBlocked: [
    { source: 'noise', filterType: 'highpass', frequency: 2300, duration: 0.035, gain: 0.022, pan: -0.25 },
    { frequency: 880, endFrequency: 440, duration: 0.07, type: 'square', gain: 0.03 },
    { frequency: 260, start: 0.065, duration: 0.11, type: 'triangle', gain: 0.038, pan: 0.24 },
  ],
  vanguardGuardBlocked: [
    { source: 'noise', filterType: 'lowpass', frequency: 500, duration: 0.09, gain: 0.04, pan: -0.24 },
    { frequency: 300, endFrequency: 190, duration: 0.11, type: 'square', gain: 0.034 },
    { frequency: 150, start: 0.08, duration: 0.13, type: 'sine', gain: 0.038, pan: 0.22 },
  ],
  vanguardAttackDenied: [
    { source: 'noise', filterType: 'bandpass', frequency: 950, q: 1.8, duration: 0.05, gain: 0.035, pan: -0.3 },
    { frequency: 420, endFrequency: 210, duration: 0.09, type: 'sawtooth', gain: 0.035 },
    { frequency: 170, start: 0.075, duration: 0.12, type: 'sine', gain: 0.038, pan: 0.26 },
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
  vanguardRideAssist: [
    { source: 'noise', filterType: 'highpass', frequency: 1900, duration: 0.05, gain: 0.024 },
    { frequency: 392, duration: 0.045, type: 'triangle', gain: 0.04 },
    { frequency: 587, start: 0.04, duration: 0.06, type: 'triangle', gain: 0.04 },
    { frequency: 784, start: 0.095, duration: 0.09, type: 'sine', gain: 0.034 },
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
  vanguardTriggerCritical: [
    { source: 'noise', filterType: 'bandpass', frequency: 1150, q: 1.2, duration: 0.075, gain: 0.038 },
    { frequency: 196, endFrequency: 392, duration: 0.07, type: 'sawtooth', gain: 0.038 },
    { frequency: 988, start: 0.065, duration: 0.1, type: 'triangle', gain: 0.038 },
  ],
  vanguardTriggerDraw: [
    { source: 'noise', filterType: 'highpass', frequency: 2300, duration: 0.055, gain: 0.026 },
    { frequency: 523, duration: 0.045, type: 'triangle', gain: 0.038 },
    { frequency: 659, start: 0.04, duration: 0.06, type: 'triangle', gain: 0.038 },
    { frequency: 1047, start: 0.095, duration: 0.08, type: 'sine', gain: 0.032 },
  ],
  vanguardTriggerStand: [
    { source: 'noise', filterType: 'bandpass', frequency: 1700, q: 1.1, duration: 0.07, gain: 0.026 },
    { frequency: 349, duration: 0.04, type: 'square', gain: 0.032 },
    { frequency: 698, start: 0.035, duration: 0.055, type: 'triangle', gain: 0.038 },
    { frequency: 1047, start: 0.085, duration: 0.09, type: 'sine', gain: 0.032 },
  ],
  vanguardTriggerHeal: [
    { source: 'noise', filterType: 'highpass', frequency: 2800, duration: 0.06, gain: 0.022 },
    { frequency: 440, duration: 0.055, type: 'sine', gain: 0.036 },
    { frequency: 660, start: 0.05, duration: 0.075, type: 'sine', gain: 0.038 },
    { frequency: 880, start: 0.12, duration: 0.11, type: 'sine', gain: 0.034 },
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
  codeFileSelect: [
    { source: 'noise', filterType: 'highpass', frequency: 2400, duration: 0.022, gain: 0.014, pan: -0.28 },
    { frequency: 480, duration: 0.032, type: 'square', gain: 0.032, pan: -0.16 },
    { frequency: 720, start: 0.03, duration: 0.05, type: 'triangle', gain: 0.033, pan: 0.22 },
  ],
  codeSubmit: [
    { source: 'noise', filterType: 'bandpass', frequency: 1280, q: 1.8, duration: 0.055, gain: 0.021, pan: -0.34 },
    { frequency: 220, endFrequency: 330, duration: 0.065, type: 'square', gain: 0.033, pan: -0.2 },
    { frequency: 660, start: 0.058, duration: 0.052, type: 'triangle', gain: 0.037, pan: 0.08 },
    { frequency: 990, start: 0.105, duration: 0.075, type: 'sine', gain: 0.032, pan: 0.3, reverb: 0.12 },
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
  projectHeld: [
    { source: 'noise', filterType: 'bandpass', frequency: 860, q: 2.2, duration: 0.06, gain: 0.021, pan: -0.28 },
    { frequency: 440, duration: 0.055, type: 'triangle', gain: 0.038, pan: -0.16 },
    { frequency: 520, start: 0.075, duration: 0.06, type: 'triangle', gain: 0.035, pan: 0.16 },
    { frequency: 440, start: 0.15, duration: 0.09, type: 'sine', gain: 0.031, pan: 0.26, reverb: 0.12 },
  ],
  codingBlocked: [
    { source: 'noise', filterType: 'bandpass', frequency: 720, q: 3.2, duration: 0.045, gain: 0.024, pan: -0.28 },
    { frequency: 310, endFrequency: 230, duration: 0.07, type: 'square', gain: 0.035, pan: -0.12 },
    { frequency: 190, start: 0.065, duration: 0.095, type: 'triangle', gain: 0.034, pan: 0.2 },
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
  tcgDirectAttack: [
    { source: 'noise', filterType: 'bandpass', frequency: 1320, q: 1.1, duration: 0.075, gain: 0.06 },
    { frequency: 320, endFrequency: 96, duration: 0.15, type: 'sawtooth', gain: 0.046 },
    { frequency: 920, start: 0.1, duration: 0.1, type: 'triangle', gain: 0.035 },
  ],
  tcgPierce: [
    { source: 'noise', filterType: 'highpass', frequency: 2300, duration: 0.08, gain: 0.045 },
    { frequency: 1480, endFrequency: 260, duration: 0.12, type: 'sawtooth', gain: 0.038 },
    { frequency: 190, start: 0.09, duration: 0.11, type: 'sine', gain: 0.04 },
  ],
  tcgClash: [
    { source: 'noise', filterType: 'bandpass', frequency: 1080, q: 2.2, duration: 0.07, gain: 0.064 },
    { frequency: 540, endFrequency: 360, duration: 0.09, type: 'square', gain: 0.04 },
  ],
  tcgShield: [
    { frequency: 420, endFrequency: 760, duration: 0.09, type: 'triangle', gain: 0.042 },
    { frequency: 1040, start: 0.06, duration: 0.15, type: 'sine', gain: 0.04 },
  ],
  tcgShieldBreak: [
    { source: 'noise', filterType: 'highpass', frequency: 1800, duration: 0.095, gain: 0.055 },
    { frequency: 860, endFrequency: 210, duration: 0.13, type: 'square', gain: 0.04 },
  ],
  tcgBanish: [
    { source: 'noise', filterType: 'bandpass', frequency: 1250, q: 1.4, duration: 0.12, gain: 0.045 },
    { frequency: 880, endFrequency: 140, duration: 0.16, type: 'triangle', gain: 0.042 },
  ],
  tcgHeal: [
    { frequency: 440, duration: 0.045, type: 'sine', gain: 0.04 },
    { frequency: 660, start: 0.04, duration: 0.065, type: 'sine', gain: 0.042 },
    { frequency: 990, start: 0.1, duration: 0.11, type: 'sine', gain: 0.036 },
  ],
  tcgCounter: [
    { frequency: 1280, endFrequency: 360, duration: 0.09, type: 'square', gain: 0.038 },
    { source: 'noise', filterType: 'bandpass', frequency: 780, q: 3, start: 0.05, duration: 0.09, gain: 0.05 },
    { frequency: 210, start: 0.1, duration: 0.13, type: 'sine', gain: 0.04 },
  ],
  tcgChainResolve: [
    { frequency: 620, duration: 0.04, type: 'triangle', gain: 0.042 },
    { frequency: 930, start: 0.04, duration: 0.06, type: 'triangle', gain: 0.04 },
    { frequency: 1240, start: 0.095, duration: 0.1, type: 'sine', gain: 0.034 },
  ],
  tcgDeckOut: [
    { source: 'noise', filterType: 'lowpass', frequency: 520, duration: 0.12, gain: 0.045 },
    { frequency: 390, endFrequency: 180, duration: 0.15, type: 'triangle', gain: 0.046 },
    { frequency: 120, start: 0.12, duration: 0.18, type: 'sine', gain: 0.038 },
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
  tcgTargetPrompt: [
    { source: 'noise', filterType: 'bandpass', frequency: 1500, q: 1.7, duration: 0.035, gain: 0.022, pan: -0.28 },
    { frequency: 660, duration: 0.045, type: 'square', gain: 0.032, pan: -0.12 },
    { frequency: 990, start: 0.05, duration: 0.08, type: 'sine', gain: 0.036, pan: 0.28 },
  ],
  tcgDeckSearch: [
    { source: 'noise', filterType: 'highpass', frequency: 1900, duration: 0.065, gain: 0.024, pan: -0.3 },
    { frequency: 440, endFrequency: 660, duration: 0.06, type: 'triangle', gain: 0.038, pan: -0.12 },
    { frequency: 880, start: 0.055, duration: 0.09, type: 'sine', gain: 0.036, pan: 0.3 },
  ],
  tcgTriggerPrompt: [
    { source: 'noise', filterType: 'highpass', frequency: 2600, duration: 0.04, gain: 0.02, pan: -0.3 },
    { frequency: 784, duration: 0.045, type: 'triangle', gain: 0.04, pan: -0.14 },
    { frequency: 1176, start: 0.04, duration: 0.065, type: 'triangle', gain: 0.038, pan: 0.1 },
    { frequency: 1568, start: 0.1, duration: 0.1, type: 'sine', gain: 0.032, pan: 0.32 },
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
  twentyRoomEnter: [
    { source: 'noise', filterType: 'bandpass', frequency: 760, q: 1.2, duration: 0.055, gain: 0.022, pan: -0.24, reverb: 0.12 },
    { frequency: 330, endFrequency: 440, duration: 0.065, type: 'triangle', gain: 0.042, pan: -0.12 },
    { frequency: 660, start: 0.055, duration: 0.085, type: 'sine', gain: 0.037, pan: 0.22, reverb: 0.18 },
  ],
  twentyQuestion: [
    { frequency: 620, duration: 0.04, type: 'sine', gain: 0.042 },
    { frequency: 930, start: 0.04, duration: 0.08, type: 'sine', gain: 0.038 },
  ],
  twentyQuestionQueued: [
    { source: 'noise', filterType: 'highpass', frequency: 1900, duration: 0.025, gain: 0.015, pan: -0.3 },
    { frequency: 540, duration: 0.045, type: 'triangle', gain: 0.043, pan: -0.2 },
    { frequency: 810, start: 0.042, duration: 0.055, type: 'triangle', gain: 0.04, pan: 0.16 },
    { frequency: 720, start: 0.105, duration: 0.09, type: 'sine', gain: 0.034, pan: 0.28, reverb: 0.2 },
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
  twentyHintSent: [
    { source: 'noise', filterType: 'highpass', frequency: 2100, duration: 0.035, gain: 0.018, pan: -0.32, reverb: 0.14 },
    { frequency: 660, endFrequency: 900, duration: 0.075, type: 'triangle', gain: 0.041, pan: -0.12 },
    { frequency: 1120, start: 0.064, duration: 0.095, type: 'sine', gain: 0.035, pan: 0.28, reverb: 0.24 },
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
  twentyAttemptsExhausted: [
    { source: 'noise', filterType: 'lowpass', frequency: 520, duration: 0.06, gain: 0.026, pan: -0.18 },
    { frequency: 270, endFrequency: 195, duration: 0.1, type: 'triangle', gain: 0.046, pan: -0.12 },
    { frequency: 180, start: 0.105, duration: 0.13, type: 'sine', gain: 0.039, pan: 0.18, reverb: 0.12 },
  ],
  twentyHostOnly: [
    { source: 'noise', filterType: 'bandpass', frequency: 920, q: 4, duration: 0.028, gain: 0.022, pan: -0.2 },
    { frequency: 430, endFrequency: 360, duration: 0.045, type: 'square', gain: 0.032, pan: -0.1 },
    { frequency: 240, start: 0.045, duration: 0.08, type: 'triangle', gain: 0.038, pan: 0.16 },
  ],
  twentyQuestionArrive: [
    { source: 'noise', filterType: 'highpass', frequency: 2200, duration: 0.025, gain: 0.016, pan: -0.34, reverb: 0.16 },
    { frequency: 480, duration: 0.04, type: 'triangle', gain: 0.04, pan: -0.24 },
    { frequency: 720, start: 0.04, duration: 0.055, type: 'triangle', gain: 0.038, pan: 0.02 },
    { frequency: 960, start: 0.09, duration: 0.09, type: 'sine', gain: 0.033, pan: 0.3, reverb: 0.24 },
  ],
  twentyGuessArrive: [
    { source: 'noise', filterType: 'bandpass', frequency: 540, q: 1.6, duration: 0.05, gain: 0.023, pan: -0.16 },
    { frequency: 220, endFrequency: 275, duration: 0.085, type: 'triangle', gain: 0.043, pan: -0.12 },
    { frequency: 330, start: 0.075, duration: 0.105, type: 'sine', gain: 0.037, pan: 0.2, reverb: 0.16 },
  ],
  twentyHintArrive: [
    { source: 'noise', filterType: 'highpass', frequency: 2800, duration: 0.045, gain: 0.018, pan: -0.3, reverb: 0.28 },
    { frequency: 880, duration: 0.055, type: 'sine', gain: 0.038, pan: -0.2, reverb: 0.2 },
    { frequency: 1320, start: 0.045, duration: 0.075, type: 'sine', gain: 0.034, pan: 0.08, reverb: 0.28 },
    { frequency: 1760, start: 0.105, duration: 0.11, type: 'sine', gain: 0.028, pan: 0.32, reverb: 0.36 },
  ],
  twentyLimitReveal: [
    { source: 'noise', filterType: 'lowpass', frequency: 680, duration: 0.07, gain: 0.026, pan: -0.2 },
    { frequency: 440, endFrequency: 330, duration: 0.095, type: 'triangle', gain: 0.045, pan: -0.16 },
    { frequency: 261.63, start: 0.09, duration: 0.115, type: 'triangle', gain: 0.041, pan: 0.04 },
    { frequency: 196, start: 0.195, duration: 0.15, type: 'sine', gain: 0.038, pan: 0.2, reverb: 0.18 },
    { frequency: 659.25, start: 0.31, duration: 0.16, type: 'sine', gain: 0.03, pan: 0.28, reverb: 0.3 },
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
  objectivePending: [
    { frequency: 740, endFrequency: 980, duration: 0.045, type: 'square', gain: 0.036, pan: -0.28 },
    { frequency: 980, endFrequency: 740, start: 0.065, duration: 0.045, type: 'square', gain: 0.036, pan: 0.28 },
    { frequency: 185, start: 0.13, duration: 0.16, type: 'sine', gain: 0.038, reverb: 0.22 },
    { source: 'noise', filterType: 'bandpass', frequency: 1320, start: 0.16, duration: 0.08, gain: 0.025, reverb: 0.18 },
  ],
  objectiveCapture: [
    { source: 'noise', filterType: 'highpass', frequency: 1900, duration: 0.04, gain: 0.025 },
    { frequency: 440, duration: 0.055, type: 'triangle', gain: 0.045 },
    { frequency: 660, start: 0.05, duration: 0.065, type: 'triangle', gain: 0.046 },
    { frequency: 990, start: 0.11, duration: 0.13, type: 'sine', gain: 0.038 },
  ],
  missionEvent: [
    { frequency: 520, endFrequency: 720, duration: 0.07, type: 'sawtooth', gain: 0.035 },
    { frequency: 1040, start: 0.065, duration: 0.095, type: 'sine', gain: 0.032 },
  ],
  missionEventSmoke: [
    { source: 'noise', filterType: 'lowpass', frequency: 780, duration: 0.22, gain: 0.055 },
    { frequency: 260, endFrequency: 170, duration: 0.17, type: 'sine', gain: 0.028 },
    { frequency: 880, start: 0.08, duration: 0.08, type: 'triangle', gain: 0.026 },
  ],
  reinforcement: [
    { frequency: 300, duration: 0.04, type: 'square', gain: 0.042 },
    { frequency: 420, start: 0.045, duration: 0.045, type: 'square', gain: 0.04 },
    { frequency: 620, start: 0.09, duration: 0.07, type: 'triangle', gain: 0.045 },
    { source: 'noise', filterType: 'bandpass', frequency: 1250, start: 0.135, duration: 0.055, gain: 0.035 },
  ],
  missionEventSupply: [
    { frequency: 520, duration: 0.05, type: 'sine', gain: 0.043 },
    { frequency: 780, start: 0.045, duration: 0.07, type: 'triangle', gain: 0.044 },
    { frequency: 1170, start: 0.105, duration: 0.11, type: 'sine', gain: 0.034 },
  ],
  missionEventCommand: [
    { source: 'noise', filterType: 'bandpass', frequency: 1180, duration: 0.03, gain: 0.035 },
    { frequency: 390, duration: 0.06, type: 'square', gain: 0.035 },
    { frequency: 585, start: 0.055, duration: 0.065, type: 'square', gain: 0.035 },
    { frequency: 780, start: 0.115, duration: 0.08, type: 'triangle', gain: 0.032 },
  ],
  missionEventHazard: [
    { frequency: 760, endFrequency: 310, duration: 0.105, type: 'sawtooth', gain: 0.04 },
    { source: 'noise', filterType: 'lowpass', frequency: 460, start: 0.04, duration: 0.16, gain: 0.075 },
    { frequency: 120, endFrequency: 82, start: 0.055, duration: 0.18, type: 'square', gain: 0.045 },
  ],
  enemyMark: [
    { frequency: 920, duration: 0.025, type: 'square', gain: 0.034 },
    { frequency: 1220, start: 0.055, duration: 0.03, type: 'square', gain: 0.034 },
    { frequency: 1640, start: 0.11, duration: 0.065, type: 'sine', gain: 0.03 },
  ],
  enemySuppress: [
    { source: 'noise', filterType: 'bandpass', frequency: 1280, q: 1.8, duration: 0.04, gain: 0.07 },
    { frequency: 240, endFrequency: 155, duration: 0.075, type: 'sawtooth', gain: 0.046 },
    { source: 'noise', filterType: 'bandpass', frequency: 1120, q: 1.5, start: 0.09, duration: 0.045, gain: 0.06 },
  ],
  enemyBulwark: [
    { source: 'noise', filterType: 'bandpass', frequency: 560, q: 2.1, duration: 0.065, gain: 0.055 },
    { frequency: 190, endFrequency: 145, duration: 0.13, type: 'triangle', gain: 0.05 },
    { frequency: 760, start: 0.075, duration: 0.12, type: 'sine', gain: 0.03 },
  ],
  enemyBarrage: [
    { frequency: 640, endFrequency: 220, duration: 0.12, type: 'sawtooth', gain: 0.045 },
    { source: 'noise', filterType: 'lowpass', frequency: 380, start: 0.08, duration: 0.18, gain: 0.09 },
    { frequency: 105, endFrequency: 72, start: 0.09, duration: 0.22, type: 'square', gain: 0.05 },
  ],
  enemyCommand: [
    { frequency: 330, duration: 0.045, type: 'square', gain: 0.038 },
    { frequency: 495, start: 0.045, duration: 0.05, type: 'square', gain: 0.038 },
    { frequency: 742, start: 0.095, duration: 0.08, type: 'triangle', gain: 0.04 },
    { frequency: 990, start: 0.17, duration: 0.09, type: 'sine', gain: 0.03 },
  ],
  enemyAssault: [
    { frequency: 260, endFrequency: 390, duration: 0.065, type: 'sawtooth', gain: 0.045 },
    { source: 'noise', filterType: 'bandpass', frequency: 820, start: 0.055, duration: 0.065, gain: 0.07 },
    { frequency: 145, endFrequency: 95, start: 0.07, duration: 0.11, type: 'square', gain: 0.045 },
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
  propertyBuy: [
    { source: 'noise', filterType: 'lowpass', frequency: 420, duration: 0.055, gain: 0.042 },
    { frequency: 330, endFrequency: 260, duration: 0.07, type: 'triangle', gain: 0.04 },
    { frequency: 660, start: 0.055, duration: 0.055, type: 'triangle', gain: 0.043 },
    { frequency: 990, start: 0.105, duration: 0.1, type: 'sine', gain: 0.035 },
  ],
  propertyRent: [
    { source: 'noise', filterType: 'highpass', frequency: 1800, duration: 0.026, gain: 0.028 },
    { frequency: 520, endFrequency: 680, duration: 0.055, type: 'square', gain: 0.032 },
    { frequency: 1040, start: 0.05, duration: 0.085, type: 'sine', gain: 0.035 },
  ],
  propertyLease: [
    { frequency: 430, duration: 0.035, type: 'square', gain: 0.035 },
    { frequency: 645, start: 0.034, duration: 0.045, type: 'triangle', gain: 0.04 },
    { frequency: 860, start: 0.076, duration: 0.075, type: 'sine', gain: 0.035 },
  ],
  propertyUpgrade: [
    { source: 'noise', filterType: 'bandpass', frequency: 920, q: 1.8, duration: 0.04, gain: 0.05 },
    { source: 'noise', filterType: 'bandpass', frequency: 1160, q: 2, start: 0.075, duration: 0.035, gain: 0.045 },
    { frequency: 390, endFrequency: 620, start: 0.035, duration: 0.11, type: 'triangle', gain: 0.04 },
    { frequency: 930, start: 0.125, duration: 0.1, type: 'sine', gain: 0.035 },
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
  dutyPartial: [
    { frequency: 360, duration: 0.045, type: 'triangle', gain: 0.045 },
    { frequency: 570, start: 0.04, duration: 0.055, type: 'triangle', gain: 0.04 },
    { frequency: 390, endFrequency: 280, start: 0.09, duration: 0.1, type: 'sine', gain: 0.038 },
  ],
  dutyDefeat: [
    { source: 'noise', filterType: 'lowpass', frequency: 430, duration: 0.07, gain: 0.055 },
    { frequency: 270, endFrequency: 170, duration: 0.105, type: 'triangle', gain: 0.045 },
    { frequency: 150, endFrequency: 95, start: 0.08, duration: 0.13, type: 'sine', gain: 0.04 },
  ],
  towerClear: [
    { source: 'noise', filterType: 'highpass', frequency: 1700, duration: 0.055, gain: 0.03 },
    { frequency: 330, duration: 0.045, type: 'triangle', gain: 0.05 },
    { frequency: 550, start: 0.04, duration: 0.06, type: 'triangle', gain: 0.048 },
    { frequency: 880, start: 0.095, duration: 0.11, type: 'sine', gain: 0.04 },
  ],
  towerPartial: [
    { frequency: 310, duration: 0.04, type: 'triangle', gain: 0.048 },
    { frequency: 520, start: 0.038, duration: 0.055, type: 'triangle', gain: 0.044 },
    { frequency: 430, endFrequency: 320, start: 0.09, duration: 0.105, type: 'sine', gain: 0.038 },
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
  eternal: {
    accent: [
      { frequency: 92, duration: 0.11, type: 'sine', gain: 0.022, pan: -0.36, reverb: 0.18 },
      { source: 'noise', filterType: 'highpass', frequency: 2600, duration: 0.035, gain: 0.012, pan: 0.36 },
    ],
    click: [
      { source: 'noise', filterType: 'highpass', frequency: 2200, duration: 0.025, gain: 0.018, pan: -0.24 },
      { frequency: 420, endFrequency: 330, duration: 0.05, type: 'triangle', gain: 0.055, pan: 0.16 },
    ],
    tab: [
      { source: 'noise', filterType: 'highpass', frequency: 2800, duration: 0.026, gain: 0.017, pan: -0.36 },
      { frequency: 390, duration: 0.035, type: 'square', gain: 0.034, pan: -0.2 },
      { frequency: 585, start: 0.032, duration: 0.052, type: 'triangle', gain: 0.039 },
      { frequency: 1170, start: 0.082, duration: 0.09, type: 'sine', gain: 0.03, pan: 0.34, reverb: 0.25 },
    ],
    select: [
      { source: 'noise', filterType: 'bandpass', frequency: 1700, q: 1.8, duration: 0.03, gain: 0.018, pan: -0.3 },
      { frequency: 330, endFrequency: 440, duration: 0.06, type: 'triangle', gain: 0.052, pan: -0.12 },
      { frequency: 880, start: 0.052, duration: 0.09, type: 'sine', gain: 0.034, pan: 0.3, reverb: 0.2 },
    ],
    toggle: [
      { frequency: 260, endFrequency: 390, duration: 0.06, type: 'square', gain: 0.038, pan: -0.24 },
      { frequency: 780, start: 0.052, duration: 0.08, type: 'triangle', gain: 0.036, pan: 0.26, reverb: 0.18 },
    ],
    nav: [
      { source: 'noise', filterType: 'highpass', frequency: 2400, duration: 0.032, gain: 0.016, pan: -0.32 },
      { frequency: 520, endFrequency: 780, duration: 0.07, type: 'triangle', gain: 0.046 },
      { frequency: 1040, start: 0.065, duration: 0.09, type: 'sine', gain: 0.03, pan: 0.32, reverb: 0.22 },
    ],
    confirm: [
      { source: 'noise', filterType: 'highpass', frequency: 2500, duration: 0.045, gain: 0.02, pan: -0.36 },
      { frequency: 330, duration: 0.045, type: 'triangle', gain: 0.046, pan: -0.2 },
      { frequency: 660, start: 0.04, duration: 0.065, type: 'triangle', gain: 0.044 },
      { frequency: 1320, start: 0.1, duration: 0.13, type: 'sine', gain: 0.033, pan: 0.36, reverb: 0.28 },
    ],
    start: [
      { source: 'noise', filterType: 'bandpass', frequency: 1450, q: 0.9, duration: 0.2, gain: 0.028, pan: -0.48, reverb: 0.25 },
      { frequency: 196, endFrequency: 392, duration: 0.09, type: 'sawtooth', gain: 0.04, pan: -0.28 },
      { frequency: 392, start: 0.075, duration: 0.1, type: 'triangle', gain: 0.044 },
      { frequency: 784, start: 0.16, duration: 0.15, type: 'sine', gain: 0.035, pan: 0.34, reverb: 0.3 },
    ],
    phaseDay: [
      ...CUE_PROFILES.phaseDay,
      { source: 'noise', filterType: 'highpass', frequency: 2900, duration: 0.05, gain: 0.018, pan: -0.4 },
      { frequency: 1040, start: 0.15, duration: 0.13, type: 'sine', gain: 0.03, pan: 0.38, reverb: 0.28 },
    ],
    phaseNight: [
      ...CUE_PROFILES.phaseNight,
      { source: 'noise', filterType: 'bandpass', frequency: 620, q: 1.2, duration: 0.22, gain: 0.026, pan: -0.42, reverb: 0.24 },
      { frequency: 82, start: 0.16, duration: 0.2, type: 'sine', gain: 0.032, pan: 0.34, reverb: 0.3 },
    ],
    elimination: [
      ...CUE_PROFILES.elimination,
      { source: 'noise', filterType: 'highpass', frequency: 2800, start: 0.035, duration: 0.1, gain: 0.025, pan: 0.38 },
      { frequency: 62, start: 0.13, duration: 0.22, type: 'sine', gain: 0.04, pan: 0.1, reverb: 0.24 },
    ],
    revive: [
      ...CUE_PROFILES.revive,
      { source: 'noise', filterType: 'highpass', frequency: 2400, duration: 0.09, gain: 0.02, pan: -0.4, reverb: 0.22 },
      { frequency: 1035, start: 0.17, duration: 0.16, type: 'sine', gain: 0.035, pan: 0.38, reverb: 0.34 },
    ],
    zoneLock: [
      ...CUE_PROFILES.zoneLock,
      { source: 'noise', filterType: 'bandpass', frequency: 920, q: 2.1, duration: 0.25, gain: 0.03, pan: -0.42, reverb: 0.22 },
      { frequency: 74, start: 0.18, duration: 0.22, type: 'sine', gain: 0.038, pan: 0.32, reverb: 0.28 },
    ],
    hyperloopJump: [
      ...CUE_PROFILES.hyperloopJump,
      { source: 'noise', filterType: 'bandpass', frequency: 980, q: 0.8, duration: 0.24, gain: 0.032, pan: -0.5, reverb: 0.32 },
      { frequency: 1760, start: 0.18, duration: 0.18, type: 'sine', gain: 0.029, pan: 0.46, reverb: 0.34 },
    ],
    kioskRevive: [
      ...CUE_PROFILES.kioskRevive,
      { source: 'noise', filterType: 'highpass', frequency: 2350, duration: 0.08, gain: 0.02, pan: -0.42 },
      { frequency: 1380, start: 0.22, duration: 0.18, type: 'sine', gain: 0.031, pan: 0.4, reverb: 0.34 },
    ],
    riftOpen: [
      ...CUE_PROFILES.riftOpen,
      { source: 'noise', filterType: 'bandpass', frequency: 1120, q: 0.7, duration: 0.36, gain: 0.034, pan: -0.54, reverb: 0.34 },
      { frequency: 1520, endFrequency: 380, start: 0.2, duration: 0.25, type: 'sine', gain: 0.027, pan: 0.48, reverb: 0.38 },
    ],
    riftBattle: [
      ...CUE_PROFILES.riftBattle,
      { source: 'noise', filterType: 'highpass', frequency: 3100, start: 0.04, duration: 0.16, gain: 0.028, pan: 0.46 },
      { frequency: 58, start: 0.16, duration: 0.28, type: 'sine', gain: 0.046, pan: 0.08, reverb: 0.26 },
    ],
    bossSpawn: [
      ...CUE_PROFILES.bossSpawn,
      { source: 'noise', filterType: 'bandpass', frequency: 740, q: 0.75, duration: 0.38, gain: 0.04, pan: -0.5, reverb: 0.32 },
      { frequency: 55, start: 0.19, duration: 0.34, type: 'sine', gain: 0.052, pan: 0.2, reverb: 0.3 },
    ],
    bossDefeat: [
      ...CUE_PROFILES.bossDefeat,
      { source: 'noise', filterType: 'highpass', frequency: 2900, duration: 0.13, gain: 0.026, pan: -0.46, reverb: 0.26 },
      { frequency: 1260, start: 0.24, duration: 0.2, type: 'sine', gain: 0.035, pan: 0.42, reverb: 0.36 },
    ],
    objectiveSpawn: [
      ...CUE_PROFILES.objectiveSpawn,
      { source: 'noise', filterType: 'highpass', frequency: 2500, duration: 0.08, gain: 0.02, pan: -0.4 },
      { frequency: 1365, start: 0.15, duration: 0.16, type: 'sine', gain: 0.033, pan: 0.4, reverb: 0.34 },
    ],
    rareSupply: [
      ...CUE_PROFILES.rareSupply,
      { source: 'noise', filterType: 'highpass', frequency: 2300, duration: 0.07, gain: 0.02, pan: -0.38 },
      { frequency: 1260, start: 0.18, duration: 0.15, type: 'sine', gain: 0.03, pan: 0.38, reverb: 0.3 },
    ],
    transcendSupply: [
      ...CUE_PROFILES.transcendSupply,
      { source: 'noise', filterType: 'highpass', frequency: 3100, duration: 0.1, gain: 0.024, pan: -0.44, reverb: 0.24 },
      { frequency: 1755, start: 0.2, duration: 0.2, type: 'sine', gain: 0.034, pan: 0.42, reverb: 0.38 },
    ],
    specialCraft: [
      ...CUE_PROFILES.specialCraft,
      { source: 'noise', filterType: 'bandpass', frequency: 1480, q: 1.4, duration: 0.18, gain: 0.026, pan: -0.44 },
      { frequency: 1720, start: 0.2, duration: 0.18, type: 'sine', gain: 0.031, pan: 0.42, reverb: 0.34 },
    ],
    suddenDeath: [
      ...CUE_PROFILES.suddenDeath,
      { source: 'noise', filterType: 'lowpass', frequency: 520, duration: 0.36, gain: 0.045, pan: -0.5, reverb: 0.28 },
      { frequency: 49, start: 0.2, duration: 0.38, type: 'sine', gain: 0.052, pan: 0.2, reverb: 0.34 },
    ],
    victory: [
      ...CUE_PROFILES.victory,
      { source: 'noise', filterType: 'highpass', frequency: 3200, duration: 0.2, gain: 0.03, pan: -0.5, reverb: 0.32 },
      { frequency: 1568, start: 0.28, duration: 0.24, type: 'sine', gain: 0.037, pan: 0.44, reverb: 0.4 },
    ],
    defeat: [
      ...CUE_PROFILES.defeat,
      { source: 'noise', filterType: 'lowpass', frequency: 540, duration: 0.26, gain: 0.038, pan: -0.44, reverb: 0.28 },
      { frequency: 73, start: 0.2, duration: 0.32, type: 'sine', gain: 0.042, pan: 0.28, reverb: 0.36 },
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
  'academy-duel': {
    accent: [{ frequency: 1680, duration: 0.045, type: 'sine', gain: 0.022, pan: 0.32, reverb: 0.22 }],
    click: [
      { source: 'noise', filterType: 'highpass', frequency: 2300, duration: 0.024, gain: 0.016, pan: -0.28 },
      { frequency: 760, endFrequency: 560, duration: 0.048, type: 'triangle', gain: 0.058, pan: 0.18 },
    ],
    tab: [
      { source: 'noise', filterType: 'highpass', frequency: 2600, duration: 0.026, gain: 0.018, pan: -0.36 },
      { frequency: 560, duration: 0.035, type: 'square', gain: 0.032, pan: -0.2 },
      { frequency: 840, start: 0.032, duration: 0.052, type: 'triangle', gain: 0.038 },
      { frequency: 1260, start: 0.082, duration: 0.09, type: 'sine', gain: 0.032, pan: 0.32, reverb: 0.24 },
    ],
    select: [
      { source: 'noise', filterType: 'bandpass', frequency: 1750, q: 1.9, duration: 0.026, gain: 0.018, pan: -0.28 },
      { frequency: 520, duration: 0.036, type: 'triangle', gain: 0.052, pan: -0.14 },
      { frequency: 1040, start: 0.03, duration: 0.062, type: 'sine', gain: 0.041, pan: 0.28, reverb: 0.18 },
    ],
    confirm: [
      { source: 'noise', filterType: 'highpass', frequency: 2200, duration: 0.036, gain: 0.021, pan: -0.32 },
      { frequency: 440, duration: 0.045, type: 'triangle', gain: 0.052, pan: -0.2 },
      { frequency: 880, start: 0.04, duration: 0.064, type: 'triangle', gain: 0.046 },
      { frequency: 1320, start: 0.098, duration: 0.105, type: 'sine', gain: 0.036, pan: 0.34, reverb: 0.26 },
    ],
    tcgStart: [
      { source: 'noise', filterType: 'bandpass', frequency: 1550, q: 0.9, duration: 0.2, gain: 0.03, pan: -0.5, reverb: 0.26 },
      { frequency: 330, duration: 0.055, type: 'triangle', gain: 0.046, pan: -0.32 },
      { frequency: 495, start: 0.05, duration: 0.07, type: 'triangle', gain: 0.046, pan: -0.08 },
      { frequency: 660, start: 0.115, duration: 0.09, type: 'triangle', gain: 0.043, pan: 0.18 },
      { frequency: 1320, start: 0.2, duration: 0.17, type: 'sine', gain: 0.036, pan: 0.38, reverb: 0.32 },
    ],
    tcgDraw: [
      { source: 'noise', filterType: 'bandpass', frequency: 1650, q: 0.72, duration: 0.11, gain: 0.034, pan: -0.42 },
      { frequency: 560, endFrequency: 820, start: 0.025, duration: 0.075, type: 'triangle', gain: 0.04, pan: 0.04 },
      { frequency: 1240, start: 0.105, duration: 0.105, type: 'sine', gain: 0.032, pan: 0.36, reverb: 0.24 },
    ],
    tcgSummon: [
      { source: 'noise', filterType: 'lowpass', frequency: 620, duration: 0.22, gain: 0.04, pan: -0.48, reverb: 0.24 },
      { source: 'noise', filterType: 'highpass', frequency: 2600, start: 0.08, duration: 0.15, gain: 0.024, pan: 0.46 },
      { frequency: 130, endFrequency: 520, duration: 0.18, type: 'sawtooth', gain: 0.044, pan: -0.24 },
      { frequency: 780, endFrequency: 1170, start: 0.12, duration: 0.16, type: 'triangle', gain: 0.042, pan: 0.12 },
      { frequency: 1760, start: 0.25, duration: 0.2, type: 'sine', gain: 0.034, pan: 0.4, reverb: 0.32 },
    ],
    tcgSet: [
      { source: 'noise', filterType: 'lowpass', frequency: 780, duration: 0.07, gain: 0.036, pan: -0.36 },
      { frequency: 420, endFrequency: 280, duration: 0.085, type: 'triangle', gain: 0.043, pan: -0.08 },
      { frequency: 840, start: 0.078, duration: 0.1, type: 'sine', gain: 0.03, pan: 0.3, reverb: 0.22 },
    ],
    tcgEffect: [
      { source: 'noise', filterType: 'highpass', frequency: 2400, duration: 0.09, gain: 0.024, pan: -0.42 },
      { frequency: 520, endFrequency: 1040, duration: 0.1, type: 'square', gain: 0.03, pan: -0.2 },
      { frequency: 780, endFrequency: 1320, start: 0.065, duration: 0.12, type: 'triangle', gain: 0.04, pan: 0.12 },
      { frequency: 1760, start: 0.16, duration: 0.15, type: 'sine', gain: 0.032, pan: 0.38, reverb: 0.3 },
    ],
    tcgChain: [
      { source: 'noise', filterType: 'bandpass', frequency: 2100, q: 0.8, duration: 0.22, gain: 0.032, pan: -0.5, reverb: 0.28 },
      { frequency: 520, endFrequency: 650, duration: 0.052, type: 'triangle', gain: 0.044, pan: -0.34 },
      { frequency: 780, endFrequency: 980, start: 0.047, duration: 0.064, type: 'triangle', gain: 0.042, pan: -0.08 },
      { frequency: 1170, endFrequency: 1470, start: 0.104, duration: 0.08, type: 'triangle', gain: 0.039, pan: 0.2 },
      { frequency: 1760, start: 0.18, duration: 0.16, type: 'sine', gain: 0.032, pan: 0.42, reverb: 0.32 },
    ],
    tcgAttack: [
      { source: 'noise', filterType: 'bandpass', frequency: 1180, q: 0.9, duration: 0.14, gain: 0.046, pan: -0.46, reverb: 0.16 },
      { frequency: 150, endFrequency: 88, duration: 0.14, type: 'sawtooth', gain: 0.046, pan: -0.28 },
      { frequency: 300, endFrequency: 760, duration: 0.1, type: 'square', gain: 0.038 },
      { frequency: 1040, start: 0.085, duration: 0.12, type: 'triangle', gain: 0.034, pan: 0.34, reverb: 0.18 },
    ],
    tcgHit: [
      { source: 'noise', filterType: 'lowpass', frequency: 720, duration: 0.12, gain: 0.074, pan: -0.4 },
      { frequency: 170, endFrequency: 82, duration: 0.15, type: 'square', gain: 0.046, pan: -0.18 },
      { source: 'noise', filterType: 'highpass', frequency: 2600, start: 0.05, duration: 0.08, gain: 0.026, pan: 0.28 },
      { frequency: 960, start: 0.1, duration: 0.1, type: 'sine', gain: 0.028, pan: 0.38, reverb: 0.22 },
    ],
    tcgDamage: [
      { source: 'noise', filterType: 'lowpass', frequency: 460, duration: 0.16, gain: 0.068, pan: -0.42, reverb: 0.2 },
      { frequency: 360, endFrequency: 190, duration: 0.11, type: 'square', gain: 0.044, pan: -0.2 },
      { frequency: 150, start: 0.08, duration: 0.16, type: 'sine', gain: 0.043 },
      { frequency: 740, endFrequency: 320, start: 0.13, duration: 0.14, type: 'triangle', gain: 0.03, pan: 0.34, reverb: 0.26 },
    ],
    tcgDestroy: [
      { source: 'noise', filterType: 'lowpass', frequency: 860, duration: 0.18, gain: 0.082, pan: -0.48, reverb: 0.18 },
      { source: 'noise', filterType: 'highpass', frequency: 3100, start: 0.035, duration: 0.12, gain: 0.032, pan: 0.42 },
      { frequency: 240, endFrequency: 74, duration: 0.18, type: 'sawtooth', gain: 0.046, pan: -0.22 },
      { frequency: 110, endFrequency: 56, start: 0.09, duration: 0.21, type: 'square', gain: 0.042 },
      { frequency: 880, start: 0.16, duration: 0.12, type: 'sine', gain: 0.026, pan: 0.36, reverb: 0.26 },
    ],
    tcgNegate: [
      { source: 'noise', filterType: 'bandpass', frequency: 920, q: 3, duration: 0.1, gain: 0.05, pan: -0.42 },
      { frequency: 1280, endFrequency: 360, duration: 0.1, type: 'square', gain: 0.038, pan: -0.22 },
      { frequency: 220, start: 0.085, duration: 0.14, type: 'sine', gain: 0.043 },
      { source: 'noise', filterType: 'highpass', frequency: 2900, start: 0.14, duration: 0.1, gain: 0.026, pan: 0.4, reverb: 0.24 },
    ],
    tcgDirectAttack: [
      { source: 'noise', filterType: 'bandpass', frequency: 1440, q: 0.9, duration: 0.17, gain: 0.054, pan: -0.5, reverb: 0.2 },
      { frequency: 340, endFrequency: 82, duration: 0.17, type: 'sawtooth', gain: 0.048, pan: -0.24 },
      { frequency: 680, endFrequency: 1240, start: 0.075, duration: 0.12, type: 'triangle', gain: 0.038, pan: 0.16 },
      { frequency: 1680, start: 0.18, duration: 0.16, type: 'sine', gain: 0.03, pan: 0.42, reverb: 0.3 },
    ],
    tcgPierce: [
      { source: 'noise', filterType: 'highpass', frequency: 2700, duration: 0.14, gain: 0.04, pan: -0.5, reverb: 0.22 },
      { frequency: 1720, endFrequency: 240, duration: 0.15, type: 'sawtooth', gain: 0.04, pan: -0.2 },
      { source: 'noise', filterType: 'bandpass', frequency: 760, q: 2.6, start: 0.08, duration: 0.12, gain: 0.046, pan: 0.16 },
      { frequency: 180, start: 0.12, duration: 0.17, type: 'sine', gain: 0.042, pan: 0.34, reverb: 0.25 },
    ],
    tcgClash: [
      { source: 'noise', filterType: 'bandpass', frequency: 1160, q: 2.2, duration: 0.09, gain: 0.072, pan: -0.42 },
      { frequency: 580, endFrequency: 330, duration: 0.1, type: 'square', gain: 0.043, pan: -0.16 },
      { source: 'noise', filterType: 'highpass', frequency: 2900, start: 0.05, duration: 0.09, gain: 0.026, pan: 0.32 },
      { frequency: 920, start: 0.11, duration: 0.12, type: 'sine', gain: 0.028, pan: 0.4, reverb: 0.24 },
    ],
    tcgShield: [
      { source: 'noise', filterType: 'bandpass', frequency: 680, q: 2.4, duration: 0.16, gain: 0.042, pan: -0.46, reverb: 0.28 },
      { frequency: 260, duration: 0.08, type: 'square', gain: 0.04, pan: -0.24 },
      { frequency: 520, start: 0.07, duration: 0.11, type: 'triangle', gain: 0.043 },
      { frequency: 1040, start: 0.17, duration: 0.17, type: 'sine', gain: 0.036, pan: 0.38, reverb: 0.34 },
    ],
    tcgShieldBreak: [
      { source: 'noise', filterType: 'highpass', frequency: 2100, duration: 0.13, gain: 0.054, pan: -0.48, reverb: 0.2 },
      { frequency: 980, endFrequency: 190, duration: 0.15, type: 'square', gain: 0.042, pan: -0.18 },
      { source: 'noise', filterType: 'bandpass', frequency: 580, q: 2, start: 0.1, duration: 0.12, gain: 0.045, pan: 0.18 },
      { frequency: 140, start: 0.16, duration: 0.16, type: 'sine', gain: 0.036, pan: 0.36, reverb: 0.28 },
    ],
    tcgBanish: [
      { source: 'noise', filterType: 'bandpass', frequency: 1450, q: 1.2, duration: 0.18, gain: 0.044, pan: -0.52, reverb: 0.32 },
      { frequency: 1040, endFrequency: 120, duration: 0.19, type: 'triangle', gain: 0.043, pan: -0.18 },
      { frequency: 1680, endFrequency: 420, start: 0.08, duration: 0.14, type: 'sine', gain: 0.03, pan: 0.2 },
      { source: 'noise', filterType: 'highpass', frequency: 2600, start: 0.18, duration: 0.12, gain: 0.022, pan: 0.44, reverb: 0.32 },
    ],
    tcgHeal: [
      { source: 'noise', filterType: 'highpass', frequency: 2200, duration: 0.08, gain: 0.02, pan: -0.42, reverb: 0.24 },
      { frequency: 440, duration: 0.05, type: 'sine', gain: 0.041, pan: -0.3 },
      { frequency: 660, start: 0.045, duration: 0.072, type: 'sine', gain: 0.043, pan: -0.06 },
      { frequency: 990, start: 0.11, duration: 0.13, type: 'sine', gain: 0.038, pan: 0.34, reverb: 0.32 },
    ],
    tcgCounter: [
      { source: 'noise', filterType: 'bandpass', frequency: 840, q: 3.4, duration: 0.13, gain: 0.052, pan: -0.48 },
      { frequency: 1480, endFrequency: 340, duration: 0.12, type: 'square', gain: 0.04, pan: -0.22 },
      { frequency: 210, start: 0.1, duration: 0.16, type: 'sine', gain: 0.043 },
      { source: 'noise', filterType: 'highpass', frequency: 3100, start: 0.16, duration: 0.12, gain: 0.027, pan: 0.42, reverb: 0.3 },
    ],
    tcgChainResolve: [
      { source: 'noise', filterType: 'highpass', frequency: 2300, duration: 0.045, gain: 0.021, pan: -0.4 },
      { frequency: 620, duration: 0.045, type: 'triangle', gain: 0.044, pan: -0.28 },
      { frequency: 930, start: 0.042, duration: 0.065, type: 'triangle', gain: 0.042 },
      { frequency: 1395, start: 0.104, duration: 0.13, type: 'sine', gain: 0.034, pan: 0.38, reverb: 0.32 },
    ],
    tcgDeckOut: [
      { source: 'noise', filterType: 'lowpass', frequency: 560, duration: 0.2, gain: 0.045, pan: -0.46, reverb: 0.24 },
      { frequency: 430, endFrequency: 180, duration: 0.16, type: 'triangle', gain: 0.048, pan: -0.2 },
      { frequency: 220, endFrequency: 110, start: 0.11, duration: 0.19, type: 'sine', gain: 0.043 },
      { frequency: 620, endFrequency: 280, start: 0.22, duration: 0.18, type: 'sine', gain: 0.029, pan: 0.36, reverb: 0.3 },
    ],
    tcgMikaCost: [
      { source: 'noise', filterType: 'lowpass', frequency: 520, duration: 0.11, gain: 0.042, pan: -0.4 },
      { frequency: 330, endFrequency: 170, duration: 0.11, type: 'triangle', gain: 0.044, pan: -0.2 },
      { frequency: 990, start: 0.095, duration: 0.12, type: 'sine', gain: 0.03, pan: 0.34, reverb: 0.26 },
    ],
    tcgMikaNegate: [
      { source: 'noise', filterType: 'bandpass', frequency: 980, q: 3.2, duration: 0.12, gain: 0.052, pan: -0.48 },
      { frequency: 1480, endFrequency: 420, duration: 0.11, type: 'square', gain: 0.04, pan: -0.22 },
      { frequency: 220, start: 0.095, duration: 0.15, type: 'sine', gain: 0.044 },
      { frequency: 1760, start: 0.19, duration: 0.18, type: 'sine', gain: 0.034, pan: 0.4, reverb: 0.34 },
    ],
    tcgMikaBurst: [
      { source: 'noise', filterType: 'highpass', frequency: 2500, duration: 0.2, gain: 0.034, pan: -0.5, reverb: 0.28 },
      { frequency: 205, endFrequency: 820, duration: 0.16, type: 'sawtooth', gain: 0.044, pan: -0.28 },
      { frequency: 820, endFrequency: 1640, start: 0.1, duration: 0.16, type: 'triangle', gain: 0.043 },
      { frequency: 2460, start: 0.24, duration: 0.21, type: 'sine', gain: 0.034, pan: 0.42, reverb: 0.36 },
    ],
    tcgHinaDiscipline: [
      { source: 'noise', filterType: 'bandpass', frequency: 1380, q: 1.7, duration: 0.075, gain: 0.068, pan: -0.44 },
      { frequency: 260, endFrequency: 92, duration: 0.14, type: 'sawtooth', gain: 0.048, pan: -0.2 },
      { source: 'noise', filterType: 'bandpass', frequency: 1220, q: 1.5, start: 0.11, duration: 0.07, gain: 0.06, pan: 0.18 },
      { frequency: 1040, start: 0.19, duration: 0.12, type: 'sine', gain: 0.03, pan: 0.38, reverb: 0.22 },
    ],
    tcgHinaRecover: [
      { frequency: 440, duration: 0.05, type: 'sine', gain: 0.04, pan: -0.34 },
      { frequency: 660, start: 0.045, duration: 0.07, type: 'sine', gain: 0.042, pan: -0.08 },
      { frequency: 880, start: 0.108, duration: 0.09, type: 'sine', gain: 0.039, pan: 0.18 },
      { frequency: 1320, start: 0.19, duration: 0.14, type: 'sine', gain: 0.032, pan: 0.38, reverb: 0.3 },
    ],
    tcgYuukaGuard: [
      { source: 'noise', filterType: 'bandpass', frequency: 620, q: 2.2, duration: 0.14, gain: 0.048, pan: -0.44, reverb: 0.24 },
      { frequency: 260, duration: 0.08, type: 'square', gain: 0.042, pan: -0.24 },
      { frequency: 520, start: 0.07, duration: 0.11, type: 'triangle', gain: 0.044 },
      { frequency: 1040, start: 0.17, duration: 0.15, type: 'sine', gain: 0.037, pan: 0.36, reverb: 0.3 },
    ],
    tcgYuukaSearch: [
      { source: 'noise', filterType: 'highpass', frequency: 2100, duration: 0.07, gain: 0.022, pan: -0.42 },
      { frequency: 680, endFrequency: 920, duration: 0.055, type: 'square', gain: 0.028, pan: -0.26 },
      { frequency: 920, endFrequency: 1240, start: 0.05, duration: 0.064, type: 'square', gain: 0.027 },
      { frequency: 1480, start: 0.115, duration: 0.12, type: 'sine', gain: 0.034, pan: 0.38, reverb: 0.28 },
    ],
    tcgPosition: [
      { frequency: 420, endFrequency: 680, duration: 0.06, type: 'triangle', gain: 0.042, pan: -0.32 },
      { frequency: 680, endFrequency: 420, start: 0.055, duration: 0.06, type: 'triangle', gain: 0.04, pan: 0.04 },
      { frequency: 1020, start: 0.11, duration: 0.09, type: 'sine', gain: 0.03, pan: 0.34, reverb: 0.22 },
    ],
    tcgPhase: [
      { source: 'noise', filterType: 'highpass', frequency: 2100, duration: 0.035, gain: 0.018, pan: -0.32 },
      { frequency: 520, endFrequency: 720, duration: 0.055, type: 'triangle', gain: 0.042 },
      { frequency: 1040, start: 0.052, duration: 0.09, type: 'sine', gain: 0.032, pan: 0.32, reverb: 0.22 },
    ],
    tcgTurn: [
      { source: 'noise', filterType: 'bandpass', frequency: 1450, duration: 0.055, gain: 0.024, pan: -0.4 },
      { frequency: 390, duration: 0.05, type: 'triangle', gain: 0.044, pan: -0.22 },
      { frequency: 585, start: 0.045, duration: 0.075, type: 'triangle', gain: 0.042 },
      { frequency: 1170, start: 0.115, duration: 0.12, type: 'sine', gain: 0.032, pan: 0.36, reverb: 0.26 },
    ],
    tcgPrompt: [
      { frequency: 740, duration: 0.045, type: 'sine', gain: 0.04, pan: -0.28 },
      { frequency: 1110, start: 0.042, duration: 0.08, type: 'sine', gain: 0.038, pan: 0.12 },
      { frequency: 1480, start: 0.12, duration: 0.12, type: 'sine', gain: 0.032, pan: 0.36, reverb: 0.28 },
    ],
    tcgInvalid: [
      { source: 'noise', filterType: 'lowpass', frequency: 520, duration: 0.08, gain: 0.04, pan: -0.34 },
      { frequency: 310, endFrequency: 190, duration: 0.09, type: 'square', gain: 0.043, pan: -0.12 },
      { frequency: 150, start: 0.075, duration: 0.14, type: 'sine', gain: 0.04, pan: 0.28, reverb: 0.2 },
    ],
    tcgDeckSave: [
      { source: 'noise', filterType: 'highpass', frequency: 2200, duration: 0.04, gain: 0.022, pan: -0.36 },
      { frequency: 520, duration: 0.045, type: 'triangle', gain: 0.045, pan: -0.14 },
      { frequency: 780, start: 0.04, duration: 0.064, type: 'triangle', gain: 0.043 },
      { frequency: 1170, start: 0.098, duration: 0.11, type: 'sine', gain: 0.034, pan: 0.36, reverb: 0.28 },
    ],
    tcgVictory: [
      { source: 'noise', filterType: 'highpass', frequency: 2600, duration: 0.2, gain: 0.034, pan: -0.52, reverb: 0.3 },
      { frequency: 520, duration: 0.05, type: 'triangle', gain: 0.052, pan: -0.34 },
      { frequency: 780, start: 0.045, duration: 0.07, type: 'triangle', gain: 0.05, pan: -0.08 },
      { frequency: 1040, start: 0.108, duration: 0.1, type: 'triangle', gain: 0.046, pan: 0.18 },
      { frequency: 1560, start: 0.2, duration: 0.22, type: 'sine', gain: 0.038, pan: 0.42, reverb: 0.36 },
    ],
    tcgDefeat: [
      { source: 'noise', filterType: 'lowpass', frequency: 620, duration: 0.18, gain: 0.04, pan: -0.44, reverb: 0.24 },
      { frequency: 430, endFrequency: 300, duration: 0.12, type: 'triangle', gain: 0.052, pan: -0.24 },
      { frequency: 250, endFrequency: 150, start: 0.09, duration: 0.17, type: 'sine', gain: 0.046 },
      { frequency: 620, endFrequency: 360, start: 0.2, duration: 0.18, type: 'sine', gain: 0.03, pan: 0.34, reverb: 0.3 },
    ],
  },
  vanguard: {
    accent: [{ frequency: 1560, duration: 0.038, type: 'sine', gain: 0.022, pan: 0.28, reverb: 0.18 }],
    click: [
      { source: 'noise', filterType: 'highpass', frequency: 2200, duration: 0.022, gain: 0.016, pan: -0.2 },
      { frequency: 720, endFrequency: 540, duration: 0.045, type: 'triangle', gain: 0.06, pan: 0.16 },
    ],
    tab: [
      { source: 'noise', filterType: 'highpass', frequency: 2500, duration: 0.026, gain: 0.018, pan: -0.32 },
      { frequency: 520, duration: 0.035, type: 'square', gain: 0.034, pan: -0.2 },
      { frequency: 780, start: 0.032, duration: 0.052, type: 'triangle', gain: 0.038 },
      { frequency: 1170, start: 0.08, duration: 0.082, type: 'sine', gain: 0.032, pan: 0.28, reverb: 0.2 },
    ],
    select: [
      { source: 'noise', filterType: 'bandpass', frequency: 1700, q: 1.8, duration: 0.026, gain: 0.018, pan: -0.24 },
      { frequency: 520, duration: 0.036, type: 'triangle', gain: 0.052, pan: -0.12 },
      { frequency: 1040, start: 0.03, duration: 0.058, type: 'sine', gain: 0.04, pan: 0.24 },
    ],
    confirm: [
      { source: 'noise', filterType: 'highpass', frequency: 2100, duration: 0.035, gain: 0.02, pan: -0.28 },
      { frequency: 440, duration: 0.045, type: 'triangle', gain: 0.052, pan: -0.18 },
      { frequency: 880, start: 0.04, duration: 0.062, type: 'triangle', gain: 0.046 },
      { frequency: 1320, start: 0.095, duration: 0.1, type: 'sine', gain: 0.036, pan: 0.28, reverb: 0.22 },
    ],
    vanguardStart: [
      { source: 'noise', filterType: 'bandpass', frequency: 1500, q: 0.8, duration: 0.18, gain: 0.028, pan: -0.46, reverb: 0.24 },
      { frequency: 330, duration: 0.055, type: 'triangle', gain: 0.046, pan: -0.3 },
      { frequency: 495, start: 0.05, duration: 0.07, type: 'triangle', gain: 0.046, pan: -0.06 },
      { frequency: 660, start: 0.115, duration: 0.09, type: 'triangle', gain: 0.043, pan: 0.18 },
      { frequency: 990, start: 0.19, duration: 0.15, type: 'sine', gain: 0.036, pan: 0.36, reverb: 0.28 },
    ],
    vanguardRide: [
      { source: 'noise', filterType: 'highpass', frequency: 1800, duration: 0.08, gain: 0.026, pan: -0.42 },
      { frequency: 220, endFrequency: 660, duration: 0.12, type: 'sawtooth', gain: 0.04, pan: -0.26 },
      { frequency: 440, endFrequency: 880, start: 0.045, duration: 0.12, type: 'triangle', gain: 0.042 },
      { frequency: 1320, start: 0.14, duration: 0.13, type: 'sine', gain: 0.036, pan: 0.34, reverb: 0.25 },
    ],
    vanguardRideAssist: [
      { source: 'noise', filterType: 'highpass', frequency: 2100, duration: 0.13, gain: 0.026, pan: -0.46, reverb: 0.22 },
      { frequency: 196, endFrequency: 392, duration: 0.09, type: 'triangle', gain: 0.043, pan: -0.3 },
      { frequency: 392, start: 0.055, duration: 0.07, type: 'triangle', gain: 0.046, pan: -0.08 },
      { frequency: 587, start: 0.12, duration: 0.085, type: 'triangle', gain: 0.044, pan: 0.18 },
      { frequency: 1175, start: 0.2, duration: 0.16, type: 'sine', gain: 0.035, pan: 0.38, reverb: 0.3 },
    ],
    vanguardStride: [
      { source: 'noise', filterType: 'bandpass', frequency: 820, q: 1.1, duration: 0.24, gain: 0.04, pan: -0.5, reverb: 0.25 },
      { source: 'noise', filterType: 'highpass', frequency: 2600, start: 0.08, duration: 0.16, gain: 0.026, pan: 0.46 },
      { frequency: 110, endFrequency: 440, duration: 0.2, type: 'sawtooth', gain: 0.044, pan: -0.24 },
      { frequency: 660, endFrequency: 1100, start: 0.12, duration: 0.15, type: 'triangle', gain: 0.043, pan: 0.12 },
      { frequency: 1760, start: 0.25, duration: 0.2, type: 'sine', gain: 0.034, pan: 0.38, reverb: 0.3 },
    ],
    vanguardAttack: [
      { source: 'noise', filterType: 'bandpass', frequency: 1150, q: 0.85, duration: 0.14, gain: 0.042, pan: -0.44, reverb: 0.16 },
      { frequency: 150, endFrequency: 90, duration: 0.13, type: 'sawtooth', gain: 0.044, pan: -0.26 },
      { frequency: 300, endFrequency: 720, duration: 0.09, type: 'square', gain: 0.038 },
      { frequency: 960, start: 0.08, duration: 0.11, type: 'triangle', gain: 0.034, pan: 0.3 },
    ],
    vanguardGuardWindow: [
      { source: 'noise', filterType: 'lowpass', frequency: 760, duration: 0.16, gain: 0.036, pan: -0.42, reverb: 0.22 },
      { frequency: 196, duration: 0.08, type: 'square', gain: 0.042, pan: -0.25 },
      { frequency: 294, start: 0.075, duration: 0.1, type: 'triangle', gain: 0.044 },
      { frequency: 588, start: 0.16, duration: 0.13, type: 'sine', gain: 0.036, pan: 0.3, reverb: 0.26 },
    ],
    vanguardPerfectGuard: [
      { source: 'noise', filterType: 'highpass', frequency: 2800, duration: 0.1, gain: 0.03, pan: -0.45, reverb: 0.24 },
      { frequency: 520, duration: 0.045, type: 'triangle', gain: 0.048, pan: -0.26 },
      { frequency: 780, start: 0.04, duration: 0.062, type: 'triangle', gain: 0.048 },
      { frequency: 1040, start: 0.095, duration: 0.085, type: 'triangle', gain: 0.045, pan: 0.2 },
      { frequency: 1560, start: 0.18, duration: 0.18, type: 'sine', gain: 0.037, pan: 0.36, reverb: 0.3 },
    ],
    vanguardTrigger: [
      { source: 'noise', filterType: 'bandpass', frequency: 2100, q: 0.7, duration: 0.24, gain: 0.034, pan: -0.52, reverb: 0.28 },
      { source: 'noise', filterType: 'highpass', frequency: 3200, start: 0.04, duration: 0.22, gain: 0.026, pan: 0.52, reverb: 0.28 },
      { frequency: 440, endFrequency: 880, duration: 0.08, type: 'triangle', gain: 0.046, pan: -0.3 },
      { frequency: 880, start: 0.075, duration: 0.09, type: 'triangle', gain: 0.046 },
      { frequency: 1320, start: 0.155, duration: 0.11, type: 'triangle', gain: 0.043, pan: 0.22 },
      { frequency: 1760, start: 0.255, duration: 0.19, type: 'sine', gain: 0.036, pan: 0.38, reverb: 0.32 },
    ],
    vanguardTriggerCritical: [
      { source: 'noise', filterType: 'bandpass', frequency: 980, q: 0.9, duration: 0.16, gain: 0.044, pan: -0.5, reverb: 0.2 },
      { frequency: 98, endFrequency: 196, duration: 0.14, type: 'sawtooth', gain: 0.046, pan: -0.3 },
      { frequency: 392, endFrequency: 784, start: 0.055, duration: 0.11, type: 'square', gain: 0.04 },
      { frequency: 1176, start: 0.155, duration: 0.14, type: 'triangle', gain: 0.039, pan: 0.28 },
      { frequency: 1568, start: 0.275, duration: 0.17, type: 'sine', gain: 0.034, pan: 0.42, reverb: 0.28 },
    ],
    vanguardTriggerDraw: [
      { source: 'noise', filterType: 'highpass', frequency: 2600, duration: 0.18, gain: 0.028, pan: -0.48, reverb: 0.24 },
      { frequency: 523, duration: 0.05, type: 'triangle', gain: 0.044, pan: -0.28 },
      { frequency: 659, start: 0.045, duration: 0.07, type: 'triangle', gain: 0.045 },
      { frequency: 784, start: 0.11, duration: 0.08, type: 'triangle', gain: 0.043, pan: 0.2 },
      { frequency: 1568, start: 0.18, duration: 0.18, type: 'sine', gain: 0.034, pan: 0.4, reverb: 0.3 },
    ],
    vanguardTriggerStand: [
      { source: 'noise', filterType: 'bandpass', frequency: 1800, q: 0.8, duration: 0.18, gain: 0.03, pan: -0.46, reverb: 0.22 },
      { frequency: 174, duration: 0.055, type: 'square', gain: 0.04, pan: -0.3 },
      { frequency: 349, start: 0.05, duration: 0.065, type: 'triangle', gain: 0.045, pan: -0.08 },
      { frequency: 698, start: 0.11, duration: 0.085, type: 'triangle', gain: 0.045, pan: 0.2 },
      { frequency: 1396, start: 0.19, duration: 0.18, type: 'sine', gain: 0.035, pan: 0.4, reverb: 0.3 },
    ],
    vanguardTriggerHeal: [
      { source: 'noise', filterType: 'highpass', frequency: 3000, duration: 0.22, gain: 0.025, pan: -0.5, reverb: 0.3 },
      { frequency: 330, duration: 0.065, type: 'sine', gain: 0.041, pan: -0.3 },
      { frequency: 495, start: 0.06, duration: 0.085, type: 'sine', gain: 0.044, pan: -0.06 },
      { frequency: 660, start: 0.14, duration: 0.1, type: 'sine', gain: 0.043, pan: 0.2 },
      { frequency: 1320, start: 0.23, duration: 0.22, type: 'sine', gain: 0.035, pan: 0.4, reverb: 0.34 },
    ],
    vanguardHit: [
      { source: 'noise', filterType: 'bandpass', frequency: 720, q: 0.9, duration: 0.13, gain: 0.05, pan: -0.4, reverb: 0.16 },
      { frequency: 130, endFrequency: 78, duration: 0.16, type: 'sawtooth', gain: 0.046, pan: -0.24 },
      { frequency: 260, endFrequency: 620, duration: 0.09, type: 'square', gain: 0.04 },
      { frequency: 930, start: 0.09, duration: 0.12, type: 'triangle', gain: 0.034, pan: 0.3 },
    ],
    vanguardDamage: [
      { source: 'noise', filterType: 'lowpass', frequency: 520, duration: 0.17, gain: 0.052, pan: -0.38, reverb: 0.2 },
      { frequency: 220, endFrequency: 120, duration: 0.16, type: 'sawtooth', gain: 0.046, pan: -0.2 },
      { frequency: 110, start: 0.11, duration: 0.18, type: 'sine', gain: 0.04, pan: 0.22, reverb: 0.24 },
    ],
    vanguardVictory: [
      { source: 'noise', filterType: 'bandpass', frequency: 1750, q: 0.62, duration: 0.42, gain: 0.04, pan: -0.56, reverb: 0.32 },
      { source: 'noise', filterType: 'bandpass', frequency: 2500, q: 0.72, start: 0.04, duration: 0.44, gain: 0.036, pan: 0.56, reverb: 0.32 },
      { frequency: 392, duration: 0.055, type: 'triangle', gain: 0.05, pan: -0.32 },
      { frequency: 588, start: 0.05, duration: 0.07, type: 'triangle', gain: 0.05, pan: -0.1 },
      { frequency: 784, start: 0.115, duration: 0.09, type: 'triangle', gain: 0.048, pan: 0.16 },
      { frequency: 1176, start: 0.2, duration: 0.14, type: 'triangle', gain: 0.044, pan: 0.3 },
      { frequency: 1568, start: 0.33, duration: 0.26, type: 'sine', gain: 0.038, pan: 0.42, reverb: 0.34 },
    ],
    vanguardDefeat: [
      { source: 'noise', filterType: 'lowpass', frequency: 560, duration: 0.2, gain: 0.036, pan: -0.4, reverb: 0.24 },
      { frequency: 440, endFrequency: 330, duration: 0.12, type: 'triangle', gain: 0.044, pan: -0.22 },
      { frequency: 260, endFrequency: 165, start: 0.1, duration: 0.16, type: 'triangle', gain: 0.043 },
      { frequency: 110, start: 0.23, duration: 0.23, type: 'sine', gain: 0.038, pan: 0.26, reverb: 0.28 },
    ],
    vanguardDeckOut: [
      { source: 'noise', filterType: 'highpass', frequency: 1700, duration: 0.1, gain: 0.03, pan: -0.4 },
      { frequency: 420, endFrequency: 210, start: 0.04, duration: 0.16, type: 'sawtooth', gain: 0.04, pan: -0.2 },
      { frequency: 210, endFrequency: 105, start: 0.17, duration: 0.18, type: 'triangle', gain: 0.04 },
      { frequency: 84, start: 0.3, duration: 0.2, type: 'sine', gain: 0.038, pan: 0.24, reverb: 0.26 },
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
  civilization: {
    accent: [
      { source: 'noise', filterType: 'bandpass', frequency: 1100, q: 0.7, duration: 0.08, gain: 0.009, pan: -0.24, reverb: 0.18 },
      { frequency: 196, endFrequency: 220, duration: 0.08, type: 'triangle', gain: 0.018, pan: 0.18, reverb: 0.16 },
    ],
    click: [
      { source: 'noise', filterType: 'highpass', frequency: 1800, duration: 0.025, gain: 0.012, pan: -0.2 },
      { frequency: 220, endFrequency: 196, duration: 0.05, type: 'triangle', gain: 0.042, pan: 0.12 },
    ],
    confirm: [
      { frequency: 262, duration: 0.055, type: 'triangle', gain: 0.042, pan: -0.28 },
      { frequency: 392, start: 0.05, duration: 0.075, type: 'triangle', gain: 0.038 },
      { frequency: 523, start: 0.12, duration: 0.13, type: 'sine', gain: 0.03, pan: 0.3, reverb: 0.26 },
    ],
    gather: [
      { source: 'noise', filterType: 'bandpass', frequency: 720, q: 0.8, duration: 0.16, gain: 0.026, pan: -0.42, reverb: 0.12 },
      { frequency: 196, endFrequency: 164, duration: 0.09, type: 'triangle', gain: 0.04, pan: -0.18 },
      { frequency: 330, start: 0.08, duration: 0.11, type: 'sine', gain: 0.026, pan: 0.28, reverb: 0.2 },
    ],
    combat: [
      { source: 'noise', filterType: 'lowpass', frequency: 680, duration: 0.12, gain: 0.038, pan: -0.34, reverb: 0.12 },
      { frequency: 110, endFrequency: 78, duration: 0.14, type: 'sine', gain: 0.05, pan: -0.16 },
      { frequency: 247, endFrequency: 165, start: 0.07, duration: 0.12, type: 'sawtooth', gain: 0.032, pan: 0.22 },
    ],
    craft: [
      { source: 'noise', filterType: 'bandpass', frequency: 1500, q: 1.1, duration: 0.045, gain: 0.022, pan: -0.34 },
      { frequency: 440, endFrequency: 330, duration: 0.075, type: 'triangle', gain: 0.04, pan: -0.18 },
      { frequency: 220, start: 0.07, duration: 0.11, type: 'sine', gain: 0.032, pan: 0.24, reverb: 0.16 },
    ],
    farm: [
      { source: 'noise', filterType: 'lowpass', frequency: 900, duration: 0.18, gain: 0.018, pan: -0.42, reverb: 0.18 },
      { frequency: 262, duration: 0.06, type: 'triangle', gain: 0.038, pan: -0.26 },
      { frequency: 330, start: 0.055, duration: 0.07, type: 'triangle', gain: 0.036 },
      { frequency: 392, start: 0.12, duration: 0.12, type: 'sine', gain: 0.028, pan: 0.3, reverb: 0.24 },
    ],
    herd: [
      { frequency: 523, duration: 0.08, type: 'sine', gain: 0.034, pan: -0.34, reverb: 0.28 },
      { frequency: 784, start: 0.06, duration: 0.11, type: 'sine', gain: 0.032, pan: 0.04, reverb: 0.3 },
      { frequency: 1046, start: 0.14, duration: 0.16, type: 'sine', gain: 0.024, pan: 0.36, reverb: 0.34 },
    ],
    fish: [
      { source: 'noise', filterType: 'highpass', frequency: 1700, duration: 0.2, gain: 0.018, pan: -0.48, reverb: 0.26 },
      { frequency: 780, endFrequency: 1180, duration: 0.09, type: 'sine', gain: 0.034, pan: -0.18 },
      { frequency: 1320, endFrequency: 980, start: 0.1, duration: 0.13, type: 'sine', gain: 0.027, pan: 0.32, reverb: 0.32 },
    ],
    mine: [
      { source: 'noise', filterType: 'bandpass', frequency: 1250, q: 1.4, duration: 0.06, gain: 0.026, pan: -0.36, reverb: 0.14 },
      { frequency: 180, endFrequency: 120, duration: 0.1, type: 'triangle', gain: 0.045, pan: -0.16 },
      { frequency: 520, endFrequency: 390, start: 0.045, duration: 0.12, type: 'square', gain: 0.026, pan: 0.28, reverb: 0.22 },
    ],
    consume: [
      { frequency: 294, endFrequency: 262, duration: 0.075, type: 'triangle', gain: 0.034, pan: -0.2 },
      { frequency: 440, start: 0.065, duration: 0.1, type: 'sine', gain: 0.026, pan: 0.22, reverb: 0.18 },
    ],
    rest: [
      { source: 'noise', filterType: 'lowpass', frequency: 480, duration: 0.24, gain: 0.015, pan: -0.34, reverb: 0.24 },
      { frequency: 196, endFrequency: 146, duration: 0.2, type: 'sine', gain: 0.032, pan: -0.16 },
      { frequency: 294, start: 0.12, duration: 0.2, type: 'sine', gain: 0.022, pan: 0.28, reverb: 0.3 },
    ],
    research: [
      { frequency: 330, duration: 0.055, type: 'triangle', gain: 0.038, pan: -0.34 },
      { frequency: 494, start: 0.05, duration: 0.07, type: 'triangle', gain: 0.037, pan: -0.12 },
      { frequency: 659, start: 0.115, duration: 0.09, type: 'triangle', gain: 0.034, pan: 0.14 },
      { frequency: 988, start: 0.2, duration: 0.18, type: 'sine', gain: 0.026, pan: 0.38, reverb: 0.34 },
    ],
    policy: [
      { frequency: 196, duration: 0.12, type: 'triangle', gain: 0.035, pan: -0.34 },
      { frequency: 294, start: 0.04, duration: 0.16, type: 'sine', gain: 0.03 },
      { frequency: 392, start: 0.09, duration: 0.2, type: 'sine', gain: 0.026, pan: 0.34, reverb: 0.3 },
    ],
    camp: [
      { source: 'noise', filterType: 'lowpass', frequency: 520, duration: 0.25, gain: 0.023, pan: -0.46, reverb: 0.2 },
      { frequency: 110, endFrequency: 98, duration: 0.2, type: 'sine', gain: 0.035, pan: -0.16 },
      { frequency: 220, start: 0.1, duration: 0.2, type: 'triangle', gain: 0.026, pan: 0.28, reverb: 0.26 },
    ],
    project: [
      { source: 'noise', filterType: 'bandpass', frequency: 960, q: 1.1, duration: 0.045, gain: 0.022, pan: -0.4 },
      { frequency: 260, duration: 0.055, type: 'triangle', gain: 0.04, pan: -0.28 },
      { frequency: 330, start: 0.07, duration: 0.06, type: 'triangle', gain: 0.038 },
      { frequency: 392, start: 0.145, duration: 0.11, type: 'sine', gain: 0.028, pan: 0.32, reverb: 0.24 },
    ],
    auto: [
      { frequency: 262, duration: 0.05, type: 'triangle', gain: 0.035, pan: -0.4 },
      { frequency: 330, start: 0.045, duration: 0.06, type: 'triangle', gain: 0.034, pan: -0.16 },
      { frequency: 392, start: 0.1, duration: 0.075, type: 'triangle', gain: 0.032, pan: 0.12 },
      { frequency: 523, start: 0.17, duration: 0.14, type: 'sine', gain: 0.026, pan: 0.38, reverb: 0.3 },
    ],
    assign: [
      { frequency: 392, duration: 0.055, type: 'triangle', gain: 0.038, pan: -0.24 },
      { frequency: 523, start: 0.05, duration: 0.09, type: 'sine', gain: 0.03, pan: 0.26, reverb: 0.22 },
    ],
    diplomacy: [
      { frequency: 174, duration: 0.13, type: 'triangle', gain: 0.032, pan: -0.38 },
      { frequency: 261, start: 0.035, duration: 0.15, type: 'sine', gain: 0.028, pan: -0.12 },
      { frequency: 349, start: 0.085, duration: 0.18, type: 'sine', gain: 0.026, pan: 0.14 },
      { frequency: 523, start: 0.16, duration: 0.2, type: 'sine', gain: 0.022, pan: 0.38, reverb: 0.34 },
    ],
    start: [
      { frequency: 196, duration: 0.07, type: 'triangle', gain: 0.04, pan: -0.36 },
      { frequency: 294, start: 0.065, duration: 0.085, type: 'triangle', gain: 0.038, pan: -0.12 },
      { frequency: 392, start: 0.145, duration: 0.11, type: 'triangle', gain: 0.034, pan: 0.14 },
      { frequency: 588, start: 0.245, duration: 0.2, type: 'sine', gain: 0.028, pan: 0.38, reverb: 0.36 },
    ],
    survivalFail: [
      { source: 'noise', filterType: 'lowpass', frequency: 560, duration: 0.18, gain: 0.026, pan: -0.36, reverb: 0.18 },
      { frequency: 196, endFrequency: 130, duration: 0.18, type: 'triangle', gain: 0.038, pan: -0.16 },
      { frequency: 98, start: 0.13, duration: 0.22, type: 'sine', gain: 0.032, pan: 0.26, reverb: 0.28 },
    ],
  },
  kitchen: {
    accent: [{ frequency: 1080, duration: 0.04, type: 'sine', gain: 0.024 }],
    click: [{ frequency: 760, endFrequency: 920, duration: 0.045, type: 'sine', gain: 0.07 }],
    confirm: [
      { frequency: 840, duration: 0.04, type: 'triangle', gain: 0.06 },
      { frequency: 1260, start: 0.035, duration: 0.06, type: 'sine', gain: 0.045 },
    ],
    businessMode: [
      { source: 'noise', filterType: 'highpass', frequency: 2600, duration: 0.055, gain: 0.025, pan: -0.42, reverb: 0.18 },
      { frequency: 330, endFrequency: 494, duration: 0.07, type: 'triangle', gain: 0.045, pan: -0.26 },
      { frequency: 659, start: 0.065, duration: 0.09, type: 'triangle', gain: 0.045, pan: 0.1 },
      { frequency: 988, start: 0.145, duration: 0.14, type: 'sine', gain: 0.036, pan: 0.34, reverb: 0.28 },
    ],
  },
  idle: {
    accent: [{ frequency: 880, duration: 0.065, type: 'sine', gain: 0.022 }],
    click: [{ frequency: 590, endFrequency: 830, duration: 0.07, type: 'sine', gain: 0.06 }],
    confirm: [
      { frequency: 740, duration: 0.05, type: 'sine', gain: 0.055 },
      { frequency: 1180, start: 0.04, duration: 0.075, type: 'sine', gain: 0.04 },
    ],
    settle: [
      { source: 'noise', filterType: 'highpass', frequency: 2600, duration: 0.035, gain: 0.014, pan: -0.34, reverb: 0.24 },
      { frequency: 659, duration: 0.05, type: 'triangle', gain: 0.038, pan: -0.24 },
      { frequency: 988, start: 0.045, duration: 0.07, type: 'sine', gain: 0.036, pan: 0.04 },
      { frequency: 1318, start: 0.105, duration: 0.12, type: 'sine', gain: 0.028, pan: 0.34, reverb: 0.36 },
    ],
    dutyComplete: [
      { source: 'noise', filterType: 'highpass', frequency: 3000, duration: 0.055, gain: 0.018, pan: -0.42, reverb: 0.28 },
      { frequency: 523, duration: 0.055, type: 'triangle', gain: 0.043, pan: -0.3 },
      { frequency: 659, start: 0.05, duration: 0.065, type: 'triangle', gain: 0.043, pan: -0.08 },
      { frequency: 784, start: 0.105, duration: 0.08, type: 'triangle', gain: 0.04, pan: 0.16 },
      { frequency: 1047, start: 0.175, duration: 0.16, type: 'sine', gain: 0.032, pan: 0.38, reverb: 0.4 },
    ],
    dutyPartial: [
      { source: 'noise', filterType: 'bandpass', frequency: 1500, q: 1.2, duration: 0.08, gain: 0.018, pan: -0.36, reverb: 0.22 },
      { frequency: 392, duration: 0.05, type: 'triangle', gain: 0.042, pan: -0.22 },
      { frequency: 523, start: 0.05, duration: 0.07, type: 'triangle', gain: 0.04, pan: 0.08 },
      { frequency: 392, endFrequency: 294, start: 0.12, duration: 0.13, type: 'sine', gain: 0.034, pan: 0.32, reverb: 0.3 },
    ],
    dutyDefeat: [
      { source: 'noise', filterType: 'lowpass', frequency: 520, duration: 0.16, gain: 0.036, pan: -0.38, reverb: 0.2 },
      { frequency: 247, endFrequency: 165, duration: 0.12, type: 'triangle', gain: 0.046, pan: -0.18 },
      { frequency: 123, endFrequency: 82, start: 0.1, duration: 0.2, type: 'sine', gain: 0.04, pan: 0.3, reverb: 0.28 },
    ],
    towerClear: [
      { source: 'noise', filterType: 'highpass', frequency: 3200, duration: 0.075, gain: 0.021, pan: -0.44, reverb: 0.3 },
      { frequency: 330, duration: 0.05, type: 'triangle', gain: 0.046, pan: -0.3 },
      { frequency: 494, start: 0.045, duration: 0.065, type: 'triangle', gain: 0.045, pan: -0.08 },
      { frequency: 659, start: 0.1, duration: 0.08, type: 'triangle', gain: 0.043, pan: 0.16 },
      { frequency: 988, start: 0.17, duration: 0.18, type: 'sine', gain: 0.034, pan: 0.4, reverb: 0.42 },
    ],
    towerPartial: [
      { source: 'noise', filterType: 'bandpass', frequency: 1700, q: 1.1, duration: 0.075, gain: 0.018, pan: -0.4, reverb: 0.22 },
      { frequency: 294, duration: 0.045, type: 'triangle', gain: 0.044, pan: -0.28 },
      { frequency: 440, start: 0.045, duration: 0.06, type: 'triangle', gain: 0.042, pan: 0 },
      { frequency: 587, start: 0.1, duration: 0.07, type: 'triangle', gain: 0.038, pan: 0.24 },
      { frequency: 440, endFrequency: 330, start: 0.165, duration: 0.13, type: 'sine', gain: 0.032, pan: 0.38, reverb: 0.3 },
    ],
    towerFail: [
      { source: 'noise', filterType: 'lowpass', frequency: 460, duration: 0.14, gain: 0.034, pan: -0.38, reverb: 0.18 },
      { frequency: 220, endFrequency: 147, duration: 0.12, type: 'triangle', gain: 0.047, pan: -0.16 },
      { frequency: 110, endFrequency: 73, start: 0.1, duration: 0.2, type: 'sine', gain: 0.041, pan: 0.3, reverb: 0.26 },
    ],
    craftComplete: [
      { source: 'noise', filterType: 'bandpass', frequency: 1750, q: 1.8, duration: 0.045, gain: 0.024, pan: -0.38, reverb: 0.2 },
      { frequency: 494, duration: 0.045, type: 'triangle', gain: 0.042, pan: -0.22 },
      { frequency: 740, start: 0.045, duration: 0.065, type: 'triangle', gain: 0.041, pan: 0.08 },
      { frequency: 1110, start: 0.105, duration: 0.12, type: 'sine', gain: 0.032, pan: 0.34, reverb: 0.32 },
    ],
    enhanceSuccess: [
      { source: 'noise', filterType: 'highpass', frequency: 2900, duration: 0.055, gain: 0.02, pan: -0.42, reverb: 0.27 },
      { frequency: 659, duration: 0.04, type: 'triangle', gain: 0.043, pan: -0.24 },
      { frequency: 988, start: 0.04, duration: 0.07, type: 'triangle', gain: 0.041, pan: 0.08 },
      { frequency: 1318, start: 0.105, duration: 0.14, type: 'sine', gain: 0.032, pan: 0.36, reverb: 0.38 },
    ],
    enhancePity: [
      { source: 'noise', filterType: 'highpass', frequency: 3400, duration: 0.12, gain: 0.024, pan: -0.46, reverb: 0.34 },
      { frequency: 523, duration: 0.05, type: 'triangle', gain: 0.045, pan: -0.32 },
      { frequency: 784, start: 0.05, duration: 0.065, type: 'triangle', gain: 0.044, pan: -0.08 },
      { frequency: 1047, start: 0.11, duration: 0.085, type: 'triangle', gain: 0.041, pan: 0.18 },
      { frequency: 1568, start: 0.185, duration: 0.22, type: 'sine', gain: 0.033, pan: 0.42, reverb: 0.48 },
    ],
    enhanceProtected: [
      { source: 'noise', filterType: 'bandpass', frequency: 980, q: 2.1, duration: 0.08, gain: 0.026, pan: -0.4, reverb: 0.24 },
      { frequency: 330, endFrequency: 294, duration: 0.06, type: 'square', gain: 0.032, pan: -0.22 },
      { frequency: 659, start: 0.06, duration: 0.08, type: 'triangle', gain: 0.041, pan: 0.08 },
      { frequency: 1047, start: 0.13, duration: 0.13, type: 'sine', gain: 0.032, pan: 0.36, reverb: 0.34 },
    ],
    enhanceDowngrade: [
      { source: 'noise', filterType: 'lowpass', frequency: 720, duration: 0.1, gain: 0.032, pan: -0.38, reverb: 0.18 },
      { frequency: 494, endFrequency: 330, duration: 0.09, type: 'triangle', gain: 0.044, pan: -0.18 },
      { frequency: 220, endFrequency: 147, start: 0.075, duration: 0.15, type: 'sine', gain: 0.039, pan: 0.3, reverb: 0.25 },
    ],
    enhanceDestroyed: [
      { source: 'noise', filterType: 'lowpass', frequency: 390, duration: 0.22, gain: 0.052, pan: -0.42, reverb: 0.2 },
      { frequency: 130, endFrequency: 60, duration: 0.19, type: 'sawtooth', gain: 0.052, pan: -0.2 },
      { frequency: 65, endFrequency: 42, start: 0.1, duration: 0.28, type: 'sine', gain: 0.044, pan: 0.32, reverb: 0.28 },
    ],
    reward: [
      { source: 'noise', filterType: 'highpass', frequency: 3600, duration: 0.09, gain: 0.02, pan: -0.44, reverb: 0.32 },
      { frequency: 880, duration: 0.04, type: 'triangle', gain: 0.041, pan: -0.3 },
      { frequency: 1175, start: 0.04, duration: 0.055, type: 'triangle', gain: 0.041, pan: -0.04 },
      { frequency: 1568, start: 0.09, duration: 0.075, type: 'triangle', gain: 0.038, pan: 0.2 },
      { frequency: 2093, start: 0.155, duration: 0.18, type: 'sine', gain: 0.03, pan: 0.42, reverb: 0.46 },
    ],
  },
  tactical: {
    accent: [{ frequency: 300, duration: 0.04, type: 'square', gain: 0.02 }],
    click: [{ frequency: 480, endFrequency: 360, duration: 0.042, type: 'square', gain: 0.045 }],
    select: [{ frequency: 520, endFrequency: 620, duration: 0.05, type: 'triangle', gain: 0.065 }],
    warning: [{ frequency: 220, endFrequency: 165, duration: 0.1, type: 'square', gain: 0.05 }],
    tab: [
      { source: 'noise', filterType: 'highpass', frequency: 2300, duration: 0.028, gain: 0.018, pan: -0.3 },
      { frequency: 440, duration: 0.035, type: 'square', gain: 0.036, pan: -0.2 },
      { frequency: 660, start: 0.034, duration: 0.055, type: 'triangle', gain: 0.04, pan: 0.08 },
      { frequency: 990, start: 0.084, duration: 0.08, type: 'sine', gain: 0.032, pan: 0.28, reverb: 0.22 },
    ],
    deploy: [
      { source: 'noise', filterType: 'bandpass', frequency: 1280, q: 0.78, duration: 0.16, gain: 0.032, pan: -0.42, reverb: 0.22 },
      { frequency: 196, endFrequency: 294, duration: 0.09, type: 'sawtooth', gain: 0.044, pan: -0.28 },
      { frequency: 392, start: 0.075, duration: 0.1, type: 'triangle', gain: 0.048 },
      { frequency: 784, start: 0.16, duration: 0.16, type: 'sine', gain: 0.038, pan: 0.3, reverb: 0.28 },
    ],
    formation: [
      { frequency: 330, duration: 0.04, type: 'square', gain: 0.04, pan: -0.3 },
      { frequency: 440, start: 0.035, duration: 0.05, type: 'square', gain: 0.04, pan: -0.1 },
      { frequency: 550, start: 0.078, duration: 0.06, type: 'triangle', gain: 0.042, pan: 0.12 },
      { frequency: 880, start: 0.13, duration: 0.1, type: 'sine', gain: 0.032, pan: 0.3, reverb: 0.24 },
    ],
    objectivePending: [
      { source: 'noise', filterType: 'highpass', frequency: 2100, duration: 0.06, gain: 0.024, pan: -0.36, reverb: 0.2 },
      { frequency: 698, endFrequency: 988, duration: 0.05, type: 'square', gain: 0.04, pan: -0.3 },
      { frequency: 988, endFrequency: 698, start: 0.07, duration: 0.05, type: 'square', gain: 0.04, pan: 0.3 },
      { frequency: 174, start: 0.14, duration: 0.18, type: 'sine', gain: 0.043, reverb: 0.28 },
    ],
    objectiveCapture: [
      { source: 'noise', filterType: 'highpass', frequency: 2600, duration: 0.1, gain: 0.028, pan: -0.42, reverb: 0.24 },
      { frequency: 392, duration: 0.055, type: 'triangle', gain: 0.048, pan: -0.26 },
      { frequency: 588, start: 0.05, duration: 0.07, type: 'triangle', gain: 0.048 },
      { frequency: 1176, start: 0.12, duration: 0.18, type: 'sine', gain: 0.04, pan: 0.32, reverb: 0.3 },
    ],
    missionEvent: [
      { source: 'noise', filterType: 'bandpass', frequency: 1450, q: 0.9, duration: 0.15, gain: 0.032, pan: -0.4, reverb: 0.2 },
      { frequency: 220, endFrequency: 330, duration: 0.09, type: 'sawtooth', gain: 0.043, pan: -0.24 },
      { frequency: 440, start: 0.075, duration: 0.1, type: 'square', gain: 0.04 },
      { frequency: 880, start: 0.16, duration: 0.13, type: 'triangle', gain: 0.034, pan: 0.3, reverb: 0.26 },
    ],
    missionEventHazard: [
      { source: 'noise', filterType: 'lowpass', frequency: 840, duration: 0.28, gain: 0.05, pan: -0.46, reverb: 0.24 },
      { frequency: 146, endFrequency: 98, duration: 0.2, type: 'sawtooth', gain: 0.05, pan: -0.24 },
      { frequency: 220, endFrequency: 165, start: 0.1, duration: 0.2, type: 'square', gain: 0.043, pan: 0.12 },
      { frequency: 440, start: 0.24, duration: 0.12, type: 'triangle', gain: 0.032, pan: 0.32, reverb: 0.28 },
    ],
    enemyMark: [
      { frequency: 1180, endFrequency: 1480, duration: 0.045, type: 'square', gain: 0.035, pan: -0.3 },
      { frequency: 1480, endFrequency: 1180, start: 0.055, duration: 0.045, type: 'square', gain: 0.035, pan: 0.3 },
      { frequency: 220, start: 0.11, duration: 0.12, type: 'sine', gain: 0.04, reverb: 0.2 },
    ],
    enemyBarrage: [
      { source: 'noise', filterType: 'lowpass', frequency: 720, duration: 0.16, gain: 0.052, pan: -0.42, reverb: 0.22 },
      { frequency: 130, endFrequency: 72, duration: 0.1, type: 'sine', gain: 0.06, pan: -0.28 },
      { frequency: 155, endFrequency: 80, start: 0.09, duration: 0.11, type: 'sine', gain: 0.058, pan: 0.04 },
      { frequency: 180, endFrequency: 88, start: 0.18, duration: 0.13, type: 'sine', gain: 0.056, pan: 0.3 },
    ],
    combat: [
      { source: 'noise', filterType: 'highpass', frequency: 2800, duration: 0.045, gain: 0.03, pan: -0.32 },
      { frequency: 180, endFrequency: 90, duration: 0.08, type: 'square', gain: 0.052, pan: -0.18 },
      { frequency: 360, endFrequency: 220, start: 0.045, duration: 0.09, type: 'sawtooth', gain: 0.044, pan: 0.2 },
      { source: 'noise', filterType: 'bandpass', frequency: 960, start: 0.08, duration: 0.12, gain: 0.032, pan: 0.34, reverb: 0.18 },
    ],
    heavyHit: [
      { source: 'noise', filterType: 'lowpass', frequency: 920, duration: 0.16, gain: 0.052, pan: -0.38, reverb: 0.22 },
      { frequency: 155, endFrequency: 58, duration: 0.13, type: 'sawtooth', gain: 0.06, pan: -0.22 },
      { frequency: 310, endFrequency: 124, start: 0.045, duration: 0.14, type: 'square', gain: 0.048, pan: 0.18 },
      { source: 'noise', filterType: 'bandpass', frequency: 1380, start: 0.11, duration: 0.14, gain: 0.034, pan: 0.36, reverb: 0.24 },
    ],
    allyHit: [
      { source: 'noise', filterType: 'bandpass', frequency: 760, duration: 0.13, gain: 0.042, pan: -0.34, reverb: 0.2 },
      { frequency: 294, endFrequency: 147, duration: 0.11, type: 'triangle', gain: 0.052, pan: -0.16 },
      { frequency: 196, endFrequency: 98, start: 0.08, duration: 0.15, type: 'sine', gain: 0.042, pan: 0.28, reverb: 0.26 },
    ],
    shieldBreak: [
      { source: 'noise', filterType: 'highpass', frequency: 3200, duration: 0.09, gain: 0.036, pan: -0.42, reverb: 0.26 },
      { frequency: 1180, endFrequency: 420, duration: 0.08, type: 'triangle', gain: 0.044, pan: -0.24 },
      { frequency: 880, endFrequency: 330, start: 0.055, duration: 0.1, type: 'square', gain: 0.04, pan: 0.18 },
      { frequency: 132, endFrequency: 74, start: 0.11, duration: 0.16, type: 'sine', gain: 0.05, pan: 0.34, reverb: 0.22 },
    ],
    reactionShot: [
      { source: 'noise', filterType: 'highpass', frequency: 3400, duration: 0.035, gain: 0.034, pan: -0.38 },
      { frequency: 620, endFrequency: 240, duration: 0.065, type: 'sawtooth', gain: 0.048, pan: -0.24 },
      { frequency: 520, endFrequency: 210, start: 0.07, duration: 0.07, type: 'sawtooth', gain: 0.046, pan: 0.24 },
      { source: 'noise', filterType: 'bandpass', frequency: 1200, start: 0.12, duration: 0.1, gain: 0.026, pan: 0.38, reverb: 0.2 },
    ],
    unitDown: [
      { source: 'noise', filterType: 'lowpass', frequency: 560, duration: 0.2, gain: 0.035, pan: -0.32, reverb: 0.24 },
      { frequency: 330, endFrequency: 220, duration: 0.12, type: 'triangle', gain: 0.046, pan: -0.2 },
      { frequency: 196, endFrequency: 110, start: 0.1, duration: 0.17, type: 'sine', gain: 0.042, pan: 0.22, reverb: 0.28 },
    ],
    elimination: [
      { source: 'noise', filterType: 'bandpass', frequency: 1600, q: 0.78, duration: 0.12, gain: 0.034, pan: -0.36, reverb: 0.2 },
      { frequency: 260, endFrequency: 390, duration: 0.06, type: 'triangle', gain: 0.045, pan: -0.22 },
      { frequency: 520, start: 0.055, duration: 0.075, type: 'triangle', gain: 0.046 },
      { frequency: 1040, start: 0.13, duration: 0.12, type: 'sine', gain: 0.034, pan: 0.3, reverb: 0.26 },
    ],
    victory: [
      { source: 'noise', filterType: 'bandpass', frequency: 1700, q: 0.64, duration: 0.36, gain: 0.042, pan: -0.56, reverb: 0.31 },
      { source: 'noise', filterType: 'bandpass', frequency: 2400, q: 0.72, start: 0.04, duration: 0.38, gain: 0.038, pan: 0.56, reverb: 0.31 },
      { frequency: 392, duration: 0.055, type: 'triangle', gain: 0.05, pan: -0.3 },
      { frequency: 588, start: 0.05, duration: 0.07, type: 'triangle', gain: 0.05 },
      { frequency: 784, start: 0.115, duration: 0.09, type: 'triangle', gain: 0.048, pan: 0.2 },
      { frequency: 1568, start: 0.21, duration: 0.22, type: 'sine', gain: 0.04, pan: 0.36, reverb: 0.34 },
    ],
    defeat: [
      { source: 'noise', filterType: 'lowpass', frequency: 580, duration: 0.2, gain: 0.036, pan: -0.34, reverb: 0.26 },
      { frequency: 440, endFrequency: 294, duration: 0.12, type: 'triangle', gain: 0.048, pan: -0.22 },
      { frequency: 247, endFrequency: 130, start: 0.105, duration: 0.18, type: 'sine', gain: 0.044, pan: 0.24, reverb: 0.3 },
    ],
  },
  broadcast: {
    accent: [{ frequency: 920, duration: 0.045, type: 'sine', gain: 0.022 }],
    click: [{ frequency: 500, endFrequency: 620, duration: 0.045, type: 'triangle', gain: 0.06 }],
    tab: [
      { source: 'noise', filterType: 'highpass', frequency: 2100, duration: 0.025, gain: 0.018, pan: -0.24 },
      { frequency: 520, duration: 0.035, type: 'square', gain: 0.034, pan: -0.18 },
      { frequency: 780, start: 0.032, duration: 0.052, type: 'triangle', gain: 0.038 },
      { frequency: 1040, start: 0.078, duration: 0.075, type: 'sine', gain: 0.032, pan: 0.22 },
    ],
    nav: [
      { frequency: 640, duration: 0.04, type: 'sine', gain: 0.05 },
      { frequency: 960, start: 0.035, duration: 0.07, type: 'sine', gain: 0.04 },
    ],
    match: [
      { source: 'noise', filterType: 'bandpass', frequency: 1350, q: 0.72, duration: 0.2, gain: 0.034, pan: -0.5, reverb: 0.28 },
      { source: 'noise', filterType: 'bandpass', frequency: 1850, q: 0.78, start: 0.035, duration: 0.22, gain: 0.032, pan: 0.5, reverb: 0.28 },
      { frequency: 392, duration: 0.045, type: 'square', gain: 0.04, pan: -0.28 },
      { frequency: 588, start: 0.045, duration: 0.06, type: 'triangle', gain: 0.042 },
      { frequency: 784, start: 0.105, duration: 0.11, type: 'sine', gain: 0.038, pan: 0.28 },
    ],
    cupStart: [
      { source: 'noise', filterType: 'highpass', frequency: 1900, duration: 0.09, gain: 0.03, pan: -0.42, reverb: 0.26 },
      { frequency: 440, duration: 0.05, type: 'triangle', gain: 0.048, pan: -0.25 },
      { frequency: 660, start: 0.045, duration: 0.065, type: 'triangle', gain: 0.048 },
      { frequency: 880, start: 0.105, duration: 0.085, type: 'triangle', gain: 0.045, pan: 0.25 },
      { frequency: 1320, start: 0.18, duration: 0.15, type: 'sine', gain: 0.036, reverb: 0.3 },
    ],
    cupMatch: [
      { source: 'noise', filterType: 'bandpass', frequency: 1550, q: 0.9, duration: 0.13, gain: 0.026, pan: -0.38, reverb: 0.24 },
      { frequency: 560, duration: 0.035, type: 'square', gain: 0.04, pan: -0.2 },
      { frequency: 740, start: 0.035, duration: 0.05, type: 'triangle', gain: 0.042 },
      { frequency: 930, start: 0.08, duration: 0.085, type: 'sine', gain: 0.038, pan: 0.24 },
    ],
    winnersStart: [
      { source: 'noise', filterType: 'lowpass', frequency: 980, duration: 0.13, gain: 0.035, pan: -0.4, reverb: 0.25 },
      { frequency: 196, endFrequency: 294, duration: 0.1, type: 'sawtooth', gain: 0.043, pan: -0.25 },
      { frequency: 392, start: 0.08, duration: 0.1, type: 'triangle', gain: 0.046 },
      { frequency: 588, start: 0.17, duration: 0.13, type: 'sine', gain: 0.04, pan: 0.28 },
    ],
    winnersSet: [
      { source: 'noise', filterType: 'bandpass', frequency: 1250, q: 1, duration: 0.12, gain: 0.028, pan: 0.4, reverb: 0.24 },
      { frequency: 320, duration: 0.04, type: 'square', gain: 0.041, pan: -0.24 },
      { frequency: 480, start: 0.038, duration: 0.05, type: 'square', gain: 0.04 },
      { frequency: 720, start: 0.085, duration: 0.09, type: 'triangle', gain: 0.041, pan: 0.24 },
    ],
    verdict: [
      { source: 'noise', filterType: 'lowpass', frequency: 640, duration: 0.16, gain: 0.045, pan: -0.36, reverb: 0.25 },
      { frequency: 220, endFrequency: 165, duration: 0.1, type: 'square', gain: 0.043, pan: -0.22 },
      { frequency: 330, start: 0.1, duration: 0.12, type: 'sawtooth', gain: 0.035 },
      { frequency: 660, start: 0.2, duration: 0.16, type: 'sine', gain: 0.034, pan: 0.24, reverb: 0.3 },
    ],
    comeback: [
      { source: 'noise', filterType: 'bandpass', frequency: 1650, q: 0.7, duration: 0.28, gain: 0.038, pan: -0.5, reverb: 0.3 },
      { source: 'noise', filterType: 'bandpass', frequency: 2200, q: 0.8, start: 0.04, duration: 0.3, gain: 0.034, pan: 0.5, reverb: 0.3 },
      { frequency: 260, endFrequency: 390, duration: 0.07, type: 'triangle', gain: 0.046, pan: -0.28 },
      { frequency: 520, start: 0.065, duration: 0.075, type: 'triangle', gain: 0.047 },
      { frequency: 780, start: 0.13, duration: 0.09, type: 'triangle', gain: 0.045, pan: 0.2 },
      { frequency: 1170, start: 0.215, duration: 0.16, type: 'sine', gain: 0.038, pan: 0.32, reverb: 0.3 },
    ],
    victory: [
      { source: 'noise', filterType: 'bandpass', frequency: 1700, q: 0.62, duration: 0.34, gain: 0.04, pan: -0.55, reverb: 0.3 },
      { source: 'noise', filterType: 'bandpass', frequency: 2400, q: 0.75, start: 0.03, duration: 0.36, gain: 0.036, pan: 0.55, reverb: 0.3 },
      { frequency: 392, duration: 0.05, type: 'triangle', gain: 0.048, pan: -0.3 },
      { frequency: 588, start: 0.045, duration: 0.065, type: 'triangle', gain: 0.048 },
      { frequency: 784, start: 0.105, duration: 0.085, type: 'triangle', gain: 0.046, pan: 0.22 },
      { frequency: 1176, start: 0.185, duration: 0.18, type: 'sine', gain: 0.04, pan: 0.34, reverb: 0.32 },
    ],
    defeat: [
      { source: 'noise', filterType: 'lowpass', frequency: 620, duration: 0.16, gain: 0.032, pan: -0.32, reverb: 0.24 },
      { frequency: 440, endFrequency: 330, duration: 0.11, type: 'triangle', gain: 0.046, pan: -0.2 },
      { frequency: 260, endFrequency: 165, start: 0.09, duration: 0.15, type: 'sine', gain: 0.043, pan: 0.22, reverb: 0.27 },
    ],
    event: [
      { source: 'noise', filterType: 'highpass', frequency: 2200, duration: 0.08, gain: 0.026, pan: -0.36 },
      { frequency: 680, endFrequency: 1020, duration: 0.08, type: 'sawtooth', gain: 0.038, pan: -0.18 },
      { frequency: 1020, endFrequency: 1360, start: 0.07, duration: 0.09, type: 'triangle', gain: 0.038, pan: 0.16 },
      { frequency: 1530, start: 0.15, duration: 0.12, type: 'sine', gain: 0.032, pan: 0.34, reverb: 0.27 },
    ],
    champion: [
      { source: 'noise', filterType: 'bandpass', frequency: 1550, q: 0.55, duration: 0.52, gain: 0.044, pan: -0.58, reverb: 0.32 },
      { source: 'noise', filterType: 'bandpass', frequency: 2350, q: 0.65, start: 0.04, duration: 0.56, gain: 0.04, pan: 0.58, reverb: 0.32 },
      { frequency: 392, duration: 0.06, type: 'triangle', gain: 0.052, pan: -0.32 },
      { frequency: 588, start: 0.055, duration: 0.075, type: 'triangle', gain: 0.05, pan: -0.1 },
      { frequency: 784, start: 0.125, duration: 0.095, type: 'triangle', gain: 0.05, pan: 0.14 },
      { frequency: 1176, start: 0.215, duration: 0.15, type: 'triangle', gain: 0.046, pan: 0.3 },
      { frequency: 1568, start: 0.35, duration: 0.24, type: 'sine', gain: 0.04, pan: 0.4, reverb: 0.34 },
    ],
  },
  school: {
    accent: [{ frequency: 740, duration: 0.055, type: 'triangle', gain: 0.022 }],
    click: [{ frequency: 640, endFrequency: 720, duration: 0.055, type: 'triangle', gain: 0.065 }],
    confirm: [
      { frequency: 720, duration: 0.045, type: 'sine', gain: 0.05 },
      { frequency: 960, start: 0.04, duration: 0.06, type: 'sine', gain: 0.04 },
    ],
    schoolNewRun: [
      { source: 'noise', filterType: 'highpass', frequency: 2300, duration: 0.08, gain: 0.022, pan: -0.36, reverb: 0.22 },
      { frequency: 523, duration: 0.06, type: 'triangle', gain: 0.044, pan: -0.24 },
      { frequency: 659, start: 0.055, duration: 0.08, type: 'triangle', gain: 0.044 },
      { frequency: 1047, start: 0.13, duration: 0.16, type: 'sine', gain: 0.038, pan: 0.3, reverb: 0.26 },
    ],
    schoolSemester: [
      { source: 'noise', filterType: 'bandpass', frequency: 1750, q: 0.7, duration: 0.3, gain: 0.032, pan: -0.48, reverb: 0.28 },
      { frequency: 392, duration: 0.055, type: 'triangle', gain: 0.046, pan: -0.3 },
      { frequency: 523, start: 0.05, duration: 0.07, type: 'triangle', gain: 0.046, pan: -0.08 },
      { frequency: 784, start: 0.115, duration: 0.09, type: 'triangle', gain: 0.044, pan: 0.18 },
      { frequency: 1176, start: 0.2, duration: 0.2, type: 'sine', gain: 0.04, pan: 0.36, reverb: 0.3 },
    ],
    schoolFestivalStart: [
      { source: 'noise', filterType: 'highpass', frequency: 2500, duration: 0.13, gain: 0.032, pan: -0.48, reverb: 0.2 },
      { frequency: 440, endFrequency: 660, duration: 0.08, type: 'triangle', gain: 0.044, pan: -0.24 },
      { frequency: 660, endFrequency: 880, start: 0.075, duration: 0.09, type: 'triangle', gain: 0.044 },
      { frequency: 1320, start: 0.16, duration: 0.16, type: 'sine', gain: 0.038, pan: 0.34, reverb: 0.24 },
    ],
    schoolFestivalComplete: [
      { source: 'noise', filterType: 'bandpass', frequency: 2200, q: 0.8, duration: 0.32, gain: 0.036, pan: -0.54, reverb: 0.26 },
      { frequency: 523, duration: 0.045, type: 'triangle', gain: 0.048, pan: -0.3 },
      { frequency: 784, start: 0.04, duration: 0.06, type: 'triangle', gain: 0.048 },
      { frequency: 1047, start: 0.095, duration: 0.08, type: 'triangle', gain: 0.046, pan: 0.2 },
      { frequency: 1568, start: 0.17, duration: 0.2, type: 'sine', gain: 0.04, pan: 0.38, reverb: 0.3 },
    ],
    schoolIncident: [
      { source: 'noise', filterType: 'bandpass', frequency: 980, q: 2.6, duration: 0.2, gain: 0.04, pan: -0.42 },
      { frequency: 620, endFrequency: 430, duration: 0.09, type: 'square', gain: 0.046, pan: -0.2 },
      { frequency: 620, endFrequency: 390, start: 0.11, duration: 0.11, type: 'square', gain: 0.046, pan: 0.22 },
      { frequency: 155, start: 0.18, duration: 0.14, type: 'sine', gain: 0.032 },
    ],
    schoolResolution: [
      { source: 'noise', filterType: 'highpass', frequency: 1800, duration: 0.07, gain: 0.024, pan: -0.34 },
      { frequency: 440, duration: 0.05, type: 'triangle', gain: 0.044, pan: -0.2 },
      { frequency: 660, start: 0.045, duration: 0.07, type: 'triangle', gain: 0.044 },
      { frequency: 880, start: 0.11, duration: 0.12, type: 'sine', gain: 0.038, pan: 0.3, reverb: 0.22 },
    ],
    schoolCrisis: [
      { source: 'noise', filterType: 'lowpass', frequency: 640, duration: 0.18, gain: 0.044, pan: -0.4 },
      { frequency: 260, endFrequency: 170, duration: 0.12, type: 'sawtooth', gain: 0.05, pan: -0.2 },
      { frequency: 210, endFrequency: 130, start: 0.1, duration: 0.15, type: 'square', gain: 0.044, pan: 0.18 },
      { frequency: 110, start: 0.2, duration: 0.16, type: 'sine', gain: 0.036, pan: 0.3 },
    ],
    schoolRecovery: [
      { source: 'noise', filterType: 'highpass', frequency: 1700, duration: 0.06, gain: 0.02, pan: -0.32 },
      { frequency: 392, endFrequency: 523, duration: 0.08, type: 'sine', gain: 0.042, pan: -0.18 },
      { frequency: 659, start: 0.07, duration: 0.1, type: 'triangle', gain: 0.042 },
      { frequency: 988, start: 0.15, duration: 0.14, type: 'sine', gain: 0.036, pan: 0.3, reverb: 0.24 },
    ],
    schoolBell: [
      { frequency: 784, duration: 0.14, type: 'sine', gain: 0.046, pan: -0.24, reverb: 0.3 },
      { frequency: 1176, start: 0.02, duration: 0.16, type: 'sine', gain: 0.038, pan: 0.22, reverb: 0.34 },
      { frequency: 1568, start: 0.16, duration: 0.15, type: 'sine', gain: 0.032, pan: 0.34, reverb: 0.34 },
    ],
    schoolCounseling: [
      { source: 'noise', filterType: 'lowpass', frequency: 760, duration: 0.12, gain: 0.018, pan: -0.32, reverb: 0.24 },
      { frequency: 349, endFrequency: 440, duration: 0.1, type: 'sine', gain: 0.04, pan: -0.18 },
      { frequency: 523, start: 0.09, duration: 0.12, type: 'triangle', gain: 0.038 },
      { frequency: 698, start: 0.19, duration: 0.15, type: 'sine', gain: 0.034, pan: 0.28, reverb: 0.28 },
    ],
    schoolLesson: [
      { source: 'noise', filterType: 'highpass', frequency: 2100, duration: 0.045, gain: 0.018, pan: -0.34 },
      { frequency: 523, duration: 0.045, type: 'triangle', gain: 0.042, pan: -0.2 },
      { frequency: 659, start: 0.04, duration: 0.055, type: 'triangle', gain: 0.042 },
      { frequency: 988, start: 0.09, duration: 0.1, type: 'sine', gain: 0.036, pan: 0.28 },
    ],
    schoolClub: [
      { source: 'noise', filterType: 'highpass', frequency: 2300, duration: 0.08, gain: 0.026, pan: -0.4 },
      { frequency: 440, duration: 0.045, type: 'square', gain: 0.038, pan: -0.22 },
      { frequency: 660, start: 0.04, duration: 0.06, type: 'triangle', gain: 0.042 },
      { frequency: 880, start: 0.095, duration: 0.11, type: 'sine', gain: 0.036, pan: 0.3, reverb: 0.22 },
    ],
    schoolPolicy: [
      { source: 'noise', filterType: 'bandpass', frequency: 1450, q: 1.1, duration: 0.09, gain: 0.022, pan: -0.38 },
      { frequency: 392, duration: 0.05, type: 'triangle', gain: 0.042, pan: -0.22 },
      { frequency: 587, start: 0.045, duration: 0.07, type: 'triangle', gain: 0.042 },
      { frequency: 784, start: 0.11, duration: 0.11, type: 'sine', gain: 0.036, pan: 0.28, reverb: 0.24 },
    ],
    schoolMaintenance: [
      { source: 'noise', filterType: 'highpass', frequency: 1900, duration: 0.055, gain: 0.026, pan: -0.4 },
      { frequency: 294, endFrequency: 392, duration: 0.06, type: 'square', gain: 0.038, pan: -0.22 },
      { frequency: 588, start: 0.055, duration: 0.065, type: 'triangle', gain: 0.042 },
      { frequency: 784, start: 0.115, duration: 0.1, type: 'sine', gain: 0.034, pan: 0.3, reverb: 0.2 },
    ],
    schoolTeacher: [
      { source: 'noise', filterType: 'lowpass', frequency: 920, duration: 0.1, gain: 0.017, pan: -0.34, reverb: 0.2 },
      { frequency: 349, duration: 0.075, type: 'sine', gain: 0.04, pan: -0.2 },
      { frequency: 523, start: 0.065, duration: 0.095, type: 'triangle', gain: 0.04 },
      { frequency: 698, start: 0.15, duration: 0.13, type: 'sine', gain: 0.035, pan: 0.28, reverb: 0.26 },
    ],
    schoolAdmission: [
      { source: 'noise', filterType: 'highpass', frequency: 2450, duration: 0.075, gain: 0.022, pan: -0.42 },
      { frequency: 523, duration: 0.045, type: 'triangle', gain: 0.044, pan: -0.24 },
      { frequency: 659, start: 0.04, duration: 0.06, type: 'triangle', gain: 0.044 },
      { frequency: 1047, start: 0.095, duration: 0.09, type: 'triangle', gain: 0.04, pan: 0.2 },
      { frequency: 1319, start: 0.17, duration: 0.15, type: 'sine', gain: 0.034, pan: 0.34, reverb: 0.27 },
    ],
    schoolCareer: [
      { source: 'noise', filterType: 'bandpass', frequency: 1250, q: 0.8, duration: 0.16, gain: 0.019, pan: -0.4, reverb: 0.22 },
      { frequency: 330, duration: 0.07, type: 'sine', gain: 0.04, pan: -0.22 },
      { frequency: 494, start: 0.065, duration: 0.085, type: 'triangle', gain: 0.04 },
      { frequency: 659, start: 0.145, duration: 0.1, type: 'triangle', gain: 0.038, pan: 0.18 },
      { frequency: 988, start: 0.235, duration: 0.14, type: 'sine', gain: 0.032, pan: 0.32, reverb: 0.28 },
    ],
    schoolRest: [
      { source: 'noise', filterType: 'lowpass', frequency: 520, duration: 0.24, gain: 0.02, pan: -0.38, reverb: 0.3 },
      { frequency: 523, endFrequency: 392, duration: 0.14, type: 'sine', gain: 0.036, pan: -0.2 },
      { frequency: 330, start: 0.12, duration: 0.15, type: 'sine', gain: 0.033 },
      { frequency: 494, start: 0.24, duration: 0.18, type: 'sine', gain: 0.03, pan: 0.28, reverb: 0.34 },
    ],
    schoolVision: [
      { source: 'noise', filterType: 'bandpass', frequency: 1850, q: 0.65, duration: 0.34, gain: 0.03, pan: -0.5, reverb: 0.3 },
      { frequency: 392, duration: 0.055, type: 'triangle', gain: 0.044, pan: -0.28 },
      { frequency: 588, start: 0.05, duration: 0.075, type: 'triangle', gain: 0.044, pan: -0.08 },
      { frequency: 784, start: 0.12, duration: 0.1, type: 'triangle', gain: 0.042, pan: 0.16 },
      { frequency: 1176, start: 0.215, duration: 0.19, type: 'sine', gain: 0.036, pan: 0.36, reverb: 0.32 },
    ],
    schoolOperation: [
      { source: 'noise', filterType: 'highpass', frequency: 2050, duration: 0.05, gain: 0.019, pan: -0.34 },
      { frequency: 440, duration: 0.045, type: 'triangle', gain: 0.042, pan: -0.2 },
      { frequency: 660, start: 0.04, duration: 0.06, type: 'triangle', gain: 0.042 },
      { frequency: 880, start: 0.095, duration: 0.1, type: 'sine', gain: 0.036, pan: 0.28, reverb: 0.22 },
    ],
    schoolBlocked: [
      { source: 'noise', filterType: 'bandpass', frequency: 1050, q: 2.8, duration: 0.13, gain: 0.032, pan: -0.36 },
      { frequency: 330, endFrequency: 240, duration: 0.08, type: 'square', gain: 0.044, pan: -0.18 },
      { frequency: 220, start: 0.08, duration: 0.12, type: 'sine', gain: 0.038, pan: 0.24 },
    ],
  },
  coding: {
    accent: [{ frequency: 1280, duration: 0.03, type: 'square', gain: 0.018, pan: 0.3 }],
    click: [
      { source: 'noise', filterType: 'highpass', frequency: 2600, duration: 0.018, gain: 0.012, pan: -0.22 },
      { frequency: 410, endFrequency: 520, duration: 0.038, type: 'square', gain: 0.04, pan: 0.16 },
    ],
    nav: [
      { source: 'noise', filterType: 'highpass', frequency: 2200, duration: 0.025, gain: 0.015, pan: -0.3 },
      { frequency: 520, duration: 0.035, type: 'square', gain: 0.034, pan: -0.12 },
      { frequency: 780, start: 0.035, duration: 0.06, type: 'sine', gain: 0.029, pan: 0.28, reverb: 0.12 },
    ],
    confirm: [
      { source: 'noise', filterType: 'highpass', frequency: 2400, duration: 0.024, gain: 0.014, pan: -0.26 },
      { frequency: 520, duration: 0.035, type: 'square', gain: 0.035, pan: -0.12 },
      { frequency: 1040, start: 0.035, duration: 0.06, type: 'triangle', gain: 0.035, pan: 0.26, reverb: 0.12 },
    ],
    start: [
      { source: 'noise', filterType: 'highpass', frequency: 1800, duration: 0.16, gain: 0.022, pan: -0.48, reverb: 0.18 },
      { frequency: 110, endFrequency: 220, duration: 0.18, type: 'sawtooth', gain: 0.034, pan: -0.3 },
      { frequency: 440, start: 0.06, duration: 0.05, type: 'square', gain: 0.038, pan: -0.08 },
      { frequency: 660, start: 0.11, duration: 0.07, type: 'triangle', gain: 0.037, pan: 0.16 },
      { frequency: 1040, start: 0.19, duration: 0.14, type: 'sine', gain: 0.032, pan: 0.4, reverb: 0.25 },
    ],
    deploy: [
      { source: 'noise', filterType: 'bandpass', frequency: 1280, q: 2.6, duration: 0.055, gain: 0.024, pan: -0.4 },
      { frequency: 260, duration: 0.045, type: 'square', gain: 0.041, pan: -0.22 },
      { frequency: 520, start: 0.045, duration: 0.065, type: 'triangle', gain: 0.04, pan: 0.04 },
      { frequency: 880, start: 0.105, duration: 0.11, type: 'sine', gain: 0.034, pan: 0.34, reverb: 0.2 },
    ],
    projectApproved: [
      { source: 'noise', filterType: 'highpass', frequency: 2100, duration: 0.07, gain: 0.021, pan: -0.42 },
      { frequency: 392, duration: 0.045, type: 'square', gain: 0.04, pan: -0.26 },
      { frequency: 588, start: 0.04, duration: 0.06, type: 'triangle', gain: 0.041, pan: -0.04 },
      { frequency: 784, start: 0.095, duration: 0.075, type: 'triangle', gain: 0.038, pan: 0.18 },
      { frequency: 1176, start: 0.165, duration: 0.16, type: 'sine', gain: 0.032, pan: 0.4, reverb: 0.28 },
    ],
    projectHeld: [
      { source: 'noise', filterType: 'bandpass', frequency: 900, q: 3, duration: 0.07, gain: 0.024, pan: -0.38 },
      { frequency: 440, duration: 0.055, type: 'square', gain: 0.036, pan: -0.2 },
      { frequency: 520, start: 0.075, duration: 0.06, type: 'triangle', gain: 0.034, pan: 0.12 },
      { frequency: 440, start: 0.15, duration: 0.11, type: 'sine', gain: 0.03, pan: 0.34, reverb: 0.18 },
    ],
    projectRejected: [
      { source: 'noise', filterType: 'lowpass', frequency: 650, duration: 0.12, gain: 0.035, pan: -0.4, reverb: 0.12 },
      { frequency: 310, endFrequency: 230, duration: 0.09, type: 'square', gain: 0.042, pan: -0.2 },
      { frequency: 205, start: 0.08, duration: 0.12, type: 'sawtooth', gain: 0.034, pan: 0.12 },
      { frequency: 120, start: 0.17, duration: 0.16, type: 'sine', gain: 0.034, pan: 0.34, reverb: 0.16 },
    ],
    codePerfect: [
      { source: 'noise', filterType: 'highpass', frequency: 2700, duration: 0.055, gain: 0.02, pan: -0.44 },
      { frequency: 523, duration: 0.035, type: 'square', gain: 0.04, pan: -0.26 },
      { frequency: 784, start: 0.035, duration: 0.05, type: 'triangle', gain: 0.042, pan: -0.05 },
      { frequency: 1047, start: 0.085, duration: 0.07, type: 'triangle', gain: 0.04, pan: 0.2 },
      { frequency: 1568, start: 0.15, duration: 0.15, type: 'sine', gain: 0.033, pan: 0.42, reverb: 0.3 },
    ],
    codePass: [
      { source: 'noise', filterType: 'highpass', frequency: 2300, duration: 0.035, gain: 0.018, pan: -0.38 },
      { frequency: 520, duration: 0.035, type: 'square', gain: 0.039, pan: -0.2 },
      { frequency: 780, start: 0.034, duration: 0.06, type: 'triangle', gain: 0.039, pan: 0.08 },
      { frequency: 1040, start: 0.09, duration: 0.1, type: 'sine', gain: 0.032, pan: 0.36, reverb: 0.2 },
    ],
    codeFail: [
      { source: 'noise', filterType: 'bandpass', frequency: 760, q: 3.4, duration: 0.08, gain: 0.028, pan: -0.4 },
      { frequency: 360, endFrequency: 250, duration: 0.08, type: 'square', gain: 0.04, pan: -0.2 },
      { frequency: 240, start: 0.075, duration: 0.1, type: 'sawtooth', gain: 0.032, pan: 0.12 },
      { frequency: 150, start: 0.16, duration: 0.13, type: 'sine', gain: 0.036, pan: 0.34, reverb: 0.15 },
    ],
    taskSelect: [
      { source: 'noise', filterType: 'highpass', frequency: 2500, duration: 0.022, gain: 0.014, pan: -0.32 },
      { frequency: 460, duration: 0.035, type: 'square', gain: 0.036, pan: -0.16 },
      { frequency: 690, start: 0.034, duration: 0.065, type: 'triangle', gain: 0.035, pan: 0.3, reverb: 0.12 },
    ],
    taskReset: [
      { source: 'noise', filterType: 'highpass', frequency: 1850, duration: 0.045, gain: 0.018, pan: 0.4 },
      { frequency: 720, endFrequency: 520, duration: 0.065, type: 'triangle', gain: 0.037, pan: 0.24 },
      { frequency: 520, endFrequency: 340, start: 0.06, duration: 0.075, type: 'square', gain: 0.035, pan: -0.04 },
      { frequency: 260, start: 0.13, duration: 0.1, type: 'sine', gain: 0.031, pan: -0.34, reverb: 0.16 },
    ],
    documentReview: [
      { source: 'noise', filterType: 'highpass', frequency: 2800, duration: 0.025, gain: 0.016, pan: -0.34 },
      { frequency: 620, duration: 0.035, type: 'square', gain: 0.036, pan: -0.14 },
      { frequency: 930, start: 0.035, duration: 0.075, type: 'sine', gain: 0.032, pan: 0.32, reverb: 0.14 },
    ],
    documentReviewUndo: [
      { source: 'noise', filterType: 'highpass', frequency: 1900, duration: 0.025, gain: 0.015, pan: 0.34 },
      { frequency: 620, endFrequency: 470, duration: 0.055, type: 'triangle', gain: 0.034, pan: 0.16 },
      { frequency: 360, start: 0.055, duration: 0.08, type: 'sine', gain: 0.03, pan: -0.3, reverb: 0.12 },
    ],
    hintOpen: [
      { source: 'noise', filterType: 'highpass', frequency: 2600, duration: 0.04, gain: 0.016, pan: -0.38 },
      { frequency: 740, duration: 0.04, type: 'square', gain: 0.036, pan: -0.2 },
      { frequency: 1110, start: 0.038, duration: 0.06, type: 'triangle', gain: 0.036, pan: 0.08 },
      { frequency: 1480, start: 0.095, duration: 0.11, type: 'sine', gain: 0.03, pan: 0.36, reverb: 0.2 },
    ],
    supportHint: [
      { source: 'noise', filterType: 'highpass', frequency: 2350, duration: 0.035, gain: 0.017, pan: -0.4 },
      { frequency: 420, duration: 0.04, type: 'square', gain: 0.036, pan: -0.22 },
      { frequency: 630, start: 0.04, duration: 0.055, type: 'triangle', gain: 0.038, pan: 0.04 },
      { frequency: 1050, start: 0.09, duration: 0.1, type: 'sine', gain: 0.031, pan: 0.35, reverb: 0.2 },
    ],
    supportRisk: [
      { source: 'noise', filterType: 'bandpass', frequency: 1180, q: 2.4, duration: 0.045, gain: 0.02, pan: -0.4 },
      { frequency: 330, duration: 0.045, type: 'square', gain: 0.037, pan: -0.22 },
      { frequency: 660, start: 0.04, duration: 0.065, type: 'triangle', gain: 0.039, pan: 0.05 },
      { frequency: 990, start: 0.1, duration: 0.11, type: 'sine', gain: 0.032, pan: 0.36, reverb: 0.22 },
    ],
    projectSelect: [
      { source: 'noise', filterType: 'highpass', frequency: 2450, duration: 0.035, gain: 0.016, pan: -0.4 },
      { frequency: 520, duration: 0.035, type: 'square', gain: 0.037, pan: -0.22 },
      { frequency: 780, start: 0.04, duration: 0.055, type: 'triangle', gain: 0.038, pan: 0.04 },
      { frequency: 1040, start: 0.09, duration: 0.09, type: 'sine', gain: 0.032, pan: 0.35, reverb: 0.18 },
    ],
    codingBlocked: [
      { source: 'noise', filterType: 'bandpass', frequency: 720, q: 3.2, duration: 0.075, gain: 0.029, pan: -0.4 },
      { frequency: 310, endFrequency: 230, duration: 0.07, type: 'square', gain: 0.038, pan: -0.2 },
      { frequency: 230, start: 0.065, duration: 0.09, type: 'sawtooth', gain: 0.031, pan: 0.12 },
      { frequency: 155, start: 0.15, duration: 0.12, type: 'sine', gain: 0.033, pan: 0.34, reverb: 0.14 },
    ],
    codeFileSelect: [
      { source: 'noise', filterType: 'highpass', frequency: 3000, duration: 0.018, gain: 0.013, pan: -0.3 },
      { frequency: 560, duration: 0.028, type: 'square', gain: 0.034, pan: -0.12 },
      { frequency: 840, start: 0.028, duration: 0.055, type: 'triangle', gain: 0.031, pan: 0.28, reverb: 0.1 },
    ],
    codeSubmit: [
      { source: 'noise', filterType: 'highpass', frequency: 1900, duration: 0.09, gain: 0.024, pan: -0.44 },
      { frequency: 180, endFrequency: 360, duration: 0.1, type: 'sawtooth', gain: 0.034, pan: -0.28 },
      { frequency: 520, start: 0.04, duration: 0.045, type: 'square', gain: 0.04, pan: -0.06 },
      { frequency: 780, start: 0.085, duration: 0.065, type: 'triangle', gain: 0.039, pan: 0.16 },
      { frequency: 1170, start: 0.145, duration: 0.13, type: 'sine', gain: 0.032, pan: 0.4, reverb: 0.23 },
    ],
    save: [
      { source: 'noise', filterType: 'highpass', frequency: 2400, duration: 0.025, gain: 0.014, pan: -0.3 },
      { frequency: 480, duration: 0.035, type: 'square', gain: 0.034, pan: -0.12 },
      { frequency: 720, start: 0.035, duration: 0.065, type: 'sine', gain: 0.03, pan: 0.3, reverb: 0.12 },
    ],
    load: [
      { source: 'noise', filterType: 'highpass', frequency: 2100, duration: 0.035, gain: 0.015, pan: 0.32 },
      { frequency: 720, endFrequency: 540, duration: 0.05, type: 'triangle', gain: 0.035, pan: 0.16 },
      { frequency: 360, start: 0.05, duration: 0.08, type: 'sine', gain: 0.03, pan: -0.3, reverb: 0.12 },
    ],
    archive: [
      { source: 'noise', filterType: 'highpass', frequency: 2250, duration: 0.035, gain: 0.015, pan: -0.34 },
      { frequency: 440, duration: 0.04, type: 'square', gain: 0.035, pan: -0.16 },
      { frequency: 880, start: 0.04, duration: 0.09, type: 'sine', gain: 0.031, pan: 0.32, reverb: 0.16 },
    ],
  },
  rail: {
    accent: [{ frequency: 180, endFrequency: 150, duration: 0.08, type: 'triangle', gain: 0.025 }],
    click: [{ frequency: 300, endFrequency: 360, duration: 0.06, type: 'triangle', gain: 0.06 }],
    nav: [
      { frequency: 360, duration: 0.055, type: 'sine', gain: 0.05 },
      { frequency: 540, start: 0.052, duration: 0.072, type: 'sine', gain: 0.038 },
    ],
    start: [
      { source: 'noise', filterType: 'lowpass', frequency: 520, duration: 0.3, gain: 0.036, pan: -0.48, reverb: 0.2 },
      { frequency: 88, endFrequency: 165, duration: 0.28, type: 'sawtooth', gain: 0.05, pan: -0.24 },
      { frequency: 392, start: 0.11, duration: 0.07, type: 'triangle', gain: 0.04, pan: 0.12 },
      { frequency: 784, start: 0.2, duration: 0.12, type: 'sine', gain: 0.036, pan: 0.34, reverb: 0.25 },
    ],
    select: [
      { source: 'noise', filterType: 'highpass', frequency: 2100, duration: 0.04, gain: 0.021, pan: -0.34 },
      { frequency: 440, duration: 0.045, type: 'square', gain: 0.038, pan: -0.16 },
      { frequency: 660, start: 0.04, duration: 0.065, type: 'triangle', gain: 0.037, pan: 0.22, reverb: 0.16 },
    ],
    signalAdjust: [
      { source: 'noise', filterType: 'bandpass', frequency: 1180, q: 2.8, duration: 0.055, gain: 0.032, pan: -0.4 },
      { frequency: 520, duration: 0.04, type: 'square', gain: 0.04, pan: -0.2 },
      { frequency: 780, start: 0.038, duration: 0.06, type: 'triangle', gain: 0.039 },
      { frequency: 1040, start: 0.09, duration: 0.09, type: 'sine', gain: 0.032, pan: 0.3, reverb: 0.2 },
    ],
    serviceComplete: [
      { source: 'noise', filterType: 'highpass', frequency: 1900, duration: 0.12, gain: 0.03, pan: -0.5, reverb: 0.24 },
      { frequency: 392, duration: 0.05, type: 'triangle', gain: 0.047, pan: -0.3 },
      { frequency: 588, start: 0.045, duration: 0.065, type: 'triangle', gain: 0.046, pan: -0.08 },
      { frequency: 784, start: 0.105, duration: 0.085, type: 'triangle', gain: 0.044, pan: 0.16 },
      { frequency: 1176, start: 0.18, duration: 0.2, type: 'sine', gain: 0.038, pan: 0.36, reverb: 0.3 },
    ],
    tokenWait: [
      { source: 'noise', filterType: 'bandpass', frequency: 860, q: 3.1, duration: 0.06, gain: 0.028, pan: -0.36 },
      { frequency: 310, duration: 0.055, type: 'square', gain: 0.041, pan: -0.2 },
      { frequency: 230, start: 0.07, duration: 0.065, type: 'square', gain: 0.039, pan: 0.18 },
      { frequency: 310, start: 0.145, duration: 0.08, type: 'triangle', gain: 0.035, pan: 0.3, reverb: 0.18 },
    ],
    blockConflict: [
      { source: 'noise', filterType: 'bandpass', frequency: 720, q: 3.2, duration: 0.08, gain: 0.043, pan: -0.42 },
      { frequency: 280, endFrequency: 165, duration: 0.11, type: 'square', gain: 0.047, pan: -0.2 },
      { frequency: 180, start: 0.09, duration: 0.14, type: 'sawtooth', gain: 0.036, pan: 0.18 },
      { frequency: 92, start: 0.18, duration: 0.16, type: 'sine', gain: 0.032, pan: 0.3, reverb: 0.18 },
    ],
    signalStop: [
      { source: 'noise', filterType: 'lowpass', frequency: 540, duration: 0.14, gain: 0.03, pan: -0.38 },
      { frequency: 260, endFrequency: 190, duration: 0.09, type: 'square', gain: 0.046, pan: -0.2 },
      { frequency: 145, start: 0.07, duration: 0.13, type: 'sine', gain: 0.041, pan: 0.16 },
      { frequency: 260, endFrequency: 180, start: 0.18, duration: 0.1, type: 'square', gain: 0.038, pan: 0.3 },
    ],
    trainComplete: [
      { source: 'noise', filterType: 'highpass', frequency: 1800, duration: 0.065, gain: 0.023, pan: -0.38 },
      { frequency: 470, duration: 0.045, type: 'triangle', gain: 0.045, pan: -0.24 },
      { frequency: 705, start: 0.04, duration: 0.065, type: 'triangle', gain: 0.043 },
      { frequency: 940, start: 0.1, duration: 0.12, type: 'sine', gain: 0.037, pan: 0.3, reverb: 0.24 },
    ],
    delayedArrival: [
      { source: 'noise', filterType: 'lowpass', frequency: 680, duration: 0.16, gain: 0.025, pan: -0.36 },
      { frequency: 700, endFrequency: 520, duration: 0.08, type: 'triangle', gain: 0.041, pan: -0.2 },
      { frequency: 350, start: 0.075, duration: 0.1, type: 'square', gain: 0.035, pan: 0.16 },
      { frequency: 260, start: 0.16, duration: 0.13, type: 'sine', gain: 0.032, pan: 0.3, reverb: 0.2 },
    ],
    stationArrive: [
      { source: 'noise', filterType: 'highpass', frequency: 1500, duration: 0.12, gain: 0.024, pan: -0.42, reverb: 0.18 },
      { frequency: 880, duration: 0.05, type: 'sine', gain: 0.044, pan: -0.24, reverb: 0.18 },
      { frequency: 660, start: 0.045, duration: 0.065, type: 'sine', gain: 0.042 },
      { frequency: 440, start: 0.105, duration: 0.1, type: 'sine', gain: 0.038, pan: 0.28, reverb: 0.25 },
    ],
    trainDepart: [
      { source: 'noise', filterType: 'highpass', frequency: 1450, duration: 0.09, gain: 0.03, pan: -0.42 },
      { frequency: 110, endFrequency: 185, duration: 0.15, type: 'sawtooth', gain: 0.039, pan: -0.24 },
      { frequency: 420, endFrequency: 690, start: 0.055, duration: 0.1, type: 'sine', gain: 0.046 },
      { frequency: 820, start: 0.14, duration: 0.1, type: 'triangle', gain: 0.035, pan: 0.32, reverb: 0.2 },
    ],
    railNetworkClear: [
      { source: 'noise', filterType: 'highpass', frequency: 2250, duration: 0.08, gain: 0.022, pan: -0.42 },
      { frequency: 390, duration: 0.05, type: 'triangle', gain: 0.042, pan: -0.26 },
      { frequency: 585, start: 0.045, duration: 0.07, type: 'triangle', gain: 0.042 },
      { frequency: 780, start: 0.11, duration: 0.13, type: 'sine', gain: 0.037, pan: 0.3, reverb: 0.25 },
    ],
    signalClear: [
      { source: 'noise', filterType: 'highpass', frequency: 1950, duration: 0.045, gain: 0.02, pan: -0.34 },
      { frequency: 430, duration: 0.045, type: 'triangle', gain: 0.043, pan: -0.2 },
      { frequency: 650, start: 0.04, duration: 0.065, type: 'sine', gain: 0.04 },
      { frequency: 860, start: 0.1, duration: 0.1, type: 'sine', gain: 0.034, pan: 0.28, reverb: 0.2 },
    ],
    railJunction: [
      { source: 'noise', filterType: 'bandpass', frequency: 980, q: 3, duration: 0.04, gain: 0.034, pan: -0.38 },
      { source: 'noise', filterType: 'bandpass', frequency: 1380, q: 3.2, start: 0.05, duration: 0.035, gain: 0.03, pan: 0.38 },
      { frequency: 330, endFrequency: 440, duration: 0.08, type: 'triangle', gain: 0.039, pan: -0.2 },
      { frequency: 660, endFrequency: 550, start: 0.06, duration: 0.1, type: 'sine', gain: 0.034, pan: 0.22, reverb: 0.18 },
    ],
    railTokenHandoff: [
      { source: 'noise', filterType: 'highpass', frequency: 2600, duration: 0.04, gain: 0.021, pan: -0.4 },
      { frequency: 520, duration: 0.04, type: 'square', gain: 0.035, pan: -0.24 },
      { frequency: 780, start: 0.038, duration: 0.055, type: 'triangle', gain: 0.038 },
      { frequency: 1040, start: 0.088, duration: 0.09, type: 'sine', gain: 0.032, pan: 0.26, reverb: 0.2 },
    ],
    railDelay: [
      { source: 'noise', filterType: 'highpass', frequency: 1800, duration: 0.04, gain: 0.024, pan: -0.36 },
      { frequency: 320, duration: 0.05, type: 'square', gain: 0.035, pan: -0.18 },
      { frequency: 320, start: 0.11, duration: 0.05, type: 'square', gain: 0.035, pan: 0.18 },
      { frequency: 160, start: 0.18, duration: 0.12, type: 'sine', gain: 0.03, pan: 0.3 },
    ],
    railStep: [
      { source: 'noise', filterType: 'bandpass', frequency: 920, q: 2.4, duration: 0.035, gain: 0.034, pan: -0.34 },
      { source: 'noise', filterType: 'bandpass', frequency: 1240, q: 2.8, start: 0.045, duration: 0.03, gain: 0.026, pan: 0.34 },
      { frequency: 240, duration: 0.04, type: 'triangle', gain: 0.042, pan: -0.18 },
      { frequency: 320, start: 0.04, duration: 0.045, type: 'triangle', gain: 0.038, pan: 0.2 },
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
    start: [
      { source: 'noise', filterType: 'bandpass', frequency: 520, q: 0.7, duration: 0.24, gain: 0.034, pan: -0.42 },
      { frequency: 72, endFrequency: 132, duration: 0.28, type: 'sawtooth', gain: 0.052, pan: -0.22 },
      { frequency: 330, start: 0.12, duration: 0.05, type: 'square', gain: 0.036, pan: 0.18 },
      { frequency: 660, start: 0.2, duration: 0.08, type: 'triangle', gain: 0.038, pan: 0.36 },
    ],
    logoAudit: [
      { source: 'noise', filterType: 'highpass', frequency: 1850, duration: 0.07, gain: 0.028, pan: -0.38 },
      { frequency: 740, endFrequency: 410, duration: 0.07, type: 'sawtooth', gain: 0.034, pan: -0.2 },
      { frequency: 520, start: 0.065, duration: 0.05, type: 'square', gain: 0.038 },
      { frequency: 780, start: 0.11, duration: 0.09, type: 'triangle', gain: 0.038, pan: 0.28 },
    ],
    logoAuditPerfect: [
      { source: 'noise', filterType: 'highpass', frequency: 2400, duration: 0.12, gain: 0.034, pan: -0.5, reverb: 0.14 },
      { frequency: 392, duration: 0.045, type: 'triangle', gain: 0.048, pan: -0.3 },
      { frequency: 588, start: 0.04, duration: 0.06, type: 'triangle', gain: 0.048, pan: -0.08 },
      { frequency: 784, start: 0.095, duration: 0.08, type: 'triangle', gain: 0.046, pan: 0.16 },
      { frequency: 1176, start: 0.17, duration: 0.18, type: 'sine', gain: 0.04, pan: 0.34, reverb: 0.22 },
    ],
    packApply: [
      { source: 'noise', filterType: 'bandpass', frequency: 1320, q: 1.8, duration: 0.08, gain: 0.03, pan: -0.38 },
      { frequency: 120, endFrequency: 210, duration: 0.12, type: 'sawtooth', gain: 0.042, pan: -0.18 },
      { frequency: 480, start: 0.08, duration: 0.05, type: 'square', gain: 0.038 },
      { frequency: 720, start: 0.125, duration: 0.09, type: 'triangle', gain: 0.038, pan: 0.3 },
    ],
    packClear: [
      { source: 'noise', filterType: 'lowpass', frequency: 620, duration: 0.14, gain: 0.034, pan: -0.3 },
      { frequency: 360, endFrequency: 170, duration: 0.16, type: 'sawtooth', gain: 0.044, pan: -0.12 },
      { frequency: 140, start: 0.12, duration: 0.12, type: 'sine', gain: 0.036, pan: 0.24 },
    ],
    packInvalid: [
      { source: 'noise', filterType: 'bandpass', frequency: 940, q: 3, duration: 0.16, gain: 0.042, pan: -0.4 },
      { frequency: 310, endFrequency: 230, duration: 0.08, type: 'square', gain: 0.048, pan: -0.18 },
      { frequency: 310, endFrequency: 210, start: 0.1, duration: 0.1, type: 'square', gain: 0.048, pan: 0.22 },
    ],
    raceCard: [
      { source: 'noise', filterType: 'highpass', frequency: 2100, duration: 0.09, gain: 0.032, pan: -0.44 },
      { frequency: 92, endFrequency: 180, duration: 0.18, type: 'sawtooth', gain: 0.05, pan: -0.22 },
      { frequency: 440, start: 0.08, duration: 0.045, type: 'square', gain: 0.038 },
      { frequency: 660, start: 0.12, duration: 0.06, type: 'square', gain: 0.04, pan: 0.18 },
      { frequency: 990, start: 0.18, duration: 0.11, type: 'triangle', gain: 0.038, pan: 0.36 },
    ],
    seasonCard: [
      { frequency: 390, duration: 0.04, type: 'square', gain: 0.042, pan: -0.35 },
      { frequency: 520, start: 0.045, duration: 0.04, type: 'square', gain: 0.042, pan: -0.16 },
      { frequency: 650, start: 0.09, duration: 0.04, type: 'square', gain: 0.042 },
      { frequency: 780, start: 0.135, duration: 0.05, type: 'square', gain: 0.042, pan: 0.18 },
      { source: 'noise', filterType: 'highpass', frequency: 2200, start: 0.18, duration: 0.1, gain: 0.032, pan: 0.42 },
      { frequency: 1170, start: 0.19, duration: 0.14, type: 'triangle', gain: 0.038, pan: 0.34 },
    ],
    dataPackReady: [
      { source: 'noise', filterType: 'bandpass', frequency: 1900, q: 0.7, duration: 0.34, gain: 0.04, pan: -0.55, reverb: 0.22 },
      { source: 'noise', filterType: 'bandpass', frequency: 2600, q: 0.8, start: 0.04, duration: 0.36, gain: 0.035, pan: 0.55, reverb: 0.22 },
      { frequency: 392, duration: 0.05, type: 'triangle', gain: 0.05, pan: -0.3 },
      { frequency: 588, start: 0.045, duration: 0.065, type: 'triangle', gain: 0.05, pan: -0.08 },
      { frequency: 784, start: 0.105, duration: 0.085, type: 'triangle', gain: 0.048, pan: 0.18 },
      { frequency: 1176, start: 0.19, duration: 0.2, type: 'sine', gain: 0.042, pan: 0.38, reverb: 0.26 },
    ],
    draftLoaded: [
      { source: 'noise', filterType: 'bandpass', frequency: 1550, q: 2.4, duration: 0.055, gain: 0.026, pan: -0.32 },
      { frequency: 460, duration: 0.045, type: 'square', gain: 0.036, pan: -0.16 },
      { frequency: 690, start: 0.042, duration: 0.065, type: 'triangle', gain: 0.038, pan: 0.18 },
      { frequency: 920, start: 0.1, duration: 0.09, type: 'sine', gain: 0.034, pan: 0.34 },
    ],
    raceSessionStart: [
      { source: 'noise', filterType: 'highpass', frequency: 2300, duration: 0.07, gain: 0.032, pan: -0.46, reverb: 0.12 },
      { source: 'noise', filterType: 'bandpass', frequency: 360, q: 0.9, start: 0.04, duration: 0.28, gain: 0.036, pan: -0.2 },
      { frequency: 294, duration: 0.05, type: 'square', gain: 0.045, pan: -0.28 },
      { frequency: 588, start: 0.08, duration: 0.07, type: 'triangle', gain: 0.043, pan: 0.1 },
      { frequency: 882, start: 0.15, duration: 0.11, type: 'sine', gain: 0.038, pan: 0.38 },
    ],
    raceSegment: [
      { source: 'noise', filterType: 'bandpass', frequency: 430, q: 1.1, duration: 0.18, gain: 0.036, pan: -0.38 },
      { frequency: 135, duration: 0.04, type: 'triangle', gain: 0.046, pan: -0.28 },
      { frequency: 165, start: 0.055, duration: 0.04, type: 'triangle', gain: 0.044, pan: 0.04 },
      { frequency: 195, start: 0.11, duration: 0.045, type: 'triangle', gain: 0.042, pan: 0.32 },
    ],
    raceOvertake: [
      { source: 'noise', filterType: 'highpass', frequency: 1900, duration: 0.08, gain: 0.028, pan: -0.45 },
      { frequency: 294, endFrequency: 520, duration: 0.1, type: 'sawtooth', gain: 0.044, pan: -0.28 },
      { frequency: 588, start: 0.085, duration: 0.08, type: 'triangle', gain: 0.046, pan: 0.08 },
      { frequency: 1176, start: 0.15, duration: 0.12, type: 'sine', gain: 0.038, pan: 0.38, reverb: 0.14 },
    ],
    raceBlocked: [
      { source: 'noise', filterType: 'lowpass', frequency: 560, duration: 0.16, gain: 0.048, pan: -0.34 },
      { frequency: 260, endFrequency: 145, duration: 0.14, type: 'square', gain: 0.046, pan: -0.12 },
      { frequency: 175, start: 0.1, duration: 0.14, type: 'sine', gain: 0.038, pan: 0.3 },
    ],
    raceFinalSpurt: [
      { source: 'noise', filterType: 'bandpass', frequency: 860, q: 0.9, duration: 0.32, gain: 0.04, pan: -0.48 },
      { frequency: 220, duration: 0.045, type: 'triangle', gain: 0.048, pan: -0.32 },
      { frequency: 330, start: 0.055, duration: 0.05, type: 'triangle', gain: 0.048, pan: -0.08 },
      { frequency: 495, start: 0.12, duration: 0.06, type: 'triangle', gain: 0.046, pan: 0.18 },
      { frequency: 742, start: 0.19, duration: 0.09, type: 'sine', gain: 0.04, pan: 0.4, reverb: 0.16 },
    ],
    raceFinish: [
      { source: 'noise', filterType: 'highpass', frequency: 2450, duration: 0.14, gain: 0.035, pan: -0.52, reverb: 0.2 },
      { source: 'noise', filterType: 'bandpass', frequency: 1750, q: 0.8, start: 0.04, duration: 0.28, gain: 0.027, pan: 0.5, reverb: 0.24 },
      { frequency: 392, duration: 0.05, type: 'triangle', gain: 0.05, pan: -0.34 },
      { frequency: 523, start: 0.045, duration: 0.065, type: 'triangle', gain: 0.05, pan: -0.1 },
      { frequency: 784, start: 0.105, duration: 0.085, type: 'triangle', gain: 0.048, pan: 0.18 },
      { frequency: 1176, start: 0.19, duration: 0.2, type: 'sine', gain: 0.042, pan: 0.4, reverb: 0.28 },
    ],
    raceStrategy: [
      { source: 'noise', filterType: 'bandpass', frequency: 1250, q: 2, duration: 0.05, gain: 0.026, pan: -0.3 },
      { frequency: 420, duration: 0.04, type: 'square', gain: 0.04, pan: -0.15 },
      { frequency: 630, start: 0.04, duration: 0.065, type: 'triangle', gain: 0.042, pan: 0.25 },
    ],
  },
};

THEME_CUE_PROFILES.starleague = {
  ...THEME_CUE_PROFILES.broadcast,
  accent: [
    ...THEME_CUE_PROFILES.broadcast.accent,
    { source: 'noise', filterType: 'bandpass', frequency: 1450, q: 0.65, duration: 0.12, gain: 0.012, pan: -0.56, reverb: 0.3 },
    { source: 'noise', filterType: 'bandpass', frequency: 2050, q: 0.72, start: 0.025, duration: 0.13, gain: 0.011, pan: 0.56, reverb: 0.3 },
  ],
  match: [
    ...THEME_CUE_PROFILES.broadcast.match,
    { frequency: 1176, start: 0.2, duration: 0.13, type: 'sine', gain: 0.024, pan: 0.38, reverb: 0.34 },
  ],
  starleagueRush: [
    { source: 'noise', filterType: 'highpass', frequency: 980, q: 0.7, duration: 0.09, gain: 0.018, pan: -0.35 },
    { frequency: 180, endFrequency: 420, duration: 0.12, type: 'sawtooth', gain: 0.044, pan: -0.2 },
    { frequency: 740, start: 0.055, duration: 0.09, type: 'square', gain: 0.028, pan: 0.3, reverb: 0.16 },
  ],
  starleagueHarass: [
    { frequency: 880, duration: 0.055, type: 'triangle', gain: 0.035, pan: -0.52 },
    { frequency: 1176, start: 0.07, duration: 0.055, type: 'triangle', gain: 0.033, pan: 0.52 },
    { frequency: 988, start: 0.14, duration: 0.08, type: 'sine', gain: 0.027, pan: -0.18, reverb: 0.24 },
  ],
  starleagueTech: [
    { frequency: 392, duration: 0.12, type: 'sine', gain: 0.032, pan: -0.28, reverb: 0.28 },
    { frequency: 784, start: 0.055, duration: 0.14, type: 'triangle', gain: 0.032, pan: 0.22, reverb: 0.34 },
    { frequency: 1568, start: 0.14, duration: 0.16, type: 'sine', gain: 0.023, pan: 0.42, reverb: 0.4 },
  ],
  starleagueMacro: [
    { frequency: 196, endFrequency: 220, duration: 0.18, type: 'triangle', gain: 0.04, pan: -0.22 },
    { frequency: 392, start: 0.07, duration: 0.15, type: 'sine', gain: 0.032, pan: 0.05, reverb: 0.24 },
    { frequency: 587, start: 0.15, duration: 0.17, type: 'sine', gain: 0.026, pan: 0.34, reverb: 0.32 },
  ],
  starleagueBalanced: [
    { source: 'noise', filterType: 'bandpass', frequency: 760, q: 1.4, duration: 0.07, gain: 0.015, pan: 0 },
    { frequency: 294, duration: 0.13, type: 'triangle', gain: 0.038, pan: -0.24 },
    { frequency: 440, start: 0.045, duration: 0.14, type: 'triangle', gain: 0.034, pan: 0.24, reverb: 0.22 },
  ],
  replay: [
    { source: 'noise', filterType: 'bandpass', frequency: 1500, q: 1.8, duration: 0.12, gain: 0.014, pan: 0.42 },
    { frequency: 1046, endFrequency: 523, duration: 0.16, type: 'sine', gain: 0.03, pan: 0.28, reverb: 0.22 },
    { frequency: 659, start: 0.13, duration: 0.1, type: 'triangle', gain: 0.028, pan: -0.28, reverb: 0.3 },
  ],
  comeback: [
    ...THEME_CUE_PROFILES.broadcast.comeback,
    { frequency: 1568, start: 0.31, duration: 0.18, type: 'sine', gain: 0.022, pan: 0.4, reverb: 0.36 },
  ],
  victory: [
    ...THEME_CUE_PROFILES.broadcast.victory,
    { frequency: 1568, start: 0.31, duration: 0.22, type: 'sine', gain: 0.024, pan: 0.42, reverb: 0.38 },
  ],
  defeat: [
    ...THEME_CUE_PROFILES.broadcast.defeat,
    { source: 'noise', filterType: 'lowpass', frequency: 260, start: 0.08, duration: 0.28, gain: 0.018, pan: 0.34, reverb: 0.28 },
  ],
  champion: [
    ...THEME_CUE_PROFILES.broadcast.champion,
    { frequency: 1764, start: 0.48, duration: 0.3, type: 'sine', gain: 0.024, pan: 0.44, reverb: 0.42 },
  ],
};

const THEME_SPATIAL_MIXES = {
  default: { panSpread: 0.24, reverb: 0.1 },
  battle: { panSpread: 0.34, reverb: 0.08 },
  eternal: { panSpread: 0.5, reverb: 0.2 },
  twenty: { panSpread: 0.18, reverb: 0.2 },
  card: { panSpread: 0.42, reverb: 0.14 },
  'academy-duel': { panSpread: 0.56, reverb: 0.2 },
  vanguard: { panSpread: 0.52, reverb: 0.18 },
  survival: { panSpread: 0.28, reverb: 0.18 },
  civilization: { panSpread: 0.4, reverb: 0.24 },
  kitchen: { panSpread: 0.3, reverb: 0.11 },
  idle: { panSpread: 0.4, reverb: 0.23 },
  tactical: { panSpread: 0.52, reverb: 0.15 },
  broadcast: { panSpread: 0.3, reverb: 0.19 },
  starleague: { panSpread: 0.46, reverb: 0.26 },
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
