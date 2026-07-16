import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  baSrpgFeedbackCue,
  baSrpgFeedbackPresentation,
  createBaSrpgFeedbackSnapshot,
} from '../src/app/games/ba-srpg/_lib/baSrpgFeedback.js';
import {
  COVER_MAX_HP,
  STUDENTS,
  TACTICAL_SKILLS,
  actorModifierValue,
  buyPropertyAction,
  coverDurabilityAt,
  createNewState,
  enactEdictAction,
  endTurnAction,
  executeSkillAction,
  getBattleForecast,
  normalizeState,
  rentPropertyAction,
  restAction,
  toggleLeasePropertyAction,
  upgradePropertyAction,
} from '../src/app/games/ba-srpg/_lib/baSrpgEngine.js';

const componentSource = await readFile(new URL('../src/app/games/ba-srpg/_components/BaSrpgBattleTab.js', import.meta.url), 'utf8');
const inventorySource = await readFile(new URL('../src/app/games/ba-srpg/_components/BaSrpgInventoryTab.js', import.meta.url), 'utf8');
const missionSource = await readFile(new URL('../src/app/games/ba-srpg/_components/BaSrpgMissionTab.js', import.meta.url), 'utf8');
const townSource = await readFile(new URL('../src/app/games/ba-srpg/_components/BaSrpgTownTab.js', import.meta.url), 'utf8');
const featureSource = await readFile(new URL('../src/app/games/ba-srpg/_components/BaSrpgFeatureTabs.js', import.meta.url), 'utf8');
const pageSource = await readFile(new URL('../src/app/games/ba-srpg/play/page.js', import.meta.url), 'utf8');
const iconSource = await readFile(new URL('../src/app/games/_components/GameActionIcon.js', import.meta.url), 'utf8');
const sfxSource = await readFile(new URL('../src/app/games/_lib/useGameSfx.js', import.meta.url), 'utf8');
const engineSource = await readFile(new URL('../src/app/games/ba-srpg/_lib/baSrpgEngine.js', import.meta.url), 'utf8');

function state(overrides = {}) {
  return {
    runId: 'run-a',
    battleWins: 0,
    battle: {
      missionId: 'm001',
      phase: 'player',
      turn: 1,
      lastResult: '',
      units: [{ id: 'ally-a', hp: 30 }, { id: 'ally-b', hp: 25 }],
      enemies: [{ id: 'enemy-a', hp: 20 }, { id: 'enemy-b', hp: 20 }],
      ...overrides.battle,
    },
    ...overrides,
  };
}

const base = createBaSrpgFeedbackSnapshot(state());
assert.equal(base.aliveAllies, 2, '생존 아군 수를 계산해야 합니다.');
assert.equal(base.aliveEnemies, 2, '생존 적 수를 계산해야 합니다.');
assert.equal(baSrpgFeedbackCue(null, base), '', '첫 렌더에서는 결과음을 재생하면 안 됩니다.');
assert.equal(baSrpgFeedbackCue(base, { ...base }), '', '선택만 바뀐 상태는 결과음을 재생하면 안 됩니다.');

