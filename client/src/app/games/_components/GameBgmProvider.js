'use client';

import {
  createContext,
  useCallback,
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
  gameBgmChordVoicing,
  gameBgmNoteFrequency,
  gameBgmProfile,
  gameBgmStepDuration,
} from '../_lib/gameBgmProfiles';
import { gameBgmRenderedTrack } from '../_lib/gameBgmRenderedTracks';

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
  vibratoDepth = 0,
  vibratoRate = 5,
}) {
  if (!Number.isFinite(frequency) || frequency <= 0 || duration <= 0) return;
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();
  const attackEnd = start + Math.min(Math.max(0.003, attack), duration * 0.32);
  const releaseStart = start + Math.max(attack + 0.004, duration * clamp(releaseStartRatio, 0.35, 0.92));
  const end = start + duration;
  const panner = connectPannedVoice(ctx, gain, destination, pan);
  let vibratoOscillator = null;
  let vibratoGain = null;

  oscillator.type = wave || 'sine';
  oscillator.frequency.setValueAtTime(Math.min(6200, Math.max(30, frequency)), start);
  oscillator.detune.setValueAtTime(Number(detune || 0), start);
  if (Number(vibratoDepth) > 0) {
    vibratoOscillator = ctx.createOscillator();
    vibratoGain = ctx.createGain();
    vibratoOscillator.type = 'sine';
    vibratoOscillator.frequency.setValueAtTime(Math.max(0.1, Number(vibratoRate || 5)), start);
    vibratoGain.gain.setValueAtTime(Math.max(0, Number(vibratoDepth)), start);
    vibratoOscillator.connect(vibratoGain);
    vibratoGain.connect(oscillator.detune);
    sources.add(vibratoOscillator);
    vibratoOscillator.onended = () => {
      sources.delete(vibratoOscillator);
      vibratoOscillator.disconnect();
      vibratoGain.disconnect();
    };
    vibratoOscillator.start(start);
    vibratoOscillator.stop(end + 0.02);
  }
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
    destination: session.drumGain,
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
    destination: session.drumGain,
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
    destination: session.drumGain,
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
    destination: session.drumGain,
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
    destination: session.drumGain,
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

function scheduleOpenHat(session, start, velocity, pan = 0.2) {
  scheduleNoise({
    ctx: session.ctx,
    destination: session.drumGain,
    noiseBuffer: session.noiseBuffer,
    start,
    duration: 0.24,
    gainValue: velocity,
    sources: session.sources,
    filterType: 'highpass',
    frequency: 4200,
    q: 0.45,
    pan,
  });
}

function scheduleGhostSnare(session, start, velocity, stepIndex) {
  scheduleNoise({
    ctx: session.ctx,
    destination: session.drumGain,
    noiseBuffer: session.noiseBuffer,
    start,
    duration: 0.062,
    gainValue: velocity,
    sources: session.sources,
    filterType: 'bandpass',
    frequency: 2350,
    q: 1.15,
    pan: stepIndex % 4 === 1 ? -0.22 : 0.22,
  });
}

function scheduleRideCymbal(session, start, velocity, stepIndex) {
  scheduleNoise({
    ctx: session.ctx,
    destination: session.drumGain,
    noiseBuffer: session.noiseBuffer,
    start,
    duration: stepIndex % 8 === 0 ? 0.28 : 0.13,
    gainValue: velocity,
    sources: session.sources,
    filterType: 'highpass',
    frequency: 6100,
    q: 0.42,
    pan: stepIndex % 8 === 0 ? -0.32 : 0.3,
  });
}

function schedulePump(session, start, amount, duration) {
  const depth = clamp(amount, 0, 0.52);
  if (depth <= 0) return;
  [
    [session.musicGain, 1],
    [session.orchestraGain, session.orchestraLevel],
  ].forEach(([bus, baseLevel]) => {
    const pumpGain = bus.gain;
    pumpGain.setValueAtTime(baseLevel, start);
    pumpGain.linearRampToValueAtTime(
      Math.max(baseLevel * 0.45, baseLevel * (1 - depth)),
      start + 0.008,
    );
    pumpGain.exponentialRampToValueAtTime(baseLevel, start + Math.max(0.06, duration));
  });
}

function scheduleSectionImpact(session, start, intensity, hybridAmount = 0) {
  const gain = Number(session.profile.fxGain || 0.082) * clamp(intensity, 0, 1.4);
  if (gain <= 0) return;
  scheduleNoise({
    ctx: session.ctx,
    destination: session.fxGain,
    noiseBuffer: session.noiseBuffer,
    start,
    duration: 0.82,
    gainValue: gain,
    sources: session.sources,
    filterType: 'highpass',
    frequency: 2800,
    q: 0.38,
    pan: 0.08,
  });
  scheduleTone({
    ctx: session.ctx,
    destination: session.fxGain,
    frequency: 92,
    endFrequency: 41,
    start,
    duration: 0.34,
    gainValue: gain * 0.72,
    wave: 'sine',
    sources: session.sources,
    attack: 0.003,
    releaseStartRatio: 0.3,
    pan: -0.06,
  });

  const hybridGain = Number(session.profile.orchestration?.hybridGain || 0)
    * clamp(hybridAmount, 0, 1.2);
  if (hybridGain <= 0) return;
  scheduleNoise({
    ctx: session.ctx,
    destination: session.fxGain,
    noiseBuffer: session.noiseBuffer,
    start: start + 0.018,
    duration: 0.46,
    gainValue: hybridGain,
    sources: session.sources,
    filterType: 'bandpass',
    frequency: 1260,
    q: 1.8,
    pan: 0.26,
  });
  [
    { frequency: 420, endFrequency: 138, gain: 0.72, pan: -0.32 },
    { frequency: 860, endFrequency: 245, gain: 0.34, pan: 0.34 },
  ].forEach((voice) => scheduleTone({
    ctx: session.ctx,
    destination: session.fxGain,
    frequency: voice.frequency,
    endFrequency: voice.endFrequency,
    start: start + 0.012,
    duration: 0.38,
    gainValue: hybridGain * voice.gain,
    wave: 'triangle',
    sources: session.sources,
    attack: 0.003,
    releaseStartRatio: 0.24,
    pan: voice.pan,
  }));
}

function scheduleTransitionRiser(session, start, duration, intensity) {
  const gainValue = Number(session.profile.fxGain || 0.082) * clamp(intensity, 0, 1.4) * 0.72;
  if (!session.noiseBuffer || duration <= 0 || gainValue <= 0) return;
  const source = session.ctx.createBufferSource();
  const filter = session.ctx.createBiquadFilter();
  const gain = session.ctx.createGain();
  const end = start + duration;
  const panner = connectPannedVoice(session.ctx, gain, session.fxGain, -0.08);

  source.buffer = session.noiseBuffer;
  source.loop = true;
  filter.type = 'bandpass';
  filter.frequency.setValueAtTime(260, start);
  filter.frequency.exponentialRampToValueAtTime(6800, end);
  filter.Q.setValueAtTime(0.72, start);
  filter.Q.linearRampToValueAtTime(1.8, end);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, gainValue), start + duration * 0.88);
  gain.gain.exponentialRampToValueAtTime(0.0001, end);
  source.connect(filter);
  filter.connect(gain);
  session.sources.add(source);
  source.onended = () => {
    session.sources.delete(source);
    source.disconnect();
    filter.disconnect();
    gain.disconnect();
    panner?.disconnect();
  };
  source.start(start);
  source.stop(end + 0.02);

  scheduleTone({
    ctx: session.ctx,
    destination: session.fxGain,
    frequency: 145,
    endFrequency: 920,
    start,
    duration,
    gainValue: gainValue * 0.18,
    wave: 'triangle',
    sources: session.sources,
    attack: duration * 0.72,
    releaseStartRatio: 0.9,
    pan: 0.12,
  });
}

