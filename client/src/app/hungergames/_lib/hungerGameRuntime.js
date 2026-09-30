import { normalizeHungerConfig, normalizeHungerEvent } from './hungerGameContract.js';

const PROTECTIONS = Object.freeze({
  lightning: { immune: ['lightning_immune'], resistant: ['lightning_resistant'] },
  fire: { immune: ['fire_immune'], resistant: ['fire_resistant'] },
  drowning: { immune: ['underwater_breathing'], resistant: [] },
  poison: { immune: ['poison_immune'], resistant: ['poison_resistant'] },
  cold: { immune: ['cold_immune'], resistant: ['cold_resistant'] },
});

export function hungerProtection(actor, cause) {
  const rules = PROTECTIONS[cause];
  const traits = Array.isArray(actor?.hungerTraits) ? actor.hungerTraits : [];
  if (rules?.immune.some((key) => traits.includes(key))) return 'immune';
  if (rules?.resistant.some((key) => traits.includes(key))) return 'resistant';
  return 'normal';
}

function hashSeed(seed) {
  let value = 2166136261;
  for (let index = 0; index < seed.length; index += 1) value = Math.imul(value ^ seed.charCodeAt(index), 16777619);
  return value >>> 0;
}
function randomStream(value) {
  const cursor = { value };
  const random = () => {
    cursor.value = (cursor.value + 0x6D2B79F5) >>> 0;
    let next = cursor.value;
    next = Math.imul(next ^ (next >>> 15), next | 1);
    next ^= next + Math.imul(next ^ (next >>> 7), next | 61);
    return ((next ^ (next >>> 14)) >>> 0) / 4294967296;
  };
  return { cursor, random };
}
function shuffle(rows, random) {
  const result = [...rows];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const other = Math.floor(random() * (index + 1));
    [result[index], result[other]] = [result[other], result[index]];
  }
  return result;
}
function weighted(rows, random, score = (row) => row.weight) {
  const sum = rows.reduce((total, row) => total + score(row), 0);
  let cursor = random() * sum;
  for (const row of rows) {
    cursor -= score(row);
    if (cursor < 0) return row;
  }
  return rows.at(-1);
}
function aliveCount(state) { return state.actors.filter((actor) => actor.alive).length; }
function samePair(row, left, right) {
  return (row.leftId === left && row.rightId === right) || (row.leftId === right && row.rightId === left);
}
function roleMatches(actor, role) {
  return actor.alive && role.allTraits.every((key) => actor.hungerTraits.includes(key))
    && role.noneTraits.every((key) => !actor.hungerTraits.includes(key))
    && (role.status === 'any' || (role.status === 'injured' ? actor.injured : !actor.injured))
    && (!role.requiredItem || actor.items.includes(role.requiredItem));
}
function relationsMatch(state, event, cast) {
  return event.relations.every((relation) => {
    const left = cast[relation.left]; const right = cast[relation.right];
    if (!left || !right) return true; // Partial assignment; complete casts are checked again.
    const teammate = Boolean(left.teamId && left.teamId === right.teamId);
    if (relation.kind === 'same_team') return teammate;
    if (relation.kind === 'not_teammate') return !teammate;
    return state.relationships.some((row) => samePair(row, left.id, right.id) && row.kind === relation.kind);
  });
}
function contextMatches(state, event) {
  const used = Object.hasOwn(state.usage, event.id) ? state.usage[event.id] : null;
  return event.enabled && event.phases.includes(state.phase) && event.weather.includes(state.weather)
    && event.locations.includes(state.location) && state.day >= event.minDay && state.day <= event.maxDay
    && (!event.maxUses || (used?.count || 0) < event.maxUses)
    && (!used || !event.cooldownPhases || state.phaseIndex - used.lastPhase > event.cooldownPhases);
}

function eligibleOutcomes(state, event, cast, partial = false) {
  return event.outcomes.map((outcome) => {
    if (outcome.when && cast[outcome.when.role] && hungerProtection(cast[outcome.when.role], outcome.when.cause) !== outcome.when.protection) return null;
    const deaths = new Set();
    const inventories = new Map(Object.values(cast).map((actor) => [actor.id, [...actor.items]]));
    let weight = outcome.weight;
    for (const effect of outcome.effects) {
      const actor = cast[effect.target];
      if (!actor) { if (partial) continue; return null; }
      if (['death', 'injure'].includes(effect.type)) {
        const protection = hungerProtection(actor, effect.cause);
        if (protection === 'immune') return null; // All harmful effects, not just the authored lethal branch.
        if (protection === 'resistant' && effect.type === 'death') weight *= 0.2;
      }
      if (effect.type === 'death') deaths.add(actor.id);
      if (effect.type === 'heal' && !actor.injured) return null;
      if (effect.type === 'injure' && actor.injured) return null;
      if (effect.type === 'lose_item') {
        const items = inventories.get(actor.id); const index = items.indexOf(effect.item);
        if (index < 0) return null;
        items.splice(index, 1);
      }
      if (effect.type === 'gain_item') {
        const items = inventories.get(actor.id);
        if (items.includes(effect.item) || items.length >= 12) return null;
        items.push(effect.item);
      }
    }
    if (deaths.size >= aliveCount(state)) return null; // An event cannot erase the final survivor.
    return { outcome, weight };
  }).filter(Boolean);
}

