import { isValidLineage } from './primitiveArchiveLineage.js';
import { isValidFounderHistory } from './primitiveArchiveFounders.js';

const text = value => typeof value === 'string' ? value : '';
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const stages = { active: '활동 중', elder: '인계 준비기', retired: '은퇴', deceased: '사망', prepared: '준비된 후계' };
const roleKeys = { 정찰: 'scout', 사냥: 'hunt', 제작: 'craft', 지원: 'support' };

// Display evidence only. This index never creates people or repairs saved history.
export function archiveIdentityIndex(state) {
  const source = record(state) ? state : {};
  const party = Array.isArray(source.party) ? source.party.filter(actor => record(actor) && text(actor.id)) : [];
  const validContext = text(source.runId) && Number.isSafeInteger(source.day) && source.day >= 1;
  const partyValid = Array.isArray(source.party) && party.length === source.party.length
    && new Set(party.map(actor => actor.id)).size === party.length;
  const context = { runId: source.runId, day: source.day, party, calendar: source.calendar };
  const lineageValid = isValidLineage(source.lineage, context);
  const historyValid = isValidFounderHistory(source.founderHistory, context);
  const lineage = validContext && partyValid && lineageValid && source.lineage?.mode === 'hybrid' ? source.lineage : null;
  const history = validContext && historyValid && record(source.founderHistory) ? source.founderHistory : null;
  const members = new Map((lineage?.members || []).map(member => [member.actorId, member]));
  const histories = new Map((history?.members || []).map(member => [member.actorId, member]));
  const actors = new Map();
  const duplicates = new Set();
  for (const actor of party) {
    if (actors.has(actor.id)) duplicates.add(actor.id);
    else actors.set(actor.id, actor);
  }
  const prepared = new Map();
  const predecessors = new Map();
  for (const member of members.values()) {
    if (!actors.has(member.actorId) && record(member.retiredSnapshot)) actors.set(member.actorId, member.retiredSnapshot);
    if (member.successorId) {
      if (!predecessors.has(member.successorId)) predecessors.set(member.successorId, []);
      predecessors.get(member.successorId).push(member);
    }
  }
  for (const candidate of lineage?.prepared || []) {
    prepared.set(candidate.actor.id, candidate);
    actors.set(candidate.actor.id, candidate.actor);
  }
  const ids = new Set([...actors.keys(), ...members.keys(), ...histories.keys()]);
  const person = actorId => actors.get(actorId) || histories.get(actorId) || {};
  const lookup = Object.create(null);
  for (const actorId of ids) {
    const actor = person(actorId);
    const member = members.get(actorId);
    const candidate = prepared.get(actorId);
    const historical = histories.get(actorId);
    const name = text(actor.name) || text(historical?.name) || actorId;
    const role = text(actor.role) || text(historical?.role);
    let generation = member?.generation ?? (candidate ? candidate.actor.lineageGeneration : null);
    const rootId = member?.founderId || candidate?.actor.lineageRootId || '';
    const root = members.get(rootId);
    const rootValid = root && root.generation === 0 && root.founderId === root.actorId;
    const prior = candidate ? members.get(candidate.mentorId) : (predecessors.get(actorId)?.length === 1 ? predecessors.get(actorId)[0] : null);
    const ambiguous = !candidate && (predecessors.get(actorId)?.length || 0) > 1;
    const declaredRoot = actor.lineageRootId;
    const declaredGeneration = actor.lineageGeneration;
    const roleName = role.replace(/ 계승$/, '');
    const contradictory = duplicates.has(actorId) || ambiguous
      || (generation !== null && (!Number.isSafeInteger(generation) || generation < 0 || !rootValid
        || (declaredRoot !== undefined && declaredRoot !== rootId)
        || (declaredGeneration !== undefined && declaredGeneration !== generation)))
      || (candidate && (!prior || prior.founderId !== rootId || prior.generation + 1 !== generation));
    if (contradictory) generation = null;
    const isFounder = historical?.isFounder === true;
    const kind = contradictory ? 'unknown' : isFounder ? 'founder'
      : generation !== null && generation > 0 ? 'successor'
        : lineage ? 'person' : 'unknown';
    const linkedPrior = !contradictory && prior && rootValid && prior.founderId === rootId
      && prior.generation + 1 === generation ? Object.freeze({ actorId: prior.actorId,
        name: text(person(prior.actorId).name) || prior.actorId }) : null;
    const rootActor = rootValid ? person(rootId) : {};
    const rootReference = !contradictory && rootValid && rootId !== actorId ? Object.freeze({
      actorId: rootId, name: text(rootActor.name) || rootId, role: text(rootActor.role),
      portrait: text(rootActor.portrait), isFounder: histories.get(rootId)?.isFounder === true,
    }) : null;
    lookup[actorId] = Object.freeze({ actorId, name, kind, generation,
      generationLabel: generation === null ? '세대 미기록' : generation === 0 ? '기준 세대' : `${generation}세대 후계`,
      stageLabel: stages[candidate ? 'prepared' : member?.stage] || (Number(actor.hp) > 0 ? '활동 중' : historical?.deathRecord ? '사망 기록' : '상태 미기록'),
      role, roleKey: Object.hasOwn(roleKeys, roleName) ? roleKeys[roleName] : 'neutral', trait: text(actor.trait),
      mentor: linkedPrior, rootReference,
      notice: contradictory ? '서로 맞지 않는 계보 기록은 연결하지 않습니다.'
        : kind === 'successor' ? '공동체의 계승 관계이며 부모·친자 관계를 뜻하지 않습니다.'
          : generation === null ? '기록되지 않은 세대와 관계는 추정하지 않습니다.' : '',
    });
  }
  return Object.freeze(lookup);
}
