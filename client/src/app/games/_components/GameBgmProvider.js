'use client';

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
} from 'react';
import { usePathname } from 'next/navigation';
import { gameAudioThemeForPath } from '../_lib/gameAudioThemes';
import {
  DEFAULT_GAME_BGM_VOLUME,
  GAME_BGM_DUCK_EVENT,
  GAME_BGM_ENABLED_KEY,
  GAME_BGM_PREFERENCE_EVENT,
  GAME_BGM_VOLUME_KEY,
  normalizeGameBgmVolume,
  readGameBgmEnabled,
  readGameBgmVolume,
  writeGameBgmEnabled,
  writeGameBgmVolume,
} from '../_lib/gameBgmPreferences';
import {
  gameBgmArrangementState,
  gameBgmChordRoot,
  gameBgmNoteFrequency,
  gameBgmProfile,
  gameBgmStepDuration,
} from '../_lib/gameBgmProfiles';

const GameBgmContext = createContext(null);
const LOOK_AHEAD_SECONDS = 0.38;
const SCHEDULER_INTERVAL_MS = 75;
const MASTER_GAIN = 0.085;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, Number(value || 0)));
}

function audioContextConstructor() {
  if (typeof window === 'undefined') return null;
  return window.AudioContext || window.webkitAudioContext || null;
}

function deterministicNoise(index) {
  const value = Math.sin((index + 1) * 12.9898) * 43758.5453;
  return (value - Math.floor(value)) * 2 - 1;
}

function createNoiseBuffer(ctx, seconds = 1) {
  const frameCount = Math.max(1, Math.ceil(ctx.sampleRate * seconds));
  const buffer = ctx.createBuffer(1, frameCount, ctx.sampleRate);
  const samples = buffer.getChannelData(0);
  for (let index = 0; index < frameCount; index += 1) {
    samples[index] = deterministicNoise(index);
  }
  return buffer;
}

function createImpulseResponse(ctx, seconds = 1.8, decay = 2.7) {
  const frameCount = Math.max(1, Math.ceil(ctx.sampleRate * seconds));
  const buffer = ctx.createBuffer(2, frameCount, ctx.sampleRate);
  for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
    const samples = buffer.getChannelData(channel);
    for (let index = 0; index < frameCount; index += 1) {
      const envelope = (1 - index / frameCount) ** decay;
      samples[index] = deterministicNoise(index + channel * 977) * envelope;
    }
  }
  return buffer;
}

function connectPannedVoice(ctx, sourceGain, destination, pan = 0) {
  if (typeof ctx.createStereoPanner !== 'function') {
    sourceGain.connect(destination);
    return null;
  }
  const panner = ctx.createStereoPanner();
  panner.pan.setValueAtTime(clamp(pan, -1, 1), ctx.currentTime);
  sourceGain.connect(panner);
  panner.connect(destination);
  return panner;
}

function scheduleTone({
  ctx,
  destination,
  frequency,
  endFrequency,
  start,
  duration,
  gainValue,
  wave,
  sources,
  attack = 0.018,
  releaseStartRatio = 0.7,
  detune = 0,
  pan = 0,
}) {
  if (!Number.isFinite(frequency) || frequency <= 0 || duration <= 0) return;
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();
  const attackEnd = start + Math.min(Math.max(0.003, attack), duration * 0.32);
  const releaseStart = start + Math.max(attack + 0.004, duration * clamp(releaseStartRatio, 0.35, 0.92));
  const end = start + duration;
  const panner = connectPannedVoice(ctx, gain, destination, pan);

  oscillator.type = wave || 'sine';
  oscillator.frequency.setValueAtTime(Math.min(6200, Math.max(30, frequency)), start);
  oscillator.detune.setValueAtTime(Number(detune || 0), start);
  if (Number(endFrequency) > 0) {
    oscillator.frequency.exponentialRampToValueAtTime(
      Math.min(6200, Math.max(30, Number(endFrequency))),
      end,
    );
  }
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, gainValue), attackEnd);
  gain.gain.setValueAtTime(Math.max(0.0002, gainValue), releaseStart);
  gain.gain.exponentialRampToValueAtTime(0.0001, end);

  oscillator.connect(gain);
  sources.add(oscillator);
  oscillator.onended = () => {
    sources.delete(oscillator);
    oscillator.disconnect();
    gain.disconnect();
    panner?.disconnect();
  };
  oscillator.start(start);
  oscillator.stop(end + 0.025);
}

