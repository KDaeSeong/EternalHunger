import { normalizeHungerEvent } from './hungerGameContract.js';

const living = { noneTraits: ['mechanical', 'elemental_body'] };
const physicalAttacker = { noneTraits: ['lightning_control', 'fire_control', 'elemental_body'] };
const role = (key, label, extras = {}) => ({ key, label, ...extras });
const effect = (type, target, extras = {}) => ({ type, target, ...extras });
const relation = (left, right, kind) => ({ left, right, kind });
const outcome = (label, text, effects, requirements = [], weight = 1) => ({ label, text, effects, requirements, weight });
const event = (id, title, roles, outcomes, relations, extras = {}) => normalizeHungerEvent({
  id, title, roles, outcomes, relations, phases: ['day', 'night', 'feast'], minDay: 1, weight: 2,
  // Leave the final two survivors to the existing decisive encounter pool.
  minSurvivors: 3, maxUses: 3, cooldownPhases: 1, ...extras,
});
const giveFood = (from, to) => [effect('lose_item', from, { item: '식량' }), effect('gain_item', to, { item: '식량' })];

export const RELATIONSHIP_HUNGER_EVENTS = [
  event('ally-supply-support', '동맹에게 건넨 보급', [role('donor', '보급 제공자', { ...living, requiredItem: '식량' }),
    role('partner', '동맹', living)], [
    outcome('동맹의 보급 전달', '{donor}은 동맹 {partner}에게 챙겨 둔 식량을 건네고 함께 이동할 준비를 한다.', giveFood('donor', 'partner')),
    outcome('응급 처치와 보급', '{donor}은 다친 동맹 {partner}에게 식량을 건넨 뒤 상처를 돌본다. {partner}은 부상을 회복하고 함께 이동한다.',
      [...giveFood('donor', 'partner'), effect('heal', 'partner')],
      [{ role: 'donor', allTraits: ['medic'] }, { role: 'partner', status: 'injured' }]),
  ], [relation('donor', 'partner', 'ally')]),

  event('ally-supply-dispute', '동맹의 분배 갈등', [role('holder', '식량 보유자', { ...living, requiredItem: '식량' }),
    role('partner', '동맹', living)], [
    outcome('분배 거부와 결별', '{holder}은 식량을 나누자는 {partner}의 요구를 거부한다. 두 사람은 서로를 적으로 여기며 갈라선다.',
      [effect('enemy', 'holder', { other: 'partner' })]),
    outcome('식량을 빼앗긴 결별', '{partner}은 말다툼 끝에 동맹 {holder}을 밀쳐 다치게 하고 식량을 빼앗는다. 두 사람의 동맹은 적대로 바뀐다.',
      [...giveFood('holder', 'partner'), effect('injure', 'holder', { cause: 'physical', source: 'partner' }),
        effect('enemy', 'holder', { other: 'partner' })], [{ role: 'partner', ...physicalAttacker }, { role: 'holder', status: 'healthy' }]),
  ], [relation('holder', 'partner', 'ally'), relation('holder', 'partner', 'not_teammate')], { minDay: 2 }),

  event('enemy-reencounter', '적대자의 재대치', [role('attacker', '대치 참가자'), role('victim', '적대 상대')], [
    outcome('경계하며 후퇴', '{attacker}과 {victim}은 서로를 알아보고 거리를 둔다. 두 사람은 경계를 풀지 않은 채 다른 길로 물러난다.', []),
    outcome('충돌과 부상', '{attacker}은 적대하던 {victim}과 다시 충돌해 상처를 입힌다. 두 사람은 여전히 서로를 적으로 여긴다.',
      [effect('injure', 'victim', { cause: 'physical', source: 'attacker' })],
      [{ role: 'attacker', ...physicalAttacker }, { role: 'victim', ...living, status: 'healthy' }]),
    outcome('충돌과 기계 손상', '{attacker}은 적대하던 {victim}과 다시 충돌해 신체 부품을 손상시킨다. 두 사람의 적대는 계속된다.',
      [effect('injure', 'victim', { cause: 'physical', source: 'attacker' })],
      [{ role: 'attacker', ...physicalAttacker }, { role: 'victim', allTraits: ['mechanical'], status: 'healthy' }]),
    outcome('충돌과 형태 손상', '{attacker}은 적대하던 {victim}과 다시 충돌해 몸을 이루는 기운을 흐트러뜨린다. 두 사람의 적대는 계속된다.',
      [effect('injure', 'victim', { cause: 'physical', source: 'attacker' })],
      [{ role: 'attacker', ...physicalAttacker }, { role: 'victim', allTraits: ['elemental_body'], noneTraits: ['mechanical'], status: 'healthy' }]),
  ], [relation('attacker', 'victim', 'enemy'), relation('attacker', 'victim', 'not_teammate')], { minDay: 2 }),

  event('enemy-food-reconciliation', '식량을 건 화해', [role('donor', '화해 제안자', { ...living, requiredItem: '식량' }),
    role('partner', '적대 상대', living)], [
    outcome('식량 전달과 재동맹', '{donor}은 적대하던 {partner}에게 식량을 건네며 다시 힘을 합치자고 제안한다. {partner}은 식량을 받아 들고 동맹을 맺는다.',
      [...giveFood('donor', 'partner'), effect('ally', 'donor', { other: 'partner' })]),
  ], [relation('donor', 'partner', 'enemy')], { minDay: 2 }),
];
