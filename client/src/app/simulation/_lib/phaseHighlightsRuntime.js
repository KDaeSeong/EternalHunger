import { describeObserverEvent, observerEventActorIds } from './teamObserverRuntime.js';
import { formatClock } from './simulationFormattingRuntime.js';

const list = (value) => Array.isArray(value) ? value : [];
const idOf = (actor) => String(actor?._id || actor?.id || '');

function category(event) {
  if (event.kind === 'team_status' && ['eliminated', 'revival_pending'].includes(event.status)) return ['survival', 6, '팀 생존'];
  if (event.kind === 'death' || event.kind === 'elimination') return ['combat', 5, '탈락'];
  if (event.kind === 'revive') return ['survival', 6, '부활'];
  if (event.kind === 'craft') return ['growth', 3, '장비·아이템 제작'];
  if (event.kind === 'objective' && event.success) return ['growth', 3, '자원 확보'];
  if (['heal', 'use'].includes(event.kind) && Number(event.heal) > 0) return ['healing', 4, '실제 체력 회복'];
  if (event.kind === 'retreat' || (event.kind === 'team_decision' && /flee|avoid|retreat/.test(event.reason || ''))) return ['movement', 4, '후퇴 판단'];
  if (event.kind === 'team_regroup' && !event.cleared) return ['movement', 2, '팀 합류'];
  if (event.kind === 'growth_plan') return ['growth', 1, '성장 목표'];
  return null;
}

// Read committed receipts only. Rendering cannot spend resources, plan moves,
// consume randomness, or turn an authored goal into a completed acquisition.
export function buildPhaseHighlights({ events = [], survivors = [], dead = [], model, day, phase,
  matchSec = 0, zoneName = String } = {}) {
  const actors = new Map([...list(dead), ...list(survivors)].map((actor) => [idOf(actor), actor]));
  const tracked = new Set(list(model?.trackedActorIds));
  const nameOf = (id) => actors.get(String(id))?.name || String(id || '참가자 미상');
  const groups = new Map();
  list(events).forEach((event, index) => {
    const sec = Number(event?.at?.sec);
    if (!event || Number(event.at?.day) !== Number(day) || event.at?.phase !== phase
      || event.at?.sec == null || !Number.isFinite(sec) || sec < 0 || sec > matchSec) return;
    if (tracked.size && !observerEventActorIds(event).some((id) => tracked.has(id))
      && !(event.kind === 'team_status' && String(event.teamId) === String(model?.team?.id))) return;
    const kind = category(event);
    if (!kind) return;
    const text = describeObserverEvent(event, { nameOf, zoneName });
    if (!text) return;
    const [group, priority, label] = kind;
    const previous = groups.get(group);
    if (!previous || priority > previous.priority || (priority === previous.priority && sec >= previous.sec)) {
      groups.set(group, { key: `${group}:${sec}:${index}`, group, priority, label, text, sec, clock: formatClock(sec) });
    }
  });
  const highlights = [...groups.values()].sort((a, b) => b.priority - a.priority || b.sec - a.sec).slice(0, 3);
  if (highlights.length < 3) {
    const atRisk = list(model?.members).filter((actor) => actor.alive && actor.maxHp > 0 && actor.hp / actor.maxHp <= 0.35);
    if (atRisk.length) highlights.push({ key: 'current-risk', label: '현재 저체력',
      text: `${atRisk.map((actor) => actor.name).join(', ')} · HP 35% 이하. 치료와 후퇴 판단을 살펴보세요.` });
  }
  if (highlights.length < 3 && !groups.has('growth')) {
    const growing = list(model?.members).find((actor) => actor.alive && actor.growth?.status === 'growing');
    if (growing) highlights.push({ key: 'current-growth', label: '현재 성장 목표',
      text: `${growing.name} · ${growing.growth.label}${growing.growth.materials ? ' · ' + growing.growth.materials : ''}` });
  }
  if (highlights.length < 3 && list(model?.objectives).length) {
    const goal = model.objectives[0];
    highlights.push({ key: 'current-objective', label: '현재 자원 목표', text: `${goal.label} · ${goal.zone} · 아직 획득 전` });
  }
  return highlights.slice(0, 3);
}
