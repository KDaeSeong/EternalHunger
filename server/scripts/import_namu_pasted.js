// server/scripts/import_namu_pasted.js
// 나무위키(유저가 붙여넣은 위키 마크업)에서 아이템/조합식을 추출해 MongoDB(Item)에 업서트

const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const Item = require('../models/Item');
const { normalizeWeaponType } = require('../config/item_taxonomy');

const rarityToTier = {
  '일반': { rarity: 'common', tier: 1 },
  '고급': { rarity: 'uncommon', tier: 2 },
  '희귀': { rarity: 'rare', tier: 3 },
  '영웅': { rarity: 'hero', tier: 4 },
  '전설': { rarity: 'legendary', tier: 5 },
  '초월': { rarity: 'transcendent', tier: 6 }
};

const fixedValues = {
  '운석': 200,
  '생명의 나무': 200,
  '미스릴': 200,
  '포스 코어': 350,
  'VF 혈액 샘플': 500
};

// 나무위키 분류(한글) -> 프로젝트 내부 canonical 무기군(한글) 매핑
// - coverage / goalLoadout / 시뮬 장비 선호 타입과 같은 기준을 사용한다.
const weaponCategoryMap = {
  '돌소총': '돌격소총',
  '돌격소총': '돌격소총',
  '기관단총': '돌격소총', // 현재 프로젝트 canonical 20종 기준 폴백
  '저격총': '저격총',
  '권총': '권총',
  '레이피어': '레이피어',
  '쌍절곤': '쌍절곤',
  '쌍검': '쌍검',
  '양손검': '검',
  '단검': '단검',
  '도끼': '도끼',
  '창': '창',
  '글러브': '장갑',
  '장갑': '장갑',
  '톤파': '톤파',
  '방망이': '방망이',
  '망치': '망치',
  '채찍': '채찍',
  '투척': '투척',
  '암기': '암기',
  '활': '활',
  '석궁': '석궁',
  '아르카나': '아르카나',
  '검': '검'
};

// 나무위키 분류(한글) -> 프로젝트 내부 장비 슬롯 매핑
// - 현재 시뮬 슬롯은 head / clothes / arm / shoes 4종만 사용한다.
const armorSlotMap = {
  '머리': 'head',
  '옷': 'clothes',
  '팔•장식': 'arm',
  '팔/장식': 'arm',
  '팔': 'arm',
  '장식': 'arm',
  '다리': 'shoes',
  '신발': 'shoes',
  '발': 'shoes'
};

function splitCsvLike(raw) {
  const out = [];
  let cur = '';
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    if (ch === '\\' && raw[i + 1] === ',') { cur += ','; i++; continue; }
    if (ch === ',') { if (cur.trim()) out.push(cur.trim()); cur = ''; continue; }
    cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

function parseArgs(includeBlock) {
  const l = includeBlock.indexOf(',');
  const r = includeBlock.lastIndexOf(')');
  if (l < 0 || r < 0) return {};
  const raw = includeBlock.slice(l + 1, r).replace(/\n/g, ' ').replace(/\s+/g, ' ');
  const args = {};
  for (const tok of splitCsvLike(raw)) {
    const eq = tok.indexOf('=');
    if (eq < 0) continue;
    const k = tok.slice(0, eq).trim();
    const v = tok.slice(eq + 1).trim();
    if (k) args[k] = v;
  }
  return args;
}

function toNum(v) {
  if (typeof v !== 'string') return 0;
  const m = v.replace(/%/g, '').match(/-?\d+(?:\.\d+)?/);
  return m ? Number(m[0]) : 0;
}

function normalizeName(v) {
  return String(v || '')
    .replace(/\\,/g, ',')
    .replace(/\s*\)+\s*$/g, '')
    .trim();
}