function scheduleDrumStep(session, arrangement, start) {
  const { profile } = session;
  const orchestration = profile.orchestration || {};
  const stepDuration = gameBgmStepDuration(profile);
  const step = arrangement.patternStep;
  const sectionLevel = Number(arrangement.section.drums || 0);
  const energy = Number(arrangement.section.energy || 1);
  const flourish = Number(profile.flourish || 0.9);
  const baseGain = Number(profile.drumGain || 0.1) * sectionLevel * Math.min(1.15, energy);
  const kick = Number(profile.drums.kick[step] || 0);
  const snare = Number(profile.drums.snare[step] || 0);
  const hat = Number(profile.drums.hat[step] || 0);
  const perc = Number(profile.drums.perc[step] || 0);

  if (kick > 0) {
    schedulePump(
      session,
      start,
      Number(arrangement.section.pump || 0) * Number(profile.pumpDepth || 0.28) * flourish,
      stepDuration * 0.86,
    );
    scheduleKick(session, start, baseGain * kick);
  }
  if (snare > 0) scheduleSnare(session, start, baseGain * snare * 0.82);
  if (hat > 0) scheduleHat(session, start, baseGain * hat * 0.42, step);
  if (perc > 0) schedulePerc(session, start, baseGain * perc * 0.55, step);

  const ghostGain = Number(orchestration.ghostGain || 0)
    * Number(arrangement.section.ghost || 0)
    * energy;
  if (ghostGain > 0 && [3, 7, 11, 15].includes(step) && snare <= 0) {
    scheduleGhostSnare(session, start, ghostGain * (step === 15 ? 1.18 : 0.82), step);
  }

  const cymbalGain = Number(orchestration.cymbalGain || 0)
    * Number(arrangement.section.cymbal || 0)
    * energy;
  if (cymbalGain > 0 && [0, 4, 8, 12].includes(step)) {
    scheduleRideCymbal(session, start, cymbalGain * (step % 8 === 0 ? 1 : 0.74), step);
  }

  const fillWindow = arrangement.section.fill
    && arrangement.sectionStep >= arrangement.sectionSteps - 16
    && step >= 10;
  if (fillWindow && step >= 10) {
    const fillProgress = (step - 9) / 6;
    schedulePerc(session, start, baseGain * (0.48 + fillProgress * 0.55), step + 1);
    if (step >= 12) scheduleSnare(session, start, baseGain * (0.24 + fillProgress * 0.34));
    if (step === 14) scheduleOpenHat(session, start, baseGain * 0.32, -0.24);
    if (step === 15) scheduleOpenHat(session, start, baseGain * 0.58, 0.28);
  } else if (arrangement.section.stabs && [6, 14].includes(step)) {
    scheduleOpenHat(session, start, baseGain * 0.26, step === 6 ? -0.22 : 0.22);
  }
}

function scheduleChord(session, chordRoot, start, duration, energy, arrangement) {
  const { profile } = session;
  const voicing = gameBgmChordVoicing(profile, arrangement);
  voicing.forEach((offset, voiceIndex) => {
    scheduleTone({
      ctx: session.ctx,
      destination: session.musicGain,
      frequency: gameBgmNoteFrequency(profile, chordRoot + offset, profile.padOctave),
      start: start + voiceIndex * 0.014,
      duration,
      gainValue: Number(profile.padGain || 0.025) * energy * (voiceIndex === 0 ? 1 : 0.82),
      wave: profile.padWave || 'sine',
      sources: session.sources,
      attack: Math.min(0.11, duration * 0.16),
      releaseStartRatio: 0.78,
      detune: (voiceIndex % 2 ? -1 : 1) * Number(profile.padDetune || 5),
      pan: (voiceIndex - (voicing.length - 1) / 2) * 0.2,
    });
  });
}

function scheduleBrassStab(session, chordRoot, start, duration, intensity, arrangement) {
  const { orchestration = {} } = session.profile;
  const gain = Number(orchestration.brassGain || 0) * intensity;
  if (gain <= 0) return;
  const voicing = gameBgmChordVoicing(session.profile, arrangement).slice(0, 4);
  voicing.forEach((offset, voiceIndex) => {
    scheduleTone({
      ctx: session.ctx,
      destination: session.orchestraGain,
      frequency: gameBgmNoteFrequency(
        session.profile,
        chordRoot + offset,
        session.profile.brassOctave,
      ),
      start: start + voiceIndex * 0.009,
      duration,
      gainValue: gain * (voiceIndex === 0 ? 1 : 0.72),
      wave: orchestration.brassWave || 'sawtooth',
      sources: session.sources,
      attack: 0.016,
      releaseStartRatio: 0.46,
      detune: voiceIndex % 2 ? -4 : 3,
      pan: (voiceIndex - (voicing.length - 1) / 2) * 0.18,
    });
  });
}

function scheduleBellAccent(session, degree, start, duration, intensity, pan) {
  const { orchestration = {} } = session.profile;
  const frequency = gameBgmNoteFrequency(
    session.profile,
    degree,
    session.profile.bellOctave,
  );
  const gain = Number(orchestration.bellGain || 0) * intensity;
  if (gain <= 0) return;
  [
    { ratio: 1, gain: 1, length: 1 },
    { ratio: 2.01, gain: 0.38, length: 0.72 },
    { ratio: 3.98, gain: 0.14, length: 0.48 },
  ].forEach((partial) => {
    scheduleTone({
      ctx: session.ctx,
      destination: session.orchestraGain,
      frequency: frequency * partial.ratio,
      start,
      duration: duration * partial.length,
      gainValue: gain * partial.gain,
      wave: orchestration.bellWave || 'sine',
      sources: session.sources,
      attack: 0.004,
      releaseStartRatio: 0.3,
      pan,
    });
  });
}

