export const CIVILIZATION_STYLE_NAME_OVERRIDES = Object.freeze({
  FIREMAKING: '불의 이용',
  STONE_TOOLS: '석기',
  CORDAGE: '끈 제작',
  HERBALISM: '약초학',
  SHELTER: '주거',
  CRAFTSMANSHIP: '장인 기술',
  ORAL_RECORDS: '구전 전통',
  TRAPPING: '덫',
  ARCHIVE: '기록 보존',
  BRONZE_WORKING: '청동기 가공',
  BASIC_SAILING: '항해',
  BOOKCRAFT: '제본술',
  LIBRARY: '도서관',
  OBSIDIAN_KNAPPING: '흑요석 세공',
  EARLY_THEOLOGY: '신학',
  BASIC_MATH: '수학',
  BASIC_PHILOSOPHY: '철학',
  EARLY_CONSTRUCTION: '건축술',
  EARLY_CIVIL_ENGINEERING: '토목 공학',
  FORTIFICATION: '방어 시설',
  ASTRONOMY_EARLY: '천문학',
  ROAD_BUILDING: '도로망',
  MEDICAL_CORPUS: '의학',
  LEVER_MECHANICS: '지레 원리',
  CROP_CALENDAR: '농경력',
  REPUBLICAN_COUNCIL: '공화정',
  CIVIC_LAW: '법전',
  EARLY_ART: '미술',
  EARLY_MUSIC: '음악',
  EARLY_HORSEBACK: '기마술',
  EARLY_IRONWORKING: '철기 가공',
  BASIC_SHIPBUILDING: '조선술',
  EARLY_CURRENCY: '화폐',
  EARLY_OPTICS: '광학',
  FEUDAL_CONTRACT: '봉건제',
  GUILD_SYSTEM: '길드',
  UNIVERSITY_TRADITION: '대학 제도',
  ADVANCED_METALLURGY: '금속 주조',
  DEEP_WATER_SHIPBUILDING: '대양 조선술',
  IMPROVED_AGRICULTURE: '농업 개량',
  CODIFIED_THEOLOGY: '교리',
  MOVABLE_TYPE_PRINTING: '인쇄술',
  GUNPOWDER_MILL: '화약',
  OCEANIC_CARTOGRAPHY: '대양 지도 제작',
  ARQUEBUS: '화승총',
  GALLEON_SHIPBUILDING: '갤리온',
  FIELD_ARTILLERY: '야전 포병',
  PHARMACOPOEIA: '약전',
  EARLY_STEAM_ENGINE: '증기력',
  CLASSICAL_MECHANICS: '역학',
  MODERN_AGRONOMY: '농학',
  STANDING_ARMY: '상비군',
  EMPIRICISM: '경험론',
  PATRONAGE_CULTURE: '후원제',
  CONFESSIONAL_TOLERANCE: '종교 관용',
  BUREAUCRATIC_STATE: '관료제',
  MILITARY_REVOLUTION: '군사 혁명',
  ENLIGHTENED_THEOLOGY: '자연신학',
  SOCIAL_CONTRACT: '사회 계약',
  CONSTITUTIONAL_ASSEMBLY: '입헌주의',
});

