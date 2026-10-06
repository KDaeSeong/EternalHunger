const test = require('node:test');
const assert = require('node:assert/strict');
const { makeSetup, makeErDetail } = require('./fixtures/character-setup-fixture');
const { sanitizeCharacterSetup, SETUP_SCHEMA } = require('../utils/characterSetupContract');
const { parseSetupRequest, createCharacterSetupHandler } = require('../utils/characterSetupService');
const { plainText, extractErSource, createErCharacterSourceReader } = require('../utils/erCharacterSource');

test('setup input is bounded and ignores arbitrary request properties', () => {
  assert.deepEqual(parseSetupRequest({ mode: 'custom', name: ' 검사 ', text: ' 설정\r\n설명 ',
    userId: 'other-user', records: [{}] }), { mode: 'custom', name: '검사', text: '설정\n설명' });
  for (const input of [{ mode: 'other', name: '검사' }, { mode: 'er', text: '설명' },
    { mode: 'custom', name: {} }, { mode: 'custom', name: 'x'.repeat(41) },
    { mode: 'custom', text: 'x'.repeat(12001) }, { mode: 'custom' },
    { mode: 'er', name: '  ', text: '원작 설명' }, { mode: 'custom', name: ' ', text: '\n ' },
    { mode: 'custom', text: 'x' }]) assert.throws(() => parseSetupRequest(input));
});
test('one-character names are valid in both ER and custom name-only requests', () => {
  for (const mode of ['er', 'custom']) {
    assert.deepEqual(parseSetupRequest({ mode, name: ' 얀 ' }), { mode, name: '얀', text: '' });
  }
});
test('full draft preserves explicit small percentage points and strips runtime/ownership fields', () => {
  const raw = makeSetup(); Object.assign(raw, { _id: 'forged', records: [{}], hp: 999, inventory: [{}] });
  const result = sanitizeCharacterSetup(raw);
  assert.equal(result.schema, SETUP_SCHEMA); assert.equal(result.characterSkills.q.maxHpPct[0], 0.2);
  assert.equal(result.characterSkills.q.hpDamagePercentUnit, 'percent');
  assert.deepEqual(Object.keys(result.characterSkills), ['q', 'w', 'e', 'r', 'passive']);
  for (const field of ['_id', 'records', 'hp', 'inventory']) assert.equal(Object.hasOwn(result, field), false);
});
test('malformed, missing, excessive and non-finite stats fail rather than silently clamp', () => {
  for (const value of [undefined, '100', NaN, Infinity, 1000, -1]) {
    const raw = makeSetup(); raw.stats.maxHp = value; assert.throws(() => sanitizeCharacterSetup(raw));
  }
});
test('oversized flat damage cannot reproduce thousands of damage against baseline HP', () => {
  const raw = makeSetup(); raw.characterSkills.q.firstFlat = [3446]; assert.throws(() => sanitizeCharacterSetup(raw));
});
test('unsupported states, state targets, duplicate control and fake conditions fail', () => {
  const edits = [s => { s.useCondition = 'invented'; }, s => { s.type = 'made-up'; },
    s => { s.statusEffects = [{ name: '중첩 출혈', target: 'target', durationSec: 2 }]; },
    s => { s.statusEffects = [{ name: '기절', target: 'self', durationSec: 2 }]; },
    s => { s.statusEffects = Array(2).fill({ name: '기절', target: 'target', durationSec: 2 }); },
    s => { s.statusEffects = [{ name: '기절', target: 'target', durationSec: 2, wakeDamagePct: 0.5 }]; }];
  for (const edit of edits) { const raw = makeSetup(); edit(raw.characterSkills.q); assert.throws(() => sanitizeCharacterSetup(raw)); }
});
test('passive triggers and movement without matching distance fail', () => {
  for (const edit of [raw => { raw.characterSkills.passive.firstFlat = [10]; },
    raw => { raw.characterSkills.e.movementDistance = 0; },
    raw => { raw.characterSkills.q.resourceCost = 10; }]) {
    const raw = makeSetup(); edit(raw); assert.throws(() => sanitizeCharacterSetup(raw));
  }
});
test('an unsupported passive can be explicitly disabled with a visible warning', () => {
  const raw = makeSetup(); raw.characterSkills.passive = { enabled: false, name: '미지원 중첩', type: 'passive_stat' };
  const draft = sanitizeCharacterSetup(raw); assert.equal(draft.characterSkills.passive.enabled, false);
  assert.ok(draft.warnings.some(text => text.includes('PASSIVE')));
});
test('disabled generated slots cannot hide executable effects behind an unsupported warning', () => {
  const cases = [
    ['q', skill => { skill.firstFlat = [1]; }], ['q', skill => { skill.maxHpPct = [0.2]; }],
    ['q', skill => { skill.secondAttackPowerScale = 0.5; }], ['q', skill => { skill.heal = [1]; }],
    ['q', skill => { skill.shield = [1]; }],
    ['q', skill => { skill.includesMovement = true; skill.movementDistance = 2; }],
    ['q', skill => { skill.statusEffects = [{ name: '기절', target: 'target', durationSec: 1 }]; }],
    ['q', skill => { skill.resourceCost = 1; }], ['q', skill => { skill.resourceGain = 1; }],
    ['passive', skill => { skill.statModifiers = { defense: 2 }; }],
    ['passive', skill => { skill.statModifiers = { defense: -2 }; }],
  ];
  for (const [slot, edit] of cases) {
    const raw = makeSetup();
    raw.uniqueResource = { enabled: true, name: '검사 자원', maxValue: 5, startValue: 5, regenPerSec: 0 };
    raw.characterSkills[slot] = { enabled: false, name: '미지원 효과', type: slot === 'passive' ? 'passive_stat' : 'attack_skill' };
    edit(raw.characterSkills[slot]);
    assert.throws(() => sanitizeCharacterSetup(raw), /비활성/);
  }
});
test('named disabled slots may retain source descriptions and harmless authoring metadata', () => {
  const raw = makeSetup();
  raw.characterSkills.q = { enabled: false, name: '원작 기술', sourceText: '미지원 변신은 생략', type: 'attack_skill',
    cooldownSec: 12, range: 4, firstFlat: [0], firstSkillAmpScale: 0 };
  const draft = sanitizeCharacterSetup(raw);
  assert.equal(draft.characterSkills.q.enabled, false); assert.equal(draft.characterSkills.q.sourceText, '미지원 변신은 생략');
  assert.deepEqual(draft.characterSkills.q.firstFlat, [0, 0, 0, 0, 0]); assert.ok(draft.warnings.some(value => value.includes('Q')));
});
test('skill costs cannot exceed the resource maximum', () => {
  const raw = makeSetup(); raw.uniqueResource = { enabled: true, name: '검사 자원', maxValue: 40, startValue: 0, regenPerSec: 2 };
  raw.characterSkills.e.resourceCost = 50; assert.throws(() => sanitizeCharacterSetup(raw));
  raw.characterSkills.e.resourceCost = 30; assert.equal(sanitizeCharacterSetup(raw).characterSkills.e.resourceCost, 30);
});
test('source addresses allow only the precise official-linked DB route or official sites', () => {
  const valid = 'https://game.naver.com/lounge/Eternal_Return/db/character/CH_670_1';
  assert.equal(sanitizeCharacterSetup(makeSetup(), { sources: [{ url: valid }] }).sources[0].url, valid);
  for (const url of ['http://127.0.0.1/', 'javascript:alert(1)',
    'https://game.naver.com/lounge/other/db/character/CH_670_1', `${valid}?redirect=private`,
    'https://user:pass@playeternalreturn.com/', 'https://playeternalreturn.com.evil.test/']) {
    assert.throws(() => sanitizeCharacterSetup(makeSetup(), { sources: [{ url }] }));
  }
});
test('source extraction reads actual QWER/T fields without copying HTML/media', () => {
  const row = { name: '검사 실험체', objectId: 'CH_AD_670_999991' }, detail = makeErDetail(row);
  detail.skill.push({ dataType: 'wskill', name: 'Q - 잘못된 무기', description: '무기 스킬' });
  const source = extractErSource(detail, row);
  assert.deepEqual(Object.keys(source.material.skills), ['passive', 'q', 'w', 'e', 'r']);
  assert.equal(source.material.description, '독립 \n자료');
  assert.equal(source.material.skills.q.description.includes('<'), false);
  assert.equal(source.sources.length, 2); assert.ok(source.warnings.some(text => text.includes('최신')));
  assert.equal(plainText('<script>hidden()</script>A &amp; B<br/>C'), 'A & B\nC');
});
test('source extraction rejects incomplete, mismatched and ambiguous data', () => {
  const row = { name: '검사 실험체', objectId: 'CH_AD_670_999991' };
  for (const edit of [d => { d.intro.name = '다른 실험체'; }, d => { d.skill.pop(); },
    d => { d.skill.push(d.skill[0]); }, d => { d.intro.gameId = 'other'; }]) {
    const detail = makeErDetail(row); edit(detail); assert.throws(() => extractErSource(detail, row));
  }
});
test('fixed-host source reader matches exact names and uses only an in-memory list cache', async () => {
  let clock = 0; const urls = [], row = { name: '검사 실험체', objectId: 'CH_AD_670_999991' };
  const reader = createErCharacterSourceReader({ now: () => clock, getJson: async url => {
    urls.push(url); assert.match(url, /^https:\/\/comm-api\.game\.naver\.com\/nng_main\/v1\//);
    if (url.includes('domain-name')) return 'GM_670';
    if (url.includes('dataType/character')) return { totalCount: 1, result: { character: [row] } };
    return makeErDetail(row);
  } });
  assert.equal((await reader('검사실험체')).material.name, row.name);
  await reader(row.name); assert.equal(urls.length, 4);
  await assert.rejects(() => reader('검사'), /ER_SOURCE_NOT_FOUND/); assert.equal(urls.length, 4);
  clock = 900001; await reader(row.name); assert.equal(urls.length, 7);
});
test('source reader rejects forged IDs without following an arbitrary detail URL', async () => {
  let calls = 0;
  const reader = createErCharacterSourceReader({ getJson: async () => ++calls === 1 ? 'GM_670'
    : { totalCount: 1, result: { character: [{ name: '검사', objectId: '../private' }] } } });
  await assert.rejects(() => reader('검사'), /ER_SOURCE_INVALID/); assert.equal(calls, 2);
});

async function invoke(options, body = { mode: 'custom', name: '검사 캐릭터' }) {
  const result = { status: 200, headers: {} };
  const res = { status(code) { result.status = code; return this; }, set(key, value) { result.headers[key] = value; return this; },
    json(data) { result.body = data; return this; } };
  await createCharacterSetupHandler({ env: { GOOGLE_API_KEY: 'test-only-not-a-real-key' },
    rateLimit: async () => ({ allowed: true }), generate: async () => ({ text: JSON.stringify(makeSetup()) }), ...options })({
    body, user: { id: 'test-user' } }, res);
  return result;
}
test('custom setup is a reviewable full draft and no Google Search tool is requested', async () => {
  let request;
  const result = await invoke({ generate: async input => { request = input; return { text: JSON.stringify(makeSetup()) }; } });
  assert.equal(result.status, 200); assert.equal(result.body.origin, 'ai-draft');
  assert.equal(request.config.responseMimeType, 'application/json'); assert.equal(request.config.tools, undefined);
  assert.equal(JSON.parse(request.contents).name, '검사 캐릭터');
  assert.ok(result.body.warnings.some(text => text.includes('자동 작성')));
});
test('ER source failure does not invoke a paid model or invent source facts', async () => {
  let generated = false;
  const result = await invoke({ loadErSource: async () => { throw new Error('missing'); }, generate: async () => { generated = true; } },
    { mode: 'er', name: '검사 실험체' });
  assert.equal(result.status, 422); assert.equal(generated, false); assert.equal(result.body.code, 'ER_SOURCE_UNAVAILABLE');
});
test('one-character ER name reaches the exact source reader and validated draft path', async () => {
  // Constructed source/response only: not live Yan stats, AI or account persistence.
  const row = { name: '얀', objectId: 'CH_AD_670_999991' };
  const source = extractErSource(makeErDetail(row), row), raw = makeSetup(row.name);
  for (const slot of Object.keys(source.material.skills)) raw.characterSkills[slot].name = source.material.skills[slot].name;
  const loadedNames = [], modelInputs = [];
  const result = await invoke({ loadErSource: async name => { loadedNames.push(name); return source; },
    generate: async input => { modelInputs.push(JSON.parse(input.contents)); return { text: JSON.stringify(raw) }; } },
    { mode: 'er', name: ' 얀 ' });
  assert.equal(result.status, 200); assert.equal(result.body.name, row.name); assert.equal(result.body.mode, 'er');
  assert.deepEqual(loadedNames, [row.name]); assert.equal(modelInputs.length, 1);
  assert.equal(modelInputs[0].name, row.name); assert.equal(modelInputs[0].erSource.name, row.name);
  assert.deepEqual(result.body.sources, source.sources);
});
test('blank ER names fail before source, rate-limit or model calls even with pasted text', async () => {
  let calls = 0;
  const unexpected = async () => { calls++; throw new Error('Invalid input must not reach external services'); };
  const result = await invoke({ rateLimit: unexpected, loadErSource: unexpected, generate: unexpected },
    { mode: 'er', name: ' \n ', text: '원작 설명' });
  assert.equal(result.status, 400); assert.equal(result.body.code, 'INVALID_SETUP_INPUT'); assert.equal(calls, 0);
});
test('ER source is separate data and model-provided citation URLs are ignored', async () => {
  let request; const source = extractErSource(makeErDetail(), { name: '검사 실험체', objectId: 'CH_AD_670_999991' });
  const raw = makeSetup('검사 실험체');
  for (const slot of Object.keys(source.material.skills)) raw.characterSkills[slot].name = source.material.skills[slot].name;
  const result = await invoke({ loadErSource: async () => source, generate: async input => {
    request = input; return { text: JSON.stringify({ ...raw, sources: [{ url: 'https://evil.test' }] }) };
  } }, { mode: 'er', name: '검사 실험체' });
  assert.equal(result.status, 200); assert.deepEqual(result.body.sources, source.sources);
  assert.equal(JSON.parse(request.contents).erSource.name, '검사 실험체'); assert.equal(request.config.tools, undefined);
});
test('ER invented skill identity or unsupported weapon cannot borrow real source citations', async () => {
  const source = extractErSource(makeErDetail(), { name: '검사 실험체', objectId: 'CH_AD_670_999991' });
  for (const edit of [raw => { raw.characterSkills.q.name = '새로 지은 기술'; }, raw => { raw.erWeapons = ['권총']; }]) {
    const raw = makeSetup('검사 실험체');
    for (const slot of Object.keys(source.material.skills)) raw.characterSkills[slot].name = source.material.skills[slot].name;
    edit(raw);
    const result = await invoke({ loadErSource: async () => source, generate: async () => ({ text: JSON.stringify(raw) }) },
      { mode: 'er', name: '검사 실험체' });
    assert.equal(result.status, 502); assert.equal(result.body.code, 'INVALID_SETUP_DRAFT');
  }
});
test('ER wrong-name AI response is rejected', async () => {
  const source = extractErSource(makeErDetail(), { name: '검사 실험체', objectId: 'CH_AD_670_999991' });
  const result = await invoke({ loadErSource: async () => source }, { mode: 'er', name: '검사 실험체' });
  assert.equal(result.status, 502); assert.equal(result.body.code, 'INVALID_SETUP_DRAFT');
});
test('pasted ER text is not represented as an automatically verified official source', async () => {
  const result = await invoke({ loadErSource: async () => { throw new Error('must not fetch'); } },
    { mode: 'er', name: '검사 실험체', text: '사용자 설명' });
  assert.equal(result.status, 200); assert.deepEqual(result.body.sources, []);
  assert.ok(result.body.warnings.some(text => text.includes('붙여넣은')));
});
test('missing AI configuration, rate limiting and service failure remain friendly and atomic', async () => {
  const missing = await invoke({ env: {} }); assert.equal(missing.status, 503); assert.equal(missing.body.code, 'AI_NOT_CONFIGURED');
  const limited = await invoke({ rateLimit: async ({ scope, subject }) => {
    assert.equal(scope, 'ai:analyze'); assert.equal(subject, 'user:test-user'); return { allowed: false, retryAfterSec: 42 };
  } }); assert.equal(limited.status, 429); assert.equal(limited.headers['Retry-After'], '42');
  const failure = await invoke({ generate: async () => { throw new Error('secret provider credential'); } });
  assert.equal(failure.status, 502); assert.equal(JSON.stringify(failure).includes('secret'), false);
});
test('invalid provider JSON or unsupported effects cannot escape the draft validator', async () => {
  for (const raw of ['not JSON', JSON.stringify({ ...makeSetup(), characterSkills: {} })]) {
    const result = await invoke({ generate: async () => ({ text: raw }) });
    assert.equal(result.status, 502); assert.equal(result.body.code, 'INVALID_SETUP_DRAFT');
  }
});
test('the real mounted automatic-setup endpoint requires authentication before using AI', async () => {
  const { app } = require('../index');
  const server = app.listen(0, '127.0.0.1');
  try {
    if (!server.listening) await new Promise(resolve => server.once('listening', resolve));
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/analyze/character-setup`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'custom', name: '독립 검사' }),
    });
    assert.equal(response.status, 401);
    const body = await response.json(); assert.equal(body.code, 'AUTH_REQUIRED');
  } finally { await new Promise(resolve => server.close(resolve)); }
});
