import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const rootUrl = new URL('../src/app/games/tonkatsu-teacher/', import.meta.url);
const libUrl = new URL('_lib/', rootUrl);
const dataSource = await readFile(new URL('tonkatsuTeacherData.js', libUrl), 'utf8');
const dataUrl = `data:text/javascript;base64,${Buffer.from(dataSource).toString('base64')}`;
const engineSource = (await readFile(new URL('tonkatsuTeacherEngine.js', libUrl), 'utf8'))
  .replaceAll("} from './tonkatsuTeacherData';", `} from '${dataUrl}';`);
const engineUrl = `data:text/javascript;base64,${Buffer.from(engineSource).toString('base64')}`;
const engine = await import(engineUrl);
const feedbackSource = await readFile(new URL('tonkatsuTeacherFeedback.js', libUrl), 'utf8');
const feedbackUrl = `data:text/javascript;base64,${Buffer.from(feedbackSource).toString('base64')}`;
const feedback = await import(feedbackUrl);
const componentUrl = new URL('_components/', rootUrl);
const methodStripSource = await readFile(new URL('TonkatsuMethodStrip.js', componentUrl), 'utf8');
const kitchenSource = await readFile(new URL('TonkatsuKitchenTab.js', componentUrl), 'utf8');
const featureTabsSource = await readFile(new URL('TonkatsuTeacherFeatureTabs.js', componentUrl), 'utf8');
const studentsSource = await readFile(new URL('TonkatsuStudentsTab.js', componentUrl), 'utf8');
const growthSource = await readFile(new URL('TonkatsuGrowthTab.js', componentUrl), 'utf8');
const judgeSource = await readFile(new URL('TonkatsuJudgeTab.js', componentUrl), 'utf8');
const advancedSource = await readFile(new URL('TonkatsuAdvancedTab.js', componentUrl), 'utf8');
const pageSource = await readFile(new URL('play/page.js', rootUrl), 'utf8');
const iconSource = await readFile(new URL('../src/app/games/_components/GameActionIcon.js', import.meta.url), 'utf8');
const soundSource = await readFile(new URL('../src/app/games/_lib/useGameSfx.js', import.meta.url), 'utf8');

assert.equal(engine.INGREDIENTS.length, 18, '원본 재료 18종을 유지해야 합니다.');
assert.equal(engine.RECIPES.length, 15, '원본 레시피 15종을 유지해야 합니다.');
assert.equal(engine.METHODS.length, 6, '원본 조리 공정 6종을 모두 이식해야 합니다.');
assert.equal(engine.STUDENTS.length, 8, '원본 학생 8명을 모두 이식해야 합니다.');

const methodIds = new Set(engine.METHODS.map((method) => method.id));
engine.RECIPES.forEach((recipe) => {
  assert.ok(recipe.methods?.length, `${recipe.name}에 조리 공정이 지정되어야 합니다.`);
  recipe.methods.forEach((methodId) => assert.ok(methodIds.has(methodId), `${recipe.name}의 ${methodId} 공정이 존재해야 합니다.`));
});

const base = engine.createNewState({ now: '2026-07-12T00:00:00.000Z', runId: 'tonkatsu-check' });
const immediateRunA = engine.createNewState({ now: '2026-07-12T00:00:00.000Z' });
const immediateRunB = engine.createNewState({ now: '2026-07-12T00:00:00.000Z' });
assert.notEqual(immediateRunA.runId, immediateRunB.runId, '연속으로 생성한 새 운영은 서로 다른 런 ID를 가져야 합니다.');
const legacy = engine.normalizeState({
  ...base,
  students: base.students.slice(0, 5),
  methodExperience: undefined,
});
assert.equal(legacy.students.length, 8, '기존 5인 세이브는 8인 로스터로 확장되어야 합니다.');
assert.equal(legacy.students.find((student) => student.id === 'shiroko')?.pref, 'speed', '시로코의 원본 선호 태그를 복구해야 합니다.');
assert.deepEqual(Object.keys(legacy.methodExperience).sort(), [...methodIds].sort(), '구 세이브에도 모든 공정 경험치를 초기화해야 합니다.');
assert.equal(legacy.counters.purchases, 0, '구 세이브에는 구매 카운터 기본값을 보완해야 합니다.');