assert.equal(
  baSrpgFeedbackCue(base, { ...base, missionId: 'm002' }),
  'deploy',
  '새 미션 출정은 배치 효과음을 사용해야 합니다.',
);
assert.equal(
  baSrpgFeedbackCue(base, { ...base, aliveEnemies: 1, lastResult: '노아 -> 드론 12 피해 격파' }),
  'elimination',
  '적 생존 수 감소는 격파 효과음을 사용해야 합니다.',
);
assert.equal(
  baSrpgFeedbackCue(base, { ...base, aliveAllies: 1, lastResult: '저격수 -> 유우카 20 피해' }),
  'unitDown',
  '아군 생존 수 감소는 전투불능 효과음을 사용해야 합니다.',
);
assert.equal(
  baSrpgFeedbackCue(base, { ...base, phase: 'cleared', aliveEnemies: 0, lastResult: '승리' }),
  'victory',
  '클리어는 격파음보다 승리음을 우선해야 합니다.',
);
assert.equal(
  baSrpgFeedbackCue(base, { ...base, phase: 'failed', aliveAllies: 0, lastResult: '패배' }),
  'defeat',
  '전멸은 전투불능음보다 패배음을 우선해야 합니다.',
);
assert.equal(
  baSrpgFeedbackCue(base, { ...base, lastResult: '미카 공격 빗나감' }),
  'attackMiss',
  '빗나감은 전용 효과음을 사용해야 합니다.',
);
assert.equal(
  baSrpgFeedbackCue(base, { ...base, lastResult: '호시노 보호막 +18' }),
  'guard',
  '보호막은 방어 효과음을 사용해야 합니다.',
);
assert.equal(
  baSrpgFeedbackCue(base, { ...base, lastResult: '세리나 HP +16' }),
  'consume',
  '회복은 회복 효과음을 사용해야 합니다.',
);
assert.equal(
  baSrpgFeedbackCue(base, { ...base, lastResult: '노아 -> 드론 12 피해' }),
  'combat',
  '피해 발생은 교전 효과음을 사용해야 합니다.',
);
assert.equal(
  baSrpgFeedbackCue(base, { ...base, lastResult: '호시노 오버워치. 오버워치 전개, 반응 사격 1회 대기' }),
  'overwatch',
  '오버워치 준비는 감시 태세 효과음을 사용해야 합니다.',
);
assert.equal(
  baSrpgFeedbackCue(base, { ...base, lastResult: '[오버워치] 호시노 반응 사격 → 강습병 HP 8 피해' }),
  'reactionShot',
  '오버워치 반응 사격은 준비음과 다른 사격 효과음을 사용해야 합니다.',
);
assert.equal(
  baSrpgFeedbackCue(base, { ...base, lastResult: '시로코 연막 전개. 연막 지대 전개' }),
  'smoke',
  '연막 전개는 전용 효과음을 사용해야 합니다.',
);
assert.equal(
  baSrpgFeedbackCue(base, { ...base, lastResult: '호시노 엄폐 파쇄탄 · 엄폐 6 피해 · 엄폐 파괴' }),
  'coverBreak',
  '엄폐 파괴는 전용 파쇄 효과음을 사용해야 합니다.',
);
assert.equal(
  baSrpgFeedbackCue(base, { ...base, lastResult: '유우카 사기 고양. 2명 명중 +10% 강화' }),
  'buff',
  '아군 강화는 전용 상승 효과음을 사용해야 합니다.',
);
assert.equal(
  baSrpgFeedbackCue(base, { ...base, lastResult: '노아 표식 · 회피 -10% 1명 적용' }),
  'debuff',
  '적 약화는 전용 하강 효과음을 사용해야 합니다.',
);
assert.equal(
  baSrpgFeedbackCue(base, { ...base, lastResult: '이오리 섬광 투척 · 기절 부여 2명' }),
  'statusApply',
  '상태 이상 부여는 전용 효과음을 사용해야 합니다.',
);
assert.equal(
  baSrpgFeedbackCue(base, { ...base, lastResult: '이오리 섬광 투척 · 기절 저항 1명' }),
  'statusResist',
  '상태 이상 저항은 부여음과 구분해야 합니다.',
);
assert.equal(
  baSrpgFeedbackCue(base, { ...base, lastResult: '히나 점사 · 2/2회 명중 · HP 14 피해' }),
  'burst',
  '점사는 두 발 리듬의 전용 효과음을 사용해야 합니다.',
);
assert.equal(
  baSrpgFeedbackCue(base, { ...base, turn: 2 }),
  'turn',
  '다른 사건이 없는 턴 증가는 턴 효과음을 사용해야 합니다.',
);
assert.equal(
  baSrpgFeedbackCue(base, { ...base, runId: 'run-b', phase: 'cleared' }),
  '',
  '새 런을 불러올 때 이전 런과 비교해 결과음을 내면 안 됩니다.',
);

const clearPresentation = baSrpgFeedbackPresentation({ ...base, phase: 'cleared', lastResult: '승리' });
assert.deepEqual(
  { action: clearPresentation.action, label: clearPresentation.label, tone: clearPresentation.tone },
  { action: 'victory', label: '임무 클리어', tone: 'success' },
  '클리어 신호는 승리 아이콘과 성공 톤을 사용해야 합니다.',
);
const missPresentation = baSrpgFeedbackPresentation({ ...base, lastResult: '미카 공격 빗나감' });
assert.equal(missPresentation.action, 'miss', '빗나감 신호는 전용 아이콘을 사용해야 합니다.');

