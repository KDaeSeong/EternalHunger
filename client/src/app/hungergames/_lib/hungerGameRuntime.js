import { normalizeHungerConfig, normalizeHungerEvent, normalizeHungerRulesVersion } from './hungerGameContract.js';
import { renderHungerText } from './hungerGameText.js';

const PROTECTIONS = Object.freeze({
  lightning: { immune: ['lightning_immune'], resistant: ['lightning_resistant'] },
  fire: { immune: ['fire_immune'], resistant: ['fire_resistant'] },
  drowning: { immune: ['underwater_breathing'], resistant: [] },
  poison: { immune: ['poison_immune'], resistant: ['poison_resistant'] },
  cold: { immune: ['cold_immune'], resistant: ['cold_resistant'] },
  physical: { immune: ['physical_immune'], resistant: ['physical_resistant'] },
  lightning_attack: { immune: ['lightning_attack_immune'], resistant: ['lightning_attack_resistant'] },
  fire_attack: { immune: ['fire_attack_immune'], resistant: ['fire_attack_resistant'] },
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
function areTeammates(state, left, right) {
  return Boolean((state.rulesVersion < 3 || state.rulesVersion === undefined || state.input?.matchMode === 'team')
    && left.teamId && left.teamId === right.teamId);
}
function lastTeam(state) {
  if (state.rulesVersion < 3 || state.rulesVersion === undefined || state.input?.matchMode !== 'team') return null;
  const survivors = state.actors.filter((actor) => actor.alive);
  const teamOf = (actor) => actor.teamId ? 'team:' + actor.teamId : 'solo:' + actor.id;
  return survivors.length && survivors.every((actor) => teamOf(actor) === teamOf(survivors[0])) ? survivors : null;
}
export function hungerFinalDuelPressure(state) {
  if (state.rulesVersion < 2 || state.rulesVersion === undefined || state.phase === 'opening') return 0;
  const survivors = state.actors.filter((actor) => actor.alive);
  if (survivors.length !== 2 || areTeammates(state, survivors[0], survivors[1])) return 0;
  const lastDeath = Math.max(0, ...state.actors.filter((actor) => !actor.alive).map((actor) => actor.death?.phaseIndex ?? 0));
  return Math.max(0, state.phaseIndex - lastDeath);
}
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
    const teammate = areTeammates(state, left, right);
    if (relation.kind === 'same_team') return teammate;
    if (relation.kind === 'not_teammate') return !teammate;
    if (relation.kind === 'not_ally') return !state.relationships.some((row) => samePair(row, left.id, right.id) && row.kind === 'ally');
    return state.relationships.some((row) => samePair(row, left.id, right.id) && row.kind === relation.kind);
  });
}
function contextMatches(state, event) {
  const used = Object.hasOwn(state.usage, event.id) ? state.usage[event.id] : null;
  const survivors = aliveCount(state);
  return event.enabled && event.phases.includes(state.phase) && event.weather.includes(state.weather)
    && event.locations.includes(state.location) && state.day >= event.minDay && state.day <= event.maxDay
    && survivors >= event.minSurvivors && survivors <= event.maxSurvivors
    && (!event.minDuelPhases || hungerFinalDuelPressure(state) >= event.minDuelPhases)
    && (!event.maxUses || (used?.count || 0) < event.maxUses)
    && (!used || !event.cooldownPhases || state.phaseIndex - used.lastPhase > event.cooldownPhases);
}