function scheduleNoise({
  ctx,
  destination,
  noiseBuffer,
  start,
  duration,
  gainValue,
  sources,
  filterType = 'bandpass',
  frequency = 1200,
  q = 1,
  pan = 0,
}) {
  if (!noiseBuffer || duration <= 0) return;
  const source = ctx.createBufferSource();
  const filter = ctx.createBiquadFilter();
  const gain = ctx.createGain();
  const end = start + duration;
  const panner = connectPannedVoice(ctx, gain, destination, pan);

  source.buffer = noiseBuffer;
  filter.type = filterType;
  filter.frequency.setValueAtTime(Math.max(80, Number(frequency || 1200)), start);
  filter.Q.setValueAtTime(Math.max(0.1, Number(q || 1)), start);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, gainValue), start + 0.004);
  gain.gain.exponentialRampToValueAtTime(0.0001, end);
  source.connect(filter);
  filter.connect(gain);
  sources.add(source);
  source.onended = () => {
    sources.delete(source);
    source.disconnect();
    filter.disconnect();
    gain.disconnect();
    panner?.disconnect();
  };
  source.start(start);
  source.stop(end + 0.015);
}

function scheduleKick(session, start, velocity) {
  scheduleTone({
    ctx: session.ctx,
    destination: session.gain,
    frequency: 135,
    endFrequency: 43,
    start,
    duration: 0.14,
    gainValue: velocity,
    wave: 'sine',
    sources: session.sources,
    attack: 0.003,
    releaseStartRatio: 0.3,
  });
}

function scheduleSnare(session, start, velocity) {
  scheduleNoise({
    ctx: session.ctx,
    destination: session.gain,
    noiseBuffer: session.noiseBuffer,
    start,
    duration: 0.105,
    gainValue: velocity,
    sources: session.sources,
    filterType: 'bandpass',
    frequency: 1650,
    q: 0.8,
    pan: 0.04,
  });
  scheduleTone({
    ctx: session.ctx,
    destination: session.gain,
    frequency: 190,
    endFrequency: 145,
    start,
    duration: 0.075,
    gainValue: velocity * 0.38,
    wave: 'triangle',
    sources: session.sources,
    attack: 0.003,
    releaseStartRatio: 0.35,
  });
}

function scheduleHat(session, start, velocity, stepIndex) {
  scheduleNoise({
    ctx: session.ctx,
    destination: session.gain,
    noiseBuffer: session.noiseBuffer,
    start,
    duration: stepIndex % 4 === 2 ? 0.058 : 0.035,
    gainValue: velocity,
    sources: session.sources,
    filterType: 'highpass',
    frequency: 4800,
    q: 0.65,
    pan: stepIndex % 2 ? 0.18 : -0.18,
  });
}

function schedulePerc(session, start, velocity, stepIndex) {
  const high = stepIndex % 4 === 3;
  scheduleTone({
    ctx: session.ctx,
    destination: session.gain,
    frequency: high ? 520 : 310,
    endFrequency: high ? 390 : 235,
    start,
    duration: 0.055,
    gainValue: velocity,
    wave: 'triangle',
    sources: session.sources,
    attack: 0.003,
    releaseStartRatio: 0.42,
    pan: high ? 0.25 : -0.25,
  });
}

function scheduleDrumStep(session, arrangement, start) {
  const { profile } = session;
  const step = arrangement.patternStep;
  const sectionLevel = Number(arrangement.section.drums || 0);
  const energy = Number(arrangement.section.energy || 1);
  const baseGain = Number(profile.drumGain || 0.1) * sectionLevel * Math.min(1.15, energy);
  const kick = Number(profile.drums.kick[step] || 0);
  const snare = Number(profile.drums.snare[step] || 0);
  const hat = Number(profile.drums.hat[step] || 0);
  const perc = Number(profile.drums.perc[step] || 0);

  if (kick > 0) scheduleKick(session, start, baseGain * kick);
  if (snare > 0) scheduleSnare(session, start, baseGain * snare * 0.82);
  if (hat > 0) scheduleHat(session, start, baseGain * hat * 0.42, step);
  if (perc > 0) schedulePerc(session, start, baseGain * perc * 0.55, step);

  const fillWindow = arrangement.section.fill
    && arrangement.sectionStep >= arrangement.sectionSteps - 16
    && step >= 10;
  if (fillWindow && [10, 12, 14, 15].includes(step)) {
    schedulePerc(session, start, baseGain * (0.38 + step * 0.025), step + 1);
  }
}

