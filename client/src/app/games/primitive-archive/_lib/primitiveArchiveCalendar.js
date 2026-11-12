// This leaf owns only observed annual time and the population snapshot. It must
// not infer births, ages, family links, or a person's unobserved prior service.
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const integer = value => Number.isSafeInteger(value) && value >= 0;
const shape = (value, keys) => record(value) && Object.keys(value).length === keys.length
  && keys.every(key => Object.hasOwn(value, key));
const alive = actor => record(actor) && typeof actor.id === 'string' && actor.id.length > 0
  && Number.isFinite(actor.hp) && actor.hp > 0;
const personKeys = ['actorId', 'observedFromYear', 'serviceFromYear', 'serviceUntilYear'];
const censusKeys = ['workers', 'prepared', 'retired', 'active', 'total', 'foodNeed'];
const calendarKeys = ['version', 'runId', 'mode', 'startedDay', 'completedYears', 'lastSettledDay',
  'observedLifetimeYears', 'people', 'lastCensus'];

function livingPeople(state) {
  const people = new Map();
  for (const actor of state.party || []) if (alive(actor)) people.set(actor.id, { actorId: actor.id, role: 'active' });
  for (const member of state.lineage?.members || []) {
    if (member.stage === 'retired' && alive(member.retiredSnapshot) && !people.has(member.actorId)) {
      people.set(member.actorId, { actorId: member.actorId, role: 'retired' });
    }
  }
  for (const candidate of state.lineage?.prepared || []) {
    if (alive(candidate.actor) && !people.has(candidate.actor.id)) {
      people.set(candidate.actor.id, { actorId: candidate.actor.id, role: 'prepared' });
    }
  }
  return people;
}

function knownIds(state) {
  return new Set([
    ...(state.party || []).map(actor => actor.id),
    ...(state.lineage?.members || []).map(member => member.actorId),
    ...(state.lineage?.prepared || []).map(candidate => candidate.actor?.id),
  ].filter(id => typeof id === 'string' && id));
}

function observedDeath(state, actorId) {
  const member = state.lineage?.members?.find(row => row.actorId === actorId);
  const actor = state.party?.find(row => row.id === actorId) || member?.retiredSnapshot;
  return actor?.hp <= 0 ? actor.deathRecord || member?.deathRecord : null;
}

function validCensus(value) {
  return shape(value, censusKeys) && censusKeys.every(key => integer(value[key]))
    && Number.isSafeInteger(value.workers + value.prepared + value.retired + value.active)
    && value.total === value.workers + value.prepared + value.retired + value.active
    && value.foodNeed === Math.ceil(value.total / 4);
}

export function isAnnualMode(state) {
  return state?.calendar?.mode === 'annual';
}

export function annualCensus(state) {
  const workers = state.tribe?.population ?? 0;
  if (!integer(workers)) throw new RangeError('Invalid annual workforce');
  const result = { workers, prepared: 0, retired: 0, active: 0, total: 0, foodNeed: 0 };
  for (const person of livingPeople(state).values()) result[person.role] += 1;
  result.total = result.workers + result.prepared + result.retired + result.active;
  if (!Number.isSafeInteger(result.total)) throw new RangeError('Invalid annual population');
  result.foodNeed = Math.ceil(result.total / 4);
  return result;
}

function validCalendar(raw, state, requireLiving = true) {
  if (raw === undefined) return !Object.hasOwn(state, 'calendar');
  if (!shape(raw, calendarKeys) || raw.version !== 1 || raw.mode !== 'annual'
    || typeof raw.runId !== 'string' || !raw.runId || raw.runId !== state.runId
    || !integer(raw.startedDay) || raw.startedDay < 1 || !integer(raw.completedYears)
    || !Number.isSafeInteger(raw.startedDay + raw.completedYears)
    || raw.startedDay + raw.completedYears !== state.day || raw.lastSettledDay !== state.day
    || ![60, 80, null].includes(raw.observedLifetimeYears)
    || !Array.isArray(raw.people)
    || (raw.completedYears === 0 ? raw.lastCensus !== null : !validCensus(raw.lastCensus))) return false;
  const known = knownIds(state);
  const ids = new Set();
  for (const person of raw.people) {
    if (!shape(person, personKeys) || typeof person.actorId !== 'string' || !person.actorId
      || ids.has(person.actorId) || !known.has(person.actorId)
      || !integer(person.observedFromYear) || person.observedFromYear > raw.completedYears
      || (person.serviceFromYear !== null && (!integer(person.serviceFromYear)
        || person.serviceFromYear < person.observedFromYear || person.serviceFromYear > raw.completedYears))
      || (person.serviceUntilYear !== null && (person.serviceFromYear === null || !integer(person.serviceUntilYear)
        || person.serviceUntilYear < person.serviceFromYear || person.serviceUntilYear > raw.completedYears))) return false;
    const death = observedDeath(state, person.actorId);
    if (death && Number.isSafeInteger(death.day) && death.day < raw.startedDay + person.observedFromYear) return false;
    ids.add(person.actorId);
  }
  if (!requireLiving) return true;
  return [...livingPeople(state).values()].every(current => {
    const person = raw.people.find(row => row.actorId === current.actorId);
    if (!person) return false;
    if (current.role === 'active') return person.serviceFromYear !== null && person.serviceUntilYear === null;
    if (current.role === 'prepared') return person.serviceFromYear === null && person.serviceUntilYear === null;
    return person.serviceFromYear === null || person.serviceUntilYear !== null;
  });
}

