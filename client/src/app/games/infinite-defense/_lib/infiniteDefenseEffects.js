import { CHARACTER_EFFECTS, characterTrails } from '../../kivotos-autochess/_lib/autochessCharacterEffects.js';
import { MAP, STUDENTS, ENEMY_TYPES } from './infiniteDefenseData.js';
import { advanceTime, createNewState, wavePlan } from './infiniteDefenseEngine.js';

const YUZU_SIGIL = 'M10 14L15 7H33L38 14L43 34L37 40L29 32H19L11 40L5 34ZM12 23H22M17 18V28M31 20H34M35 26H38M24 10V16';
const YUZU = Object.freeze({ id: 'yuzu', accent: '#ffba8a', pitch: 233, timbre: 'blast', attackLabel: '주황 유탄',
  attack: { motif: 'grenade-pad', trail: 'arc', count: 2, spread: 33, sigil: YUZU_SIGIL, accent: '#ffba8a', size: 30, glyph: '·' },
  skill: { motif: 'grenade-pad', trail: 'arc', count: 4, spread: 44, sigil: YUZU_SIGIL, accent: '#ffba8a', size: 64, glyph: '✦' },
});
export const DEFENSE_CHARACTER_EFFECTS = Object.freeze(Object.fromEntries(STUDENTS.map(student =>
  [student.id, student.id === 'yuzu' ? YUZU : CHARACTER_EFFECTS[student.id]])));
export const MAX_VISIBLE_DEFENSE_IMPACTS = 32;
const BY_ID = Object.fromEntries(STUDENTS.map(student => [student.id, student]));
const finitePoint = p => p && Number.isFinite(p.x) && Number.isFinite(p.y);
const point = p => ({ x: p.x * 100, y: p.y * 100 });

export function defenseEffectEvents(state) {
  return (state.effects || []).slice(-24).flatMap(event => {
    const studentId = event.studentId || STUDENTS.find(student => String(event.id).startsWith(student.id + '-'))?.id;
    if (!BY_ID[studentId] || !finitePoint(event.from) || !finitePoint(event.to)) return [];
    const mine = event.kind === 'mine';
    const hits = mine ? [] : Array.isArray(event.hits) ? event.hits.filter(hit => finitePoint(hit.point) && ENEMY_TYPES[hit.type])
      : [{ id: event.id, type: '', point: event.to, damage: 0, killed: false, slowed: false }];
    return [{ ...event, studentId, student: BY_ID[studentId], kind: mine ? 'mine' : 'attack',
      traits: Array.isArray(event.traits) ? event.traits.filter(trait => ['splash','pierce','slow','precision'].includes(trait)) : [],
      hits, abilityName: event.abilityName || BY_ID[studentId].role }];
  });
}

