import { withAdvancementLore } from './primitiveArchiveAdvancementLore';

export const GAME_SLUG = 'primitive-archive';
export const QUICK_SAVE_SLOT = 'primitive-archive-main';
export const SAVE_VERSION = 'primitive-archive-v1';
export const BASE_LOG_LIMIT = 240;
export const ARCHIVE_LOG_LIMIT_BONUS = 120;
export const ARCHIVE_VICTORY_DAY = 12;

export const EQUIPMENT_SLOT_LABELS = {
  tool: '도구',
  weapon: '무기',
  top: '상의',
  bottom: '하의',
  accessory: '장신구',
  hat: '모자',
  shoes: '신발',
  earmuffs: '귀마개',
  socks: '양말',
  gloves: '장갑',
  armWarmers: '토시',
  leggings: '레깅스',
  pauldron: '견갑',
};

export const EQUIPMENT_SLOTS = Object.keys(EQUIPMENT_SLOT_LABELS);

export const STUDENTS = [
  {
    id: 'shiroko',
    name: '시로코',
    role: '정찰',
    portrait: '/games/primitive-archive/portraits/shiroko.svg',
    stats: { gather: 9, hunt: 7, craft: 5, camp: 6 },
    trait: '탐험 피해 감소',
  },
  {
    id: 'hina',
    name: '히나',
    role: '사냥',
    portrait: '/games/primitive-archive/portraits/hina.svg',
    stats: { gather: 5, hunt: 10, craft: 4, camp: 6 },
    trait: '사냥 명중률 증가',
  },
  {
    id: 'noa',
    name: '노아',
    role: '제작',
    portrait: '/games/primitive-archive/portraits/noa.svg',
    stats: { gather: 6, hunt: 4, craft: 10, camp: 8 },
    trait: '제작 성공률 증가',
  },
  {
    id: 'hoshino',
    name: '호시노',
    role: '지원',
    portrait: '/games/primitive-archive/portraits/placeholder.svg',
    stats: { gather: 7, hunt: 6, craft: 5, camp: 9 },
    trait: '휴식 효율 증가',
  },
  {
    id: 'nonomi',
    name: '노노미',
    role: '지원',
    portrait: '/games/primitive-archive/portraits/placeholder.svg',
    stats: { gather: 8, hunt: 5, craft: 6, camp: 7 },
    trait: '파티 보정 소폭 증가',
  },
  {
    id: 'ako',
    name: '아코',
    role: '제작',
    portrait: '/games/primitive-archive/portraits/placeholder.svg',
    stats: { gather: 5, hunt: 4, craft: 9, camp: 8 },
    trait: '도구 제작 보너스',
  },
  {
    id: 'fuuka',
    name: '후우카',
    role: '지원',
    portrait: '/games/primitive-archive/portraits/placeholder.svg',
    stats: { gather: 6, hunt: 4, craft: 7, camp: 10 },
    trait: '식사와 캠프 관리에 강함',
  },
  {
    id: 'yuuka',
    name: '유우카',
    role: '제작',
    portrait: '/games/primitive-archive/portraits/placeholder.svg',
    stats: { gather: 5, hunt: 5, craft: 8, camp: 8 },
    trait: '장비 정비 보정',
  },
];

export const DIALOGUES = {
  shiroko: {
    gather: {
      success: ['쓸 만한 흔적을 찾았어. 다음 루트도 이어갈 수 있어.', '이 정도면 오늘 캠프는 버틸 수 있겠네.'],
      fail: ['발자국이 끊겼어. 조금 돌아가자.', '수풀은 많은데 쓸 만한 건 없네.'],
    },
    hunt: {
      success: ['표적 확인. 사냥감 확보.', '숨을 죽이면 기회는 와.'],
      fail: ['놓쳤어. 다음엔 바람 방향부터 볼게.', '흔적은 맞았는데 거리가 벌어졌어.'],
    },
    craft: {
      success: ['단단하게 묶었어. 바로 써도 될 것 같아.', '도구는 가볍고 튼튼해야 해.'],
      fail: ['매듭이 풀렸어. 재료를 다시 다듬자.', '균형이 안 맞아. 조금 더 손봐야 해.'],
    },
    rest: ['잠깐 호흡을 고를게.', '다음 이동을 위해 힘을 아껴두자.'],
    eat: ['먹을 수 있을 때 먹어두자.', '보급은 생존의 기본이야.'],
    research: ['기록해두면 다음 판단이 빨라져.', '패턴을 알면 위험도 줄어.'],
    camp: ['캠프 동선은 짧을수록 좋아.', '불빛이 너무 멀리 새지 않게 하자.'],
  },
  hina: {
    gather: {
      success: ['필요한 것만 챙기고 이동한다.', '좋아. 낭비 없이 모았다.'],
      fail: ['쓸데없는 소모가 많군. 정리하고 다시 움직여.', '지형이 나쁘다. 다른 방향을 보자.'],
    },
    hunt: {
      success: ['제압 완료. 식량으로 쓸 수 있겠어.', '위험 요소 제거. 계속 간다.'],
      fail: ['반격을 허용했다. 방심하지 마.', '놓쳤다. 다음 교전은 짧게 끝낸다.'],
    },
    craft: {
      success: ['충분히 실전용이다.', '마감은 거칠지만 쓸 수 있어.'],
      fail: ['내구성이 부족해. 다시 만들어라.', '이 상태로는 위험하다.'],
    },
    rest: ['휴식도 작전의 일부다.', '무리해서 쓰러지는 것보다 낫다.'],
    eat: ['체력을 유지해라. 다음 사냥이 남았다.', '배를 채웠다면 바로 정비한다.'],
    research: ['정보를 모아라. 감으로 버틸 수는 없다.', '다음 위협을 예측할 근거가 필요하다.'],
    camp: ['방어선을 먼저 정한다.', '불과 대피소가 안정되면 밤을 넘길 수 있다.'],
  },
  noa: {
    gather: {
      success: ['채집량과 위치를 기록해둘게요.', '이 자원은 제작 동선에 도움이 되겠네요.'],
      fail: ['오늘 이 구역 수율은 낮다고 적어둘게요.', '조건이 좋지 않네요. 표본은 충분해요.'],
    },
    hunt: {
      success: ['사냥 결과를 식량 계획에 반영할게요.', '성공이에요. 위험도도 같이 기록했습니다.'],
      fail: ['부상 가능성이 있었어요. 다음엔 준비를 늘려요.', '실패 원인을 남겨둘게요.'],
    },
    craft: {
      success: ['설계대로 완성됐어요.', '좋아요. 다음 제작 성공률도 조금 기대할 수 있겠어요.'],
      fail: ['재료 손실을 기록했습니다. 다음 배합을 바꿔볼게요.', '실패도 데이터예요. 다시 해봐요.'],
    },
    rest: ['회복량도 기록해둘게요.', '휴식 후 상태 변화를 확인하겠습니다.'],
    eat: ['허기 수치가 안정됐어요.', '섭취 후 상태를 갱신할게요.'],
    research: ['연구 노트에 진척을 남겼어요.', '기록이 쌓이면 생존 확률도 올라가요.'],
    camp: ['캠프 개선 내역을 정리해둘게요.', '시설 상태가 좋아지면 행동 효율도 오를 거예요.'],
  },
};

export const ZONES = [
  { id: 'forest', name: '숲', gather: [['wood', 2], ['fiber', 1], ['berry', 1], ['resin', 1, 0.35]], hunt: [['hide', 1], ['meat', 1], ['sinew', 1, 0.22]], note: '나무와 섬유가 안정적으로 나오고, 수지를 찾을 수 있습니다.' },
  { id: 'river', name: '강가', gather: [['stone', 2], ['clay', 1], ['herb', 1], ['resin', 1, 0.18]], hunt: [['meat', 1], ['bone', 1], ['tooth', 1, 0.16]], note: '돌과 약초를 모으기 좋고, 작은 사냥감의 이빨을 얻을 수 있습니다.' },
  { id: 'cave', name: '동굴', gather: [['stone', 2], ['flint', 1], ['obsidian_shard', 1, 0.22]], hunt: [['bone', 2], ['hide', 1], ['tooth', 1, 0.24], ['mutant_gland', 1, 0.08]], note: '부싯돌과 뼈가 잘 나오지만 위험합니다. 드물게 흑요석과 변이체 부산물이 나옵니다.' },
  { id: 'plains', name: '초원', gather: [['fiber', 2], ['berry', 1], ['herb', 1, 0.25]], hunt: [['meat', 2], ['hide', 1], ['sinew', 1, 0.28], ['dino_hide', 1, 0.14], ['dino_bone', 1, 0.12], ['rune_shard', 1, 0.05]], note: '식량과 대형 사냥감 기회가 있습니다. 희귀한 공룡 소재도 노릴 수 있습니다.' },
];

export const SEASONS = [
  { id: 'spring', name: '봄', length: 6, note: '비와 새싹이 늘어 채집이 유리합니다.', gatherMod: 0.03, huntMod: 0 },
  { id: 'summer', name: '여름', length: 6, note: '긴 낮 덕분에 사냥이 쉬워지지만 더위가 찾아옵니다.', gatherMod: 0, huntMod: 0.03 },
  { id: 'autumn', name: '가을', length: 6, note: '수확량이 늘어 겨울 비축에 가장 중요한 시기입니다.', gatherMod: 0.02, huntMod: 0.01 },
  { id: 'winter', name: '겨울', length: 6, note: '채집과 사냥이 어려워지고 추위 대비가 필요합니다.', gatherMod: -0.05, huntMod: -0.04 },
];

export const WORLD_REGIONS = [
  {
    id: 'camp-heart', name: '부족 중심지', zoneId: 'forest', x: 500, y: 320, neighbors: ['whisper-woods', 'river-ford', 'sun-meadow'],
    revealedAtStart: true, safe: true, danger: 0, yieldBonus: 0, landmark: '모닥불과 첫 대피소', yieldHint: '행동 거점', discoveryReward: [],
  },
  {
    id: 'whisper-woods', name: '속삭임 숲', zoneId: 'forest', x: 310, y: 245, neighbors: ['camp-heart', 'old-grove', 'echo-cave', 'sun-meadow'],
    revealedAtStart: true, danger: 1, yieldBonus: 0.04, landmark: '수지 맺힌 고목', yieldHint: '나무·섬유·수지', discoveryReward: [['wood', 2], ['fiber', 1]],
  },
  {
    id: 'river-ford', name: '얕은 여울', zoneId: 'river', x: 690, y: 245, neighbors: ['camp-heart', 'clay-bank', 'red-cliffs', 'sun-meadow'],
    revealedAtStart: true, danger: 1, yieldBonus: 0.04, landmark: '건널 수 있는 물길', yieldHint: '돌·점토·약초', discoveryReward: [['stone', 2], ['herb', 1]],
  },
  {
    id: 'sun-meadow', name: '햇살 초원', zoneId: 'plains', x: 500, y: 455, neighbors: ['camp-heart', 'whisper-woods', 'river-ford', 'bone-field', 'wind-plains'],
    danger: 2, yieldBonus: 0.06, landmark: '대형 짐승의 이동로', yieldHint: '베리·고기·가죽', discoveryReward: [['berry', 2], ['meat', 1]],
  },
  {
    id: 'old-grove', name: '태고의 숲', zoneId: 'forest', x: 170, y: 115, neighbors: ['whisper-woods', 'north-ridge'],
    danger: 2, yieldBonus: 0.08, rareBonus: 0.04, landmark: '거대한 연륜목', yieldHint: '나무·수지·희귀 흔적', discoveryReward: [['resin', 1], ['wood', 2]],
  },
  {
    id: 'echo-cave', name: '메아리 동굴', zoneId: 'cave', x: 135, y: 390, neighbors: ['whisper-woods', 'obsidian-hollow', 'bone-field'],
    danger: 3, yieldBonus: 0.08, rareBonus: 0.06, landmark: '벽면의 오래된 긁힌 자국', yieldHint: '부싯돌·뼈·흑요석', discoveryReward: [['flint', 1], ['bone', 1]],
  },
  {
    id: 'clay-bank', name: '붉은 점토톱', zoneId: 'river', x: 835, y: 115, neighbors: ['river-ford', 'north-ridge', 'marsh-delta'],
    danger: 2, yieldBonus: 0.07, landmark: '붉은 점토층', yieldHint: '점토·돌·약초', discoveryReward: [['clay', 2], ['stone', 1]],
  },
  {
    id: 'red-cliffs', name: '붉은 절벽', zoneId: 'cave', x: 865, y: 390, neighbors: ['river-ford', 'marsh-delta', 'wind-plains'],
    danger: 4, yieldBonus: 0.1, rareBonus: 0.08, landmark: '노출된 검은 암맥', yieldHint: '돌·흑요석·변이 소재', discoveryReward: [['obsidian_shard', 1], ['stone', 2]],
  },
  {
    id: 'bone-field', name: '뼈의 들판', zoneId: 'plains', x: 305, y: 555, neighbors: ['sun-meadow', 'echo-cave', 'obsidian-hollow'],
    danger: 3, yieldBonus: 0.08, rareBonus: 0.04, landmark: '거대 생물의 골격', yieldHint: '뼈·가죽·공룡 소재', discoveryReward: [['bone', 2], ['hide', 1]],
  },
  {
    id: 'wind-plains', name: '바람 초원', zoneId: 'plains', x: 695, y: 555, neighbors: ['sun-meadow', 'red-cliffs', 'marsh-delta'],
    danger: 3, yieldBonus: 0.09, rareBonus: 0.05, landmark: '끝없이 이어진 짐승길', yieldHint: '고기·가죽·룬 파편', discoveryReward: [['meat', 2], ['sinew', 1]],
  },
  {
    id: 'obsidian-hollow', name: '흑요석 함몰지', zoneId: 'cave', x: 95, y: 585, neighbors: ['echo-cave', 'bone-field'],
    danger: 5, yieldBonus: 0.12, rareBonus: 0.12, landmark: '검은 유리질 지층', yieldHint: '흑요석·희귀 광물', discoveryReward: [['obsidian_shard', 2]],
  },
  {
    id: 'marsh-delta', name: '안개 삼각주', zoneId: 'river', x: 905, y: 585, neighbors: ['clay-bank', 'red-cliffs', 'wind-plains'],
    danger: 4, yieldBonus: 0.11, rareBonus: 0.07, landmark: '안개 속 석조 기둥', yieldHint: '약초·점토·룬 파편', discoveryReward: [['herb', 2], ['clay', 1]],
  },
  {
    id: 'north-ridge', name: '북쪽 하늘마루', zoneId: 'cave', x: 500, y: 70, neighbors: ['old-grove', 'clay-bank'],
    danger: 5, yieldBonus: 0.12, rareBonus: 0.1, landmark: '별을 관측하기 좋은 석대', yieldHint: '돌·흑요석·천문 단서', discoveryReward: [['rune_shard', 1], ['stone', 2]],
  },
];

export const TRIBE_PROJECTS = [
  {
    id: 'drying-rack', name: '공동 건조대', era: 'PRIMITIVE', prereqs: ['GATHERING'], work: 5,
    cost: { wood: 3, fiber: 2 }, effectId: 'FOOD_RESERVE', reward: { jerky: 1 },
    description: '식량을 말리고 분배하는 공동 시설입니다.', effectText: '식량 회복 +2 · 완성 시 육포 1개',
  },
  {
    id: 'trail-markers', name: '탐사 표식망', era: 'NEOLITHIC', prereqs: ['CARTOGRAPHY'], work: 6,
    cost: { wood: 3, fiber: 3, resin: 1 }, effectId: 'DISCOVERY_NETWORK', reward: { fiber: 2 },
    description: '나무 표식과 매듭으로 탐사 경로를 연결합니다.', effectText: '새 지역 발견 확률 증가',
  },
  {
    id: 'irrigation-ditch', name: '공동 관개수로', era: 'ANCIENT', prereqs: ['AGRICULTURE'], work: 8,
    cost: { wood: 4, stone: 4, clay: 2 }, effectId: 'PROJECT_GATHER_UP', reward: { berry: 3, herb: 2 },
    description: '물길을 정리해 계절과 무관하게 식물 자원을 확보합니다.', effectText: '채집 성공률·추가 수확 증가',
  },
  {
    id: 'council-fire', name: '부족 회의 화덕', era: 'ANCIENT', prereqs: ['ORAL_RECORDS'], work: 7,
    cost: { wood: 4, stone: 2, resin: 1 }, effectId: 'PROJECT_RESEARCH_UP', reward: { clay: 2 },
    description: '하루의 경험을 모아 다음 세대에 전하는 회의 장소입니다.', effectText: '턴·일일 자동 연구 +1RP · 문화 +1CP',
  },
  {
    id: 'palisade', name: '목책 방어선', era: 'ANCIENT', prereqs: ['EARLY_CONSTRUCTION'], work: 9,
    cost: { wood: 7, stone: 3, hide: 2 }, effectId: 'PROJECT_DEFENSE_UP', reward: { hide: 1 },
    description: '짐승과 악천후로부터 정착지를 지키는 방어선입니다.', effectText: '사냥 실패·날씨 피해 감소',
  },
  {
    id: 'stone-monument', name: '부족 석조 기념물', era: 'CLASSICAL', prereqs: ['CLASSICAL_PHILOSOPHY'], work: 12,
    cost: { stone: 10, clay: 5, rune_shard: 1 }, effectId: 'PROJECT_ARCHIVE_SCORE', reward: { rune_shard: 1 },
    description: '부족의 역사와 지식을 돌에 새기는 장기 사업입니다.', effectText: '기록 점수 +400',
  },
];

export const TRIBE_JOBS = [
  {
    id: 'forager', name: '채집대', action: 'gather',
    description: '캠프 주변에서 목재, 섬유, 식량을 꾸준히 확보합니다.',
    outputText: '나무 중심 · 섬유와 베리 보조',
  },
  {
    id: 'hunter', name: '수렵대', action: 'combat',
    description: '짐승의 흔적을 추적해 고기와 가죽을 조달합니다.',
    outputText: '고기 중심 · 가죽 주기 생산',
  },
  {
    id: 'builder', name: '건설대', action: 'project',
    description: '선택한 공동 프로젝트에 매일 작업량을 투입합니다.',
    outputText: '1명당 프로젝트 작업 +1',
  },
  {
    id: 'scholar', name: '기록대', action: 'research',
    description: '현재 목표 기술에 매일 연구 포인트를 투입합니다.',
    outputText: '1명당 목표 기술 +1RP',
  },
];

export const RIVAL_TRIBES = [
  {
    id: 'ember-grove', name: '잿불숲 부족', homeRegionId: 'old-grove',
    temperament: '전통 중시', specialty: '나무와 수지', startRelation: 8,
    tradeCost: { stone: 2 }, tradeReward: { wood: 3, resin: 1 },
    giftCost: { berry: 2, meat: 1 }, exchangeCost: { clay: 1 }, exchangePoints: 4,
    raidReward: { wood: 4, resin: 2 },
    greeting: '오래된 숲의 불씨를 지키는 이들이 교역 표식을 남겼습니다.',
  },
  {
    id: 'river-clay', name: '붉은강 부족', homeRegionId: 'clay-bank',
    temperament: '실리 추구', specialty: '점토와 석재', startRelation: 2,
    tradeCost: { wood: 2, fiber: 1 }, tradeReward: { clay: 3, stone: 2 },
    giftCost: { cooked_meat: 1, berry: 1 }, exchangeCost: { resin: 1 }, exchangePoints: 5,
    raidReward: { clay: 4, stone: 3 },
    greeting: '강변의 토기 제작자들이 물길 건너편에서 거래 조건을 제시했습니다.',
  },
  {
    id: 'sky-ridge', name: '하늘마루 부족', homeRegionId: 'north-ridge',
    temperament: '신중한 탐구', specialty: '흑요석과 천문 지식', startRelation: -4,
    tradeCost: { hide: 2, resin: 1 }, tradeReward: { obsidian_shard: 2, rune_shard: 1 },
    giftCost: { herb: 2, jerky: 1 }, exchangeCost: { rune_shard: 1 }, exchangePoints: 7,
    raidReward: { obsidian_shard: 3, rune_shard: 1 },
    greeting: '별을 읽는 이들이 능선 위에서 이쪽의 의도를 살피고 있습니다.',
  },
];

