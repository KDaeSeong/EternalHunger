import { normalizeHungerConfig, normalizeHungerEvent } from './hungerGameContract.js';
import { LEGACY_HUNGER_EVENTS, legacyHungerConfig } from './hungerGameLegacyPresets.js';
import { STORY_HUNGER_EVENTS } from './hungerGameStoryPresets.js';

const role = (key = 'actor', options = {}) => ({ key, label: ({ actor: '참가자', attacker: '공격자', victim: '피해자', rescuer: '구조자', partner: '상대' })[key] || key, ...options });
const effect = (type, target = 'actor', extras = {}) => ({ type, target, ...extras });
const outcome = (label, text, effects = [], weight = 1, when = null, requirements = []) => ({ label, text, effects, weight, when, requirements });
const event = (id, title, outcomes, extras = {}) => normalizeHungerEvent({ id, title, roles: [role()], outcomes, ...extras });
const condition = (cause, protection, target = 'actor') => ({ role: target, cause, protection });
const living = { noneTraits: ['mechanical', 'elemental_body'] };
const physicalAttacker = { noneTraits: ['lightning_control', 'fire_control', 'elemental_body'] };
const combatRelations = [{ left: 'attacker', right: 'victim', kind: 'not_teammate' }, { left: 'attacker', right: 'victim', kind: 'not_ally' }];
function bodyRequirement(target, body) {
  return { role: target, ...(body === 'living' ? living : body === 'mechanical' ? { allTraits: ['mechanical'] } : { allTraits: ['elemental_body'], noneTraits: ['mechanical'] }) };
}
function hazard(id, title, cause, immuneText, hurtText, deathText, extras = {}) {
  const injuries = { living: hurtText, mechanical: '{actor}은 위험에서 벗어나지만 신체 부품이 손상된다.', elemental: '{actor}은 위험을 견디지만 몸을 이루는 기운이 불안정해진다.' };
  const deaths = { living: deathText, mechanical: '{actor}은 위험에 휘말려 핵심 장치가 망가지고 작동을 멈춘다.', elemental: '{actor}은 위험에 휘말려 몸을 이루던 기운이 흩어지고 소멸한다.' };
  return event(id, title, [
    outcome('면역', immuneText, [], 1, condition(cause, 'immune')),
    ...Object.keys(injuries).map((body) => outcome('저항 후 손상', injuries[body], [effect('injure', 'actor', { cause })], 1, condition(cause, 'resistant'), [bodyRequirement('actor', body)])),
    outcome('저항 후 회피', '{actor}은 위험을 견디고 안전한 곳으로 피한다.', [], 1, condition(cause, 'resistant')),
    ...Object.keys(injuries).map((body) => outcome('손상', injuries[body], [effect('injure', 'actor', { cause })], 3, condition(cause, 'normal'), [bodyRequirement('actor', body)])),
    outcome('회피', '{actor}은 가까스로 위험을 피한다.', [], 3, condition(cause, 'normal')),
    ...Object.keys(deaths).map((body) => outcome('사망', deaths[body], [effect('death', 'actor', { cause })], 1, condition(cause, 'normal'), [bodyRequirement('actor', body)])),
  ], extras);
}
function counterattacks() {
  return [
    outcome('번개 반격', '{victim}은 공격의 틈을 노려 번개로 {attacker}을 쓰러뜨린다.', [effect('death', 'attacker', { cause: 'lightning_attack', source: 'victim' })], 1, null, [{ role: 'victim', allTraits: ['lightning_control'] }]),
    outcome('불꽃 반격', '{victim}은 불길을 뿜어 {attacker}의 공격을 끊고 쓰러뜨린다.', [effect('death', 'attacker', { cause: 'fire_attack', source: 'victim' })], 1, null, [{ role: 'victim', allTraits: ['fire_control'] }]),
    outcome('근접 반격', '{victim}은 공격을 되받아쳐 {attacker}을 쓰러뜨린다.', [effect('death', 'attacker', { cause: 'physical', source: 'victim' })], 1, null, [{ role: 'victim', ...physicalAttacker }]),
  ];
}
function injuries(cause, attackText) {
  const texts = {
    living: '{attacker}은 ' + attackText + ' {victim}에게 부상을 입힌다.',
    mechanical: '{attacker}은 ' + attackText + ' {victim}의 신체 부품을 손상시킨다.',
    elemental: '{attacker}은 ' + attackText + ' {victim}의 형태를 불안정하게 만든다.',
  };
  return Object.entries(texts).map(([body, text]) => outcome('손상', text, [effect('injure', 'victim', { cause, source: 'attacker' })], 2, null, [bodyRequirement('victim', body)]));
}
function powerAttack(id, title, trait, cause, attackText) {
  return event(id, title, [
    outcome('면역', '{attacker}의 공격은 {victim}에게 통하지 않는다.', [], 1, condition(cause, 'immune', 'victim')),
    outcome('결정타', '{attacker}은 ' + attackText + ' {victim}을 쓰러뜨린다.', [effect('death', 'victim', { cause, source: 'attacker' })], 1),
    ...injuries(cause, attackText),
    outcome('회피', '{victim}은 {attacker}의 공격을 피하고 거리를 벌린다.', [], 3),
    outcome('비행 회피', '{victim}은 하늘로 날아올라 {attacker}의 공격 범위를 벗어난다.', [], 2, null, [{ role: 'victim', allTraits: ['flight'] }]),
    ...counterattacks(),
  ], { roles: [role('attacker', { allTraits: [trait] }), role('victim')], relations: combatRelations, phases: ['day', 'night', 'feast'], minDay: 1, weight: 3.5, cooldownPhases: 1 });
}
function melee(id, title, attackText, extras = {}) {
  return event(id, title, [
    outcome('물리 면역', '{attacker}의 공격은 {victim}의 신체에 아무런 피해를 주지 못한다.', [], 1, condition('physical', 'immune', 'victim')),
    outcome('결정타', '{attacker}은 ' + attackText + ' {victim}을 쓰러뜨린다.', [effect('death', 'victim', { cause: 'physical', source: 'attacker' })], 1),
    ...injuries('physical', attackText),
    ...counterattacks(),
    outcome('비행 회피', '{victim}은 날아올라 {attacker}의 공격을 피한다.', [], 2, null, [{ role: 'victim', allTraits: ['flight'] }]),
    outcome('퇴각', '{attacker}과 {victim}은 서로를 경계하며 물러난다.', [effect('enemy', 'attacker', { other: 'victim' })], 3),
  ], { roles: [role('attacker', physicalAttacker), role('victim')], relations: combatRelations, phases: ['day', 'night', 'feast'], minDay: 1, weight: 1.5, ...extras });
}
function finalDuel(base, id, title) {
  return normalizeHungerEvent({ ...base, id, title, weight: 5, cooldownPhases: 0, minSurvivors: 2, maxSurvivors: 2, minDuelPhases: 2,
    relations: [{ left: 'attacker', right: 'victim', kind: 'not_teammate' }],
    outcomes: base.outcomes.map((row) => ({ ...row, text: '마지막 두 참가자가 승부를 겨룬다. ' + row.text,
      effects: [...row.effects.filter((effect) => effect.type !== 'enemy'), effect('enemy', 'attacker', { other: 'victim' })] })) });
}