function scheduleChoirChord(session, chordRoot, start, duration, intensity, arrangement) {
  const { orchestration = {} } = session.profile;
  const gain = Number(orchestration.choirGain || 0) * intensity;
  if (gain <= 0) return;
  const voicing = gameBgmChordVoicing(session.profile, arrangement).slice(0, 4);
  voicing.forEach((offset, voiceIndex) => {
    scheduleTone({
      ctx: session.ctx,
      destination: session.orchestraGain,
      frequency: gameBgmNoteFrequency(
        session.profile,
        chordRoot + offset,
        session.profile.choirOctave,
      ),
      start: start + voiceIndex * 0.028,
      duration,
      gainValue: gain * (voiceIndex === 0 ? 1 : 0.76),
      wave: orchestration.choirWave || 'triangle',
      sources: session.sources,
      attack: Math.min(0.34, duration * 0.24),
      releaseStartRatio: 0.72,
      detune: voiceIndex % 2 ? -7 : 6,
      pan: (voiceIndex - (voicing.length - 1) / 2) * 0.24,
    });
  });
}

function scheduleStringEnsemble(session, chordRoot, start, duration, intensity, arrangement) {
  const { orchestration = {} } = session.profile;
  const gain = Number(orchestration.stringGain || 0) * intensity;
  if (gain <= 0) return;
  const voicing = gameBgmChordVoicing(session.profile, arrangement).slice(0, 4);
  voicing.forEach((offset, voiceIndex) => {
    const pan = (voiceIndex - (voicing.length - 1) / 2) * 0.28;
    const frequency = gameBgmNoteFrequency(
      session.profile,
      chordRoot + offset,
      session.profile.stringOctave,
    );
    scheduleTone({
      ctx: session.ctx,
      destination: session.orchestraGain,
      frequency,
      start: start + voiceIndex * 0.018,
      duration,
      gainValue: gain * (voiceIndex === 0 ? 0.92 : 0.72),
      wave: orchestration.stringWave || 'triangle',
      sources: session.sources,
      attack: Math.min(0.24, duration * 0.14),
      releaseStartRatio: 0.82,
      detune: voiceIndex % 2 ? -7 : 6,
      pan,
    });
    if (intensity >= 0.72 && (voiceIndex === 0 || voiceIndex === voicing.length - 1)) {
      scheduleTone({
        ctx: session.ctx,
        destination: session.orchestraGain,
        frequency,
        start: start + 0.024,
        duration: duration * 0.96,
        gainValue: gain * 0.3,
        wave: 'sawtooth',
        sources: session.sources,
        attack: Math.min(0.28, duration * 0.16),
        releaseStartRatio: 0.8,
        detune: voiceIndex === 0 ? -12 : 11,
        pan: -pan,
      });
    }
  });
}

function schedulePianoFigure(session, arrangement, chordRoot, start) {
  const { orchestration = {} } = session.profile;
  const { section } = arrangement;
  const step = arrangement.patternStep;
  if (Number(section.piano || 0) <= 0 || !section.arp || ![0, 3, 6, 8, 11, 14].includes(step)) return;
  const degree = session.profile.arp[(step + arrangement.sectionBarIndex * 3) % 16];
  if (degree === null || degree === undefined) return;
  const stepDuration = gameBgmStepDuration(session.profile);
  const gain = Number(orchestration.pianoGain || 0)
    * Number(section.piano)
    * Number(section.energy || 1);
  if (gain <= 0) return;
  const frequency = gameBgmNoteFrequency(
    session.profile,
    chordRoot + Number(degree),
    session.profile.pianoOctave,
  );
  const pan = step < 8 ? -0.22 + step * 0.025 : 0.22 - (15 - step) * 0.025;
  [
    { ratio: 1, gain: 1, length: 2.45, wave: 'triangle' },
    { ratio: 2.004, gain: 0.34, length: 1.5, wave: 'sine' },
    { ratio: 3.012, gain: 0.13, length: 0.86, wave: 'sine' },
  ].forEach((partial) => scheduleTone({
    ctx: session.ctx,
    destination: session.orchestraGain,
    frequency: frequency * partial.ratio,
    start,
    duration: stepDuration * partial.length,
    gainValue: gain * partial.gain,
    wave: partial.wave,
    sources: session.sources,
    attack: 0.003,
    releaseStartRatio: 0.24,
    pan,
  }));
  if (step % 8 === 0) {
    scheduleNoise({
      ctx: session.ctx,
      destination: session.orchestraGain,
      noiseBuffer: session.noiseBuffer,
      start,
      duration: 0.026,
      gainValue: gain * 0.11,
      sources: session.sources,
      filterType: 'bandpass',
      frequency: 2800,
      q: 0.74,
      pan,
    });
  }
}

function scheduleHarpArpeggio(session, arrangement, chordRoot, start) {
  const { orchestration = {} } = session.profile;
  const { section } = arrangement;
  const step = arrangement.patternStep;
  if (Number(section.harp || 0) <= 0 || !section.arp || step % 2 !== 0) return;
  const patternIndex = (15 - step + arrangement.sectionBarIndex * 2 + 16) % 16;
  const degree = session.profile.arp[patternIndex];
  if (degree === null || degree === undefined) return;
  const stepDuration = gameBgmStepDuration(session.profile);
  const gain = Number(orchestration.harpGain || 0)
    * Number(section.harp)
    * Number(section.energy || 1);
  if (gain <= 0) return;
  const frequency = gameBgmNoteFrequency(
    session.profile,
    chordRoot + Number(degree),
    session.profile.harpOctave,
  );
  const pan = -0.48 + (step / 15) * 0.96;
  [
    { ratio: 1, gain: 1, length: 2.9 },
    { ratio: 2.008, gain: 0.26, length: 1.72 },
    { ratio: 3.018, gain: 0.09, length: 1.02 },
  ].forEach((partial) => scheduleTone({
    ctx: session.ctx,
    destination: session.orchestraGain,
    frequency: frequency * partial.ratio,
    start,
    duration: stepDuration * partial.length,
    gainValue: gain * partial.gain,
    wave: 'sine',
    sources: session.sources,
    attack: 0.002,
    releaseStartRatio: 0.2,
    pan: partial.ratio === 1 ? pan : -pan * 0.42,
  }));
}

