import { TECH_TREE } from './primitiveArchiveData';
import { normalizeFounderHistory, recordFounderDeath } from './primitiveArchiveFounders.js';

export const LINEAGE_RULES = Object.freeze({ warningCycle: 12, handoverCycle: 18, naturalEndCycle: 24, memberLimit: 64 });
const copy = value => JSON.parse(JSON.stringify(value));
const stages = ['active', 'elder', 'retired', 'deceased'];
const integer = value => Number.isInteger(value) && value >= 0;
const record = value => value && typeof value === 'object' && !Array.isArray(value);
const eraOrder = ['PRIMITIVE', 'NEOLITHIC', 'ANCIENT', 'CLASSICAL', 'MEDIEVAL', 'EARLY_MODERN', 'MODERN_EARLY', 'MODERN_LATE'];
export function lineageEra(state) {
  return TECH_TREE.filter(tech => state.research?.completed?.[tech.id])
    .reduce((era, tech) => eraOrder.indexOf(tech.era) > eraOrder.indexOf(era) ? tech.era : era, 'PRIMITIVE');
}
const memberOf = (actor, day, founderId = actor.id, generation = 0) => ({ actorId: actor.id, founderId,
  generation, enteredDay: day, cycle: 0, stage: 'active', successorId: '', retiredSnapshot: null, deathRecord: null });

export function createLineage({ party = [], day = 1, runId = '', mode = 'hybrid', eraId = 'PRIMITIVE' } = {}) {
  return { version: 1, runId, mode: mode === 'legacy' ? 'legacy' : 'hybrid', lastTickDay: day,
    communityStartedDay: 0, lastEra: eraId, serial: 0, members: mode === 'legacy' ? [] : party.map(actor => memberOf(actor, day)),
    prepared: [], transitions: [] };
}