function eligibleOutcomes(state, event, cast, partial = false) {
  const duelPressure = hungerFinalDuelPressure(state);
  return event.outcomes.map((outcome) => {
    if (outcome.requirements.some((requirement) => cast[requirement.role] && !roleMatches(cast[requirement.role], requirement))) return null;
    if (outcome.when && cast[outcome.when.role] && hungerProtection(cast[outcome.when.role], outcome.when.cause) !== outcome.when.protection) return null;
    const deaths = new Set();
    const inventories = new Map(Object.values(cast).map((actor) => [actor.id, [...actor.items]]));
    let weight = outcome.weight;
    let attack = false;
    for (const effect of outcome.effects) {
      const actor = cast[effect.target];
      if (!actor) { if (partial) continue; return null; }
      if (['death', 'injure'].includes(effect.type)) {
        const protection = hungerProtection(actor, effect.cause);
        if (protection === 'immune') return null; // All harmful effects, not just the authored lethal branch.
        if (protection === 'resistant' && effect.type === 'death') weight *= 0.2;
        if (state.rulesVersion >= 2 && effect.source && cast[effect.source]) {
          attack = true;
          const attacker = cast[effect.source];
          if (attacker.hungerTraits.includes('combat_training')) weight *= 1.75;
          if (actor.hungerTraits.includes('combat_training')) weight /= 1.75;
          if (attacker.injured) weight *= 0.6;
          if (actor.injured) weight *= 1.5;
          if (effect.type === 'death' && effect.cause === 'physical' && actor.hungerTraits.includes('flight')) weight *= 0.5;
          if (duelPressure) weight *= effect.type === 'death' ? Math.min(12, 1 + duelPressure * 1.5) : Math.min(3, 1 + duelPressure * 0.4);
        }
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
    if (duelPressure && !attack && event.outcomes.some((row) => row.effects.some((effect) => ['death', 'injure'].includes(effect.type) && effect.source))) weight /= 1 + duelPressure * 1.5;
    return { outcome, weight };
  }).filter(Boolean);
}

export function inspectHungerEvent(state, rawEvent, casting) {
  const event = normalizeHungerEvent(rawEvent);
  if (!contextMatches(state, event)) return { eligible: false, reason: '시점·날씨·장소·생존자·최종 대치 또는 등장 횟수 조건이 맞지 않습니다.', outcomes: [] };
  const cast = {};
  for (const role of event.roles) {
    const actor = state.actors.find((row) => row.id === casting?.[role.key]);
    if (!actor || !roleMatches(actor, role)) return { eligible: false, reason: role.label + '의 참가자 조건이 맞지 않습니다.', outcomes: [] };
    cast[role.key] = actor;
  }
  if (new Set(Object.values(cast).map((actor) => actor.id)).size !== event.roles.length) return { eligible: false, reason: '한 참가자가 여러 역할을 맡을 수 없습니다.', outcomes: [] };
  if (!relationsMatch(state, event, cast)) return { eligible: false, reason: '참가자 관계 조건이 맞지 않습니다.', outcomes: [] };
  const outcomes = eligibleOutcomes(state, event, cast);
  return { eligible: outcomes.length > 0, reason: outcomes.length ? '' : '특성·면역·아이템·생존 조건에 맞는 결과가 없습니다.', outcomes: outcomes.map((row) => ({ label: row.outcome.label, weight: row.weight })), cast };
}

export function hungerEventSelectionWeight(state, event, cast, phaseRows = []) {
  if (state.rulesVersion < 2 || state.rulesVersion === undefined) return event.weight;
  let weight = event.weight;
  const confrontation = event.outcomes.some((outcome) => outcome.effects.some((effect) => ['death', 'injure'].includes(effect.type) && effect.source));
  const duelPressure = hungerFinalDuelPressure(state);
  if (confrontation) {
    const eliminated = 1 - aliveCount(state) / state.actors.length;
    weight *= Math.min(4, 1 + Math.max(0, state.day - 3) * 0.2 + eliminated * 1.5);
  }
  if (state.rulesVersion >= 3 && aliveCount(state) > 2) {
    // Ordinary rounds leave room for hazards, cooperation and useful supplies;
    // the final duel keeps its existing decisive pressure and immunity rules.
    if (confrontation) weight *= 0.45;
    else if (event.outcomes.some((outcome) => outcome.effects.some((effect) => ['death', 'injure'].includes(effect.type)))) weight *= 1.8;
  }
  if (duelPressure) weight *= confrontation ? Math.min(12, 1 + duelPressure * 2) : 1 / (1 + duelPressure);
  const repeats = phaseRows.filter((row) => row.eventId === event.id).length;
  weight *= 0.2 ** Math.min(repeats, 3);
  const assigned = new Set(Object.values(cast).map((actor) => actor.id));
  for (const phase of state.history.slice(-3)) {
    const rows = phase.rows.filter((row) => row.eventId === event.id);
    if (rows.length) weight *= confrontation ? 0.85 : 0.6;
    if (rows.some((row) => row.participants.some((actor) => assigned.has(actor.id)))) weight *= confrontation ? duelPressure ? 1 : 0.65 : 0.35;
  }
  return Math.max(event.weight * 0.01, weight);
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
      }
    }
    if (effect.type === 'injure') actor.injured = true;
    if (effect.source) receipt.sourceId = cast[effect.source].id;
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
    text: renderHungerText(selected.text, cast), effects };
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