export function inspectHungerEvent(state, rawEvent, casting) {
  const event = normalizeHungerEvent(rawEvent);
  if (!contextMatches(state, event)) return { eligible: false, reason: '시점·날씨·장소 또는 등장 횟수 조건이 맞지 않습니다.', outcomes: [] };
  const cast = {};
  for (const role of event.roles) {
    const actor = state.actors.find((row) => row.id === casting?.[role.key]);
    if (!actor || !roleMatches(actor, role)) return { eligible: false, reason: role.label + '의 참가자 조건이 맞지 않습니다.', outcomes: [] };
    cast[role.key] = actor;
  }
  if (new Set(Object.values(cast).map((actor) => actor.id)).size !== event.roles.length) return { eligible: false, reason: '한 참가자가 여러 역할을 맡을 수 없습니다.', outcomes: [] };
  if (!relationsMatch(state, event, cast)) return { eligible: false, reason: '참가자 관계 조건이 맞지 않습니다.', outcomes: [] };
  const outcomes = eligibleOutcomes(state, event, cast);
  return { eligible: outcomes.length > 0, reason: outcomes.length ? '' : '면역·아이템·생존 조건에 맞는 결과가 없습니다.', outcomes: outcomes.map((row) => ({ label: row.outcome.label, weight: row.weight })), cast };
}

function findCast(state, event, available, random) {
  const candidates = event.roles.map((role) => ({ role, actors: shuffle(state.actors.filter((actor) => available.has(actor.id) && roleMatches(actor, role)
    && eligibleOutcomes(state, event, { [role.key]: actor }, true).length), random) }));
  if (candidates.some((row) => !row.actors.length)) return null;
  candidates.sort((left, right) => left.actors.length - right.actors.length);
  const cast = {}; const assigned = new Set(); let visits = 0;
  const search = (index) => {
    if (++visits > 12000) return null;
    if (index === candidates.length) return eligibleOutcomes(state, event, cast).length ? { ...cast } : null;
    const { role, actors } = candidates[index];
    for (const actor of actors) {
      if (assigned.has(actor.id)) continue;
      cast[role.key] = actor; assigned.add(actor.id);
      const result = relationsMatch(state, event, cast) && eligibleOutcomes(state, event, cast, true).length ? search(index + 1) : null;
      if (result) return result;
      assigned.delete(actor.id); delete cast[role.key];
    }
    return null;
  };
  return search(0);
}

function commitEvent(state, event, cast, selected) {
  const actors = new Map(state.actors.map((actor) => [actor.id, actor]));
  const effects = [];
  for (const effect of selected.effects) {
    const actor = actors.get(cast[effect.target].id);
    const receipt = { ...effect, actorId: actor.id, actorName: actor.name };
    if (effect.type === 'death') {
      actor.alive = false;
      actor.death = { cause: effect.cause, phaseIndex: state.phaseIndex, eventId: event.id };
      if (effect.source) {
        const killer = actors.get(cast[effect.source].id); killer.kills += 1;
        receipt.sourceId = killer.id;
      }
    }
    if (effect.type === 'injure') actor.injured = true;
    if (effect.type === 'heal') actor.injured = false;
    if (effect.type === 'gain_item') actor.items.push(effect.item);
    if (effect.type === 'lose_item') actor.items.splice(actor.items.indexOf(effect.item), 1);
    if (['ally', 'enemy'].includes(effect.type)) {
      const other = actors.get(cast[effect.other].id);
      state.relationships = state.relationships.filter((row) => !samePair(row, actor.id, other.id));
      state.relationships.push({ leftId: actor.id, rightId: other.id, kind: effect.type });
      receipt.otherId = other.id;
    }
    effects.push(receipt);
  }
  const previous = Object.hasOwn(state.usage, event.id) ? state.usage[event.id] : null;
  state.usage[event.id] = { count: (previous?.count || 0) + 1, lastPhase: state.phaseIndex };
  return { eventId: event.id, title: event.title, outcome: selected.label,
    participants: event.roles.map((role) => ({ id: cast[role.key].id, name: cast[role.key].name, role: role.key })),
    text: selected.text.replace(/\{([a-z][a-z0-9_]*)\}/g, (_, key) => cast[key].name), effects };
}

