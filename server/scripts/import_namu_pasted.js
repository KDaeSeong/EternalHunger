// server/scripts/import_namu_pasted.js
// 나무위키(유저가 붙여넣은 위키 마크업)에서 아이템/조합식을 추출해 MongoDB(Item)에 업서트

const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const Item = require('../models/Item');
const ErMeta = require('../models/ErMeta');
const { EXPECT_WEAPON_TYPES, normalizeWeaponType } = require('../config/item_taxonomy');

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
  '돌격 소총': '돌격소총',
  '기관단총': '돌격소총', // 현재 프로젝트 canonical 20종 기준 폴백
  '저격총': '저격총',
  '권총': '권총',
  '레이피어': '레이피어',
  '쌍절곤': '쌍절곤',
  '쌍검': '쌍검',
  '양손검': '양손검',
  '단검': '단검',
  '도끼': '도끼',
  '창': '창',
  '글러브': '글러브',
  '장갑': '글러브',
  '톤파': '톤파',
  '방망이': '방망이',
  '망치': '망치',
  '채찍': '채찍',
  '투척': '투척',
  '암기': '암기',
  '활': '활',
  '석궁': '석궁',
  '아르카나': '아르카나',
  '기타': '기타',
  '카메라': '카메라',
  '검': '양손검'
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

const namuKindToNamespace = {
  guide: 'namuGuide',
  map: 'namuMap',
  subjectIndex: 'namuSubjectIndex',
  weaponSkill: 'namuWeaponSkill',
  tacticalSkill: 'namuTacticalSkill',
  trait: 'namuTrait',
  item: 'namuItemPage',
  unknown: 'namuPage'
};

const guideConceptTerms = [
  '금지 구역', '제한 구역', '하이퍼루프', '키오스크', '드론', '크레딧',
  '야생동물', '알파', '오메가', '위클라인', '운석', '생명의 나무',
  '미스릴', '포스 코어', 'VF 혈액 샘플', '전술 스킬', '무기 스킬',
  '특성', '루트', '숙련도', '보안 콘솔'
];

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
  if (!category) return { type: '기타', equipSlot: '', weaponType: '', itemSubType: '', tags: ['namu'] };

  for (const [k, v] of Object.entries(weaponCategoryMap)) {
    if (category.includes(k)) {
      const weaponType = normalizeWeaponType(v) || v;
      return { type: '무기', equipSlot: 'weapon', weaponType, itemSubType: weaponType, tags: ['namu', weaponType] };
    }
  }
  for (const [k, v] of Object.entries(armorSlotMap)) {
    if (category.includes(k)) {
      return { type: '방어구', equipSlot: v, weaponType: '', itemSubType: category, tags: ['namu', v, category] };
    }
  }
  if (/재료/.test(category)) {
    return { type: '재료', equipSlot: '', weaponType: '', itemSubType: category, tags: ['namu', 'material', category] };
  }
  if (/음식|음료|소비|강화|설치|전환|특수|현상금|가젯/.test(category)) {
    return { type: '소모품', equipSlot: '', weaponType: '', itemSubType: category, tags: ['namu', 'consumable', category] };
  }
  return { type: '기타', equipSlot: '', weaponType: '', itemSubType: category, tags: ['namu', category] };
}

function readSourceText(p) {
  return combineItemSourceText(readSourceEntries(p));
}

function combineItemSourceText(entries) {
  return (entries || []).map((entry) => stripInactiveNamuSections(entry.text)).join('\n\n');
}

function readSourceEntries(p) {
  const st = fs.statSync(p);
  if (st.isDirectory()) {
    const files = fs.readdirSync(p)
      .filter(f => /\.(code|txt|md|wiki)$/i.test(f))
      .sort((a, b) => a.localeCompare(b, 'ko'))
      .map(f => path.join(p, f));
    return files.map((fp) => parseSourceEntry(fp, fs.readFileSync(fp, 'utf-8')));
  }
  return [parseSourceEntry(p, fs.readFileSync(p, 'utf-8'))];
}