export function createHungerRun(raw, rulesVersion) {
  const input = normalizeHungerConfig(raw);
  const version = normalizeHungerRulesVersion(rulesVersion);
  if (version < 3) {
    delete input.matchMode;
    input.roster.forEach((actor) => { delete actor.districtId; });
  }
  if (input.roster.length < 2) throw new Error('경기 시작에는 참가자가 2명 이상 필요합니다.');
  return { input, rulesVersion: version, actors: input.roster.map((actor) => ({ ...structuredClone(actor), alive: true, injured: false, kills: 0, death: null })),
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
  while (available.size && aliveCount(next) > 1 && !lastTeam(next)) {
    const candidates = [];
    for (const event of next.input.events) {
      if (!contextMatches(next, event)) continue;
      const cast = findCast(next, event, available, random);
      if (cast) candidates.push({ event, cast, weight: hungerEventSelectionWeight(next, event, cast, phase.rows) });
    }
    if (candidates.length) {
      const previousId = phase.rows.at(-1)?.eventId;
      const varied = next.rulesVersion >= 2 ? candidates.filter((candidate) => candidate.event.id !== previousId) : candidates;
      const candidate = weighted(varied.length ? varied : candidates, random);
      const result = weighted(eligibleOutcomes(next, candidate.event, candidate.cast), random).outcome;
      phase.rows.push(commitEvent(next, candidate.event, candidate.cast, result));
      Object.values(candidate.cast).forEach((actor) => available.delete(actor.id));
    } else {
      // Removing an idle actor cannot create a valid cast; avoid retrying the
      // same incompatible pool for every remaining participant.
      for (const id of available) {
        const actor = next.actors.find((row) => row.id === id);
        const rest = actor.hungerTraits.includes('mechanical') ? '{actor}은 주변을 감시하며 절전 모드로 대기한다.'
          : actor.hungerTraits.includes('elemental_body') ? '{actor}은 몸을 이루는 기운을 안정시키며 휴식한다.'
            : '{actor}은 주변을 살피며 조용히 휴식한다.';
        phase.rows.push({ eventId: 'system-rest', title: '잠시 휴식', outcome: '휴식', text: renderHungerText(rest, { actor }),
          participants: [{ id, name: actor.name, role: 'actor' }], effects: [] });
      }
      available.clear();
    }
  }
  phase.rows.forEach((row, index) => { row.id = next.phaseIndex + '-' + index; });
  next.history.push(phase); next.rngState = stream.cursor.value;
  const survivors = next.actors.filter((actor) => actor.alive);
  const winningTeam = lastTeam(next);
  if (winningTeam) {
    next.finished = true; next.endReason = 'last_team';
    next.winnerTeamId = winningTeam[0].teamId || '';
    next.winnerIds = winningTeam.map((actor) => actor.id);
    next.winnerId = winningTeam.length === 1 ? winningTeam[0].id : null;
  } else if (survivors.length === 1) {
    next.finished = true; next.winnerId = survivors[0].id; next.endReason = 'last_survivor';
  } else if (next.history.length >= next.input.maxPhases) {
    next.finished = true; next.endReason = 'phase_limit';
  }
  return next;
}

// Reconstruct presentation state from trusted, replayed event receipts. This
// avoids storing portraits/rosters for every phase and never runs RNG or AI.
export function getHungerHistoryView(run, viewIndex = -1) {
  const index = viewIndex < 0 ? run.history.length - 1 : Math.min(viewIndex, run.history.length - 1);
  const actors = run.input.roster.map((actor) => ({ ...structuredClone(actor), alive: true, injured: false, kills: 0, death: null }));
  const byId = new Map(actors.map((actor) => [actor.id, actor]));
  let relationships = [];
  for (const phase of run.history.slice(0, index + 1)) for (const row of phase.rows) for (const effect of row.effects) {
    const actor = byId.get(effect.actorId);
    if (!actor) continue;
    if (effect.type === 'death') {
      actor.alive = false; actor.death = { cause: effect.cause, phaseIndex: phase.index, eventId: row.eventId };
      if (byId.has(effect.sourceId)) byId.get(effect.sourceId).kills += 1;
    }
    if (effect.type === 'injure') actor.injured = true;
    if (effect.type === 'heal') actor.injured = false;
    if (effect.type === 'gain_item') actor.items.push(effect.item);
    if (effect.type === 'lose_item') {
      const at = actor.items.indexOf(effect.item);
      if (at >= 0) actor.items.splice(at, 1);
    }
    if (['ally', 'enemy'].includes(effect.type)) {
      relationships = relationships.filter((relation) => !samePair(relation, actor.id, effect.otherId));
      relationships.push({ leftId: actor.id, rightId: effect.otherId, kind: effect.type });
    }
  }
  const isLatest = index === run.history.length - 1;
  return { index, actors, relationships, phase: run.history[index], isLatest,
    finished: isLatest && run.finished, winnerId: isLatest ? run.winnerId : null,
    winnerTeamId: isLatest ? run.winnerTeamId : null, winnerIds: isLatest ? run.winnerIds || [] : [],
    endReason: isLatest ? run.endReason : '' };
}

export function replayHungerRun(config, phases, rulesVersion) {
  if (!Number.isInteger(phases) || phases < 0 || phases > 120) throw new Error('저장된 진행 수가 올바르지 않습니다.');
  let run = createHungerRun(config, rulesVersion);
  for (let index = 0; index < phases; index += 1) {
    if (run.finished) throw new Error('경기 종료 이후의 진행 기록은 불러올 수 없습니다.');
    run = advanceHungerRun(run);
  }
  return run;
}
