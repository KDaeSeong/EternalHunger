export const GAME_SLUG = 'ba-vanguard';
export const QUICK_SAVE_SLOT = 'ba-vanguard-main';
export const SAVE_VERSION = 'ba-vanguard-v1';

export const DEFAULT_RULES = {
  mainSize: 50,
  triggerSize: 16,
  starterSize: 1,
  gZoneMax: 16,
  maxCopies: 4,
  recommendedGrade3: 8,
  minGGuardians: 2,
  allowMixedClan: false,
};

const CLANS = [
  {
    key: 'gehenna',
    label: 'Gehenna',
    tone: 'red',
    lead: 'Hina',
    support: 'Makoto',
    style: 'pressure',
  },
  {
    key: 'trinity',
    label: 'Trinity',
    tone: 'blue',
    lead: 'Mika',
    support: 'Nagisa',
    style: 'guard',
  },
  {
    key: 'millennium',
    label: 'Millennium',
    tone: 'violet',
    lead: 'Yuuka',
    support: 'Noa',
    style: 'combo',
  },
];

function clanCards(clan) {
  const prefix = clan.key.slice(0, 3).toUpperCase();
  return [
    {
      id: `${prefix}_ST_001`,
      name: `${clan.label} Starter`,
      clan: clan.label,
      type: 'starter',
      grade: 0,
      power: 6000,
      shield: 0,
      text: 'First vanguard. Moves to soul after the first ride.',
      tone: clan.tone,
      tags: ['starter', clan.style],
    },
    ...['critical', 'draw', 'stand', 'heal'].map((trigger) => ({
      id: `${prefix}_TR_${trigger.toUpperCase()}`,
      name: `${clan.label} ${trigger} trigger`,
      clan: clan.label,
      type: 'trigger',
      trigger,
      grade: 0,
      power: 5000,
      shield: 10000,
      text: `${trigger} trigger. +10000 power and trigger effect in drive or damage check.`,
      tone: clan.tone,
      tags: ['trigger', trigger],
    })),
    {
      id: `${prefix}_PG_001`,
      name: `${clan.label} perfect guard`,
      clan: clan.label,
      type: 'sentinel',
      grade: 1,
      power: 7000,
      shield: 0,
      text: 'Sentinel. Discard one card to fully guard one attack.',
      tone: clan.tone,
      tags: ['sentinel', 'guard'],
    },
    {
      id: `${prefix}_G1_001`,
      name: `${clan.support} tactical aide`,
      clan: clan.label,
      type: 'normal',
      grade: 1,
      power: 8000,
      shield: 5000,
      text: 'When called, draw one card in the playtest log.',
      tone: clan.tone,
      tags: ['grade1', 'draw'],
    },
    {
      id: `${prefix}_G1_002`,
      name: `${clan.label} field operator`,
      clan: clan.label,
      type: 'normal',
      grade: 1,
      power: 8000,
      shield: 5000,
      text: 'Boosted attacks get +2000 in the simplified playtest.',
      tone: clan.tone,
      tags: ['grade1', 'boost'],
    },
    {
      id: `${prefix}_G1_003`,
      name: `${clan.label} reserve student`,
      clan: clan.label,
      type: 'normal',
      grade: 1,
      power: 7000,
      shield: 5000,
      text: 'Flexible grade 1 slot for clean 50-card preset construction.',
      tone: clan.tone,
      tags: ['grade1'],
    },
    {
      id: `${prefix}_G2_001`,
      name: `${clan.label} frontliner`,
      clan: clan.label,
      type: 'normal',
      grade: 2,
      power: 10000,
      shield: 5000,
      text: 'Gets +3000 when attacking a vanguard in the simplified test.',
      tone: clan.tone,
      tags: ['grade2', 'attack'],
    },
    {
      id: `${prefix}_G2_002`,
      name: `${clan.label} interceptor`,
      clan: clan.label,
      type: 'normal',
      grade: 2,
      power: 9000,
      shield: 5000,
      text: 'Can intercept from the front row during guard simulation.',
      tone: clan.tone,
      tags: ['grade2', 'intercept'],
    },
    {
      id: `${prefix}_G2_003`,
      name: `${clan.label} tactical reserve`,
      clan: clan.label,
      type: 'normal',
      grade: 2,
      power: 9000,
      shield: 5000,
      text: 'Single-copy bridge slot used by the imported sample deck.',
      tone: clan.tone,
      tags: ['grade2'],
    },
    {
      id: `${prefix}_G3_001`,
      name: `${clan.lead} vanguard`,
      clan: clan.label,
      type: 'normal',
      grade: 3,
      power: 13000,
      shield: 0,
      text: 'Main grade 3 ride target. Enables the clan stride plan.',
      tone: clan.tone,
      tags: ['grade3', 'vanguard', clan.style],
    },
    {
      id: `${prefix}_G3_002`,
      name: `${clan.support} grade 3`,
      clan: clan.label,
      type: 'normal',
      grade: 3,
      power: 13000,
      shield: 0,
      text: 'Secondary grade 3 target. Keeps the ride line stable.',
      tone: clan.tone,
      tags: ['grade3', 'backup'],
    },
    {
      id: `${prefix}_GU_001`,
      name: `${clan.label} stride unit`,
      clan: clan.label,
      type: 'g-unit',
      grade: 4,
      power: 15000,
      shield: 0,
      text: 'Stride unit. Gains power from rear-guard pressure in the prototype.',
      tone: clan.tone,
      tags: ['gzone', 'stride'],
    },
    {
      id: `${prefix}_GU_002`,
      name: `${clan.label} finisher stride`,
      clan: clan.label,
      type: 'g-unit',
      grade: 4,
      power: 15000,
      shield: 0,
      text: 'Finisher stride used in the sample G zone.',
      tone: clan.tone,
      tags: ['gzone', 'finisher'],
    },
    {
      id: `${prefix}_GG_001`,
      name: `${clan.label} G guardian`,
      clan: clan.label,
      type: 'g-guardian',
      grade: 4,
      power: 0,
      shield: 15000,
      text: 'G guardian. Adds shield during guard simulation.',
      tone: clan.tone,
      tags: ['gzone', 'guard'],
    },
    {
      id: `${prefix}_GG_002`,
      name: `${clan.label} emergency guard`,
      clan: clan.label,
      type: 'g-guardian',
      grade: 4,
      power: 0,
      shield: 15000,
      text: 'Second G guardian slot for rule recommendation checks.',
      tone: clan.tone,
      tags: ['gzone', 'guard'],
    },
  ];
}

