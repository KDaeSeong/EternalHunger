import { ITEMS } from './primitiveArchiveData';

const quantity = value => typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
const flag = value => typeof value === 'boolean' ? value : null;

// Presentation of already-computed summaries only. Ration units, food item
// quantities and hunger-reducing nutrition are intentionally separate fields.
export function primitiveArchiveFoodOutlook({ supplies, inventoryRows, ready = true,
  ended = false, annualMode = false } = {}) {
  if (!ready || ended || annualMode || !supplies || supplies.annualMode) return null;
  const hasInventory = Array.isArray(inventoryRows);
  const inventoryUnknown = hasInventory && inventoryRows.some(row => !Array.isArray(row) || row.length < 2
    || typeof row[0] !== 'string' || (ITEMS[row[0]]?.type === 'food' && quantity(row[1]) === null));
  const foodItems = hasInventory ? inventoryRows.flatMap(row => {
    if (!Array.isArray(row)) return [];
    const [id, rawQuantity] = row;
    const item = ITEMS[id];
    const count = quantity(rawQuantity);
    return item?.type === 'food' && count !== null && count > 0
      ? [{ id, name: item.name, quantity: count }] : [];
  }) : [];
  const next = Array.isArray(supplies.forecast?.days) ? supplies.forecast.days[0] : null;
  const morning = next && typeof next === 'object'
    ? Object.fromEntries(['day', 'stock', 'produced', 'available', 'need', 'provided', 'shortage', 'reserve']
      .map(key => [key, quantity(next[key])])) : null;
  return {
    current: {
      rationStock: quantity(supplies.rationStock), rationNeed: quantity(supplies.rationNeed),
      rationShortage: quantity(supplies.rationShortage),
      foodCount: hasInventory && !inventoryUnknown ? quantity(foodItems.reduce((sum, item) => sum + item.quantity, 0)) : null,
      foodItems,
    },
    party: { need: quantity(supplies.partyNeed), nutrition: quantity(supplies.partyNutrition), shortage: quantity(supplies.foodShortage) },
    care: { unlocked: flag(supplies.careUnlocked), active: flag(supplies.careActive),
      peopleFed: quantity(supplies.peopleFed), pendingMeals: quantity(supplies.pendingMeals) },
    morning,
    notes: {
      current: '오늘 저녁 관리 전의 현재 공동 식량 비축입니다.',
      units: '음식 개수·공동 배식 단위·대원의 허기를 줄이는 영양은 서로 다른 값입니다.',
      party: '저녁 관리 전 필요 영양과 현재 재고에서 공동 배식 몫을 제외한 음식 영양입니다.',
      care: '오늘 저녁 자동 관리의 예상 배식입니다. 현재 비축분만 사용합니다.',
      morning: '오늘 관리 후 재고에 내일 현재 배치의 생산을 더한 뒤 공동 배식을 계산한 전망입니다.',
      exclusions: '다음 대원 저녁 식사·사업 완성 보상·자동 재배치·인구 변화는 포함하지 않습니다.',
    },
  };
}