const richInventory = Object.fromEntries(engine.INGREDIENTS.map((ingredient) => [ingredient.id, 99]));
const ready = {
  ...base,
  gold: 999999,
  inventory: richInventory,
  unlockedRecipeIds: engine.RECIPES.map((recipe) => recipe.id),
};

function expectFeedback(previous, next, expected) {
  const presentation = feedback.tonkatsuResultPresentation(previous, next);
  assert.equal(presentation.key, expected.key, `${expected.key} 전환 키를 선택해야 합니다.`);
  assert.equal(presentation.cue, expected.cue, `${expected.key} 전용 결과음을 선택해야 합니다.`);
  assert.equal(presentation.action, expected.action, `${expected.key} 전용 아이콘을 선택해야 합니다.`);
  assert.equal(presentation.tone, expected.tone, `${expected.key} 결과 톤을 선택해야 합니다.`);
  assert.equal(feedback.tonkatsuResultCue(previous, next), expected.cue, `${expected.key} 효과음 API가 프레젠테이션과 일치해야 합니다.`);
}

const purchased = engine.buyIngredientAction(base, 'pork', 2);
assert.equal(purchased.counters.purchases, 2, '재료 구매 성공 수량을 카운터에 기록해야 합니다.');
expectFeedback(base, purchased, { key: 'purchase', cue: 'trade', action: 'trade', tone: 'highlight' });

const purchaseFailed = engine.buyIngredientAction({ ...base, gold: 0 }, 'pork', 1);
expectFeedback({ ...base, gold: 0 }, purchaseFailed, { key: 'blocked', cue: 'warning', action: 'warning', tone: 'warning' });
assert.equal(
  feedback.tonkatsuTextPresentation(purchaseFailed.log[0]).tone,
  'warning',
  '실패 로그는 고정 결과 패널에서 경고 톤을 사용해야 합니다.',
);

const stocked = { ...base, mealTokens: { basic_tonkatsu: 4 } };
const sold = engine.sellRecipeAction(stocked, 'basic_tonkatsu', 1);
expectFeedback(stocked, sold, { key: 'sale', cue: 'sales', action: 'sales', tone: 'success' });

const ordered = engine.fulfillDailyOrdersAction(stocked);
expectFeedback(stocked, ordered, { key: 'orderComplete', cue: 'orderComplete', action: 'order', tone: 'success' });

const served = engine.feedStudentAction(stocked, 'yuuka', 'basic_tonkatsu');
expectFeedback(stocked, served, { key: 'serve', cue: 'serve', action: 'serve', tone: 'success' });

const facilityReady = { ...base, gold: 999999 };
const upgraded = engine.upgradeFacilityAction(facilityReady, 'fryer');
expectFeedback(facilityReady, upgraded, { key: 'facilityUpgrade', cue: 'upgrade', action: 'upgrade', tone: 'success' });

const researchReady = { ...base, gold: 999999, recipeShards: 999 };
const researchProject = engine.researchRows(researchReady).find((project) => !project.done && project.canResearch);
assert.ok(researchProject, '즉시 검증할 수 있는 레시피 연구가 있어야 합니다.');
const researched = engine.researchRecipeAction(researchReady, researchProject.recipeId);
expectFeedback(researchReady, researched, { key: 'research', cue: 'research', action: 'research', tone: 'success' });