function scheduleChord(session, chordRoot, start, duration, energy) {
  const { profile } = session;
  profile.chordVoicing.forEach((offset, voiceIndex) => {
    scheduleTone({
      ctx: session.ctx,
      destination: session.gain,
      frequency: gameBgmNoteFrequency(profile, chordRoot + offset, voiceIndex === 0 ? 0 : 1),
      start: start + voiceIndex * 0.014,
      duration,
      gainValue: Number(profile.padGain || 0.025) * energy,
      wave: 'sine',
      sources: session.sources,
      attack: Math.min(0.11, duration * 0.16),
      releaseStartRatio: 0.78,
      detune: voiceIndex === 1 ? -4 : voiceIndex === 2 ? 4 : 0,
      pan: (voiceIndex - (profile.chordVoicing.length - 1) / 2) * 0.22,
    });
  });
}

function scheduleMusicStep(session, absoluteStep, start) {
  const { filter, profile } = session;
  const stepDuration = gameBgmStepDuration(profile);
  const arrangement = gameBgmArrangementState(profile, absoluteStep);
  const step = arrangement.patternStep;
  const section = arrangement.section;
  const energy = Number(section.energy || 1);
  const swingOffset = step % 2 ? stepDuration * clamp(profile.swing, 0, 0.2) : 0;
  const noteStart = start + swingOffset;
  const chordRoot = gameBgmChordRoot(profile, arrangement);

  if (session.sectionId !== section.id) {
    session.sectionId = section.id;
    const sectionFilter = Number(profile.filterFrequency || 1800) * (0.78 + energy * 0.28);
    filter.frequency.setTargetAtTime(sectionFilter, start, 0.16);
    filter.Q.setTargetAtTime(Number(profile.filterPeak || 0.65), start, 0.12);
    if (typeof document !== 'undefined') {
      document.documentElement.dataset.gameBgmSection = section.id;
    }
  }

  if (section.pad && step === 0) {
    scheduleChord(session, chordRoot, start, stepDuration * 15.65, energy);
  }

  if (section.arp) {
    const arpDegree = profile.arp[step];
    if (arpDegree !== null && arpDegree !== undefined) {
      scheduleTone({
        ctx: session.ctx,
        destination: session.gain,
        frequency: gameBgmNoteFrequency(profile, chordRoot + Number(arpDegree), profile.arpOctave),
        start: noteStart,
        duration: stepDuration * Number(profile.arpLength || 0.72),
        gainValue: Number(profile.arpGain || 0.038) * energy,
        wave: profile.arpWave,
        sources: session.sources,
        attack: 0.006,
        releaseStartRatio: 0.52,
        pan: step % 2 ? 0.32 : -0.32,
      });
    }
  }

  if (section.bass) {
    const bassDegree = profile.bass[step];
    if (bassDegree !== null && bassDegree !== undefined) {
      scheduleTone({
        ctx: session.ctx,
        destination: session.gain,
        frequency: gameBgmNoteFrequency(profile, bassDegree, profile.bassOctave),
        start,
        duration: stepDuration * 3.55,
        gainValue: Number(profile.bassGain || 0.105) * energy,
        wave: profile.bassWave,
        sources: session.sources,
        attack: 0.012,
        releaseStartRatio: 0.75,
        pan: -0.04,
      });
    }
  }

  const leadPattern = section.lead === 'b' ? profile.leadB : profile.lead;
  const leadDegree = section.lead ? leadPattern[step] : null;
  if (leadDegree !== null && leadDegree !== undefined) {
    scheduleTone({
      ctx: session.ctx,
      destination: session.gain,
      frequency: gameBgmNoteFrequency(profile, leadDegree, profile.leadOctave),
      start: noteStart,
      duration: stepDuration * Number(profile.leadLength || 1.85),
      gainValue: Number(profile.leadGain || 0.12) * energy,
      wave: profile.leadWave,
      sources: session.sources,
      attack: 0.012,
      releaseStartRatio: 0.68,
      pan: -0.12,
    });
  }

  const counterDegree = section.counter ? profile.counter[step] : null;
  if (counterDegree !== null && counterDegree !== undefined) {
    scheduleTone({
      ctx: session.ctx,
      destination: session.gain,
      frequency: gameBgmNoteFrequency(profile, counterDegree, profile.counterOctave),
      start: noteStart + stepDuration * 0.08,
      duration: stepDuration * Number(profile.counterLength || 1.35),
      gainValue: Number(profile.counterGain || 0.052) * energy,
      wave: profile.counterWave,
      sources: session.sources,
      attack: 0.014,
      releaseStartRatio: 0.7,
      pan: 0.22,
    });
  }

  if (energy >= 0.9 && step === 8) {
    scheduleChord(session, chordRoot, noteStart, stepDuration * 1.55, energy * 0.46);
  }

  scheduleDrumStep(session, arrangement, noteStart);
}

