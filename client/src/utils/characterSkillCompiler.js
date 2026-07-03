const NUMBER_SEQUENCE = String.raw`([+-]?\d+(?:\.\d+)?(?:\s*\/\s*[+-]?\d+(?:\.\d+)?){0,4})`;
import {
  CHARACTER_SKILL_SLOT_LABELS,
  cleanNumber,
  createDefaultCompiledSkill,
  normalizePctInput,
  normalizeSkillText,
  normalizeSlot,
  toLevelArray,
} from './characterSkillCompilerCore';

export {
  ACTIVE_CHARACTER_SKILL_SLOTS,
  CHARACTER_SKILL_SLOT_LABELS,
  CHARACTER_SKILL_SLOTS,
  createDefaultCompiledSkill,
} from './characterSkillCompilerCore';

const STAT_KEYWORDS = [
  { key: 'maxHp', patterns: ['체력', '최대 체력', 'hp', 'max hp', 'health'] },
  { key: 'attackPower', patterns: ['공격력', '공격', 'attack power', 'atk', 'attack'] },
  { key: 'skillAmp', patterns: ['스킬증폭', '스킬 증폭', '스증', 'skill amp', 'amp'] },
  { key: 'defense', patterns: ['방어력', '방어', 'defense', 'def'] },
  { key: 'attackRange', patterns: ['사정거리', '사거리', 'attack range', 'range'] },
  { key: 'sightRange', patterns: ['시야', 'sight range', 'vision', 'sight'] },
  { key: 'attackSpeed', patterns: ['공격속도', '공속', 'attack speed', 'atk speed'] },
];

function matchNumberSequence(text, patterns) {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) return match[1];
  }
  return '';
}

