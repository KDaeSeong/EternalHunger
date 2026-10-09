const actions = new Set(['kioskBuy', 'kioskExchange', 'kioskSell', 'droneOrder']);
const kinds = new Set(['recipe_material', 'target_item', 'route_material', 'sale', 'personal_order']);
const id = value => typeof value === 'string' ? value.trim() : '';

// A read-only description of the actual selected personal order. Team route
// reasons never identify this actor's recipe, item or intended recipient.
export function buildProcurementPurpose({ actorId, actionKey, actionType, itemId,
  itemName = '', targetId = '', targetName = '', recipeMissingIds = [], routeNeedIds = [] } = {}) {
  const who = id(actorId), key = id(actionKey), type = id(actionType), item = id(itemId);
  if (!who || !key || !item || !actions.has(type)) return null;
  const target = id(targetId);
  const missing = new Set(Array.isArray(recipeMissingIds) ? recipeMissingIds.map(id).filter(Boolean) : []);
  const route = new Set(Array.isArray(routeNeedIds) ? routeNeedIds.map(id).filter(Boolean) : []);
  const kind = type === 'kioskSell' ? 'sale' : target === item ? 'target_item'
    : target && missing.has(item) ? 'recipe_material' : route.has(item) ? 'route_material' : 'personal_order';
  return { version: 1, actorId: who, actionKey: key, actionType: type, itemId: item,
    itemName: id(itemName), kind,
    targetId: ['recipe_material', 'target_item'].includes(kind) ? target : '',
    targetName: ['recipe_material', 'target_item'].includes(kind) ? id(targetName) : '' };
}

// A saved queue must agree with its purpose on all four action identity keys.
// This validates the selected item's relation to current goals, not the
// candidate-selection cause, ownership, payment or successful crafting.
export function describeProcurementPurpose(event = {}) {
  const purpose = event.procurementPurpose;
  if (event.kind !== 'queue' || purpose?.version !== 1 || !actions.has(event.chosen)
    || !id(event.who) || !id(event.actionKey) || !id(event.itemId)
    || purpose.actorId !== event.who || purpose.actionKey !== event.actionKey
    || purpose.actionType !== event.chosen || purpose.itemId !== event.itemId
    || !kinds.has(purpose.kind)
    || (event.chosen === 'kioskSell') !== (purpose.kind === 'sale')) return '';
  const item = id(event.itemName) || id(purpose.itemName) || event.itemId;
  const target = id(purpose.targetName) || id(purpose.targetId);
  if (purpose.kind === 'recipe_material') return id(purpose.targetId) && purpose.targetId !== purpose.itemId
    ? `본인 목표 ${target}의 부족 재료 ${item} 조달` : '';
  if (purpose.kind === 'target_item') return purpose.targetId === purpose.itemId
    ? `본인 현재 목표 장비 ${target}과 같은 품목 선택` : '';
  if (purpose.kind === 'route_material') return `본인 파밍 경로의 필요한 품목 ${item} 조달`;
  if (purpose.kind === 'sale') return `크레딧 확보를 위한 본인 보유품 ${item} 판매`;
  return `개인 조달 품목 ${item} 선택 · 세부 목적 기록 없음`;
}

export function isProcurementAction(type) {
  return actions.has(type);
}
