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
  tools: {
    text: '도움 없는 손과 홀로 남겨진 이해력은 힘이 거의 없다. 결과는 도구와 보조 수단을 통해 만들어진다.',
    author: '프랜시스 베이컨',
    work: '신기관',
    sourceUrl: 'https://www.gutenberg.org/files/45988/45988-h/45988-h.htm',
  },
  fire: {
    text: '제우스가 불을 숨겼으나, 프로메테우스는 그것을 다시 인간에게 가져왔다.',
    author: '헤시오도스',
    work: '일과 나날',
    sourceUrl: 'https://www.gutenberg.org/files/348/348-h/348-h.htm',
  },
  pottery: {
    text: '진흙이 토기장이의 손에 있음 같이, 너희도 내 손에 있다.',
    author: '예레미야',
    work: '예레미야서 18장',
    sourceUrl: 'https://www.gutenberg.org/ebooks/10',
  },
  navigation: {
    text: '알맞은 항해일을 기다렸다가 빠른 배를 바다로 끌어내려라.',
    author: '헤시오도스',
    work: '일과 나날',
    sourceUrl: 'https://www.gutenberg.org/files/348/348-h/348-h.htm',
  },
  cartography: {
    text: '지도 제작은 알려진 세계와 그 안의 현상을 하나의 그림으로 나타내는 일이다.',
    author: '클라우디오스 프톨레마이오스',
    work: '지리학',
    sourceUrl: 'https://apps.lib.umn.edu/bell/map/PTO/GEO/mainptg.html',
  },
  shipbuilding: {
    text: '그는 재목을 다듬고 맞추어 튼튼한 상선의 바닥처럼 넓은 배를 만들었다.',
    author: '호메로스',
    work: '오디세이아 제5권',
    sourceUrl: 'https://www.gutenberg.org/cache/epub/1728/pg1728-images.html',
  },
  hunting: {
    text: '사냥은 전쟁을 위한 최고의 훈련이며 기마술을 익히는 가장 확실한 길이다.',
    author: '크세노폰',
    work: '키루스의 교육',
    sourceUrl: 'https://www.gutenberg.org/files/2085/2085-h/2085-h.htm',
  },
  fishing: {
    text: '낚시는 말이 아니라 실천으로 배워야 한다.',
    author: '아이작 월턴',
    work: '낚시대전',
    sourceUrl: 'https://www.gutenberg.org/cache/epub/683/pg683.html',
  },
  agriculture: {
    text: '여러 기술이 생겨났고, 고된 노동이 모든 것을 이겼다.',
    author: '베르길리우스',
    work: '농경시',
    sourceUrl: 'https://www.gutenberg.org/files/232/232-h/232-h.htm',
  },
  husbandry: {
    text: '말이 바라는 대로 움직였을 때 친절로 보답하면, 자기 임무를 더 잘 배운다.',
    author: '크세노폰',
    work: '승마술',
    sourceUrl: 'https://www.gutenberg.org/files/1176/1176-h/1176-h.htm',
  },
  medicine: {
    text: '인생은 짧고, 의술은 길며, 기회는 덧없다.',
    author: '히포크라테스',
    work: '격언',
    sourceUrl: 'https://classics.mit.edu/Hippocrates/aphorisms.1.i.html',
    sourceSection: '제1편 1절',
  },
  architecture: {
    text: '모든 건축은 견고함, 편리함, 아름다움을 고려해야 한다.',
    author: '비트루비우스',
    work: '건축십서',
    sourceUrl: 'https://www.gutenberg.org/files/20239/20239-h/20239-h.htm',
  },
  aqueduct: {
    text: '수많은 물을 나르는 이 필수 구조물들을 쓸모없는 피라미드와 어찌 비교하겠는가.',
    author: '섹스투스 율리우스 프론티누스',
    work: '로마의 수도에 관하여',
    sourceUrl: 'https://penelope.uchicago.edu/Thayer/E/Roman/Texts/Frontinus/De_Aquis/Bennett/1%2A.html',
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
  waterPower: {
    text: '강물의 흐름이 물받이를 밀어 바퀴를 돌리고, 사람의 발힘 없이 필요한 일을 해낸다.',
    author: '비트루비우스',
    work: '건축십서 제10권',
    sourceUrl: 'https://www.gutenberg.org/files/20239/20239-h/20239-h.htm',
  },
  windPower: {
    text: '저것들은 거인이 아니라 풍차이며, 팔처럼 보이는 것은 바람이 돌려 맷돌을 움직이는 날개입니다.',
    author: '미겔 데 세르반테스',
    work: '돈키호테 제1부 제8장',
    sourceUrl: 'https://www.gutenberg.org/cache/epub/5921/pg5921-images.html',
  },
  steam: {
    text: '열이 운동을 만들어 낸다는 것은 누구나 안다. 증기기관이 널리 알려진 지금, 그 거대한 동력을 의심할 수 없다.',
    author: '사디 카르노',
    work: '열의 동력에 관한 고찰',
    sourceUrl: 'https://www.gutenberg.org/ebooks/78610',
  },
  refrigeration: {
    text: '동력을 낳으려면 열뿐 아니라 냉기도 필요하다. 냉기가 없다면 열은 쓸모가 없다.',
    author: '사디 카르노',
    work: '열의 동력에 관한 고찰',
    sourceUrl: 'https://www.gutenberg.org/ebooks/78610',
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
  trade: {
    text: '사람에게는 한 물건을 다른 물건과 교환하고 거래하려는 성향이 있다.',
    author: '애덤 스미스',
    work: '국부론',
    sourceUrl: 'https://www.gutenberg.org/files/3300/3300-h/3300-h',
  },
  currency: {
    text: '교역의 불편을 덜기 위해 운반하기 쉬운 물건을 정하고, 마침내 그 가치의 표지를 새겼다.',
    author: '아리스토텔레스',
    work: '정치학',
    sourceUrl: 'https://www.gutenberg.org/files/6762/6762-h/6762-h.htm',
  },
  industry: {
    text: '분업이 진전될수록 같은 수의 사람이 해낼 수 있는 일의 양은 크게 늘어난다.',
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
  oralTradition: {
    text: '살아 있고 영혼을 지닌 지식의 말에 비하면, 글로 적힌 말은 그 그림자일 뿐이다.',
    author: '플라톤',
    work: '파이드로스',
    sourceUrl: 'https://www.gutenberg.org/files/1636/1636-h/1636-h.htm',
  },
  writing: {
    text: '글자는 기억 그 자체가 아니라, 기억을 되살리는 도움이다.',
    author: '플라톤',
    work: '파이드로스',
    sourceUrl: 'https://www.gutenberg.org/files/1636/1636-h/1636-h.htm',
  },
  history: {
    text: '역사는 시대의 증인이며, 진리의 빛이고, 기억의 삶이며, 인생의 스승이다.',
    author: '마르쿠스 툴리우스 키케로',
    work: '웅변가론',
    sourceUrl: 'https://www.gutenberg.org/ebooks/9776',
  },
  education: {
    text: '교육이 처음 사람을 이끄는 방향이 그의 장래를 결정한다.',
    author: '플라톤',
    work: '국가',
    sourceUrl: 'https://www.gutenberg.org/ebooks/1497',
  },
  nature: {
    text: '자연은 가장 작은 작품에서 가장 완전하게 드러난다.',
    author: '대 플리니우스',
    work: '박물지',
    sourceUrl: 'https://www.gutenberg.org/cache/epub/59131/pg59131-images.html',
  },
  astronomy: {
    text: '태양을 중심으로 수성, 금성, 지구, 화성, 목성, 토성의 궤도가 차례로 놓인다.',
    author: '크리스티안 하위헌스',
    work: '천체 세계의 발견',
    sourceUrl: 'https://www.gutenberg.org/files/71191/71191-h/71191-h.htm',
  },
  astrology: {
    text: '별의 본성을 아는 숙련자는 그 영향에 미리 대비할 수 있다.',
    author: '클라우디오스 프톨레마이오스',
    work: '테트라비블로스',
    sourceUrl: 'https://www.gutenberg.org/files/70850/70850-h/70850-h.htm',
  },
  drama: {
    text: '온 세상은 무대이고, 모든 남녀는 배우일 뿐이다.',
    author: '윌리엄 셰익스피어',
    work: '뜻대로 하세요',
    sourceUrl: 'https://www.gutenberg.org/ebooks/1523',
  },
  poetry: {
    text: '시는 삶의 의무를 가르치고 미래를 밝혔으며, 노동 뒤에는 즐거운 휴식을 주었다.',
    author: '호라티우스',
    work: '시학',
    sourceUrl: 'https://www.gutenberg.org/ebooks/5419',
  },
  epic: {
    text: '노래하소서, 여신이여, 펠레우스의 아들 아킬레우스의 분노를.',
    author: '호메로스',
    work: '일리아스',
    sourceUrl: 'https://www.gutenberg.org/ebooks/16452',
  },
  rhetoric: {
    text: '수사학은 변증술과 짝을 이룬다.',
    author: '아리스토텔레스',
    work: '수사학',
    sourceUrl: 'https://classics.mit.edu/Aristotle/rhetoric.1.i.html',
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
  enlightenment: {
    text: '자기 자신의 이성을 사용할 용기를 가져라.',
    author: '임마누엘 칸트',
    work: '계몽이란 무엇인가',
    sourceUrl: 'https://www.gutenberg.org/files/30821/30821-h/30821-h.htm',
  },
  utilitarianism: {
    text: '행위는 행복을 증진하는 경향에 비례하여 옳고, 그 반대를 낳는 경향에 비례하여 그르다.',
    author: '존 스튜어트 밀',
    work: '공리주의',
    sourceUrl: 'https://www.gutenberg.org/ebooks/11224',
  },
  humanism: {
    text: '나는 인간이다. 인간적인 어떤 것도 나와 무관하지 않다.',
    author: '테렌티우스',
    work: '자기 자신을 괴롭히는 자',
    sourceUrl: 'https://www.gutenberg.org/ebooks/39526',
  },
  metallurgy: {
    text: '광부는 무엇을 캐고 무엇을 남겨둘지 알 만큼 자기 일에 숙련되어야 한다.',
    author: '게오르기우스 아그리콜라',
    work: '데 레 메탈리카',
    sourceUrl: 'https://www.gutenberg.org/ebooks/38015',
  },
  steelmaking: {
    text: '철의 시대는 지나가고 강철의 시대가 그 자리를 차지할 운명이었다.',
    author: '앤드루 카네기',
    work: '자서전',
    sourceUrl: 'https://www.gutenberg.org/files/17976/17976-h/17976-h.htm',
  },
  glassmaking: {
    text: '불이 붙자 초석이 해변의 모래와 섞였고, 전에는 보지 못한 투명한 액체가 흘러나왔다.',
    author: '대 플리니우스',
    work: '박물지 제36권',
    sourceUrl: 'https://www.gutenberg.org/files/50626/50626-h/50626-h.htm',
  },
  optics: {
    text: '빛의 성질은 가설이 아니라 이성과 실험으로 제시하고 증명해야 한다.',
    author: '아이작 뉴턴',
    work: '광학',
    sourceUrl: 'https://www.gutenberg.org/files/33504/33504-h/33504-h.htm',
  },
  microscopy: {
    text: '현미경의 도움을 받으면 너무 작아서 탐구를 피할 것은 없다.',
    author: '로버트 훅',
    work: '미크로그라피아',
    sourceUrl: 'https://www.gutenberg.org/ebooks/15491',
  },
  empiricism: {
    text: '진리에 이르는 가장 좋은 길은 사물을 상상대로가 아니라 실제 모습대로 살피는 것이다.',
    author: '존 로크',
    work: '인간오성론',
    sourceUrl: 'https://www.gutenberg.org/ebooks/10615',
  },
  art: {
    text: '사람의 아름다움은 사라지지만, 예술 속의 아름다움은 사라지지 않는다.',
    author: '레오나르도 다 빈치',
    work: '노트북',
    sourceUrl: 'https://www.gutenberg.org/ebooks/5000',
  },
  music: {
    text: '음악은 교육과 영혼의 정화, 그리고 마음의 휴식에 쓰여야 한다.',
    author: '아리스토텔레스',
    work: '정치학',
    sourceUrl: 'https://www.gutenberg.org/ebooks/6762',
  },
  tolerance: {
    text: '참된 신앙은 마음속 확신에 있으므로, 외적인 힘으로 믿음을 강제할 수 없다.',
    author: '존 로크',
    work: '관용에 관한 편지',
    sourceUrl: 'https://self.gutenberg.org/wplbn0000651234-a-letter-concerning-toleration-by-locke-john.aspx',
  },
  press: {
    text: '알고 말하고 양심에 따라 자유롭게 논할 자유를 달라.',
    author: '존 밀턴',
    work: '아레오파지티카',
    sourceUrl: 'https://www.gutenberg.org/ebooks/608',
  },
  printing: {
    text: '인쇄술, 화약, 나침반은 세계의 모습과 상태를 완전히 바꾸었다.',
    author: '프랜시스 베이컨',
    work: '신기관',
    sourceUrl: 'https://www.gutenberg.org/files/45988/45988-h/45988-h.htm',
  },
  gunpowder: {
    text: '인쇄술, 화약, 나침반은 세계의 모습과 상태를 완전히 바꾸었다.',
    author: '프랜시스 베이컨',
    work: '신기관',
    sourceUrl: 'https://www.gutenberg.org/files/45988/45988-h/45988-h.htm',
  },
  monasticism: {
    text: '게으름은 영혼의 적이다. 정해진 때에는 노동하고, 정해진 때에는 성스러운 독서에 힘써야 한다.',
    author: '누르시아의 베네딕투스',
    work: '성 베네딕투스 규칙서 제48장',
    sourceUrl: 'https://en.wikisource.org/wiki/Select_Historical_Documents_of_the_Middle_Ages/Book_III/The_Rule_of_St._Benedict',
  },
  feudalLaw: {
    text: '자유인은 동료의 적법한 판결이나 국법에 의하지 않고는 체포되거나 권리를 빼앗기지 않는다.',
    author: '잉글랜드의 존 왕과 제후들',
    work: '마그나 카르타 제39조',
    sourceUrl: 'https://www.gutenberg.org/cache/epub/10000/pg10000-images.html',
  },
  chivalry: {
    text: '잔혹함을 피하고 자비를 구하는 이에게 자비를 베풀며, 부당한 싸움에 나서지 말라.',
    author: '토머스 맬러리',
    work: '아서 왕의 죽음',
    sourceUrl: 'https://www.gutenberg.org/cache/epub/1251/pg1251-images.html',
  },
  scientificSociety: {
    text: '우리 재단의 목적은 사물의 원인과 숨은 움직임을 아는 데 있다.',
    author: '프랜시스 베이컨',
    work: '새로운 아틀란티스',
    sourceUrl: 'https://www.gutenberg.org/files/2434/2434-h/2434-h.htm',
  },
  maritimeLaw: {
    text: '바다는 누구의 소유도 될 수 없을 만큼 한계가 없고, 항해와 어업을 위해 모두에게 열려 있다.',
    author: '휘호 흐로티위스',
    work: '자유해론',
    sourceUrl: 'https://www.gutenberg.org/files/75962/75962-h/75962-h.htm',
  },
  welfare: {
    text: '공공 창고를 가득 채우도록 돌본다면 어느 개인도 필요한 것을 잃지 않는다.',
    author: '토머스 모어',
    work: '유토피아',
    sourceUrl: 'https://www.gutenberg.org/files/2130/2130-h/2130-h.htm',
  },
  constitution: {
    text: '입법권과 집행권이 한 사람이나 한 기관에 합쳐지면 자유는 존재할 수 없다.',
    author: '샤를 드 몽테스키외',
    work: '법의 정신',
    sourceUrl: 'https://www.gutenberg.org/ebooks/27573',
  },
  liberalism: {
    text: '타인의 행복을 빼앗지 않는 한, 자기 방식으로 자기 행복을 추구하는 자유만이 참된 자유다.',
    author: '존 스튜어트 밀',
    work: '자유론',
    sourceUrl: 'https://gutenberg.org/files/34901/34901-h/34901-h.htm',
  },
  chemistry: {
    text: '우리는 사실만을 신뢰해야 한다. 자연이 내놓은 사실은 우리를 속이지 않는다.',
    author: '앙투안 라부아지에',
    work: '화학 원론',
    sourceUrl: 'https://www.gutenberg.org/ebooks/30775',
  },
  electricity: {
    text: '자기에서 전기를 얻으려는 희망이 나를 실험적 탐구로 이끌었다.',
    author: '마이클 패러데이',
    work: '전기 실험 연구',
    sourceUrl: 'https://www.gutenberg.org/ebooks/14986',
  },
  telegraphy: {
    text: '하느님이 무슨 일을 이루셨는가.',
    author: '새뮤얼 모스가 보낸 최초의 전신 문구',
    work: '최초의 전신 메시지, 1844년 5월 24일',
    sourceUrl: 'https://www.loc.gov/item/mcc.019/',
  },
  publicHealth: {
    text: '간호의 첫 원칙은 환자가 마시는 공기를 바깥 공기만큼 깨끗하게 유지하는 것이다.',
    author: '플로렌스 나이팅게일',
    work: '간호론',
    sourceUrl: 'https://www.gutenberg.org/ebooks/12439',
  },
  vaccination: {
    text: '우두는 인간의 몸을 천연두 감염으로부터 지켜 준다.',
    author: '에드워드 제너',
    work: '우두의 원인과 효과에 관한 연구',
    sourceUrl: 'https://www.gutenberg.org/files/29414/29414-h/29414-h.htm',
  },
  germTheory: {
    text: '발효체는 조직된 생명이며, 그 싹은 언제나 이미 존재한다.',
    author: '루이 파스퇴르',
    work: '발효에 관한 연구',
    sourceUrl: 'https://www.gutenberg.org/files/63355/63355-h/63355-h.htm',
  },
  anatomy: {
    text: '모든 세부가 분명히 보여, 각 해부도가 한 장의 그림처럼 보여야 한다.',
    author: '안드레아스 베살리우스',
    work: '오포리누스에게 보낸 편지',
    sourceUrl: 'https://www.gutenberg.org/files/63456/63456-h/63456-h.htm',
  },
  photography: {
    text: '이 그림들은 화가의 연필 없이, 빛이 감광지에 작용하여 만들어졌다.',
    author: '윌리엄 헨리 폭스 탤벗',
    work: '자연의 연필',
    sourceUrl: 'https://www.gutenberg.org/ebooks/33447.html.images',
  },
  humanitarianRelief: {
    text: '평시에 구호 단체를 만들어, 전시의 부상자를 헌신적이고 숙련된 자원봉사자가 돌보게 할 수 없겠는가.',
    author: '앙리 뒤낭',
    work: '솔페리노의 회상',
    sourceUrl: 'https://www.gutenberg.org/files/52524/52524-h/52524-h.htm',
  },
  laborRights: {
    text: '공장에서는 법률과 현실에서의 자유가 모두 끝난다.',
    author: '프리드리히 엥겔스',
    work: '1844년 영국 노동계급의 상태',
    sourceUrl: 'https://www.gutenberg.org/files/17306/17306-h/17306-h.htm',
  },
  foodPreservation: {
    text: '이 방법은 헛된 이론이 아니다. 성찰과 탐구, 오랜 주의와 수많은 실험의 결실이다.',
    author: '니콜라 아페르',
    work: '동식물성 물질을 오랫동안 보존하는 법',
    sourceUrl: 'https://www.gutenberg.org/ebooks/52551',
  },
  athletics: {
    text: '체육은 몸을 단련하고, 올바른 교육은 품성을 기른다.',
    author: '아리스토텔레스',
    work: '정치학',
    sourceUrl: 'https://www.gutenberg.org/ebooks/6762',
  },
});

export const ADVANCEMENT_SPECIFIC_QUOTES = Object.freeze({
  GATHERING: {
    "text": "풍요로운 땅은 억지로 일구지 않아도 열매를 한없이 내주었다.",
    "author": "헤시오도스",
    "work": "일과 나날",
    "sourceUrl": "https://www.gutenberg.org/ebooks/348",
    "sourceSection": "일과 나날, 황금 시대에 관한 대목",
    "translation": "직접 번역"
  },
  CORDAGE: {
    "text": "개울가의 습지에는 갈대를 심고 버드나무를 둘러, 덩굴 묶을 버들가지를 마련하라.",
    "author": "마르쿠스 포르키우스 카토",
    "work": "농업론",
    "sourceUrl": "https://www.gutenberg.org/ebooks/12140",
    "sourceSection": "카토, 농업론, 제6절",
    "translation": "직접 번역"
  },
  HERBALISM: {
    "text": "아그리모니의 증류수는 앞서 말한 모든 용도에 안팎으로 쓸 수 있지만, 효력은 훨씬 약하다.",
    "author": "니컬러스 컬페퍼",
    "work": "완전한 약초서",
    "sourceUrl": "https://www.gutenberg.org/ebooks/49513",
    "sourceSection": "아그리모니 항목, 약효",
    "translation": "직접 번역"
  },
  SHELTER: {
    "text": "사람들은 가지로 피신처를 만들고, 산허리에는 동굴을 팠다.",
    "author": "비트루비우스",
    "work": "건축십서",
    "sourceUrl": "https://www.gutenberg.org/ebooks/20239",
    "sourceSection": "제2권 제1장, 주거의 기원",
    "translation": "직접 번역"
  },
  CRAFTSMANSHIP: {
    "text": "헤파이스토스와 아테나에게 모든 기술을 배운 장인은 은 위에 금을 입히고, 솜씨 좋은 작품을 완성한다.",
    "author": "호메로스",
    "work": "오디세이아",
    "sourceUrl": "https://www.gutenberg.org/ebooks/1728",
    "sourceSection": "제23권, 오디세우스의 귀환과 장인의 솜씨에 대한 비유",
    "translation": "직접 번역"
  },
  HEARTH: {
    "text": "사람들은 따뜻한 불 앞에서 안도하고, 장작을 더 얹어 불을 살렸다.",
    "author": "비트루비우스",
    "work": "건축십서",
    "sourceUrl": "https://www.gutenberg.org/ebooks/20239",
    "sourceSection": "제2권 제1장, 불의 발견",
    "translation": "직접 번역"
  },
  TRAPPING: {
    "text": "왕은 사냥터의 선두에 서서 직접 사냥을 이끌었다.",
    "author": "크세노폰",
    "work": "키루스의 교육",
    "sourceUrl": "https://www.gutenberg.org/ebooks/2085",
    "sourceSection": "제1권, 사냥 훈련",
    "translation": "직접 번역"
  },
  ARCHERY: {
    "text": "기세는 당겨진 쇠뇌에, 결단은 풀려나는 방아쇠에 비길 만하다.",
    "author": "손자",
    "work": "손자병법",
    "sourceUrl": "https://www.gutenberg.org/ebooks/132",
    "sourceSection": "손자병법 병세편 제15절",
    "translation": "직접 번역"
  },
  COUNTING: {
    "text": "단위는 존재하는 각각의 것이 하나라 불리게 하는 것이며, 수는 단위들의 무리다.",
    "author": "에우클레이데스",
    "work": "원론",
    "sourceUrl": "https://www.cs.clarku.edu/~djoyce/java/elements/bookVII/bookVII.html",
    "sourceSection": "제7권 정의 1–2",
    "translation": "직접 번역"
  },
  ARCHIVE: {
    "text": "인간의 행적이 세월에 잊히지 않고, 그리스인과 이방인의 위대하고 놀라운 업적이 명성을 잃지 않게 하려는 것이다.",
    "author": "헤로도토스",
    "work": "역사",
    "sourceUrl": "https://www.perseus.tufts.edu/hopper/text?doc=Perseus%3Atext%3A1999.01.0126%3Abook%3D1%3Achapter%3D1%3Asection%3D0",
    "sourceSection": "제1권 제1장 서문",
    "translation": "직접 번역"
  },
  BRONZE_WORKING: {
    "text": "제련은 흙과 굳은 수지와 돌을 금속에서 분리해 금속을 정제한다.",
    "author": "게오르기우스 아그리콜라",
    "work": "광업과 야금에 관하여",
    "sourceUrl": "https://www.gutenberg.org/ebooks/38015",
    "sourceSection": "제9권, 광석 제련법",
    "translation": "직접 번역"
  },
  LIBRARY: {
    "text": "어떤 책은 맛만 보고, 어떤 책은 삼키듯 읽으며, 몇몇은 씹어 소화하듯 읽어야 한다.",
    "author": "프랜시스 베이컨",
    "work": "에세이, 또는 시민적·도덕적 권고",
    "sourceUrl": "https://www.gutenberg.org/ebooks/575",
    "sourceSection": "「학문에 관하여」",
    "translation": "직접 번역"
  },
  FOOD_STORAGE: {
    "text": "곡물은 햇볕을 받으면 좋은 품질을 오래 간직하지 못한다.",
    "author": "비트루비우스",
    "work": "건축십서",
    "sourceUrl": "https://www.gutenberg.org/ebooks/20239",
    "sourceSection": "제6권 제6장, 저장실의 방향",
    "translation": "직접 번역"
  },
  ADVANCED_CARVING: {
    "text": "낡은 농기구를 고치고 새것을 만들어 두어라.",
    "author": "마르쿠스 포르키우스 카토",
    "work": "농업론",
    "sourceUrl": "https://www.gutenberg.org/ebooks/12140",
    "sourceSection": "카토, 농업론, 제2절 농장주의 의무",
    "translation": "직접 번역"
  },
  OBSIDIAN_KNAPPING: {
    "text": "날붙이 장인은 나무 도구를 대고 손과 발로 힘을 주어 검은 돌에서 칼날을 하나씩 튀겨 낸다.",
    "author": "베르나르디노 데 사아군과 나우아인 필경사들",
    "work": "플로렌스 서",
    "sourceUrl": "https://florentinecodex.getty.edu/book/10/folio/62r",
    "sourceSection": "제10권, 폴리오 62 recto, 흑요석 날붙이 장인",
    "translation": "직접 번역"
  },
  MEGAFAUNA_HIDE: {
    "text": "그들은 자신들이 잡은 소의 가죽 위에 앉아 바둑을 두었다.",
    "author": "호메로스",
    "work": "오디세이아",
    "sourceUrl": "https://www.gutenberg.org/ebooks/1728",
    "sourceSection": "제1권, 이타카의 구혼자들",
    "translation": "직접 번역"
  },
  CLAY_TABLETS: {
    "text": "전령이 긴 말을 기억하지 못하자 왕은 진흙을 빚어 그 내용을 서판에 적었다. 그날 전에는 진흙에 메시지를 쓰는 일이 없었다.",
    "author": "미상",
    "work": "엔메르카르와 아라타의 군주",
    "sourceUrl": "https://etcsl.orinst.ox.ac.uk/section1/tr1823.htm",
    "sourceSection": "500~514행, 전령이 전할 말을 잊은 뒤 서판에 기록하는 대목",
    "translation": "직접 번역"
  },
  EARLY_CIVIL_ENGINEERING: {
    "text": "기초는 단단한 땅까지 파고 내려가 놓아야 한다.",
    "author": "비트루비우스",
    "work": "건축십서",
    "sourceUrl": "https://www.gutenberg.org/ebooks/20239",
    "sourceSection": "제1권 제5장, 성벽과 기초",
    "translation": "직접 번역"
  },
  IRRIGATION: {
    "text": "물을 끌어오는 방법은 석조 수로, 납관, 구운 점토관의 세 가지다.",
    "author": "비트루비우스",
    "work": "건축십서",
    "sourceUrl": "https://www.gutenberg.org/ebooks/20239",
    "sourceSection": "제8권, 수도교·우물·저수조",
    "translation": "직접 번역"
  },
  FORTIFICATION: {
    "text": "방어를 위해 성벽과 탑과 성문을 계획해야 한다.",
    "author": "비트루비우스",
    "work": "건축십서",
    "sourceUrl": "https://www.gutenberg.org/ebooks/20239",
    "sourceSection": "제1권 제3장, 건축의 세 부문",
    "translation": "직접 번역"
  },
  ROAD_BUILDING: {
    "text": "도로나 강과 항구는 도시로 물자를 나르는 길을 열어 준다.",
    "author": "비트루비우스",
    "work": "건축십서",
    "sourceUrl": "https://www.gutenberg.org/ebooks/20239",
    "sourceSection": "제1권 제4장, 도시 입지",
    "translation": "직접 번역"
  },
  CROP_CALENDAR: {
    "text": "봄과 함께 콩을 뿌린다. 부드럽게 부서지는 고랑에는 자주개자리도 심으며, 기장을 해마다 돌볼 때도 다시 돌아온다.",
    "author": "베르길리우스",
    "work": "농경시",
    "sourceUrl": "https://www.gutenberg.org/ebooks/232",
    "sourceSection": "제1권, 봄철 파종: 콩·자주개자리·기장",
    "translation": "직접 번역"
  },
  EARLY_HORSEBACK: {
    "text": "진군의 빠르기는 바람처럼 하라.",
    "author": "손자",
    "work": "손자병법",
    "sourceUrl": "https://www.gutenberg.org/ebooks/132",
    "sourceSection": "손자병법 군쟁편 제17절",
    "translation": "직접 번역"
  },
  EARLY_IRONWORKING: {
    "text": "철은 용광로에서 달구면 여러 모양으로 두드려 만들 수 있다.",
    "author": "비트루비우스",
    "work": "건축십서",
    "sourceUrl": "https://www.gutenberg.org/ebooks/20239",
    "sourceSection": "제2권, 재료의 성질에 관한 대목",
    "translation": "직접 번역"
  },
  STEEL_QUENCHING: {
    "text": "철을 부드럽고 새하얗게 달군 채 식히면, 찬물에 담그는 것만으로 다시 단단해진다.",
    "author": "비트루비우스",
    "work": "건축십서",
    "sourceUrl": "https://www.gutenberg.org/ebooks/20239",
    "sourceSection": "제2권, 재료의 성질에 관한 대목",
    "translation": "직접 번역"
  },
  HULL_FRAMING: {
    "text": "그는 나무를 자르고 다듬어 각 부재에 구멍을 뚫고 서로 맞물렸다.",
    "author": "호메로스",
    "work": "오디세이아",
    "sourceUrl": "https://www.gutenberg.org/ebooks/1728",
    "sourceSection": "제5권, 오디세우스의 뗏목 제작",
    "translation": "직접 번역"
  },
  SURGICAL_TOOLS: {
    "text": "두개골 천공술에서는 뼈가 달아오르지 않도록 천공기를 자주 빼내 찬물에 담가야 한다.",
    "author": "히포크라테스",
    "work": "두부 손상에 관하여",
    "sourceUrl": "https://www.gutenberg.org/ebooks/72583",
    "sourceSection": "제21절, 두개골 천공에 관한 설명",
    "translation": "직접 번역"
  },
  MILITARY_TRAINING: {
    "text": "적과 자신을 알면 백 번 싸워도 위태롭지 않다.",
    "author": "손자",
    "work": "손자병법",
    "sourceUrl": "https://www.gutenberg.org/ebooks/132",
    "sourceSection": "손자병법 모공편 제18절",
    "translation": "직접 번역"
  },
  DEFENSE_TACTICS: {
    "text": "상대가 어디를 공격해야 할지 모르게 하는 자가 방어에 능하다.",
    "author": "손자",
    "work": "손자병법",
    "sourceUrl": "https://www.gutenberg.org/ebooks/132",
    "sourceSection": "손자병법 허실편 제8절",
    "translation": "직접 번역"
  },
  THREE_FIELD_SYSTEM: {
    "text": "밭을 번갈아 쓰면 땅도 숨을 돌린다.",
    "author": "베르길리우스",
    "work": "농경시",
    "sourceUrl": "https://www.gutenberg.org/ebooks/232",
    "sourceSection": "제1권, 윤작에 관한 대목",
    "translation": "직접 번역"
  },
  BLOOMERY_FURNACE: {
    "text": "광석은 용광로에서 녹이거나, 도가니나 도랑에서 녹일 수 있다.",
    "author": "게오르기우스 아그리콜라",
    "work": "광업과 야금에 관하여",
    "sourceUrl": "https://www.gutenberg.org/ebooks/38015",
    "sourceSection": "제9권, 제련로의 구조와 방식",
    "translation": "직접 번역"
  },
  LATEEN_SAIL: {
    "text": "칼립소는 돛감을 가져왔고, 오디세우스는 솜씨 있게 돛을 지었다.",
    "author": "호메로스",
    "work": "오디세이아",
    "sourceUrl": "https://www.gutenberg.org/ebooks/1728",
    "sourceSection": "제5권, 오디세우스의 뗏목 제작",
    "translation": "직접 번역"
  },
  HERBAL_MEDICINE: {
    "text": "그러고 나서 나는 모든 약이 풀과 뿌리, 꽃과 씨앗 등으로 만들어진다고 생각했다.",
    "author": "니컬러스 컬페퍼",
    "work": "완전한 약초서",
    "sourceUrl": "https://www.gutenberg.org/ebooks/49513",
    "sourceSection": "독자에게 보내는 서문",
    "translation": "직접 번역"
  },
  HEAVY_PLOUGH: {
    "text": "신음하는 소 뒤에서 쟁기를 깊이 눌러라.",
    "author": "베르길리우스",
    "work": "농경시",
    "sourceUrl": "https://www.gutenberg.org/ebooks/232",
    "sourceSection": "제1권, 밭갈이",
    "translation": "직접 번역"
  },
  STEEL_TOOLS: {
    "text": "철제 도구의 끝은 뾰족해 단단한 암석과 광맥을 쪼갠다.",
    "author": "게오르기우스 아그리콜라",
    "work": "광업과 야금에 관하여",
    "sourceUrl": "https://www.gutenberg.org/ebooks/38015",
    "sourceSection": "제6권, 철제 광산 도구",
    "translation": "직접 번역"
  },
  NAVIGATION: {
    "text": "오디세우스는 키로 뗏목의 방향을 능숙하게 잡았다.",
    "author": "호메로스",
    "work": "오디세이아",
    "sourceUrl": "https://www.gutenberg.org/ebooks/1728",
    "sourceSection": "제5권, 오디세우스의 항해",
    "translation": "직접 번역"
  },
  CROP_ROTATION: {
    "text": "한 해에는 다른 작물을 심어 밭의 기운을 되살려라.",
    "author": "베르길리우스",
    "work": "농경시",
    "sourceUrl": "https://www.gutenberg.org/ebooks/232",
    "sourceSection": "제1권, 윤작",
    "translation": "직접 번역"
  },
  MECHANICAL_CLOCK: {
    "text": "알렉산드리아의 크테시비오스가 물시계 제작법을 연구하고 처음 고안했다.",
    "author": "마르쿠스 비트루비우스 폴리오",
    "work": "건축십서",
    "sourceUrl": "https://www.gutenberg.org/ebooks/20239",
    "sourceSection": "제9권 제8장, 해시계와 물시계 §2",
    "translation": "직접 번역"
  },
  MASONRY_VAULTS: {
    "text": "둥근 천장은 석조로 만들면 더 실용적이다.",
    "author": "비트루비우스",
    "work": "건축십서",
    "sourceUrl": "https://www.gutenberg.org/ebooks/20239",
    "sourceSection": "제5권, 목욕탕의 둥근 천장",
    "translation": "직접 번역"
  },
  CHAINMAIL: {
    "text": "두 겹 사슬 갑옷을 입었다.",
    "author": "토머스 맬러리",
    "work": "아서 왕의 죽음",
    "sourceUrl": "https://www.gutenberg.org/ebooks/1251",
    "sourceSection": "아서 왕의 죽음 제1권 제9장",
    "translation": "직접 번역"
  },
  PAPERMAKING: {
    "text": "채륜은 나무껍질과 삼의 잔섬유, 낡은 천과 그물을 써서 종이를 만들었다. 황제에게 바치자 이를 칭찬했고, 이후 천하가 모두 채후지라 불렀다.",
    "author": "범엽",
    "work": "후한서",
    "sourceUrl": "https://ancient-china-books.github.io/houhanshu/OEBPS/Text/078.htm",
    "sourceSection": "제78권, 채륜 열전",
    "translation": "직접 번역"
  },
  OPTICAL_INSTRUMENTS: {
    "text": "입사각의 사인은 굴절각의 사인과 정확히 또는 거의 일정한 비를 이룬다.",
    "author": "아이작 뉴턴",
    "work": "광학",
    "sourceUrl": "https://www.gutenberg.org/ebooks/33504",
    "sourceSection": "제1권 제1부, 공리 V",
    "translation": "직접 번역"
  },
  CASTLE_ENGINEERING: {
    "text": "탑은 성벽 선보다 바깥으로 돌출시켜야 한다. 성벽을 공격하려 다가오는 적은 좌우 탑에서 쏘는 투사체에 측면을 드러내게 된다.",
    "author": "비트루비우스",
    "work": "건축십서",
    "sourceUrl": "https://www.gutenberg.org/ebooks/20239",
    "sourceSection": "제1권 제5장 §2, 성벽을 공격하는 적에 대한 탑의 방어 위치",
    "translation": "직접 번역"
  },
  PRINTING_BLOCKS: {
    "text": "책의 여러 쪽을 나무판에 새기기 시작했다.",
    "author": "에드먼드 G. 그레스",
    "work": "타이포그래피의 예술과 실제",
    "sourceUrl": "https://www.gutenberg.org/ebooks/54476",
    "sourceSection": "제1부 「책이 손으로 쓰이던 시대」",
    "translation": "직접 번역"
  },
  MEDIEVAL_MEDICINE: {
    "text": "식사에 포도주를 곁들이면 돼지고기도 음식이자 약이 된다.",
    "author": "살레르노 의학파",
    "work": "살레르노 건강법",
    "sourceUrl": "https://www.nlm.nih.gov/hmd/medieval/images/79.jpg",
    "sourceSection": "살레르노 건강법, 1480년경 판본, 제39엽 뒷면의 여백 번역시",
    "translation": "직접 번역"
  },
  ADVANCED_METALLURGY: {
    "text": "광부는 시금으로 광석에 금속이 있는지, 얼마나 들어 있는지 알아낼 수 있다.",
    "author": "게오르기우스 아그리콜라",
    "work": "광업과 야금에 관하여",
    "sourceUrl": "https://www.gutenberg.org/ebooks/38015",
    "sourceSection": "제7권, 광석의 시금",
    "translation": "직접 번역"
  },
  OCEAN_NAVIGATION: {
    "text": "그는 열이레 동안 바다를 가로질러 항해했다.",
    "author": "호메로스",
    "work": "오디세이아",
    "sourceUrl": "https://www.gutenberg.org/ebooks/1728",
    "sourceSection": "제5권, 오디세우스의 항해",
    "translation": "직접 번역"
  },
  MECHANICAL_ENGINEERING: {
    "text": "그는 수문과 용기와 기계와 용광로를 도해로도 설명했다.",
    "author": "게오르기우스 아그리콜라",
    "work": "광업과 야금에 관하여",
    "sourceUrl": "https://www.gutenberg.org/ebooks/38015",
    "sourceSection": "서문, 저술의 범위",
    "translation": "직접 번역"
  },
  PLATE_ARMOR: {
    "text": "그들은 온몸을 빈틈없이 무장했다.",
    "author": "토머스 맬러리",
    "work": "아서 왕의 죽음",
    "sourceUrl": "https://www.gutenberg.org/ebooks/1251",
    "sourceSection": "아서 왕의 죽음 제1권 제11장",
    "translation": "직접 번역"
  },
  DEEP_WATER_SHIPBUILDING: {
    "text": "그는 뗏목의 갑판을 세우고 긴 현측재를 마무리했다.",
    "author": "호메로스",
    "work": "오디세이아",
    "sourceUrl": "https://www.gutenberg.org/ebooks/1728",
    "sourceSection": "제5권, 오디세우스의 뗏목 제작",
    "translation": "직접 번역"
  },
  IMPROVED_AGRICULTURE: {
    "text": "땅의 성질을 살펴 알맞은 작물을 골라 심어야 한다.",
    "author": "마르쿠스 포르키우스 카토",
    "work": "농업론",
    "sourceUrl": "https://www.gutenberg.org/ebooks/12140",
    "sourceSection": "카토, 농업론, 제1절",
    "translation": "직접 번역"
  },
  GUNPOWDER_MILL: {
    "text": "화약 제조는 이 법 시행 당시 그 제조에 합법적으로 사용 중이던 공장과 장소, 또는 이 법에 따라 허가받은 장소에서만 할 수 있다.",
    "author": "영국 의회",
    "work": "화약법 1860",
    "sourceUrl": "https://www.legislation.gov.uk/ukpga/Vict/23-24/139/pdfs/ukpga_18600139_en.pdf",
    "sourceSection": "제2절, 화약 제조 및 보관 규정",
    "translation": "직접 번역"
  },
  OCEANIC_CARTOGRAPHY: {
    "text": "우리 시대에는 지구와 바다와 별의 여러 지역이 놀랄 만큼 탐구되고 묘사됐다.",
    "author": "프랜시스 베이컨",
    "work": "신기관",
    "sourceUrl": "https://www.gutenberg.org/ebooks/45988",
    "sourceSection": "제1권 제84절, 항해와 자연 관찰",
    "translation": "직접 번역"
  },
  ARQUEBUS: {
    "text": "국가의 근간은 훌륭한 법과 무장이다.",
    "author": "니콜로 마키아벨리",
    "work": "군주론",
    "sourceUrl": "https://www.gutenberg.org/ebooks/1232",
    "sourceSection": "군주론 제12장",
    "translation": "직접 번역"
  },
  PRINT_WORKSHOP: {
    "text": "인쇄장 책임자는 모든 직공을 지휘한다.",
    "author": "조지프 목슨",
    "work": "기계공예 연습(인쇄술 편)",
    "sourceUrl": "https://www.gutenberg.org/ebooks/72217",
    "sourceSection": "제2절 「인쇄장 책임자의 직무」",
    "translation": "직접 번역"
  },
  CELESTIAL_NAVIGATION: {
    "text": "칼립소는 깊은 바다를 건널 때 큰곰자리를 왼편에 두라고 당부했다.",
    "author": "호메로스",
    "work": "오디세이아",
    "sourceUrl": "https://www.gutenberg.org/ebooks/1728",
    "sourceSection": "제5권, 칼립소의 항해 지시",
    "translation": "직접 번역"
  },
  TRACE_ITALIENNE: {
    "text": "성문으로 향하는 길은 적의 오른쪽을 노출하도록 직선이 아니라 오른쪽에서 왼쪽으로 굽혀 계획하라.",
    "author": "비트루비우스",
    "work": "건축십서",
    "sourceUrl": "https://www.gutenberg.org/ebooks/20239",
    "sourceSection": "제1권 제5장, 성벽 접근로",
    "translation": "직접 번역"
  },
  DRAINAGE_PUMP: {
    "text": "도랑을 파 물을 바깥으로 흘려보내면 습지를 말릴 수 있다.",
    "author": "비트루비우스",
    "work": "건축십서",
    "sourceUrl": "https://www.gutenberg.org/ebooks/20239",
    "sourceSection": "제1권 제4장, 도시 배수",
    "translation": "직접 번역"
  },
  NEW_CROP_CULTIVATION: {
    "text": "파종은 망설일 일이 아니라 곧바로 실행할 일이다.",
    "author": "마르쿠스 포르키우스 카토",
    "work": "농업론",
    "sourceUrl": "https://www.gutenberg.org/ebooks/12140",
    "sourceSection": "카토, 농업론, 제3절 농사와 건축",
    "translation": "직접 번역"
  },
  GALLEON_SHIPBUILDING: {
    "text": "배에는 돛대와 가로돛대와 키가 필요하다.",
    "author": "호메로스",
    "work": "오디세이아",
    "sourceUrl": "https://www.gutenberg.org/ebooks/1728",
    "sourceSection": "제5권, 오디세우스의 뗏목 제작",
    "translation": "직접 번역"
  },
  FIELD_ARTILLERY: {
    "text": "충분한 포병을 갖추고 공공 창고에 1년치 식량과 연료를 비축한다.",
    "author": "니콜로 마키아벨리",
    "work": "군주론",
    "sourceUrl": "https://www.gutenberg.org/ebooks/1232",
    "sourceSection": "군주론 제10장",
    "translation": "직접 번역"
  },
  PHARMACOPOEIA: {
    "text": "우리에게는 약품 조제소, 곧 의약품 상점이 있다.",
    "author": "프랜시스 베이컨",
    "work": "새 아틀란티스",
    "sourceUrl": "https://www.gutenberg.org/ebooks/2434",
    "sourceSection": "솔로몬의 집, 의약품 조제소",
    "translation": "직접 번역"
  },
  STEAM_PUMP: {
    "text": "고압 기관은 응축기를 거치지 않고 증기를 대기로 내보내기도 한다.",
    "author": "사디 카르노",
    "work": "열의 동력에 관한 고찰",
    "sourceUrl": "https://www.gutenberg.org/ebooks/78610",
    "sourceSection": "제1장 주석 9, 고압 기관의 배기",
    "translation": "직접 번역"
  },
  PRECISION_CLOCK: {
    "text": "물시계의 눈금은 기둥에 표시하고, 움직이는 형상이 하루의 시간을 가리킨다.",
    "author": "마르쿠스 비트루비우스 폴리오",
    "work": "건축십서",
    "sourceUrl": "https://www.gutenberg.org/ebooks/20239",
    "sourceSection": "제9권 제8장, 해시계와 물시계 §6",
    "translation": "직접 번역"
  },
  SEED_SELECTION: {
    "text": "씨를 뿌리기 전에는 자라나는 모든 것의 근원인 물과 흙과 공기와 불을 살펴야 한다.",
    "author": "마르쿠스 테렌티우스 바로",
    "work": "농업론",
    "sourceUrl": "https://www.gutenberg.org/ebooks/12140",
    "sourceSection": "바로, 농업론 제1권 제4절, 파종 전의 토양과 기후",
    "translation": "직접 번역"
  },
  COPPERPLATE_PRINTING: {
    "text": "활자를 새길 강철 펀치는 구리 조각에 박아 주형으로 만들었다.",
    "author": "조지프 목슨",
    "work": "기계공예 연습(인쇄술 편)",
    "sourceUrl": "https://www.gutenberg.org/ebooks/72217",
    "sourceSection": "제1권, §15 §1, 주형과 구리 활자 모형 만들기",
    "translation": "직접 번역"
  },
  EARLY_STEAM_ENGINE: {
    "text": "여기서는 증기기관과 일반적인 열기관을 구별해야 한다.",
    "author": "사디 카르노",
    "work": "열의 동력에 관한 고찰",
    "sourceUrl": "https://www.gutenberg.org/ebooks/78610",
    "sourceSection": "제1장 주석 8, 증기기관의 정의",
    "translation": "직접 번역"
  },
  CLASSICAL_MECHANICS: {
    "text": "지렛대의 짧은 쪽을 받침을 중심으로 무게 밑에 넣고, 더 멀리 있는 끝을 누르면 원을 그리며 움직여 적은 힘으로도 큰 짐을 들어 올린다.",
    "author": "비트루비우스",
    "work": "건축십서",
    "sourceUrl": "https://www.gutenberg.org/ebooks/20239",
    "sourceSection": "제10권 제3장, 지렛대의 작용",
    "translation": "직접 번역"
  },
  SHIP_OF_THE_LINE: {
    "text": "오디세우스는 폭풍 속에서 돛대를 뗏목의 용골에 단단히 묶었다.",
    "author": "호메로스",
    "work": "오디세이아",
    "sourceUrl": "https://www.gutenberg.org/ebooks/1728",
    "sourceSection": "제12권, 난파와 생존",
    "translation": "직접 번역"
  },
  MODERN_AGRONOMY: {
    "text": "농업은 땅마다 어떻게 심고 가꿔야 가장 오래, 가장 많이 거둘지 가르치는 과학이다.",
    "author": "마르쿠스 테렌티우스 바로",
    "work": "농업론",
    "sourceUrl": "https://www.gutenberg.org/ebooks/12140",
    "sourceSection": "바로, 농업론 제1권 제3절, 농업이란 무엇인가",
    "translation": "직접 번역"
  },
  ROTARY_STEAM_POWER: {
    "text": "증기는 실린더를 떠나기 전에 응축기 속 증기와 같은 압력이 될 때까지 팽창시킨다.",
    "author": "사디 카르노",
    "work": "열의 동력에 관한 고찰",
    "sourceUrl": "https://www.gutenberg.org/ebooks/78610",
    "sourceSection": "부록 B 주석 66, 증기 팽창",
    "translation": "직접 번역"
  },
  MECHANIZED_FARMING: {
    "text": "쟁기질에만 쓰이는 동력이 이 나라의 모든 산업 시설이 함께 쓰는 동력보다 많다는 점을 생각하면, 앞으로 얼마나 큰 기회가 있는지 어렴풋이 알 수 있다.",
    "author": "헨리 포드",
    "work": "나의 생애와 사업",
    "sourceUrl": "https://www.gutenberg.org/ebooks/7213",
    "sourceSection": "서론, 「아이디어란 무엇인가」",
    "translation": "직접 번역"
  },
  RIFLED_MUSKET: {
    "text": "화약의 발명과 화기 제작의 지속적인 개량",
    "author": "카를 폰 클라우제비츠",
    "work": "전쟁론",
    "sourceUrl": "https://www.gutenberg.org/ebooks/1946",
    "sourceSection": "전쟁론 제1편 제1장",
    "translation": "직접 번역"
  },
  STEAM_PRINTING_PRESS: {
    "text": "인쇄기를 기계로 움직이자는 생각이 곧 떠올랐다.",
    "author": "프리드리히 쾨니히",
    "work": "대중에게",
    "sourceUrl": "https://www.historyofinformation.com/detail.php?id=4491",
    "sourceSection": "1814년 12월 9일자 《더 타임스》 공개 서한 「대중에게」",
    "translation": "직접 번역"
  },
  MISSIONARY_MEDICINE: {
    "text": "여러 차례 여행하며 그 노예화된 부족들을 찾아갈 때, 저는 백인들을 피하지 않고 병든 이들을 고치려 애썼으며 돈을 받지 않고 치료약을 투여했습니다.",
    "author": "데이비드 리빙스턴",
    "work": "남아프리카 여행과 탐험",
    "sourceUrl": "https://www.gutenberg.org/ebooks/1039",
    "sourceSection": "제1부 제2장 「보어인과 원주민에 대한 대우」, Commandant Krieger를 언급하는 문단",
    "translation": "직접 번역"
  },
  POWER_LOOM: {
    "text": "핀 제조는 약 열여덟 가지 작업으로 나뉘어, 여러 손이 나눠 맡았다.",
    "author": "애덤 스미스",
    "work": "국부론",
    "sourceUrl": "https://www.gutenberg.org/ebooks/3300",
    "sourceSection": "제1편 제1장, 핀 제조와 분업",
    "translation": "직접 번역"
  },
  BREECH_LOADING_RIFLE: {
    "text": "오래 끄는 전쟁으로 이익을 본 나라는 없다.",
    "author": "손자",
    "work": "손자병법",
    "sourceUrl": "https://www.gutenberg.org/ebooks/132",
    "sourceSection": "손자병법 작전편 제6절",
    "translation": "직접 번역"
  },
  HOSPITAL_SANITATION: {
    "text": "아무리 환기를 해도 가장 철저한 청결이 지켜지지 않는 병실이나 병동의 공기를 상쾌하게 할 수는 없다.",
    "author": "플로렌스 나이팅게일",
    "work": "간호에 관한 기록",
    "sourceUrl": "https://www.gutenberg.org/ebooks/17366",
    "sourceSection": "제10장, 방과 벽의 청결",
    "translation": "직접 번역"
  },
  RAILWAY_ENGINEERING: {
    "text": "철도가 일반 도로보다 갖는 가장 분명한 역학적 이점은 노면이 더 단단하고 매끄럽다는 점이다.",
    "author": "헨리 부스",
    "work": "리버풀·맨체스터 철도 보고서",
    "sourceUrl": "https://upload.wikimedia.org/wikipedia/commons/6/63/Duke_University_Libraries_%28IA_accountofliverpo00boot%29.pdf",
    "sourceSection": "제4장, 철도에 적용되는 역학적 원리와 성질",
    "translation": "직접 번역"
  },
  STEEL_ARTILLERY: {
    "text": "따라서 전쟁의 모든 활동은 필연적으로 전투와 관계된다.",
    "author": "카를 폰 클라우제비츠",
    "work": "전쟁론",
    "sourceUrl": "https://www.gutenberg.org/ebooks/1946",
    "sourceSection": "전쟁론 제1편 제2장",
    "translation": "직접 번역"
  },
  IRONCLAD_SHIPBUILDING: {
    "text": "그는 뗏목의 앞뒤를 버들가지로 엮어 파도막이를 둘렀다.",
    "author": "호메로스",
    "work": "오디세이아",
    "sourceUrl": "https://www.gutenberg.org/ebooks/1728",
    "sourceSection": "제5권, 오디세우스의 뗏목 제작",
    "translation": "직접 번역"
  },
  MASS_PUBLISHING: {
    "text": "좋은 책은 한 시대를 넘어 살아남는 정신의 생명이다.",
    "author": "존 밀턴",
    "work": "아레오파지티카",
    "sourceUrl": "https://www.gutenberg.org/ebooks/608",
    "sourceSection": "무허가 출판의 자유에 관한 연설, 책의 가치",
    "translation": "직접 번역"
  },
  MODERN_HOSPITAL: {
    "text": "환자의 침대는 늘 방에서 가장 밝은 곳에 두어야 하며, 누워서 창밖을 볼 수 있어야 한다.",
    "author": "플로렌스 나이팅게일",
    "work": "간호론",
    "sourceUrl": "https://www.gutenberg.org/ebooks/12439",
    "sourceSection": "제8장 「침대와 침구」",
    "translation": "직접 번역"
  },
  ELECTRIC_GENERATION: {
    "text": "자석으로 얻은 결과는 한 전선의 전지 전류가 다른 전선에 비슷한 전류를 유도하되 그 전류는 순간적으로만 지속된다고 믿게 했다. 그 전류는 보통 레이던 병의 충격으로 생기는 전기파와 더 가까워, 검류계에는 거의 영향을 주지 않으면서 강철 바늘을 자화할 수 있었다.",
    "author": "마이클 패러데이",
    "work": "전기의 실험 연구",
    "sourceUrl": "https://www.gutenberg.org/ebooks/14986",
    "sourceSection": "제1부 제1계열 §1, 제12항",
    "translation": "직접 번역"
  },
  ORGANIC_CHEMISTRY: {
    "text": "식물의 참된 구성 원소는 수소, 산소, 숯이며, 이들은 모든 식물에 공통이고 이것들 없이는 어떤 식물도 존재할 수 없다.",
    "author": "앙투안 라부아지에",
    "work": "화학 원론",
    "sourceUrl": "https://www.gutenberg.org/ebooks/30775",
    "sourceSection": "제2부 제11장, 식물·동물 물질의 분해",
    "translation": "직접 번역"
  },
  ANTISEPTIC_SURGERY: {
    "text": "상처의 화농과 그에 따르는 모든 위험을 막는 일은 분명 바람직한 목표였지만, 얼마 전까지는 달성할 수 없어 보였다. 당시에는 부패를 일으킨다고 여겨진 산소를 차단할 수 없어 보였기 때문이다.",
    "author": "조지프 리스터",
    "work": "외과 수술에서의 방부 원칙",
    "sourceUrl": "https://www.bmj.com/content/bmj/2/351/246.full.pdf",
    "sourceSection": "1867년 논문 첫 문단",
    "translation": "직접 번역"
  },
  MACHINE_GUN: {
    "text": "내 발명의 주된 목적은 탄약이 공급되는 한 계속 작동하는 완전 자동 총을 만드는 것이다.",
    "author": "하이럼 스티븐스 맥심",
    "work": "기관총 특허",
    "sourceUrl": "https://patents.google.com/patent/US367825A/en",
    "sourceSection": "US 367,825 특허 명세서, 발명의 목적",
    "translation": "직접 번역"
  },
  TELEPHONE: {
    "text": "전류가 생긴 것은 전선이 음을 내는 동안뿐이었고, 소리가 멎자 전류도 즉시 멈췄다.",
    "author": "알렉산더 그레이엄 벨",
    "work": "전화의 가능성에 관하여",
    "sourceUrl": "https://www.gutenberg.org/ebooks/55787",
    "sourceSection": "강연, 전기적 음성 전달",
    "translation": "직접 번역"
  },
  DISTRICT_NURSING: {
    "text": "영국의 거의 모든 여성은 생애 어느 때엔가 아이나 환자의 건강을 맡으며, 그런 의미에서 간호인이다.",
    "author": "플로렌스 나이팅게일",
    "work": "간호론",
    "sourceUrl": "https://www.gutenberg.org/ebooks/12439",
    "sourceSection": "서문",
    "translation": "직접 번역"
  },
  INTERNAL_COMBUSTION_ENGINE: {
    "text": "저는 우리가 실제로 적용한 생각들이 가장 폭넓게 응용될 수 있음을 충분히 입증하는 데 지금 가장 관심이 있습니다. 그것들은 자동차나 트랙터에만 특별히 관계된 것이 아니라 일종의 보편적 원리를 이룹니다.",
    "author": "헨리 포드",
    "work": "나의 생애와 사업",
    "sourceUrl": "https://www.gutenberg.org/ebooks/7213",
    "sourceSection": "서론, 「아이디어란 무엇인가」, 적용한 생각의 보편성",
    "translation": "직접 번역"
  },
  PERIODIC_LAW: {
    "text": "원소 성질 사이의 관계는 원자량을 기준으로 주기 함수의 형태를 띤다.",
    "author": "드미트리 멘델레예프",
    "work": "화학 원소의 주기율",
    "sourceUrl": "https://webserver.lemoyne.edu/giunta/Mendeleev1871.pdf",
    "sourceSection": "1871년 논문 1쪽, 주기 법칙",
    "translation": "직접 번역"
  },
  PASTEURIZATION: {
    "text": "55°C로 가열한 맥주는 놀라울 만큼 온전하고 맛이 좋았으며, 발효도 계속되고 있었다.",
    "author": "루이 파스퇴르",
    "work": "발효 연구",
    "sourceUrl": "https://www.gutenberg.org/ebooks/63355",
    "sourceSection": "제2장 「맥주와 맥아즙에 생기는 질병의 원인」, §1",
    "translation": "직접 번역"
  },
  SMOKELESS_POWDER: {
    "text": "리-메트퍼드 소총은 무연 화약과 탄창, 반동이 없는 점을 장점으로 갖췄다.",
    "author": "윈스턴 처칠",
    "work": "수단 재정복 전쟁기",
    "sourceUrl": "https://www.gutenberg.org/ebooks/4943",
    "sourceSection": "제12장, 앳바라 전투 전 병기 비교",
    "translation": "직접 번역"
  },
  PHONOGRAPH: {
    "text": "이 발명의 목적은 사람의 목소리와 그 밖의 소리를 영구적인 흔적으로 기록하고, 그 흔적에서 나중에 그 소리를 다시 재생해 들을 수 있게 하는 것이다.",
    "author": "토머스 에디슨",
    "work": "축음기 또는 말하는 기계에 관한 특허",
    "sourceUrl": "https://patents.google.com/patent/US200521A/en",
    "sourceSection": "미국 특허 제200,521호 명세서, 발명의 목적",
    "translation": "직접 번역"
  },
  BACTERIOLOGICAL_LAB: {
    "text": "저는 클레르몽페랑의 실험실에서 그곳 과학부 화학 교수인 제 친구 뒤클로의 도움을 받아 연구를 시작했습니다. 파리에서 연구를 이어 간 뒤, 프랑스 제일로 인정받는 탄통빌의 투르텔 형제 양조장에서 계속했습니다.",
    "author": "루이 파스퇴르",
    "work": "발효 연구",
    "sourceUrl": "https://www.gutenberg.org/ebooks/63355",
    "sourceSection": "저자 서문",
    "translation": "직접 번역"
  },
  ELECTRIC_GRID: {
    "text": "전력이나 빛을 만드는 장치가 여러 개 병렬 회로로 연결된 곳에서는, 가능한 한 계통의 모든 부분에 같은 기전력 또는 전압을 유지해야 한다.",
    "author": "토머스 에디슨",
    "work": "전기 조명 체계",
    "sourceUrl": "https://patents.google.com/patent/US239147A/en",
    "sourceSection": "미국 특허 제239,147호 명세서, 발명의 설명",
    "translation": "직접 번역"
  },
  X_RAY_IMAGING: {
    "text": "손을 형광판 앞에 놓자 손뼈의 어두운 그림자가 나타났다.",
    "author": "빌헬름 콘라트 뢴트겐",
    "work": "새로운 종류의 광선에 관하여",
    "sourceUrl": "https://textgridlab.org/1.0/aggregator/html/textgrid:4bq4v.0",
    "sourceSection": "§2, 손의 그림자 관찰",
    "translation": "직접 번역"
  },
  ARTIFICIAL_FERTILIZER: {
    "text": "곡식 재배에 동물성 거름을 쓰는 일은 식물의 질소가 암모니아에서 비롯됨을 보여주는 가장 설득력 있는 증거다.",
    "author": "유스투스 폰 리비히",
    "work": "농업과 생리학에 응용된 유기화학",
    "sourceUrl": "https://darwin-online.org.uk/converted/pdf/1840_Liebig_chemistry_CUL-DAR.LIB.365.pdf",
    "sourceSection": "제1부 제3장, 식물의 질소, 77쪽",
    "translation": "직접 번역"
  },
  TURBINE_WARSHIP: {
    "text": "증기기관의 결함을 보완하려고 별도의 팽창 실린더를 쓰기도 했다.",
    "author": "사디 카르노",
    "work": "열의 동력에 관한 고찰",
    "sourceUrl": "https://www.gutenberg.org/ebooks/78610",
    "sourceSection": "부록 B 주석 66, 증기기관의 팽창 실린더",
    "translation": "직접 번역"
  },
  WIRELESS_TELEGRAPHY: {
    "text": "전파로 지구의 먼 지역 사이에 무선 전신 통신을 하고 일반 실험실보다 큰 규모로 실험한 덕분에, 새롭고 예상치 못한 현상을 조사하고 결과를 기록할 수 있었다.",
    "author": "굴리엘모 마르코니",
    "work": "무선 전신 통신",
    "sourceUrl": "https://www.nobelprize.org/uploads/2018/06/marconi-lecture.pdf",
    "sourceSection": "1909년 노벨 강연, 무선 전신 통신, 둘째 문단",
    "translation": "직접 번역"
  },
  EMERGENCY_MEDICINE: {
    "text": "의사는 병의 선행 징후를 말하고 현재를 알며 미래를 예견해야 한다. 그는 이를 숙고하며 병에 관해 두 가지 특별한 목적, 곧 선을 행하거나 해를 끼치지 않는 일을 마음에 두어야 한다.",
    "author": "히포크라테스",
    "work": "히포크라테스 전집",
    "sourceUrl": "https://www.gutenberg.org/ebooks/72583",
    "sourceSection": "전염병 I.11 (애덤스 번역본 제1권, 첫 번째 체질 §5)",
    "translation": "직접 번역"
  },
  AUTOMOBILE: {
    "text": "기계와 동력은 사람을 자유롭게 살게 하는 수단이다.",
    "author": "헨리 포드",
    "work": "나의 생애와 사업",
    "sourceUrl": "https://www.gutenberg.org/ebooks/7213",
    "sourceSection": "제1장, 동력과 기계",
    "translation": "직접 번역"
  },
  ATOMIC_THEORY: {
    "text": "원소라는 개념에 대응하는 물질 단위는 원자다.",
    "author": "드미트리 멘델레예프",
    "work": "화학 원소의 주기율",
    "sourceUrl": "https://webserver.lemoyne.edu/giunta/Mendeleev1871.pdf",
    "sourceSection": "1871년 논문 1쪽, 원소와 원자의 구분",
    "translation": "직접 번역"
  },
  COLD_CHAIN: {
    "text": "첫째 물체는 화로라 하고, 둘째 물체는 저온 열저장고라 부르겠다.",
    "author": "사디 카르노",
    "work": "열의 동력에 관한 고찰",
    "sourceUrl": "https://www.gutenberg.org/ebooks/78610",
    "sourceSection": "제1장, 두 열저장고의 설정",
    "translation": "직접 번역"
  },
  POWERED_FLIGHT: {
    "text": "짧은 연습 뒤, 이전의 안전 기준보다 두 배 가까이 큰 기체로 300피트 넘게 활공했다.",
    "author": "윌버 라이트",
    "work": "몇 가지 항공 실험",
    "sourceUrl": "https://tile.loc.gov/storage-services/service/mss/mss46706/mss46706-05001168/mss46706-05001168.pdf",
    "sourceSection": "1901년 9월 18일 발표문, 1900년형 글라이더 실험 결과",
    "translation": "직접 번역"
  },
  MOTION_PICTURES: {
    "text": "발명의 목적은 빠르게 연속된 사진을 관객의 눈앞에 보여 움직이는 장면을 재현하는 장치를 만드는 것이었다.",
    "author": "토머스 에디슨",
    "work": "움직이는 사진을 보여주는 장치 특허",
    "sourceUrl": "https://patents.google.com/patent/US493426A/en",
    "sourceSection": "US 493,426 특허 명세서, 발명의 목적",
    "translation": "직접 번역"
  },
  BLOOD_TYPING: {
    "text": "사람의 혈액에는 이른바 혈액형이라 부르는 네 가지 기본 유형이 있다.",
    "author": "카를 란트슈타이너",
    "work": "인간 혈액의 개인차",
    "sourceUrl": "https://www.nobelprize.org/uploads/2018/06/landsteiner-lecture.pdf",
    "sourceSection": "1930년 노벨 강연, 혈액형의 개요",
    "translation": "직접 번역"
  },
  SETTLEMENT: {
    "text": "도시를 세울 자리는 기후와 물과 식량을 살펴 골라야 한다.",
    "author": "비트루비우스",
    "work": "건축십서",
    "sourceUrl": "https://www.gutenberg.org/ebooks/20239",
    "sourceSection": "제1권 제4장, 도시의 입지",
    "translation": "직접 번역"
  },
  MYSTICISM: {
    "text": "내 안에서는 내면의 양식, 곧 당신 자신이신 나의 하느님을 향한 굶주림이 일고 있었다.",
    "author": "아우구스티누스",
    "work": "고백록",
    "sourceUrl": "https://www.gutenberg.org/ebooks/3296",
    "sourceSection": "고백록 제3권 제1장",
    "translation": "직접 번역"
  },
  STATE_WORKFORCE: {
    "text": "그곳에서는 여자든 남자든 모두 앞서 언급한 기술 가운데 하나를 배운다.",
    "author": "토머스 모어",
    "work": "유토피아",
    "sourceUrl": "https://www.gutenberg.org/ebooks/2130",
    "sourceSection": "유토피아 제2권 「그들의 직업과 생활 방식」",
    "translation": "직접 번역"
  },
  CLASSICAL_PHILOSOPHY: {
    "text": "“그렇다면 진정한 철학자란 누구인가?” “진리의 모습을 사랑하는 이들이다.”",
    "author": "플라톤",
    "work": "국가",
    "sourceUrl": "https://www.gutenberg.org/ebooks/1497",
    "sourceSection": "제5권 말미, 철학자와 진리의 구분",
    "translation": "직접 번역"
  },
  CIVIC_RITUAL: {
    "text": "주께서 오실 때까지 주의 죽음을 전하는 것이다.",
    "author": "바울",
    "work": "성서",
    "sourceUrl": "https://www.gutenberg.org/ebooks/10",
    "sourceSection": "고린도전서 11장 26절",
    "translation": "직접 번역"
  },
  PUBLIC_DEBATE: {
    "text": "의견을 침묵시키는 특유의 해악은 인류 전체의 것을 빼앗는 데 있다.",
    "author": "존 스튜어트 밀",
    "work": "자유론",
    "sourceUrl": "https://www.gutenberg.org/ebooks/34901",
    "sourceSection": "자유론 제2장",
    "translation": "직접 번역"
  },
  IMPERIAL_ADMINISTRATION: {
    "text": "군주의 지혜는 그 주변 인물들을 살펴보면 처음으로 판단할 수 있다.",
    "author": "니콜로 마키아벨리",
    "work": "군주론",
    "sourceUrl": "https://www.gutenberg.org/ebooks/1232",
    "sourceSection": "군주론 제22장",
    "translation": "직접 번역"
  },
  EARLY_EMPIRE: {
    "text": "여러 마을이 온전히 결합해 하나의 공동체를 이루면, 그 공동체는 도시국가가 된다.",
    "author": "아리스토텔레스",
    "work": "정치학",
    "sourceUrl": "https://www.gutenberg.org/ebooks/6762",
    "sourceSection": "정치학 제1권 제2장",
    "translation": "직접 번역"
  },
  SCHOLASTICISM: {
    "text": "인간의 구원을 위해 이성의 한계를 넘는 진리를 계시로 알려야 했다.",
    "author": "토마스 아퀴나스",
    "work": "신학대전",
    "sourceUrl": "https://www.gutenberg.org/ebooks/17611",
    "sourceSection": "신학대전 제1부 제1문 제1항",
    "translation": "직접 번역"
  },
  COURT_LITERATURE: {
    "text": "제 사랑을 얻기 위해 큰 수고를 하고 위험한 여정을 겪었으니까요.",
    "author": "토머스 맬러리",
    "work": "아서 왕의 죽음",
    "sourceUrl": "https://www.gutenberg.org/ebooks/1251",
    "sourceSection": "제7권 제21장",
    "translation": "직접 번역"
  },
  CATHEDRAL_SCHOOLS: {
    "text": "배움을 위해 학교에 보내졌으나, 게으르면 매를 맞았다.",
    "author": "아우구스티누스",
    "work": "고백록",
    "sourceUrl": "https://www.gutenberg.org/ebooks/3296",
    "sourceSection": "제1권, 어린 시절의 학교 교육",
    "translation": "직접 번역"
  },
  CHRONICLE_WRITING: {
    "text": "다윗 왕의 행적은 처음부터 끝까지 선견자 사무엘의 글과 예언자 나단의 글과 선견자 갓의 글에 기록되어 있다.",
    "author": "역대기 저자",
    "work": "역대기상",
    "sourceUrl": "https://www.gutenberg.org/ebooks/10",
    "sourceSection": "역대기상 29장 29절",
    "translation": "직접 번역"
  },
  NATURAL_PHILOSOPHY: {
    "text": "자연의 미묘함은 감각이나 이해의 힘을 훨씬 넘어선다.",
    "author": "프랜시스 베이컨",
    "work": "신기관",
    "sourceUrl": "https://www.gutenberg.org/ebooks/45988",
    "sourceSection": "제1권 제10절",
    "translation": "직접 번역"
  },
  MILITARY_ORDERS: {
    "text": "그들은 아서 왕을 무찌를 때까지 좋을 때나 나쁠 때나 서로 떠나지 않겠다고 맹세했다.",
    "author": "토머스 맬러리",
    "work": "아서 왕의 죽음",
    "sourceUrl": "https://www.gutenberg.org/ebooks/1251",
    "sourceSection": "아서 왕의 죽음 제1권 제12장",
    "translation": "직접 번역"
  },
  SACRED_MUSIC: {
    "text": "나팔 소리로 주를 찬양하고, 비파와 수금으로 찬양하라.",
    "author": "성경",
    "work": "시편",
    "sourceUrl": "https://www.gutenberg.org/ebooks/10",
    "sourceSection": "시편 150편 3절",
    "translation": "직접 번역"
  },
  UNIVERSITY_TRADITION: {
    "text": "매일 새벽 동트기 전에 공개 강의를 여는 것이 보통이다.",
    "author": "토머스 모어",
    "work": "유토피아",
    "sourceUrl": "https://www.gutenberg.org/ebooks/2130",
    "sourceSection": "제2권 「그들의 직업과 생활 방식」",
    "translation": "직접 번역"
  },
  URBAN_CHARTER: {
    "text": "도시는 자유민의 공동체다.",
    "author": "아리스토텔레스",
    "work": "정치학",
    "sourceUrl": "https://www.gutenberg.org/ebooks/6762",
    "sourceSection": "정치학 제3권 제6장",
    "translation": "직접 번역"
  },
  ROMANCE_LITERATURE: {
    "text": "그대가 사랑하고 그대 또한 사랑받을 여인을 만나게 되리라.",
    "author": "토머스 맬러리",
    "work": "아서 왕의 죽음",
    "sourceUrl": "https://www.gutenberg.org/ebooks/1251",
    "sourceSection": "제4권 제23장",
    "translation": "직접 번역"
  },
  ESTATES_ASSEMBLY: {
    "text": "인민의 동의 없이 그 재산에 세금을 부과해서는 안 된다.",
    "author": "존 로크",
    "work": "통치론",
    "sourceUrl": "https://www.gutenberg.org/ebooks/7370",
    "sourceSection": "통치론 제2론 제11장 제140절",
    "translation": "직접 번역"
  },
  CODIFIED_THEOLOGY: {
    "text": "성스러운 가르침은 더 높은 학문의 빛으로 세워진 원리에서 출발하므로 학문이다.",
    "author": "토마스 아퀴나스",
    "work": "신학대전",
    "sourceUrl": "https://www.gutenberg.org/ebooks/17611",
    "sourceSection": "신학대전 제1부 제1문 제2항",
    "translation": "직접 번역"
  },
  REFORMATION: {
    "text": "그는 신자의 삶 전체가 회개여야 한다고 뜻하셨다.",
    "author": "마르틴 루터",
    "work": "95개조 반박문",
    "sourceUrl": "https://www.gutenberg.org/ebooks/274",
    "sourceSection": "95개조 반박문 제1조",
    "translation": "직접 번역"
  },
  RENAISSANCE_HUMANISM: {
    "text": "아이들과 남녀 대다수는 일하지 않는 시간을 독서에 쓰도록 배운다.",
    "author": "토머스 모어",
    "work": "유토피아",
    "sourceUrl": "https://www.gutenberg.org/ebooks/2130",
    "sourceSection": "유토피아 제2권 「유토피아인의 여행」",
    "translation": "직접 번역"
  },
  STANDING_ARMY: {
    "text": "군주는 전쟁과 그 규칙·훈련 외에는 다른 목표나 생각을 두지 말아야 한다.",
    "author": "니콜로 마키아벨리",
    "work": "군주론",
    "sourceUrl": "https://www.gutenberg.org/ebooks/1232",
    "sourceSection": "군주론 제14장",
    "translation": "직접 번역"
  },
  PATRONAGE_CULTURE: {
    "text": "저는 대리석·청동·점토로 조각할 수 있으며, 회화에서도 누구에게도 뒤지지 않을 만큼 어떤 작업이든 해낼 수 있습니다.",
    "author": "레오나르도 다 빈치",
    "work": "루도비코 스포르차에게 보내는 편지 초안",
    "sourceUrl": "https://teche.museogalileo.it/leonardo/foglio/index.html?lang=en&num=ATL.2163.1",
    "sourceSection": "갈릴레오 박물관, 아틀란티코 수고 ATL.2163.1, 조각과 회화에 관한 대목",
    "translation": "직접 번역"
  },
  CONFESSIONAL_TOLERANCE: {
    "text": "누구도 자신의 종교 때문에 처벌받아서는 안 된다.",
    "author": "토머스 모어",
    "work": "유토피아",
    "sourceUrl": "https://www.gutenberg.org/ebooks/2130",
    "sourceSection": "유토피아 제2권 「유토피아인의 종교」",
    "translation": "직접 번역"
  },
  BUREAUCRATIC_STATE: {
    "text": "정부는 신민과 주권자 사이에서 법을 집행하고 자유를 지키는 중간 기구다.",
    "author": "장 자크 루소",
    "work": "사회계약론",
    "sourceUrl": "https://www.gutenberg.org/ebooks/46333",
    "sourceSection": "사회계약론 제3권 제1장",
    "translation": "직접 번역"
  },
  MILITARY_REVOLUTION: {
    "text": "능숙한 지휘관은 싸우지 않고 적군을 굴복시킨다.",
    "author": "손자",
    "work": "손자병법",
    "sourceUrl": "https://www.gutenberg.org/ebooks/132",
    "sourceSection": "손자병법 모공편 제6절",
    "translation": "직접 번역"
  },
  PUBLIC_SPHERE: {
    "text": "주권자는 인민이 집회한 때에만 행동할 수 있다.",
    "author": "장 자크 루소",
    "work": "사회계약론",
    "sourceUrl": "https://www.gutenberg.org/ebooks/46333",
    "sourceSection": "사회계약론 제3권 제12장",
    "translation": "직접 번역"
  },
  ENLIGHTENED_THEOLOGY: {
    "text": "하느님의 존재는 다섯 가지 방식으로 증명될 수 있다.",
    "author": "토마스 아퀴나스",
    "work": "신학대전",
    "sourceUrl": "https://www.gutenberg.org/ebooks/17611",
    "sourceSection": "신학대전 제1부 제2문 제3항",
    "translation": "직접 번역"
  },
  PROFESSIONAL_OFFICERS: {
    "text": "도덕적 용기, 곧 책임 앞에서의 용기",
    "author": "카를 폰 클라우제비츠",
    "work": "전쟁론",
    "sourceUrl": "https://www.gutenberg.org/ebooks/1946",
    "sourceSection": "전쟁론 제1편 제3장",
    "translation": "직접 번역"
  },
  INDUSTRIAL_ENTREPRENEURSHIP: {
    "text": "새로운 기계를 만드는 일은 기계 제작자의 독창성에서도 나온다.",
    "author": "애덤 스미스",
    "work": "국부론",
    "sourceUrl": "https://www.gutenberg.org/ebooks/3300",
    "sourceSection": "제1편 제1장, 기계의 개선",
    "translation": "직접 번역"
  },
  AGRARIAN_REFORM: {
    "text": "농부가 땅을 부지런히 가꾸면 가장 굳센 시민이 자라난다.",
    "author": "마르쿠스 포르키우스 카토",
    "work": "농업론",
    "sourceUrl": "https://www.gutenberg.org/ebooks/12140",
    "sourceSection": "카토, 농업론, 서문",
    "translation": "직접 번역"
  },
  MASS_CONSCRIPTION: {
    "text": "방어 전략은 두 방식으로 국민의 일반 무장을 포함할 수 있다.",
    "author": "카를 폰 클라우제비츠",
    "work": "전쟁론",
    "sourceUrl": "https://www.gutenberg.org/ebooks/1946",
    "sourceSection": "전쟁론 제6편 제26장",
    "translation": "직접 번역"
  },
  EVANGELICAL_REVIVAL: {
    "text": "사랑의 행위로 사랑이 자라고 사람은 나아지지만, 면죄부는 사람을 나아지게 하지 않는다.",
    "author": "마르틴 루터",
    "work": "95개조 반박문",
    "sourceUrl": "https://www.gutenberg.org/ebooks/274",
    "sourceSection": "95개조 반박문 제44조",
    "translation": "직접 번역"
  },
  POSITIVISM: {
    "text": "이미 발견된 효과조차 학문보다는 우연과 실험 덕분에 얻어진 것이며, 현재의 학문은 발견된 사실을 특이하게 배열한 것에 지나지 않는다.",
    "author": "프랜시스 베이컨",
    "work": "신기관",
    "sourceUrl": "https://www.gutenberg.org/ebooks/45988",
    "sourceSection": "제1권 제8절",
    "translation": "직접 번역"
  },
  PUBLIC_SANITATION: {
    "text": "변기·싱크·빗물받이 어디에서든 하수관과 바로 이어지는 봉수 없는 배수관이 하나라도 있는 집은 결코 건강한 주거지가 될 수 없다.",
    "author": "플로렌스 나이팅게일",
    "work": "간호론",
    "sourceUrl": "https://www.gutenberg.org/ebooks/12439",
    "sourceSection": "제2장 「주택의 건강」, 배수",
    "translation": "직접 번역"
  },
  GENERAL_STAFF: {
    "text": "군대의 군사적 덕성은 각 부대에, 지휘관의 천재성은 전체에 해당한다.",
    "author": "카를 폰 클라우제비츠",
    "work": "전쟁론",
    "sourceUrl": "https://www.gutenberg.org/ebooks/1946",
    "sourceSection": "전쟁론 제3편 제5장",
    "translation": "직접 번역"
  },
  PUBLIC_EDUCATION: {
    "text": "도시 전체의 목적이 하나이므로 교육도 모두에게 동일해야 하고, 사적인 일이 아니라 국가의 공적 책임이어야 한다.",
    "author": "아리스토텔레스",
    "work": "정치학",
    "sourceUrl": "https://web.mit.edu/classics/Aristotle/politics.8.eight.html",
    "sourceSection": "제8권 제1장",
    "translation": "직접 번역"
  },
  MUNICIPAL_GOVERNMENT: {
    "text": "시민은 사법과 행정에 참여한다.",
    "author": "아리스토텔레스",
    "work": "정치학",
    "sourceUrl": "https://www.gutenberg.org/ebooks/6762",
    "sourceSection": "정치학 제3권 제1장",
    "translation": "직접 번역"
  },
  PROFESSIONAL_SCIENCE: {
    "text": "나는 실험 철학을 정신의 큰 황홀함과 기쁨으로만 제안하는 것이 아니라, 감각으로 직접 누리는 즐거움으로도 제안한다.",
    "author": "로버트 훅",
    "work": "마이크로그라피아",
    "sourceUrl": "https://www.gutenberg.org/ebooks/15491",
    "sourceSection": "서문",
    "translation": "직접 번역"
  },
  NATION_STATE: {
    "text": "법에 복종하는 인민이 그 법의 입법자여야 한다.",
    "author": "장 자크 루소",
    "work": "사회계약론",
    "sourceUrl": "https://www.gutenberg.org/ebooks/46333",
    "sourceSection": "사회계약론 제2권 제6장",
    "translation": "직접 번역"
  },
  HUMANITARIANISM: {
    "text": "네 이웃을 네 몸과 같이 사랑하라.",
    "author": "마태",
    "work": "성서",
    "sourceUrl": "https://www.gutenberg.org/ebooks/10",
    "sourceSection": "마태복음 22장 39절",
    "translation": "직접 번역"
  },
  CORPORATE_ENTERPRISE: {
    "text": "한 나라의 해마다의 노동은 그 소비를 대는 바탕이다.",
    "author": "애덤 스미스",
    "work": "국부론",
    "sourceUrl": "https://www.gutenberg.org/ebooks/3300",
    "sourceSection": "서론과 저술 계획",
    "translation": "직접 번역"
  },
  RESEARCH_UNIVERSITY: {
    "text": "우리에게는 모든 책에 실린 실험을 모으는 사람이 세 명 있다.",
    "author": "프랜시스 베이컨",
    "work": "새 아틀란티스",
    "sourceUrl": "https://www.gutenberg.org/ebooks/2434",
    "sourceSection": "솔로몬의 집, 실험 수집 담당자",
    "translation": "직접 번역"
  },
  SOCIAL_INSURANCE: {
    "text": "모든 사람이 살아갈 길을 마련해 주는 편이 훨씬 낫다.",
    "author": "토머스 모어",
    "work": "유토피아",
    "sourceUrl": "https://www.gutenberg.org/ebooks/2130",
    "sourceSection": "유토피아 제1권",
    "translation": "직접 번역"
  },
  NATIONAL_MOBILIZATION: {
    "text": "전쟁에서 폭발하는 열정은 이미 인민 안에 잠재해 있어야 한다.",
    "author": "카를 폰 클라우제비츠",
    "work": "전쟁론",
    "sourceUrl": "https://www.gutenberg.org/ebooks/1946",
    "sourceSection": "전쟁론 제1편 제1장",
    "translation": "직접 번역"
  },
  MASS_JOURNALISM: {
    "text": "지배적인 여론과 정서의 폭정, 그리고 사회가 자기 관념을 강요하려는 경향",
    "author": "존 스튜어트 밀",
    "work": "자유론",
    "sourceUrl": "https://www.gutenberg.org/ebooks/34901",
    "sourceSection": "자유론 제1장",
    "translation": "직접 번역"
  },
  SOCIAL_GOSPEL: {
    "text": "고난받는 고아와 과부를 돌보고 세상에 물들지 않는 것이 경건이다.",
    "author": "야고보",
    "work": "성서",
    "sourceUrl": "https://www.gutenberg.org/ebooks/10",
    "sourceSection": "야고보서 1장 27절",
    "translation": "직접 번역"
  },
  STANDARD_TIME: {
    "text": "해시계와 물시계의 눈금은 계절과 달에 따른 시간 길이를 조정해야 한다.",
    "author": "마르쿠스 비트루비우스 폴리오",
    "work": "건축십서",
    "sourceUrl": "https://www.gutenberg.org/ebooks/20239",
    "sourceSection": "제9권 제8장, 해시계와 물시계 §6",
    "translation": "직접 번역"
  },
  STATISTICAL_ADMINISTRATION: {
    "text": "정치산술의 한 사례로, 나는 비교급·최상급 표현과 지적 논증만 쓰는 대신 수·무게·척도로 내 생각을 표현해 왔다.",
    "author": "윌리엄 페티",
    "work": "정치산술",
    "sourceUrl": "https://www.marxists.org/reference/subject/economics/petty/index.htm",
    "sourceSection": "서문",
    "translation": "직접 번역"
  },
  MUNICIPAL_WELFARE: {
    "text": "구성원 대다수가 가난하고 비참한 사회는 번영하고 행복할 수 없다.",
    "author": "애덤 스미스",
    "work": "국부론",
    "sourceUrl": "https://www.gutenberg.org/ebooks/3300",
    "sourceSection": "국부론 제1편 제8장",
    "translation": "직접 번역"
  },
  INTERNATIONAL_LAW: {
    "text": "힘은 권리를 만들지 않으며, 정당한 권력에만 복종해야 한다.",
    "author": "장 자크 루소",
    "work": "사회계약론",
    "sourceUrl": "https://www.gutenberg.org/ebooks/46333",
    "sourceSection": "사회계약론 제1권 제3장",
    "translation": "직접 번역"
  },
  COMPULSORY_EDUCATION: {
    "text": "교육은 법으로 규정되어 국가의 일이 되어야 한다.",
    "author": "아리스토텔레스",
    "work": "정치학",
    "sourceUrl": "https://web.mit.edu/classics/Aristotle/politics.8.eight.html",
    "sourceSection": "제8권 제1장",
    "translation": "직접 번역"
  },
  ECUMENICAL_MOVEMENT: {
    "text": "몸도 하나요 영도 하나다.",
    "author": "바울",
    "work": "성서",
    "sourceUrl": "https://www.gutenberg.org/ebooks/10",
    "sourceSection": "에베소서 4장 4절",
    "translation": "직접 번역"
  },
  REGULATED_UTILITIES: {
    "text": "가장 유용한 공공사업 몇 가지를 유지하는 일",
    "author": "애덤 스미스",
    "work": "국부론",
    "sourceUrl": "https://www.gutenberg.org/ebooks/3300",
    "sourceSection": "국부론 제4편 제7장 「식민지」",
    "translation": "직접 번역"
  },
  PROFESSIONAL_LICENSING: {
    "text": "의사는 의술에 봉사하고, 환자는 의사와 함께 병에 맞서 싸워야 한다.",
    "author": "히포크라테스",
    "work": "히포크라테스 전집",
    "sourceUrl": "https://www.gutenberg.org/ebooks/72583",
    "sourceSection": "전염병 I.11 (애덤스 번역본 제1권, 첫 번째 체질 §5)",
    "translation": "직접 번역"
  },
  TRADE_UNIONISM: {
    "text": "사용자들은 늘 암묵적이지만 지속적이고 한결같이 결탁한다.",
    "author": "애덤 스미스",
    "work": "국부론",
    "sourceUrl": "https://www.gutenberg.org/ebooks/3300",
    "sourceSection": "국부론 제1편 제8장",
    "translation": "직접 번역"
  },
  HAGUE_CONVENTIONS: {
    "text": "평화를 이루는 사람은 복이 있으니 하느님의 자녀라 불릴 것이다.",
    "author": "마태",
    "work": "성서",
    "sourceUrl": "https://www.gutenberg.org/ebooks/10",
    "sourceSection": "마태복음 5장 9절",
    "translation": "직접 번역"
  },
  UNIVERSAL_SUFFRAGE: {
    "text": "인민 집회에서 법안이 제안되면, 인민은 찬반보다 그것이 일반의지에 맞는지를 묻는다.",
    "author": "장 자크 루소",
    "work": "사회계약론",
    "sourceUrl": "https://www.gutenberg.org/ebooks/46333",
    "sourceSection": "사회계약론 제4권 제2장",
    "translation": "직접 번역"
  },
  RELIGIOUS_PLURALISM: {
    "text": "섬 곳곳은 물론 도시마다 종교가 여럿 있다.",
    "author": "토머스 모어",
    "work": "유토피아",
    "sourceUrl": "https://www.gutenberg.org/ebooks/2130",
    "sourceSection": "유토피아 제2권 「유토피아인의 종교」",
    "translation": "직접 번역"
  },
});

export const ADVANCEMENT_QUOTE_ASSIGNMENTS = Object.freeze({
  tools: ['STONE_TOOLS', 'CORDAGE', 'CRAFTSMANSHIP', 'ADVANCED_CARVING', 'OBSIDIAN_KNAPPING', 'STEEL_TOOLS'],
  fire: ['FIREMAKING', 'HEARTH'],
  pottery: ['POTTERY'],
  navigation: ['BASIC_SAILING', 'LATEEN_SAIL', 'NAVIGATION', 'OCEAN_NAVIGATION', 'CELESTIAL_NAVIGATION', 'POWERED_FLIGHT'],
  cartography: ['CARTOGRAPHY', 'OCEANIC_CARTOGRAPHY'],
  shipbuilding: [
    'BASIC_SHIPBUILDING', 'HULL_FRAMING', 'DEEP_WATER_SHIPBUILDING', 'GALLEON_SHIPBUILDING',
    'SHIP_OF_THE_LINE', 'IRONCLAD_SHIPBUILDING', 'TURBINE_WARSHIP',
  ],
  hunting: ['HUNTING', 'TRAPPING', 'MEGAFAUNA_HIDE'],
  fishing: ['FISHING'],
  agriculture: [
    'AGRICULTURE', 'IRRIGATION', 'CROP_CALENDAR', 'THREE_FIELD_SYSTEM', 'HEAVY_PLOUGH',
    'CROP_ROTATION', 'IMPROVED_AGRICULTURE', 'NEW_CROP_CULTIVATION', 'SEED_SELECTION',
    'MODERN_AGRONOMY', 'MECHANIZED_FARMING', 'AGRARIAN_REFORM',
  ],
  husbandry: ['ANIMAL_HUSBANDRY'],
  nature: ['GATHERING', 'BOTANICAL_CLASSIFICATION'],
  medicine: [
    'HERBALISM', 'MEDICAL_CORPUS', 'SURGICAL_TOOLS', 'HERBAL_MEDICINE', 'MEDIEVAL_MEDICINE',
    'PHARMACOPOEIA', 'MISSIONARY_MEDICINE', 'ANTISEPTIC_SURGERY', 'EMERGENCY_MEDICINE',
    'BLOOD_TYPING',
  ],
  anatomy: ['ANATOMICAL_STUDY'],
  publicHealth: [
    'PUBLIC_HEALTH', 'HOSPITAL_SANITATION', 'MODERN_HOSPITAL', 'PUBLIC_SANITATION',
    'DISTRICT_NURSING', 'X_RAY_IMAGING',
  ],
  vaccination: ['VACCINATION'],
  germTheory: ['GERM_THEORY', 'PASTEURIZATION', 'BACTERIOLOGICAL_LAB'],
  foodPreservation: ['FOOD_STORAGE', 'FOOD_CANNING'],
  architecture: [
    'SHELTER', 'SETTLEMENT', 'EARLY_CONSTRUCTION', 'EARLY_CIVIL_ENGINEERING', 'FORTIFICATION',
    'ROAD_BUILDING', 'MASONRY_VAULTS', 'CASTLE_ENGINEERING', 'TRACE_ITALIENNE',
  ],
  aqueduct: ['AQUEDUCT_ENGINEERING'],
  mathematics: ['COUNTING', 'BASIC_MATH'],
  mechanics: ['LEVER_MECHANICS', 'MECHANICAL_ENGINEERING', 'DRAINAGE_PUMP', 'CLASSICAL_MECHANICS'],
  waterPower: ['WATERMILL'],
  windPower: ['WINDMILL'],
  steam: [
    'STEAM_PUMP', 'EARLY_STEAM_ENGINE', 'ROTARY_STEAM_POWER', 'RAILWAY_ENGINEERING',
    'THERMODYNAMICS', 'INTERNAL_COMBUSTION_ENGINE', 'AUTOMOBILE',
  ],
  refrigeration: ['REFRIGERATION', 'COLD_CHAIN'],
  metallurgy: [
    'MINING', 'BRONZE_WORKING', 'EARLY_IRONWORKING', 'STEEL_QUENCHING', 'BLOOMERY_FURNACE',
    'ADVANCED_METALLURGY',
  ],
  steelmaking: ['BESSEMER_STEEL'],
  military: [
    'ARCHERY', 'MILITARY_TRADITION', 'EARLY_HORSEBACK', 'MILITARY_TRAINING',
    'DEFENSE_TACTICS', 'CHAINMAIL', 'PLATE_ARMOR', 'ARQUEBUS', 'FIELD_ARTILLERY',
    'STANDING_ARMY', 'MILITARY_REVOLUTION', 'PROFESSIONAL_OFFICERS', 'RIFLED_MUSKET',
    'BREECH_LOADING_RIFLE', 'STEEL_ARTILLERY', 'MASS_CONSCRIPTION', 'GENERAL_STAFF',
  ],
  chivalry: ['CHIVALRIC_CODE', 'MILITARY_ORDERS'],
  athletics: ['ATHLETIC_GAMES'],
  polity: [
    'EARLY_EMPIRE', 'REPUBLICAN_COUNCIL', 'IMPERIAL_ADMINISTRATION', 'BUREAUCRATIC_STATE',
    'URBAN_CHARTER', 'STATE_WORKFORCE', 'MUNICIPAL_GOVERNMENT', 'NATION_STATE',
    'NATIONAL_MOBILIZATION', 'REGULATED_UTILITIES',
  ],
  feudalLaw: ['FEUDAL_CONTRACT', 'ESTATES_ASSEMBLY'],
  law: ['CIVIC_LAW', 'INTERNATIONAL_LAW'],
  maritimeLaw: ['MARITIME_LAW'],
  liberty: ['SOCIAL_CONTRACT', 'UNIVERSAL_SUFFRAGE'],
  constitution: ['CONSTITUTIONAL_ASSEMBLY'],
  liberalism: ['LIBERALISM'],
  tolerance: ['CONFESSIONAL_TOLERANCE', 'RELIGIOUS_LIBERTY', 'ECUMENICAL_MOVEMENT', 'RELIGIOUS_PLURALISM'],
  economy: ['GUILD_SYSTEM'],
  trade: ['FOREIGN_TRADE'],
  currency: ['EARLY_CURRENCY'],
  industry: ['POWER_LOOM', 'INDUSTRIAL_ENTREPRENEURSHIP', 'FACTORY_SYSTEM', 'CORPORATE_ENTERPRISE'],
  faith: [
    'MYSTICISM', 'EARLY_THEOLOGY', 'CIVIC_RITUAL', 'SCHOLASTICISM', 'CODIFIED_THEOLOGY',
    'REFORMATION', 'ENLIGHTENED_THEOLOGY', 'EVANGELICAL_REVIVAL', 'SOCIAL_GOSPEL',
  ],
  monasticism: ['MONASTIC_RULE'],
  oralTradition: ['ORAL_RECORDS'],
  writing: ['ARCHIVE', 'WRITING', 'CLAY_TABLETS'],
  records: ['BOOKCRAFT', 'LIBRARY', 'PAPERMAKING'],
  history: ['HISTORY_RECORDS', 'CHRONICLE_WRITING'],
  education: [
    'CLASSICAL_EDUCATION', 'CATHEDRAL_SCHOOLS', 'UNIVERSITY_TRADITION', 'PUBLIC_EDUCATION',
    'RESEARCH_UNIVERSITY', 'COMPULSORY_EDUCATION', 'PROFESSIONAL_LICENSING',
  ],
  rhetoric: ['RHETORIC'],
  press: ['PUBLIC_DEBATE', 'PUBLIC_SPHERE', 'FREEDOM_OF_PRESS', 'MASS_JOURNALISM'],
  printing: [
    'PRINTING_BLOCKS', 'MOVABLE_TYPE_PRINTING', 'PRINT_WORKSHOP', 'COPPERPLATE_PRINTING',
    'STEAM_PRINTING_PRESS', 'MASS_PUBLISHING',
  ],
  astronomy: ['ASTRONOMY_EARLY'],
  astrology: ['ASTROLOGY'],
  glassmaking: ['GLASSMAKING'],
  optics: ['EARLY_OPTICS', 'OPTICAL_INSTRUMENTS'],
  microscopy: ['MICROSCOPE'],
  drama: ['DRAMA'],
  epic: ['EPIC_TRADITION'],
  poetry: ['POETRY', 'COURT_LITERATURE', 'ROMANCE_LITERATURE'],
  art: ['EARLY_ART', 'PATRONAGE_CULTURE'],
  photography: ['PHOTOGRAPHY', 'MOTION_PICTURES'],
  music: ['EARLY_MUSIC', 'SACRED_MUSIC', 'PHONOGRAPH'],
  time: ['CALENDAR', 'MECHANICAL_CLOCK', 'PRECISION_CLOCK', 'STANDARD_TIME'],
  philosophy: ['BASIC_PHILOSOPHY', 'CLASSICAL_PHILOSOPHY', 'NATURAL_PHILOSOPHY'],
  enlightenment: ['ENLIGHTENMENT'],
  utilitarianism: ['UTILITARIANISM'],
  experiment: ['SCIENTIFIC_METHOD'],
  empiricism: ['EMPIRICISM', 'POSITIVISM', 'PROFESSIONAL_SCIENCE'],
  scientificSociety: ['SCIENTIFIC_SOCIETY', 'STATISTICAL_ADMINISTRATION'],
  gunpowder: ['GUNPOWDER_MILL', 'MACHINE_GUN', 'SMOKELESS_POWDER'],
  chemistry: ['MODERN_CHEMISTRY', 'ORGANIC_CHEMISTRY', 'PERIODIC_LAW', 'ARTIFICIAL_FERTILIZER', 'ATOMIC_THEORY'],
  electricity: ['ELECTROMAGNETISM', 'ELECTRIC_GENERATION', 'ELECTRIC_GRID'],
  telegraphy: ['TELEGRAPHY', 'TELEPHONE', 'WIRELESS_TELEGRAPHY'],
  humanism: ['HUMANISM', 'RENAISSANCE_HUMANISM', 'HUMANITARIANISM'],
  welfare: ['POOR_RELIEF', 'SOCIAL_INSURANCE', 'MUNICIPAL_WELFARE'],
  humanitarianRelief: ['HUMANITARIAN_LOGISTICS', 'HAGUE_CONVENTIONS'],
  laborRights: ['LABOR_PROTECTION', 'TRADE_UNIONISM'],
});

const QUOTE_KEY_BY_ADVANCEMENT_ID = Object.freeze(Object.fromEntries(
  Object.entries(ADVANCEMENT_QUOTE_ASSIGNMENTS).flatMap(([quoteKey, ids]) => ids.map((id) => [id, quoteKey])),
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
  const assignedQuoteKey = QUOTE_KEY_BY_ADVANCEMENT_ID[advancement.id] || '';
  const quoteKey = assignedQuoteKey || fallbackQuoteKey(advancement);
  return {
    ...advancement,
    name: CIVILIZATION_STYLE_NAME_OVERRIDES[advancement.id] || advancement.name,
    quote: {
      ...(ADVANCEMENT_SPECIFIC_QUOTES[advancement.id] || ADVANCEMENT_QUOTE_CATALOG[quoteKey]),
      key: quoteKey,
      explicit: Boolean(assignedQuoteKey),
    },
  };
}