export function isValidLineage(raw, { runId, day = 1, party = [] } = {}) {
  if (raw === undefined) return true;
  if (!record(raw) || raw.version !== 1 || raw.runId !== runId || !['legacy', 'hybrid'].includes(raw.mode)
    || !integer(raw.lastTickDay) || raw.lastTickDay < 1 || raw.lastTickDay > day || !eraOrder.includes(raw.lastEra)
    || !integer(raw.communityStartedDay) || raw.communityStartedDay > raw.lastTickDay
    || !integer(raw.serial) || !Number.isSafeInteger(raw.serial) || !Array.isArray(raw.members) || raw.members.length > LINEAGE_RULES.memberLimit
    || !Array.isArray(raw.prepared) || raw.prepared.length > 16
    || !Array.isArray(raw.transitions) || raw.transitions.length > 12) return false;
  if (raw.mode === 'legacy') return raw.communityStartedDay === 0 && !raw.members.length && !raw.prepared.length && !raw.transitions.length;
  if (new Set(party.map(actor => actor.id)).size !== party.length) return false;
  const ids = new Set();
  const validDeath = death => record(death) && ['action', 'night', 'natural'].includes(death.source)
    && integer(death.day) && death.day >= 1 && death.day <= day
    && typeof death.reason === 'string'
    && ['hpBefore', 'damage', 'hungerDamage', 'coldDamage', 'hypothermiaDamage'].every(key =>
      Number.isFinite(death[key]) && death[key] >= 0);
  for (const member of raw.members) {
    if (!record(member) || typeof member.actorId !== 'string' || !member.actorId || ids.has(member.actorId)
      || typeof member.founderId !== 'string' || !member.founderId || !integer(member.generation)
      || !integer(member.enteredDay) || member.enteredDay < 1 || member.enteredDay > day
      || !integer(member.cycle) || member.cycle > LINEAGE_RULES.naturalEndCycle || !stages.includes(member.stage)
      || (member.cycle > 0 && raw.communityStartedDay === 0)
      || typeof member.successorId !== 'string'
      || (member.retiredSnapshot !== null && (!record(member.retiredSnapshot) || member.retiredSnapshot.id !== member.actorId
        || !Number.isFinite(member.retiredSnapshot.hp)))
      || (member.deathRecord !== null && (!validDeath(member.deathRecord) || member.deathRecord.day < member.enteredDay))) return false;
    const active = party.find(actor => actor.id === member.actorId);
    if (['active', 'elder'].includes(member.stage)
      && (!active || Number(active.hp) <= 0 || active.deathRecord || member.retiredSnapshot || member.deathRecord || member.successorId)) return false;
    if (member.stage === 'retired'
      && (active || !member.retiredSnapshot || member.retiredSnapshot.hp <= 0 || member.deathRecord || !member.successorId)) return false;
    if (member.stage === 'deceased' && (!member.deathRecord
      || (active ? active.hp > 0 : !member.retiredSnapshot || member.retiredSnapshot.hp > 0))) return false;
    if (member.stage === 'deceased') {
      const evidence = (active || member.retiredSnapshot)?.deathRecord;
      if (!evidence || ['day', 'source', 'reason', 'hpBefore', 'damage', 'hungerDamage', 'coldDamage', 'hypothermiaDamage']
        .some(key => evidence[key] !== member.deathRecord[key])) return false;
    }
    ids.add(member.actorId);
  }
  if (party.some(actor => !ids.has(actor.id))) return false;
  const mentors = new Set();
  for (const member of raw.members) {
    const root = raw.members.find(row => row.actorId === member.founderId);
    if (!root || root.generation !== 0 || root.founderId !== root.actorId) return false;
    if (member.successorId) {
      const heir = raw.members.find(row => row.actorId === member.successorId);
      if (!heir || heir.founderId !== member.founderId || heir.generation !== member.generation + 1) return false;
    }
  }
  for (const prepared of raw.prepared) {
    if (!record(prepared)) return false;
    const mentor = raw.members.find(member => member.actorId === prepared.mentorId);
    if (!record(prepared) || !mentor || !['active', 'elder', 'deceased'].includes(mentor.stage)
      || mentor.successorId || mentors.has(prepared.mentorId)
      || !record(prepared.actor) || typeof prepared.actor.id !== 'string' || !prepared.actor.id
      || ids.has(prepared.actor.id) || party.some(actor => actor.id === prepared.actor.id)
      || !Number.isFinite(prepared.actor.hp) || prepared.actor.hp <= 0
      || prepared.actor.lineageRootId !== mentor.founderId
      || prepared.actor.lineageGeneration !== mentor.generation + 1
      || !integer(prepared.preparedDay) || prepared.preparedDay < mentor.enteredDay || prepared.preparedDay > day) return false;
    mentors.add(prepared.mentorId);
    ids.add(prepared.actor.id);
  }
  const prefix = `${runId}:heir:`;
  for (const id of ids) if (id.startsWith(prefix)) {
    const suffix = id.slice(prefix.length);
    const issued = Number(suffix);
    if (!/^[1-9]\d*$/.test(suffix) || !Number.isSafeInteger(issued) || issued > raw.serial) return false;
  }
  return raw.transitions.every(event => record(event) && integer(event.day) && event.day >= 1 && event.day <= day
    && typeof event.actorId === 'string' && ['prepared', 'retired', 'inherited', 'death'].includes(event.kind));
}

export function normalizeLineage(raw, { party = [], day = 1, runId = '' } = {}) {
  if (raw === undefined) return createLineage({ party, day, runId, mode: 'legacy' });
  if (!isValidLineage(raw, { runId, day, party })) throw new RangeError('Invalid lineage history');
  const next = copy(raw);
  return next;
}

export function observeLineageArrival(state, actor) {
  if (state.lineage?.mode !== 'hybrid' || state.lineage.members.some(member => member.actorId === actor.id)) return state;
  if (state.lineage.members.length + state.lineage.prepared.length >= LINEAGE_RULES.memberLimit) {
    throw new RangeError('Lineage history capacity reached');
  }
  return { ...state, lineage: { ...state.lineage,
    members: [...state.lineage.members, memberOf(actor, state.day)] } };
}