export const ITEMS = {
  wood: { name: '나무', icon: 'wood', weight: 1 },
  stone: { name: '돌', icon: 'stone', weight: 1 },
  fiber: { name: '섬유', icon: 'fiber', weight: 1 },
  hide: { name: '가죽', icon: 'hide', weight: 1 },
  bone: { name: '뼈', icon: 'bone', weight: 1 },
  sinew: { name: '힘줄', icon: 'hide', weight: 1 },
  tooth: { name: '이빨', icon: 'bone', weight: 1 },
  dino_hide: { name: '공룡 가죽', icon: 'hide', weight: 2 },
  dino_bone: { name: '공룡 뼈', icon: 'bone', weight: 2 },
  mutant_gland: { name: '변이체 분비물', icon: 'herb', weight: 1 },
  obsidian_shard: { name: '흑요석 조각', icon: 'stone', weight: 1 },
  rune_shard: { name: '룬 파편', icon: 'artifact', weight: 1 },
  flint: { name: '부싯돌', icon: 'stone', weight: 1 },
  clay: { name: '점토', icon: 'stone', weight: 1 },
  resin: { name: '수지', icon: 'wood', weight: 1 },
  herb: { name: '약초', icon: 'herb', weight: 1 },
  berry: { name: '베리', icon: 'food', weight: 1, type: 'food', nutrition: 8, heal: 0 },
  meat: { name: '고기', icon: 'food', weight: 1, type: 'food', nutrition: 12, heal: 0 },
  cooked_meat: { name: '구운 고기', icon: 'food', weight: 1, type: 'food', nutrition: 28, heal: 6 },
  jerky: { name: '육포', icon: 'food', weight: 1, type: 'food', nutrition: 18, heal: 2 },
  packed_ration: { name: '보존 식량 꾸러미', icon: 'food', weight: 1, type: 'food', nutrition: 34, heal: 4 },
  herb_tonic: { name: '약초 달임', icon: 'herb', weight: 1, type: 'food', nutrition: 0, heal: 12 },
  twine: { name: '끈', icon: 'fiber', weight: 1 },
  leather_strip: { name: '가죽끈', icon: 'hide', weight: 1 },
  stone_axe: { name: '돌도끼', icon: 'tool', weight: 3, type: 'equip', slot: 'tool', successAdd: { gather: 0.08, craft: 0.03 }, staminaAdd: { gather: -2 } },
  bow: { name: '활', icon: 'weapon', weight: 2, type: 'equip', slot: 'weapon', successAdd: { hunt: 0.1 }, staminaAdd: { hunt: -1 } },
  flint_knife: { name: '부싯돌 칼', icon: 'tool', weight: 1, type: 'equip', slot: 'tool', successAdd: { craft: 0.06, gather: 0.02 }, staminaAdd: { craft: -2 } },
  bone_pick: { name: '뼈 곡괭이', icon: 'tool', weight: 2, type: 'equip', slot: 'tool', successAdd: { gather: 0.08 }, staminaAdd: { gather: -1 } },
  bone_awl: { name: '뼈 송곳', icon: 'tool', weight: 1, type: 'equip', slot: 'tool', successAdd: { craft: 0.1, gather: 0.02 }, staminaAdd: { craft: -1 } },
  spear: { name: '창', icon: 'weapon', weight: 3, type: 'equip', slot: 'weapon', successAdd: { hunt: 0.06 }, staminaAdd: { hunt: -1 } },
  sling: { name: '투석구', icon: 'weapon', weight: 1, type: 'equip', slot: 'weapon', successAdd: { hunt: 0.05 } },
  atlatl: { name: '투창기(아틀라틀)', icon: 'weapon', weight: 2, type: 'equip', slot: 'weapon', successAdd: { hunt: 0.1 } },
  obsidian_blade: { name: '흑요석 칼날', icon: 'weapon', weight: 2, type: 'equip', slot: 'weapon', successAdd: { hunt: 0.13, craft: 0.03 }, staminaAdd: { hunt: -1 } },
  hide_coat: { name: '가죽 상의', icon: 'armor', weight: 2, type: 'equip', slot: 'top', insulation: 3, staminaAdd: { rest: -1 } },
  hide_pants: { name: '가죽 하의', icon: 'armor', weight: 2, type: 'equip', slot: 'bottom', insulation: 2 },
  hat_fur: { name: '털모자', icon: 'armor', weight: 1, type: 'equip', slot: 'hat', insulation: 1 },
  shoes_leather: { name: '가죽 신발', icon: 'armor', weight: 1, type: 'equip', slot: 'shoes', insulation: 1, staminaAdd: { gather: -1 } },
  earmuffs: { name: '귀마개', icon: 'armor', weight: 1, type: 'equip', slot: 'earmuffs', insulation: 1 },
  socks: { name: '양말', icon: 'armor', weight: 1, type: 'equip', slot: 'socks', insulation: 1 },
  gloves: { name: '장갑', icon: 'armor', weight: 1, type: 'equip', slot: 'gloves', insulation: 1, successAdd: { craft: 0.03 } },
  arm_warmers: { name: '토시', icon: 'armor', weight: 1, type: 'equip', slot: 'armWarmers', insulation: 1 },
  leggings: { name: '레깅스', icon: 'armor', weight: 1, type: 'equip', slot: 'leggings', insulation: 1 },
  pauldron: { name: '견갑', icon: 'armor', weight: 2, type: 'equip', slot: 'pauldron', successAdd: { hunt: 0.03 } },
  fur_coat: { name: '털 상의', icon: 'armor', weight: 3, type: 'equip', slot: 'top', insulation: 4, staminaAdd: { rest: -1 } },
  fur_pants: { name: '털 하의', icon: 'armor', weight: 3, type: 'equip', slot: 'bottom', insulation: 3 },
  fur_hat: { name: '두꺼운 털모자', icon: 'armor', weight: 1, type: 'equip', slot: 'hat', insulation: 2 },
  fur_boots: { name: '털 부츠', icon: 'armor', weight: 2, type: 'equip', slot: 'shoes', insulation: 2, staminaAdd: { gather: -1 } },
  fur_earmuffs: { name: '두꺼운 귀마개', icon: 'armor', weight: 1, type: 'equip', slot: 'earmuffs', insulation: 2 },
  fur_socks: { name: '두꺼운 양말', icon: 'armor', weight: 1, type: 'equip', slot: 'socks', insulation: 2 },
  fur_gloves: { name: '두꺼운 장갑', icon: 'armor', weight: 1, type: 'equip', slot: 'gloves', insulation: 2, successAdd: { craft: 0.04 } },
  dino_scale_vest: { name: '공룡 비늘 조끼', icon: 'armor', weight: 3, type: 'equip', slot: 'top', insulation: 5, successAdd: { hunt: 0.05 } },
  charm: { name: '부싯돌 장신구', icon: 'artifact', weight: 1, type: 'equip', slot: 'accessory', successAdd: { craft: 0.04, gather: 0.02 } },
  hunter_talisman: { name: '사냥 부적', icon: 'artifact', weight: 1, type: 'equip', slot: 'accessory', successAdd: { hunt: 0.06 } },
  crafter_amulet: { name: '제작 부적', icon: 'artifact', weight: 1, type: 'equip', slot: 'accessory', successAdd: { craft: 0.06 } },
  gatherer_charm: { name: '채집 부적', icon: 'artifact', weight: 1, type: 'equip', slot: 'accessory', successAdd: { gather: 0.06 } },
  weather_totem: { name: '날씨 토템', icon: 'artifact', weight: 1, type: 'equip', slot: 'accessory', successAdd: { gather: 0.02, hunt: 0.02, craft: 0.02 } },
  book_craft_guide: { name: '제작 안내서', icon: 'artifact', weight: 1, type: 'book' },
  book_camp_manual: { name: '캠프 운영서', icon: 'artifact', weight: 1, type: 'book' },
  clay_tablet: { name: '점토 기록판', icon: 'artifact', weight: 1, type: 'book' },
};

export const RECIPES = [
  { id: 'twine', name: '끈', requires: { fiber: 2 }, baseChance: 0.9, reward: { twine: 1 }, note: '초기 제작 재료입니다.' },
  { id: 'stone_axe', name: '돌도끼', requires: { wood: 2, stone: 3 }, baseChance: 0.7, reward: { stone_axe: 1 }, note: '채집 성공률을 올립니다.' },
  { id: 'bow', name: '활', requires: { wood: 2, fiber: 3, twine: 1 }, baseChance: 0.62, reward: { bow: 1 }, note: '사냥 성공률을 올립니다.' },
  { id: 'flint_knife', name: '부싯돌 칼', requires: { flint: 2, wood: 1, twine: 1 }, baseChance: 0.72, reward: { flint_knife: 1 }, note: '제작과 채집을 동시에 보조하는 정밀 도구입니다.' },
  { id: 'bone_pick', name: '뼈 곡괭이', requires: { bone: 2, wood: 1, twine: 1 }, baseChance: 0.72, reward: { bone_pick: 1 }, note: '채집 성공률과 피로 관리에 유리합니다.' },
  { id: 'bone_awl', name: '뼈 송곳', requires: { bone: 2, flint: 1, leather_strip: 1 }, baseChance: 0.68, reward: { bone_awl: 1 }, note: '정교한 재봉과 기록 도구 제작을 보조합니다.' },
  { id: 'spear', name: '창', requires: { wood: 2, stone: 2, twine: 1 }, baseChance: 0.66, reward: { spear: 1 }, note: '초기 사냥 안정성을 올리는 무기입니다.' },
  { id: 'sling', name: '투석구', requires: { fiber: 3, leather_strip: 1 }, baseChance: 0.72, reward: { sling: 1 }, note: '가벼운 사냥 무기입니다.' },
  { id: 'atlatl', name: '투창기(아틀라틀)', requires: { wood: 3, bone: 2, twine: 2 }, baseChance: 0.58, reward: { atlatl: 1 }, note: '큰 사냥감을 노리기 위한 중급 사냥 무기입니다.' },
  { id: 'obsidian_blade', name: '흑요석 칼날', requires: { obsidian_shard: 2, bone: 1, leather_strip: 1, twine: 1 }, baseChance: 0.5, reward: { obsidian_blade: 1 }, note: '희귀 재료로 만드는 고급 사냥 무기입니다.' },
  { id: 'leather_strip', name: '가죽끈', requires: { hide: 2 }, baseChance: 0.78, reward: { leather_strip: 1 }, note: '장비 제작에 쓰이는 중간 재료입니다.' },
  { id: 'hide_coat', name: '가죽 상의', requires: { hide: 3, fiber: 2, leather_strip: 1 }, baseChance: 0.58, reward: { hide_coat: 1 }, note: '추위 피해를 줄이는 방한 장비입니다.' },
  { id: 'hide_pants', name: '가죽 하의', requires: { hide: 3, fiber: 1 }, baseChance: 0.62, reward: { hide_pants: 1 }, note: '하의 슬롯 방한 장비입니다.' },
  { id: 'shoes_leather', name: '가죽 신발', requires: { hide: 2, fiber: 1 }, baseChance: 0.72, reward: { shoes_leather: 1 }, note: '발 보호와 채집 피로 관리에 도움을 줍니다.' },
  { id: 'hat_fur', name: '털모자', requires: { hide: 2, fiber: 1 }, baseChance: 0.72, reward: { hat_fur: 1 }, note: '모자 슬롯 방한 장비입니다.' },
  { id: 'earmuffs', name: '귀마개', requires: { fiber: 2, hide: 1 }, baseChance: 0.8, reward: { earmuffs: 1 }, note: '귀마개 슬롯의 가벼운 방한 장비입니다.' },
  { id: 'socks', name: '양말', requires: { fiber: 2 }, baseChance: 0.84, reward: { socks: 1 }, note: '양말 슬롯의 기초 방한 장비입니다.' },
  { id: 'gloves', name: '장갑', requires: { fiber: 2, hide: 1 }, baseChance: 0.8, reward: { gloves: 1 }, note: '제작 감각을 보조하는 장갑입니다.' },
  { id: 'arm_warmers', name: '토시', requires: { fiber: 2 }, baseChance: 0.84, reward: { arm_warmers: 1 }, note: '토시 슬롯의 기초 방한 장비입니다.' },
  { id: 'leggings', name: '레깅스', requires: { fiber: 3 }, baseChance: 0.76, reward: { leggings: 1 }, note: '레깅스 슬롯 방한 장비입니다.' },
  { id: 'pauldron', name: '견갑', requires: { bone: 2, hide: 1, fiber: 1 }, baseChance: 0.58, reward: { pauldron: 1 }, note: '사냥 위험을 감수하는 방어 장비입니다.' },
  { id: 'fur_coat', name: '털 상의', requires: { dino_hide: 2, hide: 2, fiber: 2 }, baseChance: 0.52, reward: { fur_coat: 1 }, note: '혹한 대응용 상위 방한 장비입니다.' },
  { id: 'fur_pants', name: '털 하의', requires: { dino_hide: 2, hide: 1, fiber: 1 }, baseChance: 0.54, reward: { fur_pants: 1 }, note: '혹한 대응용 상위 하의입니다.' },
  { id: 'fur_hat', name: '두꺼운 털모자', requires: { dino_hide: 1, hide: 1, fiber: 1 }, baseChance: 0.6, reward: { fur_hat: 1 }, note: '모자 슬롯의 상위 방한 장비입니다.' },
  { id: 'fur_boots', name: '털 부츠', requires: { dino_hide: 1, hide: 1, fiber: 1 }, baseChance: 0.6, reward: { fur_boots: 1 }, note: '신발 슬롯의 상위 방한 장비입니다.' },
  { id: 'fur_earmuffs', name: '두꺼운 귀마개', requires: { dino_hide: 1, fiber: 1 }, baseChance: 0.66, reward: { fur_earmuffs: 1 }, note: '귀마개 슬롯의 상위 방한 장비입니다.' },
  { id: 'fur_socks', name: '두꺼운 양말', requires: { dino_hide: 1, fiber: 1 }, baseChance: 0.66, reward: { fur_socks: 1 }, note: '양말 슬롯의 상위 방한 장비입니다.' },
  { id: 'fur_gloves', name: '두꺼운 장갑', requires: { dino_hide: 1, fiber: 1 }, baseChance: 0.66, reward: { fur_gloves: 1 }, note: '제작 보조가 붙은 상위 장갑입니다.' },
  { id: 'dino_scale_vest', name: '공룡 비늘 조끼', requires: { dino_hide: 2, dino_bone: 1, sinew: 2, leather_strip: 1 }, baseChance: 0.48, reward: { dino_scale_vest: 1 }, note: '대형 사냥 이후 노릴 수 있는 상위 생존 장비입니다.' },
  { id: 'charm', name: '부싯돌 장신구', requires: { flint: 1, bone: 1, twine: 1 }, baseChance: 0.66, reward: { charm: 1 }, note: '제작과 채집 감각을 보조합니다.' },
  { id: 'hunter_talisman', name: '사냥 부적', requires: { tooth: 1, bone: 1, fiber: 1 }, baseChance: 0.66, reward: { hunter_talisman: 1 }, note: '사냥 담당자에게 좋은 장신구입니다.' },
  { id: 'crafter_amulet', name: '제작 부적', requires: { flint: 1, bone: 1, fiber: 1 }, baseChance: 0.66, reward: { crafter_amulet: 1 }, note: '제작 담당자에게 좋은 장신구입니다.' },
  { id: 'gatherer_charm', name: '채집 부적', requires: { resin: 1, bone: 1, fiber: 1 }, baseChance: 0.66, reward: { gatherer_charm: 1 }, note: '채집 담당자에게 좋은 장신구입니다.' },
  { id: 'weather_totem', name: '날씨 토템', requires: { rune_shard: 1, bone: 1, resin: 1, twine: 1 }, baseChance: 0.52, reward: { weather_totem: 1 }, note: '날씨 변화를 읽고 모든 행동을 조금씩 보조합니다.' },
  { id: 'book_craft_guide', name: '제작 안내서', requires: { fiber: 4, resin: 1, clay: 1, twine: 1 }, baseChance: 0.58, reward: { book_craft_guide: 1 }, note: '책 시스템 해금 후 제작 성공률을 올리는 기록물입니다.' },
  { id: 'book_camp_manual', name: '캠프 운영서', requires: { fiber: 4, resin: 1, clay: 1, herb: 1 }, baseChance: 0.58, reward: { book_camp_manual: 1 }, note: '책 시스템 해금 후 캠프 행동 피로를 줄이는 기록물입니다.' },
  { id: 'clay_tablet', name: '점토 기록판', requires: { clay: 3, resin: 1, rune_shard: 1 }, baseChance: 0.54, reward: { clay_tablet: 1 }, note: '고대 기록 연구를 보조하는 중후반 기록물입니다.' },
  { id: 'jerky', name: '육포', requires: { meat: 2, resin: 1 }, baseChance: 0.8, reward: { jerky: 1 }, note: '가벼운 회복과 허기 관리용 보존식입니다.' },
  { id: 'packed_ration', name: '보존 식량 꾸러미', requires: { jerky: 1, berry: 1, herb: 1 }, baseChance: 0.74, reward: { packed_ration: 1 }, note: '장기 생존용으로 허기와 HP를 동시에 관리합니다.' },
  { id: 'herb_tonic', name: '약초 달임', requires: { herb: 2, berry: 1 }, baseChance: 0.72, reward: { herb_tonic: 1 }, note: '허기는 줄지 않지만 HP 회복량이 큽니다.' },
];

export const TECH_TIER_DEFS = [
  { tier: 1, name: '생존의 시작', era: 'PRIMITIVE' },
  { tier: 2, name: '불과 도구', era: 'PRIMITIVE' },
  { tier: 3, name: '정착 준비', era: 'NEOLITHIC' },
  { tier: 4, name: '전문 생존', era: 'NEOLITHIC' },
  { tier: 5, name: '생산과 기록', era: 'NEOLITHIC' },
  { tier: 6, name: '고대 기반', era: 'ANCIENT' },
  { tier: 7, name: '전문 기술', era: 'ANCIENT' },
  { tier: 8, name: '조직과 공학', era: 'ANCIENT' },
  { tier: 9, name: '고전 기반', era: 'CLASSICAL' },
  { tier: 10, name: '고전 전문화', era: 'CLASSICAL' },
  { tier: 11, name: '중세 기반', era: 'MEDIEVAL' },
  { tier: 12, name: '농업과 동력', era: 'MEDIEVAL' },
  { tier: 13, name: '도시 기술', era: 'MEDIEVAL' },
  { tier: 14, name: '학술과 성곽', era: 'MEDIEVAL' },
  { tier: 15, name: '후기 중세 기술', era: 'MEDIEVAL' },
  { tier: 16, name: '중세 전문화', era: 'MEDIEVAL' },
  { tier: 17, name: '근세 기반', era: 'EARLY_MODERN' },
  { tier: 18, name: '인쇄와 항법', era: 'EARLY_MODERN' },
  { tier: 19, name: '관찰과 요새', era: 'EARLY_MODERN' },
  { tier: 20, name: '과학과 대양', era: 'EARLY_MODERN' },
  { tier: 21, name: '정밀 기술', era: 'EARLY_MODERN' },
  { tier: 22, name: '근세 전문화', era: 'EARLY_MODERN' },
];

export const CIVIC_TIER_DEFS = [
  { tier: 1, name: '공동체의 시작', era: 'NEOLITHIC' },
  { tier: 2, name: '신앙과 전통', era: 'ANCIENT' },
  { tier: 3, name: '조직과 기록', era: 'ANCIENT' },
  { tier: 4, name: '교류와 사유', era: 'ANCIENT' },
  { tier: 5, name: '고전 사상', era: 'CLASSICAL' },
  { tier: 6, name: '공연 문화', era: 'CLASSICAL' },
  { tier: 7, name: '문학 전승', era: 'CLASSICAL' },
  { tier: 8, name: '국가와 예술', era: 'CLASSICAL' },
  { tier: 9, name: '중세 공동체', era: 'MEDIEVAL' },
  { tier: 10, name: '신앙과 봉신', era: 'MEDIEVAL' },
  { tier: 11, name: '학교와 길드', era: 'MEDIEVAL' },
  { tier: 12, name: '이학과 기사단', era: 'MEDIEVAL' },
  { tier: 13, name: '대학과 도시', era: 'MEDIEVAL' },
  { tier: 14, name: '중세 사상', era: 'MEDIEVAL' },
  { tier: 15, name: '개혁과 인문', era: 'EARLY_MODERN' },
  { tier: 16, name: '경험과 관용', era: 'EARLY_MODERN' },
  { tier: 17, name: '국가와 해양', era: 'EARLY_MODERN' },
  { tier: 18, name: '학회와 공론', era: 'EARLY_MODERN' },
  { tier: 19, name: '계몽 전야', era: 'EARLY_MODERN' },
  { tier: 20, name: '근세 사상', era: 'EARLY_MODERN' },
];

