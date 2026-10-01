import { normalizeHungerEvent } from './hungerGameContract.js';

const living = { noneTraits: ['mechanical', 'elemental_body'] };
const solid = { noneTraits: ['elemental_body'] };
const role = (key, options = {}) => ({ key, label: ({ actor: '참가자', partner: '동행자', victim: '피해자', rescuer: '구조자', attacker: '매복자' })[key], ...options });
const effect = (type, target, extras = {}) => ({ type, target, ...extras });
const outcome = (label, text, effects = [], weight = 1, requirements = [], when = null) => ({ label, text, effects, weight, requirements, when });
const event = (id, title, roles, outcomes, extras = {}) => normalizeHungerEvent({ id, title, roles, outcomes,
  phases: ['day', 'night', 'feast'], weight: 2, cooldownPhases: 1, ...extras });
const ally = (left, right) => effect('ally', left, { other: right });
const spendRope = (target = 'actor') => effect('lose_item', target, { item: '밧줄' });
const bodies = [
  { requirements: [{ role: 'actor', ...living }], injury: '상처를 입는다', death: '목숨을 잃는다' },
  { requirements: [{ role: 'actor', allTraits: ['mechanical'] }], injury: '신체 부품이 손상된다', death: '핵심 장치가 망가져 작동을 멈춘다' },
  { requirements: [{ role: 'actor', allTraits: ['elemental_body'], noneTraits: ['mechanical'] }], injury: '몸을 이루는 기운이 불안정해진다', death: '기운이 흩어져 소멸한다' },
];
function hazard(id, title, cause, description, extras) {
  return event(id, title, [role('actor')], [
    outcome('면역', '{actor}은 위험의 영향을 받지 않고 안전한 곳으로 이동한다.', [], 1, [], { role: 'actor', cause, protection: 'immune' }),
    outcome('회피', '{actor}은 위험을 알아차리고 가까스로 피한다.', [], 4),
    ...bodies.map((body) => outcome('손상', '{actor}은 ' + description + '에 휘말려 ' + body.injury + '.', [effect('injure', 'actor', { cause })], 3, body.requirements)),
    ...bodies.map((body) => outcome('탈락', '{actor}은 ' + description + '에 휘말려 ' + body.death + '.', [effect('death', 'actor', { cause })], 1, body.requirements)),
  ], extras);
}