function stripWikiText(v) {
  return String(v || '')
    .replace(/\\,/g, ',')
    .replace(/\[\[|\]\]/g, '')
    .replace(/<br\s*\/?\s*>/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const AREA_ALIAS_MAP = new Map([
  ['harbor', '항구'], ['dock', '항구'], ['port', '항구'], ['부두', '항구'], ['항만', '항구'],
  ['warehouse', '창고'], ['storage', '창고'],
  ['pond', '연못'],
  ['stream', '개울'], ['river', '개울'],
  ['sandybeach', '모래사장'], ['beach', '모래사장'], ['sand beach', '모래사장'],
  ['uptown', '고급 주택가'], ['residential', '고급 주택가'], ['high-end residential area', '고급 주택가'],
  ['alley', '골목길'],
  ['gasstation', '주유소'], ['gas station', '주유소'],
  ['hotel', '호텔'],
  ['policestation', '경찰서'], ['police station', '경찰서'],
  ['firestation', '소방서'], ['fire station', '소방서'],
  ['hospital', '병원'],
  ['temple', '절'],
  ['archery', '양궁장'], ['archery range', '양궁장'],
  ['cemetery', '묘지'], ['graveyard', '묘지'],
  ['forest', '숲'],
  ['factory', '공장'],
  ['church', '성당'], ['cathedral', '성당'],
  ['school', '학교'], ['academy', '학교'],
  ['laboratory', '연구소'], ['lab', '연구소'], ['research center', '연구소'],
]);

function normalizeFoundPlaceToken(raw) {
  let s = stripWikiText(raw)
    .replace(/^Area\/Name\//i, '')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/[•·ㆍ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!s) return '';

  const compact = s.toLowerCase().replace(/[^a-z가-힣]/g, '');
  const lower = s.toLowerCase();
  if (AREA_ALIAS_MAP.has(lower)) return AREA_ALIAS_MAP.get(lower);
  if (AREA_ALIAS_MAP.has(compact)) return AREA_ALIAS_MAP.get(compact);

  if (/항구|부두|항만/.test(s)) return '항구';
  if (/창고/.test(s)) return '창고';
  if (/연못/.test(s)) return '연못';
  if (/개울|시내|하천/.test(s)) return '개울';
  if (/모래사장|해변/.test(s)) return '모래사장';
  if (/고급\s*주택가|번화가/.test(s)) return '고급 주택가';
  if (/골목길|골목/.test(s)) return '골목길';
  if (/주유소/.test(s)) return '주유소';
  if (/호텔/.test(s)) return '호텔';
  if (/경찰서/.test(s)) return '경찰서';
  if (/소방서/.test(s)) return '소방서';
  if (/병원/.test(s)) return '병원';
  if (/절/.test(s)) return '절';
  if (/양궁장/.test(s)) return '양궁장';
  if (/묘지/.test(s)) return '묘지';
  if (/숲/.test(s)) return '숲';
  if (/공장/.test(s)) return '공장';
  if (/성당|교회/.test(s)) return '성당';
  if (/학교/.test(s)) return '학교';
  if (/연구소|연구센터|실험실/.test(s)) return '연구소';
  return s;
}

function parseFoundPlaces(raw) {
  const t = stripWikiText(raw);
  if (!t) return [];
  return [...new Set(
    t
      .split(/[,/|]|\s+-\s+|\s+→\s+|\s+>\s+|\s*\n+\s*/)
      .map((x) => normalizeFoundPlaceToken(x))
      .filter(Boolean)
  )];
}

function parseCrateTypesFromText(raw) {
  const t = stripWikiText(raw);
  if (!t) return [];
  const out = new Set();
  // ✅ 시뮬 내부 상자 타입 키(3종)
  // - food: 음식 상자(일반 파밍)
  // - legendary_material: 전설 재료 상자(운석/생나/미스릴/포코)
  // - transcend_pick: 초월 장비 선택 상자
  const add = (k) => { if (k) out.add(String(k).toLowerCase()); };
  if (/(음식\s*상자|식량\s*상자)/.test(t)) add('food');
  if (/(전설\s*재료\s*상자|전설\s*상자)/.test(t)) add('legendary_material');
  if (/(초월\s*장비\s*선택\s*상자|초월\s*상자)/.test(t)) add('transcend_pick');
  // 기타 표현(무기 보급 상자 등)은 현재 3종 체계에 직접 매핑되지 않으므로 보존하지 않음
  return [...out];
}

function buildExternalId(prefix, name) {
  return `${prefix}:${name}`;
}

function detectEquipMeta(categoryRaw) {
  const category = normalizeName(categoryRaw);
  if (!category) return { type: '기타', equipSlot: '', weaponType: '', tags: ['namu'] };

  for (const [k, v] of Object.entries(weaponCategoryMap)) {
    if (category.includes(k)) {
      const weaponType = normalizeWeaponType(v) || v;
      return { type: '무기', equipSlot: 'weapon', weaponType, tags: ['namu', weaponType] };
    }
  }
  for (const [k, v] of Object.entries(armorSlotMap)) {
    if (category.includes(k)) {
      return { type: '방어구', equipSlot: v, weaponType: '', tags: ['namu', v] };
    }
  }
  return { type: '기타', equipSlot: '', weaponType: '', tags: ['namu'] };
}

function readSourceText(p) {
  const st = fs.statSync(p);
  if (st.isDirectory()) {
    const files = fs.readdirSync(p)
      .filter(f => f.toLowerCase().endsWith('.code'))
      .map(f => path.join(p, f));
    return files.map(fp => fs.readFileSync(fp, 'utf-8')).join('\n\n');
  }
  return fs.readFileSync(p, 'utf-8');
}

function extractItemsAndRecipes(text) {
  // ✅ 본문 아이템 템플릿만 추출(상위아이템 표의 아이템/희귀/전설 템플릿은 제외)
  // - 상위 아이템 표 힌트를 얻기 위해 "아이템 블록 단위"로 구간을 잘라 분석
  const itemBlocks = [];
  const itemRe = /\[include\(틀:이터널 리턴\/아이템\s*,[\s\S]*?\)\]/g;
  let im;
  while ((im = itemRe.exec(text))) {
    itemBlocks.push({ blk: im[0], start: im.index, end: itemRe.lastIndex });
  }
  const recipeBlocks = text.match(/\[include\(틀:이터널 리턴\/제작 트리\s*,[\s\S]*?\)\]/g) || [];

  const extractUpperItemNames = (seg) => {
    const upperBlocks = seg.match(/\[include\(틀:이터널 리턴\/아이템\/[\s\S]*?\)\]/g) || [];
    const out = [];
    for (const ub of upperBlocks) {
      const a = parseArgs(ub);
      const n = normalizeName(a['아이템명']);
      if (n) out.push(n);
    }
    return [...new Set(out)];
  };

  const items = [];
  for (let idx = 0; idx < itemBlocks.length; idx++) {
    const blk = itemBlocks[idx].blk;
    const a = parseArgs(blk);
    const name = normalizeName(a['아이템명']);
    if (!name) continue;
    const rt = rarityToTier[a['등급']] || { rarity: 'common', tier: 1 };
    const meta = detectEquipMeta(a['분류']);

    // ✅ 스폰/획득 힌트(존 이름/지역명 문자열 그대로 저장)
    const spawnZones = parseFoundPlaces(a['발견장소'] || a['발견 장소'] || '');
    // ✅ 상자 종류 힌트(드랍 테이블/상자 종류가 명시된 경우)
    const spawnCrateTypes = parseCrateTypesFromText(
      a['드랍상자'] || a['드랍 상자'] || a['상자'] || a['상자종류'] || a['상자 종류'] || a['발견장소'] || a['발견 장소'] || ''
    );
    const droneCreditsCost = toNum(a['원격드론호출크레딧'] || a['원격 드론 호출 크레딧'] || '');

    const seg = text.slice(itemBlocks[idx].end, itemBlocks[idx + 1] ? itemBlocks[idx + 1].start : text.length);
    const upperItemNames = extractUpperItemNames(seg).filter((n) => n && n !== name);

    items.push({
      name,
      rarity: rt.rarity,
      tier: rt.tier,
      type: meta.type,
      equipSlot: meta.equipSlot,
      weaponType: meta.weaponType,
      tags: meta.tags,
      spawnZones,
      spawnCrateTypes,
      droneCreditsCost,
      upperItemNames,
      stats: {
        atk: toNum(a['공격력']),
        def: toNum(a['방어력']),
        skillAmp: toNum(a['스킬 증폭']),
        atkSpeed: toNum(a['공격 속도']),
        cdr: toNum(a['쿨다운 감소']),
        lifesteal: toNum(a['모든 피해 흡혈'])
      }
    });
  }

  const recipes = [];
  for (const blk of recipeBlocks) {
    const a = parseArgs(blk);
    const result = normalizeName(a['완성']);
    if (!result) continue;
    const ingredients = [];
    for (let i = 1; i <= 6; i++) {
      const k = `제작${i}`;
      if (a[k]) ingredients.push(normalizeName(a[k]));
    }
    if (ingredients.length >= 1) recipes.push({ result, ingredients });
  }

  return { items, recipes };
}

async function upsertItemByName(name, patch) {
  const externalId = patch.externalId || buildExternalId('namu', name);
  // SSOT 키: 외부에서 가져온 아이템은 externalId를 그대로 itemKey로 사용
  const itemKey = patch.itemKey || externalId;

  const doc = await Item.findOneAndUpdate(
    { $or: [{ itemKey }, { externalId }] },
    {
      $setOnInsert: {
        itemKey,
        externalId,
        name,
        createdAt: new Date(),
        lockedByAdmin: true,
        source: 'namu'
      },
      $set: {
        itemKey,
        externalId,
        name,
        ...patch
      }
    },
    { upsert: true, new: true }
  );
  return doc;
}

async function ensureMaterial(name) {
  const val = fixedValues[name] ?? 0;
  return upsertItemByName(name, {
    externalId: buildExternalId('namu:material', name),
    type: '재료',
    stackMax: 3,
    value: val,
    baseCreditValue: val,
    tags: ['namu', 'material']
  });
}

async function runParse(filePath) {
  const text = readSourceText(filePath);
  const { items, recipes } = extractItemsAndRecipes(text);
  const uniqItems = [...new Map(items.map(i => [i.name, i])).values()];
  const uniqRecipes = [...new Map(recipes.map(r => [r.result, r])).values()];
  console.log(JSON.stringify({ items: uniqItems, recipes: uniqRecipes }, null, 2));
}

async function runImport(filePath) {
  if (!process.env.MONGO_URI) throw new Error('MONGO_URI가 필요합니다(.env)');
  await mongoose.connect(process.env.MONGO_URI);

  const text = readSourceText(filePath);
  const { items, recipes } = extractItemsAndRecipes(text);

  const byName = new Map();
  for (const it of items) {
    const bucket = it.weaponType || it.equipSlot || 'item';
    const externalId = buildExternalId(`namu:${bucket}`, it.name);
    const doc = await upsertItemByName(it.name, {
      externalId,
      type: it.type,
      rarity: it.rarity,
      tier: it.tier,
      stackMax: it.type === '재료' ? 3 : 1,
      tags: it.tags,
      stats: it.stats,
      equipSlot: it.equipSlot,
      weaponType: it.weaponType,
      spawnZones: Array.isArray(it.spawnZones) ? it.spawnZones : [],
      spawnCrateTypes: Array.isArray(it.spawnCrateTypes) ? it.spawnCrateTypes : [],
      droneCreditsCost: Math.max(0, Number(it.droneCreditsCost || 0))
    });
    byName.set(it.name, doc);
  }

  // ✅ "상위 아이템" 표 힌트 연결(대체 목표/추천용)
  for (const it of items) {
    if (!Array.isArray(it.upperItemNames) || it.upperItemNames.length === 0) continue;
    const baseDoc = byName.get(it.name);
    if (!baseDoc) continue;
    const keys = [];
    for (const upName of it.upperItemNames) {
      let upDoc = byName.get(upName);
      if (!upDoc) {
        upDoc = await upsertItemByName(upName, {
          externalId: buildExternalId('namu:hint', upName),
          type: '기타',
          tags: ['namu', 'hint']
        });
        byName.set(upName, upDoc);
      }
      if (upDoc && upDoc.itemKey) keys.push(String(upDoc.itemKey));
    }
    baseDoc.upgradeItemKeys = [...new Set(keys)];
    await baseDoc.save();
  }

  for (const r of recipes) {
    const resultDoc = byName.get(r.result) || await upsertItemByName(r.result, {
      externalId: buildExternalId('namu:item', r.result),
      type: '기타',
      equipSlot: '',
      weaponType: '',
      tags: ['namu']
    });

    const ingDocs = [];
    for (const ingName of r.ingredients) {
      let ingDoc = byName.get(ingName);
      if (!ingDoc) ingDoc = await ensureMaterial(ingName);
      ingDocs.push(ingDoc);
    }
    resultDoc.recipe = {
      ingredients: ingDocs.map(d => ({ itemId: d._id, qty: 1 })),
      creditsCost: 0,
      resultQty: 1
    };
    await resultDoc.save();
  }

  await mongoose.disconnect();
  console.log(`OK: items=${items.length}, recipes=${recipes.length}`);
}

async function main() {
  const [mode, filePath] = process.argv.slice(2);
  const p = path.resolve(process.cwd(), filePath || '');
  if (!mode || !filePath) {
    console.log('Usage: node scripts/import_namu_pasted.js <parse|import> <file-or-dir>');
    process.exit(0);
  }
  if (mode === 'parse') return runParse(p);
  if (mode === 'import') return runImport(p);
  throw new Error('mode는 parse 또는 import');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