export const ADVANCEMENT_QUOTE_CATALOG = Object.freeze({
  labor: {
    text: '일은 수치가 아니다. 게으름이 수치다.',
    author: '헤시오도스',
    work: '일과 나날',
    sourceUrl: 'https://www.gutenberg.org/files/348/348-h/348-h.htm',
  },
  fire: {
    text: '제우스가 불을 숨겼으나, 프로메테우스는 그것을 다시 인간에게 가져왔다.',
    author: '헤시오도스',
    work: '일과 나날',
    sourceUrl: 'https://www.gutenberg.org/files/348/348-h/348-h.htm',
  },
  navigation: {
    text: '알맞은 항해일을 기다렸다가 빠른 배를 바다로 끌어내려라.',
    author: '헤시오도스',
    work: '일과 나날',
    sourceUrl: 'https://www.gutenberg.org/files/348/348-h/348-h.htm',
  },
  medicine: {
    text: '인생은 짧고, 의술은 길며, 기회는 덧없다.',
    author: '히포크라테스',
    work: '격언',
    sourceUrl: 'https://www.gutenberg.org/cache/epub/67833/pg67833-images.html',
  },
  architecture: {
    text: '모든 건축은 견고함, 편리함, 아름다움을 고려해야 한다.',
    author: '비트루비우스',
    work: '건축십서',
    sourceUrl: 'https://www.gutenberg.org/files/20239/20239-h/20239-h.htm',
  },
  mathematics: {
    text: '기하학에는 왕도가 없다.',
    author: '유클리드',
    work: '프로클로스가 전한 일화',
    sourceUrl: 'https://www.gutenberg.org/files/37681/37681-h/37681-h.htm',
  },
  mechanics: {
    text: '내게 설 자리를 주면 지구를 움직이겠다.',
    author: '아르키메데스',
    work: '플루타르코스가 전한 일화',
    sourceUrl: 'https://www.gutenberg.org/cache/epub/35550/pg35550-images.html',
  },
  military: {
    text: '옛 명장은 먼저 패배할 수 없는 태세를 갖춘 뒤, 적을 이길 기회를 기다렸다.',
    author: '손자',
    work: '손자병법',
    sourceUrl: 'https://www.gutenberg.org/files/17405/17405-h/17405-h.htm',
  },
  polity: {
    text: '인간은 본성상 정치적 동물이다.',
    author: '아리스토텔레스',
    work: '정치학',
    sourceUrl: 'https://www.gutenberg.org/files/6762/6762-h/6762-h.htm',
  },
  law: {
    text: '법이 끝나는 곳에서 폭정이 시작된다.',
    author: '존 로크',
    work: '통치론 제2편',
    sourceUrl: 'https://www.gutenberg.org/files/7370/7370-h/7370-h',
  },
  liberty: {
    text: '인간은 자유롭게 태어났지만, 어디서나 사슬에 묶여 있다.',
    author: '장 자크 루소',
    work: '사회계약론',
    sourceUrl: 'https://www.gutenberg.org/files/46333/46333-h/46333-h.htm',
  },
  economy: {
    text: '노동 생산력의 가장 큰 향상은 분업의 결과로 보인다.',
    author: '애덤 스미스',
    work: '국부론',
    sourceUrl: 'https://www.gutenberg.org/files/3300/3300-h/3300-h',
  },
  faith: {
    text: '우리 마음은 당신 안에서 쉴 때까지 안식을 얻지 못합니다.',
    author: '아우구스티누스',
    work: '고백록',
    sourceUrl: 'https://www.gutenberg.org/files/3296/3296-h/3296-h.htm',
  },
  inquiry: {
    text: '지식과 인간의 힘은 하나다.',
    author: '프랜시스 베이컨',
    work: '신기관',
    sourceUrl: 'https://www.gutenberg.org/files/45988/45988-h/45988-h.htm',
  },
  experiment: {
    text: '자연은 복종함으로써만 정복된다.',
    author: '프랜시스 베이컨',
    work: '신기관',
    sourceUrl: 'https://www.gutenberg.org/files/45988/45988-h/45988-h.htm',
  },
  records: {
    text: '독서는 사람을 충실하게 하고, 토론은 준비되게 하며, 글쓰기는 정확하게 한다.',
    author: '프랜시스 베이컨',
    work: '수상록 - 학문에 대하여',
    sourceUrl: 'https://www.gutenberg.org/files/575/575-h/575-h.htm',
  },
  nature: {
    text: '자연은 가장 작은 작품에서 가장 완전하게 드러난다.',
    author: '대 플리니우스',
    work: '박물지',
    sourceUrl: 'https://www.gutenberg.org/cache/epub/59131/pg59131-images.html',
  },
  astronomy: {
    text: '더 멀리 보았다면, 거인의 어깨 위에 서 있었기 때문이다.',
    author: '아이작 뉴턴',
    work: '로버트 훅에게 보낸 편지',
    sourceUrl: 'https://www.gutenberg.org/cache/epub/39142/pg39142-images.html',
  },
  drama: {
    text: '온 세상은 무대이고, 모든 남녀는 배우일 뿐이다.',
    author: '윌리엄 셰익스피어',
    work: '뜻대로 하세요',
    sourceUrl: 'https://www.gutenberg.org/ebooks/1523',
  },
  time: {
    text: '그렇다면 시간이란 무엇인가?',
    author: '아우구스티누스',
    work: '고백록 제11권',
    sourceUrl: 'https://www.gutenberg.org/files/3296/3296-h/3296-h.htm',
  },
  philosophy: {
    text: '나는 생각한다. 그러므로 나는 존재한다.',
    author: '르네 데카르트',
    work: '방법서설',
    sourceUrl: 'https://www.gutenberg.org/files/59/59-h/59-h.htm',
  },
  humanism: {
    text: '나는 인간이다. 인간적인 어떤 것도 나와 무관하지 않다.',
    author: '테렌티우스',
    work: '자기 자신을 괴롭히는 자',
    sourceUrl: 'https://www.gutenberg.org/ebooks/39526',
  },
});

