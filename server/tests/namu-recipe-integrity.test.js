const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');

const scriptPath = path.resolve(__dirname, '../scripts/import_namu_pasted.js');
const sourceDirectory = path.resolve(__dirname, '../scripts/namu_pastes');
const invalidSourcePath = path.resolve(__dirname, 'fixtures/invalid-namu-recipes.code');

// Load the product parser with database dependencies disabled. No connection,
// environment file or CLI entry point is used by these tests.
function loadParser({ connectionError = null, sourceText = null } = {}) {
  let databaseCalls = 0;
  let connectCalls = 0;
  let disconnectCalls = 0;
  const mongoose = {
    async connect() {
      connectCalls++;
      if (connectionError) throw connectionError;
    },
    async disconnect() { disconnectCalls++; },
  };
  const database = new Proxy({}, { get() {
    databaseCalls++;
    throw new Error('Database access is forbidden in a parser test');
  } });
  const sourceFs = sourceText === null ? fs : { ...fs,
    statSync(filePath, ...args) {
      return String(filePath) === invalidSourcePath ? { isDirectory: () => false } : fs.statSync(filePath, ...args);
    },
    readFileSync(filePath, ...args) {
      return String(filePath) === invalidSourcePath ? sourceText : fs.readFileSync(filePath, ...args);
    },
  };
  const sandbox = {
    __dirname: path.dirname(scriptPath),
    module: { exports: {} },
    process: { env: { MONGO_URI: 'mongodb://unused.invalid/parser-test' } },
    console: { log() {}, error() {} },
    require(id) {
      if (id === 'fs') return sourceFs;
      if (id === 'path') return path;
      if (id === 'dotenv') return { config() {} };
      if (id === 'mongoose') return mongoose;
      if (id === '../models/Item' || id === '../models/ErMeta') return database;
      if (id === '../config/item_taxonomy') return require('../config/item_taxonomy');
      throw new Error(`Unexpected parser dependency: ${id}`);
    },
  };
  vm.runInNewContext(fs.readFileSync(scriptPath, 'utf8'), sandbox, { filename: scriptPath });
  return { ...sandbox.module.exports, databaseCalls: () => databaseCalls,
    connectCalls: () => connectCalls, disconnectCalls: () => disconnectCalls };
}

const plain = value => JSON.parse(JSON.stringify(value));
const item = name => `[include(틀:이터널 리턴/아이템, 등급=고급, 아이템명=${name}, 분류=창)]`;
const recipe = (result, first, second) => `[include(틀:이터널 리턴/제작 트리, 완성=${result}, 제작1=${first}, 제작2=${second})]`;

test('result mismatch is visible and prevents every database operation', async () => {
  const parser = loadParser();
  const text = `${item('파이크')}\n${recipe('죽창', '단창', '고철')}`;
  const parsed = parser.extractItemsAndRecipes(text);
  assert.deepEqual(plain(parsed.diagnostics), [
    { code: 'recipe_result_mismatch', line: 2, result: '죽창', sectionItem: '파이크' },
  ]);
  await assert.rejects(parser.importItemsAndRecipesFromText(text), { code: 'NAMU_RECIPE_REVIEW_REQUIRED' });
  assert.equal(parser.databaseCalls(), 0);
});

test('alternative recipes remain available for review instead of selecting the last one', async () => {
  const parser = loadParser();
  const text = [item('죽창'), recipe('죽창', '단창', '나뭇가지'), recipe('죽창', '단창', '고철')].join('\n');
  const parsed = parser.extractItemsAndRecipes(text);
  assert.deepEqual(plain(parsed.recipes), [
    { result: '죽창', ingredients: ['단창', '나뭇가지'] },
    { result: '죽창', ingredients: ['단창', '고철'] },
  ]);
  assert.equal(parsed.diagnostics[0].code, 'conflicting_recipes');
  assert.equal(parsed.diagnostics[0].previousLine, 2);
  await assert.rejects(parser.importItemsAndRecipesFromText(text), { code: 'NAMU_RECIPE_REVIEW_REQUIRED' });
  assert.equal(parser.databaseCalls(), 0);
});

test('both import CLI paths reject invalid source before connecting or accessing models', async () => {
  for (const method of ['runImport', 'runImportAll']) {
    const parser = loadParser({ sourceText: `${item('파이크')}\n${recipe('죽창', '단창', '고철')}` });
    await assert.rejects(parser[method](invalidSourcePath),
      { code: 'NAMU_RECIPE_REVIEW_REQUIRED' });
    assert.equal(parser.connectCalls(), 0, method);
    assert.equal(parser.databaseCalls(), 0, method);
    assert.equal(parser.disconnectCalls(), 0, method);
  }
});