const RAW_TECH_TREE = [
  {
    id: 'GATHERING', name: '채집', era: 'PRIMITIVE', tier: 1, cost: 10, prereqs: [], tags: ['SURVIVAL'], archiveRequired: true,
    description: '식물과 지형을 읽어 기본 자원을 안정적으로 확보합니다.',
    unlocks: { passives: ['GATHER_SUCCESS_UP'] },
    eureka: { type: 'actionSuccess', action: 'gather', count: 3, bonusPct: 0.25, desc: '채집 성공 3회' },
    inspiration: { type: 'haveItem', itemId: 'berry', count: 4, bonusPct: 0.15, desc: '베리 4개 보유' },
  },
  {
    id: 'HUNTING', name: '수렵', era: 'PRIMITIVE', tier: 1, cost: 10, prereqs: [], tags: ['SURVIVAL', 'MILITARY'], archiveRequired: true,
    description: '사냥감의 흔적을 추적하고 안전한 공격 기회를 만듭니다.',
    unlocks: { passives: ['HUNT_SUCCESS_UP'] },
    eureka: { type: 'actionSuccess', action: 'hunt', count: 2, bonusPct: 0.25, desc: '사냥 성공 2회' },
    inspiration: { type: 'haveItem', itemId: 'meat', count: 2, bonusPct: 0.15, desc: '고기 2개 보유' },
  },
  {
    id: 'FIREMAKING', name: '불 피우기', era: 'PRIMITIVE', tier: 2, cost: 12, prereqs: ['GATHERING'], tags: ['CAMP', 'SURVIVAL'], archiveRequired: true,
    description: '모닥불과 조리를 열어 체온과 식량 효율을 개선합니다.',
    unlocks: { passives: ['COOKING_RECOVERY_UP'], camp: ['fire'], recipes: ['jerky'] },
    eureka: { type: 'campAction', kind: 'cook', count: 1, bonusPct: 0.3, desc: '고기 굽기 1회' },
    inspiration: { type: 'campLevel', key: 'fireLevel', count: 1, bonusPct: 0.15, desc: '모닥불 Lv.1 달성' },
  },
  {
    id: 'STONE_TOOLS', name: '석기 도구', era: 'PRIMITIVE', tier: 2, cost: 12, prereqs: ['GATHERING'], tags: ['CRAFT'], archiveRequired: true,
    description: '돌과 뼈를 다듬어 채집과 제작용 도구를 만듭니다.',
    unlocks: { passives: ['CRAFT_SUCCESS_UP'], recipes: ['stone_axe', 'flint_knife', 'bone_pick'] },
    eureka: { type: 'recipeCraft', recipeId: 'stone_axe', count: 1, bonusPct: 0.25, desc: '돌도끼 제작 1회' },
    inspiration: { type: 'haveItem', itemId: 'stone', count: 5, bonusPct: 0.15, desc: '돌 5개 보유' },
  },
  {
    id: 'CORDAGE', name: '끈과 밧줄', era: 'PRIMITIVE', tier: 2, cost: 12, prereqs: ['GATHERING'], tags: ['CRAFT'], archiveRequired: true,
    description: '섬유를 엮어 도구와 장비 제작의 기초 재료를 확보합니다.',
    unlocks: { recipes: ['twine'] },
    eureka: { type: 'haveItem', itemId: 'fiber', count: 5, bonusPct: 0.25, desc: '섬유 5개 보유' },
  },
  {
    id: 'HERBALISM', name: '약초 지식', era: 'PRIMITIVE', tier: 2, cost: 12, prereqs: ['GATHERING'], tags: ['SURVIVAL'], archiveRequired: true,
    description: '약초를 식별해 회복과 응급 처치 효율을 높입니다.',
    unlocks: { passives: ['REST_HEAL_UP'], recipes: ['herb_tonic'] },
    eureka: { type: 'haveItem', itemId: 'herb', count: 3, bonusPct: 0.3, desc: '약초 3개 보유' },
  },
  {
    id: 'SHELTER', name: '집 짓기', era: 'PRIMITIVE', tier: 3, cost: 14, prereqs: ['FIREMAKING'], tags: ['CAMP'], archiveRequired: true,
    description: '비바람과 추위를 피할 거처를 세워 일일 회복을 안정화합니다.',
    unlocks: { camp: ['shelter'] },
    eureka: { type: 'surviveDays', count: 3, bonusPct: 0.3, desc: '3일 생존' },
    inspiration: { type: 'campLevel', key: 'shelterLevel', count: 1, bonusPct: 0.15, desc: '대피소 Lv.1 달성' },
  },
  {
    id: 'FISHING', name: '어로', era: 'NEOLITHIC', tier: 3, cost: 16, prereqs: ['CORDAGE'], tags: ['SURVIVAL'], archiveRequired: true,
    description: '강과 얕은 물의 생물을 안정적으로 포획해 식량 수급처를 늘립니다.',
    unlocks: { passives: ['RIVER_YIELD_UP'] },
    eureka: { type: 'actionSuccess', action: 'gather', count: 4, bonusPct: 0.25, desc: '채집 성공 4회' },
    inspiration: { type: 'haveItem', itemId: 'meat', count: 3, bonusPct: 0.15, desc: '고기 3개 보유' },
  },
  {
    id: 'POTTERY', name: '토기', era: 'NEOLITHIC', tier: 3, cost: 16, prereqs: ['FIREMAKING'], tags: ['CRAFT', 'CAMP'],
    description: '열을 견디는 용기로 조리와 연료 운용을 효율화합니다.',
    unlocks: { passives: ['CAMP_FUEL_SAVER'] },
    eureka: { type: 'haveItem', itemId: 'clay', count: 3, bonusPct: 0.25, desc: '점토 3개 보유' },
  },
  {
    id: 'CRAFTSMANSHIP', name: '장인 정신', era: 'NEOLITHIC', tier: 3, cost: 18, prereqs: ['STONE_TOOLS', 'CORDAGE'], tags: ['CRAFT'], archiveRequired: true,
    description: '재료 손실을 줄이고 복합 도구와 사냥 장비를 제작합니다.',
    unlocks: { passives: ['ADVANCED_CRAFT_UP'], recipes: ['spear', 'sling', 'pauldron'] },
    eureka: { type: 'actionSuccess', action: 'craft', count: 5, bonusPct: 0.3, desc: '제작 성공 5회' },
  },
  {
    id: 'HEARTH', name: '화덕', era: 'NEOLITHIC', tier: 4, cost: 18, prereqs: ['POTTERY'], tags: ['CAMP', 'SURVIVAL'],
    description: '불을 오래 유지하고 조리 식품의 회복량을 강화합니다.',
    unlocks: { passives: ['COOKING_RECOVERY_UP_2'] },
    eureka: { type: 'campAction', kind: 'cook', count: 3, bonusPct: 0.3, desc: '고기 굽기 3회' },
  },
  {
    id: 'ORAL_RECORDS', name: '구전 기록', era: 'NEOLITHIC', tier: 1, cost: 18, prereqs: ['HERBALISM', 'SHELTER'], tags: ['CULTURE', 'SCIENCE'], archiveRequired: true,
    description: '날씨와 생존 경험을 전승해 일일 자동 연구를 강화합니다.',
    unlocks: { passives: ['RESEARCH_NOTE_UP'] },
    eureka: { type: 'weatherTypes', count: 2, bonusPct: 0.25, desc: '서로 다른 날씨 2종 관찰' },
    inspiration: { type: 'weatherTypes', count: 2, bonusPct: 0.25, desc: '서로 다른 날씨 2종을 이야기로 남기기' },
  },
  {
    id: 'TRAPPING', name: '덫 사냥', era: 'NEOLITHIC', tier: 4, cost: 18, prereqs: ['CRAFTSMANSHIP', 'MILITARY_TRADITION'], tags: ['SURVIVAL', 'MILITARY'],
    description: '복합 도구와 전승된 사냥 전술을 덫과 올무에 적용해 부상 위험을 줄입니다.',
    unlocks: {
      passives: ['HUNT_RISK_DOWN'],
      recipes: ['leather_strip', 'hide_coat', 'hide_pants', 'shoes_leather', 'hat_fur', 'earmuffs', 'socks', 'gloves', 'arm_warmers', 'leggings', 'hunter_talisman'],
    },
    eureka: { type: 'actionFail', action: 'hunt', count: 1, bonusPct: 0.15, desc: '사냥 실패 1회' },
  },
  {
    id: 'ARCHERY', name: '궁술', era: 'NEOLITHIC', tier: 4, cost: 20, prereqs: ['CRAFTSMANSHIP'], tags: ['MILITARY', 'CRAFT'],
    description: '원거리 무기로 사냥 성공률을 높이고 대형 사냥을 준비합니다.',
    unlocks: { recipes: ['bow', 'atlatl'], passives: ['BOW_HUNT_UP'] },
    eureka: { type: 'recipeCraft', recipeId: 'bow', count: 1, bonusPct: 0.3, desc: '활 제작 1회' },
  },
  {
    id: 'SETTLEMENT', name: '정착', era: 'NEOLITHIC', tier: 1, cost: 20, prereqs: ['SHELTER'], tags: ['CAMP', 'CIVICS'], archiveRequired: true,
    description: '캠프를 정착지로 확장하고 파티 정원을 늘립니다.',
    unlocks: { passives: ['CAMP_SCORE_UP', 'PARTY_CAP_UP'] },
    eureka: { type: 'campLevel', key: 'shelterLevel', count: 2, bonusPct: 0.25, desc: '대피소 Lv.2 달성' },
    inspiration: { type: 'campLevel', key: 'workbenchLevel', count: 1, bonusPct: 0.15, desc: '작업대 Lv.1 달성' },
  },
  {
    id: 'AGRICULTURE', name: '농업', era: 'NEOLITHIC', tier: 5, cost: 22, prereqs: ['POTTERY', 'SETTLEMENT'], tags: ['SURVIVAL', 'CIVICS'], archiveRequired: true,
    description: '식용 식물을 선별하고 재배 주기를 만들어 식물 자원 수익을 높입니다.',
    unlocks: { passives: ['PLANT_YIELD_UP'] },
    eureka: { type: 'haveItem', itemId: 'berry', count: 8, bonusPct: 0.25, desc: '베리 8개 보유' },
    inspiration: { type: 'haveItem', itemId: 'herb', count: 5, bonusPct: 0.15, desc: '약초 5개 보유' },
  },
  {
    id: 'ANIMAL_HUSBANDRY', name: '목축', era: 'NEOLITHIC', tier: 5, cost: 22, prereqs: ['TRAPPING', 'SETTLEMENT'], tags: ['SURVIVAL', 'CIVICS'], archiveRequired: true,
    description: '야생동물의 습성과 번식 주기를 익혀 사냥과 동물 자원 수익을 높입니다.',
    unlocks: { passives: ['ANIMAL_YIELD_UP'] },
    eureka: { type: 'actionSuccess', action: 'hunt', count: 4, bonusPct: 0.25, desc: '사냥 성공 4회' },
    inspiration: { type: 'haveItem', itemId: 'hide', count: 3, bonusPct: 0.15, desc: '가죽 3개 보유' },
  },
  {
    id: 'COUNTING', name: '셈법', era: 'NEOLITHIC', tier: 5, cost: 22, prereqs: ['SETTLEMENT', 'ORAL_RECORDS'], tags: ['SCIENCE', 'CIVICS'],
    description: '자원과 작업량을 수치화해 연구 계획의 오차를 줄입니다.',
    unlocks: { passives: ['RESEARCH_POINT_BONUS'] },
    eureka: { type: 'actionSuccess', action: 'gather', count: 6, bonusPct: 0.25, desc: '채집 성공 6회' },
  },
  {
    id: 'CALENDAR', name: '달력', era: 'NEOLITHIC', tier: 6, cost: 26, prereqs: ['COUNTING'], tags: ['SCIENCE'],
    description: '날씨 주기를 기록해 추위 피해를 조금 줄입니다.',
    unlocks: { passives: ['WEATHER_FORECAST_UP'] },
    eureka: { type: 'weatherTypes', count: 3, bonusPct: 0.25, desc: '서로 다른 날씨 3종 관찰' },
  },
  {
    id: 'CARTOGRAPHY', name: '지도 제작', era: 'NEOLITHIC', tier: 5, cost: 22, prereqs: ['ORAL_RECORDS'], tags: ['SCIENCE', 'SURVIVAL'], archiveRequired: true,
    description: '탐사 구역을 지도에 고정해 채집과 사냥 장소를 직접 선택합니다.',
    unlocks: { passives: ['ZONE_SELECTION'] },
    eureka: { type: 'actionSuccess', action: 'gather', count: 8, bonusPct: 0.3, desc: '채집 성공 8회' },
  },
  {
    id: 'ARCHIVE', name: '기록 보관', era: 'NEOLITHIC', tier: 5, cost: 22, prereqs: ['SETTLEMENT', 'ORAL_RECORDS'], tags: ['CULTURE', 'CIVICS'], archiveRequired: true,
    description: '기록실을 열고 연구 로그와 보존 한도를 확장합니다.',
    unlocks: { camp: ['archive_room'], passives: ['ARCHIVE_LOG_UP'] },
    eureka: { type: 'campFireDays', count: 2, bonusPct: 0.25, desc: '모닥불을 유지한 밤 2회' },
  },
  {
    id: 'WRITING', name: '문자', era: 'ANCIENT', tier: 6, cost: 26, prereqs: ['ARCHIVE', 'COUNTING'], tags: ['SCIENCE', 'CULTURE'], archiveRequired: true,
    description: '기록을 표준화하고 필사대와 책 시스템을 엽니다.',
    unlocks: { camp: ['scribe_desk'], passives: ['BOOK_SYSTEM_UNLOCK'] },
    eureka: { type: 'surviveDays', count: 7, bonusPct: 0.25, desc: '7일 생존' },
    inspiration: { type: 'campFireDays', count: 3, bonusPct: 0.15, desc: '모닥불을 유지한 밤 3회' },
  },
  {
    id: 'MINING', name: '채광', era: 'ANCIENT', tier: 6, cost: 26, prereqs: ['ADVANCED_CARVING', 'SETTLEMENT'], tags: ['CRAFT', 'SCIENCE'],
    description: '암석층과 광맥을 구분해 돌과 희귀 광물의 발견 확률을 높입니다.',
    unlocks: { passives: ['MINERAL_YIELD_UP'] },
    eureka: { type: 'haveItem', itemId: 'stone', count: 10, bonusPct: 0.25, desc: '돌 10개 보유' },
    inspiration: { type: 'haveItem', itemId: 'obsidian_shard', count: 1, bonusPct: 0.18, desc: '흑요석 조각 1개 보유' },
  },
  {
    id: 'BRONZE_WORKING', name: '초기 청동 기술', era: 'ANCIENT', tier: 7, cost: 32, prereqs: ['MINING'], tags: ['CRAFT', 'MILITARY'],
    description: '광석과 열처리를 결합해 정밀 제작과 도구 가공의 한계를 높입니다.',
    unlocks: { passives: ['ADVANCED_CRAFT_UP_3'] },
    eureka: { type: 'actionSuccess', action: 'craft', count: 10, bonusPct: 0.25, desc: '제작 성공 10회' },
    inspiration: { type: 'campLevel', key: 'fireLevel', count: 3, bonusPct: 0.18, desc: '모닥불 Lv.3 달성' },
  },
  {
    id: 'BASIC_SAILING', name: '기초 항해', era: 'ANCIENT', tier: 6, cost: 28, prereqs: ['CARTOGRAPHY'], tags: ['SCIENCE', 'SURVIVAL'],
    description: '물길과 바람을 읽어 강가 탐사의 수익과 안정성을 높입니다.',
    unlocks: { passives: ['RIVER_YIELD_UP_2'] },
    eureka: { type: 'actionSuccess', action: 'gather', count: 10, bonusPct: 0.25, desc: '채집 성공 10회' },
    inspiration: { type: 'weatherTypes', count: 4, bonusPct: 0.15, desc: '서로 다른 날씨 4종 관찰' },
  },
  {
    id: 'BOOKCRAFT', name: '책 제작', era: 'ANCIENT', tier: 7, cost: 30, prereqs: ['WRITING'], tags: ['CRAFT', 'CULTURE'], archiveRequired: true,
    description: '생존 지식을 책으로 묶어 제작과 캠프 보너스를 활성화합니다.',
    unlocks: { recipes: ['book_craft_guide', 'book_camp_manual'], passives: ['BOOK_BONUS_UP'] },
    eureka: { type: 'haveItem', itemId: 'clay', count: 4, bonusPct: 0.25, desc: '점토 4개 보유' },
  },
  {
    id: 'LIBRARY', name: '서가 정리', era: 'ANCIENT', tier: 8, cost: 34, prereqs: ['BOOKCRAFT', 'CLAY_TABLETS'], tags: ['SCIENCE', 'CULTURE'], archiveRequired: true,
    description: '서가를 세워 책 효과와 일일 연구 포인트를 강화합니다.',
    unlocks: { camp: ['library_shelf'], passives: ['RESEARCH_POINT_BONUS_2'] },
    eureka: { type: 'recipeCraft', recipeId: 'book_camp_manual', count: 1, bonusPct: 0.3, desc: '캠프 운영서 제작 1회' },
  },
  {
    id: 'FOOD_STORAGE', name: '식량 저장', era: 'ANCIENT', tier: 6, cost: 28, prereqs: ['HEARTH', 'SETTLEMENT'], tags: ['SURVIVAL', 'CAMP'],
    description: '보존식 제작과 섭취 효율을 높여 장기 생존을 안정화합니다.',
    unlocks: { recipes: ['packed_ration'], passives: ['STORAGE_RATIONS_UP'] },
    eureka: { type: 'haveItem', itemId: 'jerky', count: 2, bonusPct: 0.25, desc: '육포 2개 보유' },
  },
  {
    id: 'ADVANCED_CARVING', name: '정밀 세공', era: 'NEOLITHIC', tier: 5, cost: 24, prereqs: ['TRAPPING'], tags: ['CRAFT'],
    description: '뼈와 부싯돌을 정밀하게 가공해 상위 제작을 보조합니다.',
    unlocks: { recipes: ['bone_awl'], passives: ['ADVANCED_CRAFT_UP_2'] },
    eureka: { type: 'recipeCraft', recipeId: 'flint_knife', count: 1, bonusPct: 0.25, desc: '부싯돌 칼 제작 1회' },
  },
  {
    id: 'OBSIDIAN_KNAPPING', name: '흑요석 떼기', era: 'ANCIENT', tier: 7, cost: 32, prereqs: ['ADVANCED_CARVING', 'ARCHERY'], tags: ['CRAFT', 'MILITARY'],
    description: '흑요석 칼날로 상위 사냥 성공률을 높입니다.',
    unlocks: { recipes: ['obsidian_blade'], passives: ['OBSIDIAN_HUNT_UP'] },
    eureka: { type: 'haveItem', itemId: 'obsidian_shard', count: 2, bonusPct: 0.25, desc: '흑요석 조각 2개 보유' },
  },
  {
    id: 'MEGAFAUNA_HIDE', name: '대형 가죽 가공', era: 'ANCIENT', tier: 8, cost: 36, prereqs: ['OBSIDIAN_KNAPPING'], tags: ['CRAFT', 'SURVIVAL'],
    description: '대형 사냥감의 가죽과 뼈를 방한 장비로 가공합니다.',
    unlocks: {
      recipes: ['dino_scale_vest', 'fur_coat', 'fur_pants', 'fur_hat', 'fur_boots', 'fur_earmuffs', 'fur_socks', 'fur_gloves'],
      passives: ['MEGAFAUNA_RISK_DOWN'],
    },
    eureka: { type: 'haveItem', itemId: 'dino_hide', count: 2, bonusPct: 0.25, desc: '공룡 가죽 2개 보유' },
  },
  {
    id: 'CLAY_TABLETS', name: '점토 기록판', era: 'ANCIENT', tier: 7, cost: 30, prereqs: ['WRITING', 'POTTERY'], tags: ['SCIENCE', 'CULTURE'],
    description: '기록판으로 책 이외의 연구 자료를 축적합니다.',
    unlocks: { recipes: ['clay_tablet'], passives: ['TABLET_RESEARCH_UP'] },
    eureka: { type: 'haveItem', itemId: 'clay', count: 6, bonusPct: 0.25, desc: '점토 6개 보유' },
  },
  {
    id: 'MYSTICISM', name: '신비주의', era: 'ANCIENT', tier: 2, cost: 26, prereqs: ['HEARTH', 'SETTLEMENT'], tags: ['SPIRITUAL', 'CULTURE'],
    description: '희귀 재료의 의미를 해석하고 부적 제작과 회복 의식을 엽니다.',
    unlocks: { recipes: ['charm', 'crafter_amulet', 'gatherer_charm', 'weather_totem'], passives: ['MYSTIC_RECOVERY_UP'] },
    eureka: { type: 'weatherTypes', count: 3, bonusPct: 0.2, desc: '서로 다른 날씨 3종 관찰' },
    inspiration: { type: 'weatherTypes', count: 3, bonusPct: 0.22, desc: '서로 다른 날씨 3종에서 징조 찾기' },
  },
  {
    id: 'ASTROLOGY', name: '점성술', era: 'ANCIENT', tier: 7, cost: 30, prereqs: ['CALENDAR', 'MYSTICISM'], tags: ['SCIENCE', 'SPIRITUAL'],
    description: '하늘과 날씨를 연결해 기후 피해를 예측합니다.',
    unlocks: { passives: ['WEATHER_LORE_UP'] },
    eureka: { type: 'weatherSeen', weatherId: 'clear', count: 2, bonusPct: 0.2, desc: '맑은 날씨 2회 관찰' },
  },
  {
    id: 'MILITARY_TRADITION', name: '군사 전통', era: 'ANCIENT', tier: 2, cost: 26, prereqs: ['HUNTING', 'SETTLEMENT'], tags: ['MILITARY', 'CIVICS'],
    description: '사냥 전술을 표준화해 실패 시 부상을 더 줄입니다.',
    unlocks: { passives: ['HUNT_RISK_DOWN_2'] },
    eureka: { type: 'actionSuccess', action: 'hunt', count: 5, bonusPct: 0.25, desc: '사냥 성공 5회' },
    inspiration: { type: 'actionSuccess', action: 'hunt', count: 5, bonusPct: 0.25, desc: '사냥 성공 5회의 전술을 전승하기' },
  },
  {
    id: 'STATE_WORKFORCE', name: '국가 노동력', era: 'ANCIENT', tier: 3, cost: 30, prereqs: ['SETTLEMENT', 'WRITING'], tags: ['CIVICS'],
    description: '역할 분담을 체계화해 자동 연구와 파티 운영을 강화합니다.',
    unlocks: { passives: ['STATE_RESEARCH_UP', 'PARTY_CAP_UP_2'] },
    eureka: { type: 'surviveDays', count: 8, bonusPct: 0.25, desc: '8일 생존' },
    inspiration: { type: 'surviveDays', count: 8, bonusPct: 0.25, desc: '8일 동안 역할 분담 유지' },
  },
  {
    id: 'EARLY_THEOLOGY', name: '초기 신학', era: 'ANCIENT', tier: 3, cost: 30, prereqs: ['MYSTICISM', 'WRITING'], tags: ['SPIRITUAL', 'CULTURE'],
    description: '집단 의식과 돌봄 규범으로 휴식 회복량을 높입니다.',
    unlocks: { passives: ['REST_HEAL_UP_2'] },
    eureka: { type: 'campFireDays', count: 4, bonusPct: 0.25, desc: '모닥불을 유지한 밤 4회' },
    inspiration: { type: 'campFireDays', count: 4, bonusPct: 0.25, desc: '모닥불 의식을 유지한 밤 4회' },
  },
  {
    id: 'FOREIGN_TRADE', name: '외국 무역', era: 'ANCIENT', tier: 4, cost: 34, prereqs: ['CARTOGRAPHY', 'STATE_WORKFORCE'], tags: ['CIVICS', 'SURVIVAL'],
    description: '교환 가치가 높은 자원을 선별해 채집과 사냥 수익을 늘립니다.',
    unlocks: { passives: ['RESOURCE_YIELD_UP'] },
    eureka: { type: 'haveItem', itemId: 'resin', count: 4, bonusPct: 0.25, desc: '수지 4개 보유' },
    inspiration: { type: 'haveItem', itemId: 'resin', count: 4, bonusPct: 0.25, desc: '교역품 수지 4개 비축' },
  },
  {
    id: 'HISTORY_RECORDS', name: '역사 기록', era: 'ANCIENT', tier: 3, cost: 30, prereqs: ['ORAL_RECORDS', 'WRITING'], tags: ['CULTURE', 'CIVICS'],
    description: '행동과 사건을 장기 기록으로 정리해 로그와 점수를 강화합니다.',
    unlocks: { passives: ['ARCHIVE_LOG_UP_2'] },
    eureka: { type: 'campFireDays', count: 5, bonusPct: 0.25, desc: '모닥불을 유지한 밤 5회' },
    inspiration: { type: 'campFireDays', count: 5, bonusPct: 0.25, desc: '모닥불 곁 기록 회의 5회' },
  },
  {
    id: 'BASIC_MATH', name: '기초 수학', era: 'ANCIENT', tier: 8, cost: 34, prereqs: ['WRITING'], tags: ['SCIENCE'],
    description: '비율과 측정으로 연구 포인트 산정을 개선합니다.',
    unlocks: { passives: ['RESEARCH_POINT_BONUS_3'] },
    eureka: { type: 'actionSuccess', action: 'craft', count: 8, bonusPct: 0.25, desc: '제작 성공 8회' },
    inspiration: { type: 'haveItem', itemId: 'clay', count: 6, bonusPct: 0.15, desc: '점토 6개 보유' },
  },
  {
    id: 'BASIC_PHILOSOPHY', name: '기초 철학', era: 'ANCIENT', tier: 4, cost: 34, prereqs: ['WRITING', 'MYSTICISM'], tags: ['CULTURE', 'SCIENCE'],
    description: '관찰과 추론을 체계화해 이후 유레카 보너스를 강화합니다.',
    unlocks: { passives: ['EUREKA_BONUS_UP'] },
    eureka: { type: 'weatherTypes', count: 4, bonusPct: 0.25, desc: '서로 다른 날씨 4종 관찰' },
    inspiration: { type: 'surviveDays', count: 8, bonusPct: 0.15, desc: '8일 생존' },
  },
  {
    id: 'EARLY_CONSTRUCTION', name: '초기 건설', era: 'ANCIENT', tier: 6, cost: 28, prereqs: ['ADVANCED_CARVING', 'SETTLEMENT'], tags: ['CAMP', 'CIVICS'],
    description: '작업 동선을 개선해 캠프 행동의 피로를 줄입니다.',
    unlocks: { passives: ['CAMP_ACTION_STAMINA_DOWN'] },
    eureka: { type: 'campLevel', key: 'shelterLevel', count: 3, bonusPct: 0.25, desc: '대피소 Lv.3 달성' },
    inspiration: { type: 'campLevel', key: 'workbenchLevel', count: 2, bonusPct: 0.15, desc: '작업대 Lv.2 달성' },
  },
  {
    id: 'EARLY_CIVIL_ENGINEERING', name: '초기 토목', era: 'ANCIENT', tier: 7, cost: 32, prereqs: ['EARLY_CONSTRUCTION', 'CARTOGRAPHY'], tags: ['CAMP', 'SCIENCE'],
    description: '배수와 단열 구조로 날씨 피해를 줄입니다.',
    unlocks: { passives: ['WEATHER_DAMAGE_DOWN'] },
    eureka: { type: 'campLevel', key: 'workbenchLevel', count: 2, bonusPct: 0.25, desc: '작업대 Lv.2 달성' },
    inspiration: { type: 'surviveDays', count: 9, bonusPct: 0.15, desc: '9일 생존' },
  },
  {
    id: 'IRRIGATION', name: '관개', era: 'ANCIENT', tier: 8, cost: 34, prereqs: ['AGRICULTURE', 'EARLY_CIVIL_ENGINEERING'], tags: ['SURVIVAL', 'SCIENCE'],
    description: '물길과 토양을 관리해 식물 자원 수확량을 한 단계 더 높입니다.',
    unlocks: { passives: ['PLANT_YIELD_UP_2'] },
    eureka: { type: 'actionSuccess', action: 'gather', count: 12, bonusPct: 0.25, desc: '채집 성공 12회' },
    inspiration: { type: 'weatherSeen', weatherId: 'rain', count: 2, bonusPct: 0.18, desc: '비 오는 날 2회 관찰' },
  },
  {
    id: 'GLASSMAKING', name: '유리 제작', era: 'ANCIENT', tier: 8, cost: 34, prereqs: ['OBSIDIAN_KNAPPING'], tags: ['CRAFT', 'SCIENCE'],
    description: '정밀 관찰 도구로 희귀 자원 발견 확률을 높입니다.',
    unlocks: { passives: ['RARE_YIELD_UP'] },
    eureka: { type: 'haveItem', itemId: 'obsidian_shard', count: 3, bonusPct: 0.25, desc: '흑요석 조각 3개 보유' },
  },
  {
    id: 'FORTIFICATION', name: '방벽과 방어시설', era: 'ANCIENT', tier: 8, cost: 34, prereqs: ['EARLY_CIVIL_ENGINEERING', 'MILITARY_TRADITION'], tags: ['MILITARY', 'CAMP'],
    description: '방어 구조와 대응 절차로 사냥 실패 피해를 최소화합니다.',
    unlocks: { passives: ['HUNT_RISK_DOWN_3'] },
    eureka: { type: 'actionFail', action: 'hunt', count: 3, bonusPct: 0.2, desc: '사냥 실패 3회' },
  },
  {
    id: 'ASTRONOMY_EARLY', name: '초기 천문', era: 'CLASSICAL', tier: 9, cost: 38, prereqs: ['ASTROLOGY', 'BASIC_MATH'], tags: ['SCIENCE'], branch: 'NATURAL_PHILOSOPHY',
    description: '계절과 천체 주기를 연결해 기후 대응을 강화합니다.',
    unlocks: { passives: ['WEATHER_LORE_UP_2'] },
    eureka: { type: 'weatherTypes', count: 5, bonusPct: 0.25, desc: '서로 다른 날씨 5종 관찰' },
    inspiration: { type: 'surviveDays', count: 10, bonusPct: 0.15, desc: '10일 생존' },
  },
  {
    id: 'ROAD_BUILDING', name: '도로 건설', era: 'CLASSICAL', tier: 9, cost: 40, prereqs: ['EARLY_CIVIL_ENGINEERING', 'STATE_WORKFORCE'], tags: ['CRAFT', 'CIVICS'], branch: 'ENGINEERING',
    description: '노면과 배수로를 표준화해 이동·운반 과정에서 얻는 자원 수익을 높입니다.',
    unlocks: { passives: ['ROAD_RESOURCE_UP'] },
    eureka: { type: 'actionSuccess', action: 'gather', count: 12, bonusPct: 0.25, desc: '채집 성공 12회로 운반로 확보' },
  },
  {
    id: 'MEDICAL_CORPUS', name: '의학 집성', era: 'CLASSICAL', tier: 9, cost: 40, prereqs: ['HERBALISM', 'WRITING'], tags: ['SURVIVAL', 'SCIENCE'], branch: 'SURVIVAL',
    description: '증상과 약초 효능을 기록으로 묶어 휴식과 치료의 회복량을 높입니다.',
    unlocks: { passives: ['CLASSICAL_MEDICINE_UP'] },
    eureka: { type: 'haveItem', itemId: 'herb_tonic', count: 2, bonusPct: 0.25, desc: '약초 달임 2개 보유' },
  },
  {
    id: 'LEVER_MECHANICS', name: '지레 역학', era: 'CLASSICAL', tier: 9, cost: 40, prereqs: ['BASIC_MATH', 'EARLY_CONSTRUCTION'], tags: ['CRAFT', 'SCIENCE'], branch: 'ENGINEERING',
    description: '힘점과 받침점의 원리를 이용해 무거운 재료의 가공 성공률을 높입니다.',
    unlocks: { passives: ['LEVER_CRAFT_UP'] },
    eureka: { type: 'actionSuccess', action: 'craft', count: 12, bonusPct: 0.25, desc: '제작 성공 12회' },
  },
  {
    id: 'CROP_CALENDAR', name: '경작력', era: 'CLASSICAL', tier: 9, cost: 40, prereqs: ['CALENDAR', 'AGRICULTURE'], tags: ['SURVIVAL', 'SCIENCE'], branch: 'SURVIVAL',
    description: '파종과 수확 시기를 계절표에 맞춰 식물 자원 수익과 채집 안정성을 높입니다.',
    unlocks: { passives: ['CROP_CALENDAR_YIELD_UP'] },
    eureka: { type: 'actionSuccess', action: 'gather', count: 14, bonusPct: 0.25, desc: '채집 성공 14회' },
  },
  {
    id: 'CLASSICAL_PHILOSOPHY', name: '고전 철학', era: 'CLASSICAL', tier: 5, cost: 40, prereqs: ['BASIC_PHILOSOPHY', 'BASIC_MATH'], tags: ['CULTURE', 'SCIENCE'], branch: 'NATURAL_PHILOSOPHY',
    description: '논리와 논변을 체계화해 자동 연구와 유레카·영감의 효율을 높입니다.',
    unlocks: { passives: ['RESEARCH_POINT_BONUS_4'] },
    eureka: { type: 'weatherTypes', count: 5, bonusPct: 0.25, desc: '서로 다른 날씨 5종 관찰' },
    inspiration: { type: 'surviveDays', count: 10, bonusPct: 0.18, desc: '10일 생존' },
  },
  {
    id: 'REPUBLICAN_COUNCIL', name: '공화정 회의', era: 'CLASSICAL', tier: 5, cost: 40, prereqs: ['STATE_WORKFORCE', 'BASIC_PHILOSOPHY'], tags: ['CIVICS', 'CULTURE'], branch: 'NATURAL_PHILOSOPHY',
    description: '공동체의 주요 결정을 공개 회의에서 다뤄 매일 사회 제도 포인트를 얻습니다.',
    unlocks: { passives: ['REPUBLIC_COUNCIL_CP_UP'] },
    inspiration: { type: 'surviveDays', count: 9, bonusPct: 0.2, desc: '9일 동안 역할 분담 유지' },
  },
  {
    id: 'CIVIC_RITUAL', name: '시민 의례', era: 'CLASSICAL', tier: 5, cost: 40, prereqs: ['EARLY_THEOLOGY', 'HISTORY_RECORDS'], tags: ['SPIRITUAL', 'CULTURE'], branch: 'FAITH',
    description: '공동 의례와 추모를 정례화해 휴식 회복과 공동체 결속을 높입니다.',
    unlocks: { passives: ['CIVIC_RITUAL_RECOVERY_UP'] },
    inspiration: { type: 'campFireDays', count: 6, bonusPct: 0.2, desc: '모닥불 의식 6회 유지' },
  },
  {
    id: 'DRAMA', name: '드라마', era: 'CLASSICAL', tier: 6, cost: 42, prereqs: ['CLASSICAL_PHILOSOPHY', 'HISTORY_RECORDS'], tags: ['CULTURE'], branch: 'LITERATURE',
    description: '부족의 사건을 이야기로 재구성해 기록 점수와 공동체 결속을 높입니다.',
    unlocks: { passives: ['DRAMA_SCORE_UP'] },
    eureka: { type: 'campFireDays', count: 6, bonusPct: 0.25, desc: '모닥불을 유지한 밤 6회' },
    inspiration: { type: 'surviveDays', count: 11, bonusPct: 0.18, desc: '11일 생존' },
  },
  {
    id: 'PUBLIC_DEBATE', name: '공개 토론', era: 'CLASSICAL', tier: 6, cost: 42, prereqs: ['CLASSICAL_PHILOSOPHY', 'WRITING'], tags: ['CULTURE', 'SCIENCE'], branch: 'LITERATURE',
    description: '찬반 논거를 공개적으로 겨루어 사회 제도 영감의 연구 보너스를 높입니다.',
    unlocks: { passives: ['PUBLIC_DEBATE_INSPIRATION_UP'] },
    inspiration: { type: 'surviveDays', count: 10, bonusPct: 0.2, desc: '10일 동안 토론 기록 축적' },
  },
  {
    id: 'ATHLETIC_GAMES', name: '경기 제전', era: 'CLASSICAL', tier: 6, cost: 42, prereqs: ['MILITARY_TRADITION', 'CLASSICAL_PHILOSOPHY'], tags: ['MILITARY', 'CULTURE'], branch: 'MILITARY',
    description: '경기와 훈련을 공동 행사로 만들어 사기와 사회 제도 생산을 높입니다.',
    unlocks: { passives: ['ATHLETIC_MORALE_UP'] },
    inspiration: { type: 'actionSuccess', action: 'hunt', count: 9, bonusPct: 0.2, desc: '사냥 성공 9회로 경기 규칙 정립' },
  },
  {
    id: 'POETRY', name: '시', era: 'CLASSICAL', tier: 7, cost: 44, prereqs: ['DRAMA'], tags: ['CULTURE', 'SPIRITUAL'], branch: 'LITERATURE',
    description: '언어와 기억을 압축해 영감 보너스와 지식 전승을 강화합니다.',
    unlocks: { passives: ['INSPIRATION_BONUS_UP'] },
    eureka: { type: 'campFireDays', count: 7, bonusPct: 0.25, desc: '모닥불을 유지한 밤 7회' },
    inspiration: { type: 'weatherTypes', count: 5, bonusPct: 0.2, desc: '서로 다른 날씨 5종 관찰' },
  },
  {
    id: 'RHETORIC', name: '수사학', era: 'CLASSICAL', tier: 7, cost: 44, prereqs: ['PUBLIC_DEBATE', 'DRAMA'], tags: ['CULTURE', 'CIVICS'], branch: 'LITERATURE',
    description: '설득과 연설의 구조를 정리해 문화 기록과 사회 제도 생산을 높입니다.',
    unlocks: { passives: ['RHETORIC_CULTURE_UP'] },
    inspiration: { type: 'campFireDays', count: 8, bonusPct: 0.2, desc: '모닥불 앞 연설과 낭송 8회' },
  },
  {
    id: 'CIVIC_LAW', name: '시민법', era: 'CLASSICAL', tier: 7, cost: 44, prereqs: ['REPUBLICAN_COUNCIL', 'FOREIGN_TRADE'], tags: ['CIVICS'], branch: 'NATURAL_PHILOSOPHY',
    description: '권리와 의무를 성문화해 더 많은 구성원을 안정적으로 조직할 수 있게 합니다.',
    unlocks: { passives: ['CIVIC_LAW_PARTY_CAP_UP'] },
    inspiration: { type: 'surviveDays', count: 11, bonusPct: 0.2, desc: '11일 동안 공동 규칙 유지' },
  },
  {
    id: 'EARLY_ART', name: '초기 미술', era: 'CLASSICAL', tier: 10, cost: 42, prereqs: ['CLASSICAL_PHILOSOPHY', 'CLAY_TABLETS'], tags: ['CULTURE', 'CRAFT'], branch: 'LITERATURE',
    description: '형상과 문양을 기록에 남겨 아카이브 가치와 제작 문화의 수준을 높입니다.',
    unlocks: { passives: ['ART_SCORE_UP'] },
    eureka: { type: 'actionSuccess', action: 'craft', count: 12, bonusPct: 0.25, desc: '제작 성공 12회' },
    inspiration: { type: 'haveItem', itemId: 'clay_tablet', count: 1, bonusPct: 0.2, desc: '점토 기록판 1개 보유' },
  },
  {
    id: 'EARLY_MUSIC', name: '초기 음악', era: 'CLASSICAL', tier: 8, cost: 48, prereqs: ['POETRY', 'EARLY_THEOLOGY'], tags: ['CULTURE', 'SPIRITUAL'], branch: 'LITERATURE',
    description: '리듬과 합창으로 휴식 효율과 공동체 회복력을 높입니다.',
    unlocks: { passives: ['REST_HEAL_UP_3'] },
    eureka: { type: 'campFireDays', count: 8, bonusPct: 0.25, desc: '모닥불을 유지한 밤 8회' },
    inspiration: { type: 'surviveDays', count: 12, bonusPct: 0.2, desc: '12일 생존' },
  },
  {
    id: 'IMPERIAL_ADMINISTRATION', name: '제국 행정', era: 'CLASSICAL', tier: 8, cost: 48, prereqs: ['CIVIC_LAW', 'STATE_WORKFORCE'], tags: ['CIVICS'], branch: 'MILITARY',
    description: '원거리 정착지와 물자를 장부로 관리해 자동 연구·사회 제도 생산을 보조합니다.',
    unlocks: { passives: ['IMPERIAL_ADMIN_AUTO_UP'] },
    inspiration: { type: 'campLevel', key: 'shelterLevel', count: 3, bonusPct: 0.2, desc: '대피소 Lv.3과 분담 체계 완성' },
  },
  {
    id: 'CLASSICAL_EDUCATION', name: '고전 교육', era: 'CLASSICAL', tier: 8, cost: 48, prereqs: ['RHETORIC', 'HISTORY_RECORDS'], tags: ['CULTURE', 'SCIENCE'], branch: 'NATURAL_PHILOSOPHY',
    description: '문법·수사·논리를 교육 과정으로 묶어 매일 연구 포인트를 추가합니다.',
    unlocks: { passives: ['CLASSICAL_EDUCATION_RESEARCH_UP'] },
    inspiration: { type: 'haveItem', itemId: 'clay_tablet', count: 1, bonusPct: 0.2, desc: '점토 기록판으로 교육 기록 작성' },
  },
  {
    id: 'EARLY_HORSEBACK', name: '초기 기마술', era: 'CLASSICAL', tier: 10, cost: 42, prereqs: ['ANIMAL_HUSBANDRY', 'MILITARY_TRAINING'], tags: ['MILITARY', 'CIVICS'], branch: 'MILITARY',
    description: '동물 통제와 전술 훈련을 결합해 사냥 성공률을 크게 높입니다.',
    unlocks: { passives: ['HUNT_SUCCESS_UP_3'] },
    eureka: { type: 'actionSuccess', action: 'hunt', count: 10, bonusPct: 0.25, desc: '사냥 성공 10회' },
    inspiration: { type: 'haveItem', itemId: 'hide', count: 6, bonusPct: 0.18, desc: '가죽 6개 보유' },
  },
  {
    id: 'EARLY_IRONWORKING', name: '초기 철제 기술', era: 'CLASSICAL', tier: 9, cost: 40, prereqs: ['BRONZE_WORKING', 'OBSIDIAN_KNAPPING'], tags: ['CRAFT', 'MILITARY'], branch: 'ENGINEERING',
    description: '고열과 정밀 가공을 결합해 제작 성공률과 위험 대응 능력을 높입니다.',
    unlocks: { passives: ['IRON_CRAFT_UP'] },
    eureka: { type: 'actionSuccess', action: 'craft', count: 14, bonusPct: 0.25, desc: '제작 성공 14회' },
    inspiration: { type: 'haveItem', itemId: 'obsidian_shard', count: 4, bonusPct: 0.18, desc: '흑요석 조각 4개 보유' },
  },
  {
    id: 'BASIC_SHIPBUILDING', name: '기초 조선', era: 'CLASSICAL', tier: 9, cost: 40, prereqs: ['BASIC_SAILING', 'EARLY_CONSTRUCTION'], tags: ['CRAFT', 'SCIENCE'], branch: 'ENGINEERING',
    description: '목재 구조와 항해 지식을 결합해 강가 탐사의 수익을 크게 높입니다.',
    unlocks: { passives: ['SHIPBUILDING_RIVER_UP'] },
    eureka: { type: 'actionSuccess', action: 'gather', count: 14, bonusPct: 0.25, desc: '채집 성공 14회' },
    inspiration: { type: 'haveItem', itemId: 'wood', count: 12, bonusPct: 0.18, desc: '나무 12개 보유' },
  },
  {
    id: 'EARLY_CURRENCY', name: '초기 화폐', era: 'CLASSICAL', tier: 10, cost: 42, prereqs: ['BASIC_MATH'], tags: ['CIVICS', 'SCIENCE'], branch: 'SURVIVAL',
    description: '교환 가치를 표준화해 모든 행동의 추가 자원 획득 확률을 높입니다.',
    unlocks: { passives: ['RESOURCE_YIELD_UP_2'] },
    eureka: { type: 'haveItem', itemId: 'resin', count: 6, bonusPct: 0.25, desc: '수지 6개 보유' },
    inspiration: { type: 'haveItem', itemId: 'clay', count: 8, bonusPct: 0.18, desc: '점토 8개 보유' },
  },
  {
    id: 'EARLY_OPTICS', name: '초기 광학', era: 'CLASSICAL', tier: 10, cost: 42, prereqs: ['ASTRONOMY_EARLY', 'GLASSMAKING'], tags: ['SCIENCE', 'CRAFT'], branch: 'NATURAL_PHILOSOPHY',
    description: '광학 도구로 희귀 자원과 행동 기대수익을 정밀하게 분석합니다.',
    unlocks: { passives: ['RARE_YIELD_UP_2', 'FORECAST_DETAIL_UP'] },
    eureka: { type: 'surviveDays', count: 10, bonusPct: 0.25, desc: '10일 생존' },
  },
  {
    id: 'AQUEDUCT_ENGINEERING', name: '수도교 공학', era: 'CLASSICAL', tier: 10, cost: 42, prereqs: ['IRRIGATION', 'ROAD_BUILDING'], tags: ['CRAFT', 'SCIENCE'], branch: 'ENGINEERING',
    description: '수로의 경사와 교량 구조를 결합해 채집·생산 자원의 추가 수익을 높입니다.',
    unlocks: { passives: ['AQUEDUCT_RESOURCE_UP'] },
    eureka: { type: 'actionSuccess', action: 'gather', count: 16, bonusPct: 0.25, desc: '채집 성공 16회로 수로망 시험' },
  },
  {
    id: 'STEEL_QUENCHING', name: '담금질', era: 'CLASSICAL', tier: 10, cost: 42, prereqs: ['EARLY_IRONWORKING', 'LEVER_MECHANICS'], tags: ['CRAFT', 'MILITARY'], branch: 'ENGINEERING',
    description: '가열한 철을 빠르게 식혀 공구와 무기의 제작 성공률을 높입니다.',
    unlocks: { passives: ['QUENCHING_CRAFT_UP'] },
    eureka: { type: 'actionSuccess', action: 'craft', count: 16, bonusPct: 0.25, desc: '제작 성공 16회' },
  },
  {
    id: 'HULL_FRAMING', name: '선체 골조', era: 'CLASSICAL', tier: 10, cost: 42, prereqs: ['BASIC_SHIPBUILDING', 'LEVER_MECHANICS'], tags: ['CRAFT', 'SCIENCE'], branch: 'ENGINEERING',
    description: '늑골식 골조로 선체를 튼튼하게 만들어 강가 탐사의 수익과 희귀 발견률을 높입니다.',
    unlocks: { passives: ['HULL_RIVER_UP'] },
    eureka: { type: 'haveItem', itemId: 'wood', count: 18, bonusPct: 0.25, desc: '나무 18개 보유' },
  },
  {
    id: 'SURGICAL_TOOLS', name: '외과 도구', era: 'CLASSICAL', tier: 10, cost: 42, prereqs: ['MEDICAL_CORPUS', 'EARLY_IRONWORKING'], tags: ['SURVIVAL', 'CRAFT'], branch: 'SURVIVAL',
    description: '정밀한 절개와 처치 도구를 마련해 휴식과 치료의 회복량을 추가로 높입니다.',
    unlocks: { passives: ['SURGICAL_RECOVERY_UP'] },
    eureka: { type: 'haveItem', itemId: 'herb_tonic', count: 3, bonusPct: 0.25, desc: '약초 달임 3개 보유' },
  },
  {
    id: 'MILITARY_TRAINING', name: '군사 훈련', era: 'CLASSICAL', tier: 9, cost: 40, prereqs: ['MILITARY_TRADITION', 'STATE_WORKFORCE'], tags: ['MILITARY'], branch: 'MILITARY',
    description: '반복 훈련으로 사냥 성공률과 부상 대응을 강화합니다.',
    unlocks: { passives: ['HUNT_SUCCESS_UP_2'] },
    eureka: { type: 'actionSuccess', action: 'hunt', count: 8, bonusPct: 0.25, desc: '사냥 성공 8회' },
  },
  {
    id: 'DEFENSE_TACTICS', name: '방어술', era: 'CLASSICAL', tier: 9, cost: 40, prereqs: ['FORTIFICATION'], tags: ['MILITARY', 'SURVIVAL'], branch: 'MILITARY',
    description: '위험한 사냥과 혹독한 날씨의 피해를 추가로 줄입니다.',
    unlocks: { passives: ['WEATHER_DAMAGE_DOWN_2', 'HUNT_RISK_DOWN_3'] },
    eureka: { type: 'actionFail', action: 'hunt', count: 5, bonusPct: 0.2, desc: '사냥 실패 5회' },
  },
  {
    id: 'EARLY_EMPIRE', name: '초기 제국', era: 'CLASSICAL', tier: 8, cost: 48, prereqs: ['FOREIGN_TRADE', 'EARLY_CURRENCY'], tags: ['CIVICS'], branch: 'MILITARY',
    description: '확장된 조직과 보급망으로 파티와 캠프의 최종 한도를 늘립니다.',
    unlocks: { passives: ['PARTY_CAP_UP_2', 'CAMP_SCORE_UP_2'] },
    eureka: { type: 'surviveDays', count: 12, bonusPct: 0.25, desc: '12일 생존' },
    inspiration: { type: 'campLevel', key: 'shelterLevel', count: 3, bonusPct: 0.2, desc: '대피소 Lv.3 달성' },
  },
  {
    id: 'THREE_FIELD_SYSTEM', name: '삼포농법', era: 'MEDIEVAL', tier: 11, cost: 46, prereqs: ['CROP_CALENDAR', 'EARLY_EMPIRE'], tags: ['SURVIVAL', 'SCIENCE'], branch: 'SURVIVAL',
    description: '경작지를 세 구획으로 순환해 식물 자원의 수익과 채집 안정성을 높입니다.',
    unlocks: { passives: ['THREE_FIELD_YIELD_UP'] },
    eureka: { type: 'actionSuccess', action: 'gather', count: 16, bonusPct: 0.25, desc: '채집 성공 16회' },
  },
  {
    id: 'BLOOMERY_FURNACE', name: '괴철로', era: 'MEDIEVAL', tier: 11, cost: 46, prereqs: ['STEEL_QUENCHING'], tags: ['CRAFT', 'SCIENCE'], branch: 'ENGINEERING',
    description: '철광석과 숯을 층층이 가열해 금속 제작의 정밀도를 높입니다.',
    unlocks: { passives: ['BLOOMERY_CRAFT_UP'] },
    eureka: { type: 'actionSuccess', action: 'craft', count: 16, bonusPct: 0.25, desc: '제작 성공 16회' },
  },
  {
    id: 'LATEEN_SAIL', name: '삼각돛', era: 'MEDIEVAL', tier: 11, cost: 46, prereqs: ['HULL_FRAMING'], tags: ['CRAFT', 'SCIENCE'], branch: 'ENGINEERING',
    description: '역풍에서도 방향을 유지하는 돛으로 강가 탐사의 수익을 높입니다.',
    unlocks: { passives: ['LATEEN_RIVER_UP'] },
    eureka: { type: 'weatherTypes', count: 5, bonusPct: 0.25, desc: '서로 다른 날씨 5종 관찰' },
  },
  {
    id: 'HERBAL_MEDICINE', name: '약초 의학', era: 'MEDIEVAL', tier: 11, cost: 46, prereqs: ['SURGICAL_TOOLS', 'EARLY_THEOLOGY'], tags: ['SURVIVAL', 'SCIENCE'], branch: 'SURVIVAL',
    description: '약초의 효능을 증상별로 분류해 휴식과 약초 달임의 회복량을 높입니다.',
    unlocks: { passives: ['HERBAL_MEDICINE_UP'] },
    eureka: { type: 'haveItem', itemId: 'herb', count: 8, bonusPct: 0.25, desc: '약초 8개 보유' },
  },
  {
    id: 'MONASTIC_RULE', name: '수도 규율', era: 'MEDIEVAL', tier: 9, cost: 52, prereqs: ['EARLY_THEOLOGY', 'EARLY_EMPIRE'], tags: ['SPIRITUAL', 'CULTURE'], branch: 'FAITH',
    description: '기도와 노동의 일과를 정해 공동체의 회복과 지식 보존을 안정화합니다.',
    unlocks: { passives: ['MONASTIC_RECOVERY_UP'] },
    inspiration: { type: 'campFireDays', count: 9, bonusPct: 0.25, desc: '모닥불 의식을 유지한 밤 9회' },
  },
  {
    id: 'FEUDAL_CONTRACT', name: '봉건 계약', era: 'MEDIEVAL', tier: 9, cost: 52, prereqs: ['IMPERIAL_ADMINISTRATION', 'MILITARY_TRAINING'], tags: ['CIVICS', 'MILITARY'], branch: 'MILITARY',
    description: '토지와 봉사의 의무를 규정해 추가 파티원을 조직할 기반을 만듭니다.',
    unlocks: { passives: ['FEUDAL_PARTY_CAP_UP'] },
    inspiration: { type: 'surviveDays', count: 14, bonusPct: 0.25, desc: '14일 동안 역할 분담 유지' },
  },
  {
    id: 'EPIC_TRADITION', name: '서사 전승', era: 'MEDIEVAL', tier: 9, cost: 52, prereqs: ['RHETORIC', 'HISTORY_RECORDS'], tags: ['CULTURE'], branch: 'LITERATURE',
    description: '부족의 역사와 영웅담을 장편 서사로 엮어 문화와 기록 가치를 높입니다.',
    unlocks: { passives: ['EPIC_CULTURE_UP'] },
    inspiration: { type: 'campFireDays', count: 10, bonusPct: 0.25, desc: '모닥불 곁 서사 낭송 10회' },
  },
  {
    id: 'HEAVY_PLOUGH', name: '중경', era: 'MEDIEVAL', tier: 12, cost: 50, prereqs: ['THREE_FIELD_SYSTEM'], tags: ['SURVIVAL', 'CRAFT'], branch: 'SURVIVAL',
    description: '무거운 토양을 깊게 갈아 채집과 식물 자원 수익을 추가로 높입니다.',
    unlocks: { passives: ['HEAVY_PLOUGH_YIELD_UP'] },
    eureka: { type: 'haveItem', itemId: 'wood', count: 16, bonusPct: 0.25, desc: '나무 16개 보유' },
  },
  {
    id: 'STEEL_TOOLS', name: '강철 도구', era: 'MEDIEVAL', tier: 12, cost: 50, prereqs: ['BLOOMERY_FURNACE'], tags: ['CRAFT'], branch: 'ENGINEERING',
    description: '단단하고 균일한 날을 만들어 상위 제작의 성공률을 높입니다.',
    unlocks: { passives: ['STEEL_CRAFT_UP'] },
    eureka: { type: 'actionSuccess', action: 'craft', count: 18, bonusPct: 0.25, desc: '제작 성공 18회' },
  },
  {
    id: 'WATERMILL', name: '수차', era: 'MEDIEVAL', tier: 12, cost: 50, prereqs: ['AQUEDUCT_ENGINEERING', 'BASIC_MATH'], tags: ['CRAFT', 'SCIENCE'], branch: 'ENGINEERING',
    description: '흐르는 물의 힘을 반복 작업에 이용해 일일 연구와 생산을 보조합니다.',
    unlocks: { passives: ['WATERMILL_RESEARCH_UP'] },
    eureka: { type: 'actionSuccess', action: 'gather', count: 18, bonusPct: 0.25, desc: '채집 성공 18회' },
  },
  {
    id: 'NAVIGATION', name: '항해술', era: 'MEDIEVAL', tier: 12, cost: 50, prereqs: ['LATEEN_SAIL', 'ASTRONOMY_EARLY'], tags: ['SCIENCE', 'SURVIVAL'], branch: 'ENGINEERING',
    description: '천체와 해류를 함께 읽어 강가 탐사의 희귀 자원 발견률을 높입니다.',
    unlocks: { passives: ['NAVIGATION_RIVER_UP'] },
    eureka: { type: 'weatherTypes', count: 5, bonusPct: 0.3, desc: '서로 다른 날씨 5종에서 방향 기록' },
  },
  {
    id: 'SCHOLASTICISM', name: '스콜라 철학', era: 'MEDIEVAL', tier: 10, cost: 56, prereqs: ['MONASTIC_RULE', 'CLASSICAL_EDUCATION'], tags: ['SPIRITUAL', 'SCIENCE'], branch: 'NATURAL_PHILOSOPHY',
    description: '신앙과 논리를 논증 체계로 묶어 일일 연구 포인트를 높입니다.',
    unlocks: { passives: ['SCHOLASTIC_RESEARCH_UP'] },
    inspiration: { type: 'surviveDays', count: 15, bonusPct: 0.25, desc: '15일 동안 논쟁 기록 축적' },
  },
  {
    id: 'CHIVALRIC_CODE', name: '기사도', era: 'MEDIEVAL', tier: 10, cost: 56, prereqs: ['FEUDAL_CONTRACT', 'EARLY_HORSEBACK'], tags: ['MILITARY', 'CULTURE'], branch: 'MILITARY',
    description: '무력의 사용과 보호 의무를 규범화해 사냥 성공률을 높입니다.',
    unlocks: { passives: ['CHIVALRY_HUNT_UP'] },
    inspiration: { type: 'actionSuccess', action: 'hunt', count: 12, bonusPct: 0.25, desc: '사냥 성공 12회의 전술 전승' },
  },
  {
    id: 'COURT_LITERATURE', name: '궁정 문학', era: 'MEDIEVAL', tier: 10, cost: 56, prereqs: ['EPIC_TRADITION', 'EARLY_ART'], tags: ['CULTURE'], branch: 'LITERATURE',
    description: '의례와 사랑, 충성을 문학으로 다듬어 일일 문화와 기록 점수를 높입니다.',
    unlocks: { passives: ['COURT_CULTURE_UP'] },
    inspiration: { type: 'haveItem', itemId: 'clay_tablet', count: 2, bonusPct: 0.25, desc: '점토 기록판 2개 보유' },
  },
  {
    id: 'CROP_ROTATION', name: '윤작', era: 'MEDIEVAL', tier: 13, cost: 54, prereqs: ['HEAVY_PLOUGH'], tags: ['SURVIVAL', 'SCIENCE'], branch: 'SURVIVAL',
    description: '작물과 휴경 순서를 세분화해 식물 자원 수익을 안정적으로 늘립니다.',
    unlocks: { passives: ['CROP_ROTATION_YIELD_UP'] },
    eureka: { type: 'actionSuccess', action: 'gather', count: 20, bonusPct: 0.25, desc: '채집 성공 20회' },
  },
  {
    id: 'MECHANICAL_CLOCK', name: '기계식 시계', era: 'MEDIEVAL', tier: 13, cost: 54, prereqs: ['WATERMILL', 'CALENDAR'], tags: ['SCIENCE', 'CRAFT'], branch: 'NATURAL_PHILOSOPHY',
    description: '시간을 일정한 간격으로 나누어 연구와 작업 계획의 효율을 높입니다.',
    unlocks: { passives: ['MECHANICAL_CLOCK_RESEARCH_UP'] },
    eureka: { type: 'surviveDays', count: 16, bonusPct: 0.25, desc: '16일 동안 계절과 작업 시간 기록' },
  },
  {
    id: 'MASONRY_VAULTS', name: '석조 궁륭', era: 'MEDIEVAL', tier: 13, cost: 54, prereqs: ['EARLY_CONSTRUCTION', 'SCHOLASTICISM'], tags: ['CAMP', 'CRAFT'], branch: 'ENGINEERING',
    description: '하중을 분산하는 석조 구조로 캠프의 날씨 피해를 줄입니다.',
    unlocks: { passives: ['MASONRY_WEATHER_DOWN'] },
    eureka: { type: 'haveItem', itemId: 'stone', count: 20, bonusPct: 0.25, desc: '돌 20개 보유' },
  },
  {
    id: 'CHAINMAIL', name: '사슬 갑옷', era: 'MEDIEVAL', tier: 13, cost: 54, prereqs: ['STEEL_TOOLS', 'CHIVALRIC_CODE'], tags: ['MILITARY', 'CRAFT'], branch: 'MILITARY',
    description: '서로 맞물린 금속 고리로 위험 행동의 부상 피해를 줄입니다.',
    unlocks: { passives: ['CHAINMAIL_RISK_DOWN'] },
    eureka: { type: 'actionFail', action: 'hunt', count: 6, bonusPct: 0.25, desc: '사냥 실패 6회에서 방호점 분석' },
  },
  {
    id: 'CATHEDRAL_SCHOOLS', name: '성당 학교', era: 'MEDIEVAL', tier: 11, cost: 60, prereqs: ['SCHOLASTICISM', 'LIBRARY'], tags: ['SPIRITUAL', 'SCIENCE'], branch: 'FAITH',
    description: '필사와 교육을 정례화해 지식 보존과 일일 연구를 강화합니다.',
    unlocks: { passives: ['CATHEDRAL_RESEARCH_UP'] },
    inspiration: { type: 'campLevel', key: 'libraryShelfLevel', count: 1, bonusPct: 0.25, desc: '서가를 갖춘 교육 공간 운영' },
  },
  {
    id: 'GUILD_SYSTEM', name: '길드 제도', era: 'MEDIEVAL', tier: 11, cost: 60, prereqs: ['FEUDAL_CONTRACT', 'EARLY_CURRENCY'], tags: ['CIVICS', 'CRAFT'], branch: 'ENGINEERING',
    description: '직능별 규약과 품질 기준을 만들어 모든 행동의 자원 수익을 높입니다.',
    unlocks: { passives: ['GUILD_YIELD_UP'] },
    inspiration: { type: 'actionSuccess', action: 'craft', count: 18, bonusPct: 0.25, desc: '제작 성공 18회의 작업 규약 정리' },
  },
  {
    id: 'CHRONICLE_WRITING', name: '연대기 편찬', era: 'MEDIEVAL', tier: 11, cost: 60, prereqs: ['COURT_LITERATURE', 'HISTORY_RECORDS'], tags: ['CULTURE'], branch: 'LITERATURE',
    description: '사건을 연도와 인과에 따라 정리해 로그 보존량과 기록 점수를 높입니다.',
    unlocks: { passives: ['CHRONICLE_LOG_UP'] },
    inspiration: { type: 'surviveDays', count: 17, bonusPct: 0.25, desc: '17일의 사건을 연대순으로 정리' },
  },
  {
    id: 'PAPERMAKING', name: '제지', era: 'MEDIEVAL', tier: 14, cost: 58, prereqs: ['STEEL_TOOLS', 'GUILD_SYSTEM'], tags: ['CRAFT', 'SCIENCE'], branch: 'ENGINEERING',
    description: '가볍고 대량 생산 가능한 기록 매체로 일일 연구를 강화합니다.',
    unlocks: { passives: ['PAPER_RESEARCH_UP'] },
    eureka: { type: 'haveItem', itemId: 'fiber', count: 18, bonusPct: 0.25, desc: '섬유 18개 보유' },
  },
  {
    id: 'OPTICAL_INSTRUMENTS', name: '광학 기구', era: 'MEDIEVAL', tier: 14, cost: 58, prereqs: ['EARLY_OPTICS', 'SCHOLASTICISM'], tags: ['SCIENCE', 'CRAFT'], branch: 'NATURAL_PHILOSOPHY',
    description: '렌즈와 측정 기구로 희귀 자원과 날씨의 징후를 더 정확히 찾습니다.',
    unlocks: { passives: ['OPTICAL_SCIENCE_RARE_UP', 'FORECAST_DETAIL_UP'] },
    eureka: { type: 'weatherTypes', count: 5, bonusPct: 0.3, desc: '서로 다른 날씨 5종을 광학 관찰' },
  },
  {
    id: 'WINDMILL', name: '풍차', era: 'MEDIEVAL', tier: 14, cost: 58, prereqs: ['WATERMILL', 'GUILD_SYSTEM'], tags: ['CRAFT', 'SURVIVAL'], branch: 'ENGINEERING',
    description: '바람의 힘을 생산에 연결해 모든 행동의 추가 자원 수익을 높입니다.',
    unlocks: { passives: ['WINDMILL_RESOURCE_UP'] },
    eureka: { type: 'weatherSeen', weatherId: 'cold-wind', count: 3, bonusPct: 0.25, desc: '차가운 바람 3회 관찰' },
  },
  {
    id: 'CASTLE_ENGINEERING', name: '성곽 공학', era: 'MEDIEVAL', tier: 14, cost: 58, prereqs: ['MASONRY_VAULTS', 'MILITARY_ORDERS'], tags: ['MILITARY', 'CAMP'], branch: 'MILITARY',
    description: '성벽과 방어 동선을 체계화해 날씨와 위험 행동의 피해를 줄입니다.',
    unlocks: { passives: ['CASTLE_DEFENSE_UP'] },
    eureka: { type: 'campLevel', key: 'shelterLevel', count: 3, bonusPct: 0.25, desc: '대피소 Lv.3에서 방어 동선 정비' },
  },
  {
    id: 'NATURAL_PHILOSOPHY', name: '자연 철학', era: 'MEDIEVAL', tier: 12, cost: 64, prereqs: ['SCHOLASTICISM', 'ASTRONOMY_EARLY'], tags: ['SCIENCE', 'CULTURE'], branch: 'NATURAL_PHILOSOPHY',
    description: '관찰과 원인 추론을 독립된 학문으로 세워 유레카 보너스를 강화합니다.',
    unlocks: { passives: ['NATURAL_PHILOSOPHY_EUREKA_UP'] },
    inspiration: { type: 'weatherTypes', count: 5, bonusPct: 0.25, desc: '자연 현상 5종을 원인별로 분류' },
  },
  {
    id: 'MILITARY_ORDERS', name: '기사단', era: 'MEDIEVAL', tier: 12, cost: 64, prereqs: ['CHIVALRIC_CODE', 'EARLY_THEOLOGY'], tags: ['MILITARY', 'SPIRITUAL'], branch: 'MILITARY',
    description: '훈련과 신념을 공유하는 전투 집단으로 위험 행동의 부상 피해를 줄입니다.',
    unlocks: { passives: ['MILITARY_ORDER_RISK_DOWN'] },
    inspiration: { type: 'actionSuccess', action: 'hunt', count: 14, bonusPct: 0.25, desc: '사냥 성공 14회의 전술 규율 확립' },
  },
  {
    id: 'SACRED_MUSIC', name: '성가', era: 'MEDIEVAL', tier: 12, cost: 64, prereqs: ['MONASTIC_RULE', 'EARLY_MUSIC'], tags: ['SPIRITUAL', 'CULTURE'], branch: 'FAITH',
    description: '공동체가 함께 부르는 노래로 휴식 회복과 일일 문화를 높입니다.',
    unlocks: { passives: ['SACRED_MUSIC_RECOVERY_UP'] },
    inspiration: { type: 'campFireDays', count: 12, bonusPct: 0.25, desc: '공동체 성가 의식 12회' },
  },
  {
    id: 'PRINTING_BLOCKS', name: '목판 인쇄', era: 'MEDIEVAL', tier: 15, cost: 62, prereqs: ['PAPERMAKING', 'CHRONICLE_WRITING'], tags: ['CRAFT', 'SCIENCE'], branch: 'LITERATURE',
    description: '반복 가능한 판으로 기록을 복제해 일일·턴 연구를 강화합니다.',
    unlocks: { passives: ['PRINTING_RESEARCH_UP'] },
    eureka: { type: 'actionSuccess', action: 'craft', count: 22, bonusPct: 0.25, desc: '제작 성공 22회' },
  },
  {
    id: 'MEDIEVAL_MEDICINE', name: '중세 의학', era: 'MEDIEVAL', tier: 15, cost: 62, prereqs: ['HERBAL_MEDICINE', 'CATHEDRAL_SCHOOLS'], tags: ['SURVIVAL', 'SCIENCE'], branch: 'SURVIVAL',
    description: '증상 기록과 약초 처방을 결합해 휴식과 치료식의 회복량을 크게 높입니다.',
    unlocks: { passives: ['MEDIEVAL_MEDICINE_UP'] },
    eureka: { type: 'haveItem', itemId: 'herb_tonic', count: 2, bonusPct: 0.25, desc: '약초 달임 2개 보유' },
  },
  {
    id: 'ADVANCED_METALLURGY', name: '고급 제철', era: 'MEDIEVAL', tier: 15, cost: 62, prereqs: ['STEEL_TOOLS', 'MECHANICAL_CLOCK'], tags: ['CRAFT', 'SCIENCE'], branch: 'ENGINEERING',
    description: '탄소량과 열처리를 조절해 제작 성공률과 희귀 재료 활용도를 높입니다.',
    unlocks: { passives: ['ADVANCED_METALLURGY_CRAFT_UP'] },
    eureka: { type: 'actionSuccess', action: 'craft', count: 24, bonusPct: 0.25, desc: '제작 성공 24회' },
  },
  {
    id: 'OCEAN_NAVIGATION', name: '원양 항해', era: 'MEDIEVAL', tier: 15, cost: 62, prereqs: ['NAVIGATION', 'CARTOGRAPHY'], tags: ['SCIENCE', 'SURVIVAL'], branch: 'ENGINEERING',
    description: '장거리 항해용 항법으로 강가와 수변 탐사의 수익을 크게 높입니다.',
    unlocks: { passives: ['OCEAN_NAVIGATION_YIELD_UP'] },
    eureka: { type: 'actionSuccess', action: 'gather', count: 22, bonusPct: 0.25, desc: '강가를 포함한 채집 성공 22회' },
  },
  {
    id: 'UNIVERSITY_TRADITION', name: '대학 전통', era: 'MEDIEVAL', tier: 13, cost: 68, prereqs: ['NATURAL_PHILOSOPHY', 'PAPERMAKING'], tags: ['SCIENCE', 'CULTURE'], branch: 'NATURAL_PHILOSOPHY',
    description: '교수와 학생의 자치적 학문 공동체로 일일·턴 연구를 크게 강화합니다.',
    unlocks: { passives: ['UNIVERSITY_RESEARCH_UP'] },
    inspiration: { type: 'surviveDays', count: 19, bonusPct: 0.25, desc: '19일 동안 학문 공동체 유지' },
  },
  {
    id: 'URBAN_CHARTER', name: '도시 자치', era: 'MEDIEVAL', tier: 13, cost: 68, prereqs: ['GUILD_SYSTEM', 'WINDMILL'], tags: ['CIVICS', 'CULTURE'], branch: 'ENGINEERING',
    description: '도시의 권리와 의무를 문서화해 캠프 점수와 생산 공동체를 강화합니다.',
    unlocks: { passives: ['URBAN_CAMP_SCORE_UP'] },
    inspiration: { type: 'campLevel', key: 'workbenchLevel', count: 3, bonusPct: 0.25, desc: '작업대 Lv.3에서 길드 회의 운영' },
  },
  {
    id: 'ROMANCE_LITERATURE', name: '기사 문학', era: 'MEDIEVAL', tier: 13, cost: 68, prereqs: ['CHRONICLE_WRITING', 'CHIVALRIC_CODE'], tags: ['CULTURE'], branch: 'LITERATURE',
    description: '모험과 이상을 서사로 엮어 영감 보너스와 문화 생산을 높입니다.',
    unlocks: { passives: ['ROMANCE_INSPIRATION_UP'] },
    inspiration: { type: 'campFireDays', count: 14, bonusPct: 0.25, desc: '기사 서사 낭송 14회' },
  },
  {
    id: 'MECHANICAL_ENGINEERING', name: '기계 공학', era: 'MEDIEVAL', tier: 16, cost: 68, prereqs: ['MECHANICAL_CLOCK', 'UNIVERSITY_TRADITION'], tags: ['SCIENCE', 'CRAFT'], branch: 'NATURAL_PHILOSOPHY',
    description: '기어와 동력 전달을 체계화해 제작 성공률과 캠프 작업 효율을 높입니다.',
    unlocks: { passives: ['MECHANICAL_ENGINEERING_UP'] },
    eureka: { type: 'actionSuccess', action: 'craft', count: 26, bonusPct: 0.25, desc: '제작 성공 26회' },
  },
  {
    id: 'PLATE_ARMOR', name: '판금 갑옷', era: 'MEDIEVAL', tier: 16, cost: 68, prereqs: ['ADVANCED_METALLURGY', 'MILITARY_ORDERS'], tags: ['MILITARY', 'CRAFT'], branch: 'MILITARY',
    description: '관절별 금속판으로 위험 행동의 부상 피해를 크게 줄입니다.',
    unlocks: { passives: ['PLATE_ARMOR_RISK_DOWN'] },
    eureka: { type: 'actionFail', action: 'hunt', count: 8, bonusPct: 0.25, desc: '사냥 실패 8회의 피격 지점 분석' },
  },
  {
    id: 'DEEP_WATER_SHIPBUILDING', name: '원양 조선', era: 'MEDIEVAL', tier: 16, cost: 68, prereqs: ['OCEAN_NAVIGATION', 'URBAN_CHARTER'], tags: ['CRAFT', 'SCIENCE'], branch: 'ENGINEERING',
    description: '큰 선체와 보급 구조로 수변 탐사의 희귀·일반 자원 수익을 극대화합니다.',
    unlocks: { passives: ['DEEP_WATER_SHIPBUILDING_UP'] },
    eureka: { type: 'haveItem', itemId: 'wood', count: 24, bonusPct: 0.25, desc: '나무 24개 보유' },
  },
  {
    id: 'IMPROVED_AGRICULTURE', name: '개량 농업', era: 'MEDIEVAL', tier: 16, cost: 68, prereqs: ['CROP_ROTATION', 'URBAN_CHARTER'], tags: ['SURVIVAL', 'SCIENCE'], branch: 'SURVIVAL',
    description: '윤작과 도시 수요를 결합해 식물 자원과 일반 자원 수익을 극대화합니다.',
    unlocks: { passives: ['IMPROVED_AGRICULTURE_YIELD_UP'] },
    eureka: { type: 'actionSuccess', action: 'gather', count: 26, bonusPct: 0.25, desc: '채집 성공 26회' },
  },
  {
    id: 'HUMANISM', name: '인문주의', era: 'MEDIEVAL', tier: 14, cost: 72, prereqs: ['UNIVERSITY_TRADITION', 'COURT_LITERATURE'], tags: ['CULTURE', 'SCIENCE'], branch: 'LITERATURE',
    description: '고전 문헌과 인간 경험을 함께 탐구해 유레카와 영감 보너스를 강화합니다.',
    unlocks: { passives: ['HUMANISM_BREAKTHROUGH_UP'] },
    inspiration: { type: 'haveItem', itemId: 'book_craft_guide', count: 1, bonusPct: 0.25, desc: '제작 안내서와 고전 기록 비교' },
  },
  {
    id: 'ESTATES_ASSEMBLY', name: '신분제 의회', era: 'MEDIEVAL', tier: 14, cost: 72, prereqs: ['URBAN_CHARTER', 'FEUDAL_CONTRACT'], tags: ['CIVICS', 'MILITARY'], branch: 'MILITARY',
    description: '성직자·전사·생산자의 이해를 조정해 파티 정원을 한 단계 더 늘립니다.',
    unlocks: { passives: ['ESTATES_PARTY_CAP_UP'] },
    inspiration: { type: 'surviveDays', count: 21, bonusPct: 0.25, desc: '21일 동안 세 집단의 역할 조정' },
  },
  {
    id: 'CODIFIED_THEOLOGY', name: '교리 체계화', era: 'MEDIEVAL', tier: 14, cost: 72, prereqs: ['SACRED_MUSIC', 'CATHEDRAL_SCHOOLS'], tags: ['SPIRITUAL', 'CULTURE'], branch: 'FAITH',
    description: '의례와 가르침을 체계화해 공동체 회복과 일일 문화를 강화합니다.',
    unlocks: { passives: ['CODIFIED_THEOLOGY_RECOVERY_UP'] },
    inspiration: { type: 'campFireDays', count: 16, bonusPct: 0.25, desc: '공동체 교리 의식 16회' },
  },
  {
    id: 'MOVABLE_TYPE_PRINTING', name: '활판 인쇄', era: 'EARLY_MODERN', tier: 17, cost: 72, prereqs: ['PRINTING_BLOCKS', 'HUMANISM'], tags: ['CRAFT', 'CULTURE'], branch: 'LITERATURE',
    description: '재사용 가능한 활자로 기록을 빠르게 복제해 연구와 문화 전파를 강화합니다.',
    unlocks: { passives: ['MOVABLE_TYPE_RESEARCH_UP'] },
    eureka: { type: 'actionSuccess', action: 'craft', count: 28, bonusPct: 0.25, desc: '제작 성공 28회로 활자 규격 정립' },
  },
  {
    id: 'GUNPOWDER_MILL', name: '화약 제조', era: 'EARLY_MODERN', tier: 17, cost: 72, prereqs: ['ADVANCED_METALLURGY', 'ESTATES_ASSEMBLY'], tags: ['CRAFT', 'MILITARY'], branch: 'MILITARY',
    description: '혼합 비율과 입자 크기를 통제해 사냥과 방어용 화약을 안정적으로 생산합니다.',
    unlocks: { passives: ['GUNPOWDER_HUNT_UP'] },
    eureka: { type: 'actionSuccess', action: 'hunt', count: 18, bonusPct: 0.25, desc: '사냥 성공 18회로 화력 운용 기록' },
  },
  {
    id: 'ANATOMICAL_STUDY', name: '해부학', era: 'EARLY_MODERN', tier: 17, cost: 72, prereqs: ['MEDIEVAL_MEDICINE', 'UNIVERSITY_TRADITION'], tags: ['SCIENCE', 'SURVIVAL'], branch: 'NATURAL_PHILOSOPHY',
    description: '신체 구조를 관찰과 기록으로 정리해 휴식과 치료의 회복 효율을 높입니다.',
    unlocks: { passives: ['ANATOMY_RECOVERY_UP'] },
    eureka: { type: 'haveItem', itemId: 'herb_tonic', count: 3, bonusPct: 0.25, desc: '약초 달임 3개로 처방 결과 비교' },
  },
  {
    id: 'OCEANIC_CARTOGRAPHY', name: '대양 지도학', era: 'EARLY_MODERN', tier: 17, cost: 72, prereqs: ['DEEP_WATER_SHIPBUILDING', 'HUMANISM'], tags: ['SCIENCE', 'SURVIVAL'], branch: 'ENGINEERING',
    description: '해안선과 항로를 정밀하게 기록해 수변 희귀 자원 탐색을 강화합니다.',
    unlocks: { passives: ['OCEANIC_MAP_RARE_UP'] },
    eureka: { type: 'weatherTypes', count: 5, bonusPct: 0.25, desc: '서로 다른 날씨 5종에서 항로 지도 작성' },
  },
  {
    id: 'ARQUEBUS', name: '조총', era: 'EARLY_MODERN', tier: 18, cost: 76, prereqs: ['GUNPOWDER_MILL', 'STANDING_ARMY'], tags: ['MILITARY', 'CRAFT'], branch: 'MILITARY',
    description: '휴대 화기를 표준화해 사냥 성공률과 원거리 대응력을 높입니다.',
    unlocks: { passives: ['ARQUEBUS_HUNT_UP'] },
    eureka: { type: 'actionSuccess', action: 'hunt', count: 20, bonusPct: 0.25, desc: '사냥 성공 20회로 조준 절차 확립' },
  },
  {
    id: 'PRINT_WORKSHOP', name: '인쇄 공방', era: 'EARLY_MODERN', tier: 18, cost: 76, prereqs: ['MOVABLE_TYPE_PRINTING', 'REFORMATION'], tags: ['CRAFT', 'CULTURE'], branch: 'LITERATURE',
    description: '활자 주조와 인쇄 작업을 분업화해 일일 연구와 기록 생산을 높입니다.',
    unlocks: { passives: ['PRINT_WORKSHOP_RESEARCH_UP'] },
    eureka: { type: 'actionSuccess', action: 'craft', count: 30, bonusPct: 0.25, desc: '제작 성공 30회로 공방 분업 완성' },
  },
  {
    id: 'BOTANICAL_CLASSIFICATION', name: '식물 분류학', era: 'EARLY_MODERN', tier: 18, cost: 76, prereqs: ['ANATOMICAL_STUDY', 'RENAISSANCE_HUMANISM'], tags: ['SCIENCE', 'SURVIVAL'], branch: 'SURVIVAL',
    description: '식물을 형태와 효능에 따라 분류해 채집 성공률과 식물 자원 수익을 높입니다.',
    unlocks: { passives: ['BOTANY_GATHER_UP'] },
    eureka: { type: 'haveItem', itemId: 'herb', count: 12, bonusPct: 0.25, desc: '약초 12개 표본 분류' },
  },
  {
    id: 'CELESTIAL_NAVIGATION', name: '천문 항법', era: 'EARLY_MODERN', tier: 18, cost: 76, prereqs: ['OCEANIC_CARTOGRAPHY', 'RENAISSANCE_HUMANISM'], tags: ['SCIENCE', 'SURVIVAL'], branch: 'NATURAL_PHILOSOPHY',
    description: '별의 고도와 시간을 함께 측정해 수변 탐사의 희귀 자원 발견률을 높입니다.',
    unlocks: { passives: ['CELESTIAL_NAVIGATION_RARE_UP'] },
    eureka: { type: 'weatherTypes', count: 5, bonusPct: 0.3, desc: '서로 다른 날씨 5종에서 천체 위치 기록' },
  },
  {
    id: 'TRACE_ITALIENNE', name: '성형 요새', era: 'EARLY_MODERN', tier: 19, cost: 80, prereqs: ['ARQUEBUS', 'STANDING_ARMY'], tags: ['MILITARY', 'CAMP'], branch: 'MILITARY',
    description: '낮은 성벽과 각진 보루로 화력과 충격을 분산해 위험 행동 피해를 줄입니다.',
    unlocks: { passives: ['TRACE_FORT_DAMAGE_DOWN'] },
    eureka: { type: 'actionFail', action: 'hunt', count: 10, bonusPct: 0.25, desc: '사냥 실패 10회의 피격 방향 분석' },
  },
  {
    id: 'MICROSCOPE', name: '현미경', era: 'EARLY_MODERN', tier: 19, cost: 80, prereqs: ['BOTANICAL_CLASSIFICATION', 'EMPIRICISM'], tags: ['SCIENCE', 'CRAFT'], branch: 'NATURAL_PHILOSOPHY',
    description: '육안으로 보이지 않던 구조를 관찰해 희귀 재료와 치료 지식을 정밀화합니다.',
    unlocks: { passives: ['MICROSCOPY_RARE_UP'] },
    eureka: { type: 'haveItem', itemId: 'rune_shard', count: 1, bonusPct: 0.25, desc: '룬 조각 1개를 확대 관찰' },
  },
  {
    id: 'DRAINAGE_PUMP', name: '배수 펌프', era: 'EARLY_MODERN', tier: 19, cost: 80, prereqs: ['MECHANICAL_ENGINEERING', 'EMPIRICISM'], tags: ['CRAFT', 'SCIENCE'], branch: 'ENGINEERING',
    description: '왕복 운동으로 물을 퍼 올려 채집과 생산의 추가 자원 수익을 높입니다.',
    unlocks: { passives: ['DRAINAGE_RESOURCE_UP'] },
    eureka: { type: 'haveItem', itemId: 'wood', count: 28, bonusPct: 0.25, desc: '나무 28개로 펌프 구조 시험' },
  },
  {
    id: 'NEW_CROP_CULTIVATION', name: '신작물 재배', era: 'EARLY_MODERN', tier: 19, cost: 80, prereqs: ['BOTANICAL_CLASSIFICATION', 'PATRONAGE_CULTURE'], tags: ['SURVIVAL', 'SCIENCE'], branch: 'SURVIVAL',
    description: '새로운 작물의 생육 조건을 비교해 식물 자원의 수익을 안정적으로 늘립니다.',
    unlocks: { passives: ['NEW_CROP_YIELD_UP'] },
    eureka: { type: 'actionSuccess', action: 'gather', count: 30, bonusPct: 0.25, desc: '채집 성공 30회로 신작물 적응 기록' },
  },
  {
    id: 'SCIENTIFIC_METHOD', name: '과학적 방법', era: 'EARLY_MODERN', tier: 20, cost: 84, prereqs: ['MICROSCOPE', 'EMPIRICISM'], tags: ['SCIENCE', 'CULTURE'], branch: 'NATURAL_PHILOSOPHY',
    description: '관찰·가설·검증을 반복 가능한 절차로 만들어 유레카 보너스를 강화합니다.',
    unlocks: { passives: ['SCIENTIFIC_METHOD_EUREKA_UP'] },
    eureka: { type: 'surviveDays', count: 24, bonusPct: 0.25, desc: '24일 동안 관찰과 검증 기록 유지' },
  },
  {
    id: 'GALLEON_SHIPBUILDING', name: '갤리온 조선술', era: 'EARLY_MODERN', tier: 20, cost: 84, prereqs: ['CELESTIAL_NAVIGATION', 'MARITIME_LAW'], tags: ['CRAFT', 'SCIENCE'], branch: 'ENGINEERING',
    description: '대형 범선과 적재 구조를 표준화해 수변 탐사의 일반·희귀 수익을 높입니다.',
    unlocks: { passives: ['GALLEON_RIVER_UP'] },
    eureka: { type: 'haveItem', itemId: 'wood', count: 30, bonusPct: 0.25, desc: '나무 30개로 대형 선체 골조 제작' },
  },
  {
    id: 'FIELD_ARTILLERY', name: '야전 포병술', era: 'EARLY_MODERN', tier: 20, cost: 84, prereqs: ['TRACE_ITALIENNE', 'MILITARY_REVOLUTION'], tags: ['MILITARY', 'CRAFT'], branch: 'MILITARY',
    description: '화포의 이동과 사격 절차를 정리해 사냥 성공률과 방어력을 높입니다.',
    unlocks: { passives: ['FIELD_ARTILLERY_HUNT_UP'] },
    eureka: { type: 'actionSuccess', action: 'hunt', count: 22, bonusPct: 0.25, desc: '사냥 성공 22회로 화력 지원 절차 완성' },
  },
  {
    id: 'PHARMACOPOEIA', name: '약전 편찬', era: 'EARLY_MODERN', tier: 20, cost: 84, prereqs: ['ANATOMICAL_STUDY', 'BUREAUCRATIC_STATE'], tags: ['SCIENCE', 'SPIRITUAL'], branch: 'FAITH',
    description: '약재의 효능과 용량을 공인 기록으로 정리해 치료와 휴식 회복을 강화합니다.',
    unlocks: { passives: ['PHARMACOPOEIA_RECOVERY_UP'] },
    eureka: { type: 'haveItem', itemId: 'herb_tonic', count: 4, bonusPct: 0.25, desc: '약초 달임 4개의 처방 기록 비교' },
  },
  {
    id: 'STEAM_PUMP', name: '증기 펌프', era: 'EARLY_MODERN', tier: 21, cost: 88, prereqs: ['DRAINAGE_PUMP', 'SCIENTIFIC_SOCIETY'], tags: ['CRAFT', 'SCIENCE'], branch: 'ENGINEERING',
    description: '증기 압력으로 펌프를 구동해 모든 행동의 추가 자원 수익을 높입니다.',
    unlocks: { passives: ['STEAM_PUMP_RESOURCE_UP'] },
    eureka: { type: 'actionSuccess', action: 'craft', count: 32, bonusPct: 0.25, desc: '제작 성공 32회로 압력 장치 완성' },
  },
  {
    id: 'PRECISION_CLOCK', name: '정밀 시계', era: 'EARLY_MODERN', tier: 21, cost: 88, prereqs: ['SCIENTIFIC_METHOD', 'SCIENTIFIC_SOCIETY'], tags: ['SCIENCE', 'CRAFT'], branch: 'NATURAL_PHILOSOPHY',
    description: '오차가 작은 시계로 실험과 항법의 시간을 맞춰 일일·턴 연구를 강화합니다.',
    unlocks: { passives: ['PRECISION_CLOCK_RESEARCH_UP'] },
    eureka: { type: 'surviveDays', count: 26, bonusPct: 0.25, desc: '26일 동안 시간 오차 기록' },
  },
  {
    id: 'SEED_SELECTION', name: '종자 선별', era: 'EARLY_MODERN', tier: 21, cost: 88, prereqs: ['NEW_CROP_CULTIVATION', 'POOR_RELIEF'], tags: ['SURVIVAL', 'SCIENCE'], branch: 'SURVIVAL',
    description: '생육이 좋은 종자를 반복 선별해 채집 성공률과 식물 자원 수익을 높입니다.',
    unlocks: { passives: ['SEED_SELECTION_YIELD_UP'] },
    eureka: { type: 'haveItem', itemId: 'berry', count: 20, bonusPct: 0.25, desc: '베리 20개에서 우량 종자 선별' },
  },
  {
    id: 'COPPERPLATE_PRINTING', name: '동판 인쇄', era: 'EARLY_MODERN', tier: 21, cost: 88, prereqs: ['PRINT_WORKSHOP', 'PUBLIC_SPHERE'], tags: ['CRAFT', 'CULTURE'], branch: 'LITERATURE',
    description: '정밀한 그림과 도표를 대량 복제해 문화 생산과 기록 점수를 높입니다.',
    unlocks: { passives: ['COPPERPLATE_CULTURE_UP'] },
    eureka: { type: 'actionSuccess', action: 'craft', count: 34, bonusPct: 0.25, desc: '제작 성공 34회로 동판 제판 완성' },
  },
  {
    id: 'EARLY_STEAM_ENGINE', name: '초기 증기기관', era: 'EARLY_MODERN', tier: 22, cost: 92, prereqs: ['STEAM_PUMP', 'SCIENTIFIC_SOCIETY'], tags: ['CRAFT', 'SCIENCE'], branch: 'ENGINEERING',
    description: '열과 압력을 연속 회전력으로 바꿔 제작과 캠프 작업의 효율을 크게 높입니다.',
    unlocks: { passives: ['EARLY_STEAM_ENGINE_PRODUCTION_UP'] },
    eureka: { type: 'actionSuccess', action: 'craft', count: 36, bonusPct: 0.25, desc: '제작 성공 36회로 연속 구동 달성' },
  },
  {
    id: 'CLASSICAL_MECHANICS', name: '고전 역학', era: 'EARLY_MODERN', tier: 22, cost: 92, prereqs: ['PRECISION_CLOCK', 'SCIENTIFIC_METHOD'], tags: ['SCIENCE'], branch: 'NATURAL_PHILOSOPHY',
    description: '운동과 힘을 수학적 법칙으로 설명해 연구와 유레카 효율을 높입니다.',
    unlocks: { passives: ['CLASSICAL_MECHANICS_RESEARCH_UP'] },
    eureka: { type: 'surviveDays', count: 28, bonusPct: 0.25, desc: '28일 동안 운동과 시간 측정 기록' },
  },
  {
    id: 'SHIP_OF_THE_LINE', name: '전열함', era: 'EARLY_MODERN', tier: 22, cost: 92, prereqs: ['GALLEON_SHIPBUILDING', 'PROFESSIONAL_OFFICERS'], tags: ['MILITARY', 'CRAFT'], branch: 'MILITARY',
    description: '대형 선체와 일제 사격 교리를 결합해 위험 행동과 날씨 피해를 줄입니다.',
    unlocks: { passives: ['SHIP_OF_LINE_DEFENSE_UP'] },
    eureka: { type: 'actionSuccess', action: 'hunt', count: 24, bonusPct: 0.25, desc: '사냥 성공 24회로 일제 대응 훈련' },
  },
  {
    id: 'MODERN_AGRONOMY', name: '근대 농학', era: 'EARLY_MODERN', tier: 22, cost: 92, prereqs: ['SEED_SELECTION', 'POOR_RELIEF'], tags: ['SURVIVAL', 'SCIENCE'], branch: 'SURVIVAL',
    description: '토양·종자·윤작 기록을 통합해 식물 자원과 일반 자원 수익을 극대화합니다.',
    unlocks: { passives: ['MODERN_AGRONOMY_YIELD_UP'] },
    eureka: { type: 'actionSuccess', action: 'gather', count: 36, bonusPct: 0.25, desc: '채집 성공 36회로 농업 기록 통합' },
  },
  {
    id: 'REFORMATION', name: '종교 개혁', era: 'EARLY_MODERN', tier: 15, cost: 76, prereqs: ['CODIFIED_THEOLOGY', 'PRINTING_BLOCKS'], tags: ['SPIRITUAL', 'CULTURE'], branch: 'FAITH',
    description: '신앙의 근거와 공동체 규율을 재검토해 일일 문화 생산을 높입니다.',
    unlocks: { passives: ['REFORMATION_CULTURE_UP'] },
    inspiration: { type: 'campFireDays', count: 18, bonusPct: 0.25, desc: '공동체 교리 토론 18회' },
  },
  {
    id: 'RENAISSANCE_HUMANISM', name: '르네상스 인문주의', era: 'EARLY_MODERN', tier: 15, cost: 76, prereqs: ['HUMANISM', 'UNIVERSITY_TRADITION'], tags: ['CULTURE', 'SCIENCE'], branch: 'LITERATURE',
    description: '고전 문헌과 현실 경험을 함께 읽어 유레카와 영감 보너스를 강화합니다.',
    unlocks: { passives: ['RENAISSANCE_HUMANISM_BREAKTHROUGH_UP'] },
    inspiration: { type: 'haveItem', itemId: 'book_craft_guide', count: 1, bonusPct: 0.25, desc: '제작 안내서와 고전 기록 대조' },
  },
  {
    id: 'STANDING_ARMY', name: '상비군 제도', era: 'EARLY_MODERN', tier: 15, cost: 76, prereqs: ['ESTATES_ASSEMBLY', 'PLATE_ARMOR'], tags: ['MILITARY', 'CIVICS'], branch: 'MILITARY',
    description: '상시 훈련과 보급 체계를 마련해 파티 정원과 사냥 대응력을 높입니다.',
    unlocks: { passives: ['STANDING_ARMY_PARTY_CAP_UP'] },
    inspiration: { type: 'actionSuccess', action: 'hunt', count: 16, bonusPct: 0.25, desc: '사냥 성공 16회의 상시 훈련 기록' },
  },
  {
    id: 'EMPIRICISM', name: '경험 철학', era: 'EARLY_MODERN', tier: 16, cost: 80, prereqs: ['RENAISSANCE_HUMANISM', 'ANATOMICAL_STUDY'], tags: ['SCIENCE', 'CULTURE'], branch: 'NATURAL_PHILOSOPHY',
    description: '관찰 가능한 경험을 지식의 출발점으로 삼아 유레카 보너스를 높입니다.',
    unlocks: { passives: ['EMPIRICISM_EUREKA_UP'] },
    inspiration: { type: 'weatherTypes', count: 5, bonusPct: 0.25, desc: '자연 현상 5종의 반복 관찰 기록' },
  },
  {
    id: 'PATRONAGE_CULTURE', name: '후원 문화', era: 'EARLY_MODERN', tier: 16, cost: 80, prereqs: ['RENAISSANCE_HUMANISM', 'MOVABLE_TYPE_PRINTING'], tags: ['CULTURE', 'CIVICS'], branch: 'LITERATURE',
    description: '학자와 예술가의 작업을 공동체가 후원해 문화와 기록 점수를 높입니다.',
    unlocks: { passives: ['PATRONAGE_CULTURE_UP'] },
    inspiration: { type: 'haveItem', itemId: 'clay_tablet', count: 2, bonusPct: 0.25, desc: '기록판 2개를 후원 기록으로 보존' },
  },
  {
    id: 'CONFESSIONAL_TOLERANCE', name: '교파 공존', era: 'EARLY_MODERN', tier: 16, cost: 80, prereqs: ['REFORMATION', 'MOVABLE_TYPE_PRINTING'], tags: ['SPIRITUAL', 'CIVICS'], branch: 'FAITH',
    description: '서로 다른 신앙 규율의 공존 원칙을 세워 회복과 공동체 안정성을 높입니다.',
    unlocks: { passives: ['TOLERANCE_RECOVERY_UP'] },
    inspiration: { type: 'surviveDays', count: 23, bonusPct: 0.25, desc: '23일 동안 갈등 없이 공동체 유지' },
  },
  {
    id: 'BUREAUCRATIC_STATE', name: '관료 국가', era: 'EARLY_MODERN', tier: 17, cost: 84, prereqs: ['CONFESSIONAL_TOLERANCE', 'PRINT_WORKSHOP'], tags: ['CIVICS', 'SCIENCE'], branch: 'ENGINEERING',
    description: '문서와 담당 체계로 생산·연구 업무를 표준화해 자동 연구와 문화를 높입니다.',
    unlocks: { passives: ['BUREAUCRACY_AUTO_RESEARCH_UP'] },
    inspiration: { type: 'campLevel', key: 'workbenchLevel', count: 3, bonusPct: 0.25, desc: '작업대 Lv.3에서 업무 장부 운영' },
  },
  {
    id: 'MARITIME_LAW', name: '해양법', era: 'EARLY_MODERN', tier: 17, cost: 84, prereqs: ['PATRONAGE_CULTURE', 'CELESTIAL_NAVIGATION'], tags: ['CIVICS', 'SCIENCE'], branch: 'ENGINEERING',
    description: '항로와 교역의 권리·책임을 규정해 수변 탐사의 자원 수익을 높입니다.',
    unlocks: { passives: ['MARITIME_LAW_RESOURCE_UP'] },
    inspiration: { type: 'actionSuccess', action: 'gather', count: 28, bonusPct: 0.25, desc: '채집 성공 28회의 항로 분쟁 기록' },
  },
  {
    id: 'MILITARY_REVOLUTION', name: '군사 혁신', era: 'EARLY_MODERN', tier: 17, cost: 84, prereqs: ['STANDING_ARMY', 'ARQUEBUS'], tags: ['MILITARY', 'CIVICS'], branch: 'MILITARY',
    description: '화기·보병·보급을 하나의 훈련 체계로 묶어 사냥과 전투 성공률을 높입니다.',
    unlocks: { passives: ['MILITARY_REVOLUTION_HUNT_UP'] },
    inspiration: { type: 'actionSuccess', action: 'hunt', count: 18, bonusPct: 0.25, desc: '사냥 성공 18회의 제식 훈련 정리' },
  },
  {
    id: 'SCIENTIFIC_SOCIETY', name: '과학 학회', era: 'EARLY_MODERN', tier: 18, cost: 88, prereqs: ['EMPIRICISM', 'MICROSCOPE'], tags: ['SCIENCE', 'CIVICS'], branch: 'NATURAL_PHILOSOPHY',
    description: '관찰과 실험 결과를 공개 검토해 일일·턴 연구를 강화합니다.',
    unlocks: { passives: ['SCIENTIFIC_SOCIETY_RESEARCH_UP'] },
    inspiration: { type: 'campLevel', key: 'libraryShelfLevel', count: 1, bonusPct: 0.25, desc: '서가에서 공개 연구 회합 운영' },
  },
  {
    id: 'PUBLIC_SPHERE', name: '공론장', era: 'EARLY_MODERN', tier: 18, cost: 88, prereqs: ['PATRONAGE_CULTURE', 'PRINT_WORKSHOP'], tags: ['CULTURE', 'CIVICS'], branch: 'LITERATURE',
    description: '인쇄물과 토론을 통해 공동체 의견을 교환해 영감과 문화 생산을 높입니다.',
    unlocks: { passives: ['PUBLIC_SPHERE_INSPIRATION_UP'] },
    inspiration: { type: 'campFireDays', count: 20, bonusPct: 0.25, desc: '공개 토론 20회 운영' },
  },
  {
    id: 'POOR_RELIEF', name: '빈민 구휼', era: 'EARLY_MODERN', tier: 18, cost: 88, prereqs: ['CONFESSIONAL_TOLERANCE', 'DRAINAGE_PUMP'], tags: ['SURVIVAL', 'SPIRITUAL'], branch: 'SURVIVAL',
    description: '식량과 치료를 공동으로 지원해 휴식 회복과 생존 안정성을 높입니다.',
    unlocks: { passives: ['POOR_RELIEF_RECOVERY_UP'] },
    inspiration: { type: 'haveItem', itemId: 'herb_tonic', count: 3, bonusPct: 0.25, desc: '약초 달임 3개를 공동 구호품으로 비축' },
  },
  {
    id: 'ENLIGHTENED_THEOLOGY', name: '계몽 신학', era: 'EARLY_MODERN', tier: 19, cost: 92, prereqs: ['CONFESSIONAL_TOLERANCE', 'SCIENTIFIC_METHOD'], tags: ['SPIRITUAL', 'SCIENCE'], branch: 'FAITH',
    description: '신앙과 이성을 함께 논증해 일일 문화와 공동체 회복을 강화합니다.',
    unlocks: { passives: ['ENLIGHTENED_THEOLOGY_CULTURE_UP'] },
    inspiration: { type: 'campFireDays', count: 22, bonusPct: 0.25, desc: '신앙과 이성 토론 22회' },
  },
  {
    id: 'SOCIAL_CONTRACT', name: '사회 계약론', era: 'EARLY_MODERN', tier: 19, cost: 92, prereqs: ['PUBLIC_SPHERE', 'SCIENTIFIC_METHOD'], tags: ['CULTURE', 'CIVICS'], branch: 'LITERATURE',
    description: '공동체 권한과 구성원의 책임을 합의해 파티 정원과 문화 생산을 높입니다.',
    unlocks: { passives: ['SOCIAL_CONTRACT_PARTY_CAP_UP'] },
    inspiration: { type: 'surviveDays', count: 27, bonusPct: 0.25, desc: '27일 동안 공동 규약 유지' },
  },
  {
    id: 'PROFESSIONAL_OFFICERS', name: '직업 장교단', era: 'EARLY_MODERN', tier: 19, cost: 92, prereqs: ['MILITARY_REVOLUTION', 'FIELD_ARTILLERY'], tags: ['MILITARY', 'CIVICS'], branch: 'MILITARY',
    description: '전문 지휘와 보급 교육으로 위험 행동의 부상 피해를 줄입니다.',
    unlocks: { passives: ['PROFESSIONAL_OFFICERS_RISK_DOWN'] },
    inspiration: { type: 'actionSuccess', action: 'hunt', count: 20, bonusPct: 0.25, desc: '사냥 성공 20회의 지휘 교육 정리' },
  },
  {
    id: 'ENLIGHTENMENT', name: '계몽주의', era: 'EARLY_MODERN', tier: 20, cost: 96, prereqs: ['SOCIAL_CONTRACT', 'CLASSICAL_MECHANICS'], tags: ['SCIENCE', 'CULTURE'], branch: 'NATURAL_PHILOSOPHY',
    description: '이성과 공개 검증을 사회 원리로 확장해 유레카와 영감 보너스를 강화합니다.',
    unlocks: { passives: ['ENLIGHTENMENT_BREAKTHROUGH_UP'] },
    inspiration: { type: 'weatherTypes', count: 5, bonusPct: 0.25, desc: '자연 현상 5종의 공개 설명 완성' },
  },
  {
    id: 'CONSTITUTIONAL_ASSEMBLY', name: '입헌 의회', era: 'EARLY_MODERN', tier: 20, cost: 96, prereqs: ['SOCIAL_CONTRACT', 'COPPERPLATE_PRINTING'], tags: ['CIVICS', 'CULTURE'], branch: 'LITERATURE',
    description: '권한과 절차를 성문 규칙으로 제한해 캠프와 기록 점수를 크게 높입니다.',
    unlocks: { passives: ['CONSTITUTIONAL_ASSEMBLY_SCORE_UP'] },
    inspiration: { type: 'surviveDays', count: 30, bonusPct: 0.25, desc: '30일 동안 대표 회의와 규약 유지' },
  },
  {
    id: 'PUBLIC_HEALTH', name: '공중 보건', era: 'EARLY_MODERN', tier: 20, cost: 96, prereqs: ['POOR_RELIEF', 'PHARMACOPOEIA'], tags: ['SURVIVAL', 'SCIENCE'], branch: 'SURVIVAL',
    description: '위생·격리·치료 기준을 공동체 제도로 만들어 회복과 날씨 대응을 강화합니다.',
    unlocks: { passives: ['PUBLIC_HEALTH_RECOVERY_UP'] },
    inspiration: { type: 'haveItem', itemId: 'herb_tonic', count: 4, bonusPct: 0.25, desc: '약초 달임 4개와 위생 기록 비축' },
  },
];

