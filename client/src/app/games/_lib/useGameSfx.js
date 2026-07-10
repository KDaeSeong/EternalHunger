'use client';

import { useCallback, useMemo, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { inferGameActionSemantic } from './gameActionSemantics';

const GAME_SFX_PATH_THEMES = [
  ['eternalhunger', 'battle'],
  ['twenty-questions', 'twenty'],
  ['dual-academy-tcg', 'card'],
  ['ba-vanguard', 'card'],
  ['primitive-archive', 'survival'],
  ['tonkatsu-teacher', 'kitchen'],
  ['schale-idle-rpg', 'idle'],
  ['ba-srpg', 'tactical'],
  ['myanimecraft', 'broadcast'],
  ['school-simulator', 'school'],
  ['si-coding-sim', 'coding'],
  ['rail3d-sim', 'rail'],
  ['company-report', 'ledger'],
  ['racing-logos-demo', 'racing'],
];

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
  archive: [
    { frequency: 460, duration: 0.04, type: 'triangle', gain: 0.06 },
    { frequency: 620, start: 0.038, duration: 0.055, type: 'triangle', gain: 0.05 },
    { frequency: 820, start: 0.082, duration: 0.075, type: 'sine', gain: 0.04 },
  ],
  gather: [
    { source: 'noise', filterType: 'bandpass', frequency: 820, q: 1.4, duration: 0.055, gain: 0.075 },
    { frequency: 260, endFrequency: 210, duration: 0.075, type: 'triangle', gain: 0.065 },
  ],
  combat: [
    { source: 'noise', filterType: 'lowpass', frequency: 900, duration: 0.07, gain: 0.085 },
    { frequency: 210, endFrequency: 125, duration: 0.105, type: 'sawtooth', gain: 0.055 },
  ],
  craft: [
    { frequency: 560, endFrequency: 430, duration: 0.045, type: 'square', gain: 0.04 },
    { frequency: 1120, start: 0.035, duration: 0.065, type: 'triangle', gain: 0.045 },
  ],
  consume: [
    { frequency: 420, endFrequency: 560, duration: 0.07, type: 'sine', gain: 0.06 },
  ],
  rest: [
    { frequency: 520, endFrequency: 310, duration: 0.13, type: 'sine', gain: 0.055 },
  ],
  research: [
    { frequency: 480, duration: 0.04, type: 'sine', gain: 0.055 },
    { frequency: 720, start: 0.038, duration: 0.055, type: 'sine', gain: 0.05 },
    { frequency: 960, start: 0.086, duration: 0.075, type: 'sine', gain: 0.04 },
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
  advance: [
    { frequency: 430, endFrequency: 620, duration: 0.075, type: 'triangle', gain: 0.06 },
    { frequency: 860, start: 0.06, duration: 0.07, type: 'sine', gain: 0.045 },
  ],
  dispatch: [
    { source: 'noise', filterType: 'highpass', frequency: 1600, duration: 0.04, gain: 0.055 },
    { frequency: 310, duration: 0.055, type: 'triangle', gain: 0.06 },
    { frequency: 390, start: 0.052, duration: 0.065, type: 'triangle', gain: 0.05 },
  ],
  code: [
    { frequency: 520, duration: 0.028, type: 'square', gain: 0.035 },
    { frequency: 780, start: 0.032, duration: 0.035, type: 'square', gain: 0.03 },
    { frequency: 1040, start: 0.07, duration: 0.055, type: 'triangle', gain: 0.035 },
  ],
  event: [
    { frequency: 680, endFrequency: 940, duration: 0.065, type: 'sawtooth', gain: 0.04 },
    { frequency: 1240, start: 0.055, duration: 0.075, type: 'sine', gain: 0.035 },
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

function resolveGameSfxTheme(theme, pathname) {
  const explicit = String(theme || '').trim();
  if (explicit && explicit !== 'auto') return explicit;
  const path = String(pathname || '').toLowerCase();
  const found = GAME_SFX_PATH_THEMES.find(([needle]) => path.includes(needle));
  return found?.[1] || 'default';
}

function cueProfile(cue, theme) {
  const key = String(cue || 'click');
  const themeKey = String(theme || 'default');
  const themedProfile = THEME_CUE_PROFILES[themeKey]?.[key];
  if (themedProfile) return themedProfile;
  const baseProfile = CUE_PROFILES[key] || CUE_PROFILES.click;
  const accentProfile = key === 'click' ? [] : (THEME_CUE_PROFILES[themeKey]?.accent || []);
  return [...baseProfile, ...accentProfile];
}

function getAudioContext() {
  if (typeof window === 'undefined') return null;
  const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextCtor) return null;
  return AudioContextCtor;
}

function playNoiseVoice(ctx, spec, volume) {
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
  gain.connect(ctx.destination);
  source.start(start);
  source.stop(end + 0.01);
}

function playVoice(ctx, spec, volume) {
  if (spec.source === 'noise') {
    playNoiseVoice(ctx, spec, volume);
    return;
  }
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
  gain.connect(ctx.destination);
  oscillator.start(start);
  oscillator.stop(end + 0.025);
}

export default function useGameSfx({ enabled = true, theme = 'auto', volume = 0.16 } = {}) {
  const pathname = usePathname();
  const contextRef = useRef(null);
  const lastPlayedAtRef = useRef(0);
  const resolvedTheme = useMemo(() => resolveGameSfxTheme(theme, pathname), [pathname, theme]);

  return useCallback((cue = 'click') => {
    if (!enabled) return;
    const nowMs = Date.now();
    if (nowMs - lastPlayedAtRef.current < 28) return;
    lastPlayedAtRef.current = nowMs;

    try {
      const AudioContextCtor = getAudioContext();
      if (!AudioContextCtor) return;
      if (!contextRef.current) contextRef.current = new AudioContextCtor();
      const ctx = contextRef.current;
      if (ctx.state === 'suspended') void ctx.resume();

      const profile = cueProfile(cue, resolvedTheme);
      profile.forEach((spec) => playVoice(ctx, spec, volume));
    } catch {
      // Audio failures should never block gameplay.
    }
  }, [enabled, resolvedTheme, volume]);
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