export const CARDS = CLANS.flatMap(clanCards);
export const CARD_MAP = new Map(CARDS.map((card) => [card.id, card]));

function idFor(clanKey, suffix) {
  return `${clanKey.slice(0, 3).toUpperCase()}_${suffix}`;
}

function presetFor(clan) {
  return {
    id: `preset_${clan.key}`,
    name: `${clan.label} P-G sample deck`,
    clan: clan.label,
    description: `${clan.lead}/${clan.support} 중심의 imported BA Vanguard sample slice입니다.`,
    main: [
      { cardId: idFor(clan.key, 'ST_001'), count: 1 },
      { cardId: idFor(clan.key, 'TR_CRITICAL'), count: 4 },
      { cardId: idFor(clan.key, 'TR_DRAW'), count: 4 },
      { cardId: idFor(clan.key, 'TR_STAND'), count: 4 },
      { cardId: idFor(clan.key, 'TR_HEAL'), count: 4 },
      { cardId: idFor(clan.key, 'PG_001'), count: 4 },
      { cardId: idFor(clan.key, 'G1_001'), count: 4 },
      { cardId: idFor(clan.key, 'G1_002'), count: 4 },
      { cardId: idFor(clan.key, 'G1_003'), count: 4 },
      { cardId: idFor(clan.key, 'G2_001'), count: 4 },
      { cardId: idFor(clan.key, 'G2_002'), count: 4 },
      { cardId: idFor(clan.key, 'G2_003'), count: 1 },
      { cardId: idFor(clan.key, 'G3_001'), count: 4 },
      { cardId: idFor(clan.key, 'G3_002'), count: 4 },
    ],
    gzone: [
      { cardId: idFor(clan.key, 'GU_001'), count: 4 },
      { cardId: idFor(clan.key, 'GU_002'), count: 4 },
      { cardId: idFor(clan.key, 'GG_001'), count: 2 },
      { cardId: idFor(clan.key, 'GG_002'), count: 2 },
    ],
  };
}

export const PRESET_DECKS = CLANS.map(presetFor);

export function expandEntries(entries) {
  const out = [];
  (Array.isArray(entries) ? entries : []).forEach((entry) => {
    const count = Math.max(0, Number(entry.count || 0));
    for (let index = 0; index < count; index += 1) out.push(entry.cardId);
  });
  return out;
}

export function getCard(cardId) {
  return CARD_MAP.get(cardId) || null;
}

export function cardName(cardId) {
  return getCard(cardId)?.name || cardId;
}

export function getPreset(presetId) {
  return PRESET_DECKS.find((preset) => preset.id === presetId) || PRESET_DECKS[0];
}

export function countEntries(entries) {
  return (Array.isArray(entries) ? entries : []).reduce((sum, entry) => sum + Number(entry.count || 0), 0);
}