function disconnectSessionBus(session) {
  ['gain', 'filter', 'delaySend', 'reverbSend'].forEach((key) => {
    try {
      session?.[key]?.disconnect();
    } catch {
      // A node may already be disconnected during a route transition.
    }
  });
}

function stopSession(session, fadeSeconds = 0.22) {
  if (!session) return;
  if (session.timer) window.clearTimeout(session.timer);
  const now = session.ctx.currentTime;
  session.gain.gain.cancelScheduledValues(now);
  session.gain.gain.setValueAtTime(Math.max(0.0001, session.gain.gain.value), now);
  session.gain.gain.exponentialRampToValueAtTime(0.0001, now + fadeSeconds);
  window.setTimeout(() => {
    session.sources.forEach((source) => {
      try {
        source.stop();
      } catch {
        // A scheduled source may have already ended naturally.
      }
    });
    session.sources.clear();
    disconnectSessionBus(session);
  }, Math.ceil(fadeSeconds * 1000) + 40);
}

function createAudioGraph(volume) {
  const AudioContextCtor = audioContextConstructor();
  if (!AudioContextCtor) return null;
  const ctx = new AudioContextCtor();
  const dry = ctx.createGain();
  const delayInput = ctx.createGain();
  const delay = ctx.createDelay(1.2);
  const delayFeedback = ctx.createGain();
  const delayWet = ctx.createGain();
  const reverbInput = ctx.createGain();
  const convolver = ctx.createConvolver();
  const reverbWet = ctx.createGain();
  const master = ctx.createGain();
  const compressor = ctx.createDynamicsCompressor();

  dry.gain.setValueAtTime(0.92, ctx.currentTime);
  delay.delayTime.setValueAtTime(0.24, ctx.currentTime);
  delayFeedback.gain.setValueAtTime(0.2, ctx.currentTime);
  delayWet.gain.setValueAtTime(0.72, ctx.currentTime);
  convolver.buffer = createImpulseResponse(ctx);
  reverbWet.gain.setValueAtTime(0.78, ctx.currentTime);
  master.gain.setValueAtTime(MASTER_GAIN * normalizeGameBgmVolume(volume), ctx.currentTime);
  compressor.threshold.setValueAtTime(-25, ctx.currentTime);
  compressor.knee.setValueAtTime(16, ctx.currentTime);
  compressor.ratio.setValueAtTime(4.5, ctx.currentTime);
  compressor.attack.setValueAtTime(0.009, ctx.currentTime);
  compressor.release.setValueAtTime(0.24, ctx.currentTime);

  dry.connect(master);
  delayInput.connect(delay);
  delay.connect(delayFeedback);
  delayFeedback.connect(delay);
  delay.connect(delayWet);
  delayWet.connect(master);
  reverbInput.connect(convolver);
  convolver.connect(reverbWet);
  reverbWet.connect(master);
  master.connect(compressor);
  compressor.connect(ctx.destination);
  return {
    compressor,
    convolver,
    ctx,
    delay,
    delayFeedback,
    delayInput,
    dry,
    master,
    noiseBuffer: createNoiseBuffer(ctx),
    reverbInput,
  };
}

function createSession(graph, profile, theme, startTime) {
  const gain = graph.ctx.createGain();
  const filter = graph.ctx.createBiquadFilter();
  const delaySend = graph.ctx.createGain();
  const reverbSend = graph.ctx.createGain();
  gain.gain.setValueAtTime(0.0001, startTime);
  gain.gain.exponentialRampToValueAtTime(1, startTime + 0.42);
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(Number(profile.filterFrequency || 1800), startTime);
  filter.Q.setValueAtTime(Number(profile.filterPeak || 0.65), startTime);
  delaySend.gain.setValueAtTime(Number(profile.delayMix || 0.055), startTime);
  reverbSend.gain.setValueAtTime(Number(profile.reverbMix || 0.065), startTime);
  gain.connect(filter);
  filter.connect(graph.dry);
  filter.connect(delaySend);
  delaySend.connect(graph.delayInput);
  filter.connect(reverbSend);
  reverbSend.connect(graph.reverbInput);
  return {
    ctx: graph.ctx,
    delaySend,
    filter,
    gain,
    nextStep: 0,
    nextTime: startTime + 0.08,
    noiseBuffer: graph.noiseBuffer,
    profile,
    reverbSend,
    sectionId: '',
    sources: new Set(),
    theme,
    timer: null,
  };
}