function feedbackForLog(log) {
  return { ...base, latestLog: log };
}

const nonCombatSignals = [
  ['편성 변경: 시로코, 유우카', 'formation', 'formation'],
  ['여관에서 하루를 쉬었습니다. 학생 HP가 회복됐습니다. -50 Cr', 'rest', 'rest'],
  ['부동산 구매: 상가 키오스크 · -900 Cr', 'property-buy', 'propertyBuy'],
  ['부동산 임차: 여관 전용 객실 · 3일 · -180 Cr', 'property-rent', 'propertyRent'],
  ['상가 키오스크 임대를 시작했습니다. 하루 +40 Cr', 'property-lease', 'propertyLease'],
  ['상가 키오스크 업그레이드 Lv.1. 가격 안정화 (-260 Cr)', 'property-upgrade', 'propertyUpgrade'],
  ['월간 칙령 발령: 상업 장려령', 'edict', 'edict'],
  ['상점을 무료로 갱신했습니다.', 'refresh', 'shopRefresh'],
  ['제식 소총 구매. -320 Cr', 'shop', 'shop'],
  ['붕대 제작 완료. -30 Cr', 'craft', 'craftComplete'],
  ['장비 장착: 제식 소총', 'equip', 'equip'],
  ['주간 의뢰 완료. +200 Cr, 평판 +30', 'claim', 'claim'],
  ['부동산 구매 크레딧이 부족합니다.', 'warning', 'warning'],
];

nonCombatSignals.forEach(([log, action, cue]) => {
  const next = feedbackForLog(log);
  assert.equal(baSrpgFeedbackPresentation(next).action, action, `${log} 결과 아이콘이 필요합니다.`);
  assert.equal(baSrpgFeedbackCue(base, next), cue, `${log} 결과 효과음이 필요합니다.`);
});

const townBase = { ...createNewState({ runId: 'town-feedback' }), credit: 5000 };
const townBaseSnapshot = createBaSrpgFeedbackSnapshot(townBase);
const boughtProperty = buyPropertyAction(townBase, 'prop_shop_kiosk');
const boughtSnapshot = createBaSrpgFeedbackSnapshot(boughtProperty);
assert.equal(baSrpgFeedbackCue(townBaseSnapshot, boughtSnapshot), 'propertyBuy', '실제 시설 구매가 구매 효과음을 내야 합니다.');
assert.equal(baSrpgFeedbackPresentation(boughtSnapshot).action, 'property-buy', '실제 시설 구매가 구매 아이콘을 갱신해야 합니다.');

const rentedProperty = rentPropertyAction(townBase, 'prop_inn_room');
assert.equal(
  baSrpgFeedbackCue(townBaseSnapshot, createBaSrpgFeedbackSnapshot(rentedProperty)),
  'propertyRent',
  '실제 시설 임차가 열쇠 효과음을 내야 합니다.',
);
const leasedProperty = toggleLeasePropertyAction(boughtProperty, 'prop_shop_kiosk');
assert.equal(
  baSrpgFeedbackCue(boughtSnapshot, createBaSrpgFeedbackSnapshot(leasedProperty)),
  'propertyLease',
  '실제 시설 임대가 임대 수익 효과음을 내야 합니다.',
);
const upgradedProperty = upgradePropertyAction(boughtProperty, 'prop_shop_kiosk');
assert.equal(
  baSrpgFeedbackCue(boughtSnapshot, createBaSrpgFeedbackSnapshot(upgradedProperty)),
  'propertyUpgrade',
  '실제 시설 강화가 건설 효과음을 내야 합니다.',
);
const enactedEdict = enactEdictAction(townBase, 'ed_shop_discount_5');
assert.equal(
  baSrpgFeedbackCue(townBaseSnapshot, createBaSrpgFeedbackSnapshot(enactedEdict)),
  'edict',
  '실제 칙령 발령이 칙령 효과음을 내야 합니다.',
);
const rested = restAction(townBase);
assert.equal(
  baSrpgFeedbackCue(townBaseSnapshot, createBaSrpgFeedbackSnapshot(rested)),
  'rest',
  '실제 여관 휴식이 회복 효과음을 내야 합니다.',
);

