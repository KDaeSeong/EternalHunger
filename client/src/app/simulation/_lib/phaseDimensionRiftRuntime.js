import {
  addItemToInventory,
  applyAiRecoveryWindow,
  autoEquipBest,
  buildRuntimeSurvivorMap,
  classifySpecialByName,
  clearRuntimeCombatFields,
  findDimensionRiftGiftItem,
  getDimensionRiftGiftMeta,
  itemDisplayName,
  listActiveDimensionRifts,
  normalizeInventory,
  normalizeRuntimeSurvivorList,
  pickDimensionRiftChoice,
  pickRiftEntrantTeams,
  resolveDimensionRiftWinner,
  tryImmediateCraftFromSpecial,
} from './simulationEngine';
import { gainText } from './runEventRuntime';
import { estimateMovePowerRuntime } from './movePowerRuntime';

export function runDimensionRiftPhase({
  actions = {},
  state = {},
} = {}) {
  const {
    currentActionSec = () => 0,
    forbiddenIds = new Set(),
    isSoloMatch = false,
    itemMetaById,
    itemNameById,
    movePowerContext,
    nextDay,
    nextPhase,
    nextSpawn,
    phaseIdxNow = 0,
    publicItems,
    ruleset,
    updatedSurvivors = [],
    zones = [],
  } = state;
  const {
    addLog = () => {},
    atNow = () => null,
    emitItemGainIfAny = () => {},
    emitRunEvent = () => {},
    getZoneName = (zoneId) => String(zoneId || ''),
  } = actions;

  if (isSoloMatch || String(nextPhase || '') !== 'night' || ![2, 3, 4].includes(Number(nextDay || 0))) {
    return {
      updatedSurvivors,
      ran: false,
    };
  }

  const activeRifts = listActiveDimensionRifts(nextSpawn);
  if (activeRifts.length <= 0) {
    return {
      updatedSurvivors,
      ran: false,
    };
  }

  const survivorById = buildRuntimeSurvivorMap(updatedSurvivors);
  const safeReturnZones = (Array.isArray(zones) ? zones : [])
    .map((zone) => String(zone?.zoneId || ''))
    .filter((zoneId) => zoneId && !forbiddenIds.has(String(zoneId)));
  const usedRiftTeamIds = new Set();
  const giftMeta = getDimensionRiftGiftMeta(nextDay);
  const rewardCredits = Math.max(0, Math.floor(Number(ruleset?.worldSpawns?.dimensionRift?.rewardCreditsByDay?.[String(nextDay)] ?? (
    Number(nextDay || 0) === 2 ? 45 : Number(nextDay || 0) === 3 ? 65 : 90
  ))));

  const pickRiftReturnZone = (actor) => {
    const preferred = [
      actor?.riftReturnZoneId,
      actor?.aiTargetZoneId,
      Array.isArray(actor?.routePlanZoneIds) ? actor.routePlanZoneIds[Math.max(0, Number(actor?.routePlanIndex || 0))] : '',
    ]
      .map((zoneId) => String(zoneId || ''))
      .find((zoneId) => zoneId && !forbiddenIds.has(String(zoneId)));
    if (preferred) return preferred;
    if (safeReturnZones.length) return safeReturnZones[Math.floor(Math.random() * safeReturnZones.length)];
    return String(actor?.zoneId || zones?.[0]?.zoneId || '');
  };

  const getCurrentTeamMembers = (team) => (Array.isArray(team?.members) ? team.members : [])
    .map((member) => survivorById.get(String(member?._id || '')))
    .filter((member) => member && Number(member?.hp || 0) > 0);

  for (const rift of activeRifts) {
    if (Number(rift?.day || 0) !== Number(nextDay || 0) || String(rift?.phase || '') !== String(nextPhase || '')) continue;
    const entrantTeams = pickRiftEntrantTeams(rift, Array.from(survivorById.values()))
      .filter((team) => team?.teamId && !usedRiftTeamIds.has(String(team.teamId)));

    if (entrantTeams.length <= 0) {
      rift.resolved = true;
      rift.closedWithoutEntrants = true;
      continue;
    }

    rift.entrantTeamIds = entrantTeams.map((team) => String(team.teamId || '')).filter(Boolean);
    const riftZoneName = getZoneName(rift.zoneId);
    addLog(`🌀 차원의 틈 진입: ${riftZoneName} · ${entrantTeams.map((team) => team.teamName || team.teamId).join(' vs ')}`, 'highlight');

    const riftResult = resolveDimensionRiftWinner(entrantTeams, (actor) => estimateMovePowerRuntime(actor, movePowerContext));
    const winnerTeam = riftResult?.winner || null;
    const loserTeam = riftResult?.loser || null;
    if (!winnerTeam) continue;

    const winnerMembers = getCurrentTeamMembers(winnerTeam);
    const loserMembers = getCurrentTeamMembers(loserTeam);
    if (!winnerMembers.length) continue;

    rift.resolved = true;
    rift.winnerTeamId = String(winnerTeam.teamId || '');
    rift.loserTeamId = String(loserTeam?.teamId || '');
    usedRiftTeamIds.add(String(winnerTeam.teamId || ''));
    if (loserTeam?.teamId) usedRiftTeamIds.add(String(loserTeam.teamId));

    if (riftResult?.uncontested) {
      addLog(`🌀 [${winnerTeam.teamName || winnerTeam.teamId}] 차원의 틈 무혈 점거`, 'highlight');
    } else {
      addLog(`⚔️ 차원의 틈 교전: [${winnerTeam.teamName || winnerTeam.teamId}] 승리`, 'death');
    }

    for (const member of winnerMembers) {
      member.simCredits = Math.max(0, Number(member.simCredits || 0) + rewardCredits);
      survivorById.set(String(member._id || ''), member);
      emitRunEvent('gain', {
        who: String(member?._id || ''),
        itemId: 'CREDITS',
        qty: rewardCredits,
        source: 'dimension_rift',
        zoneId: String(rift?.zoneId || ''),
      }, atNow());
    }

    const representative = winnerMembers
      .slice()
      .sort((a, b) => Number(estimateMovePowerRuntime(b, movePowerContext) || 0) - Number(estimateMovePowerRuntime(a, movePowerContext) || 0))[0];

    let giftGot = 0;
    let choiceGot = 0;
    let choiceItemId = '';
    let choiceName = '';
    if (representative) {
      representative.inventory = normalizeInventory(representative.inventory, ruleset);
      const giftItem = findDimensionRiftGiftItem(publicItems, nextDay);
      if (giftItem?._id) {
        representative.inventory = addItemToInventory(representative.inventory, giftItem, String(giftItem._id), 1, nextDay, ruleset);
        const giftMetaAdd = representative.inventory?._lastAdd;
        giftGot = Math.max(0, Number(giftMetaAdd?.acceptedQty ?? 1));
      }

      const choice = pickDimensionRiftChoice(publicItems, nextDay);
      const choiceItem = choice?.item || null;
      if (choiceItem?._id) {
        choiceItemId = String(choiceItem._id);
        choiceName = itemDisplayName(choiceItem);
        representative.inventory = addItemToInventory(representative.inventory, choiceItem, choiceItemId, 1, nextDay, ruleset);
        const choiceMeta = representative.inventory?._lastAdd;
        choiceGot = Math.max(0, Number(choiceMeta?.acceptedQty ?? 1));
        emitItemGainIfAny(choiceGot, {
          who: String(representative?._id || ''),
          itemId: choiceItemId,
          source: 'dimension_rift',
          zoneId: String(rift?.zoneId || ''),
          giftRarity: String(giftMeta?.rarity || ''),
        }, atNow());

        const immediate = tryImmediateCraftFromSpecial(
          representative,
          classifySpecialByName(choiceName),
          choiceItemId,
          publicItems,
          itemNameById,
          itemMetaById,
          nextDay,
          nextPhase,
          phaseIdxNow,
          ruleset,
        );
        if (immediate?.changed) {
          representative.inventory = immediate.inventory;
          (Array.isArray(immediate.logs) ? immediate.logs : []).forEach((message) => addLog(String(message), 'highlight'));
        }
        if (choiceGot > 0) autoEquipBest(representative, itemMetaById);
      }

      survivorById.set(String(representative._id || ''), representative);
      addLog(`🎁 [${representative.name}] 아글라이아의 선물(${giftMeta?.label || rift.giftLabel || '보상'}) ${gainText(giftGot)}${choiceName ? ` → [${choiceName}] ${gainText(choiceGot, '선택', '선택 실패')}` : ''}`, 'highlight');
    }

    if (loserTeam && loserMembers.length) {
      const returnNames = [];
      for (const member of loserMembers) {
        const returnZoneId = pickRiftReturnZone(member);
        const maxHp = Math.max(1, Number(member?.maxHp ?? 100));
        member.hp = Math.max(1, Math.floor(maxHp * 0.65));
        member.zoneId = returnZoneId;
        clearRuntimeCombatFields(member);
        applyAiRecoveryWindow(member, currentActionSec(), {
          reason: 'dimension_rift_loss',
          recoverSec: 8,
          safeZoneSec: 3,
        });
        survivorById.set(String(member._id || ''), member);
        returnNames.push(`${member.name}:${getZoneName(returnZoneId)}`);
      }
      addLog(`🩹 [${loserTeam.teamName || loserTeam.teamId}] 차원의 틈 패배 후 분산: ${returnNames.join(', ')}`, 'system');
    }

    emitRunEvent('dimension_rift', {
      zoneId: String(rift?.zoneId || ''),
      winnerTeamId: String(winnerTeam?.teamId || ''),
      loserTeamId: String(loserTeam?.teamId || ''),
      entrantTeamIds: rift.entrantTeamIds,
      credits: rewardCredits,
      giftRarity: String(giftMeta?.rarity || ''),
      choiceItemId,
    }, atNow());
  }

  return {
    updatedSurvivors: normalizeRuntimeSurvivorList(Array.from(survivorById.values()))
      .filter((survivor) => Number(survivor.hp || 0) > 0),
    ran: true,
  };
}