export function defensePresentation(state, stage = '') {
  const events = defenseEffectEvents(state), primary = [], extras = [], casts = new Map(), areas = [], actions = [];
  const clusters = [];
  for (const event of events) {
    const mine = event.kind === 'mine', signature = mine || stage === 'skill' || stage !== 'attack' && event.traits.length > 0;
    const kind = mine ? 'buff' : signature ? 'skill' : 'attack', profile = DEFENSE_CHARACTER_EFFECTS[event.studentId][signature ? 'skill' : 'attack'];
    const from = { uid: event.studentId, studentId: event.studentId, name: event.student.name, badge: '아군', tone: 'blue', point: point(event.from) };
    const hits = mine ? [{ id: 'mine', type: '', point: event.to, damage: 0, killed: false, slowed: false }] : event.hits;
    hits.forEach((hit, index) => {
      if (index > 0 && extras.length >= MAX_VISIBLE_DEFENSE_IMPACTS) return;
      const to = { uid: mine ? 'mine' : 'enemy-' + hit.id, name: mine ? '채굴장' : (ENEMY_TYPES[hit.type]?.name || '표적'),
        badge: mine ? '아군' : '적군', tone: mine ? 'blue' : 'red', point: point(hit.point) };
      const fx = { id: event.id + ':' + hit.id, from, to, kind, profile, label: event.abilityName,
        variant: hit.slowed ? 'slow' : event.traits.includes('splash') ? 'blast' : event.traits.includes('pierce') ? 'pierce' : kind,
        color: mine ? '#e1aeff' : signature ? '#ffda79' : '#75d9ff', teamColor: '#75d9ff', harmful: !mine,
        amount: hit.damage, amountLabel: mine ? '생산 지원' : hit.damage > 0 ? '−' + hit.damage : '명중',
        x: Math.max(.2, Math.min(MAP.width - .2, hit.point.x)) / MAP.width * 100,
        y: Math.max(.2, Math.min(MAP.height - .2, hit.point.y)) / MAP.height * 100, killed: hit.killed, numberBelow: hit.point.y < 2 };
      const dx = to.point.x-from.point.x, dy = to.point.y-from.point.y, length = Math.hypot(dx,dy);
      if (index === 0 && !mine && length > 0) {
        const ux=dx/length,uy=dy/length,start=Math.min(40,length*.25),end=Math.min(28,length*.25);
        const ex=to.point.x-ux*end,ey=to.point.y-uy*end;
        fx.link={x1:from.point.x+ux*start,y1:from.point.y+uy*start,x2:ex,y2:ey,
          arrow:[ex+','+ey,(ex-ux*18-uy*9)+','+(ey-uy*18+ux*9),(ex-ux*18+uy*9)+','+(ey-uy*18-ux*9)].join(' ')};
      }
      (index === 0 ? primary : extras).push(fx);
    });
    if (signature) casts.set(from.uid, { ...from, kind, color: profile.accent, label: event.abilityName, profile });
    if (event.radius > 0) areas.push({ id: event.id, point: point(event.to), radius: event.radius*100, color: profile.accent });
    actions.push({ id: event.id, studentId: event.studentId, name: event.student.name, label: event.abilityName,
      target: mine ? '채굴장' : event.hits[0] ? (ENEMY_TYPES[event.hits[0].type]?.name || '표적') : '표적', count: event.hits.length,
      damage: Math.round(event.hits.reduce((sum,hit)=>sum+hit.damage,0)*1000)/1000, traits: event.traits, mine });
  }
  const effects = [...primary, ...extras].slice(0,MAX_VISIBLE_DEFENSE_IMPACTS);
  for (const fx of effects) {
    let cluster=clusters.find(row=>Math.abs(row.x-fx.to.point.x)<80&&Math.abs(row.y-fx.to.point.y)<70);
    if(!cluster){cluster={x:fx.to.point.x,y:fx.to.point.y,count:0};clusters.push(cluster);}
    fx.stack=Math.min(3,cluster.count++);if(cluster.count>4)fx.amountLabel='';
  }
  const fallen=[...new Map(effects.filter(fx=>fx.killed).map(fx=>[fx.to.uid,fx.to])).values()];
  return { effects, casts:[...casts.values()], fallen, areas, actions:actions.reverse() };
}

export function createDefenseEffectPreview(studentId, stage = '', sequence = 0) {
  const student=BY_ID[studentId]||STUDENTS[0],state=createNewState({now:0,runId:'defense-preview-'+sequence});
  if (student.id==='noa' && stage==='skill') {
    state.assignments.noa={...state.assignments.noa,mode:'mine'};
    state.elapsed=1.9;
  } else {
    state.assignments[student.id]={...state.assignments[student.id],mode:'defend',padId:'p1',paid:true};
    state.phase='wave';state.wave=1;state.spawnIndex=wavePlan(1).length;state.nextEnemyId=3;
    state.enemies=['armored','scout'].map((type,index)=>({id:index+1,type,...ENEMY_TYPES[type],maxHp:ENEMY_TYPES[type].hp,
      distance:5.2-index*.6,slowUntil:0,slowFactor:0}));
  }
  const preview=stage?advanceTime(state,.1):state;
  return { ...preview, paused:true, effects:stage?preview.effects:[] };
}

export { characterTrails };