export const STORY_HUNGER_EVENTS = [
  event('rope-climb', '밧줄로 넘은 벼랑', [role('actor', { ...solid, requiredItem: '밧줄' })], [
    outcome('안전한 이동', '{actor}은 챙겨 둔 밧줄로 벼랑을 넘어 위험한 길을 우회한다.'),
    outcome('밧줄을 남기고 탈출', '{actor}은 밧줄을 고정해 무너지는 길에서 벗어난 뒤 밧줄을 남겨 둔다.', [spendRope()]),
  ], { locations: ['forest', 'ruins'], weight: 4 }),
  event('rope-crossing', '셋이 함께 건넌 강', [role('actor', { ...solid, requiredItem: '밧줄' }), role('partner', solid), role('victim', solid)], [
    outcome('공동 탈출', '{actor}은 밧줄을 강 양편에 묶고, {partner}과 {victim}은 서로를 도우며 강을 건넌다.',
      [spendRope(), ally('actor', 'partner'), ally('partner', 'victim'), ally('actor', 'victim')]),
  ], { locations: ['river'], weight: 4, minSurvivors: 3 }),
  event('rope-rescue', '밧줄 구조', [role('rescuer', { ...solid, requiredItem: '밧줄' }), role('victim', solid)], [
    outcome('구조와 신뢰', '{rescuer}은 준비한 밧줄을 던져 위험한 곳에 고립된 {victim}을 끌어올린다.', [ally('rescuer', 'victim')]),
  ], { locations: ['river', 'ruins'], weight: 4 }),
  event('rope-ambush', '매복과 경고', [role('attacker', { requiredItem: '밧줄', noneTraits: ['lightning_control', 'fire_control', 'elemental_body'] }), role('victim'), role('rescuer', solid)], [
    outcome('경고를 듣고 회피', '{rescuer}은 밧줄 함정을 발견하고 {victim}에게 경고한다. {attacker}의 매복은 실패한다.',
      [spendRope('attacker'), ally('rescuer', 'victim'), effect('enemy', 'attacker', { other: 'victim' })], 4),
    outcome('함정 부상', '{victim}은 {attacker}의 밧줄 함정에 걸려 다친다. {rescuer}은 함정을 끊고 {victim}을 돕는다.',
      [spendRope('attacker'), effect('injure', 'victim', { cause: 'physical', source: 'attacker' }), ally('rescuer', 'victim')], 2, [{ role: 'victim', ...living }]),
    outcome('기계 손상', '{victim}은 {attacker}의 밧줄 함정에 걸려 신체 부품이 손상된다. {rescuer}은 함정을 끊어 준다.',
      [spendRope('attacker'), effect('injure', 'victim', { cause: 'physical', source: 'attacker' })], 2, [{ role: 'victim', allTraits: ['mechanical'] }]),
  ], { minSurvivors: 3, relations: [{ left: 'attacker', right: 'victim', kind: 'not_teammate' }, { left: 'attacker', right: 'rescuer', kind: 'not_teammate' },
    { left: 'attacker', right: 'victim', kind: 'not_ally' }, { left: 'attacker', right: 'rescuer', kind: 'not_ally' }], locations: ['forest', 'ruins'] }),
  event('knife-cache', '칼로 연 보급 상자', [role('actor', { ...living, requiredItem: '칼' })], [
    outcome('식량 확보', '{actor}은 챙겨 둔 칼로 봉인된 보급 상자를 열고 식량을 가져간다.', [effect('gain_item', 'actor', { item: '식량' })]),
  ], { phases: ['day', 'feast'], locations: ['camp', 'ruins'] }),
  event('three-watch', '교대로 지키는 야영지', [role('actor'), role('partner'), role('victim')], [
    outcome('새로운 동맹', '{actor}, {partner}, {victim}은 교대로 주변을 감시하며 함께 밤을 보내기로 한다.', [ally('actor', 'partner'), ally('partner', 'victim'), ally('actor', 'victim')]),
  ], { minSurvivors: 3, phases: ['night'], relations: [{ left: 'actor', right: 'partner', kind: 'not_ally' }], weight: 3 }),
  event('carried-to-medic', '동행자의 응급 구조', [role('rescuer', { allTraits: ['medic'] }), role('victim', { ...living, status: 'injured' }), role('partner', solid)], [
    outcome('부상 회복', '{partner}은 다친 {victim}을 {rescuer}에게 데려간다. {rescuer}은 상처를 치료하고 셋은 함께 이동한다.',
      [effect('heal', 'victim'), ally('rescuer', 'victim'), ally('partner', 'victim'), ally('rescuer', 'partner')]),
  ], { minSurvivors: 3, weight: 4 }),
  event('food-bargain', '식량을 건 협상', [role('actor', { ...living, requiredItem: '식량' }), role('partner', living), role('victim', living)], [
    outcome('나눔과 동행', '{actor}은 식량을 {partner}에게 나눠 주고, {victim}은 셋이 이동할 안전한 길을 살핀다.',
      [effect('lose_item', 'actor', { item: '식량' }), effect('gain_item', 'partner', { item: '식량' }), ally('actor', 'partner'), ally('actor', 'victim'), ally('partner', 'victim')]),
  ], { minSurvivors: 3 }),
  hazard('falling-ruins', '무너지는 폐허', 'accident', '무너지는 건물', { roles: [role('actor', { noneTraits: ['flight', 'elemental_body', 'physical_immune'] })], locations: ['ruins'], weight: 2.5 }),
  hazard('rising-river', '갑자기 불어난 강', 'drowning', '불어난 강물', { roles: [role('actor', { noneTraits: ['flight'] })], locations: ['river'], weather: ['rain', 'storm'], weight: 2.5 }),
  hazard('toxic-smoke', '폐허의 유독 연기', 'poison', '폐허에서 새어 나온 유독 연기', { locations: ['ruins'], weight: 2.5 }),
  event('rope-shelter', '밧줄로 세운 피난처', [role('actor', { ...living, requiredItem: '밧줄' }), role('partner', living)], [
    outcome('한파 대비', '{actor}은 밧줄로 피난처를 고정하고 {partner}과 함께 매서운 추위를 피한다.', [spendRope(), ally('actor', 'partner')]),
  ], { weather: ['cold'], phases: ['night'], weight: 4 }),
];