export function isValidAnnualCalendar(raw, state = {}) {
  return validCalendar(raw, state);
}

export function createAnnualCalendar(state, { observedLifetimeYears = 60 } = {}) {
  if (Object.hasOwn(state, 'calendar')) throw new RangeError('Annual calendar already specified');
  if (![60, 80, null].includes(observedLifetimeYears)) throw new RangeError('Invalid observed lifetime policy');
  const calendar = { version: 1, runId: state.runId, mode: 'annual', startedDay: state.day,
    completedYears: 0, lastSettledDay: state.day, observedLifetimeYears,
    people: [...livingPeople(state).values()].map(person => ({ actorId: person.actorId, observedFromYear: 0,
      serviceFromYear: person.role === 'active' ? 0 : null, serviceUntilYear: null })), lastCensus: null };
  if (!validCalendar(calendar, state)) throw new RangeError('Invalid annual calendar input');
  return calendar;
}

export function advanceAnnualCalendar(state) {
  if (!isAnnualMode(state) || !validCalendar(state.calendar, state)) throw new RangeError('Invalid annual calendar');
  const completedYears = state.calendar.completedYears + 1;
  const lastSettledDay = state.day + 1;
  if (!Number.isSafeInteger(completedYears) || !Number.isSafeInteger(lastSettledDay)) throw new RangeError('Annual time limit reached');
  return { ...state.calendar, completedYears, lastSettledDay,
    people: state.calendar.people.map(person => ({ ...person })), lastCensus: annualCensus(state) };
}

export function syncAnnualCalendarPeople(state) {
  if (!Object.hasOwn(state, 'calendar')) return state;
  if (!isAnnualMode(state) || !validCalendar(state.calendar, state, false)) throw new RangeError('Invalid annual calendar');
  const calendar = state.calendar;
  const living = livingPeople(state);
  const people = calendar.people.map(person => {
    const current = living.get(person.actorId);
    if (person.serviceFromYear !== null && person.serviceUntilYear === null && current?.role !== 'active') {
      return { ...person, serviceUntilYear: calendar.completedYears };
    }
    if (current?.role === 'active' && person.serviceFromYear === null) {
      return { ...person, serviceFromYear: calendar.completedYears };
    }
    return { ...person };
  });
  const registered = new Set(people.map(person => person.actorId));
  for (const person of living.values()) if (!registered.has(person.actorId)) {
    people.push({ actorId: person.actorId, observedFromYear: calendar.completedYears,
      serviceFromYear: person.role === 'active' ? calendar.completedYears : null, serviceUntilYear: null });
  }
  const next = { ...state, calendar: { ...calendar, people } };
  if (!validCalendar(next.calendar, next)) throw new RangeError('Invalid annual person registry');
  return next;
}

export function annualPersonSummary(state, actorId) {
  const calendar = state?.calendar;
  const person = isAnnualMode(state) && validCalendar(calendar, state) ? calendar.people.find(row => row.actorId === actorId) : null;
  if (!person) return { observed: false, observedYears: null, serviceYears: null, serviceEnded: false,
    observedFromYear: null, serviceFromYear: null, serviceUntilYear: null, warning: false, expectedHandoverYear: null };
  const serviceYears = person.serviceFromYear === null ? null
    : (person.serviceUntilYear ?? calendar.completedYears) - person.serviceFromYear;
  const death = observedDeath(state, actorId);
  const lastObservedYear = death && Number.isSafeInteger(death.day) && death.day >= calendar.startedDay
    ? Math.min(calendar.completedYears, death.day - calendar.startedDay) : calendar.completedYears;
  return { observed: true, observedYears: lastObservedYear - person.observedFromYear, serviceYears,
    serviceEnded: person.serviceUntilYear !== null, observedFromYear: person.observedFromYear,
    serviceFromYear: person.serviceFromYear, serviceUntilYear: person.serviceUntilYear,
    warning: person.serviceUntilYear === null && serviceYears !== null && serviceYears >= 20,
    expectedHandoverYear: person.serviceFromYear === null ? null : person.serviceFromYear + 25 };
}

export function annualCalendarSummary(state) {
  if (!isAnnualMode(state) || !validCalendar(state.calendar, state)) return { enabled: false, year: null,
    completedYears: 0, startedDay: null, lastSettledDay: null, observedLifetimeYears: null,
    census: null, lastCensus: null, receipt: null, receiptRecorded: false, receiptYear: null };
  const calendar = state.calendar;
  const receiptRecorded = calendar.completedYears > 0 && state.tribe?.lastProduction?.day === calendar.lastSettledDay;
  return { enabled: true, year: calendar.completedYears + 1, completedYears: calendar.completedYears,
    startedDay: calendar.startedDay, lastSettledDay: calendar.lastSettledDay,
    observedLifetimeYears: calendar.observedLifetimeYears, census: annualCensus(state),
    lastCensus: calendar.lastCensus, receipt: receiptRecorded ? state.tribe.lastProduction : null,
    receiptRecorded, receiptYear: receiptRecorded ? calendar.completedYears : null };
}
