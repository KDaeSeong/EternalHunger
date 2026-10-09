import assert from 'node:assert/strict';
import { isDeepStrictEqual } from 'node:util';
import { getActorTeamId } from '../../src/app/simulation/_lib/teamRuntime.js';
import { normalizeSupportedTacSkill } from '../../src/app/simulation/tacticalSkillTable.js';
import { readTacticalEffectReceipt } from '../../src/app/simulation/_lib/tacticalEffectEvidenceRuntime.js';

const teamFields = ['teamId', 'matchTeamId', 'teamName', 'matchTeamName'];
const rosterFields = ['matchTeamRosterIds', 'matchTeamRosterNames', 'matchTeamSize', 'teamOriginalSize'];
const idOf = actor => String(actor?._id || actor?.id || '');
const nameOf = actor => String(actor?.name || actor?.nickname || actor?.charName || '').trim();

function teamsOf(actors) {
  const teams = new Map();
  for (const actor of actors) {
    const team = getActorTeamId(actor);
    if (!teams.has(team)) teams.set(team, []);
    teams.get(team).push(actor);
  }
  return teams;
}

export function assertFormationRosterConsistency(input) {
  const actors = input.initialFrame.survivors;
  assert.equal(new Set(actors.map(idOf)).size, actors.length);
  assert.ok(actors.every(actor => idOf(actor).trim() && String(actor.teamId || '').trim()
    && String(actor.matchTeamId || '').trim()), 'A formation swap requires explicit team IDs, not solo fallbacks.');
  const teams = teamsOf(actors);
  for (const actor of actors) {
    const members = teams.get(getActorTeamId(actor));
    assert.equal(String(actor.teamId), String(actor.matchTeamId), 'Both team identities must describe the same membership.');
    assert.ok(String(actor.teamName || '').trim());
    assert.equal(actor.teamName, actor.matchTeamName);
    assert.ok(members.every(member => member.teamName === actor.teamName));
    assert.ok(Number.isInteger(actor.teamSlot) && actor.teamSlot >= 1 && actor.teamSlot <= actor.matchTeamCapacity);
    assert.equal(actor.teamSlot, actor.matchTeamSlot);
    assert.equal(new Set(members.map(member => member.teamSlot)).size, members.length);
    assert.deepEqual(actor.matchTeamRosterIds, members.map(idOf));
    assert.deepEqual(actor.matchTeamRosterNames, members.map(nameOf).filter(Boolean));
    assert.equal(actor.matchTeamSize, members.length);
    assert.equal(actor.teamOriginalSize, members.length);
  }
}

// Team roster snapshots affect recovery and settlement as well as display.
// Rebuild those derived fields, without changing HP, location, gear or budgets.
export function createFormationSwapInput(original, firstIndex = 1, secondIndex = 4) {
  assertFormationRosterConsistency(original);
  const input = structuredClone(original);
  const actors = input.initialFrame.survivors;
  const a = actors[firstIndex], b = actors[secondIndex];
  assert.ok(a && b && firstIndex !== secondIndex);
  assert.notEqual(getActorTeamId(a), getActorTeamId(b));
  assert.equal(a.teamSlot, b.teamSlot, 'Swap the same slot so unrelated formation order is preserved.');
  const changes = [[a, b], [b, a]].map(([actor, other]) => ({ actorId: idOf(actor),
    field: 'team', before: getActorTeamId(actor), after: getActorTeamId(other) }));
  for (const field of teamFields) [a[field], b[field]] = [b[field], a[field]];
  const teams = teamsOf(actors);
  const derivedChanges = [];
  for (const [index, actor] of actors.entries()) {
    const members = teams.get(getActorTeamId(actor));
    const derived = { matchTeamRosterIds: members.map(idOf), matchTeamRosterNames: members.map(nameOf).filter(Boolean),
      matchTeamSize: members.length, teamOriginalSize: members.length };
    for (const field of rosterFields) {
      const before = original.initialFrame.survivors[index][field];
      if (isDeepStrictEqual(before, derived[field])) continue;
      derivedChanges.push({ actorId: idOf(actor), field, before: structuredClone(before), after: structuredClone(derived[field]) });
      actor[field] = derived[field];
    }
  }
  assertFormationRosterConsistency(input);
  const restored = structuredClone(input);
  for (const index of [firstIndex, secondIndex]) for (const field of teamFields) {
    const actor = original.initialFrame.survivors[index];
    if (Object.hasOwn(actor, field)) restored.initialFrame.survivors[index][field] = structuredClone(actor[field]);
    else delete restored.initialFrame.survivors[index][field];
  }
  for (const change of derivedChanges) {
    restored.initialFrame.survivors.find(actor => idOf(actor) === change.actorId)[change.field] = structuredClone(change.before);
  }
  assert.deepEqual(restored, original, 'Only team membership and its exact derived roster delta may change.');
  return { input, changes, derivedChanges };
}