const clearedThenPurchased = baSrpgFeedbackPresentation({
  ...boughtSnapshot,
  phase: 'cleared',
  lastResult: '승리',
});
assert.equal(
  clearedThenPurchased.action,
  'property-buy',
  '클리어 뒤 도시 행동을 하면 고정 승리 결과 대신 최신 도시 결과를 보여야 합니다.',
);

const initialForecast = getBattleForecast(createNewState({ runId: 'feedback-check' }));
assert.ok(initialForecast.actionRows.length > 0, '초기 전술 HUD에 행동 후보가 있어야 합니다.');
assert.ok(
  initialForecast.actionRows.every((row) => Number.isFinite(row.score)),
  '사거리 밖 행동을 포함한 모든 전술 HUD 점수는 유한값이어야 합니다.',
);

function combatActor(studentId, x, y, overrides = {}) {
  const student = STUDENTS.find((row) => row.id === studentId);
  assert.ok(student, `${studentId} 학생 데이터가 필요합니다.`);
  return {
    ...student,
    x,
    y,
    hp: student.hp,
    maxHp: student.hp,
    ap: 2,
    acted: false,
    shield: null,
    statuses: [],
    modifiers: [],
    overwatch: null,
    ...overrides,
  };
}

function enemyActor(id, x, y, overrides = {}) {
  return {
    id,
    name: overrides.name || id,
    x,
    y,
    hp: 40,
    maxHp: 40,
    atk: 8,
    def: 1,
    range: 1,
    move: 2,
    ap: 2,
    shield: null,
    statuses: [],
    modifiers: [],
    overwatch: null,
    ...overrides,
  };
}

function tacticalState({ runId, units, enemies, selectedUnitId, targetEnemyId = '', coverHp, zones = [] }) {
  const fresh = createNewState({ runId });
  return normalizeState({
    ...fresh,
    selectedStudentIds: units.map((unit) => unit.id),
    battle: {
      ...fresh.battle,
      units,
      enemies,
      selectedUnitId: selectedUnitId || units[0]?.id || '',
      targetEnemyId: targetEnemyId || enemies[0]?.id || '',
      coverHp,
      zones,
    },
  });
}

const rallyBase = tacticalState({
  runId: 'rally-check',
  units: [
    combatActor('s_yuuka', 0, 2),
    combatActor('s_hoshino', 1, 2, { modifiers: [{ id: 'old', stat: 'Accuracy', add: 0.05, duration: 3, source: 'old' }] }),
  ],
  enemies: [enemyActor('rally-enemy', 7, 5, { move: 0 })],
  selectedUnitId: 's_yuuka',
});
const rallied = executeSkillAction(rallyBase, 'sk_rally');
assert.equal(actorModifierValue(rallied.battle.units.find((unit) => unit.id === 's_yuuka'), 'Accuracy'), 0.1, '사기 고양은 시전자 명중을 10% 높여야 합니다.');
assert.equal(actorModifierValue(rallied.battle.units.find((unit) => unit.id === 's_hoshino'), 'Accuracy'), 0.1, '동일 스탯 강화는 가장 강한 수치가 적용되어야 합니다.');
assert.equal(rallied.battle.units.find((unit) => unit.id === 's_hoshino').modifiers.length, 2, '약한 기존 강화도 남아 강한 효과 만료 뒤 다시 활성화될 수 있어야 합니다.');
const rallyTicked = endTurnAction(rallied);
assert.equal(actorModifierValue(rallyTicked.battle.units.find((unit) => unit.id === 's_yuuka'), 'Accuracy'), 0.1, '2턴 강화는 첫 라운드 종료 뒤에도 유지되어야 합니다.');

const smokeBase = tacticalState({
  runId: 'smoke-check',
  units: [combatActor('s_shiroko', 0, 2), combatActor('s_hoshino', 1, 2)],
  enemies: [enemyActor('smoke-enemy', 3, 2, { move: 0 })],
  selectedUnitId: 's_shiroko',
});
const normalHitChance = getBattleForecast(smokeBase).selectedAttacks[0].hitChancePct;
const smoked = executeSkillAction(smokeBase, 'sk_smoke_grenade');
assert.equal(smoked.battle.zones.length, 1, '연막 스킬은 전장에 지대를 생성해야 합니다.');
assert.equal(smoked.battle.zones[0].duration, 2, '다른 아군 행동이 남아 있으면 연막 지속시간이 즉시 감소하면 안 됩니다.');
const smokeHitChance = getBattleForecast({
  ...smokeBase,
  battle: { ...smokeBase.battle, zones: smoked.battle.zones },
}).selectedAttacks[0].hitChancePct;
assert.equal(normalHitChance - smokeHitChance, 20, '연막 안팎 사격은 명중률을 20% 낮춰야 합니다.');