function scheduleWoodwindSolo(session, arrangement, chordRoot, start) {
  const { orchestration = {} } = session.profile;
  const { section } = arrangement;
  const step = arrangement.patternStep;
  if (Number(section.woodwind || 0) <= 0 || ![2, 6, 10, 14].includes(step)) return;
  if (!section.counter && !section.pad && !section.lead) return;
  const counterDegree = session.profile.counter[step];
  const fallbackDegrees = [2, 4, 6, 3];
  const degree = counterDegree === null || counterDegree === undefined
    ? chordRoot + fallbackDegrees[(step - 2) / 4]
    : Number(counterDegree);
  const stepDuration = gameBgmStepDuration(session.profile);
  const gain = Number(orchestration.woodwindGain || 0)
    * Number(section.woodwind)
    * Number(section.energy || 1);
  if (gain <= 0) return;
  const frequency = gameBgmNoteFrequency(
    session.profile,
    degree,
    session.profile.woodwindOctave,
  );
  const pan = step % 8 === 2 ? -0.18 : 0.2;
  [
    { ratio: 1, gain: 1, wave: orchestration.woodwindWave || 'triangle' },
    { ratio: 2.002, gain: 0.16, wave: 'sine' },
  ].forEach((partial) => scheduleTone({
    ctx: session.ctx,
    destination: session.orchestraGain,
    frequency: frequency * partial.ratio,
    start,
    duration: stepDuration * (partial.ratio === 1 ? 2.85 : 2.5),
    gainValue: gain * partial.gain,
    wave: partial.wave,
    sources: session.sources,
    attack: 0.045,
    releaseStartRatio: 0.76,
    vibratoDepth: partial.ratio === 1 ? 7 : 3,
    vibratoRate: 5.15,
    pan,
  }));
  scheduleNoise({
    ctx: session.ctx,
    destination: session.orchestraGain,
    noiseBuffer: session.noiseBuffer,
    start,
    duration: Math.min(0.18, stepDuration * 0.72),
    gainValue: gain * 0.1,
    sources: session.sources,
    filterType: 'bandpass',
    frequency: Math.min(4400, Math.max(1200, frequency * 3.2)),
    q: 1.1,
    pan,
  });
}

function scheduleHornEnsemble(session, arrangement, chordRoot, start) {
  const { orchestration = {} } = session.profile;
  const { section } = arrangement;
  const step = arrangement.patternStep;
  if (Number(section.horn || 0) <= 0 || !section.pad) return;
  if (step !== 0 && !(Number(section.horn) >= 0.8 && step === 8)) return;
  const gain = Number(orchestration.hornGain || 0)
    * Number(section.horn)
    * Number(section.energy || 1);
  if (gain <= 0) return;
  const stepDuration = gameBgmStepDuration(session.profile);
  const voicing = gameBgmChordVoicing(session.profile, arrangement).slice(0, 3);
  voicing.forEach((offset, voiceIndex) => {
    const frequency = gameBgmNoteFrequency(
      session.profile,
      chordRoot + offset,
      session.profile.hornOctave,
    );
    const pan = (voiceIndex - 1) * 0.24;
    const duration = stepDuration * (step === 0 ? 7.7 : 5.6);
    scheduleTone({
      ctx: session.ctx,
      destination: session.orchestraGain,
      frequency,
      start: start + voiceIndex * 0.018,
      duration,
      gainValue: gain * (voiceIndex === 0 ? 1 : 0.76),
      wave: orchestration.hornWave || 'triangle',
      sources: session.sources,
      attack: 0.085,
      releaseStartRatio: 0.8,
      detune: voiceIndex % 2 ? -3 : 2,
      vibratoDepth: 3.5,
      vibratoRate: 4.65,
      pan,
    });
    scheduleTone({
      ctx: session.ctx,
      destination: session.orchestraGain,
      frequency: frequency * 2,
      start: start + 0.012 + voiceIndex * 0.018,
      duration: duration * 0.92,
      gainValue: gain * 0.19,
      wave: 'sine',
      sources: session.sources,
      attack: 0.1,
      releaseStartRatio: 0.78,
      vibratoDepth: 2,
      vibratoRate: 4.65,
      pan: -pan * 0.62,
    });
  });
}

function scheduleSynthPulse(session, arrangement, chordRoot, start) {
  const { orchestration = {} } = session.profile;
  const { section } = arrangement;
  const step = arrangement.patternStep;
  if (Number(section.pulse || 0) <= 0 || step % 2 !== 0) return;
  const pulseDegree = session.profile.pulse[step];
  if (pulseDegree === null || pulseDegree === undefined) return;
  const stepDuration = gameBgmStepDuration(session.profile);
  const intensity = Number(section.pulse) * Number(section.energy || 1);
  const gain = Number(orchestration.pulseGain || 0) * intensity;
  if (gain <= 0) return;
  const frequency = gameBgmNoteFrequency(
    session.profile,
    chordRoot + Number(pulseDegree),
    session.profile.pulseOctave,
  );
  const pan = step % 4 === 0 ? -0.46 : 0.46;
  scheduleTone({
    ctx: session.ctx,
    destination: session.orchestraGain,
    frequency,
    start,
    duration: stepDuration * Number(session.profile.pulseLength || 0.42),
    gainValue: gain,
    wave: orchestration.pulseWave || 'sawtooth',
    sources: session.sources,
    attack: 0.004,
    releaseStartRatio: 0.42,
    pan,
  });
  if (intensity >= 0.8 && step % 4 === 0) {
    scheduleTone({
      ctx: session.ctx,
      destination: session.orchestraGain,
      frequency: frequency * 2,
      start: start + 0.006,
      duration: stepDuration * Number(session.profile.pulseLength || 0.42) * 0.82,
      gainValue: gain * 0.34,
      wave: 'triangle',
      sources: session.sources,
      attack: 0.004,
      releaseStartRatio: 0.38,
      detune: 5,
      pan: -pan,
    });
  }
}

function scheduleSupersawLead(session, frequency, start, duration, intensity) {
  const { orchestration = {} } = session.profile;
  const gain = Number(orchestration.leadStackGain || 0) * intensity;
  if (gain <= 0) return;
  [
    { detune: -15, pan: -0.44, gain: 0.58 },
    { detune: 11, pan: 0.42, gain: 0.54 },
    { detune: 4, pan: 0.08, gain: 0.22, octave: 2 },
  ].forEach((voice) => scheduleTone({
    ctx: session.ctx,
    destination: session.orchestraGain,
    frequency: frequency * Number(voice.octave || 1),
    start: start + (voice.pan > 0 ? 0.006 : 0),
    duration: duration * (voice.octave ? 0.72 : 0.92),
    gainValue: gain * voice.gain,
    wave: voice.octave ? 'triangle' : orchestration.leadStackWave || 'sawtooth',
    sources: session.sources,
    attack: 0.008,
    releaseStartRatio: 0.62,
    detune: voice.detune,
    pan: voice.pan,
  }));
}