export function validateStrategyVariants(variants) {
  assert.ok(Array.isArray(variants) && variants.length >= 2, 'A strategy comparison requires a non-baseline condition.');
  assert.equal(variants[0], 'baseline');
  assert.equal(new Set(variants).size, variants.length);
  assert.ok(variants.every(variant => ['baseline', 'one-tactical-skill', 'one-formation-swap'].includes(variant)));
}

export function buildTacticalExposure(events, actor) {
  const skill = normalizeSupportedTacSkill(actor.tacticalSkill);
  const result = { actorId: idOf(actor), configuredSkill: skill, recorded: 0, unrecorded: 0,
    unexpectedSkill: 0, combatAttack: 0, combatDefense: 0, ready: false, status: 'no_recorded_activation',
    scope: 'Observed configured-skill combat activations only; not all eligible opportunities or winner causality.' };
  for (const event of events) {
    if (event.kind !== 'skill' || event.source !== 'tactical' || String(event.who) !== result.actorId
      || !['combat_attack', 'combat_defense'].includes(event.mode)) continue;
    if (normalizeSupportedTacSkill(event.skill) !== skill) { result.unexpectedSkill += 1; continue; }
    if (!readTacticalEffectReceipt(event)) { result.unrecorded += 1; continue; }
    result.recorded += 1;
    result[event.mode === 'combat_attack' ? 'combatAttack' : 'combatDefense'] += 1;
  }
  result.ready = result.recorded > 0 && result.unrecorded === 0 && result.unexpectedSkill === 0;
  result.status = result.ready ? 'observed' : result.unexpectedSkill > 0 ? 'skill_mismatch'
    : result.unrecorded > 0 ? 'missing_effect_evidence' : 'no_recorded_activation';
  return result;
}

export function buildTacticalExposurePair(beforeEvents, beforeActor, afterEvents, afterActor) {
  assert.equal(idOf(beforeActor), idOf(afterActor));
  const baseline = buildTacticalExposure(beforeEvents, beforeActor);
  const candidate = buildTacticalExposure(afterEvents, afterActor);
  assert.notEqual(baseline.configuredSkill, candidate.configuredSkill, 'A tactical pair needs an actual skill change.');
  return { baseline, candidate, ready: baseline.ready && candidate.ready,
    scope: 'Both configured tactical skills observed in actual combat; not all eligible opportunities or winner causality.' };
}

const near = (left, right) => Number.isFinite(left) && Number.isFinite(right) && Math.abs(left - right) < 1e-6;
const validHpHit = event => Number.isFinite(event.hpDamage) && event.hpDamage >= 0
  && Number.isFinite(event.hpBefore) && event.hpBefore >= 0
  && Number.isFinite(event.hpAfter) && event.hpAfter >= 0
  && near(event.hpBefore - event.hpAfter, event.hpDamage);
const actionKey = event => JSON.stringify([String(event.who), String(event.targetId), event.at?.sec, event.zoneId]);

