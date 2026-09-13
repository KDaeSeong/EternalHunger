import { getCombatSpaceId, WORLD_COMBAT_SPACE } from '../../../utils/combatSpaceLogic.js';
import { isDimensionRiftDefeated } from '../../../utils/dimensionRiftDefeatLogic.js';

export function getCombatSpacePresentation(actor) {
  const id = getCombatSpaceId(actor);
  if (id === WORLD_COMBAT_SPACE) return null;
  if (isDimensionRiftDefeated(actor)) return { id, label: '🌀 전투 불능 · 복귀 대기',
    title: '틈 내부 패배이며 경기 사망이 아닙니다. 추가 행동 없이 입구 복귀를 기다립니다.' };
  return { id, label: id.startsWith('dimension_rift:') ? '🌀 차원의 틈 내부' : '별도 전장',
    title: '바깥 실험체와 공격·지원 스킬·공유 시야가 분리된 전장입니다.' };
}
