import { GameFeatureTabs } from '../../_components/GamePlayShell';
import {
  applyUpgradeAction,
  attemptTowerAction,
  autoSalvageAction,
  buyTowerShopOfferAction,
  claimAchievementRewardsAction,
  claimMissionRewardsAction,
  craftRecipeAction,
  resolveDutyAction,
  restAction,
  salvageSelectedAction,
} from '../_lib/schaleIdleEngine';
import SchaleIdlePlanTab from './SchaleIdlePlanTab';
import SchaleIdleSeasonTab from './SchaleIdleSeasonTab';
import SchaleIdleSyncTab from './SchaleIdleSyncTab';
import SchaleIdleDutyTab from './SchaleIdleDutyTab';
import SchaleIdleGearTab from './SchaleIdleGearTab';
import SchaleIdleRecordsTab from './SchaleIdleRecordsTab';

export default function SchaleIdleFeatureTabs(props) {
  const {
    dailyPlan,
    equipped,
    seasonReport,
    setRecipeId,
    setSelectedSalvageUids,
    setState,
    state,
    syncReport,
    towerBatchCount,
    towerStopOnFail,
    validSelectedSalvageUids,
  } = props;

  const runAutoSalvage = () => {
    setState((current) => autoSalvageAction(current));
    setSelectedSalvageUids([]);
  };

  const runSelectedSalvage = () => {
    const selectedUids = validSelectedSalvageUids;
    setState((current) => salvageSelectedAction(current, selectedUids));
    setSelectedSalvageUids([]);
  };

  const runPlanCommand = (command) => {
    if (!command?.type) return;
    if (command.type === 'claim-rewards') {
      setState((current) => claimAchievementRewardsAction(claimMissionRewardsAction(current)));
      return;
    }
    if (command.type === 'rest') {
      setState((current) => restAction(current));
      return;
    }
    if (command.type === 'duty') {
      setState((current) => resolveDutyAction(current, command.minutes || 120));
      return;
    }
    if (command.type === 'tower') {
      setState((current) => attemptTowerAction(current, towerBatchCount, towerStopOnFail));
      return;
    }
    if (command.type === 'salvage') {
      runAutoSalvage();
      return;
    }
    if (command.type === 'upgrade' && command.upgradeId) {
      setState((current) => applyUpgradeAction(current, command.upgradeId));
      return;
    }
    if (command.type === 'craft' && command.recipeId) {
      setRecipeId(command.recipeId);
      setState((current) => craftRecipeAction(current, command.recipeId));
      return;
    }
    if (command.type === 'buy-offer' && command.offerId) {
      setState((current) => buyTowerShopOfferAction(current, command.offerId));
    }
  };

  const toggleSalvageSelection = (uid) => {
    setSelectedSalvageUids((current) => (
      current.includes(uid) ? current.filter((item) => item !== uid) : [...current, uid]
    ));
  };

  const tabProps = {
    ...props,
    runAutoSalvage,
    runPlanCommand,
    runSelectedSalvage,
    toggleSalvageSelection,
  };

  return (
    <GameFeatureTabs
      tabs={[
        {
          id: 'plan',
          label: '운영 플랜',
          badge: dailyPlan.riskLabel,
          children: <SchaleIdlePlanTab {...tabProps} />,
        },
        {
          id: 'season',
          label: '시즌/밸런스',
          badge: seasonReport.riskLabel,
          children: <SchaleIdleSeasonTab {...tabProps} />,
        },
        {
          id: 'sync',
          label: '계정 동기화',
          badge: `${syncReport.syncScore}%`,
          children: <SchaleIdleSyncTab {...tabProps} />,
        },
        {
          id: 'duty',
          label: '당직/제작',
          badge: `${state.stamina}/100`,
          children: <SchaleIdleDutyTab {...tabProps} />,
        },
        {
          id: 'gear',
          label: '장비/보상',
          badge: `${equipped.length}개`,
          children: <SchaleIdleGearTab {...tabProps} />,
        },
        {
          id: 'records',
          label: '보고서/로그',
          badge: `${state.log.length}개`,
          children: <SchaleIdleRecordsTab {...tabProps} />,
        },
      ]}
    />
  );
}
