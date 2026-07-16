import {
  RECIPES,
  achievementRows,
  accountSyncReportForState,
  availableEnhanceSlots,
  dailyOperationsPlanForState,
  equipmentInventoryRows,
  equipmentInventorySummary,
  equipmentPresetRows,
  enhancePlanForSlot,
  getEquippedEquipment,
  getEquippedList,
  getLeader,
  growthReportForState,
  growthRoadmapForState,
  inventoryRows,
  missionRows,
  recipeCostPlan,
  salvageRows,
  salvageSummary,
  scoreState,
  seasonOperationsReportForState,
  seasonRewardRows,
  selectedSalvageSummary,
  teamPower,
  titleRows,
  towerShopRows,
  towerShopRotationSummary,
  upgradeRows,
} from './schaleIdleEngine';
import { buildEquipmentTuning } from './schaleEquipmentTuning';

export function buildSchaleIdlePlayViewModel({
  enhanceSlot,
  recipeId,
  selectedPresetId,
  selectedSalvageUids,
  state,
}) {
  const equipped = getEquippedList(state);
  const enhanceSlots = availableEnhanceSlots(state);
  const rows = inventoryRows(state);
  const equipmentVault = equipmentInventoryRows(state);
  const equipmentVaultSummary = equipmentInventorySummary(state);
  const missions = missionRows(state);
  const achievements = achievementRows(state);
  const titles = titleRows(state);
  const upgrades = upgradeRows(state);
  const salvage = salvageRows(state);
  const salvageInfo = salvageSummary(state);
  const uidSet = new Set(salvage.map((entry) => entry.uid));
  const validSelectedSalvageUids = selectedSalvageUids.filter((uid) => uidSet.has(uid));
  const selectedSalvageInfo = selectedSalvageSummary(state, validSelectedSalvageUids);
  const shopOffers = towerShopRows(state);
  const shopRotation = towerShopRotationSummary(state);
  const presets = equipmentPresetRows(state);
  const equipmentTuning = buildEquipmentTuning(equipped, state);
  const growthReport = growthReportForState(state);
  const growthRoadmap = growthRoadmapForState(state);
  const dailyPlan = dailyOperationsPlanForState(state);
  const seasonReport = seasonOperationsReportForState(state);
  const seasonRewards = seasonRewardRows(state);
  const syncReport = accountSyncReportForState(state);
  const leader = getLeader(state);
  const selectedRecipe = RECIPES.find((item) => item.id === recipeId) || RECIPES[0];
  const selectedRecipePlan = recipeCostPlan(state, selectedRecipe.id);
  const selectedSlot = enhanceSlots.includes(enhanceSlot) ? enhanceSlot : enhanceSlots[0] || '';
  const selectedEquip = selectedSlot ? getEquippedEquipment(state, selectedSlot) : null;
  const selectedEnhancePlan = selectedSlot ? enhancePlanForSlot(state, selectedSlot) : null;
  const power = teamPower(state);
  const score = scoreState(state);
  const claimableAchievements = achievements.filter((achievement) => achievement.canClaim).length;
  const equippedTitle = titles.find((title) => title.equipped);
  const totalUpgradeLevel = upgrades.reduce((sum, upgrade) => sum + Number(upgrade.level || 0), 0);
  const activePresetId = selectedPresetId || state.activePresetId || presets[0]?.id || '';
  const selectedPreset = presets.find((preset) => preset.id === activePresetId);
  const recentActionText = state.log?.[0] || '아직 실행한 성장 액션이 없습니다.';

  return {
    achievements,
    activePresetId,
    claimableAchievements,
    dailyPlan,
    enhanceSlots,
    equipped,
    equippedTitle,
    equipmentTuning,
    equipmentVault,
    equipmentVaultSummary,
    growthReport,
    growthRoadmap,
    leader,
    missions,
    power,
    presets,
    recentActionText,
    rows,
    salvage,
    salvageInfo,
    score,
    seasonReport,
    seasonRewards,
    selectedEquip,
    selectedEnhancePlan,
    selectedPreset,
    selectedRecipe,
    selectedRecipePlan,
    selectedSalvageInfo,
    selectedSlot,
    shopOffers,
    shopRotation,
    syncReport,
    titles,
    totalUpgradeLevel,
    upgrades,
    validSelectedSalvageUids,
  };
}