export function observeLineageDeaths(state) {
  if (state.lineage?.mode !== 'hybrid') return state;
  return { ...state, lineage: { ...state.lineage, members: state.lineage.members.map(member => {
    const actor = state.party.find(actor => actor.id === member.actorId);
    return ['active', 'elder'].includes(member.stage) && actor?.hp <= 0 && actor.deathRecord
      ? { ...member, stage: 'deceased', deathRecord: copy(actor.deathRecord) } : member;
  }) } };
}

const event = (lineage, day, kind, actorId, detail = '') => ({ ...lineage,
  transitions: [...lineage.transitions, { day, kind, actorId, detail }].slice(-12) });
const foodStock = state => ['berry', 'meat', 'cooked_meat', 'jerky', 'fish', 'grain', 'milk', 'packed_ration', 'milled_grain']
  .reduce((sum, key) => sum + Math.max(0, Number(state.inventory?.[key] || 0)), 0);
function communityReady(state) {
  return Boolean(state.research?.completed?.SETTLEMENT && state.research?.completed?.FOOD_STORAGE)
    && Number(state.camp?.shelterLevel || 0) >= 1 && Number(state.tribe?.population || 0) >= 1
    && Number(state.tribe?.morale || 0) > 0 && foodStock(state) >= Math.ceil(Number(state.tribe.population) / 4)
      + lineageHousehold(state).extraRations;
}

export function lineageSummary(state) {
  const lineage = normalizeLineage(state.lineage, state);
  const ready = communityReady(state);
  const rows = lineage.members.map(member => {
    const actor = state.party.find(actor => actor.id === member.actorId) || member.retiredSnapshot;
    const prepared = lineage.prepared.find(item => item.mentorId === member.actorId);
    const active = ['active', 'elder'].includes(member.stage) && Number(actor?.hp || 0) > 0;
    const prepareReason = lineage.mode !== 'hybrid' ? '기존 런은 생애 전환을 사용하지 않습니다.'
      : state.ended ? '종료된 런입니다.' : !active ? '현재 활동 중인 생존 대원만 후계를 준비할 수 있습니다.'
        : prepared ? '이미 준비된 후계가 있습니다.' : !ready ? '정착·식량 저장·거처와 실제 공동체 식량이 필요합니다.'
          : Number(state.tribe.population) < 2 ? '기존 공동체를 유지할 일손 한 명은 남아야 합니다.'
            : lineage.members.length + lineage.prepared.length >= LINEAGE_RULES.memberLimit ? '이 문명의 생애 기록 정원에 도달했습니다.'
              : Number(state.ap || 0) < 1 ? '행동력 1이 필요합니다.' : '';
    const retireReason = lineage.mode !== 'hybrid' || !active ? '활동 중인 생애 전환 대원만 은퇴할 수 있습니다.'
      : state.ended ? '종료된 런입니다.' : !prepared ? '실제 공동체 일손으로 후계를 먼저 준비해야 합니다.'
        : !ready ? '후대를 유지할 정착 기반과 식량이 필요합니다.'
          : Number(state.ap || 0) < 1 ? '활동 가능한 차례에 은퇴를 선택해야 합니다.' : '';
    return { ...copy(member), name: actor?.name || member.actorId, role: actor?.role || '계승자',
      warning: active && member.cycle >= LINEAGE_RULES.warningCycle,
      canPrepare: !prepareReason, prepareReason, canRetire: !retireReason, retireReason,
      successorName: prepared?.actor.name || '', successorId: prepared?.actor.id || member.successorId };
  });
  return { mode: lineage.mode, enabled: lineage.mode === 'hybrid', communityStartedDay: lineage.communityStartedDay,
    clockStarted: lineage.communityStartedDay > 0, rows, prepared: copy(lineage.prepared),
    prepareCostText: 'AP 1 · ST 4 · 허기 +1 · 실제 공동체 일손 1명 전환',
    retireCostText: 'AP 소모 없음 · 준비된 후계와 활동 인물 교체 · 생존 원본 보존',
    transitions: copy(lineage.transitions), ruleText: `생애 활동기는 정착·식량 저장·거처·공동체 일손과 식량이 갖춰져 실제 후계 준비가 가능해진 뒤의 정착 활동기입니다. ${lineage.communityStartedDay ? `${lineage.communityStartedDay}일차에 정착 활동기 시작.` : '현재 정착 활동기 시작 전입니다.'} 12기 은퇴 예고·18기 준비 후 자동 인계·24기 수명 종료. 실제 역사 나이가 아니며 시작 후 기반이 악화돼도 멈추거나 초기화되지 않습니다. 한 문명의 생애 기록 정원은 예비 후계를 포함해 64명이며 도달하면 새 후계 준비·영입이 중단됩니다. 기존 기록은 삭제하지 않습니다.` };
}