function scheduleSynthPluck(session, arrangement, chordRoot, start) {
  const { orchestration = {} } = session.profile;
  const { section } = arrangement;
  const step = arrangement.patternStep;
  if (Number(section.pluck || 0) <= 0 || step % 2 !== 0) return;
  const degree = session.profile.arp[(step + arrangement.sectionBarIndex * 3) % 16];
  if (degree === null || degree === undefined) return;
  const gain = Number(orchestration.pluckGain || 0)
    * Number(section.pluck)
    * Number(section.energy || 1);
  if (gain <= 0) return;
  const stepDuration = gameBgmStepDuration(session.profile);
  const frequency = gameBgmNoteFrequency(
    session.profile,
    chordRoot + Number(degree),
    Number(session.profile.pluckOctave ?? 2),
  );
  const pan = step % 4 === 0 ? -0.34 : 0.36;
  [
    { ratio: 1, gain: 1, length: 0.78 },
    { ratio: 2, gain: 0.3, length: 0.48 },
    { ratio: 3.01, gain: 0.12, length: 0.32 },
  ].forEach((partial) => scheduleTone({
    ctx: session.ctx,
    destination: session.orchestraGain,
    frequency: frequency * partial.ratio,
    start,
    duration: stepDuration * partial.length,
    gainValue: gain * partial.gain,
    wave: orchestration.pluckWave || 'triangle',
    sources: session.sources,
    attack: 0.002,
    releaseStartRatio: 0.22,
    pan: partial.ratio === 1 ? pan : -pan * 0.72,
  }));
}

function scheduleGuitarStab(session, arrangement, chordRoot, start) {
  const { orchestration = {} } = session.profile;
  const { section } = arrangement;
  const step = arrangement.patternStep;
  if (Number(section.guitar || 0) <= 0 || !section.bass || ![0, 6, 8, 14].includes(step)) return;
  const gain = Number(orchestration.guitarGain || 0)
    * Number(section.guitar)
    * Number(section.energy || 1);
  if (gain <= 0) return;
  const stepDuration = gameBgmStepDuration(session.profile);
  [
    { degree: chordRoot, octave: 0, gain: 0.92, pan: -0.28, detune: -7 },
    { degree: chordRoot + 4, octave: 0, gain: 0.66, pan: 0.3, detune: 6 },
    { degree: chordRoot, octave: 1, gain: 0.36, pan: 0.08, detune: 2 },
  ].forEach((voice) => scheduleTone({
    ctx: session.ctx,
    destination: session.orchestraGain,
    frequency: gameBgmNoteFrequency(session.profile, voice.degree, voice.octave),
    start: start + Math.abs(voice.pan) * 0.018,
    duration: stepDuration * (step % 8 === 0 ? 1.7 : 1.12),
    gainValue: gain * voice.gain,
    wave: orchestration.guitarWave || 'sawtooth',
    sources: session.sources,
    attack: 0.005,
    releaseStartRatio: 0.34,
    detune: voice.detune,
    pan: voice.pan,
  }));
}

function scheduleTimpani(session, arrangement, chordRoot, start) {
  const { orchestration = {} } = session.profile;
  const { section } = arrangement;
  const step = arrangement.patternStep;
  if (Number(section.timpani || 0) <= 0 || ![0, 8, 14, 15].includes(step)) return;
  const gain = Number(orchestration.timpaniGain || 0)
    * Number(section.timpani)
    * Number(section.energy || 1);
  if (gain <= 0) return;
  const baseFrequency = gameBgmNoteFrequency(session.profile, chordRoot, -2);
  scheduleTone({
    ctx: session.ctx,
    destination: session.drumGain,
    frequency: Math.min(170, baseFrequency * (step >= 14 ? 1.5 : 1.18)),
    endFrequency: Math.max(38, baseFrequency * 0.82),
    start,
    duration: step >= 14 ? 0.22 : 0.34,
    gainValue: gain * (step === 0 ? 1 : 0.78),
    wave: 'sine',
    sources: session.sources,
    attack: 0.004,
    releaseStartRatio: 0.28,
    pan: step % 2 ? 0.12 : -0.12,
  });
}

function scheduleTomFill(session, arrangement, start, intensity) {
  const step = arrangement.patternStep;
  const fillSteps = [8, 10, 12, 14, 15];
  const fillIndex = fillSteps.indexOf(step);
  if (fillIndex < 0 || arrangement.sectionStep < arrangement.sectionSteps - 8) return;
  const gain = Number(session.profile.orchestration?.tomGain || 0) * intensity;
  if (gain <= 0) return;
  const frequency = 205 - fillIndex * 22;
  scheduleTone({
    ctx: session.ctx,
    destination: session.drumGain,
    frequency,
    endFrequency: Math.max(72, frequency * 0.63),
    start,
    duration: 0.12 + fillIndex * 0.012,
    gainValue: gain * (0.72 + fillIndex * 0.11),
    wave: 'sine',
    sources: session.sources,
    attack: 0.003,
    releaseStartRatio: 0.28,
    pan: fillIndex % 2 ? 0.24 : -0.24,
  });
}

function activeOrchestrationRoles(profile, section) {
  const orchestration = profile.orchestration || {};
  return [
    ['ostinato', section.ostinato, orchestration.ostinatoGain],
    ['brass', section.brass, orchestration.brassGain],
    ['bell', section.bell, orchestration.bellGain],
    ['choir', section.choir, orchestration.choirGain],
    ['sub', section.sub, orchestration.subGain],
    ['toms', section.toms, orchestration.tomGain],
    ['string-ensemble', section.strings, orchestration.stringGain],
    ['piano-figure', section.piano, orchestration.pianoGain],
    ['harp-arpeggio', section.harp, orchestration.harpGain],
    ['woodwind-solo', section.woodwind, orchestration.woodwindGain],
    ['horn-ensemble', section.horn, orchestration.hornGain],
    ['synth-pulse', section.pulse, orchestration.pulseGain],
    ['supersaw-lead', section.leadStack, orchestration.leadStackGain],
    ['synth-pluck', section.pluck, orchestration.pluckGain],
    ['guitar-stab', section.guitar, orchestration.guitarGain],
    ['timpani', section.timpani, orchestration.timpaniGain],
    ['hybrid-impact', section.hybrid, orchestration.hybridGain],
    ['ride-cymbal', section.cymbal, orchestration.cymbalGain],
    ['ghost-snare', section.ghost, orchestration.ghostGain],
  ]
    .filter(([, amount, gain]) => Number(amount || 0) >= 0.2 && Number(gain || 0) > 0)
    .map(([role]) => role);
}

