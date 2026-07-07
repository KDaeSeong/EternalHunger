import { slotLabel } from './schaleIdleEngine';

export function formatRolls(equip) {
  const rolls = equip?.rolls || {};
  return [
    `화력 ${Math.round(Number(rolls.powerAddMul || 1) * 100)}%`,
    `계수 ${Math.round(Number(rolls.powerMulMul || 1) * 100)}%`,
    `스태미나 ${Math.round(Number(rolls.staminaMulMul || 1) * 100)}%`,
  ].join(' · ');
}

export function formatAffixes(equip) {
  return (equip?.affixes || []).map((affix) => `${affix.locked ? '잠금 ' : ''}${affix.label} x${affix.value}`).join(', ');
}

const RARITY_PRIORITY = {
  COMMON: 1,
  UNCOMMON: 2,
  RARE: 3,
  EPIC: 4,
};

const AFFIX_TUNING = {
  POWER_ADD_MUL: { high: 1.12, low: 1.03, weight: 120 },
  POWER_MUL_MUL: { high: 1.025, low: 1.008, weight: 900 },
  STAMINA_MUL_MUL: { high: 1.035, low: 1.012, weight: 420 },
  GLOBAL_MUL: { high: 1.016, low: 1.006, weight: 1200 },
};

function affixTuningScore(affix) {
  const tuning = AFFIX_TUNING[affix?.stat] || { high: 1.03, low: 1.01, weight: 300 };
  const value = Number(affix?.value || 1);
  return Math.round((value - 1) * tuning.weight);
}

function affixTone(affix) {
  const tuning = AFFIX_TUNING[affix?.stat] || { high: 1.03, low: 1.01 };
  const value = Number(affix?.value || 1);
  if (value >= tuning.high) return '고점';
  if (value <= tuning.low) return '저점';
  return '보통';
}