export function buildFormationExposure(events, initialActors, actorIds, comparisonActors) {
  assert.ok(Array.isArray(comparisonActors), 'Changed teammate relations need the other condition\'s actual roster.');
  const actors = new Map(initialActors.map(actor => [idOf(actor), actor]));
  const otherActors = new Map(comparisonActors.map(actor => [idOf(actor), actor]));
  assert.deepEqual([...actors.keys()].sort(), [...otherActors.keys()].sort());
  assert.equal(new Set(actorIds).size, actorIds.length);
  const participants = actorIds.map(actorId => {
    const actor = actors.get(actorId), otherActor = otherActors.get(actorId);
    assert.ok(actor && otherActor);
    const changedTeammateIds = initialActors.filter(member => idOf(member) !== actorId
      && getActorTeamId(member) === getActorTeamId(actor)
      && getActorTeamId(otherActors.get(idOf(member))) !== getActorTeamId(otherActor)).map(idOf);
    return { actorId, teamId: getActorTeamId(actor), changedTeammateIds, committedHits: 0,
      invalidHpHits: 0, engagementActions: 0, coverActions: 0, teamActions: 0, samples: [], ready: false,
      diagnostics: { outgoingHpHits: 0, incomingHpHits: 0, engagements: 0, changedTeammateEngagements: 0,
        activeEngagementTurns: 0, strikeCandidates: 0, rejectedStrikes: {}, rejectedStrikeSamples: [] } };
  });
  const watched = new Map(participants.map(row => [row.actorId, row]));
  const damageByAction = new Map(), engagements = new Map();
  const isEnemy = (left, right) => actors.has(left) && actors.has(right)
    && getActorTeamId(actors.get(left)) !== getActorTeamId(actors.get(right));
  const remember = (row, sample) => { if (row.samples.length < 6) row.samples.push(sample); };
  // Diagnostic funnels explain absent exposure, but never alter its acceptance
  // rule. Own bounded snapshots rather than retaining the match event graph.
  const rejectStrike = (row, reason, index, event, entry) => {
    const diagnostic = row.diagnostics;
    diagnostic.rejectedStrikes[reason] = (diagnostic.rejectedStrikes[reason] || 0) + 1;
    if (diagnostic.rejectedStrikeSamples.length >= 6) return;
    const engagement = entry?.event;
    diagnostic.rejectedStrikeSamples.push({ reason, eventIndex: index, who: event.who,
      targetId: event.targetId, teamId: event.teamId, atSec: event.at?.sec, zoneId: event.zoneId,
      encounterId: event.encounterId, damage: event.damage,
      changedTeammateIds: [...row.changedTeammateIds],
      engagement: engagement ? { eventIndex: entry.index, atSec: engagement.at?.sec,
        actionSec: engagement.atSec, zoneId: engagement.zoneId,
        teams: structuredClone(engagement.teams), participants: structuredClone(engagement.participants) } : null });
  };

  for (const [index, event] of events.entries()) {
    if (event.kind === 'damage') {
      const who = String(event.who), target = String(event.targetId);
      if (!isEnemy(who, target)) continue;
      for (const id of [who, target]) {
        const row = watched.get(id);
        if (!row) continue;
        if (!validHpHit(event)) row.invalidHpHits += 1;
        else if (event.hpDamage > 0) {
          row.committedHits += 1;
          row.diagnostics[id === who ? 'outgoingHpHits' : 'incomingHpHits'] += 1;
        }
      }
      const key = actionKey(event);
      if (!damageByAction.has(key)) damageByAction.set(key, []);
      damageByAction.get(key).push({ index, event });
    } else if (event.kind === 'team_engagement') {
      if (event.encounterId) engagements.set(event.encounterId, { index, event });
      for (const row of participants) {
        const ownSide = Array.isArray(event.teams)
          ? event.teams.find(side => Array.isArray(side) && side.includes(row.actorId)) : null;
        if (!ownSide) continue;
        row.diagnostics.engagements += 1;
        if (ownSide.some(id => row.changedTeammateIds.includes(id))) row.diagnostics.changedTeammateEngagements += 1;
        if (Array.isArray(event.participants) && event.participants.includes(row.actorId)) row.diagnostics.activeEngagementTurns += 1;
      }
    } else if (event.kind === 'team_strike') {
      const row = watched.get(String(event.who)), entry = engagements.get(event.encounterId);
      if (!row) continue;
      row.diagnostics.strikeCandidates += 1;
      if (!entry) { rejectStrike(row, 'missing_engagement', index, event, entry); continue; }
      if (!isEnemy(row.actorId, String(event.targetId)) || event.teamId !== row.teamId
        || !(event.damage > 0) || !Number.isFinite(event.damage)) {
        rejectStrike(row, 'identity_or_positive_damage', index, event, entry); continue;
      }
      const engagement = entry.event;
      const sec = event.at?.sec;
      if (!Number.isFinite(sec) || sec < 0 || engagement.at?.sec !== sec
        || engagement.atSec !== sec || !event.zoneId || engagement.zoneId !== event.zoneId
        || !Array.isArray(engagement.participants) || !engagement.participants.includes(row.actorId)
        || !Array.isArray(engagement.teams) || engagement.teams.length !== 2
        || !engagement.teams.every(side => Array.isArray(side) && side.length > 0)) {
        rejectStrike(row, 'clock_zone_or_participation', index, event, entry); continue;
      }
      const sides = engagement.teams;
      const allIds = sides.flat();
      if (new Set(allIds).size !== allIds.length || allIds.some(id => !actors.has(id))) {
        rejectStrike(row, 'invalid_side_members', index, event, entry); continue;
      }
      const ownSide = sides.find(side => side.includes(row.actorId));
      const enemySide = sides.find(side => side.includes(String(event.targetId)));
      if (!ownSide || !enemySide || ownSide === enemySide
        || ownSide.some(id => getActorTeamId(actors.get(id)) !== row.teamId)
        || enemySide.some(id => getActorTeamId(actors.get(id)) !== getActorTeamId(actors.get(String(event.targetId))))) {
        rejectStrike(row, 'inconsistent_team_sides', index, event, entry); continue;
      }
      const changedAllies = ownSide.filter(id => row.changedTeammateIds.includes(id));
      if (!changedAllies.length) { rejectStrike(row, 'changed_teammates_absent', index, event, entry); continue; }
      const packets = (damageByAction.get(actionKey(event)) || []).filter(hit => hit.index > entry.index && hit.index < index);
      if (!packets.length || packets.some(hit => !validHpHit(hit.event))
        || packets.some((hit, packetIndex) => packetIndex > 0
          && !near(packets[packetIndex - 1].event.hpAfter, hit.event.hpBefore))
        || !near(packets.reduce((total, hit) => total + hit.event.hpDamage, 0), event.damage)) {
        rejectStrike(row, 'committed_hp_mismatch', index, event, entry); continue;
      }
      row.engagementActions += 1;
      remember(row, { kind: 'team_strike', engagementIndex: entry.index, strikeIndex: index,
        damageIndexes: packets.map(hit => hit.index), encounterId: event.encounterId,
        changedAllyIds: changedAllies, targetId: event.targetId, hpDamage: event.damage, atSec: sec });
    } else if (event.kind === 'team_cover') {
      const who = String(event.who), chaser = String(event.chaserId), helpers = event.helpers;
      if (!isEnemy(who, chaser) || !Array.isArray(helpers) || !helpers.length
        || new Set(helpers).size !== helpers.length || helpers.includes(who)
        || helpers.some(id => !actors.has(id) || getActorTeamId(actors.get(id)) !== getActorTeamId(actors.get(who)))
        || !Number.isFinite(event.escapeBonus) || event.escapeBonus <= 0 || event.escapeBonus > 0.24
        || !Number.isFinite(event.at?.sec) || event.at.sec < 0 || !event.zoneId) continue;
      const members = [who, ...helpers];
      for (const id of members) {
        const row = watched.get(id);
        if (!row) continue;
        const changedAllies = members.filter(member => row.changedTeammateIds.includes(member));
        if (!changedAllies.length) continue;
        row.coverActions += 1;
        remember(row, { kind: 'team_cover', eventIndex: index, changedAllyIds: changedAllies,
          who, chaserId: chaser, helpers: [...helpers], escapeBonus: event.escapeBonus, atSec: event.at.sec });
      }
    }
  }
  for (const row of participants) {
    row.teamActions = row.engagementActions + row.coverActions;
    row.ready = row.committedHits > 0 && row.invalidHpHits === 0 && row.teamActions > 0;
  }
  return { participants, ready: participants.length > 0 && participants.every(row => row.ready),
    scope: 'Each swapped actor has valid enemy-player HP hits and changed-teammate membership in an exact successful team strike or positive retreat cover. Co-present allies need not also act; no regroup, survival contribution or winner causality acceptance.' };
}