// Public resolver is atomic and also rechecks previously selected participant IDs.
export function resolveHungerEvent(state, rawEvent, casting) {
  const event = normalizeHungerEvent(rawEvent);
  const inspection = inspectHungerEvent(state, event, casting);
  if (!inspection.eligible) return { state, row: null, reason: inspection.reason };
  const next = structuredClone(state); const stream = randomStream(next.rngState);
  const selected = weighted(eligibleOutcomes(next, event, inspection.cast), stream.random).outcome;
  const row = commitEvent(next, event, inspection.cast, selected);
  next.rngState = stream.cursor.value;
  return { state: next, row, reason: '' };
}

export function createHungerRun(raw) {
  const input = normalizeHungerConfig(raw);
  if (input.roster.length < 2) throw new Error('경기 시작에는 참가자가 2명 이상 필요합니다.');
  return { input, actors: input.roster.map((actor) => ({ ...structuredClone(actor), alive: true, injured: false, kills: 0, death: null })),
    rngState: hashSeed(input.seed), phaseIndex: -1, day: 0, phase: 'opening', weather: 'clear', location: 'camp',
    usage: {}, relationships: [], history: [], finished: false, winnerId: null, endReason: '' };
}

export function advanceHungerRun(state) {
  if (state.finished) return state;
  const next = structuredClone(state); const stream = randomStream(next.rngState); const random = stream.random;
  next.phaseIndex += 1;
  next.day = Math.ceil(next.phaseIndex / 2);
  next.phase = next.phaseIndex === 0 ? 'opening' : next.phaseIndex === 7 ? 'feast' : next.phaseIndex % 2 ? 'day' : 'night';
  next.weather = weighted([{ value: 'clear', weight: 4 }, { value: 'rain', weight: 2 }, { value: 'storm', weight: 2 }, { value: 'cold', weight: 1 }], random).value;
  next.location = ['forest', 'river', 'camp', 'ruins'][Math.floor(random() * 4)];
  const available = new Set(shuffle(next.actors.filter((actor) => actor.alive).map((actor) => actor.id), random));
  const phase = { index: next.phaseIndex, day: next.day, phase: next.phase, weather: next.weather, location: next.location, rows: [] };
  while (available.size && aliveCount(next) > 1) {
    const candidates = [];
    for (const event of next.input.events) {
      if (!contextMatches(next, event)) continue;
      const cast = findCast(next, event, available, random);
      if (cast) candidates.push({ event, cast, weight: event.weight });
    }
    if (candidates.length) {
      const candidate = weighted(candidates, random);
      const result = weighted(eligibleOutcomes(next, candidate.event, candidate.cast), random).outcome;
      phase.rows.push(commitEvent(next, candidate.event, candidate.cast, result));
      Object.values(candidate.cast).forEach((actor) => available.delete(actor.id));
    } else {
      // Removing an idle actor cannot create a valid cast; avoid retrying the
      // same incompatible pool for every remaining participant.
      for (const id of available) {
        const actor = next.actors.find((row) => row.id === id);
        phase.rows.push({ eventId: 'system-rest', title: '잠시 휴식', outcome: '휴식', text: actor.name + '은 주변을 살피며 조용히 휴식한다.',
          participants: [{ id, name: actor.name, role: 'actor' }], effects: [] });
      }
      available.clear();
    }
  }
  phase.rows.forEach((row, index) => { row.id = next.phaseIndex + '-' + index; });
  next.history.push(phase); next.rngState = stream.cursor.value;
  const survivors = next.actors.filter((actor) => actor.alive);
  if (survivors.length === 1) {
    next.finished = true; next.winnerId = survivors[0].id; next.endReason = 'last_survivor';
  } else if (next.history.length >= next.input.maxPhases) {
    next.finished = true; next.endReason = 'phase_limit';
  }
  return next;
}

export function replayHungerRun(config, phases) {
  if (!Number.isInteger(phases) || phases < 0 || phases > 120) throw new Error('저장된 진행 수가 올바르지 않습니다.');
  let run = createHungerRun(config);
  for (let index = 0; index < phases; index += 1) {
    if (run.finished) throw new Error('경기 종료 이후의 진행 기록은 불러올 수 없습니다.');
    run = advanceHungerRun(run);
  }
  return run;
}