const QUOTE_ASSIGNMENTS = Object.freeze({
  fire: ['FIREMAKING', 'HEARTH', 'POTTERY'],
  navigation: [
    'CARTOGRAPHY', 'BASIC_SAILING', 'BASIC_SHIPBUILDING', 'HULL_FRAMING', 'LATEEN_SAIL',
    'NAVIGATION', 'OCEAN_NAVIGATION', 'DEEP_WATER_SHIPBUILDING', 'OCEANIC_CARTOGRAPHY',
    'CELESTIAL_NAVIGATION', 'GALLEON_SHIPBUILDING', 'SHIP_OF_THE_LINE', 'MARITIME_LAW',
  ],
  medicine: [
    'HERBALISM', 'MEDICAL_CORPUS', 'SURGICAL_TOOLS', 'HERBAL_MEDICINE', 'MEDIEVAL_MEDICINE',
    'ANATOMICAL_STUDY', 'PHARMACOPOEIA', 'POOR_RELIEF', 'PUBLIC_HEALTH',
  ],
  architecture: [
    'SHELTER', 'SETTLEMENT', 'EARLY_CONSTRUCTION', 'EARLY_CIVIL_ENGINEERING', 'FORTIFICATION',
    'ROAD_BUILDING', 'AQUEDUCT_ENGINEERING', 'MASONRY_VAULTS', 'CASTLE_ENGINEERING',
    'TRACE_ITALIENNE', 'URBAN_CHARTER',
  ],
  mathematics: ['COUNTING', 'BASIC_MATH', 'EARLY_OPTICS', 'OPTICAL_INSTRUMENTS'],
  mechanics: [
    'STONE_TOOLS', 'CRAFTSMANSHIP', 'ADVANCED_CARVING', 'LEVER_MECHANICS', 'WATERMILL',
    'WINDMILL', 'MECHANICAL_CLOCK', 'MECHANICAL_ENGINEERING', 'DRAINAGE_PUMP', 'STEAM_PUMP',
    'PRECISION_CLOCK', 'EARLY_STEAM_ENGINE', 'CLASSICAL_MECHANICS',
  ],
  military: [
    'HUNTING', 'ARCHERY', 'TRAPPING', 'OBSIDIAN_KNAPPING', 'MEGAFAUNA_HIDE',
    'MILITARY_TRADITION', 'ATHLETIC_GAMES', 'EARLY_HORSEBACK', 'EARLY_IRONWORKING',
    'STEEL_QUENCHING', 'MILITARY_TRAINING', 'DEFENSE_TACTICS', 'CHAINMAIL', 'CHIVALRIC_CODE',
    'MILITARY_ORDERS', 'CASTLE_ENGINEERING', 'PLATE_ARMOR', 'GUNPOWDER_MILL', 'ARQUEBUS',
    'TRACE_ITALIENNE', 'FIELD_ARTILLERY', 'STANDING_ARMY', 'MILITARY_REVOLUTION',
    'PROFESSIONAL_OFFICERS', 'SHIP_OF_THE_LINE',
  ],
  law: ['CIVIC_LAW', 'IMPERIAL_ADMINISTRATION', 'MARITIME_LAW', 'BUREAUCRATIC_STATE'],
  liberty: ['REPUBLICAN_COUNCIL', 'CONFESSIONAL_TOLERANCE', 'SOCIAL_CONTRACT', 'CONSTITUTIONAL_ASSEMBLY'],
  economy: ['FOREIGN_TRADE', 'EARLY_CURRENCY', 'GUILD_SYSTEM', 'STATE_WORKFORCE', 'PATRONAGE_CULTURE'],
  faith: [
    'MYSTICISM', 'EARLY_THEOLOGY', 'CIVIC_RITUAL', 'MONASTIC_RULE', 'SCHOLASTICISM',
    'CATHEDRAL_SCHOOLS', 'SACRED_MUSIC', 'CODIFIED_THEOLOGY', 'REFORMATION',
    'CONFESSIONAL_TOLERANCE', 'ENLIGHTENED_THEOLOGY',
  ],
  records: [
    'ORAL_RECORDS', 'ARCHIVE', 'WRITING', 'BOOKCRAFT', 'LIBRARY', 'CLAY_TABLETS',
    'HISTORY_RECORDS', 'CLASSICAL_EDUCATION', 'EPIC_TRADITION', 'COURT_LITERATURE',
    'CHRONICLE_WRITING', 'PAPERMAKING', 'PRINTING_BLOCKS', 'UNIVERSITY_TRADITION',
    'ROMANCE_LITERATURE', 'MOVABLE_TYPE_PRINTING', 'PRINT_WORKSHOP', 'COPPERPLATE_PRINTING',
    'PUBLIC_SPHERE',
  ],
  nature: [
    'GATHERING', 'FISHING', 'AGRICULTURE', 'ANIMAL_HUSBANDRY', 'FOOD_STORAGE', 'IRRIGATION',
    'CROP_CALENDAR', 'THREE_FIELD_SYSTEM', 'HEAVY_PLOUGH', 'CROP_ROTATION',
    'HERBAL_MEDICINE', 'IMPROVED_AGRICULTURE', 'BOTANICAL_CLASSIFICATION',
    'NEW_CROP_CULTIVATION', 'SEED_SELECTION', 'MODERN_AGRONOMY',
  ],
  astronomy: ['ASTROLOGY', 'ASTRONOMY_EARLY', 'CELESTIAL_NAVIGATION', 'MICROSCOPE', 'SCIENTIFIC_SOCIETY'],
  drama: ['DRAMA', 'POETRY', 'RHETORIC', 'EARLY_ART', 'EARLY_MUSIC', 'SACRED_MUSIC'],
  time: ['CALENDAR', 'CROP_CALENDAR', 'MECHANICAL_CLOCK', 'PRECISION_CLOCK'],
  philosophy: [
    'BASIC_PHILOSOPHY', 'CLASSICAL_PHILOSOPHY', 'NATURAL_PHILOSOPHY', 'EMPIRICISM',
    'SCIENTIFIC_METHOD', 'ENLIGHTENMENT',
  ],
  humanism: ['HUMANISM', 'RENAISSANCE_HUMANISM', 'PUBLIC_DEBATE', 'PUBLIC_SPHERE'],
});

const QUOTE_KEY_BY_ADVANCEMENT_ID = Object.freeze(Object.fromEntries(
  Object.entries(QUOTE_ASSIGNMENTS).flatMap(([quoteKey, ids]) => ids.map((id) => [id, quoteKey])),
));

function fallbackQuoteKey(advancement) {
  const tags = advancement.tags || [];
  if (tags.includes('SPIRITUAL')) return 'faith';
  if (tags.includes('MILITARY')) return 'military';
  if (tags.includes('CIVICS')) return 'polity';
  if (tags.includes('CULTURE')) return 'records';
  if (tags.includes('SCIENCE')) return 'inquiry';
  if (tags.includes('CRAFT') || tags.includes('CAMP')) return 'experiment';
  return 'labor';
}

export function withAdvancementLore(advancement) {
  const quoteKey = QUOTE_KEY_BY_ADVANCEMENT_ID[advancement.id] || fallbackQuoteKey(advancement);
  return {
    ...advancement,
    name: CIVILIZATION_STYLE_NAME_OVERRIDES[advancement.id] || advancement.name,
    quote: {
      ...ADVANCEMENT_QUOTE_CATALOG[quoteKey],
      key: quoteKey,
    },
  };
}