function scheduleOrchestralStep(session, arrangement, chordRoot, start) {
  const { orchestration = {} } = session.profile;
  const { section } = arrangement;
  const step = arrangement.patternStep;
  const stepDuration = gameBgmStepDuration(session.profile);
  const energy = Number(section.energy || 1);

  if (section.ostinato > 0 && section.arp && step % 2 === 0) {
    const arpDegree = session.profile.arp[(step + arrangement.sectionBarIndex * 2) % 16];
    if (arpDegree !== null && arpDegree !== undefined) {
      scheduleTone({
        ctx: session.ctx,
        destination: session.orchestraGain,
        frequency: gameBgmNoteFrequency(
          session.profile,
          chordRoot + Number(arpDegree),
          session.profile.ostinatoOctave,
        ),
        start,
        duration: stepDuration * 0.46,
        gainValue: Number(orchestration.ostinatoGain || 0) * Number(section.ostinato) * energy,
        wave: orchestration.ostinatoWave || 'triangle',
        sources: session.sources,
        attack: 0.005,
        releaseStartRatio: 0.42,
        pan: step % 4 === 0 ? -0.38 : 0.38,
      });
    }
  }

  if (section.sub > 0 && section.bass && (step === 0 || step === 8)) {
    scheduleTone({
      ctx: session.ctx,
      destination: session.orchestraGain,
      frequency: gameBgmNoteFrequency(session.profile, chordRoot, session.profile.subOctave),
      start,
      duration: stepDuration * 3.8,
      gainValue: Number(orchestration.subGain || 0) * Number(section.sub) * energy,
      wave: 'sine',
      sources: session.sources,
      attack: 0.008,
      releaseStartRatio: 0.64,
      pan: 0,
    });
  }

  if (section.brass > 0 && section.pad && (step === 0 || (section.stabs && step === 8))) {
    scheduleBrassStab(
      session,
      chordRoot,
      start,
      stepDuration * (step === 0 ? 2.6 : 1.7),
      Number(section.brass) * energy,
      arrangement,
    );
  }

  const bellSteps = Number(section.bell || 0) >= 0.6 ? [0, 6, 12] : [0, 12];
  if (section.bell > 0 && bellSteps.includes(step)) {
    const bellDegree = chordRoot + [4, 6, 2][bellSteps.indexOf(step) % 3];
    scheduleBellAccent(
      session,
      bellDegree,
      start,
      stepDuration * 4.2,
      Number(section.bell) * energy,
      step === 6 ? 0.34 : step === 12 ? -0.3 : 0.12,
    );
  }

  if (section.choir > 0 && section.pad && step === 0) {
    scheduleChoirChord(
      session,
      chordRoot,
      start,
      stepDuration * 15.6,
      Number(section.choir) * energy,
      arrangement,
    );
  }

  if (section.strings > 0 && section.pad && step === 0) {
    scheduleStringEnsemble(
      session,
      chordRoot,
      start,
      stepDuration * 15.75,
      Number(section.strings) * energy,
      arrangement,
    );
  }

  schedulePianoFigure(session, arrangement, chordRoot, start);

  scheduleHarpArpeggio(session, arrangement, chordRoot, start);

  scheduleWoodwindSolo(session, arrangement, chordRoot, start);

  scheduleHornEnsemble(session, arrangement, chordRoot, start);

  scheduleSynthPulse(session, arrangement, chordRoot, start);

  scheduleSynthPluck(session, arrangement, chordRoot, start);

  scheduleGuitarStab(session, arrangement, chordRoot, start);

  scheduleTimpani(session, arrangement, chordRoot, start);

  scheduleTomFill(session, arrangement, start, Number(section.toms || 0) * energy);
}

