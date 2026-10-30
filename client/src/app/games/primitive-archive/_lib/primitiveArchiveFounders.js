const MEMBER_LIMIT = 64;
const DEED_LIMIT = 8;
const KINDS = new Set(['gather', 'hunt', 'craft', 'camp', 'project', 'diplomacy',
  'research_contribution', 'civic_contribution', 'recovery', 'utility', 'specialized']);
const text = (value, limit = 80) => typeof value === 'string' ? value.slice(0, limit) : '';
// Existing save identities are references, not display text. Preserve them.
const identity = value => typeof value === 'string' ? value : '';
const integer = (value, fallback = 0) => Number.isFinite(Number(value))
  ? Math.min(1e9, Math.max(0, Math.floor(Number(value)))) : fallback;
const dayOf = value => Math.max(1, integer(value, 1));
const list = value => Array.isArray(value) ? value : [];
const amount = value => Number.isFinite(Number(value)) ? Math.min(1e9, Math.max(0, Number(value))) : 0;

// Validate stored observations before normalizing. Invalid present history must
// not be quietly replaced with a new, apparently empty observation period.
export function isValidFounderHistory(raw, { runId, day = 1 } = {}) {
  if (raw === undefined) return true;
  const shape = (value, keys) => value && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
  const string = (value, limit = 80) => typeof value === 'string' && value.length <= limit;
  const number = value => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1e9;
  const count = value => number(value) && Number.isInteger(value);
  const validDay = value => count(value) && value >= 1 && value <= day;
  if (!shape(raw, ['version', 'origin', 'runId', 'foundersKnown', 'observedFromDay', 'members'])
    || raw.version !== 1 || typeof raw.runId !== 'string' || raw.runId !== runId || !validDay(raw.observedFromDay)
    || !['new_run', 'observed_legacy'].includes(raw.origin)
    || typeof raw.foundersKnown !== 'boolean'
    || raw.foundersKnown !== (raw.origin === 'new_run')
    || (raw.origin === 'new_run' && raw.observedFromDay !== 1)
    || !Array.isArray(raw.members) || raw.members.length > MEMBER_LIMIT) return false;
  const ids = new Set();
  for (const member of raw.members) {
    if (!shape(member, ['actorId', 'name', 'role', 'portrait', 'isFounder', 'firstObservedDay', 'tallies', 'recentDeeds', 'deathRecord'])
      || typeof member.actorId !== 'string' || !member.actorId || ids.has(member.actorId)
      || !string(member.name) || !string(member.role) || !string(member.portrait, 240)
      || typeof member.isFounder !== 'boolean' || !validDay(member.firstObservedDay)
      || member.firstObservedDay < raw.observedFromDay
      || (member.isFounder && (!raw.foundersKnown || member.firstObservedDay !== 1))
      || !member.tallies || typeof member.tallies !== 'object' || Array.isArray(member.tallies)
      || Object.entries(member.tallies).some(([kind, total]) => !KINDS.has(kind) || !count(total))
      || !Array.isArray(member.recentDeeds) || member.recentDeeds.length > DEED_LIMIT) return false;
    ids.add(member.actorId);
    for (const deed of member.recentDeeds) {
      if (!shape(deed, ['day', 'kind', 'target', 'gains']) || !validDay(deed.day)
        || deed.day < member.firstObservedDay || !KINDS.has(deed.kind) || !string(deed.target)
        || !Array.isArray(deed.gains) || deed.gains.length > 6
        || deed.gains.some(gain => !Array.isArray(gain) || gain.length !== 2
          || !string(gain[0]) || !gain[0] || !count(gain[1]) || gain[1] <= 0)) return false;
    }
    const death = member.deathRecord;
    if (death !== null && (!shape(death, ['day', 'source', 'reason', 'hpBefore', 'damage', 'hungerDamage', 'coldDamage', 'hypothermiaDamage'])
      || !validDay(death.day) || death.day < member.firstObservedDay || !['action', 'night'].includes(death.source)
      || !string(death.reason, 120)
      || ['hpBefore', 'damage', 'hungerDamage', 'coldDamage', 'hypothermiaDamage'].some(key => !number(death[key])))) return false;
  }
  return true;
}

function deathOf(raw) {
  if (!raw || !['action', 'night'].includes(raw.source)) return null;
  return { day: dayOf(raw.day), source: raw.source, reason: text(raw.reason, 120),
    hpBefore: amount(raw.hpBefore), damage: amount(raw.damage), hungerDamage: amount(raw.hungerDamage),
    coldDamage: amount(raw.coldDamage), hypothermiaDamage: amount(raw.hypothermiaDamage) };
}