export const TECH_TREE = RAW_TECH_TREE.map(withAdvancementLore);

export const CIVIC_IDS = [
  'ORAL_RECORDS',
  'SETTLEMENT',
  'MYSTICISM',
  'MILITARY_TRADITION',
  'STATE_WORKFORCE',
  'EARLY_THEOLOGY',
  'FOREIGN_TRADE',
  'HISTORY_RECORDS',
  'BASIC_PHILOSOPHY',
  'CLASSICAL_PHILOSOPHY',
  'REPUBLICAN_COUNCIL',
  'CIVIC_RITUAL',
  'DRAMA',
  'PUBLIC_DEBATE',
  'ATHLETIC_GAMES',
  'POETRY',
  'RHETORIC',
  'CIVIC_LAW',
  'EARLY_EMPIRE',
  'EARLY_MUSIC',
  'IMPERIAL_ADMINISTRATION',
  'CLASSICAL_EDUCATION',
  'MONASTIC_RULE',
  'FEUDAL_CONTRACT',
  'EPIC_TRADITION',
  'SCHOLASTICISM',
  'CHIVALRIC_CODE',
  'COURT_LITERATURE',
  'CATHEDRAL_SCHOOLS',
  'GUILD_SYSTEM',
  'CHRONICLE_WRITING',
  'NATURAL_PHILOSOPHY',
  'MILITARY_ORDERS',
  'SACRED_MUSIC',
  'UNIVERSITY_TRADITION',
  'URBAN_CHARTER',
  'ROMANCE_LITERATURE',
  'HUMANISM',
  'ESTATES_ASSEMBLY',
  'CODIFIED_THEOLOGY',
  'REFORMATION',
  'RENAISSANCE_HUMANISM',
  'STANDING_ARMY',
  'EMPIRICISM',
  'PATRONAGE_CULTURE',
  'CONFESSIONAL_TOLERANCE',
  'BUREAUCRATIC_STATE',
  'MARITIME_LAW',
  'MILITARY_REVOLUTION',
  'SCIENTIFIC_SOCIETY',
  'PUBLIC_SPHERE',
  'POOR_RELIEF',
  'ENLIGHTENED_THEOLOGY',
  'SOCIAL_CONTRACT',
  'PROFESSIONAL_OFFICERS',
  'ENLIGHTENMENT',
  'CONSTITUTIONAL_ASSEMBLY',
  'PUBLIC_HEALTH',
];