export function prepareLineageSuccessor(state, actorId) {
  const summary = lineageSummary(state);
  const row = summary.rows.find(member => member.actorId === actorId);
  if (!row?.canPrepare) return { state, ok: false, reason: row?.prepareReason || '대원을 찾을 수 없습니다.' };
  const lineage = normalizeLineage(state.lineage, state);
  const mentor = state.party.find(actor => actor.id === actorId);
  const serial = lineage.serial + 1;
  const id = `${state.runId}:heir:${serial}`;
  if (!Number.isSafeInteger(serial) || lineage.members.some(member => member.actorId === id)
    || lineage.prepared.some(prepared => prepared.actor.id === id) || state.party.some(actor => actor.id === id)) {
    return { state, ok: false, reason: '중복되거나 유효하지 않은 후계 식별자는 발급할 수 없습니다.' };
  }
  const root = state.founderHistory?.members?.find(member => member.actorId === row.founderId);
  const rootName = String(root?.name || row.founderId).slice(0, 32);
  const rootRole = String(root?.role || mentor.role || '공동체').split(' 계승')[0].slice(0, 24);
  const actor = { ...copy(mentor), id, name: `${rootName} 계보 · ${row.generation + 1}세대 후계`,
    portrait: '/games/primitive-archive/portraits/placeholder.svg',
    role: `${rootRole} 계승`, trait: '공동체에서 준비한 후계',
    hp: 100, hunger: 12, stamina: 100, bodyTemp: 37, lineageRootId: row.founderId,
    lineageGeneration: row.generation + 1 };
  delete actor.deathRecord;
  const tribe = copy(state.tribe);
  const assigned = Object.values(tribe.assignments).reduce((sum, count) => sum + Number(count || 0), 0);
  // Remove a real worker, preferring automatic assignments over manual plans.
  if (assigned >= tribe.population) {
    const job = Object.keys(tribe.assignments).reverse().find(key => Number(tribe.autoAssignments?.[key] || 0) > 0)
      || Object.keys(tribe.assignments).reverse().find(key => Number(tribe.assignments[key] || 0) > 0);
    if (!job) return { state, ok: false, reason: '전환할 실제 공동체 일손이 없습니다.' };
    tribe.assignments[job] -= 1;
    tribe.autoAssignments = { ...tribe.autoAssignments, [job]: Math.max(0, Number(tribe.autoAssignments?.[job] || 0) - 1) };
  }
  tribe.population -= 1;
  const prepared = [...lineage.prepared, { mentorId: actorId, actor, preparedDay: state.day }];
  const next = { ...state, tribe, lineage: event({ ...lineage, serial, prepared }, state.day, 'prepared', actorId, id) };
  return { state: next, ok: true, reason: '', message: `${mentor.name}의 후계 ${actor.name} 준비. 공동체 일손 1명을 활동 준비로 전환했습니다.` };
}