function deedOf(raw) {
  if (!raw || !KINDS.has(raw.kind)) return null;
  return { day: dayOf(raw.day), kind: raw.kind, target: text(raw.target),
    gains: list(raw.gains).slice(0, 6).filter(row => Array.isArray(row)
      && text(row[0]) && integer(row[1]) > 0).map(row => [text(row[0]), integer(row[1])]) };
}

function membersOf(party, day, isFounder) {
  const ids = new Set();
  return list(party).filter(member => {
    const id = identity(member?.id);
    if (!id || ids.has(id)) return false;
    ids.add(id);
    return true;
  }).slice(0, MEMBER_LIMIT).map(member => ({ actorId: identity(member.id), name: text(member.name),
    role: text(member.role), portrait: text(member.portrait, 240),
    isFounder, firstObservedDay: dayOf(day), tallies: {}, recentDeeds: [], deathRecord: null }));
}

export function createFounderHistory({ party, day = 1, runId } = {}) {
  return { version: 1, origin: 'new_run', runId: identity(runId), foundersKnown: true,
    observedFromDay: dayOf(day), members: membersOf(party, day, true) };
}

export function normalizeFounderHistory(raw, { party, day = 1, runId } = {}) {
  const observed = () => ({ version: 1, origin: 'observed_legacy', runId: identity(runId),
    foundersKnown: false, observedFromDay: dayOf(day), members: membersOf(party, day, false) });
  if (raw === undefined) return observed();
  if (!isValidFounderHistory(raw, { runId, day })) throw new RangeError('Invalid founder history');
  const ids = new Set();
  const members = list(raw.members).filter(member => {
    const id = identity(member?.actorId);
    if (!id || ids.has(id)) return false;
    ids.add(id);
    return true;
  }).slice(0, MEMBER_LIMIT).map(member => ({
    actorId: identity(member.actorId), name: text(member.name), role: text(member.role), portrait: text(member.portrait, 240),
    isFounder: raw.origin === 'new_run' && raw.foundersKnown === true && member.isFounder === true,
    firstObservedDay: dayOf(member.firstObservedDay),
    tallies: Object.fromEntries([...KINDS].filter(kind => integer(member.tallies?.[kind]) > 0)
      .map(kind => [kind, integer(member.tallies[kind])])),
    recentDeeds: list(member.recentDeeds).slice(-DEED_LIMIT).map(deedOf).filter(Boolean),
    deathRecord: deathOf(member.deathRecord),
  }));
  // Later recruits are observed people, never retroactively made founders.
  for (const member of membersOf(party, day, false)) {
    if (!ids.has(member.actorId) && members.length < MEMBER_LIMIT) members.push(member);
  }
  return { version: 1, origin: raw.origin, runId: identity(runId),
    foundersKnown: raw.origin === 'new_run' && raw.foundersKnown === true,
    observedFromDay: dayOf(raw.observedFromDay), members };
}

export function recordFounderDeed(state, { actorId, kind, success = false, target = '', gains = [] } = {}) {
  if (!success || !KINDS.has(kind) || state?.ended) return state;
  const actor = list(state.party).find(member => member.id === actorId);
  if (!actor || Number(actor.hp || 0) <= 0 || Number(state.ap || 0) <= 0) return state;
  const history = normalizeFounderHistory(state.founderHistory, state);
  const deed = deedOf({ day: state.day, kind, target, gains });
  return { ...state, founderHistory: { ...history, members: history.members.map(member =>
    member.actorId !== actorId ? member : { ...member,
      tallies: { ...member.tallies, [kind]: integer(Number(member.tallies[kind] || 0) + 1) },
      recentDeeds: [...member.recentDeeds, deed].slice(-DEED_LIMIT),
    }) } };
}

export function recordFounderDeath(state, actorId, deathRecord) {
  const actor = list(state?.party).find(member => member.id === actorId);
  const death = deathOf(deathRecord);
  if (!actor || Number(actor.hp || 0) > 0 || !death || !Number.isInteger(deathRecord.day)) return state;
  const history = normalizeFounderHistory(state.founderHistory, state);
  const row = history.members.find(member => member.actorId === actorId);
  if (!row || row.deathRecord) return state;
  if (death.day < history.observedFromDay || death.day < row.firstObservedDay
    || death.day > Number(state.day)) return state;
  return { ...state, founderHistory: { ...history, members: history.members.map(member =>
    member.actorId === actorId ? { ...member, deathRecord: death } : member) } };
}

export function founderHistoryRows(state) {
  const history = normalizeFounderHistory(state?.founderHistory, state || {});
  return history.members.map(member => ({ ...member,
    living: list(state?.party).some(actor => actor.id === member.actorId && Number(actor.hp || 0) > 0),
    origin: history.origin, observedFromDay: history.observedFromDay, foundersKnown: history.foundersKnown,
  }));
}