export const PREVIOUS_HUNGER_EVENTS = [
  event('opening-run', '시작 신호', [outcome('도주', '{actor}은 시작 신호와 함께 숲으로 달려간다.')], { phases: ['opening'], weight: 3 }),
  event('opening-knife', '무기 확보', [outcome('칼 획득', '{actor}은 보급품 더미에서 칼을 챙긴다.', [effect('gain_item', 'actor', { item: '칼' })])], { roles: [role('actor', physicalAttacker)], phases: ['opening', 'feast'], weight: 4 }),
  event('opening-food', '식량 확보', [outcome('식량 획득', '{actor}은 보급품에서 식량을 챙긴다.', [effect('gain_item', 'actor', { item: '식량' })])], { roles: [role('actor', living)], phases: ['opening', 'feast'], weight: 3 }),
  event('opening-flight', '비행 탈출', [outcome('비행', '{actor}은 시작 신호와 함께 하늘로 날아올라 보급품 더미에서 벗어난다.')], { roles: [role('actor', { allTraits: ['flight'] })], phases: ['opening'], weight: 4 }),
  event('opening-lightning', '번개의 경고', [outcome('견제', '{actor}은 번개를 일으켜 접근을 견제하며 안전한 길을 확보한다.')], { roles: [role('actor', { allTraits: ['lightning_control'] })], phases: ['opening'], weight: 4 }),
  event('opening-fire', '불꽃의 경고', [outcome('견제', '{actor}은 불길을 펼쳐 다른 참가자들과 거리를 벌린다.')], { roles: [role('actor', { allTraits: ['fire_control'] })], phases: ['opening'], weight: 4 }),
  event('forest-food', '숲의 식량', [outcome('채집', '{actor}은 먹을 수 있는 열매를 모아 식량을 확보한다.', [effect('gain_item', 'actor', { item: '식량' })])], { roles: [role('actor', living)], phases: ['day'], locations: ['forest'], weight: 3 }),
  event('meal', '짧은 식사', [outcome('식사', '{actor}은 챙겨 둔 식량을 먹으며 다음 이동을 준비한다.', [effect('lose_item', 'actor', { item: '식량' })])], { roles: [role('actor', { ...living, requiredItem: '식량' })], phases: ['day', 'night'], weight: 2 }),
  event('rest-heal', '상처 돌보기', [outcome('회복', '{actor}은 충분히 쉬며 부상에서 회복한다.', [effect('heal')])], { roles: [role('actor', { ...living, status: 'injured' })], phases: ['night'], weight: 3 }),
  event('quiet-night', '밤의 생각', [outcome('휴식', '{actor}은 밤하늘을 바라보며 집을 떠올린다.')], { roles: [role('actor', living)], phases: ['night'], weight: 1.5, cooldownPhases: 1 }),
  event('tracks', '누군가의 흔적', [outcome('경계', '{actor}은 낯선 발자국을 발견하고 이동 방향을 바꾼다.')], { roles: [role('actor', living)], phases: ['day'], weight: 1.5, cooldownPhases: 1 }),
  event('flight-scout', '공중 정찰', [outcome('정찰', '{actor}은 하늘에서 주변을 정찰하고 다른 참가자들의 위치를 살핀다.')], { roles: [role('actor', { allTraits: ['flight'] })], phases: ['day'] }),
  event('survival-trail', '생존가의 길찾기', [outcome('길찾기', '{actor}은 숲의 흔적을 읽어 안전한 길을 찾아낸다.')], { roles: [role('actor', { allTraits: ['survivalist'] })], phases: ['day'], locations: ['forest'] }),
  event('robot-repair', '자가 정비', [outcome('정비', '{actor}은 손상된 신체 부품을 수리한다.', [effect('heal')])], { roles: [role('actor', { allTraits: ['mechanical'], status: 'injured' })], phases: ['day', 'night'], weight: 3 }),
  event('robot-scan', '감지 장치 점검', [outcome('탐색', '{actor}은 감지 장치를 가동해 주변의 움직임을 확인한다.')], { roles: [role('actor', { allTraits: ['mechanical'] })], phases: ['day'], weight: 2 }),
  event('robot-night', '야간 감시', [outcome('대기', '{actor}은 감시 장치를 켜 둔 채 절전 모드로 대기한다.')], { roles: [role('actor', { allTraits: ['mechanical'] })], phases: ['night'], weight: 2 }),
  event('spirit-flow', '기운의 흐름', [outcome('탐색', '{actor}은 주변의 기운을 살피며 자신의 형태를 가다듬는다.')], { roles: [role('actor', { allTraits: ['elemental_body'], noneTraits: ['mechanical'] })], phases: ['day'], weight: 2 }),
  event('spirit-night', '고요한 기운', [outcome('휴식', '{actor}은 몸을 이루는 기운을 안정시키며 밤을 보낸다.')], { roles: [role('actor', { allTraits: ['elemental_body'], noneTraits: ['mechanical'] })], phases: ['night'], weight: 2 }),
  event('spirit-recover', '형태 회복', [outcome('회복', '{actor}은 흐트러진 기운을 모아 본래의 형태를 되찾는다.', [effect('heal')])], { roles: [role('actor', { allTraits: ['elemental_body'], noneTraits: ['mechanical'], status: 'injured' })], phases: ['day', 'night'], weight: 3 }),
  hazard('lightning', '갑작스러운 낙뢰', 'lightning', '{actor}은 쏟아지는 번개를 맞고도 태연하게 걸음을 옮긴다.', '{actor}은 낙뢰를 견뎌 냈지만 부상을 입는다.', '{actor}은 낙뢰를 맞고 목숨을 잃는다.', { weather: ['storm'], phases: ['day', 'night'], cooldownPhases: 1 }),
  hazard('river-current', '거센 물살', 'drowning', '{actor}은 거센 물살에도 영향을 받지 않고 강을 건넌다.', '{actor}은 거센 물살에서 빠져나왔지만 부상을 입는다.', '{actor}은 거센 물살에 휩쓸려 익사한다.', { locations: ['river'], phases: ['day', 'night'] }),
  hazard('camp-fire', '번지는 화재', 'fire', '{actor}은 불길 속에서도 상처 하나 없이 빠져나온다.', '{actor}은 불길을 벗어났지만 화상을 입는다.', '{actor}은 번지는 불길에서 벗어나지 못하고 목숨을 잃는다.', { locations: ['camp', 'ruins'], phases: ['night'], cooldownPhases: 1 }),
  hazard('cold-night', '얼어붙는 밤', 'cold', '{actor}은 매서운 추위에도 아무렇지 않게 밤을 보낸다.', '{actor}은 추위에서 살아남았지만 몸을 다친다.', '{actor}은 추위를 이기지 못하고 목숨을 잃는다.', { weather: ['cold'], phases: ['night'] }),
  hazard('poison-berries', '독이 든 열매', 'poison', '{actor}은 독이 든 열매를 먹었지만 독의 영향을 받지 않는다.', '{actor}은 독이 든 열매를 먹고 쓰러졌다가 부상을 입은 채 깨어난다.', '{actor}은 독이 든 열매를 먹고 목숨을 잃는다.', { roles: [role('actor', living)], locations: ['forest'], phases: ['day'] }),
  event('alliance', '뜻밖의 동맹', [outcome('동맹', '{actor}과 {partner}은 함께 살아남기로 약속한다.', [effect('ally', 'actor', { other: 'partner' })])], { roles: [role(), role('partner')], relations: [{ left: 'actor', right: 'partner', kind: 'not_ally' }], phases: ['day', 'night'], weight: 2, cooldownPhases: 1 }),
  event('medical-help', '응급 처치', [outcome('구조', '{rescuer}은 {victim}의 상처를 치료해 준다.', [effect('heal', 'victim'), effect('ally', 'rescuer', { other: 'victim' })])], { roles: [role('rescuer', { allTraits: ['medic'] }), role('victim', { ...living, status: 'injured' })], phases: ['day', 'night'], weight: 3 }),
  event('food-share', '식량 나누기', [outcome('나눔', '{actor}은 자신이 챙긴 식량을 {partner}에게 건넨다.', [effect('lose_item', 'actor', { item: '식량' }), effect('gain_item', 'partner', { item: '식량' }), effect('ally', 'actor', { other: 'partner' })])], { roles: [role('actor', { requiredItem: '식량' }), role('partner', living)], phases: ['day', 'night'] }),
  melee('knife-encounter', '무장한 조우', '칼로 공격해', { roles: [role('attacker', { ...physicalAttacker, requiredItem: '칼' }), role('victim')], weight: 2 }),
  melee('unarmed-fight', '팽팽한 대치', '근접 싸움 끝에'),
  powerAttack('lightning-strike', '번개를 다루는 싸움', 'lightning_control', 'lightning_attack', '번개를 뿜어'),
  powerAttack('fire-strike', '불길을 다루는 싸움', 'fire_control', 'fire_attack', '불길을 펼쳐'),
  finalDuel(melee('final-melee-base', '결전', '마지막 근접 공격으로'), 'final-physical', '최종 결전 · 근접'),
  finalDuel(powerAttack('final-lightning-base', '결전', 'lightning_control', 'lightning_attack', '마지막 번개 공격으로'), 'final-lightning', '최종 결전 · 번개'),
  finalDuel(powerAttack('final-fire-base', '결전', 'fire_control', 'fire_attack', '마지막 불꽃 공격으로'), 'final-fire', '최종 결전 · 불꽃'),
  event('betrayal', '동맹의 배신', [
    outcome('근접 배신', '{attacker}은 방심한 동맹 {victim}을 기습해 쓰러뜨린다.', [effect('death', 'victim', { cause: 'physical', source: 'attacker' }), effect('enemy', 'attacker', { other: 'victim' })], 1, null, [{ role: 'attacker', ...physicalAttacker }]),
    outcome('번개 배신', '{attacker}은 동맹의 빈틈을 노려 번개로 {victim}을 쓰러뜨린다.', [effect('death', 'victim', { cause: 'lightning_attack', source: 'attacker' }), effect('enemy', 'attacker', { other: 'victim' })], 1, null, [{ role: 'attacker', allTraits: ['lightning_control'] }]),
    outcome('불꽃 배신', '{attacker}은 방심한 동맹 {victim}에게 불길을 뿜어 쓰러뜨린다.', [effect('death', 'victim', { cause: 'fire_attack', source: 'attacker' }), effect('enemy', 'attacker', { other: 'victim' })], 1, null, [{ role: 'attacker', allTraits: ['fire_control'] }]),
    outcome('눈치챔', '{victim}은 {attacker}의 기습을 눈치채고 달아난다.', [effect('enemy', 'attacker', { other: 'victim' })], 3),
  ], { roles: [role('attacker'), role('victim')], relations: [{ left: 'attacker', right: 'victim', kind: 'ally' }, { left: 'attacker', right: 'victim', kind: 'not_teammate' }], minDay: 2, phases: ['day', 'night'], weight: 1.5 }),
  event('flight-escape', '추격을 벗어난 날개', [outcome('도주', '{victim}은 하늘로 날아올라 {attacker}의 추격을 따돌린다.')], { roles: [role('attacker'), role('victim', { allTraits: ['flight'] })], relations: combatRelations, phases: ['day', 'night'], minDay: 1, weight: 2 }),
  event('survival-hide', '생존가의 은신', [outcome('은신', '{actor}은 지형을 이용해 흔적을 감추고 안전한 곳에 몸을 숨긴다.')], { roles: [role('actor', { allTraits: ['survivalist'] })], phases: ['day', 'night'], locations: ['forest', 'ruins'], weight: 2 }),
  event('quiet-day', '한숨 돌리기', [outcome('휴식', '{actor}은 그늘에서 잠시 쉬며 다음 이동을 계획한다.')], { roles: [role('actor', living)], phases: ['day'], weight: 1.5 }),
  event('rain-shelter', '비를 피하는 자리', [outcome('피신', '{actor}은 비를 피할 자리를 찾아 주변을 경계한다.')], { weather: ['rain', 'storm'], phases: ['day', 'night'], weight: 2 }),
  event('find-water', '마실 물 찾기', [outcome('휴식', '{actor}은 깨끗한 물을 찾아 갈증을 달랜다.')], { roles: [role('actor', living)], phases: ['day'], locations: ['forest', 'river'], weight: 2 }),
  event('hide-ruins', '폐허의 은신처', [outcome('은신', '{actor}은 무너진 벽 뒤에 몸을 숨기고 주변이 조용해지기를 기다린다.')], { phases: ['day', 'night'], locations: ['ruins'], weight: 2 }),
  event('distant-noise', '멀리서 들리는 소리', [outcome('경계', '{actor}은 멀리서 들려오는 소리에 주의를 기울인다.')], { phases: ['day', 'night'], weight: 1.5, cooldownPhases: 1 }),
  event('scavenge-rope', '쓸 만한 보급품', [outcome('밧줄 획득', '{actor}은 버려진 보급품에서 쓸 만한 밧줄을 챙긴다.', [effect('gain_item', 'actor', { item: '밧줄' })])], { roles: [role('actor', { noneTraits: ['elemental_body'] })], phases: ['day', 'feast'], weight: 2 }),
];