function scheduleMusicStep(session, absoluteStep, start) {
  const { delaySend, filter, profile, reverbSend } = session;
  const stepDuration = gameBgmStepDuration(profile);
  const arrangement = gameBgmArrangementState(profile, absoluteStep);
  const step = arrangement.patternStep;
  const section = arrangement.section;
  const energy = Number(section.energy || 1);
  const flourish = Number(profile.flourish || 0.9);
  const swingOffset = step % 2 ? stepDuration * clamp(profile.swing, 0, 0.2) : 0;
  const noteStart = start + swingOffset;
  const chordRoot = gameBgmChordRoot(profile, arrangement);

  if (session.sectionId !== section.id) {
    session.sectionId = section.id;
    const sectionFilter = Number(profile.filterFrequency || 1800)
      * (0.78 + energy * 0.28)
      * clamp(section.brightness || 1, 0.5, 1.45);
    const sweepStart = Math.max(180, sectionFilter * (Number(section.crash || 0) > 0.5 ? 0.46 : 0.72));
    filter.frequency.cancelScheduledValues(start);
    filter.frequency.setValueAtTime(sweepStart, start);
    filter.frequency.exponentialRampToValueAtTime(Math.max(sweepStart + 1, sectionFilter), start + stepDuration * 7.5);
    filter.Q.setTargetAtTime(Number(profile.filterPeak || 0.65), start, 0.12);
    delaySend.gain.setTargetAtTime(Number(profile.delayMix || 0.055) * (0.78 + energy * 0.24), start, 0.18);
    reverbSend.gain.setTargetAtTime(Number(profile.reverbMix || 0.065) * (0.72 + energy * 0.32), start, 0.18);
    if (Number(section.crash || 0) > 0) {
      scheduleSectionImpact(
        session,
        start,
        Number(section.crash) * flourish,
        Number(section.hybrid || 0),
      );
    }
    if (typeof document !== 'undefined') {
      document.documentElement.dataset.gameBgmSection = section.id;
      document.documentElement.dataset.gameBgmFx = Number(section.crash || 0) > 0 ? 'impact' : 'none';
      document.documentElement.dataset.gameBgmOrchestration = activeOrchestrationRoles(profile, section).join(',');
    }
  }

  const riserStart = Number(section.riser || 0) > 0
    && arrangement.sectionStep === Math.max(0, arrangement.sectionSteps - 16);
  if (riserStart) {
    scheduleTransitionRiser(
      session,
      start,
      stepDuration * 15.85,
      Number(section.riser) * flourish,
    );
    if (typeof document !== 'undefined') document.documentElement.dataset.gameBgmFx = 'riser';
  }

  if (section.pad && step === 0) {
    scheduleChord(session, chordRoot, start, stepDuration * 15.65, energy, arrangement);
  }

  scheduleOrchestralStep(session, arrangement, chordRoot, noteStart);

  if (section.arp) {
    const arpDegree = profile.arp[step];
    if (arpDegree !== null && arpDegree !== undefined) {
      scheduleTone({
        ctx: session.ctx,
        destination: session.musicGain,
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
        destination: session.musicGain,
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

  const leadKey = Array.isArray(section.leadSequence) && section.leadSequence.length > 0
    ? section.leadSequence[arrangement.sectionBarIndex % section.leadSequence.length]
    : section.lead;
  const leadPattern = leadKey === 'c'
    ? profile.leadC
    : leadKey === 'b'
      ? profile.leadB
      : profile.lead;
  const leadDegree = leadKey ? leadPattern[step] : null;
  if (leadDegree !== null && leadDegree !== undefined) {
    const leadAccent = step % 4 === 0 ? 1.12 : step % 2 === 0 ? 1.03 : 0.94;
    const leadFrequency = gameBgmNoteFrequency(profile, leadDegree, profile.leadOctave);
    scheduleTone({
      ctx: session.ctx,
      destination: session.musicGain,
      frequency: leadFrequency,
      start: noteStart,
      duration: stepDuration * Number(profile.leadLength || 1.85),
      gainValue: Number(profile.leadGain || 0.12) * energy * leadAccent,
      wave: profile.leadWave,
      sources: session.sources,
      attack: 0.012,
      releaseStartRatio: 0.68,
      pan: -0.12,
    });

    scheduleSupersawLead(
      session,
      leadFrequency,
      noteStart,
      stepDuration * Number(profile.leadLength || 1.85),
      Number(section.leadStack || 0) * energy,
    );

    const harmonyAmount = Number(section.harmony || 0) * flourish;
    if (harmonyAmount > 0) {
      scheduleTone({
        ctx: session.ctx,
        destination: session.musicGain,
        frequency: gameBgmNoteFrequency(
          profile,
          Number(leadDegree) + Number(profile.harmonyInterval || 2),
          profile.leadOctave,
        ),
        start: noteStart + 0.008,
        duration: stepDuration * Number(profile.leadLength || 1.85),
        gainValue: Number(profile.harmonyGain || 0.034) * energy * harmonyAmount,
        wave: profile.counterWave || 'sine',
        sources: session.sources,
        attack: 0.016,
        releaseStartRatio: 0.7,
        detune: -3,
        pan: 0.2,
      });
    }

    const octaveAmount = Number(section.octave || 0) * flourish;
    if (octaveAmount > 0) {
      scheduleTone({
        ctx: session.ctx,
        destination: session.musicGain,
        frequency: gameBgmNoteFrequency(
          profile,
          Number(leadDegree) + Number(profile.mode?.length || 5),
          profile.leadOctave,
        ),
        start: noteStart + 0.012,
        duration: stepDuration * Number(profile.leadLength || 1.85) * 0.84,
        gainValue: Number(profile.octaveGain || 0.02) * energy * octaveAmount,
        wave: profile.arpWave || 'triangle',
        sources: session.sources,
        attack: 0.008,
        releaseStartRatio: 0.62,
        detune: 4,
        pan: 0.34,
      });
    }
  }

  const counterDegree = section.counter ? profile.counter[step] : null;
  if (counterDegree !== null && counterDegree !== undefined) {
    scheduleTone({
      ctx: session.ctx,
      destination: session.musicGain,
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

  if (energy >= 0.9 && (step === 8 || (section.stabs && [4, 12].includes(step)))) {
    scheduleChord(session, chordRoot, noteStart, stepDuration * 1.55, energy * 0.46, arrangement);
  }

  scheduleDrumStep(session, arrangement, noteStart);
}

function disconnectSessionBus(session) {
  ['assetGain', 'musicGain', 'orchestraGain', 'drumGain', 'fxGain', 'gain', 'filter', 'delaySend', 'reverbSend'].forEach((key) => {
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
  const musicGain = graph.ctx.createGain();
  const orchestraGain = graph.ctx.createGain();
  const drumGain = graph.ctx.createGain();
  const fxGain = graph.ctx.createGain();
  const filter = graph.ctx.createBiquadFilter();
  const delaySend = graph.ctx.createGain();
  const reverbSend = graph.ctx.createGain();
  const orchestraLevel = clamp(profile.orchestraLevel || 0.82, 0.55, 1.1);
  gain.gain.setValueAtTime(0.0001, startTime);
  gain.gain.exponentialRampToValueAtTime(
    1,
    startTime + clamp(profile.fadeInSeconds || 0.42, 0.18, 2.5),
  );
  musicGain.gain.setValueAtTime(1, startTime);
  orchestraGain.gain.setValueAtTime(orchestraLevel, startTime);
  drumGain.gain.setValueAtTime(1, startTime);
  fxGain.gain.setValueAtTime(1, startTime);
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(Number(profile.filterFrequency || 1800), startTime);
  filter.Q.setValueAtTime(Number(profile.filterPeak || 0.65), startTime);
  delaySend.gain.setValueAtTime(Number(profile.delayMix || 0.055), startTime);
  reverbSend.gain.setValueAtTime(Number(profile.reverbMix || 0.065), startTime);
  musicGain.connect(gain);
  orchestraGain.connect(gain);
  drumGain.connect(gain);
  fxGain.connect(gain);
  gain.connect(filter);
  filter.connect(graph.dry);
  filter.connect(delaySend);
  delaySend.connect(graph.delayInput);
  filter.connect(reverbSend);
  reverbSend.connect(graph.reverbInput);
  return {
    ctx: graph.ctx,
    delaySend,
    drumGain,
    filter,
    fxGain,
    gain,
    musicGain,
    orchestraGain,
    orchestraLevel,
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

function loadRenderedTrackBuffer(ctx, renderedTrack, cache) {
  const sourcePath = String(renderedTrack?.src || '').trim();
  if (!sourcePath) return Promise.reject(new Error('Rendered BGM source is missing.'));
  if (cache.has(sourcePath)) return cache.get(sourcePath);
  const pending = fetch(sourcePath, { cache: 'force-cache' })
    .then((response) => {
      if (!response.ok) throw new Error(`Rendered BGM request failed: ${response.status}`);
      return response.arrayBuffer();
    })
    .then((encodedAudio) => ctx.decodeAudioData(encodedAudio.slice(0)))
    .catch((error) => {
      cache.delete(sourcePath);
      throw error;
    });
  cache.set(sourcePath, pending);
  return pending;
}

function createRenderedTrackSession(graph, profile, theme, renderedTrack, audioBuffer, startTime) {
  const nextSession = createSession(graph, profile, theme, startTime);
  const source = graph.ctx.createBufferSource();
  const assetGain = graph.ctx.createGain();
  const loopStart = clamp(renderedTrack?.loopStartSeconds || 0, 0, Math.max(0, audioBuffer.duration - 0.05));
  const loopEnd = clamp(
    renderedTrack?.loopEndSeconds || audioBuffer.duration,
    loopStart + 0.05,
    audioBuffer.duration,
  );
  source.buffer = audioBuffer;
  source.loop = renderedTrack?.loop !== false;
  source.loopStart = loopStart;
  source.loopEnd = loopEnd;
  assetGain.gain.setValueAtTime(Math.max(0.05, Number(renderedTrack?.gain || 1)), startTime);
  nextSession.filter.frequency.setValueAtTime(
    Math.min(graph.ctx.sampleRate * 0.46, Number(renderedTrack?.filterFrequency || 12_000)),
    startTime,
  );
  source.connect(assetGain);
  assetGain.connect(nextSession.musicGain);
  nextSession.assetGain = assetGain;
  nextSession.rendered = true;
  nextSession.sources.add(source);
  source.onended = () => {
    nextSession.sources.delete(source);
    source.disconnect();
    assetGain.disconnect();
  };
  source.start(startTime + 0.025);
  return nextSession;
}

function createGameBgmController() {
  let graph = null;
  let session = null;
  let volume = DEFAULT_GAME_BGM_VOLUME;
  let visible = true;
  let duckMultiplier = 1;
  let duckTimer = null;
  let startRequestId = 0;
  const renderedTrackCache = new Map();

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
    startRequestId += 1;
    stopSession(session);
    session = null;
    if (typeof document !== 'undefined') {
      document.documentElement.dataset.gameBgmState = 'paused';
      delete document.documentElement.dataset.gameBgmTheme;
      delete document.documentElement.dataset.gameBgmSection;
      delete document.documentElement.dataset.gameBgmFx;
      delete document.documentElement.dataset.gameBgmOrchestration;
      delete document.documentElement.dataset.gameBgmSource;
      delete document.documentElement.dataset.gameBgmAsset;
      delete document.documentElement.dataset.gameBgmAssetStatus;
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

    const profile = gameBgmProfile(nextTheme);
    const renderedTrack = gameBgmRenderedTrack(nextTheme);
    const requestId = ++startRequestId;
    stopSession(session, clamp(profile.crossfadeSeconds || 0.26, 0.18, 2.5));
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
      document.documentElement.dataset.gameBgmSource = 'synth';
      if (renderedTrack) {
        const activeGraph = graph;
        document.documentElement.dataset.gameBgmAssetStatus = 'loading';
        void loadRenderedTrackBuffer(activeContext, renderedTrack, renderedTrackCache)
          .then((audioBuffer) => {
            if (
              requestId !== startRequestId
              || session !== nextSession
              || graph !== activeGraph
              || activeGraph.ctx.state === 'closed'
            ) return;
            const renderedStart = activeGraph.ctx.currentTime;
            const renderedSession = createRenderedTrackSession(
              activeGraph,
              profile,
              nextTheme,
              renderedTrack,
              audioBuffer,
              renderedStart,
            );
            session = renderedSession;
            stopSession(nextSession, clamp(profile.crossfadeSeconds || 0.5, 0.35, 2.5));
            document.documentElement.dataset.gameBgmSource = 'rendered';
            document.documentElement.dataset.gameBgmAsset = renderedTrack.src;
            document.documentElement.dataset.gameBgmAssetStatus = 'ready';
          })
          .catch(() => {
            if (requestId !== startRequestId) return;
            document.documentElement.dataset.gameBgmAssetStatus = 'fallback';
          });
      } else {
        delete document.documentElement.dataset.gameBgmAsset;
        delete document.documentElement.dataset.gameBgmAssetStatus;
      }
      return true;
    } catch {
      stopSession(nextSession);
      session = null;
      return false;
    }
  };

  return {
    destroy() {
      startRequestId += 1;
      stopSession(session, 0.05);
      session = null;
      if (duckTimer) window.clearTimeout(duckTimer);
      duckTimer = null;
      const currentGraph = graph;
      graph = null;
      renderedTrackCache.clear();
      if (currentGraph && currentGraph.ctx.state !== 'closed') void currentGraph.ctx.close();
      if (typeof document !== 'undefined') {
        delete document.documentElement.dataset.gameBgmContext;
        delete document.documentElement.dataset.gameBgmDuck;
        delete document.documentElement.dataset.gameBgmDuckAt;
        delete document.documentElement.dataset.gameBgmFx;
        delete document.documentElement.dataset.gameBgmOrchestration;
        delete document.documentElement.dataset.gameBgmSource;
        delete document.documentElement.dataset.gameBgmAsset;
        delete document.documentElement.dataset.gameBgmAssetStatus;
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
  icon: 'music',
  isAvailable: false,
  label: '',
  playing: false,
  setMusicScene: () => '',
  setVolume: () => DEFAULT_GAME_BGM_VOLUME,
  toggleMusic: () => false,
  volume: DEFAULT_GAME_BGM_VOLUME,
});

export function useGameBgm() {
  return useContext(GameBgmContext) || FALLBACK_BGM_VALUE;
}

export default function GameBgmProvider({ children }) {
  const pathname = usePathname();
  const routeTheme = gameAudioThemeForPath(pathname);
  const [sceneRequest, setSceneRequest] = useState({ pathname: '', theme: '' });
  const activeTheme = sceneRequest.pathname === pathname && sceneRequest.theme
    ? sceneRequest.theme
    : routeTheme;
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

  const setMusicScene = useCallback((theme = '') => {
    const nextTheme = String(theme || '').trim().toLowerCase();
    setSceneRequest((current) => (
      current.pathname === pathname && current.theme === nextTheme
        ? current
        : { pathname, theme: nextTheme }
    ));
    return nextTheme;
  }, [pathname]);

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
    icon: activeProfile.icon || 'music',
    isAvailable: Boolean(activeTheme),
    label: activeProfile.label,
    playing: enabled && Boolean(activeTheme),
    setMusicScene,
    setVolume,
    toggleMusic,
    volume,
  };

  return <GameBgmContext.Provider value={value}>{children}</GameBgmContext.Provider>;
}
