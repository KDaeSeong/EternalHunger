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
const legacy = engine.normalizeState({
  ...base,
  students: base.students.slice(0, 5),
  methodExperience: undefined,
});
assert.equal(legacy.students.length, 8, '기존 5인 세이브는 8인 로스터로 확장되어야 합니다.');
assert.equal(legacy.students.find((student) => student.id === 'shiroko')?.pref, 'speed', '시로코의 원본 선호 태그를 복구해야 합니다.');
assert.deepEqual(Object.keys(legacy.methodExperience).sort(), [...methodIds].sort(), '구 세이브에도 모든 공정 경험치를 초기화해야 합니다.');

const richInventory = Object.fromEntries(engine.INGREDIENTS.map((ingredient) => [ingredient.id, 99]));
const ready = {
  ...base,
  gold: 999999,
  inventory: richInventory,
  unlockedRecipeIds: engine.RECIPES.map((recipe) => recipe.id),
};
const firstCraft = engine.craftRecipeAction(ready, 'basic_tonkatsu', { rng: () => 0.99 });
assert.equal(firstCraft.lastCraft?.success, true, '확정 성공 난수에서는 메뉴가 제작되어야 합니다.');
assert.equal(firstCraft.methodExperience.m_fry, 1, '제작 시 사용 공정 경험치가 올라야 합니다.');
assert.equal(feedback.tonkatsuResultCue(ready, firstCraft), 'fry', '튀기기 성공에는 전용 효과음을 사용해야 합니다.');

const secondCraft = engine.craftRecipeAction(firstCraft, 'basic_tonkatsu', { rng: () => 0.99 });
const thirdCraft = engine.craftRecipeAction(secondCraft, 'basic_tonkatsu', { rng: () => 0.99 });
assert.equal(engine.methodLevelFromExperience(thirdCraft.methodExperience.m_fry), 1, '3회 조리 후 첫 공정 레벨을 달성해야 합니다.');
assert.equal(thirdCraft.lastCraft.masteryRaised[0]?.level, 1, '숙련 상승 결과를 기록해야 합니다.');
assert.equal(feedback.tonkatsuResultCue(secondCraft, thirdCraft), 'methodLevelUp', '숙련 상승음은 일반 조리음보다 우선해야 합니다.');

const failedCraft = engine.craftRecipeAction(ready, 'basic_tonkatsu', { rng: () => 0 });
assert.equal(failedCraft.lastCraft?.success, false, '확정 실패 난수에서는 실패 결과를 기록해야 합니다.');
assert.equal(failedCraft.counters.craftFailures, 1, '제작 실패 횟수를 집계해야 합니다.');
assert.equal(feedback.tonkatsuResultCue(ready, failedCraft), 'cookFail', '제작 실패에는 전용 실패음을 사용해야 합니다.');

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

for (const cue of ['fry', 'grill', 'boil', 'simmer', 'sauce', 'dessert', 'cookFail', 'methodLevelUp']) {
  assert.match(soundSource, new RegExp(`\\n  ${cue}: \\[`), `${cue} 효과음 프로필이 있어야 합니다.`);
}
for (const icon of ['fry', 'grill', 'boil', 'simmer', 'sauce', 'dessert']) {
  assert.match(iconSource, new RegExp(`\\n  ${icon}: `), `${icon} 아이콘 매핑이 있어야 합니다.`);
}
assert.match(methodStripSource, /data-game-sfx=\{row\.action\}/, '각 조리 공정에서 전용 효과음을 미리 들을 수 있어야 합니다.');
assert.match(kitchenSource, /cue="off"/, '조리 결과음과 클릭음이 겹치지 않도록 제작 버튼의 선행음을 꺼야 합니다.');
assert.match(kitchenSource, /value=\{recipeId\}/, '핵심 주방 탭에서 운영 메뉴를 바로 바꿀 수 있어야 합니다.');
assert.match(kitchenSource, /value=\{ingredientId\}/, '핵심 주방 탭에서 매입 재료를 바로 바꿀 수 있어야 합니다.');
assert.match(studentsSource, /value=\{studentId\}/, '학생 탭에서 지원 대상을 바로 바꿀 수 있어야 합니다.');
assert.ok(featureTabsSource.indexOf("id: 'kitchen'") < featureTabsSource.indexOf("id: 'operations'"), '첫 기능 탭은 리포트보다 실제 주방 루프를 먼저 제공해야 합니다.');

console.log(JSON.stringify({
  ingredients: engine.INGREDIENTS.length,
  recipes: engine.RECIPES.length,
  methods: engine.METHODS.length,
  students: engine.STUDENTS.length,
  migratedStudents: legacy.students.length,
  fryLevel: engine.methodLevelFromExperience(thirdCraft.methodExperience.m_fry),
  feedbackCues: 8,
}, null, 2));