const cosmeticReady = { ...base, gold: 999999, recipeShards: 999 };
const cosmetic = engine.cosmeticRows(cosmeticReady).find((item) => item.canBuy);
assert.ok(cosmetic, '즉시 검증할 수 있는 코스메틱 구매 항목이 있어야 합니다.');
const cosmeticBought = engine.buyCosmeticAction(cosmeticReady, cosmetic.id);
expectFeedback(cosmeticReady, cosmeticBought, { key: 'cosmeticBuy', cue: 'shop', action: 'shop', tone: 'success' });
const cosmeticEquipped = engine.equipCosmeticAction(cosmeticBought, cosmetic.id);
expectFeedback(cosmeticBought, cosmeticEquipped, { key: 'cosmeticEquip', cue: 'equip', action: 'equip', tone: 'highlight' });

const deliveryReady = {
  ...base,
  facilityLevels: { ...base.facilityLevels, delivery: 2 },
};
const delivery = engine.setBusinessModeAction(deliveryReady, 'delivery');
expectFeedback(deliveryReady, delivery, { key: 'businessMode', cue: 'sales', action: 'sales', tone: 'highlight' });

const nextDay = engine.nextDayAction(base);
expectFeedback(base, nextDay, { key: 'nextDay', cue: 'advance', action: 'advance', tone: 'highlight' });

const battleWon = engine.battleAction(base, 'yuuka', { rng: () => 0 });
expectFeedback(base, battleWon, { key: 'battleVictory', cue: 'victory', action: 'victory', tone: 'success' });
const battleLost = engine.battleAction(base, 'yuuka', { rng: () => 0.999 });
expectFeedback(base, battleLost, { key: 'battleDefeat', cue: 'defeat', action: 'combat', tone: 'danger' });

const judgeStarted = engine.startJudgeMatchAction(base, 'rookie');
expectFeedback(base, judgeStarted, { key: 'judgeStart', cue: 'verdict', action: 'verdict', tone: 'highlight' });
const judgeWinner = Number(judgeStarted.judgeMatch.aiATotal || 0) >= Number(judgeStarted.judgeMatch.aiBTotal || 0) ? 'A' : 'B';
const judgeResolved = engine.submitJudgePickAction(judgeStarted, judgeWinner, '회귀 검사');
expectFeedback(judgeStarted, judgeResolved, { key: 'judgeCorrect', cue: 'judgeCorrect', action: 'verdict', tone: 'success' });
const judgeWrong = {
  ...base,
  counters: { ...base.counters, judgeMatches: 1, judgeCorrect: 0 },
};
expectFeedback(base, judgeWrong, { key: 'judgeWrong', cue: 'judgeWrong', action: 'verdict', tone: 'warning' });
const judgeReset = engine.clearJudgeHistoryAction(judgeResolved);
expectFeedback(judgeResolved, judgeReset, { key: 'judgeReset', cue: 'warning', action: 'reset', tone: 'warning' });

const tournamentWon = {
  ...base,
  counters: { ...base.counters, tournaments: 1, tournamentWins: 1 },
};
expectFeedback(base, tournamentWon, { key: 'tournamentWin', cue: 'champion', action: 'trophy', tone: 'champion' });
const tournamentLost = {
  ...base,
  counters: { ...base.counters, tournaments: 1, tournamentWins: 0 },
};
expectFeedback(base, tournamentLost, { key: 'tournamentLoss', cue: 'defeat', action: 'tournament', tone: 'warning' });

const completed = { ...base, ended: true };
expectFeedback(base, completed, { key: 'complete', cue: 'complete', action: 'trophy', tone: 'champion' });
const newRun = engine.createNewState({ now: '2026-07-12T01:00:00.000Z', runId: 'tonkatsu-new-check' });
expectFeedback(base, newRun, { key: 'newRun', cue: 'start', action: 'new', tone: 'highlight' });

