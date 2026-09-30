import { normalizeHungerEvent } from './hungerGameContract.js';

const role = (key = 'actor', options = {}) => ({ key, label: ({ actor: '참가자', attacker: '공격자', victim: '피해자', rescuer: '구조자', partner: '상대' })[key] || key, ...options });
const effect = (type, target = 'actor', extras = {}) => ({ type, target, ...extras });
const outcome = (label, text, effects = [], weight = 1, when = null) => ({ label, text, effects, weight, when });
const event = (id, title, outcomes, extras = {}) => normalizeHungerEvent({ id, title, roles: [role()], outcomes, ...extras });
const condition = (cause, protection) => ({ role: 'actor', cause, protection });
function hazard(id, title, cause, immuneText, hurtText, deathText, extras = {}) {
  return event(id, title, [
    outcome('면역', immuneText, [], 1, condition(cause, 'immune')),
    outcome('저항 후 부상', hurtText, [effect('injure', 'actor', { cause })], 1, condition(cause, 'resistant')),
    outcome('저항 후 회피', '{actor}은 위험을 견디고 안전한 곳으로 피한다.', [], 1, condition(cause, 'resistant')),
    outcome('부상', hurtText, [effect('injure', 'actor', { cause })], 3, condition(cause, 'normal')),
    outcome('회피', '{actor}은 가까스로 위험을 피한다.', [], 3, condition(cause, 'normal')),
    outcome('사망', deathText, [effect('death', 'actor', { cause })], 1, condition(cause, 'normal')),
  ], extras);
}

