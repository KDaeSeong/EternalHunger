const SKILL_LEVEL_COUNT = 5;
const NUMBER_SEQUENCE = String.raw`(\d+(?:\.\d+)?(?:\s*\/\s*\d+(?:\.\d+)?){0,4})`;

function cleanNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeSkillText(value) {
  return String(value || '')
    .normalize('NFKC')
    .replace(/[，。]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseNumberList(value) {
  return String(value || '')
    .split('/')
    .map((part) => cleanNumber(String(part).trim(), NaN))
    .filter((n) => Number.isFinite(n));
}

function toLevelArray(value, fallback = 0, opts = {}) {
  const raw = Array.isArray(value) ? value : parseNumberList(value);
  const src = raw.length ? raw : [fallback];
  const out = [];
  for (let i = 0; i < SKILL_LEVEL_COUNT; i += 1) {
    const picked = src[i] ?? src[src.length - 1] ?? fallback;
    const n = cleanNumber(picked, fallback);
    out.push(opts.integer ? Math.max(0, Math.round(n)) : Math.max(0, Number(n.toFixed(3))));
  }
  return out;
}

function defaultQSkill(base = {}) {
  return {
    enabled: base.enabled === true,
    type: 'basic_attack_recast',
    name: String(base.name || '사용자 Q'),
    cooldownSec: Math.max(1, cleanNumber(base.cooldownSec, 7)),
    recastWindowSec: Math.max(1, cleanNumber(base.recastWindowSec, 5)),
    radius: Math.max(0, cleanNumber(base.radius, 0)),
    firstFlat: toLevelArray(base.firstFlat, 0, { integer: true }),
    secondFlat: toLevelArray(base.secondFlat, 0, { integer: true }),
    secondMaxHpPct: toLevelArray(base.secondMaxHpPct, 0),
    secondCurrentHpPct: toLevelArray(base.secondCurrentHpPct, 0),
    firstSkillAmpScale: Math.max(0, cleanNumber(base.firstSkillAmpScale, 0)),
    secondSkillAmpScale: Math.max(0, cleanNumber(base.secondSkillAmpScale, 0)),
    sourceText: String(base.sourceText || ''),
  };
}

function matchNumberSequence(text, patterns) {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) return match[1];
  }
  return '';
}

function extractRecastWindowSec(text) {
  const match = text.match(/(\d+(?:\.\d+)?)\s*초\s*(?:안|이내|내)/);
  return match ? cleanNumber(match[1], 0) : 0;
}

function extractRadius(text) {
  const match = text.match(/(?:범위|반경|광역\s*범위)\s*(\d+(?:\.\d+)?)/);
  return match ? cleanNumber(match[1], 0) : null;
}

function extractFirstFlat(text) {
  const firstSegment = text.split(/(?:5?\s*초\s*(?:안|이내|내))?\s*(?:한\s*번\s*더|한번\s*더|다시|재사용|재시전|2타|Q2|q2|두\s*번째)/)[0] || text;
  const seq = matchNumberSequence(firstSegment, [
    new RegExp(`${NUMBER_SEQUENCE}\\s*(?:의\\s*)?(?:추가\\s*)?피해`),
    new RegExp(`(?:적\\s*\\d*\\s*인에게|대상에게|다음\\s*기본\\s*공격|Q1|q1|첫\\s*공격)[^\\d]{0,40}${NUMBER_SEQUENCE}`),
  ]);
  return seq ? toLevelArray(seq, 0, { integer: true }) : null;
}

function extractSecondFlat(text) {
  const seq = matchNumberSequence(text, [
    new RegExp(`(?:한\\s*번\\s*더|한번\\s*더|다시|재사용|재시전|추가\\s*발동|2타|Q2|q2|두\\s*번째)[^\\d]{0,90}${NUMBER_SEQUENCE}`),
    new RegExp(`(?:다음\\s*공격|두\\s*번째\\s*공격)[^\\d]{0,40}${NUMBER_SEQUENCE}\\s*(?:의\\s*)?(?:광역\\s*)?(?:추가\\s*)?피해`),
  ]);
  return seq ? toLevelArray(seq, 0, { integer: true }) : null;
}

function extractHpPct(text, kind) {
  const hpWord = kind === 'current'
    ? String.raw`(?:현재\s*체력|현재\s*HP|남은\s*체력|남은\s*HP)`
    : String.raw`(?:최대\s*체력|최대\s*HP)`;
  const seq = matchNumberSequence(text, [
    new RegExp(`${hpWord}(?:의)?[^\\d]{0,30}${NUMBER_SEQUENCE}\\s*(?:%|퍼센트|프로)`),
    new RegExp(`${NUMBER_SEQUENCE}\\s*(?:%|퍼센트|프로)[^,.;\\n]{0,30}${hpWord}`),
  ]);
  return seq ? toLevelArray(seq, 0) : null;
}

function buildWarnings(skill) {
  const warnings = [];
  if (!skill.firstFlat.some((n) => n > 0)) warnings.push('Q1 피해를 찾지 못했습니다.');
  if (!skill.secondFlat.some((n) => n > 0)) warnings.push('Q2 피해를 찾지 못했습니다.');
  if (!skill.secondCurrentHpPct.some((n) => n > 0) && !skill.secondMaxHpPct.some((n) => n > 0)) {
    warnings.push('Q2 체력 비례 피해를 찾지 못했습니다.');
  }
  return warnings;
}

function normalizePreviewSkill(skill = {}) {
  const q = defaultQSkill(skill);
  return {
    enabled: q.enabled === true,
    type: q.type,
    name: q.name,
    cooldownSec: q.cooldownSec,
    recastWindowSec: q.recastWindowSec,
    radius: q.radius,
    firstFlat: q.firstFlat,
    secondFlat: q.secondFlat,
    secondCurrentHpPct: q.secondCurrentHpPct,
    secondMaxHpPct: q.secondMaxHpPct,
    firstSkillAmpScale: q.firstSkillAmpScale,
    secondSkillAmpScale: q.secondSkillAmpScale,
  };
}

export function compileNaturalQSkillDescription(sourceText, base = {}) {
  const text = normalizeSkillText(sourceText);
  const skill = defaultQSkill({ ...base, sourceText: text });
  skill.enabled = true;
  if (!text) {
    return { skill, warnings: ['Q 설명이 비어 있습니다.'] };
  }

  const firstFlat = extractFirstFlat(text);
  if (firstFlat) skill.firstFlat = firstFlat;

  const secondFlat = extractSecondFlat(text);
  if (secondFlat) skill.secondFlat = secondFlat;

  const currentHpPct = extractHpPct(text, 'current');
  if (currentHpPct) skill.secondCurrentHpPct = currentHpPct;

  const maxHpPct = extractHpPct(text, 'max');
  if (maxHpPct) skill.secondMaxHpPct = maxHpPct;

  const recastWindowSec = extractRecastWindowSec(text);
  if (recastWindowSec > 0) skill.recastWindowSec = recastWindowSec;

  const radius = extractRadius(text);
  if (radius !== null) skill.radius = radius;

  return {
    skill,
    warnings: buildWarnings(skill),
  };
}

export function buildQSkillCodePreview(skill = {}) {
  const q = normalizePreviewSkill(skill);
  return `const qSkill = ${JSON.stringify(q, null, 2)};`;
}