assert.equal(feedback.tonkatsuTextPresentation('운영 데이터를 저장했습니다.').action, 'save', '저장 성공을 저장 아이콘으로 표시해야 합니다.');
assert.equal(feedback.tonkatsuTextPresentation('저장된 운영 데이터를 불러왔습니다.').action, 'load', '불러오기 성공을 폴더 아이콘으로 표시해야 합니다.');
assert.equal(feedback.tonkatsuTextPresentation('로그인하면 저장할 수 있습니다.').tone, 'warning', '비로그인 저장 안내를 경고 톤으로 표시해야 합니다.');
const firstCraft = engine.craftRecipeAction(ready, 'basic_tonkatsu', { rng: () => 0.99 });
assert.equal(firstCraft.lastCraft?.success, true, '확정 성공 난수에서는 메뉴가 제작되어야 합니다.');
assert.equal(firstCraft.methodExperience.m_fry, 1, '제작 시 사용 공정 경험치가 올라야 합니다.');
assert.equal(feedback.tonkatsuResultCue(ready, firstCraft), 'fry', '튀기기 성공에는 전용 효과음을 사용해야 합니다.');
expectFeedback(ready, firstCraft, { key: 'cook', cue: 'fry', action: 'fry', tone: 'success' });

const secondCraft = engine.craftRecipeAction(firstCraft, 'basic_tonkatsu', { rng: () => 0.99 });
const thirdCraft = engine.craftRecipeAction(secondCraft, 'basic_tonkatsu', { rng: () => 0.99 });
assert.equal(engine.methodLevelFromExperience(thirdCraft.methodExperience.m_fry), 1, '3회 조리 후 첫 공정 레벨을 달성해야 합니다.');
assert.equal(thirdCraft.lastCraft.masteryRaised[0]?.level, 1, '숙련 상승 결과를 기록해야 합니다.');
assert.equal(feedback.tonkatsuResultCue(secondCraft, thirdCraft), 'methodLevelUp', '숙련 상승음은 일반 조리음보다 우선해야 합니다.');
expectFeedback(secondCraft, thirdCraft, { key: 'methodLevelUp', cue: 'methodLevelUp', action: 'upgrade', tone: 'success' });

const failedCraft = engine.craftRecipeAction(ready, 'basic_tonkatsu', { rng: () => 0 });
assert.equal(failedCraft.lastCraft?.success, false, '확정 실패 난수에서는 실패 결과를 기록해야 합니다.');
assert.equal(failedCraft.counters.craftFailures, 1, '제작 실패 횟수를 집계해야 합니다.');
assert.equal(feedback.tonkatsuResultCue(ready, failedCraft), 'cookFail', '제작 실패에는 전용 실패음을 사용해야 합니다.');
expectFeedback(ready, failedCraft, { key: 'cookFail', cue: 'cookFail', action: 'cook', tone: 'danger' });

const sauceCraft = engine.craftRecipeAction(ready, 'cabbage_salad', { rng: () => 0.99 });
const dessertCraft = engine.craftRecipeAction(ready, 'milk_pudding', { rng: () => 0.99 });
const grillCraft = engine.craftRecipeAction(ready, 'garlic_soy_grilled_pork', { rng: () => 0.99 });
assert.equal(feedback.tonkatsuResultCue(ready, sauceCraft), 'sauce', '소스화 공정 효과음을 연결해야 합니다.');
assert.equal(feedback.tonkatsuResultCue(ready, dessertCraft), 'dessert', '디저트 공정 효과음을 연결해야 합니다.');
assert.equal(feedback.tonkatsuResultCue(ready, grillCraft), 'grill', '굽기 공정 효과음을 연결해야 합니다.');

const methodProfile = engine.recipeMethodProfile(thirdCraft, 'basic_tonkatsu');
assert.ok(methodProfile.successPct > engine.recipeMethodProfile(ready, 'basic_tonkatsu').successPct, '공정 숙련이 제작 성공률을 높여야 합니다.');
assert.ok(methodProfile.productionMult > 1, '공정 숙련이 생산 보정을 제공해야 합니다.');