export const DEFAULT_HUNGER_EVENTS = [...PREVIOUS_HUNGER_EVENTS, ...STORY_HUNGER_EVENTS];

export function createHungerDraft(id) {
  return event(id, '새 이벤트', [outcome('기본 결과', '{actor}은 주변을 살핀다.')], { phases: ['day', 'night'] });
}

export function defaultHungerConfig() {
  const legacy = legacyHungerConfig();
  const traits = {
    'demo-raiden': ['lightning_control', 'lightning_immune', 'lightning_attack_immune', 'combat_training'],
    'demo-flame': ['fire_control', 'fire_immune', 'fire_attack_immune', 'elemental_body', 'physical_immune'],
    'demo-robot': ['mechanical', 'poison_immune', 'physical_resistant'],
  };
  return { ...legacy, matchMode: 'solo', events: structuredClone(DEFAULT_HUNGER_EVENTS), roster: legacy.roster.map((actor) => ({ ...actor, hungerTraits: traits[actor.id] || actor.hungerTraits })) };
}

function upgradeSampleRoster(roster) {
  const before = normalizeHungerConfig(legacyHungerConfig()).roster;
  const after = normalizeHungerConfig(defaultHungerConfig()).roster;
  return roster.map((actor) => {
    const index = before.findIndex((sample) => JSON.stringify(sample) === JSON.stringify(actor));
    return index < 0 ? actor : after[index];
  });
}

export function upgradeUntouchedHungerPresets(config) {
  if (![LEGACY_HUNGER_EVENTS, PREVIOUS_HUNGER_EVENTS].some((events) => JSON.stringify(config.events) === JSON.stringify(events))) return { config, upgraded: false };
  return { config: normalizeHungerConfig({ ...config, events: DEFAULT_HUNGER_EVENTS, roster: upgradeSampleRoster(config.roster) }), upgraded: true };
}

export function refreshHungerPresets(config) {
  const ids = new Set(DEFAULT_HUNGER_EVENTS.map((row) => row.id));
  const events = [...DEFAULT_HUNGER_EVENTS, ...config.events.filter((row) => !ids.has(row.id))];
  return normalizeHungerConfig({ ...config, events, roster: upgradeSampleRoster(config.roster) });
}