export function buildEquipmentTuning(equipped = [], state = {}) {
  const inventory = state.inventory || {};
  const rows = equipped.map((equip) => {
    const affixes = Array.isArray(equip.affixes) ? equip.affixes : [];
    const scoredAffixes = affixes.map((affix) => ({
      ...affix,
      score: affixTuningScore(affix),
      tone: affixTone(affix),
    }));
    const optionScore = scoredAffixes.reduce((sum, affix) => sum + affix.score, 0);
    const lockedCount = scoredAffixes.filter((affix) => affix.locked).length;
    const highUnlocked = scoredAffixes
      .filter((affix) => !affix.locked && affix.tone === '고점')
      .sort((a, b) => b.score - a.score);
    const lowUnlockedCount = scoredAffixes.filter((affix) => !affix.locked && affix.tone === '저점').length;
    const enhance = Number(equip.enhance || 0);
    const enhanceCreditCost = 70 + enhance * 35;
    const enhanceStoneCost = 1 + Math.floor(enhance / 3);
    const rerollTicketCost = 1 + lockedCount;
    const rerollTokenCost = 12 + lockedCount * 8 + Number(equip.rerollCount || 0) * 2;
    const canEnhance = Number(state.credits || 0) >= enhanceCreditCost
      && Number(inventory.itm_enhance_stone || 0) >= enhanceStoneCost;
    const canRerollByTicket = Number(inventory.itm_reroll_ticket || 0) >= rerollTicketCost;
    const canRerollByToken = Number(inventory.itm_tower_token || 0) >= rerollTokenCost;
    return {
      slot: equip.slot,
      name: equip.name,
      rarity: equip.rarity,
      rarityPriority: RARITY_PRIORITY[equip.rarity] || 1,
      enhance,
      optionScore,
      lockedCount,
      lowUnlockedCount,
      highUnlocked,
      enhanceCreditCost,
      enhanceStoneCost,
      rerollTicketCost,
      rerollTokenCost,
      canEnhance,
      canReroll: canRerollByTicket || canRerollByToken,
      rerollCostText: canRerollByTicket ? `리롤권 ${rerollTicketCost}장` : `시련 토큰 ${rerollTokenCost}개`,
    };
  });

  const highUnlockedCount = rows.reduce((sum, row) => sum + row.highUnlocked.length, 0);
  const lockedCount = rows.reduce((sum, row) => sum + row.lockedCount, 0);
  const lowOptionCount = rows.reduce((sum, row) => sum + row.lowUnlockedCount, 0);
  const avgOptionScore = rows.length
    ? Math.round(rows.reduce((sum, row) => sum + row.optionScore, 0) / rows.length)
    : 0;

  const lockTarget = rows
    .flatMap((row) => row.highUnlocked.map((affix) => ({
      slot: row.slot,
      name: row.name,
      affixId: affix.id,
      label: affix.label,
      value: affix.value,
      score: affix.score,
    })))
    .sort((a, b) => b.score - a.score)[0] || null;

  const rerollTarget = rows
    .filter((row) => row.canReroll && (row.lowUnlockedCount > 0 || row.optionScore < 12))
    .sort((a, b) => a.optionScore - b.optionScore || b.rarityPriority - a.rarityPriority)[0] || null;

  const enhanceTarget = rows
    .filter((row) => row.canEnhance)
    .sort((a, b) => (
      (b.rarityPriority * 100 + b.optionScore - b.enhance * 6)
      - (a.rarityPriority * 100 + a.optionScore - a.enhance * 6)
    ))[0] || null;

  const actions = [
    lockTarget ? {
      id: 'lock',
      type: 'lock',
      label: '옵션 잠금',
      slot: lockTarget.slot,
      affixId: lockTarget.affixId,
      title: `${slotLabel(lockTarget.slot)} · ${lockTarget.name}`,
      detail: `${lockTarget.label} x${lockTarget.value}는 고점이라 재련 전에 잠그는 편이 좋습니다.`,
      enabled: true,
    } : {
      id: 'lock',
      type: 'idle',
      label: '옵션 잠금',
      title: '즉시 잠글 고점 옵션이 없습니다.',
      detail: '현재 장비는 잠금보다 제작/탑 보상 확보가 우선입니다.',
      enabled: false,
    },
    rerollTarget ? {
      id: 'reroll',
      type: 'reroll',
      label: '옵션 재련',
      slot: rerollTarget.slot,
      title: `${slotLabel(rerollTarget.slot)} · ${rerollTarget.name}`,
      detail: `옵션 점수 ${rerollTarget.optionScore}점, 저점 ${rerollTarget.lowUnlockedCount}개입니다. 비용은 ${rerollTarget.rerollCostText}입니다.`,
      enabled: true,
    } : {
      id: 'reroll',
      type: 'idle',
      label: '옵션 재련',
      title: '재련 우선 장비가 없습니다.',
      detail: '저점 옵션이 적거나 재련 재화가 부족합니다. 탑 상점과 미션 보상을 먼저 확인하세요.',
      enabled: false,
    },
    enhanceTarget ? {
      id: 'enhance',
      type: 'enhance',
      label: '강화',
      slot: enhanceTarget.slot,
      title: `${slotLabel(enhanceTarget.slot)} · ${enhanceTarget.name}`,
      detail: `+${enhanceTarget.enhance} 장비입니다. 강화 비용은 ${enhanceTarget.enhanceCreditCost} Cr, 강화석 ${enhanceTarget.enhanceStoneCost}개입니다.`,
      enabled: true,
    } : {
      id: 'enhance',
      type: 'idle',
      label: '강화',
      title: '즉시 강화할 수 있는 장비가 없습니다.',
      detail: '크레딧 또는 강화석이 부족합니다. 제작이나 탑 보상으로 재료를 확보하세요.',
      enabled: false,
    },
  ];

  return {
    rows,
    actions,
    avgOptionScore,
    highUnlockedCount,
    lockedCount,
    lowOptionCount,
    rerollTickets: Number(inventory.itm_reroll_ticket || 0),
    towerTokens: Number(inventory.itm_tower_token || 0),
    enhanceStones: Number(inventory.itm_enhance_stone || 0),
    headline: rows.length ? `${actions.filter((action) => action.enabled).length}개 실행 가능` : '장비 없음',
  };
}
