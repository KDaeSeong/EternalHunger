import { classifySpecialByName } from './craftRuntime';
import { invQty } from './inventoryRules';
import {
  countMissingSpecialNeed,
  itemCreditPrice,
} from './aiKioskSpecialItemsRuntime';

export function pickKioskExchangeAction({
  specialItems = {},
  inv = [],
  miss = [],
  up = null,
  mr = {},
  tacUpgradeMode = 'level',
  tacIsLvMax = false,
  tacSkillLv = 1,
  tacMaxLevel = 2,
} = {}) {
  const {
    meteorItem,
    lifeTreeItem,
    mithrilItem,
    forceCoreItem,
    tacModuleItem,
  } = specialItems;
  const has = (item, qty = 1) => (
    item?._id
      ? invQty(inv, String(item._id)) >= Math.max(1, Number(qty || 1))
      : false
  );

  // 즉시 교환: 포코→미스릴, 미스릴→모듈, 모듈→크레딧(환급)
  // 관전 템포를 위해 교환은 확률로 과도한 반복을 줄입니다.
  const forceCoreHave = forceCoreItem?._id ? invQty(inv, String(forceCoreItem._id)) : 0;
  const mithrilHave = mithrilItem?._id ? invQty(inv, String(mithrilItem._id)) : 0;
  const needForceCount = countMissingSpecialNeed(miss, 'force_core');
  const needMithrilCount = countMissingSpecialNeed(miss, 'mithril');
  const preserveNeededSpecials = mr?.exchange?.preserveNeededSpecials !== false;
  const spareForceNeed = Math.max(0, Number(mr?.exchange?.spareForceCoreToMithril ?? 1));
  const spareMithrilNeed = Math.max(0, Number(mr?.exchange?.spareMithrilToTacModule ?? 2));

  const canExchangeForceCore = forceCoreItem && mithrilItem && has(forceCoreItem, 1)
    && (!preserveNeededSpecials || (!up?.wantLegend && !up?.wantTrans) || (forceCoreHave - needForceCount) >= spareForceNeed);
  if (canExchangeForceCore && Math.random() < 0.42) {
    return { kind: 'exchange', item: mithrilItem, itemId: String(mithrilItem._id), qty: 1, consume: [{ itemId: String(forceCoreItem._id), qty: 1 }], label: '포스 코어→미스릴' };
  }

  // (level 모드) 전술 스킬 레벨이 MAX면 미스릴→모듈 교환을 중단(낭비 방지)
  const canExchangeMithril = mithrilItem && tacModuleItem && !tacIsLvMax && has(mithrilItem, 1)
    && (!preserveNeededSpecials || (!up?.wantLegend && !up?.wantTrans) || (mithrilHave - needMithrilCount) >= spareMithrilNeed);
  if (canExchangeMithril && Math.random() < 0.38) {
    return { kind: 'exchange', item: tacModuleItem, itemId: String(tacModuleItem._id), qty: 1, consume: [{ itemId: String(mithrilItem._id), qty: 1 }], label: '미스릴→전술 강화 모듈' };
  }

  // 전술 강화 모듈: (level 모드) 전술 스킬 레벨업 재료 / (stack 모드) 보유 스택 기반 강화
  const tacModuleHave = tacModuleItem?._id ? invQty(inv, String(tacModuleItem._id)) : 0;
  if (tacUpgradeMode !== 'level') {
    if (tacModuleItem && tacModuleHave >= 2 && Math.random() < 0.55) {
      const gain = itemCreditPrice(tacModuleItem, 100);
      return { kind: 'sell', item: tacModuleItem, itemId: String(tacModuleItem._id), qty: 1, credits: gain, label: '전술 강화 모듈 환급' };
    }
  } else if (tacModuleItem && tacSkillLv >= tacMaxLevel && tacModuleHave >= 1 && Math.random() < 0.25) {
    const gain = itemCreditPrice(tacModuleItem, 100);
    return { kind: 'sell', item: tacModuleItem, itemId: String(tacModuleItem._id), qty: 1, credits: gain, label: '전술 강화 모듈 환급(레벨MAX)' };
  }

  // 목표 기반 상호 교환: 운석↔생나
  const missingRows = Array.isArray(miss) ? miss : [];
  const needMeteor = missingRows.some((row) => row?.special === 'meteor' || classifySpecialByName(row?.name) === 'meteor');
  const needTree = missingRows.some((row) => row?.special === 'life_tree' || classifySpecialByName(row?.name) === 'life_tree');
  if (meteorItem && lifeTreeItem) {
    if (needTree && has(meteorItem, 1) && Math.random() < 0.75) {
      return { kind: 'exchange', item: lifeTreeItem, itemId: String(lifeTreeItem._id), qty: 1, consume: [{ itemId: String(meteorItem._id), qty: 1 }], label: '운석→생명의 나무' };
    }
    if (needMeteor && has(lifeTreeItem, 1) && Math.random() < 0.75) {
      return { kind: 'exchange', item: meteorItem, itemId: String(meteorItem._id), qty: 1, consume: [{ itemId: String(lifeTreeItem._id), qty: 1 }], label: '생명의 나무→운석' };
    }
  }

  return null;
}