const CIVIC_ID_SET = new Set(CIVIC_IDS);

export const TECHNOLOGY_TREE = TECH_TREE
  .filter((advancement) => !CIVIC_ID_SET.has(advancement.id))
  .map(({ inspiration, ...technology }) => ({ ...technology, track: 'technology' }));

export const CIVIC_TREE = TECH_TREE
  .filter((advancement) => CIVIC_ID_SET.has(advancement.id))
  .map(({ eureka, ...civic }) => ({ ...civic, track: 'civics' }));

export const PERK_DEFS = [
  { id: 'perk_supply_pack', name: '보급 꾸러미', desc: '새 탐험 시작 시 베리 +3, 나무 +2, 돌 +2.', cost: 2, maxLevel: 1 },
  { id: 'perk_craft_cache', name: '제작 재료 꾸러미', desc: '새 탐험 시작 시 섬유/가죽/뼈를 추가로 받습니다.', cost: 2, maxLevel: 2 },
  { id: 'perk_rations', name: '건조 식량', desc: '새 탐험 시작 시 말린 고기를 받습니다.', cost: 1, maxLevel: 3 },
  { id: 'perk_medicine_pouch', name: '약초 주머니', desc: '새 탐험 시작 시 약초와 약초 물약을 받습니다.', cost: 2, maxLevel: 1 },
  { id: 'perk_extra_ap', name: '추가 행동력', desc: '새 탐험 시작 시 최대 AP +1.', cost: 3, maxLevel: 1 },
  { id: 'perk_start_fuel', name: '마른 장작', desc: '새 탐험 시작 시 캠프 연료 +6.', cost: 1, maxLevel: 1 },
];