function createGameBgmController() {
  let graph = null;
  let session = null;
  let volume = DEFAULT_GAME_BGM_VOLUME;
  let visible = true;
  let duckMultiplier = 1;
  let duckTimer = null;

  const rampMaster = (fadeSeconds = 0.08) => {
    if (!graph) return;
    const now = graph.ctx.currentTime;
    const target = visible ? MASTER_GAIN * volume * duckMultiplier : 0;
    graph.master.gain.cancelScheduledValues(now);
    graph.master.gain.setValueAtTime(Math.max(0.0001, graph.master.gain.value), now);
    graph.master.gain.exponentialRampToValueAtTime(Math.max(0.0001, target), now + fadeSeconds);
  };

  const setMasterVolume = (nextVolume, fadeSeconds = 0.08) => {
    volume = normalizeGameBgmVolume(nextVolume);
    rampMaster(fadeSeconds);
  };

  const stop = () => {
    stopSession(session);
    session = null;
    if (typeof document !== 'undefined') {
      document.documentElement.dataset.gameBgmState = 'paused';
      delete document.documentElement.dataset.gameBgmTheme;
      delete document.documentElement.dataset.gameBgmSection;
    }
  };

  const start = (theme) => {
    const nextTheme = String(theme || '').trim();
    if (!nextTheme) return false;
    if (session?.theme === nextTheme) return true;
    if (!graph || graph.ctx.state === 'closed') {
      try {
        graph = createAudioGraph(volume);
      } catch {
        graph = null;
      }
    }
    if (!graph) return false;

    stopSession(session, 0.26);
    const profile = gameBgmProfile(nextTheme);
    const now = graph.ctx.currentTime;
    graph.delay.delayTime.setTargetAtTime(Number(profile.delayTime || 0.24), now, 0.08);
    graph.delayFeedback.gain.setTargetAtTime(Number(profile.delayFeedback || 0.2), now, 0.08);
    const nextSession = createSession(graph, profile, nextTheme, now);
    session = nextSession;

    const pump = () => {
      if (session !== nextSession || graph.ctx.state === 'closed') return;
      while (nextSession.nextTime < graph.ctx.currentTime + LOOK_AHEAD_SECONDS) {
        scheduleMusicStep(nextSession, nextSession.nextStep, nextSession.nextTime);
        nextSession.nextStep = (nextSession.nextStep + 1) % Number(profile.steps || 256);
        nextSession.nextTime += gameBgmStepDuration(profile);
      }
      nextSession.timer = window.setTimeout(pump, SCHEDULER_INTERVAL_MS);
    };

    try {
      const activeContext = graph.ctx;
      activeContext.onstatechange = () => {
        document.documentElement.dataset.gameBgmContext = activeContext.state;
      };
      document.documentElement.dataset.gameBgmContext = activeContext.state;
      void activeContext.resume()
        .then(() => {
          document.documentElement.dataset.gameBgmContext = activeContext.state;
        })
        .catch(() => {});
      pump();
      setMasterVolume(volume, 0.16);
      document.documentElement.dataset.gameBgmState = 'playing';
      document.documentElement.dataset.gameBgmTheme = nextTheme;
      return true;
    } catch {
      stopSession(nextSession);
      session = null;
      return false;
    }
  };

  return {
    destroy() {
      stopSession(session, 0.05);
      session = null;
      if (duckTimer) window.clearTimeout(duckTimer);
      duckTimer = null;
      const currentGraph = graph;
      graph = null;
      if (currentGraph && currentGraph.ctx.state !== 'closed') void currentGraph.ctx.close();
      if (typeof document !== 'undefined') {
        delete document.documentElement.dataset.gameBgmContext;
        delete document.documentElement.dataset.gameBgmDuck;
        delete document.documentElement.dataset.gameBgmDuckAt;
      }
    },
    duck(durationMs = 260, multiplier = 0.45) {
      if (!graph || !visible) return;
      duckMultiplier = clamp(multiplier, 0.18, 0.85);
      rampMaster(0.025);
      document.documentElement.dataset.gameBgmDuck = 'active';
      document.documentElement.dataset.gameBgmDuckAt = String(Date.now());
      if (duckTimer) window.clearTimeout(duckTimer);
      duckTimer = window.setTimeout(() => {
        duckMultiplier = 1;
        rampMaster(0.16);
        delete document.documentElement.dataset.gameBgmDuck;
        duckTimer = null;
      }, Math.max(100, Number(durationMs || 260)));
    },
    hasAudioGraph: () => Boolean(graph && graph.ctx.state !== 'closed'),
    isPlayingTheme: (theme) => session?.theme === theme,
    setMasterVolume,
    setVisible(nextVisible) {
      visible = Boolean(nextVisible);
      rampMaster(visible ? 0.28 : 0.16);
    },
    start,
    stop,
  };
}