function handover(state, actorId, reason) {
  const lineage = normalizeLineage(state.lineage, state);
  const member = lineage.members.find(member => member.actorId === actorId);
  const prepared = lineage.prepared.find(item => item.mentorId === actorId);
  const prior = state.party.find(actor => actor.id === actorId);
  if (!member || !prepared || !prior || !communityReady(state)) return state;
  const dead = Number(prior.hp || 0) <= 0;
  const snapshot = { ...copy(prior), equipment: copy(state.equipment?.[actorId] || {}) };
  const successor = copy(prepared.actor);
  const members = lineage.members.map(row => row.actorId === actorId ? { ...row,
    stage: dead ? 'deceased' : 'retired', successorId: successor.id, retiredSnapshot: snapshot,
    deathRecord: prior.deathRecord ? copy(prior.deathRecord) : row.deathRecord } : row);
  members.push(memberOf(successor, state.day, member.founderId, member.generation + 1));
  // Equipment is transferred once; the old slots survive only inside the snapshot.
  const equipment = { ...state.equipment, [successor.id]: { ...state.equipment?.[actorId] } };
  delete equipment[actorId];
  const updated = event({ ...lineage, members, prepared: lineage.prepared.filter(item => item.mentorId !== actorId) },
    state.day, dead ? 'inherited' : 'retired', actorId, reason);
  const next = { ...state, party: state.party.map(actor => actor.id === actorId ? successor : actor), equipment, lineage: updated };
  // The heir is observed at the actual handover, not invented by a later load.
  return { ...next, founderHistory: normalizeFounderHistory(next.founderHistory, next) };
}

export function retireLineageActor(state, actorId) {
  const row = lineageSummary(state).rows.find(member => member.actorId === actorId);
  if (!row?.canRetire) return { state, ok: false, reason: row?.retireReason || '대원을 찾을 수 없습니다.' };
  return { state: handover(state, actorId, '플레이어가 준비한 생전 은퇴'), ok: true,
    message: `${row.name} 생전 은퇴. 원본 인물과 장비 이력은 생애 기록에 보존되고 준비된 후계가 활동을 잇습니다.` };
}

export function tickLineageDay(state) {
  const lineage = normalizeLineage(state.lineage, state);
  if (lineage.mode !== 'hybrid' || lineage.lastTickDay >= state.day) return state;
  const era = lineageEra(state);
  const eraChanged = eraOrder.indexOf(era) > eraOrder.indexOf(lineage.lastEra);
  // Latch only at an executed day boundary, after a real legal preparation
  // opportunity exists. A previously paid preparation is direct evidence too.
  const firstLegalOpportunity = lineage.serial > 0 || (!state.ended && communityReady(state)
    && Number(state.tribe.population) >= 2 && state.party.some(actor => Number(actor.hp || 0) > 0));
  const communityStartedDay = lineage.communityStartedDay || (firstLegalOpportunity ? state.day : 0);
  let next = { ...state, lineage: { ...lineage, lastTickDay: state.day, lastEra: era, communityStartedDay,
    members: lineage.members.map(member => member.stage === 'deceased' || !communityStartedDay ? member : {
      ...member, cycle: Math.min(LINEAGE_RULES.naturalEndCycle, member.cycle + 1),
      stage: member.stage === 'retired' ? 'retired'
        : member.cycle + 1 >= LINEAGE_RULES.warningCycle ? 'elder' : 'active',
    }) } };
  for (const member of [...next.lineage.members]) {
    const actor = next.party.find(actor => actor.id === member.actorId) || member.retiredSnapshot;
    if (!actor) continue;
    if (member.stage === 'deceased') {
      next = handover(next, member.actorId, '공동체 회복 뒤 준비된 후계 인계');
      continue;
    }
    if (Number(actor.hp || 0) <= 0) {
      next = { ...next, lineage: { ...next.lineage, members: next.lineage.members.map(row => row.actorId === member.actorId
        ? { ...row, stage: 'deceased', deathRecord: actor.deathRecord ? copy(actor.deathRecord) : null } : row) } };
      next = handover(next, member.actorId, '확인된 사망 뒤 준비된 후계 인계');
      continue;
    }
    if (member.stage !== 'retired' && (member.cycle >= LINEAGE_RULES.handoverCycle
      || (eraChanged && member.cycle >= LINEAGE_RULES.warningCycle))) {
      next = handover(next, member.actorId, eraChanged ? '시대 전환과 준비된 후계' : '활동기와 준비된 후계');
    }
    if (member.cycle >= LINEAGE_RULES.naturalEndCycle) {
      const death = { day: state.day, source: 'natural', reason: '게임 생애주기 종료', hpBefore: Number(actor.hp || 0),
        damage: 0, hungerDamage: 0, coldDamage: 0, hypothermiaDamage: 0 };
      next = { ...next,
        party: next.party.map(row => row.id === member.actorId ? { ...row, hp: 0, deathRecord: death } : row),
        lineage: event({ ...next.lineage, members: next.lineage.members.map(row => row.actorId === member.actorId
          ? { ...row, stage: 'deceased', deathRecord: death,
            retiredSnapshot: row.retiredSnapshot ? { ...row.retiredSnapshot, hp: 0, deathRecord: death } : null } : row) },
        state.day, 'death', member.actorId, '게임 생애주기 종료') };
      next = recordFounderDeath(next, member.actorId, death);
      next = handover(next, member.actorId, '생애주기 종료 뒤 준비된 후계');
    }
  }
  return { ...next, ended: next.party.every(actor => Number(actor.hp || 0) <= 0) };
}