const shirokoPreview = engine.battleForecast(ready, 'shiroko', 'crispy_katsu_sand', { afterFeed: true });
assert.equal(shirokoPreview.likes, true, '시로코는 속도 태그 메뉴를 선호해야 합니다.');
assert.ok(shirokoPreview.chancePct >= 12 && shirokoPreview.chancePct <= 92, '확장 전투 스탯을 반영한 승률은 허용 범위여야 합니다.');

const resultCues = [
  'fry', 'grill', 'boil', 'simmer', 'sauce', 'dessert', 'cookFail', 'methodLevelUp',
  'trade', 'sales', 'orderComplete', 'serve', 'upgrade', 'research', 'shop', 'equip',
  'advance', 'complete', 'verdict', 'judgeCorrect', 'judgeWrong', 'victory', 'defeat',
  'champion', 'warning', 'start',
];
for (const cue of resultCues) {
  assert.match(soundSource, new RegExp(`\\n  ${cue}: \\[`), `${cue} 효과음 프로필이 있어야 합니다.`);
}
for (const icon of [
  'fry', 'grill', 'boil', 'simmer', 'sauce', 'dessert', 'trade', 'sales', 'order',
  'serve', 'upgrade', 'research', 'shop', 'equip', 'advance', 'verdict', 'victory',
  'combat', 'trophy', 'warning', 'new', 'reset', 'tournament',
]) {
  assert.match(iconSource, new RegExp(`\\n  ${icon}: `), `${icon} 아이콘 매핑이 있어야 합니다.`);
}
assert.match(methodStripSource, /data-game-sfx=\{row\.action\}/, '각 조리 공정에서 전용 효과음을 미리 들을 수 있어야 합니다.');
assert.match(kitchenSource, /cue="off"/, '조리 결과음과 클릭음이 겹치지 않도록 제작 버튼의 선행음을 꺼야 합니다.');
assert.match(kitchenSource, /value=\{recipeId\}/, '핵심 주방 탭에서 운영 메뉴를 바로 바꿀 수 있어야 합니다.');
assert.match(kitchenSource, /value=\{ingredientId\}/, '핵심 주방 탭에서 매입 재료를 바로 바꿀 수 있어야 합니다.');
assert.match(studentsSource, /value=\{studentId\}/, '학생 탭에서 지원 대상을 바로 바꿀 수 있어야 합니다.');
assert.ok(featureTabsSource.indexOf("id: 'kitchen'") < featureTabsSource.indexOf("id: 'operations'"), '첫 기능 탭은 리포트보다 실제 주방 루프를 먼저 제공해야 합니다.');
assert.match(pageSource, /setState=\{applyTonkatsuState\}/, '모든 기능 탭의 상태 변경을 결과 분류 래퍼로 보내야 합니다.');
assert.match(pageSource, /action=\{resultPresentation\.action\}/, '고정 결과 패널에 분류된 아이콘을 전달해야 합니다.');
assert.match(pageSource, /tone=\{resultPresentation\.tone\}/, '고정 결과 패널에 분류된 결과 톤을 전달해야 합니다.');
assert.match(pageSource, /publishMessage\('로그인하면/, '비로그인 저장 안내도 고정 결과 패널로 보내야 합니다.');

const actionComponentsSource = [kitchenSource, studentsSource, growthSource, judgeSource, advancedSource].join('\n');
for (const match of actionComponentsSource.matchAll(/setState\(/g)) {
  const buttonPrefix = actionComponentsSource.slice(Math.max(0, match.index - 500), match.index);
  assert.match(buttonPrefix, /cue="off"/, '상태 기반 결과음이 있는 버튼은 선행 클릭음을 꺼야 합니다.');
}

console.log(JSON.stringify({
  ingredients: engine.INGREDIENTS.length,
  recipes: engine.RECIPES.length,
  methods: engine.METHODS.length,
  students: engine.STUDENTS.length,
  migratedStudents: legacy.students.length,
  fryLevel: engine.methodLevelFromExperience(thirdCraft.methodExperience.m_fry),
  feedbackCues: resultCues.length,
  feedbackTransitions: 24,
}, null, 2));
