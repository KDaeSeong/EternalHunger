import { TECHNOLOGY_TREE, CIVIC_TREE } from './primitiveArchiveData';
import rewardRules from './primitiveArchiveRewardRules.json' with { type: 'json' };

// This is a preview. Only the account's server receipt grants site currency.
export function archiveAccountRewardPreview(state) {
  const completed = TECHNOLOGY_TREE.filter((row) => state?.research?.completed?.[row.id] === true).length
    + CIVIC_TREE.filter((row) => state?.civics?.completed?.[row.id] === true).length;
  const total = TECHNOLOGY_TREE.length + CIVIC_TREE.length;
  const full = total > 0 && completed === total;
  const tools = state?.devTools;
  const excluded = Boolean(tools?.used || (tools?.enabled && (
    tools?.guaranteedSuccess || Object.values(tools?.actionBonuses || {}).some((value) => Number(value) !== 0)
  )));
  const tier = full ? 'full' : 'basic';
  return {
    completed, total, tier, excluded,
    lp: excluded ? 0 : rewardRules[tier].lp,
    credits: excluded ? 0 : rewardRules[tier].credits,
    basic: rewardRules.basic,
    full: rewardRules.full,
    dailyLimit: rewardRules.dailyLimit,
  };
}

export function archiveAccountRewardMessage(rewards) {
  if (!rewards || typeof rewards !== 'object') return '';
  const lp = Number(rewards.lp);
  const credits = Number(rewards.credits);
  const hasAmounts = Number.isSafeInteger(lp) && lp >= 0 && Number.isSafeInteger(credits) && credits >= 0;
  if (rewards.status === 'awarded' && hasAmounts && (lp > 0 || credits > 0)) {
    return `완주 보상 ${lp.toLocaleString('ko-KR')} LP · ${credits.toLocaleString('ko-KR')} 크레딧을 받았습니다.`;
  }
  if (rewards.status === 'already_awarded') return hasAmounts
    ? `이 런의 ${lp.toLocaleString('ko-KR')} LP · ${credits.toLocaleString('ko-KR')} 크레딧 보상은 이미 지급되었습니다. 중복 지급하지 않았습니다.`
    : '이 런의 LP·크레딧 보상은 이미 지급되었습니다. 중복 지급하지 않았습니다.';
  if (rewards.status === 'daily_limit') return '오늘의 계정 보상 한도에 도달했습니다. 기록은 보존되며 내일 같은 런을 다시 기록하면 보상을 받을 수 있습니다.';
  if (rewards.status === 'ineligible') return '이 기록은 LP·크레딧 완주 보상 대상이 아닙니다.';
  return '';
}