export const WEATHER = [
  { id: 'clear', name: '맑음', temp: 16, actionMod: 0, cold: 0 },
  { id: 'rain', name: '비', temp: 10, actionMod: -0.06, cold: 4 },
  { id: 'cold-wind', name: '차가운 바람', temp: 4, actionMod: -0.08, cold: 9 },
  { id: 'snow', name: '눈', temp: -3, actionMod: -0.12, cold: 14 },
  { id: 'heat', name: '더위', temp: 28, actionMod: -0.04, cold: 0 },
];

export const DIFFICULTY_PRESETS = {
  veryeasy: {
    key: 'veryeasy',
    label: '매우 쉬움',
    startLabel: '이야기',
    recommendation: '실패 부담 없이 흐름을 익히는 첫 플레이용',
    desc: '행동 성공률을 보정하고 생존 부담을 크게 낮춥니다.',
    ruleSummary: '행동 성공률 +20%p · 최저 90% · AP와 시작 보급이 가장 넉넉합니다.',
    apMax: 6,
    hungerMultiplier: 0.55,
    coldMultiplier: 0.45,
    staminaRecoveryMultiplier: 1.3,
    actionChanceBonus: 0.2,
    actionChanceFloor: 0.9,
    actionChanceCap: 0.99,
    scoreMultiplier: 0.65,
    startInventory: { berry: 4, wood: 2, fiber: 1, meat: 1 },
  },
  easy: {
    key: 'easy',
    label: '쉬움',
    startLabel: '입문',
    recommendation: '첫 플레이와 시스템 확인용',
    desc: 'AP가 많고 추위와 허기 부담이 낮습니다.',
    ruleSummary: '행동 여유가 있고 시작 보급이 넉넉합니다.',
    apMax: 5,
    hungerMultiplier: 0.75,
    coldMultiplier: 0.65,
    staminaRecoveryMultiplier: 1.15,
    scoreMultiplier: 0.85,
    startInventory: { berry: 2, wood: 1 },
  },
  normal: {
    key: 'normal',
    label: '보통',
    startLabel: '표준',
    recommendation: '기본 밸런스 확인용',
    desc: '기본 생존 밸런스입니다.',
    ruleSummary: '보정 없이 원시 아카이브 기본 흐름으로 시작합니다.',
    apMax: 4,
    hungerMultiplier: 1,
    coldMultiplier: 1,
    staminaRecoveryMultiplier: 1,
    scoreMultiplier: 1,
    startInventory: {},
  },
  hard: {
    key: 'hard',
    label: '어려움',
    startLabel: '압박',
    recommendation: '루트 최적화 연습용',
    desc: '허기와 추위가 빠르게 누적됩니다.',
    ruleSummary: '초반 식량이 줄고 생존 압박이 강해집니다.',
    apMax: 4,
    hungerMultiplier: 1.2,
    coldMultiplier: 1.25,
    staminaRecoveryMultiplier: 0.9,
    scoreMultiplier: 1.2,
    startInventory: { berry: -1 },
  },
  nightmare: {
    key: 'nightmare',
    label: '악몽',
    startLabel: '극한',
    recommendation: '숙련자 도전용',
    desc: '원본의 생존 압박을 더 강하게 재현합니다.',
    ruleSummary: 'AP와 보급이 줄고 허기/추위 페널티가 크게 올라갑니다.',
    apMax: 3,
    hungerMultiplier: 1.45,
    coldMultiplier: 1.6,
    staminaRecoveryMultiplier: 0.78,
    scoreMultiplier: 1.45,
    startInventory: { berry: -1, fiber: -1 },
  },
};