function parseSourceEntry(filePath, rawText) {
  const meta = {};
  const lines = String(rawText || '').split(/\r?\n/);
  const body = [];
  for (const line of lines) {
    const match = line.match(/^#\s*@namu-source\s+([A-Za-z0-9_-]+)=(.*)$/);
    if (match) {
      meta[match[1]] = match[2].trim();
      continue;
    }
    body.push(line);
  }
  return {
    filePath,
    meta,
    text: body.join('\n').replace(/^\uFEFF/, '')
  };
}

function looksLikeBlockedHtml(text) {
  const raw = String(text || '');
  return /<!doctype html>|<html\b|challenge-platform|__CF\$cv\$params|id="app-loading"/i.test(raw)
    && !/\[include\(틀:|^={2,}/m.test(raw);
}

function basenameSlug(filePath) {
  return path.basename(filePath || '', path.extname(filePath || '')) || 'namu_page';
}

function inferNamuKind(entry) {
  if (entry?.meta?.kind) return entry.meta.kind;
  const file = basenameSlug(entry?.filePath).toLowerCase();
  const text = String(entry?.text || '');
  if (/weapon[_-]?skills?|무기\s*스킬/.test(file) || /무기\s*스킬/.test(text.slice(0, 1000))) return 'weaponSkill';
  if (/tactical[_-]?skills?|전술\s*스킬/.test(file) || /전술\s*스킬/.test(text.slice(0, 1000))) return 'tacticalSkill';
  if (/subjects?|실험체|캐릭터/.test(file) || looksLikeSubjectIndexText(text)) return 'subjectIndex';
  if (/lumia|island|map|루미아|섬/.test(file) || /루미아\s*섬/.test(text.slice(0, 1000))) return 'map';
  if (/guide|가이드/.test(file) || /가이드/.test(text.slice(0, 1000))) return 'guide';
  if (/\[include\(틀:이터널 리턴\/아이템/.test(text)) return 'item';
  if (/traits?|특성/.test(file) || /특성/.test(text.slice(0, 1000))) return 'trait';
  return 'unknown';
}

function looksLikeSubjectIndexText(text) {
  const t = String(text || '');
  const head = t.slice(0, 2500);
  return /\[\[분류:이터널 리턴\/실험체\]\]/.test(head)
    || /\[include\(틀:이터널 리턴\/실험체\)\]/.test(head)
    || /==\s*실험체 목록\s*==/.test(t)
    || /템플릿:이터널 리턴\/실험체/.test(t);
}

function extractHeadings(text) {
  const headings = [];
  const re = /^(={2,6})\s*([^=\n]{1,80}?)\s*\1\s*$/gm;
  let match;
  while ((match = re.exec(String(text || '')))) {
    const title = cleanWikiValue(match[2]);
    if (!title || /^목차$|^개요$|^둘러보기$/.test(title)) continue;
    headings.push({ level: match[1].length, title, index: match.index });
  }
  return headings;
}

function extractTermHits(text, terms) {
  const raw = cleanWikiValue(text);
  return uniqueStrings((Array.isArray(terms) ? terms : []).filter((term) => raw.includes(term)));
}

function extractWeaponTypesFromAnyText(text) {
  const raw = cleanWikiValue(text);
  return EXPECT_WEAPON_TYPES.filter((weaponType) => raw.includes(weaponType));
}

function extractZoneNamesFromText(text) {
  const zoneNames = uniqueStrings([...AREA_ALIAS_MAP.values()]);
  return extractTermHits(text, zoneNames);
}

function normalizeSubjectCode(value, filePath = '') {
  const base = String(value || path.basename(filePath || '', path.extname(filePath || '')) || '')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[|[\]{}'"`]/g, ' ')
    .replace(/[•·ㆍ・]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return base
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9가-힣_]/g, '')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function uniqueStrings(list) {
  return [...new Set(
    (Array.isArray(list) ? list : [])
      .map((x) => String(x || '').trim())
      .filter(Boolean)
  )];
}

function extractIncludesByTemplate(text, templateNames) {
  const names = Array.isArray(templateNames) ? templateNames : [templateNames];
  const escaped = names.map((name) => String(name).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  const re = new RegExp(`\\[include\\(틀:이터널 리턴\\/(?:${escaped})\\s*,[\\s\\S]*?\\)\\]`, 'g');
  return String(text || '').match(re) || [];
}

function cleanWikiValue(value) {
  return String(value || '')
    .replace(/\\,/g, ',')
    .replace(/\[\[([^|\]]+)\|([^\]]+)\]\]/g, '$2')
    .replace(/\[\[([^\]]+)\]\]/g, '$1')
    .replace(/<br\s*\/?\s*>/gi, ' ')
    .replace(/\{\{\{[#@!]?[^ ]*\s*/g, '')
    .replace(/\}\}\}/g, '')
    .replace(/'''|''|~~/g, '')
    .replace(/\([^)]*이터널 리턴[^)]*\)/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[|[\]]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function splitWikiList(value) {
  return cleanWikiValue(value)
    .split(/[,/|·•ㆍ・]|<br\s*\/?\s*>|\s+및\s+|\s+또는\s+|\s+or\s+/i)
    .map((x) => cleanWikiValue(x))
    .filter(Boolean);
}

function pickArg(args, keys) {
  for (const key of keys) {
    const value = args?.[key];
    if (value !== undefined && value !== null && String(value).trim()) return value;
  }
  return '';
}

function extractInlineArgValue(includeBlock, keys) {
  const source = String(includeBlock || '');
  if (!source) return '';
  const keyRe = keys.map((x) => String(x).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  const re = new RegExp(`(?:^|[,\\n])\\s*(?:${keyRe})\\s*=\\s*([\\s\\S]*?)(?=\\s*,\\s*[^,=\\n]{1,30}\\s*=|\\s*\\)\\]$)`, 'i');
  const match = source.match(re);
  return match?.[1] ? cleanWikiValue(match[1]) : '';
}

function extractLabelValues(text, labels) {
  const out = [];
  const labelRe = labels.map((x) => String(x).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  const rows = String(text || '').split(/\r?\n/);
  const tableRe = new RegExp(`\\|\\|[^\\n]*?(?:${labelRe})[^\\n]*?\\|\\|\\s*([^|\\n]+)`, 'i');
  const kvRe = new RegExp(`(?:^|[\\s*|])(?:${labelRe})\\s*[:=]\\s*([^\\n|]+)`, 'i');
  for (const row of rows) {
    if (row.includes('[include(')) continue;
    const tableMatch = row.match(tableRe);
    if (tableMatch?.[1]) out.push(tableMatch[1]);
    const kvMatch = row.match(kvRe);
    if (kvMatch?.[1]) out.push(kvMatch[1]);
  }
  return out.map(cleanWikiValue).filter(Boolean);
}

function extractWeaponTypesFromSubjectText(text, args = {}, includeBlock = '') {
  const weaponFieldKeys = [
    '사용 무기', '사용무기', '무기', '무기군', '무기 타입', '무기타입',
    '장비', 'equipment', 'weapon', 'weapons', 'Weapon', 'Weapons'
  ];
  const raw = [
    extractInlineArgValue(includeBlock, weaponFieldKeys),
    pickArg(args, weaponFieldKeys),
    ...extractLabelValues(text, ['사용 무기', '사용무기', '무기 타입', '무기타입', '무기군'])
  ].join(', ');

  const candidates = splitWikiList(raw);
  const weapons = [];
  for (const token of candidates) {
    const normalized = normalizeWeaponType(token.replace(/^장비\//, ''));
    if (EXPECT_WEAPON_TYPES.includes(normalized)) weapons.push(normalized);
    for (const type of EXPECT_WEAPON_TYPES) {
      if (token.includes(type)) weapons.push(type);
    }
  }
  return uniqueStrings(weapons);
}

function inferRoleHints(text, weaponTypes) {
  const t = cleanWikiValue(text);
  const hints = [];
  const addIf = (regex, tag) => { if (regex.test(t)) hints.push(tag); };
  addIf(/원거리|사거리|포킹|저격|사격/, 'ranged');
  addIf(/근거리|접근|근접/, 'melee');
  addIf(/암살|암살자|순간\s*폭딜|버스트/, 'assassin');
  addIf(/브루저|전사|난전|교전\s*지속/, 'bruiser');
  addIf(/탱커|방어|버티|내구|보호막/, 'tank');
  addIf(/서포터|지원|보조|회복|치유/, 'support');
  addIf(/스킬\s*증폭|스증|마법|스킬\s*딜/, 'skill_amp');
  addIf(/평타|기본\s*공격|공격\s*속도|공속/, 'basic_attack');
  addIf(/기동|이동기|추격|도주|진입/, 'mobility');
  addIf(/야생동물|사냥|파밍|오브젝트/, 'objective');

  if (weaponTypes.some((w) => ['권총', '돌격소총', '저격총', '아르카나', '투척', '암기', '활', '석궁', '기타', '카메라'].includes(w))) {
    hints.push('ranged');
  }
  if (weaponTypes.some((w) => ['글러브', '톤파', '쌍절곤', '양손검', '쌍검', '망치', '방망이', '도끼', '단검', '창', '레이피어', '채찍'].includes(w))) {
    hints.push('melee');
  }
  return uniqueStrings(hints).slice(0, 16);
}

function extractSubjectName(text, args = {}, filePath = '') {
  const fromArgs = cleanWikiValue(pickArg(args, ['이름', '실험체명', '캐릭터명', 'name', 'Name']));
  if (fromArgs) return fromArgs;

  const titleMatch = String(text || '').match(/^={2,4}\s*([^=\n]{1,40}?)\s*={2,4}/m);
  if (titleMatch?.[1]) {
    const title = cleanWikiValue(titleMatch[1]).replace(/^개요$/, '').trim();
    if (title && !/아이템|목록|스킬/.test(title)) return title;
  }
  return cleanWikiValue(path.basename(filePath || '', path.extname(filePath || '')));
}

function looksLikeSubjectPage(text, args, weaponTypes) {
  const t = String(text || '');
  if (looksLikeSubjectIndexText(t)) return false;
  if (Object.keys(args || {}).length > 0) return true;
  if (/이터널 리턴\/실험체|이터널 리턴\/캐릭터|실험체\s*정보|캐릭터\s*정보|사용\s*무기|사용무기/.test(t)) return true;
  return weaponTypes.length > 0 && /스킬|패시브|특성|전술\s*스킬|캐릭터|실험체/.test(t) && !/아이템\s*목록/.test(t);
}

function extractSubjectFactsFromText(text, filePath = '') {
  const includes = extractIncludesByTemplate(text, ['실험체', '캐릭터']);
  const includeBlock = includes[0] || '';
  const args = includeBlock ? parseArgs(includeBlock) : {};
  const weaponTypes = extractWeaponTypesFromSubjectText(text, args, includeBlock);
  if (!looksLikeSubjectPage(text, args, weaponTypes)) return null;

  const name = extractSubjectName(text, args, filePath);
  if (!name) return null;

  const aliases = uniqueStrings([
    ...splitWikiList(pickArg(args, ['별칭', '별명', '영문명', '영문 이름', '이명', 'alias', 'aliases'])),
    ...extractLabelValues(text, ['영문명', '별칭', '별명', '이명'])
  ]).filter((x) => x !== name);

  const tacticalSkill = cleanWikiValue(
    pickArg(args, ['전술 스킬', '전술스킬', '추천 전술 스킬', '추천전술스킬']) ||
    extractLabelValues(text, ['전술 스킬', '전술스킬', '추천 전술 스킬', '추천전술스킬'])[0] ||
    ''
  );
  const trait = cleanWikiValue(
    pickArg(args, ['특성', '추천 특성', '주 특성', '루트 특성']) ||
    extractLabelValues(text, ['추천 특성', '주 특성', '특성'])[0] ||
    ''
  );
  const roleHints = inferRoleHints(text, weaponTypes);
  const primaryWeapon = weaponTypes[0] || '';
  const code = normalizeSubjectCode(name, filePath);

  return {
    code,
    name,
    localizedName: name,
    aliases,
    primaryWeapon,
    weaponTypes,
    roleHints,
    tacticalSkill,
    trait,
    tags: uniqueStrings(['namu', 'subject', ...roleHints, ...weaponTypes]),
    sourceFile: path.basename(filePath || ''),
    confidence: Number(((weaponTypes.length ? 0.55 : 0.25) + (Object.keys(args).length ? 0.25 : 0) + (roleHints.length ? 0.1 : 0)).toFixed(2))
  };
}

function extractSubjectsFromEntries(entries) {
  const subjects = [];
  for (const entry of entries || []) {
    const subject = extractSubjectFactsFromText(entry.text, entry.filePath);
    if (subject) subjects.push(subject);
  }
  return [...new Map(subjects.map((subject) => [subject.code || subject.name, subject])).values()];
}

function normalizeMetaCode(value, fallback = '') {
  return normalizeSubjectCode(value || fallback || 'namu_meta');
}

function sourceTitle(entry) {
  return cleanWikiValue(entry?.meta?.title || basenameSlug(entry?.filePath));
}

function sourceSlug(entry) {
  return cleanWikiValue(entry?.meta?.slug || basenameSlug(entry?.filePath));
}

function extractWikiLinkLabels(text) {
  const out = [];
  const re = /\[\[([^\]|#]+)(?:#[^\]|]+)?(?:\|([^\]]+))?\]\]/g;
  let match;
  while ((match = re.exec(String(text || '')))) {
    const target = String(match[1] || '').trim();
    const label = cleanWikiValue(match[2] || match[1]);
    if (!label || label.length > 30) continue;
    out.push({ target, label });
  }
  return out;
}

const subjectLinkBlocklist = /^(실험체)$|블랙서바이벌|이터널 리턴|리그 오브 레전드|DOTA|분류|문서|템플릿|파일|시즌|패치|가이드|위키|나무|국적|러시아|핀란드|전쟁|무국적화|고양이|포킹|근본|평행 세계|해킹|논란|기록말살형|성우|방송|극회|한동그라미/;

const subjectRoleHeadings = [
  { title: '탱커', tag: 'tank' },
  { title: '전사', tag: 'bruiser' },
  { title: '암살자', tag: 'assassin' },
  { title: '스킬 딜러', tag: 'skill_amp' },
  { title: '원거리 딜러', tag: 'ranged' },
  { title: '지원가', tag: 'support' }
];

function isSubjectNameNoise(name) {
  const compact = String(name || '').trim().replace(/\s+/g, '').toUpperCase();
  return /^(JP|RF|RFT|KR|EN|CN)$/.test(compact);
}

function cleanSubjectNameFromLink(link, allowLoose = false) {
  const rawTarget = String(link?.target || '').trim();
  if (!rawTarget || /^파일:|^분류:|^템플릿:/i.test(rawTarget)) return '';
  if (/\(블랙서바이벌\)/.test(rawTarget)) return '';
  if (/\(이터널 리턴\)/.test(rawTarget)) {
    const name = cleanWikiValue(rawTarget.replace(/\(이터널 리턴\).*$/, '')).trim();
    return isSubjectNameNoise(name) ? '' : name;
  }
  const target = cleanWikiValue(rawTarget);
  const label = cleanWikiValue(link?.label || '');
  if (!allowLoose) return '';
  const candidate = label || target;
  if (isSubjectNameNoise(candidate) || isSubjectNameNoise(target)) return '';
  if (subjectLinkBlocklist.test(candidate) || subjectLinkBlocklist.test(target)) return '';
  if (!/^[가-힣A-Za-z][가-힣A-Za-z& .・·'-]{1,18}$/.test(candidate)) return '';
  return candidate.replace(/\s+/g, ' ').trim();
}

function sectionTextByHeading(text, title) {
  const raw = String(text || '');
  const headingRe = new RegExp(`^====\\s*${String(title).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*====\\s*$`, 'm');
  const start = raw.search(headingRe);
  if (start < 0) return '';
  const afterStart = raw.slice(start).replace(/^====[^\n]+\n/, '');
  const next = afterStart.search(/^={2,4}\s*[^=\n]+?\s*={2,4}\s*$/m);
  return next >= 0 ? afterStart.slice(0, next) : afterStart;
}

function extractSubjectIndexEntries(text) {
  const byName = new Map();
  const ensure = (name) => {
    const clean = cleanWikiValue(name).replace(/\([^)]*\)/g, '').trim();
    if (!clean || isSubjectNameNoise(clean) || subjectLinkBlocklist.test(clean)) return null;
    const code = normalizeMetaCode(clean);
    if (!byName.has(code)) byName.set(code, { name: clean, roleHints: [] });
    return byName.get(code);
  };

  for (const link of extractWikiLinkLabels(text)) {
    const name = cleanSubjectNameFromLink(link, false);
    if (name) ensure(name);
  }

  for (const role of subjectRoleHeadings) {
    const section = sectionTextByHeading(text, role.title);
    if (!section) continue;
    for (const link of extractWikiLinkLabels(section)) {
      const name = cleanSubjectNameFromLink(link, true);
      const entry = name ? ensure(name) : null;
      if (entry) entry.roleHints.push(role.tag);
    }
  }

  return [...byName.values()]
    .map((entry) => ({ ...entry, roleHints: uniqueStrings(entry.roleHints) }))
    .slice(0, 220);
}

function isGenericHeading(title, kind) {
  const generic = /개요|상세|역사|논란|평가|기타|관련 문서|각주|둘러보기|패치|변경|목록|분류|사용법/;
  if (!title || generic.test(title)) return true;
  if (kind === 'trait' && /특성$|특성 목록|개편/.test(title)) return true;
  if (kind === 'tacticalSkill' && /전술 스킬$|전술 스킬 목록/.test(title)) return true;
  if (kind === 'weaponSkill' && /무기 스킬$|무기 스킬 목록/.test(title)) return true;
  return false;
}

function compactHeadingRows(entry, kind, namespace) {
  const headings = extractHeadings(entry.text);
  const rows = [];
  let activeWeaponTypes = [];
  for (const h of headings) {
    const headingWeapons = extractWeaponTypesFromAnyText(h.title);
    if (kind === 'weaponSkill' && headingWeapons.length && headingWeapons.some((w) => h.title === w || h.title.includes(w))) {
      activeWeaponTypes = headingWeapons;
    }
    if (isGenericHeading(h.title, kind)) continue;
    const weaponTypes = headingWeapons.length ? headingWeapons : (kind === 'weaponSkill' ? activeWeaponTypes : []);
    rows.push({
      namespace,
      code: normalizeMetaCode(h.title),
      name: h.title,
      localizedName: h.title,
      type: kind,
      weaponTypes,
      tags: uniqueStrings(['namu', kind, ...weaponTypes]),
      raw: {
        headingLevel: h.level,
        sourceFile: path.basename(entry.filePath || ''),
        sourceUrl: entry.meta?.url || '',
        sourceKind: kind
      }
    });
    if (rows.length >= 120) break;
  }
  return rows;
}

function makePageSummaryRow(entry, kind, namespace) {
  const headings = extractHeadings(entry.text).map((h) => h.title).slice(0, 80);
  const weaponTypes = extractWeaponTypesFromAnyText(entry.text);
  const zones = extractZoneNamesFromText(entry.text);
  const concepts = extractTermHits(entry.text, guideConceptTerms);
  const title = sourceTitle(entry);
  return {
    namespace,
    code: normalizeMetaCode(sourceSlug(entry), title),
    name: title,
    localizedName: title,
    type: kind,
    weaponTypes,
    tags: uniqueStrings(['namu', kind, ...weaponTypes, ...zones.slice(0, 20), ...concepts.slice(0, 20)]),
    raw: {
      sourceFile: path.basename(entry.filePath || ''),
      sourceUrl: entry.meta?.url || '',
      sourceKind: kind,
      headings,
      zones,
      concepts
    }
  };
}

function extractNamuMetaRowsFromEntry(entry) {
  if (!entry || looksLikeBlockedHtml(entry.text)) return [];
  const kind = inferNamuKind(entry);
  const namespace = namuKindToNamespace[kind] || namuKindToNamespace.unknown;
  const rows = [makePageSummaryRow(entry, kind, namespace)];

  if (kind === 'subjectIndex') {
    for (const subject of extractSubjectIndexEntries(entry.text)) {
      const roleHints = uniqueStrings(subject.roleHints || []);
      rows.push({
        namespace: 'namuSubjectIndex',
        code: normalizeMetaCode(subject.name),
        name: subject.name,
        localizedName: subject.name,
        type: 'subject',
        weaponTypes: [],
        tags: uniqueStrings(['namu', 'subjectIndex', 'subject', ...roleHints]),
        raw: {
          sourceFile: path.basename(entry.filePath || ''),
          sourceUrl: entry.meta?.url || '',
          sourceKind: kind,
          roleHints
        }
      });
    }
  } else if (kind === 'weaponSkill') {
    const bodyWeapons = extractWeaponTypesFromAnyText(entry.text);
    for (const weaponType of bodyWeapons) {
      rows.push({
        namespace: 'namuWeaponSkill',
        code: normalizeMetaCode(weaponType),
        name: weaponType,
        localizedName: weaponType,
        type: 'weaponSkill',
        weaponTypes: [weaponType],
        tags: ['namu', 'weaponSkill', weaponType],
        raw: {
          sourceFile: path.basename(entry.filePath || ''),
          sourceUrl: entry.meta?.url || '',
          sourceKind: kind
        }
      });
    }
    rows.push(...compactHeadingRows(entry, kind, 'namuWeaponSkill'));
  } else if (kind === 'tacticalSkill') {
    rows.push(...compactHeadingRows(entry, kind, 'namuTacticalSkill'));
  } else if (kind === 'trait') {
    rows.push(...compactHeadingRows(entry, kind, 'namuTrait'));
  } else if (kind === 'map') {
    for (const zone of extractZoneNamesFromText(entry.text)) {
      rows.push({
        namespace: 'namuMapZone',
        code: normalizeMetaCode(zone),
        name: zone,
        localizedName: zone,
        type: 'zone',
        weaponTypes: [],
        tags: ['namu', 'map', 'zone'],
        raw: {
          sourceFile: path.basename(entry.filePath || ''),
          sourceUrl: entry.meta?.url || '',
          sourceKind: kind
        }
      });
    }
  }

  const deduped = new Map();
  for (const row of rows) {
    const key = `${row.namespace}:${row.code}`;
    if (!deduped.has(key)) deduped.set(key, row);
  }
  return [...deduped.values()];
}

function isExcludedNamuMetaRow(row) {
  const text = [
    row?.code,
    row?.name,
    row?.localizedName,
    ...(Array.isArray(row?.weaponTypes) ? row.weaponTypes : []),
    ...(Array.isArray(row?.tags) ? row.tags : [])
  ].filter(Boolean).join(' ');
  return /VF\s*의수|VF\s*안정화/i.test(text);
}

function extractNamuMetaRows(entries) {
  const deduped = new Map();
  for (const entry of entries || []) {
    for (const row of extractNamuMetaRowsFromEntry(entry)) {
      if (isExcludedNamuMetaRow(row)) continue;
      const key = `${row.namespace}:${row.code}`;
      if (!deduped.has(key)) deduped.set(key, row);
    }
  }
  return [...deduped.values()];
}

function stripInactiveNamuSections(text) {
  const raw = String(text || '');
  const markers = [
    /^==#?\s*삭제된 아이템\s*#?==\s*$/m,
    /^==#?\s*삭제된\s+항목\s*#?==\s*$/m
  ];
  let end = raw.length;
  for (const marker of markers) {
    const match = marker.exec(raw);
    if (match && match.index < end) end = match.index;
  }
  return raw.slice(0, end);
}

function isExcludedNamuItemName(name) {
  return /^(데스애더퀸|블랙맘바킹|슈퍼사이드와인더)(?:-|$)/.test(String(name || '').trim());
}

function isExcludedNamuItemCategory(category) {
  return /VF\s*의수/i.test(normalizeName(category));
}

function isExcludedNamuItem(name, category = '') {
  return isExcludedNamuItemName(name) || isExcludedNamuItemCategory(category);
}

function extractItemsAndRecipes(text) {
  text = stripInactiveNamuSections(text);
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
      const c = normalizeName(a['분류']);
      if (n && !isExcludedNamuItem(n, c)) out.push(n);
    }
    return [...new Set(out)];
  };

  const items = [];
  for (let idx = 0; idx < itemBlocks.length; idx++) {
    const blk = itemBlocks[idx].blk;
    const a = parseArgs(blk);
    const name = normalizeName(a['아이템명']);
    if (!name) continue;
    const category = a['분류'];
    if (isExcludedNamuItem(name, category)) continue;
    const rt = rarityToTier[a['등급']] || { rarity: 'common', tier: 1 };
    const meta = detectEquipMeta(category);

    // ✅ 스폰/획득 힌트(존 이름/지역명 문자열 그대로 저장)
    const spawnZones = parseFoundPlaces(a['발견장소'] || a['발견 장소'] || '');
    // ✅ 상자 종류 힌트(드랍 테이블/상자 종류가 명시된 경우)
    const spawnCrateTypes = parseCrateTypesFromText(
      a['드랍상자'] || a['드랍 상자'] || a['상자'] || a['상자종류'] || a['상자 종류'] || a['발견장소'] || a['발견 장소'] || ''
    );
    const droneCreditsCost = toNum(a['원격드론호출크레딧'] || a['원격 드론 호출 크레딧'] || '');
    const stackMax = toNum(a['최대수량'] || a['최대 수량'] || '');
    const description = cleanWikiValue(a['소비효과'] || a['플레이버텍스트'] || '');

    const seg = text.slice(itemBlocks[idx].end, itemBlocks[idx + 1] ? itemBlocks[idx + 1].start : text.length);
    const upperItemNames = extractUpperItemNames(seg).filter((n) => n && n !== name);

    items.push({
      name,
      rarity: rt.rarity,
      tier: rt.tier,
      type: meta.type,
      equipSlot: meta.equipSlot,
      weaponType: meta.weaponType,
      itemSubType: meta.itemSubType,
      tags: meta.tags,
      stackMax,
      description,
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
        lifesteal: toNum(a['모든 피해 흡혈']),
        armorPen: toNum(a['방어 관통']),
        adaptiveForce: toNum(a['맞춤형 능력치'])
      }
    });
  }

  const recipes = [];
  for (const blk of recipeBlocks) {
    const a = parseArgs(blk);
    const result = normalizeName(a['완성']);
    if (!result || isExcludedNamuItemName(result)) continue;
    const ingredients = [];
    for (let i = 1; i <= 6; i++) {
      const k = `제작${i}`;
      const ingredient = normalizeName(a[k]);
      if (ingredient && !isExcludedNamuItemName(ingredient)) ingredients.push(ingredient);
    }
    if (ingredients.length >= 1) recipes.push({ result, ingredients });
  }

  return { items, recipes };
}

async function upsertItemByName(name, patch) {
  const externalId = patch.externalId || buildExternalId('namu', name);
  // SSOT 키: 외부에서 가져온 아이템은 externalId를 그대로 itemKey로 사용
  const itemKey = patch.itemKey || externalId;
  const setPatch = { ...patch };
  delete setPatch.itemKey;
  delete setPatch.externalId;

  const doc = await Item.findOneAndUpdate(
    { $or: [{ itemKey }, { externalId }] },
    {
      $setOnInsert: {
        createdAt: new Date(),
        lockedByAdmin: true,
        source: 'namu'
      },
      $set: {
        itemKey,
        externalId,
        name,
        ...setPatch
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

function namuItemBucket(it) {
  if (it?.weaponType) return it.weaponType;
  if (it?.equipSlot) return it.equipSlot;
  if (it?.type === '재료') return 'material';
  if (it?.type === '소모품') return 'consumable';
  return 'item';
}

async function pruneStaleNamuItemAliases(name, canonicalExternalId, canonicalId) {
  const staleExternalIds = ['namu:item', 'namu:hint', 'namu:material', 'namu:consumable']
    .map((prefix) => buildExternalId(prefix, name))
    .filter((externalId) => externalId !== canonicalExternalId);
  if (staleExternalIds.length === 0) return 0;

  const result = await Item.deleteMany({
    _id: { $ne: canonicalId },
    name,
    source: 'namu',
    externalId: { $in: staleExternalIds }
  });
  return Number(result.deletedCount || 0);
}

async function pruneExcludedNamuItems() {
  const nameRe = /^(데스애더퀸|블랙맘바킹|슈퍼사이드와인더)(?:-|$)/;
  const externalIdRe = /(데스애더퀸|블랙맘바킹|슈퍼사이드와인더)(?:-|$)/;
  const result = await Item.deleteMany({
    $and: [
      {
        $or: [
          { source: 'namu' },
          { externalId: { $regex: /^namu:/ } }
        ]
      },
      {
        $or: [
          { name: nameRe },
          { externalId: externalIdRe },
          { itemSubType: { $regex: /VF\s*의수/i } },
          { tags: { $regex: /VF\s*의수/i } }
        ]
      }
    ]
  });
  return Number(result.deletedCount || 0);
}

async function upsertNamuSubject(subject) {
  if (!subject?.code || !subject?.name) return null;
  const raw = {
    aliases: subject.aliases,
    primaryWeapon: subject.primaryWeapon,
    weaponTypes: subject.weaponTypes,
    roleHints: subject.roleHints,
    tacticalSkill: subject.tacticalSkill,
    trait: subject.trait,
    sourceFile: subject.sourceFile,
    confidence: subject.confidence
  };

  await ErMeta.updateOne(
    { namespace: 'namuSubject', code: subject.code },
    {
      $setOnInsert: {
        namespace: 'namuSubject',
        code: subject.code
      },
      $set: {
        name: subject.name,
        localizedName: subject.localizedName || subject.name,
        type: subject.roleHints?.[0] || 'subject',
        weaponTypes: Array.isArray(subject.weaponTypes) ? subject.weaponTypes : [],
        tags: subject.tags,
        source: 'namu',
        metaType: 'namu:pasted:subject',
        raw,
        importedAt: new Date()
      }
    },
    { upsert: true }
  );
  return subject;
}

async function upsertNamuMetaRow(row) {
  if (!row?.namespace || !row?.code) return null;
  await ErMeta.updateOne(
    { namespace: row.namespace, code: row.code },
    {
      $setOnInsert: {
        namespace: row.namespace,
        code: row.code
      },
      $set: {
        name: row.name || row.localizedName || row.code,
        localizedName: row.localizedName || row.name || row.code,
        type: row.type || '',
        weaponTypes: Array.isArray(row.weaponTypes) ? row.weaponTypes : [],
        tags: Array.isArray(row.tags) ? row.tags : [],
        source: 'namu',
        metaType: `namu:pasted:${row.type || 'meta'}`,
        raw: row.raw || {},
        importedAt: new Date()
      }
    },
    { upsert: true }
  );
  return row;
}

async function pruneStaleNamuMetaRows(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return 0;

  const scopes = new Map();
  for (const row of rows) {
    const raw = row.raw || {};
    const sourceFile = String(raw.sourceFile || '').trim();
    const sourceKind = String(raw.sourceKind || '').trim();
    if (!row.namespace || !sourceFile || !sourceKind) continue;
    const key = `${row.namespace}\0${sourceFile}\0${sourceKind}`;
    if (!scopes.has(key)) {
      scopes.set(key, {
        namespace: row.namespace,
        sourceFile,
        sourceKind,
        codes: new Set()
      });
    }
    scopes.get(key).codes.add(row.code);
  }

  let deleted = 0;
  for (const scope of scopes.values()) {
    const result = await ErMeta.deleteMany({
      namespace: scope.namespace,
      source: 'namu',
      'raw.sourceFile': scope.sourceFile,
      'raw.sourceKind': scope.sourceKind,
      code: { $nin: [...scope.codes] }
    });
    deleted += Number(result.deletedCount || 0);
  }
  return deleted;
}

async function pruneRemovedNamuMetaSources(entries, rows) {
  if (!Array.isArray(entries) || !Array.isArray(rows) || rows.length === 0) return 0;
  const sourceFiles = uniqueStrings(entries.map((entry) => path.basename(entry.filePath || '')).filter(Boolean));
  const namespaces = uniqueStrings(rows.map((row) => row.namespace).filter(Boolean));
  if (sourceFiles.length === 0 || namespaces.length === 0) return 0;

  const result = await ErMeta.deleteMany({
    namespace: { $in: namespaces },
    source: 'namu',
    'raw.sourceFile': { $exists: true, $nin: sourceFiles }
  });
  return Number(result.deletedCount || 0);
}

async function runParse(filePath) {
  const text = readSourceText(filePath);
  const { items, recipes } = extractItemsAndRecipes(text);
  const uniqItems = [...new Map(items.map(i => [i.name, i])).values()];
  const uniqRecipes = [...new Map(recipes.map(r => [r.result, r])).values()];
  console.log(JSON.stringify({ items: uniqItems, recipes: uniqRecipes }, null, 2));
}

async function runParseSubjects(filePath) {
  const subjects = extractSubjectsFromEntries(readSourceEntries(filePath));
  console.log(JSON.stringify({ subjects }, null, 2));
}

async function runParseMeta(filePath) {
  const meta = extractNamuMetaRows(readSourceEntries(filePath));
  console.log(JSON.stringify({ meta }, null, 2));
}

async function runParseAll(filePath) {
  const entries = readSourceEntries(filePath);
  const text = combineItemSourceText(entries);
  const { items, recipes } = extractItemsAndRecipes(text);
  const subjects = extractSubjectsFromEntries(entries);
  const meta = extractNamuMetaRows(entries);
  const uniqItems = [...new Map(items.map(i => [i.name, i])).values()];
  const uniqRecipes = [...new Map(recipes.map(r => [r.result, r])).values()];
  console.log(JSON.stringify({ items: uniqItems, recipes: uniqRecipes, subjects, meta }, null, 2));
}

async function importItemsAndRecipesFromText(text) {
  const { items, recipes } = extractItemsAndRecipes(text);

  const byName = new Map();
  const excludedPruned = await pruneExcludedNamuItems();
  let aliasesPruned = 0;
  for (const it of items) {
    const bucket = namuItemBucket(it);
    const externalId = buildExternalId(`namu:${bucket}`, it.name);
    const doc = await upsertItemByName(it.name, {
      externalId,
      type: it.type,
      rarity: it.rarity,
      tier: it.tier,
      itemSubType: it.itemSubType || '',
      stackMax: Math.max(1, Number(it.stackMax || (it.type === '재료' ? 3 : 1))),
      tags: it.tags,
      stats: it.stats,
      equipSlot: it.equipSlot,
      weaponType: it.weaponType,
      spawnZones: Array.isArray(it.spawnZones) ? it.spawnZones : [],
      spawnCrateTypes: Array.isArray(it.spawnCrateTypes) ? it.spawnCrateTypes : [],
      droneCreditsCost: Math.max(0, Number(it.droneCreditsCost || 0)),
      description: it.description || ''
    });
    aliasesPruned += await pruneStaleNamuItemAliases(it.name, externalId, doc._id);
    byName.set(it.name, doc);
  }

  // ✅ "상위 아이템" 표 힌트 연결(대체 목표/추천용)
  for (const it of items) {
    if (!Array.isArray(it.upperItemNames) || it.upperItemNames.length === 0) continue;
    const baseDoc = byName.get(it.name);
    if (!baseDoc) continue;
    const keys = [];
    for (const upName of it.upperItemNames) {
      if (isExcludedNamuItemName(upName)) continue;
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

  return { items: items.length, recipes: recipes.length, aliasesPruned, excludedPruned };
}

async function importSubjectsFromEntries(entries) {
  const subjects = extractSubjectsFromEntries(entries);
  for (const subject of subjects) {
    await upsertNamuSubject(subject);
  }
  return { subjects: subjects.length };
}

async function importMetaFromEntries(entries, options = {}) {
  const meta = extractNamuMetaRows(entries);
  for (const row of meta) {
    await upsertNamuMetaRow(row);
  }
  const stalePruned = await pruneStaleNamuMetaRows(meta);
  const sourcePruned = options.pruneMissingSources ? await pruneRemovedNamuMetaSources(entries, meta) : 0;
  return { meta: meta.length, pruned: stalePruned + sourcePruned, stalePruned, sourcePruned };
}

async function runImport(filePath) {
  if (!process.env.MONGO_URI) throw new Error('MONGO_URI가 필요합니다(.env)');
  await mongoose.connect(process.env.MONGO_URI);

  const result = await importItemsAndRecipesFromText(readSourceText(filePath));

  await mongoose.disconnect();
  console.log(`OK: items=${result.items}, recipes=${result.recipes}, aliasesPruned=${result.aliasesPruned}, excludedPruned=${result.excludedPruned}`);
}

async function runImportSubjects(filePath) {
  if (!process.env.MONGO_URI) throw new Error('MONGO_URI가 필요합니다(.env)');
  await mongoose.connect(process.env.MONGO_URI);

  const result = await importSubjectsFromEntries(readSourceEntries(filePath));

  await mongoose.disconnect();
  console.log(`OK: subjects=${result.subjects}`);
}

async function runImportMeta(filePath) {
  if (!process.env.MONGO_URI) throw new Error('MONGO_URI가 필요합니다(.env)');
  await mongoose.connect(process.env.MONGO_URI);

  const result = await importMetaFromEntries(readSourceEntries(filePath));

  await mongoose.disconnect();
  console.log(`OK: meta=${result.meta}, pruned=${result.pruned}`);
}

async function runImportAll(filePath) {
  if (!process.env.MONGO_URI) throw new Error('MONGO_URI가 필요합니다(.env)');
  await mongoose.connect(process.env.MONGO_URI);

  const entries = readSourceEntries(filePath);
  const text = combineItemSourceText(entries);
  const itemResult = await importItemsAndRecipesFromText(text);
  const subjectResult = await importSubjectsFromEntries(entries);
  const metaResult = await importMetaFromEntries(entries, { pruneMissingSources: fs.statSync(filePath).isDirectory() });

  await mongoose.disconnect();
  console.log(`OK: items=${itemResult.items}, recipes=${itemResult.recipes}, aliasesPruned=${itemResult.aliasesPruned}, excludedPruned=${itemResult.excludedPruned}, subjects=${subjectResult.subjects}, meta=${metaResult.meta}, pruned=${metaResult.pruned}`);
}

async function main() {
  const [mode, filePath] = process.argv.slice(2);
  const p = path.resolve(process.cwd(), filePath || '');
  if (!mode || !filePath) {
    console.log('Usage: node scripts/import_namu_pasted.js <parse|import|parse-subjects|import-subjects|parse-meta|import-meta|parse-all|import-all> <file-or-dir>');
    process.exit(0);
  }
  if (mode === 'parse') return runParse(p);
  if (mode === 'import') return runImport(p);
  if (mode === 'parse-subjects') return runParseSubjects(p);
  if (mode === 'import-subjects') return runImportSubjects(p);
  if (mode === 'parse-meta') return runParseMeta(p);
  if (mode === 'import-meta') return runImportMeta(p);
  if (mode === 'parse-all') return runParseAll(p);
  if (mode === 'import-all') return runImportAll(p);
  throw new Error('mode는 parse/import/parse-subjects/import-subjects/parse-meta/import-meta/parse-all/import-all 중 하나여야 합니다');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