export function validateDeck(deck, rules = DEFAULT_RULES) {
  const errors = [];
  const warnings = [];
  const mainIds = expandEntries(deck?.main);
  const gIds = expandEntries(deck?.gzone);
  const mainCards = mainIds.map(getCard).filter(Boolean);
  const gCards = gIds.map(getCard).filter(Boolean);
  const allEntries = [...(deck?.main || []), ...(deck?.gzone || [])];

  if (mainIds.length !== rules.mainSize) errors.push(`메인 덱은 ${rules.mainSize}장이어야 합니다. 현재 ${mainIds.length}장입니다.`);
  if (gIds.length > rules.gZoneMax) errors.push(`G존은 최대 ${rules.gZoneMax}장입니다. 현재 ${gIds.length}장입니다.`);

  allEntries.forEach((entry) => {
    const card = getCard(entry.cardId);
    if (!card) errors.push(`알 수 없는 카드: ${entry.cardId}`);
    if (Number(entry.count || 0) > rules.maxCopies) errors.push(`${card?.name || entry.cardId}는 ${rules.maxCopies}장까지만 넣을 수 있습니다.`);
    if (Number(entry.count || 0) < 0) errors.push(`${card?.name || entry.cardId}의 매수가 음수입니다.`);
  });

  const triggers = mainCards.filter((card) => card.type === 'trigger');
  const heals = triggers.filter((card) => card.trigger === 'heal');
  const starters = mainCards.filter((card) => card.type === 'starter');
  const sentinels = mainCards.filter((card) => card.type === 'sentinel');
  const grade3 = mainCards.filter((card) => card.type === 'normal' && Number(card.grade || 0) === 3);
  const clans = new Set([...mainCards, ...gCards].map((card) => card.clan));

  if (triggers.length !== rules.triggerSize) errors.push(`트리거는 ${rules.triggerSize}장이어야 합니다. 현재 ${triggers.length}장입니다.`);
  if (heals.length > rules.maxCopies) errors.push(`힐 트리거는 최대 ${rules.maxCopies}장입니다. 현재 ${heals.length}장입니다.`);
  if (starters.length !== rules.starterSize) errors.push(`스타터는 ${rules.starterSize}장이어야 합니다. 현재 ${starters.length}장입니다.`);
  if (sentinels.length > rules.maxCopies) errors.push(`센티널은 최대 ${rules.maxCopies}장입니다. 현재 ${sentinels.length}장입니다.`);
  if (!rules.allowMixedClan && clans.size > 1) errors.push(`클랜이 섞여 있습니다: ${[...clans].join(', ')}`);
  if (grade3.length !== rules.recommendedGrade3) warnings.push(`권장 G3 매수는 ${rules.recommendedGrade3}장입니다. 현재 ${grade3.length}장입니다.`);

  gCards.forEach((card) => {
    if (card.type !== 'g-unit' && card.type !== 'g-guardian') errors.push(`G존에는 G 유닛/G 가디언만 들어갈 수 있습니다: ${card.name}`);
  });
  const guardians = gCards.filter((card) => card.type === 'g-guardian').length;
  if (gIds.length > 0 && guardians < rules.minGGuardians) warnings.push(`G 가디언은 최소 ${rules.minGGuardians}장 이상을 권장합니다. 현재 ${guardians}장입니다.`);

  return { errors, warnings };
}

export function summarizeDeck(deck) {
  const mainCards = expandEntries(deck?.main).map(getCard).filter(Boolean);
  const gCards = expandEntries(deck?.gzone).map(getCard).filter(Boolean);
  const gradeCounts = [0, 1, 2, 3, 4].map((grade) => ({
    grade,
    count: [...mainCards, ...gCards].filter((card) => Number(card.grade || 0) === grade).length,
  }));
  const shield = mainCards.reduce((sum, card) => sum + Number(card.shield || 0), 0);
  const power = mainCards.reduce((sum, card) => sum + Number(card.power || 0), 0);
  return {
    mainCount: mainCards.length,
    gCount: gCards.length,
    triggerCount: mainCards.filter((card) => card.type === 'trigger').length,
    grade3Count: mainCards.filter((card) => card.type === 'normal' && Number(card.grade || 0) === 3).length,
    clan: deck?.clan || mainCards[0]?.clan || '',
    gradeCounts,
    averagePower: mainCards.length ? Math.round(power / mainCards.length) : 0,
    totalShield: shield,
  };
}

export function shuffle(values, seed = Date.now()) {
  const next = [...values];
  let r = Number(seed || 1) >>> 0;
  const rand = () => {
    r = (r * 1664525 + 1013904223) % 4294967296;
    return r / 4294967296;
  };
  for (let index = next.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(rand() * (index + 1));
    [next[index], next[swap]] = [next[swap], next[index]];
  }
  return next;
}

export function drawOpeningHand(deck, seed = Date.now(), size = 5) {
  return shuffle(expandEntries(deck?.main), seed).slice(0, size);
}

export function scoreDeck(deck) {
  const validation = validateDeck(deck);
  const summary = summarizeDeck(deck);
  return Math.max(0, Math.round(
    1000
    + summary.mainCount * 8
    + summary.gCount * 12
    + summary.triggerCount * 20
    + summary.grade3Count * 16
    - validation.errors.length * 220
    - validation.warnings.length * 55
  ));
}