export function difficultyRows() {
  return Object.values(DIFFICULTY_PRESETS);
}

export function difficultyKey(value = 'normal') {
  return DIFFICULTY_PRESETS[value] ? value : 'normal';
}

export function difficultyPreset(stateOrKey) {
  const key = typeof stateOrKey === 'string' ? stateOrKey : stateOrKey?.difficulty;
  return DIFFICULTY_PRESETS[difficultyKey(key)];
}

export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function seasonForDay(day = 1) {
  const safeDay = Math.max(1, Number(day || 1));
  const yearLength = SEASONS.reduce((sum, season) => sum + Number(season.length || 0), 0);
  const cycleDay = ((safeDay - 1) % yearLength) + 1;
  let cursor = 0;
  const season = SEASONS.find((row) => {
    cursor += Number(row.length || 0);
    return cycleDay <= cursor;
  }) || SEASONS[0];
  const seasonStart = cursor - Number(season.length || 0) + 1;
  const dayInSeason = cycleDay - seasonStart + 1;
  return {
    ...season,
    year: Math.floor((safeDay - 1) / yearLength) + 1,
    yearLength,
    cycleDay,
    dayInSeason,
    daysRemaining: Math.max(0, Number(season.length || 0) - dayInSeason),
  };
}

export function rollWeather(day = 1, rng = Math.random) {
  const season = seasonForDay(day);
  const roll = rng();
  if (season.id === 'winter') {
    if (roll > 0.55) return WEATHER[3];
    if (roll > 0.2) return WEATHER[2];
    return WEATHER[0];
  }
  if (season.id === 'spring') {
    if (roll > 0.94) return WEATHER[2];
    if (roll > 0.68) return WEATHER[1];
    return WEATHER[0];
  }
  if (season.id === 'summer') {
    if (roll < 0.28) return WEATHER[4];
    if (roll > 0.92) return WEATHER[1];
    return WEATHER[0];
  }
  if (roll > 0.82) return WEATHER[2];
  if (roll > 0.64) return WEATHER[1];
  return WEATHER[0];
}