// Prepared people and living retirees still consume the same communal ration
// accounting. Moving a worker is not free food or duplicate production.
export function lineageHousehold(state) {
  const lineage = normalizeLineage(state.lineage, state);
  if (lineage.mode !== 'hybrid') return { count: 0, extraRations: 0 };
  const count = lineage.prepared.length + lineage.members.filter(member => member.stage === 'retired'
    && Number(member.retiredSnapshot?.hp || 0) > 0).length;
  const population = Number(state.tribe?.population || 0);
  return { count, extraRations: Math.max(0, Math.ceil((population + count) / 4) - Math.ceil(population / 4)) };
}

export function settleLineageHousehold(state, shortage) {
  const lineage = normalizeLineage(state.lineage, state);
  if (lineage.mode !== 'hybrid' || !lineageHousehold(state).count) return state;
  const meal = actor => {
    const hunger = shortage > 0 ? Math.min(100, Number(actor.hunger || 0) + 15) : Math.max(0, Number(actor.hunger || 0) - 20);
    const damage = shortage > 0 && hunger >= 75 ? 10 : 0;
    const hp = Math.max(0, Number(actor.hp || 0) - damage);
    const deathRecord = Number(actor.hp || 0) > 0 && hp <= 0 ? { day: state.day, source: 'night',
      reason: '공동체 배식 부족', hpBefore: actor.hp, damage, hungerDamage: damage, coldDamage: 0, hypothermiaDamage: 0 } : null;
    return { ...actor, hunger, hp, ...(deathRecord ? { deathRecord } : {}) };
  };
  const members = lineage.members.map(member => {
    if (member.stage !== 'retired') return member;
    const snapshot = meal(member.retiredSnapshot);
    return { ...member, retiredSnapshot: snapshot, stage: snapshot.hp > 0 ? 'retired' : 'deceased',
      deathRecord: snapshot.deathRecord || member.deathRecord };
  });
  const prepared = [];
  for (const candidate of lineage.prepared) {
    const actor = meal(candidate.actor);
    if (actor.hp > 0) prepared.push({ ...candidate, actor });
    else {
      const mentor = members.find(member => member.actorId === candidate.mentorId);
      members.push({ ...memberOf(actor, candidate.preparedDay, mentor.founderId, mentor.generation + 1),
        stage: 'deceased', retiredSnapshot: actor, deathRecord: actor.deathRecord });
    }
  }
  let next = { ...state, lineage: { ...lineage, members, prepared } };
  for (const member of members) if (member.deathRecord?.day === state.day && member.retiredSnapshot?.hp === 0) {
    next = recordFounderDeath(next, member.actorId, member.deathRecord);
  }
  return next;
}