const overwatchBase = tacticalState({
  runId: 'overwatch-check',
  units: [combatActor('s_hoshino', 0, 2, { range: 4 })],
  enemies: [enemyActor('moving-enemy', 4, 2, { hp: 40, maxHp: 40, move: 2 })],
  selectedUnitId: 's_hoshino',
});
const overwatchResolved = executeSkillAction(overwatchBase, 'sk_overwatch');
assert.ok(overwatchResolved.log.some((line) => line.includes('[오버워치]')), '적 이동 중 오버워치 반응 사격 로그가 남아야 합니다.');
assert.equal(overwatchResolved.battle.units[0].overwatch, null, '반응 사격을 사용하면 대기 중인 사격 횟수가 소모되어야 합니다.');

const coverHp = Object.fromEntries([['2,0', COVER_MAX_HP], ['2,4', COVER_MAX_HP], ['5,3', COVER_MAX_HP]]);
const breachBase = tacticalState({
  runId: 'breach-check',
  units: [combatActor('s_iori', 0, 3)],
  enemies: [enemyActor('cover-enemy', 5, 3, { hp: 80, maxHp: 80, move: 0 })],
  selectedUnitId: 's_iori',
  coverHp,
});
const breached = executeSkillAction(breachBase, 'sk_breach_shot');
assert.equal(coverDurabilityAt(breached.battle, 5, 3), 2, '엄폐 파쇄탄은 피해 판정 전에 엄폐 내구도를 6 깎아야 합니다.');
const breachedAgain = normalizeState({
  ...breached,
  battle: {
    ...breached.battle,
    phase: 'player',
    units: breached.battle.units.map((unit) => ({ ...unit, ap: 2, acted: false })),
  },
});
const destroyedCover = executeSkillAction(breachedAgain, 'sk_breach_shot');
assert.equal(coverDurabilityAt(destroyedCover.battle, 5, 3), 0, '두 번째 파쇄탄은 남은 엄폐를 파괴해야 합니다.');
assert.ok(destroyedCover.log.some((line) => line.includes('엄폐 파괴')), '엄폐 파괴 결과를 전투 로그에 명시해야 합니다.');

const flashBase = tacticalState({
  runId: 'flash-check',
  units: [combatActor('s_iori', 0, 3), combatActor('s_hoshino', 0, 2)],
  enemies: [enemyActor('flash-a', 3, 3), enemyActor('flash-b', 3, 4)],
  selectedUnitId: 's_iori',
  targetEnemyId: 'flash-a',
});
const flashPreview = getBattleForecast(flashBase).skillPreviews.find((row) => row.skillId === 'sk_grenade_flash');
assert.match(flashPreview?.detail || '', /최대 2명/, '섬광 투척 예측은 반경 안의 복수 대상을 알려야 합니다.');

const burstBase = tacticalState({
  runId: 'burst-check',
  units: [combatActor('s_hina', 0, 0), combatActor('s_hoshino', 0, 2)],
  enemies: [enemyActor('burst-enemy', 3, 0, { hp: 80, maxHp: 80 })],
  selectedUnitId: 's_hina',
});
const burstResolved = executeSkillAction(burstBase, 'sk_burst');
assert.match(burstResolved.battle.lastResult, /\/2회 명중/, '점사는 두 번의 독립 명중 판정을 결과에 표시해야 합니다.');