export function makeParty() {
  return STUDENTS.slice(0, 3).map((student) => ({
    ...student,
    hp: 100,
    hunger: 12,
    stamina: 100,
    bodyTemp: 37,
  }));
}

export function emptyEquipmentSlots() {
  return Object.fromEntries(EQUIPMENT_SLOTS.map((slot) => [slot, null]));
}

export function initEquipmentForParty(party) {
  return Object.fromEntries(party.map((member) => [member.id, emptyEquipmentSlots()]));
}

export function normalizeEquipment(value, party) {
  const source = value && typeof value === 'object' ? value : {};
  return Object.fromEntries(party.map((member) => {
    const slots = source[member.id] && typeof source[member.id] === 'object' ? source[member.id] : {};
    return [member.id, Object.fromEntries(EQUIPMENT_SLOTS.map((slot) => {
      const itemId = slots[slot];
      const item = ITEMS[itemId];
      return [slot, item?.type === 'equip' && item.slot === slot ? itemId : null];
    }))];
  }));
}

export function initExplorationState() {
  return {
    selectedRegionId: 'whisper-woods',
    revealed: Object.fromEntries(WORLD_REGIONS.map((region) => [region.id, Boolean(region.revealedAtStart)])),
    visits: {},
    lastDiscoveredId: '',
    discoverySerial: 0,
  };
}

export function normalizeExplorationState(value = {}) {
  const base = initExplorationState();
  const sourceRevealed = value.revealed && typeof value.revealed === 'object' ? value.revealed : {};
  const revealed = Object.fromEntries(WORLD_REGIONS.map((region) => [
    region.id,
    Boolean(region.revealedAtStart || sourceRevealed[region.id]),
  ]));
  const selectedCandidate = WORLD_REGIONS.find((region) => region.id === value.selectedRegionId && revealed[region.id] && !region.safe);
  return {
    ...base,
    ...value,
    selectedRegionId: selectedCandidate?.id || base.selectedRegionId,
    revealed,
    visits: Object.fromEntries(WORLD_REGIONS.map((region) => [
      region.id,
      Math.max(0, Number(value.visits?.[region.id] || 0)),
    ])),
    lastDiscoveredId: WORLD_REGIONS.some((region) => region.id === value.lastDiscoveredId) ? value.lastDiscoveredId : '',
    discoverySerial: Math.max(0, Number(value.discoverySerial || 0)),
  };
}

export function initProjectState() {
  return {
    selectedProjectId: TRIBE_PROJECTS[0]?.id || '',
    progress: {},
    resourceCommitted: {},
    completed: {},
    lastCompletedId: '',
    completionSerial: 0,
  };
}

export function normalizeProjectState(value = {}) {
  const base = initProjectState();
  const validProjectIds = new Set(TRIBE_PROJECTS.map((project) => project.id));
  const selectedProjectId = typeof value.selectedProjectId === 'string'
    ? validProjectIds.has(value.selectedProjectId) ? value.selectedProjectId : ''
    : base.selectedProjectId;
  return {
    ...base,
    ...value,
    selectedProjectId,
    progress: Object.fromEntries(TRIBE_PROJECTS.map((project) => [
      project.id,
      Math.min(project.work, Math.max(0, Number(value.progress?.[project.id] || 0))),
    ])),
    resourceCommitted: Object.fromEntries(TRIBE_PROJECTS.map((project) => [
      project.id,
      Boolean(value.resourceCommitted?.[project.id]),
    ])),
    completed: Object.fromEntries(TRIBE_PROJECTS.map((project) => [
      project.id,
      Boolean(value.completed?.[project.id]),
    ])),
    lastCompletedId: validProjectIds.has(value.lastCompletedId) ? value.lastCompletedId : '',
    completionSerial: Math.max(0, Number(value.completionSerial || 0)),
  };
}

export function initTribeState() {
  return {
    population: 4,
    assignments: { forager: 2, hunter: 1, builder: 1, scholar: 0 },
    morale: 60,
    growthProgress: 0,
    lastGrowthDay: 0,
    lastProduction: {},
    productionSerial: 0,
    growthSerial: 0,
    assignmentSerial: 0,
  };
}

export function normalizeTribeState(value = {}) {
  const base = initTribeState();
  const population = Math.min(24, Math.max(1, Math.floor(Number(value.population || base.population))));
  const assignments = Object.fromEntries(TRIBE_JOBS.map((job) => [
    job.id,
    Math.min(population, Math.max(0, Math.floor(Number(value.assignments?.[job.id] ?? base.assignments[job.id] ?? 0)))),
  ]));
  let overflow = Object.values(assignments).reduce((sum, count) => sum + count, 0) - population;
  [...TRIBE_JOBS].reverse().forEach((job) => {
    if (overflow <= 0) return;
    const reduction = Math.min(assignments[job.id], overflow);
    assignments[job.id] -= reduction;
    overflow -= reduction;
  });
  return {
    ...base,
    ...value,
    population,
    assignments,
    morale: Math.min(100, Math.max(0, Number(value.morale ?? base.morale))),
    growthProgress: Math.max(0, Number(value.growthProgress || 0)),
    lastGrowthDay: Math.max(0, Math.floor(Number(value.lastGrowthDay || 0))),
    lastProduction: value.lastProduction && typeof value.lastProduction === 'object' ? value.lastProduction : {},
    productionSerial: Math.max(0, Math.floor(Number(value.productionSerial || 0))),
    growthSerial: Math.max(0, Math.floor(Number(value.growthSerial || 0))),
    assignmentSerial: Math.max(0, Math.floor(Number(value.assignmentSerial || 0))),
  };
}

export function initDiplomacyState() {
  return {
    contacts: Object.fromEntries(RIVAL_TRIBES.map((tribe) => [tribe.id, {
      known: false,
      relation: tribe.startRelation,
      trust: 0,
      trades: 0,
      lastActionDay: 0,
    }])),
    lastContactId: '',
    contactSerial: 0,
    actionSerial: 0,
    lastOutcome: '',
  };
}

export function normalizeDiplomacyState(value = {}) {
  const base = initDiplomacyState();
  const contacts = Object.fromEntries(RIVAL_TRIBES.map((tribe) => {
    const source = value.contacts?.[tribe.id] || {};
    const fallback = base.contacts[tribe.id];
    return [tribe.id, {
      known: Boolean(source.known),
      relation: Math.min(100, Math.max(-100, Number(source.relation ?? fallback.relation))),
      trust: Math.min(100, Math.max(0, Number(source.trust || 0))),
      trades: Math.max(0, Math.floor(Number(source.trades || 0))),
      lastActionDay: Math.max(0, Math.floor(Number(source.lastActionDay || 0))),
    }];
  }));
  return {
    ...base,
    ...value,
    contacts,
    lastContactId: RIVAL_TRIBES.some((tribe) => tribe.id === value.lastContactId) ? value.lastContactId : '',
    contactSerial: Math.max(0, Math.floor(Number(value.contactSerial || 0))),
    actionSerial: Math.max(0, Math.floor(Number(value.actionSerial || 0))),
    lastOutcome: typeof value.lastOutcome === 'string' ? value.lastOutcome : '',
  };
}

export function initResearchState() {
  return {
    selectedTechId: 'GATHERING',
    progress: {},
    completed: {},
    eureka: {},
    inspiration: {},
    lastCompletedTechId: '',
    completionSerial: 0,
    counters: {
      actionSuccess: {},
      actionFail: {},
      recipeCraft: {},
      campAction: {},
      weatherSeen: {},
      campFireDays: 0,
    },
  };
}

export function initCivicState() {
  return {
    selectedCivicId: CIVIC_TREE[0]?.id || '',
    progress: {},
    completed: {},
    inspiration: {},
    lastCompletedCivicId: '',
    completionSerial: 0,
  };
}

export function initMetaState(value = {}) {
  return {
    perkPoints: Math.max(0, Number(value.perkPoints || 0)),
    ownedPerks: value.ownedPerks && typeof value.ownedPerks === 'object' ? value.ownedPerks : {},
    lifetimeScore: Math.max(0, Number(value.lifetimeScore || 0)),
    runsCompleted: Math.max(0, Number(value.runsCompleted || 0)),
    lastAward: Math.max(0, Number(value.lastAward || 0)),
    lastSettledRunId: typeof value.lastSettledRunId === 'string' ? value.lastSettledRunId : '',
  };
}

function perkLevel(meta, perkId) {
  return Math.max(0, Number(meta?.ownedPerks?.[perkId] || 0));
}

export function applyOwnedPerks(state, meta) {
  const next = {
    ...state,
    inventory: { ...state.inventory },
    camp: { ...state.camp },
  };
  if (perkLevel(meta, 'perk_supply_pack') > 0) {
    next.inventory.berry = Number(next.inventory.berry || 0) + 3;
    next.inventory.wood = Number(next.inventory.wood || 0) + 2;
    next.inventory.stone = Number(next.inventory.stone || 0) + 2;
  }
  const craftLevel = perkLevel(meta, 'perk_craft_cache');
  if (craftLevel > 0) {
    next.inventory.fiber = Number(next.inventory.fiber || 0) + craftLevel;
    next.inventory.hide = Number(next.inventory.hide || 0) + craftLevel;
    next.inventory.bone = Number(next.inventory.bone || 0) + craftLevel;
  }
  const rationLevel = perkLevel(meta, 'perk_rations');
  if (rationLevel > 0) next.inventory.cooked_meat = Number(next.inventory.cooked_meat || 0) + rationLevel;
  if (perkLevel(meta, 'perk_medicine_pouch') > 0) {
    next.inventory.herb = Number(next.inventory.herb || 0) + 2;
    next.inventory.berry = Number(next.inventory.berry || 0) + 1;
  }
  if (perkLevel(meta, 'perk_extra_ap') > 0) {
    next.apMax += 1;
    next.ap += 1;
  }
  if (perkLevel(meta, 'perk_start_fuel') > 0) next.camp.fuel += 6;
  return next;
}

export function normalizeResearch(value = {}) {
  const base = initResearchState();
  return {
    ...base,
    ...value,
    selectedTechId: TECHNOLOGY_TREE.some((tech) => tech.id === value.selectedTechId) ? value.selectedTechId : base.selectedTechId,
    progress: value.progress && typeof value.progress === 'object' ? value.progress : base.progress,
    completed: value.completed && typeof value.completed === 'object' ? value.completed : base.completed,
    eureka: value.eureka && typeof value.eureka === 'object' ? value.eureka : base.eureka,
    inspiration: value.inspiration && typeof value.inspiration === 'object' ? value.inspiration : base.inspiration,
    lastCompletedTechId: TECHNOLOGY_TREE.some((tech) => tech.id === value.lastCompletedTechId) ? value.lastCompletedTechId : '',
    completionSerial: Math.max(0, Number(value.completionSerial || 0)),
    counters: {
      ...base.counters,
      ...(value.counters || {}),
      actionSuccess: { ...(value.counters?.actionSuccess || {}) },
      actionFail: { ...(value.counters?.actionFail || {}) },
      recipeCraft: { ...(value.counters?.recipeCraft || {}) },
      campAction: { ...(value.counters?.campAction || {}) },
      weatherSeen: { ...(value.counters?.weatherSeen || {}) },
      campFireDays: Math.max(0, Number(value.counters?.campFireDays || 0)),
    },
  };
}

function civicStateMap(value, legacyValue) {
  const source = value && typeof value === 'object' ? value : {};
  const legacy = legacyValue && typeof legacyValue === 'object' ? legacyValue : {};
  return Object.fromEntries(CIVIC_TREE.flatMap((civic) => {
    if (Object.hasOwn(source, civic.id)) return [[civic.id, source[civic.id]]];
    if (Object.hasOwn(legacy, civic.id)) return [[civic.id, legacy[civic.id]]];
    return [];
  }));
}

export function normalizeCivics(value = {}, legacyResearch = {}) {
  const base = initCivicState();
  const legacySelected = CIVIC_TREE.some((civic) => civic.id === legacyResearch?.selectedTechId)
    ? legacyResearch.selectedTechId
    : '';
  const selectedCivicId = CIVIC_TREE.some((civic) => civic.id === value.selectedCivicId)
    ? value.selectedCivicId
    : legacySelected || base.selectedCivicId;
  const lastCompletedCivicId = CIVIC_TREE.some((civic) => civic.id === value.lastCompletedCivicId)
    ? value.lastCompletedCivicId
    : CIVIC_TREE.some((civic) => civic.id === legacyResearch?.lastCompletedTechId)
      ? legacyResearch.lastCompletedTechId
      : '';
  return {
    ...base,
    ...value,
    selectedCivicId,
    progress: civicStateMap(value.progress, legacyResearch?.progress),
    completed: civicStateMap(value.completed, legacyResearch?.completed),
    inspiration: civicStateMap(value.inspiration, legacyResearch?.inspiration),
    lastCompletedCivicId,
    completionSerial: Math.max(0, Number(value.completionSerial || 0)),
  };
}