test('both import CLI paths disconnect after a connection or subsequent model failure', async () => {
  for (const method of ['runImport', 'runImportAll']) {
    const file = path.join(sourceDirectory, 'weapon_spear.code');
    const failedConnection = loadParser({ connectionError: new Error('Connection rejected by test') });
    await assert.rejects(failedConnection[method](file), /Connection rejected by test/);
    assert.equal(failedConnection.connectCalls(), 1, method);
    assert.equal(failedConnection.databaseCalls(), 0, method);
    assert.equal(failedConnection.disconnectCalls(), 1, method);
    const failedModel = loadParser();
    await assert.rejects(failedModel[method](file), /Database access is forbidden/);
    assert.equal(failedModel.connectCalls(), 1, method);
    assert.equal(failedModel.databaseCalls(), 1, method);
    assert.equal(failedModel.disconnectCalls(), 1, method);
  }
});

test('repeated identical recipes ignore ingredient ordering but retain quantities', () => {
  const parser = loadParser();
  const same = parser.extractItemsAndRecipes([
    item('죽창'), recipe('죽창', '단창', '고철'), recipe('죽창', '고철', '단창'),
  ].join('\n'));
  assert.equal(same.diagnostics.length, 0);
  assert.doesNotThrow(() => parser.assertSafeRecipeImport(same));
  const different = parser.extractItemsAndRecipes([
    item('죽창'), recipe('죽창', '고철', '고철'), recipe('죽창', '고철', '단창'),
  ].join('\n'));
  assert.equal(different.diagnostics[0].code, 'conflicting_recipes');
});

test('the four restored recipes match source sections and the canonical seed', () => {
  const parser = loadParser();
  const recipes = [];
  for (const file of ['weapon_spear.code', 'weapon_crossbow.code']) {
    const parsed = parser.extractItemsAndRecipes(fs.readFileSync(path.join(sourceDirectory, file), 'utf8'));
    assert.deepEqual(plain(parsed.diagnostics), []);
    recipes.push(...plain(parsed.recipes));
  }
  const seed = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../utils/defaultItemTree.generated.json'), 'utf8'));
  const expected = [
    ['파이크', 'namu:창:파이크', ['단창', '고철'], ['namu:창:단창', 'namu:material:고철']],
    ['죽창', 'namu:창:죽창', ['단창', '나뭇가지'], ['namu:창:단창', 'namu:material:나뭇가지']],
    ['헤비 크로스보우', 'namu:석궁:헤비 크로스보우', ['쇠뇌', '고철'], ['namu:석궁:쇠뇌', 'namu:material:고철']],
    ['저격궁', 'namu:석궁:저격궁', ['크로스보우', '레이저 포인터'], ['namu:석궁:크로스보우', 'namu:material:레이저 포인터']],
  ];
  for (const [name, key, ingredients, keys] of expected) {
    assert.deepEqual(recipes.filter(row => row.result === name), [{ result: name, ingredients }]);
    assert.deepEqual(seed.find(row => row.key === key).recipeKeys, keys.map(key => ({ key, qty: 1 })));
  }
});

test('the complete captured corpus passes the import guard with source-consistent recipes', () => {
  const parser = loadParser();
  const entries = parser.readSourceEntries(sourceDirectory);
  const parsed = parser.extractItemsAndRecipes(parser.combineItemSourceText(entries));
  assert.ok(entries.length > 30);
  assert.ok(parsed.items.length > 500);
  assert.ok(parsed.recipes.length > 300);
  assert.deepEqual(plain(parsed.diagnostics), []);
  assert.doesNotThrow(() => parser.assertSafeRecipeImport(parsed));
  for (const [result, ingredients] of [
    ['거울구슬', ['유리구슬', '오일']], ['얼음구슬', ['유리구슬', '얼음']],
    ['목궁', ['양궁', '피아노선']], ['컴포지트 보우', ['목궁', '못']],
    ['바스타드 소드', ['장검', '고철']], ['보검', ['장검', '원석']],
    ['레이피어', ['바늘', '고철']], ['에스톡', ['레이피어', '오일']],
  ]) assert.deepEqual(plain(parsed.recipes.filter(row => row.result === result)), [{ result, ingredients }]);
  assert.equal(parsed.items.filter(row => row.name === '에스톡').length, 1);
  assert.equal(parsed.items.filter(row => row.name === '레이피어').length, 1);
  assert.equal(parser.databaseCalls(), 0);
});
