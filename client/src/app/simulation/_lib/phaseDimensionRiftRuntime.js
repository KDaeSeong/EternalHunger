import { autoEquipBest } from './gearFallbackRuntime';
import { classifySpecialByName } from './craftRuntime';
import { itemDisplayName } from './simulationCommon';
import { tryImmediateCraftFromSpecial } from './gearImmediateSpecialCraftRuntime';
import { advanceDimensionRiftContest } from './dimensionRiftContestRuntime.js';
import { tryClaimDimensionRiftReward } from './dimensionRiftRewardRuntime.js';
import { engageCombatParticipants } from './combatTimingRuntime.js';
import { canObserveActor } from './combatSpatialRuntime.js';
import { releaseOrphanedDimensionRiftSpaces } from './dimensionRiftSpaceRuntime.js';
import { expireEliminatedDimensionRiftReward } from './dimensionRiftRecipientRuntime.js';
import { describeDimensionRiftRewardClosure } from './dimensionRiftRewardPresentation.js';

export function runDimensionRiftPhase({ actions = {}, state = {} } = {}) {
  const { currentActionSec = () => 0, forbiddenIds = new Set(), isSoloMatch = false,
    itemMetaById, itemNameById, nextDay, nextPhase, nextSpawn, phaseIdxNow = 0,
    phaseStartSec, phaseDurationSec, publicItems = [], ruleset = {}, updatedSurvivors = [], revivalContext } = state;
  const { addLog = () => {}, atNow = () => null, emitRunEvent = () => {},
    emitItemGainIfAny = () => {}, getZoneName = (id) => String(id || '') } = actions;
  const rifts = nextSpawn?.dimensionRifts || [];
  const now = Number(currentActionSec());
  const matchClosed = Boolean(nextSpawn?.dimensionRiftMatchClosure);
  for (const change of releaseOrphanedDimensionRiftSpaces(updatedSurvivors, isSoloMatch || matchClosed ? [] : rifts, now)) {
    emitRunEvent('dimension_rift_space', change, atNow());
    if (change.reason === 'membership_invalid') {
      addLog(`🌀 [${updatedSurvivors.find((actor) => String(actor._id) === change.who)?.name || change.who}] 손상된 차원의 틈 참가 기록 격리 · 보상 제외`, 'system');
    }
  }
  if (isSoloMatch || matchClosed || !rifts.length) return { updatedSurvivors, ran: false };
  const usedTeamIds = new Set(rifts.filter((rift) => Number(rift.day) === Number(nextDay)
    && String(rift.phase) === String(nextPhase)).flatMap((rift) => rift.entrantTeamIds || []));
  for (const rift of rifts) {
    const delta = advanceDimensionRiftContest(rift, updatedSurvivors, {
      nowSec: now, phaseStartSec, phaseDurationSec, day: nextDay, phase: nextPhase, phaseIdxNow,
      rule: ruleset.worldSpawns?.dimensionRift, forbiddenIds, usedTeamIds,
    });
    for (const joined of delta.joined) {
      addLog(`🌀 [${joined.teamName || joined.teamId}] 차원의 틈 참가: ${getZoneName(rift.zoneId)}`, 'highlight');
      emitRunEvent('dimension_rift_enter', { riftId: rift.id, zoneId: rift.zoneId,
        ...joined, entryClosesAtSec: rift.entryClosesAtSec }, atNow());
    }
    for (const departed of delta.departed) {
      emitRunEvent('dimension_rift_depart', { riftId: rift.id, zoneId: rift.zoneId, ...departed }, atNow());
    }
    for (const change of delta.spaceChanges) {
      emitRunEvent('dimension_rift_space', { ...change, zoneId: rift.zoneId }, atNow());
      if (change.reason === 'defeated') addLog(`🌀 [${updatedSurvivors.find((actor) => String(actor._id) === change.who)?.name || change.who}] 전투 불능 후 입구 복귀 · HP ${change.defeat.hpAfter} 유지 · 복귀 보호 3초`, 'system');
      if (change.reason === 'membership_invalid') addLog(`🌀 [${updatedSurvivors.find((actor) => String(actor._id) === change.who)?.name || change.who}] 손상된 차원의 틈 참가 기록 격리 · 보상 제외`, 'system');
    }
    // Discover the opponents; the existing attack/cast scheduler spends real
    // time and applies HP/status changes. No nested battle or scoring roll.
    const teams = delta.activeTeams;
    if (teams.length >= 2) {
      for (let index = 0; index < teams.length; index++) {
        const ours = teams[index].members;
        const theirs = teams[(index + 1) % teams.length].members;
        const pair = ours.flatMap((actor) => theirs.map((target) => ({ actor, target })))
          .find(({ actor, target }) => canObserveActor(actor, target, updatedSurvivors));
        if (pair) engageCombatParticipants(pair.actor, pair.target, updatedSurvivors, now,
          { teamCombat: ruleset.pvp?.teamCombatEnabled !== false });
      }
    }
    if (delta.resolution) {
      const result = delta.resolution;
      const reason = result.reason === 'uncontested' ? '참가 마감 후 단독 점거'
        : result.reason === 'last_present_team' ? '다른 참가 팀 전투 불능·이탈 후 점거' : '승자 없이 종료';
      addLog(`🌀 차원의 틈 ${getZoneName(rift.zoneId)}: ${reason}`, result.winnerTeamId ? 'highlight' : 'system');
      emitRunEvent('dimension_rift', { ...result, riftId: rift.id, zoneId: rift.zoneId,
        entrantTeamIds: [...(rift.entrantTeamIds || [])], loserTeamId: rift.loserTeamId,
        credits: 0, rewardStatus: result.winnerTeamId ? 'pending' : 'none' }, atNow());
    }
    const expiry = expireEliminatedDimensionRiftReward(rift, updatedSurvivors,
      { ...revivalContext, phaseIdxNow, nowSec: now, ruleset });
    if (expiry.expired) {
      emitRunEvent('dimension_rift_reward_closed', { ...expiry.closure, riftId: rift.id, zoneId: rift.zoneId }, atNow());
      addLog(describeDimensionRiftRewardClosure(expiry.closure), 'system');
      continue;
    }
    const claim = tryClaimDimensionRiftReward(rift, updatedSurvivors, { publicItems, ruleset, nowSec: now, day: nextDay });
    if (claim.announce) {
      const labels = { inventory_full: '가방 공간 부족', recipient_away: '수령자가 다른 지역에 있음',
        missing_catalog_content: '보상 아이템 데이터 없음', no_living_recipient: '생존 수령자 없음',
        invalid_current_credits: '현재 크레딧 데이터 오류' };
      addLog(`🎁 차원의 틈 보상 대기: ${labels[claim.reason] || claim.reason}`, 'system');
      emitRunEvent('dimension_rift_reward_pending', { riftId: rift.id, reason: claim.reason }, atNow());
    }
    if (!claim.claimed) continue;
    const { receipt, representative, item } = claim;
    for (const credit of receipt.credits) {
      if (credit.qty > 0) emitRunEvent('gain', { ...credit, itemId: 'CREDITS', source: 'dimension_rift',
        riftId: rift.id, receiptId: receipt.id, zoneId: rift.zoneId }, atNow());
    }
    emitItemGainIfAny(receipt.qty, { who: receipt.who, itemId: receipt.itemId,
      source: 'dimension_rift', riftId: rift.id, receiptId: receipt.id, zoneId: rift.zoneId,
      giftRarity: receipt.giftRarity }, atNow());
    emitRunEvent('dimension_rift_reward', { ...receipt, riftId: rift.id, zoneId: rift.zoneId }, atNow());
    addLog(`🎁 [${representative.name}] 차원의 틈 선물 개봉 → [${itemDisplayName(item)}] 1개`, 'highlight');
    const immediate = tryImmediateCraftFromSpecial(representative, classifySpecialByName(itemDisplayName(item)),
      receipt.itemId, publicItems, itemNameById, itemMetaById, nextDay, nextPhase, phaseIdxNow, ruleset);
    if (immediate?.changed) representative.inventory = immediate.inventory;
    (immediate?.logs || []).forEach((message) => addLog(String(message), immediate.changed ? 'highlight' : 'system'));
    autoEquipBest(representative, itemMetaById);
  }
  // Keep the authoritative identities, including zero-HP snapshots awaiting
  // normal death finalization. Observing a rift must not clone or revive them.
  return { updatedSurvivors, ran: true };
}