function subscribeGameBgmPreferences(notify) {
  if (typeof window === 'undefined') return () => {};
  const handlePreference = () => notify();
  const handleStorage = (event) => {
    if (event.key === GAME_BGM_ENABLED_KEY || event.key === GAME_BGM_VOLUME_KEY) notify();
  };
  window.addEventListener(GAME_BGM_PREFERENCE_EVENT, handlePreference);
  window.addEventListener('storage', handleStorage);
  return () => {
    window.removeEventListener(GAME_BGM_PREFERENCE_EVENT, handlePreference);
    window.removeEventListener('storage', handleStorage);
  };
}

function serverBgmEnabledSnapshot() {
  return false;
}

function serverBgmVolumeSnapshot() {
  return DEFAULT_GAME_BGM_VOLUME;
}

const FALLBACK_BGM_VALUE = Object.freeze({
  activeTheme: '',
  enabled: false,
  isAvailable: false,
  label: '',
  playing: false,
  setVolume: () => DEFAULT_GAME_BGM_VOLUME,
  toggleMusic: () => false,
  volume: DEFAULT_GAME_BGM_VOLUME,
});

export function useGameBgm() {
  return useContext(GameBgmContext) || FALLBACK_BGM_VALUE;
}

export default function GameBgmProvider({ children }) {
  const pathname = usePathname();
  const activeTheme = gameAudioThemeForPath(pathname);
  const [controller] = useState(createGameBgmController);
  const enabled = useSyncExternalStore(
    subscribeGameBgmPreferences,
    readGameBgmEnabled,
    serverBgmEnabledSnapshot,
  );
  const volume = useSyncExternalStore(
    subscribeGameBgmPreferences,
    readGameBgmVolume,
    serverBgmVolumeSnapshot,
  );
  const activeProfile = gameBgmProfile(activeTheme);

  const setVolume = (nextVolume) => {
    const next = writeGameBgmVolume(nextVolume);
    controller.setMasterVolume(next);
    window.dispatchEvent(new CustomEvent(GAME_BGM_PREFERENCE_EVENT, {
      detail: { enabled: readGameBgmEnabled(), volume: next },
    }));
    return next;
  };

  const toggleMusic = () => {
    const next = writeGameBgmEnabled(!enabled);
    window.dispatchEvent(new CustomEvent(GAME_BGM_PREFERENCE_EVENT, {
      detail: { enabled: next, volume },
    }));
    if (next && activeTheme) controller.start(activeTheme);
    else controller.stop();
    return next;
  };

  useEffect(() => {
    controller.setMasterVolume(volume);
  }, [controller, volume]);

  useEffect(() => {
    if (!enabled || !activeTheme) {
      controller.stop();
      return undefined;
    }
    if (controller.hasAudioGraph()) {
      if (!controller.isPlayingTheme(activeTheme)) controller.start(activeTheme);
      return undefined;
    }

    const unlock = () => controller.start(activeTheme);
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, [activeTheme, controller, enabled]);

  useEffect(() => {
    const handleVisibility = () => {
      controller.setVisible(!document.hidden && enabled);
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [controller, enabled]);

  useEffect(() => {
    const handleDuck = (event) => {
      controller.duck(event?.detail?.durationMs, event?.detail?.multiplier);
    };
    window.addEventListener(GAME_BGM_DUCK_EVENT, handleDuck);
    return () => window.removeEventListener(GAME_BGM_DUCK_EVENT, handleDuck);
  }, [controller]);

  useEffect(() => () => controller.destroy(), [controller]);

  const value = {
    activeTheme,
    enabled,
    isAvailable: Boolean(activeTheme),
    label: activeProfile.label,
    playing: enabled && Boolean(activeTheme),
    setVolume,
    toggleMusic,
    volume,
  };

  return <GameBgmContext.Provider value={value}>{children}</GameBgmContext.Provider>;
}