function matchAllNumberSequences(text, pattern) {
  const out = [];
  const rx = new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`);
  let match = rx.exec(text);
  while (match) {
    if (match[1]) out.push(match[1]);
    match = rx.exec(text);
  }
  return out;
}

function splitRecastSegments(text) {
  const marker = text.search(/(?:다시|재사용|재발동|한\s*번\s*더|한번\s*더|2타|두\s*번째|second|recast)/i);
  if (marker < 0) return { first: text, second: '' };
  return {
    first: text.slice(0, marker),
    second: text.slice(marker),
  };
}

function extractCooldownSec(text) {
  const patterns = [
    /(?:쿨타임|쿨|재사용\s*대기\s*시간|재사용|cooldown|cd)\s*:?\s*(\d+(?:\.\d+)?)\s*(?:초|s|sec)?/i,
    /(\d+(?:\.\d+)?)\s*(?:초|s|sec)\s*(?:쿨타임|쿨|재사용|cooldown|cd)/i,
  ];
  const seq = matchNumberSequence(text, patterns);
  return seq ? cleanNumber(seq, 0) : 0;
}

function extractRecastWindowSec(text) {
  const patterns = [
    /(\d+(?:\.\d+)?)\s*(?:초|s|sec)\s*(?:안에|이내|동안)[^.!?]{0,40}(?:다시|재사용|재발동|한\s*번\s*더|한번\s*더|2타|second|recast)/i,
    /(?:다시|재사용|재발동|한\s*번\s*더|한번\s*더|2타|second|recast)[^.!?]{0,40}(\d+(?:\.\d+)?)\s*(?:초|s|sec)/i,
  ];
  const seq = matchNumberSequence(text, patterns);
  return seq ? cleanNumber(seq, 0) : 0;
}

function extractRadius(text) {
  const patterns = [
    /(?:범위|반경|광역\s*범위|radius|aoe)\s*:?\s*(\d+(?:\.\d+)?)/i,
    /(\d+(?:\.\d+)?)\s*(?:범위|반경|radius)/i,
  ];
  const seq = matchNumberSequence(text, patterns);
  if (seq) return cleanNumber(seq, 0);
  return /광역|범위|area|aoe/i.test(text) ? 1 : null;
}

function extractRange(text) {
  const seq = matchNumberSequence(text, [
    /(?:사거리|사용\s*거리|시전\s*거리|range)\s*:?\s*(\d+(?:\.\d+)?)/i,
    /(\d+(?:\.\d+)?)\s*(?:사거리|사용\s*거리|시전\s*거리|range)/i,
  ]);
  return seq ? cleanNumber(seq, 0) : 0;
}

function extractTimingSec(text, kind) {
  const word = kind === 'cast'
    ? String.raw`(?:선딜|시전\s*시간|캐스팅|cast\s*delay|cast\s*time)`
    : String.raw`(?:후딜|경직|회복\s*시간|backswing|recovery)`;
  const seq = matchNumberSequence(text, [
    new RegExp(`${word}\\s*:?\\s*(\\d+(?:\\.\\d+)?)\\s*(?:초|s|sec)?`, 'i'),
    new RegExp(`(\\d+(?:\\.\\d+)?)\\s*(?:초|s|sec)\\s*${word}`, 'i'),
  ]);
  return seq ? cleanNumber(seq, 0) : 0;
}

function inferTargetPriority(text, skill) {
  if (/광역|범위|다수|여러|cluster|aoe|area/i.test(text)) return 'cluster';
  if (/처치|마무리|결정타|kill|finish|execute/i.test(text)) return 'killable';
  if (/체력(?:이)?\s*(?:낮|적)|낮은\s*(?:체력|hp)|lowest|low\s*hp/i.test(text)) return 'lowest_hp';
  if (/최대\s*(?:체력|hp)|max\s*hp/i.test(text)) return 'highest_max_hp';
  if (skill.radius > 0) return 'cluster';
  if ([...skill.maxHpPct, ...skill.secondMaxHpPct].some((n) => n > 0)) return 'highest_max_hp';
  if ([...skill.currentHpPct, ...skill.secondCurrentHpPct].some((n) => n > 0)) return 'lowest_hp';
  return 'auto';
}

function inferUseCondition(text) {
  if (/처치|마무리|결정타|kill|finish|execute/i.test(text)) return 'finish';
  if (/방어|보호|위급|체력.*(?:이하|낮)|defensive|low\s*hp/i.test(text)) return 'defensive';
  if (/견제|poke|harass/i.test(text)) return 'harass';
  return 'auto';
}

function extractHpConditionPct(text, subject, direction) {
  const subjectWord = subject === 'caster'
    ? String.raw`(?:내|자신|시전자|사용자|caster|self)`
    : String.raw`(?:대상|적|target|enemy)`;
  const dirWord = direction === 'max'
    ? String.raw`(?:이하|미만|낮을\s*때|below|under|less)`
    : String.raw`(?:이상|초과|높을\s*때|above|over|more)`;
  const seq = matchNumberSequence(text, [
    new RegExp(`${subjectWord}[^%\\d]{0,30}(?:체력|hp)[^%\\d]{0,20}${NUMBER_SEQUENCE}\\s*(?:%|퍼센트)[^.!?]{0,20}${dirWord}`, 'i'),
    new RegExp(`${subjectWord}[^.!?]{0,40}${dirWord}[^%\\d]{0,20}${NUMBER_SEQUENCE}\\s*(?:%|퍼센트)`, 'i'),
  ]);
  return seq ? normalizePctInput(seq, 0) : 0;
}

function extractFlatDamage(text) {
  const seq = matchNumberSequence(text, [
    new RegExp(`${NUMBER_SEQUENCE}\\s*(?:의\\s*)?(?:추가\\s*)?(?:광역\\s*)?(?:피해|데미지|damage|dmg)`, 'i'),
    new RegExp(`(?:피해|데미지|damage|dmg)[^\\d+-]{0,20}${NUMBER_SEQUENCE}`, 'i'),
  ]);
  return seq ? toLevelArray(seq, 0, { integer: true }) : null;
}

function extractHpPct(text, kind) {
  const hpWord = kind === 'current'
    ? String.raw`(?:현재\s*(?:체력|HP)|남은\s*(?:체력|HP)|current\s*hp|remaining\s*hp)`
    : String.raw`(?:(?:대상\s*)?최대\s*(?:체력|HP)|max\s*hp)`;
  const seq = matchNumberSequence(text, [
    new RegExp(`${hpWord}[^\\d+-]{0,40}${NUMBER_SEQUENCE}\\s*(?:%|퍼센트)`, 'i'),
    new RegExp(`${NUMBER_SEQUENCE}\\s*(?:%|퍼센트)[^,.;\\n]{0,40}${hpWord}`, 'i'),
  ]);
  return seq ? toLevelArray(seq, 0) : null;
}

function extractSkillAmpScale(text) {
  const match = text.match(/(?:스킬\s*증폭|스증|skill\s*amp|amp)[^+\-\d]{0,20}([+-]?\d+(?:\.\d+)?)\s*(%)?/i);
  if (!match) return 0;
  const n = cleanNumber(match[1], 0);
  if (match[2] || n > 5) return Math.max(0, n / 100);
  return Math.max(0, n);
}

function extractLevelValue(text, words) {
  const wordPattern = words.join('|');
  const seq = matchNumberSequence(text, [
    new RegExp(`${NUMBER_SEQUENCE}\\s*(?:의\\s*)?(?:${wordPattern})`, 'i'),
    new RegExp(`(?:${wordPattern})[^\\d+-]{0,20}${NUMBER_SEQUENCE}`, 'i'),
  ]);
  return seq ? toLevelArray(seq, 0, { integer: true }) : null;
}

function keywordToRegex(keyword) {
  return keyword
    .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    .replace(/\s+/g, String.raw`\s*`);
}

function extractStatModifiers(text) {
  const out = {};
  for (const stat of STAT_KEYWORDS) {
    for (const keyword of stat.patterns) {
      const word = keywordToRegex(keyword);
      const patterns = [
        new RegExp(`(?:${word})[^+\\-\\d]{0,16}([+-]?\\d+(?:\\.\\d+)?)`, 'i'),
        new RegExp(`([+-]?\\d+(?:\\.\\d+)?)\\s*(?:${word})`, 'i'),
      ];
      const seq = matchNumberSequence(text, patterns);
      if (!seq) continue;
      const value = cleanNumber(seq, 0);
      if (value !== 0) out[stat.key] = (out[stat.key] || 0) + value;
      break;
    }
  }
  return out;
}

function buildTags(text, skill) {
  const tags = new Set(Array.isArray(skill.tags) ? skill.tags : []);
  if (/기본\s*공격|평타|basic attack/i.test(text)) tags.add('basic_attack');
  if (/다시|재사용|재발동|한\s*번\s*더|한번\s*더|2타|second|recast/i.test(text)) tags.add('recast');
  if (/광역|범위|aoe|area/i.test(text)) tags.add('area');
  if (/회복|heal/i.test(text)) tags.add('heal');
  if (/보호막|shield|barrier/i.test(text)) tags.add('shield');
  if (skill.slot === 'passive') tags.add('passive');
  return Array.from(tags).slice(0, 16);
}

function copyArrayIfFound(skill, field, value) {
  if (Array.isArray(value)) skill[field] = value;
}

function buildWarnings(skill) {
  const warnings = [];
  const hasDamage = [
    ...skill.firstFlat,
    ...skill.secondFlat,
    ...skill.flatDamage,
    ...skill.maxHpPct,
    ...skill.currentHpPct,
    ...skill.secondMaxHpPct,
    ...skill.secondCurrentHpPct,
  ].some((n) => Number(n || 0) > 0);
  const hasUtility = [...skill.heal, ...skill.shield].some((n) => Number(n || 0) > 0);
  const hasPassiveStats = Object.keys(skill.statModifiers || {}).length > 0;
  if (!hasDamage && !hasUtility && !hasPassiveStats) {
    warnings.push('인식된 피해/회복/보호막/패시브 스탯 효과가 없습니다.');
  }
  if (skill.type === 'basic_attack_recast' && !skill.secondFlat.some((n) => n > 0) && !skill.secondCurrentHpPct.some((n) => n > 0) && !skill.secondMaxHpPct.some((n) => n > 0)) {
    warnings.push('재발동 피해를 찾지 못했습니다. 필요하면 2타 피해를 직접 확인하세요.');
  }
  return warnings;
}

function normalizePreviewSkill(skill = {}) {
  const s = createDefaultCompiledSkill(skill, skill.slot || 'q');
  return {
    enabled: s.enabled === true,
    slot: s.slot,
    type: s.type,
    trigger: s.trigger,
    name: s.name,
    cooldownSec: s.cooldownSec,
    recastWindowSec: s.recastWindowSec,
    range: s.range,
    castDelaySec: s.castDelaySec,
    recoveryDelaySec: s.recoveryDelaySec,
    useCondition: s.useCondition,
    targetPriority: s.targetPriority,
    minExpectedDamage: s.minExpectedDamage,
    minSplashTargets: s.minSplashTargets,
    minCasterHpPct: s.minCasterHpPct,
    maxCasterHpPct: s.maxCasterHpPct,
    minTargetHpPct: s.minTargetHpPct,
    maxTargetHpPct: s.maxTargetHpPct,
    radius: s.radius,
    durationSec: s.durationSec,
    firstFlat: s.firstFlat,
    secondFlat: s.secondFlat,
    flatDamage: s.flatDamage,
    maxHpPct: s.maxHpPct,
    currentHpPct: s.currentHpPct,
    secondCurrentHpPct: s.secondCurrentHpPct,
    secondMaxHpPct: s.secondMaxHpPct,
    heal: s.heal,
    shield: s.shield,
    firstSkillAmpScale: s.firstSkillAmpScale,
    secondSkillAmpScale: s.secondSkillAmpScale,
    skillAmpScale: s.skillAmpScale,
    statModifiers: s.statModifiers,
    tags: s.tags,
  };
}

export function compileNaturalSkillDescription(sourceText, base = {}, slot = 'q') {
  const skillSlot = normalizeSlot(slot || base.slot);
  const text = normalizeSkillText(sourceText);
  const skill = createDefaultCompiledSkill({ ...base, slot: skillSlot, sourceText: text }, skillSlot);
  skill.enabled = true;
  if (!text) {
    return { skill, warnings: [`${CHARACTER_SKILL_SLOT_LABELS[skillSlot]} 설명이 비어 있습니다.`] };
  }

  const cooldownSec = extractCooldownSec(text);
  if (cooldownSec > 0) skill.cooldownSec = cooldownSec;

  const recastWindowSec = extractRecastWindowSec(text);
  if (recastWindowSec > 0) skill.recastWindowSec = recastWindowSec;

  const radius = extractRadius(text);
  if (radius !== null) skill.radius = radius;

  const range = extractRange(text);
  if (range > 0) skill.range = range;

  const castDelaySec = extractTimingSec(text, 'cast');
  if (castDelaySec > 0) skill.castDelaySec = castDelaySec;

  const recoveryDelaySec = extractTimingSec(text, 'recovery');
  if (recoveryDelaySec > 0) skill.recoveryDelaySec = recoveryDelaySec;

  const duration = matchNumberSequence(text, [
    /(?:지속|duration)[^+\-\d]{0,20}(\d+(?:\.\d+)?)\s*(?:초|s|sec)?/i,
    /(\d+(?:\.\d+)?)\s*(?:초|s|sec)\s*(?:동안|지속|duration)/i,
  ]);
  if (duration) skill.durationSec = cleanNumber(duration, 0);

  const { first, second } = splitRecastSegments(text);
  const firstFlat = extractFlatDamage(first || text);
  copyArrayIfFound(skill, 'firstFlat', firstFlat);
  copyArrayIfFound(skill, 'flatDamage', firstFlat);

  const secondFlat = second ? extractFlatDamage(second) : null;
  copyArrayIfFound(skill, 'secondFlat', secondFlat);

  copyArrayIfFound(skill, 'currentHpPct', extractHpPct(first || text, 'current'));
  copyArrayIfFound(skill, 'maxHpPct', extractHpPct(first || text, 'max'));
  copyArrayIfFound(skill, 'secondCurrentHpPct', extractHpPct(second || text, 'current'));
  copyArrayIfFound(skill, 'secondMaxHpPct', extractHpPct(second || text, 'max'));
  copyArrayIfFound(skill, 'heal', extractLevelValue(text, ['회복', 'heal', 'healing']));
  copyArrayIfFound(skill, 'shield', extractLevelValue(text, ['보호막', 'shield', 'barrier']));

  const ampScales = matchAllNumberSequences(text, /(?:스킬\s*증폭|스증|skill\s*amp|amp)[^+\-\d]{0,20}([+-]?\d+(?:\.\d+)?)\s*(%)?/i);
  const firstAmp = extractSkillAmpScale(first || text);
  const secondAmp = second ? extractSkillAmpScale(second) : 0;
  if (firstAmp > 0) {
    skill.firstSkillAmpScale = firstAmp;
    skill.skillAmpScale = firstAmp;
  } else if (ampScales.length > 0) {
    const raw = cleanNumber(ampScales[0], 0);
    const scale = raw > 5 ? raw / 100 : raw;
    skill.firstSkillAmpScale = Math.max(0, scale);
    skill.skillAmpScale = Math.max(0, scale);
  }
  if (secondAmp > 0) skill.secondSkillAmpScale = secondAmp;

  if (skillSlot === 'passive') {
    skill.statModifiers = extractStatModifiers(text);
    skill.type = 'passive_stat';
    skill.trigger = 'always';
    skill.cooldownSec = 0;
  } else if (skill.recastWindowSec > 0 || /다시|재사용|재발동|한\s*번\s*더|한번\s*더|2타|recast/i.test(text)) {
    skill.statModifiers = {};
    skill.type = 'basic_attack_recast';
  } else {
    skill.statModifiers = {};
    skill.type = skill.type === 'passive_stat' ? 'combat_effect' : skill.type;
  }

  skill.tags = buildTags(text, skill);
  skill.targetPriority = inferTargetPriority(text, skill);
  skill.useCondition = inferUseCondition(text);
  skill.minCasterHpPct = extractHpConditionPct(text, 'caster', 'min');
  skill.maxCasterHpPct = extractHpConditionPct(text, 'caster', 'max');
  skill.minTargetHpPct = extractHpConditionPct(text, 'target', 'min');
  skill.maxTargetHpPct = extractHpConditionPct(text, 'target', 'max');
  return {
    skill,
    warnings: buildWarnings(skill),
  };
}

export function compileNaturalQSkillDescription(sourceText, base = {}) {
  return compileNaturalSkillDescription(sourceText, base, 'q');
}

export function buildSkillCodePreview(skill = {}) {
  const normalized = normalizePreviewSkill(skill);
  return `const ${normalized.slot}Skill = ${JSON.stringify(normalized, null, 2)};`;
}

export function buildQSkillCodePreview(skill = {}) {
  return buildSkillCodePreview({ ...skill, slot: 'q' });
}
