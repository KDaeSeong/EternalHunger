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
  gameBgmNoteFrequency,
  gameBgmProfile,
  gameBgmStepDuration,
} from '../_lib/gameBgmProfiles';

const GameBgmContext = createContext(null);
const LOOK_AHEAD_SECONDS = 0.34;
const SCHEDULER_INTERVAL_MS = 85;
const MASTER_GAIN = 0.11;

function audioContextConstructor() {
  if (typeof window === 'undefined') return null;
  return window.AudioContext || window.webkitAudioContext || null;
}

function scheduleTone({ ctx, destination, frequency, start, duration, gainValue, wave, sources }) {
  if (!Number.isFinite(frequency) || frequency <= 0) return;
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();
  const attackEnd = start + Math.min(0.025, duration * 0.18);
  const releaseStart = start + Math.max(0.035, duration * 0.72);
  const end = start + duration;

  oscillator.type = wave || 'sine';
  oscillator.frequency.setValueAtTime(Math.min(6200, Math.max(30, frequency)), start);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, gainValue), attackEnd);
  gain.gain.setValueAtTime(Math.max(0.0002, gainValue), releaseStart);
  gain.gain.exponentialRampToValueAtTime(0.0001, end);

  oscillator.connect(gain);
  gain.connect(destination);
  sources.add(oscillator);
  oscillator.onended = () => {
    sources.delete(oscillator);
    oscillator.disconnect();
    gain.disconnect();
  };
  oscillator.start(start);
  oscillator.stop(end + 0.02);
}

function scheduleMusicStep(session, stepIndex, start) {
  const { ctx, gain, profile, sources } = session;
  const stepDuration = gameBgmStepDuration(profile);
  const leadDegree = profile.lead[stepIndex % profile.lead.length];
  const bassDegree = profile.bass[stepIndex % profile.bass.length];

  if (leadDegree !== null && leadDegree !== undefined) {
    scheduleTone({
      ctx,
      destination: gain,
      frequency: gameBgmNoteFrequency(profile, leadDegree, 1),
      start,
      duration: stepDuration * 0.82,
      gainValue: profile.leadGain,
      wave: profile.leadWave,
      sources,
    });
  }

  if (bassDegree !== null && bassDegree !== undefined) {
    scheduleTone({
      ctx,
      destination: gain,
      frequency: gameBgmNoteFrequency(profile, bassDegree, -1),
      start,
      duration: stepDuration * 1.75,
      gainValue: profile.bassGain,
      wave: profile.bassWave,
      sources,
    });
  }

  if (stepIndex % 4 === 0) {
    const chordIndex = Math.floor(stepIndex / 4) % profile.chordRoots.length;
    const chordRoot = profile.chordRoots[chordIndex];
    [chordRoot, chordRoot + 2, chordRoot + 4].forEach((degree, voiceIndex) => {
      scheduleTone({
        ctx,
        destination: gain,
        frequency: gameBgmNoteFrequency(profile, degree, voiceIndex === 0 ? 0 : 1),
        start: start + voiceIndex * 0.012,
        duration: stepDuration * 3.7,
        gainValue: profile.padGain,
        wave: 'sine',
        sources,
      });
    });
  }
}

function stopSession(session, fadeSeconds = 0.18) {
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
        // A source may have already ended naturally.
      }
    });
    session.sources.clear();
    try {
      session.gain.disconnect();
    } catch {
      // The session bus may already be disconnected during unmount.
    }
  }, Math.ceil(fadeSeconds * 1000) + 30);
}

function createAudioGraph(volume) {
  const AudioContextCtor = audioContextConstructor();
  if (!AudioContextCtor) return null;
  const ctx = new AudioContextCtor();
  const filter = ctx.createBiquadFilter();
  const master = ctx.createGain();
  const compressor = ctx.createDynamicsCompressor();

  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(1800, ctx.currentTime);
  filter.Q.setValueAtTime(0.65, ctx.currentTime);
  master.gain.setValueAtTime(MASTER_GAIN * normalizeGameBgmVolume(volume), ctx.currentTime);
  compressor.threshold.setValueAtTime(-26, ctx.currentTime);
  compressor.knee.setValueAtTime(18, ctx.currentTime);
  compressor.ratio.setValueAtTime(4, ctx.currentTime);
  compressor.attack.setValueAtTime(0.012, ctx.currentTime);
  compressor.release.setValueAtTime(0.22, ctx.currentTime);

  filter.connect(master);
  master.connect(compressor);
  compressor.connect(ctx.destination);
  return { compressor, ctx, filter, master };
}

function createGameBgmController() {
  let graph = null;
  let session = null;
  let volume = DEFAULT_GAME_BGM_VOLUME;

  const setMasterVolume = (nextVolume, fadeSeconds = 0.08) => {
    volume = normalizeGameBgmVolume(nextVolume);
    if (!graph) return;
    const now = graph.ctx.currentTime;
    const target = MASTER_GAIN * volume;
    graph.master.gain.cancelScheduledValues(now);
    graph.master.gain.setValueAtTime(Math.max(0.0001, graph.master.gain.value), now);
    graph.master.gain.exponentialRampToValueAtTime(Math.max(0.0001, target), now + fadeSeconds);
  };

  const stop = () => {
    stopSession(session);
    session = null;
    if (typeof document !== 'undefined') {
      document.documentElement.dataset.gameBgmState = 'paused';
      delete document.documentElement.dataset.gameBgmTheme;
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

    stopSession(session, 0.14);
    const profile = gameBgmProfile(nextTheme);
    const now = graph.ctx.currentTime;
    const sessionGain = graph.ctx.createGain();
    const nextSession = {
      ctx: graph.ctx,
      gain: sessionGain,
      nextStep: 0,
      nextTime: now + 0.08,
      profile,
      sources: new Set(),
      theme: nextTheme,
      timer: null,
    };
    sessionGain.gain.setValueAtTime(0.0001, now);
    sessionGain.gain.exponentialRampToValueAtTime(1, now + 0.28);
    sessionGain.connect(graph.filter);
    graph.filter.frequency.cancelScheduledValues(now);
    graph.filter.frequency.setTargetAtTime(Number(profile.filterFrequency || 1800), now, 0.08);
    session = nextSession;

    const pump = () => {
      if (session !== nextSession || graph.ctx.state === 'closed') return;
      while (nextSession.nextTime < graph.ctx.currentTime + LOOK_AHEAD_SECONDS) {
        scheduleMusicStep(nextSession, nextSession.nextStep, nextSession.nextTime);
        nextSession.nextStep = (nextSession.nextStep + 1) % Number(profile.steps || 16);
        nextSession.nextTime += gameBgmStepDuration(profile);
      }
      nextSession.timer = window.setTimeout(pump, SCHEDULER_INTERVAL_MS);
    };

    try {
      void graph.ctx.resume().catch(() => {});
      pump();
      setMasterVolume(volume, 0.12);
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
      const currentGraph = graph;
      graph = null;
      if (currentGraph && currentGraph.ctx.state !== 'closed') void currentGraph.ctx.close();
    },
    hasAudioGraph: () => Boolean(graph && graph.ctx.state !== 'closed'),
    isPlayingTheme: (theme) => session?.theme === theme,
    setMasterVolume,
    setVisible(visible) {
      setMasterVolume(visible ? volume : 0, visible ? 0.28 : 0.18);
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