assert.ok(TACTICAL_SKILLS.some((skill) => skill.id === 'sk_mark_target' && skill.modifier?.stat === 'Evasion'), '표식은 회피 약화 데이터로 연결되어야 합니다.');
assert.match(componentSource, /is-smoke-zone/, '전투판은 연막 지대를 시각적으로 표시해야 합니다.');
assert.match(componentSource, /coverHp/, '전투판은 엄폐 내구도를 표시해야 합니다.');
assert.match(pageSource, /action=\{resultPresentation\.action\}/, '전역 작전 결과는 상황별 아이콘을 표시해야 합니다.');
assert.match(pageSource, /tone=\{resultPresentation\.tone\}/, '전역 작전 결과는 성공, 경고, 실패 톤을 구분해야 합니다.');
['deploy', 'map', 'property', 'combat', 'inventory'].forEach((action) => {
  assert.ok(featureSource.includes(`icon: '${action}'`), `${action} 기능 탭 아이콘이 필요합니다.`);
});
['overwatch', 'smoke', 'cover-break', 'buff', 'debuff', 'status', 'burst'].forEach((action) => {
  assert.ok(iconSource.includes(`${action.includes('-') ? `'${action}'` : action}:`), `${action} 전용 행동 아이콘이 필요합니다.`);
});
['property-buy', 'property-rent', 'property-lease', 'property-upgrade'].forEach((action) => {
  assert.ok(iconSource.includes(`'${action}':`), `${action} 도시 행동 아이콘이 필요합니다.`);
});
['overwatch', 'reactionShot', 'smoke', 'coverBreak', 'buff', 'debuff', 'statusApply', 'statusResist', 'burst'].forEach((cue) => {
  assert.ok(sfxSource.includes(`${cue}: [`), `${cue} 전용 효과음 프로필이 필요합니다.`);
});
['propertyBuy', 'propertyRent', 'propertyLease', 'propertyUpgrade'].forEach((cue) => {
  assert.ok(sfxSource.includes(`${cue}: [`), `${cue} 도시 결과 효과음 프로필이 필요합니다.`);
});
assert.match(townSource, /FACILITY_PRESENTATION/, '도시 시설은 시설 종류별 아이콘과 선택음을 사용해야 합니다.');
assert.match(townSource, /<GameActionIcon action=\{facilityPresentation\.action\}/, '시설 타일은 한 글자 대신 사물 아이콘을 표시해야 합니다.');
assert.doesNotMatch(townSource, /property\.icon\s*\|\|/, '시설 타일이 데이터의 한 글자 아이콘으로 돌아가면 안 됩니다.');
assert.match(townSource, /action="property-buy" cue="off"/, '시설 구매는 예비 클릭음 없이 결과음만 재생해야 합니다.');
assert.match(townSource, /action="property-rent" cue="off"/, '시설 임차는 예비 클릭음 없이 결과음만 재생해야 합니다.');
assert.match(townSource, /action="property-lease" cue="off"/, '시설 임대는 예비 클릭음 없이 결과음만 재생해야 합니다.');
assert.match(townSource, /action="property-upgrade" cue="off"/, '시설 강화는 예비 클릭음 없이 결과음만 재생해야 합니다.');
assert.match(componentSource, /action="craft" cue="off"/, '제작은 예비 클릭음 없이 결과음만 재생해야 합니다.');
assert.match(componentSource, /action="shop" cue="off"/, '상점 행동은 예비 클릭음 없이 결과음만 재생해야 합니다.');
assert.match(inventorySource, /action="equip" cue="off"/, '장착은 예비 클릭음 없이 결과음만 재생해야 합니다.');
assert.match(inventorySource, /action="claim" cue="off"/, '의뢰 보고는 예비 클릭음 없이 결과음만 재생해야 합니다.');
assert.match(missionSource, /action="deploy" cue="off"/, '출정은 예비 클릭음 없이 결과음만 재생해야 합니다.');
assert.match(missionSource, /data-game-sfx="off"/, '방향 패드는 이동 결과음과 중복되는 예비음을 내면 안 됩니다.');
assert.doesNotMatch(engineSource, /은\(는\)|이\(가\)|을\(를\)/, 'BA SRPG 플레이어 문구에 병기형 조사가 남으면 안 됩니다.');

console.log(JSON.stringify({
  message: 'BA SRPG tactical feedback checks passed.',
  skills: TACTICAL_SKILLS.length,
  tacticalCues: 9,
  townCues: 4,
  nonCombatSignals: nonCombatSignals.length,
  coverAfterFirstBreach: coverDurabilityAt(breached.battle, 5, 3),
  smokeAccuracyPenalty: normalHitChance - smokeHitChance,
}, null, 2));