export const DEFAULT_HUNGER_EVENTS = [
  event('opening-run', '시작 신호', [outcome('도주', '{actor}은 시작 신호와 함께 숲으로 달려간다.')], { phases: ['opening'], weight: 3 }),
  event('opening-knife', '무기 확보', [outcome('칼 획득', '{actor}은 보급품 더미에서 칼을 챙긴다.', [effect('gain_item', 'actor', { item: '칼' })])], { phases: ['opening', 'feast'], weight: 4 }),
  event('opening-food', '식량 확보', [outcome('식량 획득', '{actor}은 보급품에서 식량을 챙긴다.', [effect('gain_item', 'actor', { item: '식량' })])], { roles: [role('actor', { noneTraits: ['mechanical'] })], phases: ['opening', 'feast'], weight: 3 }),
  event('forest-food', '숲의 식량', [outcome('채집', '{actor}은 먹을 수 있는 열매를 모아 식량을 확보한다.', [effect('gain_item', 'actor', { item: '식량' })])], { roles: [role('actor', { noneTraits: ['mechanical'] })], phases: ['day'], locations: ['forest'], weight: 3 }),
  event('meal', '짧은 식사', [outcome('식사', '{actor}은 챙겨 둔 식량을 먹으며 다음 이동을 준비한다.', [effect('lose_item', 'actor', { item: '식량' })])], { roles: [role('actor', { requiredItem: '식량', noneTraits: ['mechanical'] })], phases: ['day', 'night'], weight: 2 }),
  event('rest-heal', '상처 돌보기', [outcome('회복', '{actor}은 충분히 쉬며 부상에서 회복한다.', [effect('heal')])], { roles: [role('actor', { status: 'injured' })], phases: ['night'], weight: 3 }),
  event('quiet-night', '밤의 생각', [outcome('휴식', '{actor}은 밤하늘을 바라보며 집을 떠올린다.')], { phases: ['night'], weight: 3 }),
  event('tracks', '누군가의 흔적', [outcome('경계', '{actor}은 낯선 발자국을 발견하고 이동 방향을 바꾼다.')], { phases: ['day'], weight: 2 }),
  event('flight-scout', '공중 정찰', [outcome('정찰', '{actor}은 하늘에서 주변을 정찰하고 다른 참가자들의 위치를 살핀다.')], { roles: [role('actor', { allTraits: ['flight'] })], phases: ['day'] }),
  event('survival-trail', '생존가의 길찾기', [outcome('길찾기', '{actor}은 숲의 흔적을 읽어 안전한 길을 찾아낸다.')], { roles: [role('actor', { allTraits: ['survivalist'] })], phases: ['day'], locations: ['forest'] }),
  event('robot-repair', '자가 정비', [outcome('정비', '{actor}은 손상된 신체 부품을 수리한다.', [effect('heal')])], { roles: [role('actor', { allTraits: ['mechanical'], status: 'injured' })], phases: ['day', 'night'], weight: 3 }),
  hazard('lightning', '갑작스러운 낙뢰', 'lightning', '{actor}은 쏟아지는 번개를 맞고도 태연하게 걸음을 옮긴다.', '{actor}은 낙뢰를 견뎌 냈지만 부상을 입는다.', '{actor}은 낙뢰를 맞고 목숨을 잃는다.', { weather: ['storm'], phases: ['day', 'night'], cooldownPhases: 1 }),
  hazard('river-current', '거센 물살', 'drowning', '{actor}은 물속에서도 편안하게 숨을 쉬며 강을 건넌다.', '{actor}은 거센 물살에서 빠져나왔지만 부상을 입는다.', '{actor}은 거센 물살에 휩쓸려 익사한다.', { locations: ['river'], phases: ['day', 'night'] }),
  hazard('camp-fire', '번지는 화재', 'fire', '{actor}은 불길 속에서도 상처 하나 없이 빠져나온다.', '{actor}은 불길을 벗어났지만 화상을 입는다.', '{actor}은 번지는 불길에서 벗어나지 못하고 목숨을 잃는다.', { locations: ['camp', 'ruins'], phases: ['night'], cooldownPhases: 1 }),
  hazard('cold-night', '얼어붙는 밤', 'cold', '{actor}은 매서운 추위에도 아무렇지 않게 밤을 보낸다.', '{actor}은 추위에서 살아남았지만 몸을 다친다.', '{actor}은 추위를 이기지 못하고 목숨을 잃는다.', { weather: ['cold'], phases: ['night'] }),
  hazard('poison-berries', '독이 든 열매', 'poison', '{actor}은 독이 든 열매를 먹었지만 독의 영향을 받지 않는다.', '{actor}은 독이 든 열매를 먹고 쓰러졌다가 부상을 입은 채 깨어난다.', '{actor}은 독이 든 열매를 먹고 목숨을 잃는다.', { roles: [role('actor', { noneTraits: ['mechanical'] })], locations: ['forest'], phases: ['day'] }),
  event('alliance', '뜻밖의 동맹', [outcome('동맹', '{actor}과 {partner}은 함께 살아남기로 약속한다.', [effect('ally', 'actor', { other: 'partner' })])], { roles: [role(), role('partner')], phases: ['day', 'night'], weight: 2, cooldownPhases: 1 }),
  event('medical-help', '응급 처치', [outcome('구조', '{rescuer}은 {victim}의 상처를 치료해 준다.', [effect('heal', 'victim'), effect('ally', 'rescuer', { other: 'victim' })])], { roles: [role('rescuer', { allTraits: ['medic'] }), role('victim', { status: 'injured' })], phases: ['day', 'night'], weight: 3 }),
  event('food-share', '식량 나누기', [outcome('나눔', '{actor}은 자신이 챙긴 식량을 {partner}에게 건넨다.', [effect('lose_item', 'actor', { item: '식량' }), effect('gain_item', 'partner', { item: '식량' }), effect('ally', 'actor', { other: 'partner' })])], { roles: [role('actor', { requiredItem: '식량' }), role('partner')], phases: ['day', 'night'] }),
  event('knife-encounter', '무장한 조우', [
    outcome('공격자 승리', '{attacker}은 칼로 {victim}을 공격해 목숨을 빼앗는다.', [effect('death', 'victim', { cause: 'combat', source: 'attacker' }), effect('enemy', 'attacker', { other: 'victim' })], 2),
    outcome('반격', '{victim}은 {attacker}의 공격을 되받아쳐 쓰러뜨린다.', [effect('death', 'attacker', { cause: 'combat', source: 'victim' })], 1),
    outcome('퇴각', '{attacker}과 {victim}은 서로를 경계하며 물러난다.', [effect('enemy', 'attacker', { other: 'victim' })], 3),
  ], { roles: [role('attacker', { requiredItem: '칼' }), role('victim')], relations: [{ left: 'attacker', right: 'victim', kind: 'not_teammate' }], weight: 4 }),
  event('betrayal', '동맹의 배신', [
    outcome('배신', '{attacker}은 방심한 동맹 {victim}을 기습해 쓰러뜨린다.', [effect('death', 'victim', { cause: 'combat', source: 'attacker' }), effect('enemy', 'attacker', { other: 'victim' })]),
    outcome('눈치챔', '{victim}은 {attacker}의 기습을 눈치채고 달아난다.', [effect('enemy', 'attacker', { other: 'victim' })], 2),
  ], { roles: [role('attacker'), role('victim')], relations: [{ left: 'attacker', right: 'victim', kind: 'ally' }, { left: 'attacker', right: 'victim', kind: 'not_teammate' }], minDay: 2, phases: ['day', 'night'], weight: 2 }),
  event('unarmed-fight', '팽팽한 대치', [
    outcome('사투', '{attacker}은 {victim}과 사투를 벌인 끝에 살아남는다.', [effect('death', 'victim', { cause: 'combat', source: 'attacker' })]),
    outcome('물러남', '{attacker}과 {victim}은 싸움을 피하고 각자의 길로 향한다.', [], 3),
  ], { roles: [role('attacker'), role('victim')], relations: [{ left: 'attacker', right: 'victim', kind: 'not_teammate' }], minDay: 1, phases: ['day', 'night', 'feast'], weight: 3 }),
];

export function createHungerDraft(id) {
  return event(id, '새 이벤트', [outcome('기본 결과', '{actor}은 주변을 살핀다.')], { phases: ['day', 'night'] });
}

export function defaultHungerConfig() {
  return { seed: 'hunger-2026', maxPhases: 60, events: structuredClone(DEFAULT_HUNGER_EVENTS), roster: [
    { id: 'demo-raiden', name: '라이덴 쇼군', hungerTraits: ['lightning_control', 'lightning_immune'] },
    { id: 'demo-flame', name: '불꽃 정령', hungerTraits: ['fire_immune'] },
    { id: 'demo-diver', name: '수중 탐험가', hungerTraits: ['underwater_breathing'] },
    { id: 'demo-scout', name: '날개 달린 정찰병', hungerTraits: ['flight'] },
    { id: 'demo-medic', name: '야전 의사', hungerTraits: ['medic'] },
    { id: 'demo-robot', name: '기계 경비병', hungerTraits: ['mechanical', 'poison_immune'] },
    { id: 'demo-survivor', name: '숲의 생존가', hungerTraits: ['survivalist'] },
    { id: 'demo-rookie', name: '신입 참가자', hungerTraits: [] },
  ].map((actor) => ({ ...actor, teamId: '', previewImage: '', items: [] })) };
}
