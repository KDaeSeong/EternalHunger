import { CHARACTER_EFFECTS } from './autochessCharacterEffects.js';
import { STUDENT_BY_ID } from './autochessData.js';

const PRIORITY = { attack: 1, shield: 3, buff: 4, heal: 4, skill: 5 };
const tone = (frequency, endFrequency, duration, gain, type = 'triangle', start = 0) =>
  ({ frequency, endFrequency, duration, gain, type, start, reverb: .06 });
const noise = (frequency, duration, gain, filterType = 'bandpass', start = 0) =>
  ({ source: 'noise', frequency, duration, gain, filterType, start, q: 1.4, reverb: .03 });

export function characterSoundVoices(studentId, kind) {
  const profile = CHARACTER_EFFECTS[studentId];
  if (!profile || !Object.hasOwn(PRIORITY, kind)) return [];
  const p = profile.pitch, skill = kind !== 'attack';
  let voices;
  if (kind === 'shield' && STUDENT_BY_ID[studentId].skill !== 'shield') {
    voices = [tone(p, p * 1.5, .09, .2, 'sine'), tone(p * 2, p * 2.4, .12, .15, 'sine', .04)];
  } else if (profile.timbre === 'rifle') {
    voices = [noise(2600 + p, .035, .34, 'highpass'), tone(p * 2, p * .6, .065, .25)];
  } else if (profile.timbre === 'heavy') {
    voices = [noise(650 + p, .075, .38), tone(p, p * .45, .095, .33)];
  } else if (profile.timbre === 'scatter') {
    voices = [noise(1200 + p, .085, .38), tone(p, p * .4, .08, .26)];
  } else if (profile.timbre === 'laser') {
    voices = [tone(p * 2, p * 4, .09, .25, 'sine'), tone(p, p * .65, .1, .2)];
  } else if (profile.timbre === 'digital') {
    voices = [tone(p, p * 1.12, .045, .15, 'square'), tone(p * 1.5, p, .06, .17, 'square', .035)];
  } else if (profile.timbre === 'blade') {
    voices = [noise(1700 + p, .045, .27, 'highpass'), tone(p * 3, p * .7, .085, .21, 'sawtooth')];
  } else if (profile.timbre === 'electric') {
    voices = [tone(p * .7, p * 2, .055, .18, 'sawtooth'), noise(2200 + p, .04, .24, 'highpass')];
  } else if (profile.timbre === 'wind') {
    voices = [noise(1500, .1, .23, 'lowpass'), tone(p, p * 1.5, .09, .18, 'sine')];
  } else if (profile.timbre === 'stone') {
    voices = [tone(p, p * .45, .09, .32), tone(p * 2.5, p * 2, .08, .18, 'sine', .025)];
  } else if (profile.timbre === 'blast') {
    voices = [noise(700, .1, .36, 'lowpass'), tone(p, p * .35, .12, .3)];
  } else {
    voices = [tone(p, p, .09, .22, 'sine'), tone(p * 1.5, p * 1.7, .1, .17, 'sine', .04)];
  }
  if (skill) {
    voices = voices.map(spec => ({ ...spec, duration: Math.min(.16, spec.duration * 1.3), gain: spec.gain * 1.08 }));
    voices.push(tone(p * 2, p * (kind === 'heal' ? 3 : 1.25), .13, .21, 'sine', .04));
    voices.push(kind === 'skill' && ['heavy','blast','scatter'].includes(profile.timbre)
      ? noise(950 + p, .11, .24, 'bandpass', .07)
      : tone(p * (kind === 'buff' ? 2.5 : 3), p * 4, .12, .15, 'triangle', .085));
  }
  return voices;
}

export function combatSoundCue(watch, index) {
  const frame = watch?.frames?.[index];
  if (!frame || !frame[2]?.length) return '';
  const previous = watch.frames[index - 1];
  if (previous && JSON.stringify([previous[1], previous[2]]) === JSON.stringify([frame[1], frame[2]])) return '';
  const actors = new Map(frame[1].map(actor => [actor[0], actor]));
  const actions = new Map();
  for (const event of frame[2]) {
    const actor = actors.get(event[0]), kind = event[2];
    if (!actor || !CHARACTER_EFFECTS[actor[1]] || !Object.hasOwn(PRIORITY, kind)) continue;
    if (!actions.has(actor[0]) || PRIORITY[kind] > PRIORITY[actions.get(actor[0]).kind])
      actions.set(actor[0], { studentId: actor[1], kind, pan: Math.round(((actor[3] + .5) / 6 - .5) * 160) / 100 });
  }
  const selected = [...actions.values()].sort((a, b) => PRIORITY[b.kind] - PRIORITY[a.kind]).slice(0, 3);
  return selected.length ? 'autochess:' + JSON.stringify(selected.map(action => [action.studentId, action.kind, action.pan])) : '';
}

export function autochessCueProfile(cue) {
  if (!String(cue).startsWith('autochess:')) return null;
  try {
    const rows = JSON.parse(cue.slice(10));
    if (!Array.isArray(rows) || rows.length > 3) return [];
    const scale = 1 / Math.sqrt(Math.max(1, rows.length));
    return rows.flatMap(([studentId, kind, pan]) => characterSoundVoices(studentId, kind)
      .map(spec => ({ ...spec, pan: Math.max(-.8, Math.min(.8, Number(pan) || 0)), gain: spec.gain * scale }))).slice(0, 12);
  } catch { return []; }
}

export function shouldPlayCombatFrame(previous, current) {
  return Boolean(previous && current.active && !current.paused && !current.hidden &&
    previous.key === current.key && current.index > previous.index);
}

export function createEffectPreview(studentId, kind = '', sequence = 0) {
  const student = STUDENT_BY_ID[studentId] || STUDENT_BY_ID.serika;
  const effectKind = !kind ? '' : kind === 'attack' ? 'attack' : student.skill === 'rally' ? 'buff'
    : ['heal', 'shield'].includes(student.skill) ? student.skill : 'skill';
  const friendlyTarget = ['heal','shield','buff'].includes(effectKind);
  const source = ['p0-u1', student.id, 0, 1, 5, student.hp, student.hp, 0, 0, 1];
  const target = ['p1-u1', student.id, 1, 4, 2, student.hp, student.hp, 0, 0, 1];
  const amount = effectKind === 'buff' ? 20 : Math.round(student.atk * (kind === 'attack' ? 1 : 2.4));
  const player = { id: 'p0', name: student.name, units: [] };
  const watch = { round: sequence + 1, left: { id: 'p0', name: student.name }, right: { id: 'p1', name: '연습 상대' },
    frames: [[.4, [source, target], effectKind ? [[source[0], friendlyTarget ? source[0] : target[0], effectKind, amount]] : []]] };
  return { player, watch };
}
