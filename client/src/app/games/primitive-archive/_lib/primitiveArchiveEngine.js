export const GAME_SLUG = 'primitive-archive';
export const QUICK_SAVE_SLOT = 'primitive-archive-main';
export const SAVE_VERSION = 'primitive-archive-v1';
const BASE_LOG_LIMIT = 240;
const ARCHIVE_LOG_LIMIT_BONUS = 120;
const ARCHIVE_VICTORY_DAY = 12;

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

const EQUIPMENT_SLOTS = Object.keys(EQUIPMENT_SLOT_LABELS);

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

const DIALOGUES = {
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
  herb_tonic: { name: '약초 달임', icon: 'herb', weight: 1, type: 'food', nutrition: 0, heal: 12 },
  twine: { name: '끈', icon: 'fiber', weight: 1 },
  leather_strip: { name: '가죽끈', icon: 'hide', weight: 1 },
  stone_axe: { name: '돌도끼', icon: 'tool', weight: 3, type: 'equip', slot: 'tool', successAdd: { gather: 0.08, craft: 0.03 }, staminaAdd: { gather: -2 } },
  bow: { name: '활', icon: 'weapon', weight: 2, type: 'equip', slot: 'weapon', successAdd: { hunt: 0.1 }, staminaAdd: { hunt: -1 } },
  flint_knife: { name: '부싯돌 칼', icon: 'tool', weight: 1, type: 'equip', slot: 'tool', successAdd: { craft: 0.06, gather: 0.02 }, staminaAdd: { craft: -2 } },
  bone_pick: { name: '뼈 곡괭이', icon: 'tool', weight: 2, type: 'equip', slot: 'tool', successAdd: { gather: 0.08 }, staminaAdd: { gather: -1 } },
  spear: { name: '창', icon: 'weapon', weight: 3, type: 'equip', slot: 'weapon', successAdd: { hunt: 0.06 }, staminaAdd: { hunt: -1 } },
  sling: { name: '투석구', icon: 'weapon', weight: 1, type: 'equip', slot: 'weapon', successAdd: { hunt: 0.05 } },
  atlatl: { name: '투창기(아틀라틀)', icon: 'weapon', weight: 2, type: 'equip', slot: 'weapon', successAdd: { hunt: 0.1 } },
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
  charm: { name: '부싯돌 장신구', icon: 'artifact', weight: 1, type: 'equip', slot: 'accessory', successAdd: { craft: 0.04, gather: 0.02 } },
  hunter_talisman: { name: '사냥 부적', icon: 'artifact', weight: 1, type: 'equip', slot: 'accessory', successAdd: { hunt: 0.06 } },
  crafter_amulet: { name: '제작 부적', icon: 'artifact', weight: 1, type: 'equip', slot: 'accessory', successAdd: { craft: 0.06 } },
  gatherer_charm: { name: '채집 부적', icon: 'artifact', weight: 1, type: 'equip', slot: 'accessory', successAdd: { gather: 0.06 } },
  book_craft_guide: { name: '제작 안내서', icon: 'artifact', weight: 1, type: 'book' },
  book_camp_manual: { name: '캠프 운영서', icon: 'artifact', weight: 1, type: 'book' },
};

export const RECIPES = [
  { id: 'twine', name: '끈', requires: { fiber: 2 }, baseChance: 0.9, reward: { twine: 1 }, note: '초기 제작 재료입니다.' },
  { id: 'stone_axe', name: '돌도끼', requires: { wood: 2, stone: 3 }, baseChance: 0.7, reward: { stone_axe: 1 }, note: '채집 성공률을 올립니다.' },
  { id: 'bow', name: '활', requires: { wood: 2, fiber: 3, twine: 1 }, baseChance: 0.62, reward: { bow: 1 }, note: '사냥 성공률을 올립니다.' },
  { id: 'flint_knife', name: '부싯돌 칼', requires: { flint: 2, wood: 1, twine: 1 }, baseChance: 0.72, reward: { flint_knife: 1 }, note: '제작과 채집을 동시에 보조하는 정밀 도구입니다.' },
  { id: 'bone_pick', name: '뼈 곡괭이', requires: { bone: 2, wood: 1, twine: 1 }, baseChance: 0.72, reward: { bone_pick: 1 }, note: '채집 성공률과 피로 관리에 유리합니다.' },
  { id: 'spear', name: '창', requires: { wood: 2, stone: 2, twine: 1 }, baseChance: 0.66, reward: { spear: 1 }, note: '초기 사냥 안정성을 올리는 무기입니다.' },
  { id: 'sling', name: '투석구', requires: { fiber: 3, leather_strip: 1 }, baseChance: 0.72, reward: { sling: 1 }, note: '가벼운 사냥 무기입니다.' },
  { id: 'atlatl', name: '투창기(아틀라틀)', requires: { wood: 3, bone: 2, twine: 2 }, baseChance: 0.58, reward: { atlatl: 1 }, note: '큰 사냥감을 노리기 위한 중급 사냥 무기입니다.' },
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
  { id: 'charm', name: '부싯돌 장신구', requires: { flint: 1, bone: 1, twine: 1 }, baseChance: 0.66, reward: { charm: 1 }, note: '제작과 채집 감각을 보조합니다.' },
  { id: 'hunter_talisman', name: '사냥 부적', requires: { tooth: 1, bone: 1, fiber: 1 }, baseChance: 0.66, reward: { hunter_talisman: 1 }, note: '사냥 담당자에게 좋은 장신구입니다.' },
  { id: 'crafter_amulet', name: '제작 부적', requires: { flint: 1, bone: 1, fiber: 1 }, baseChance: 0.66, reward: { crafter_amulet: 1 }, note: '제작 담당자에게 좋은 장신구입니다.' },
  { id: 'gatherer_charm', name: '채집 부적', requires: { resin: 1, bone: 1, fiber: 1 }, baseChance: 0.66, reward: { gatherer_charm: 1 }, note: '채집 담당자에게 좋은 장신구입니다.' },
  { id: 'book_craft_guide', name: '제작 안내서', requires: { fiber: 4, resin: 1, clay: 1, twine: 1 }, baseChance: 0.58, reward: { book_craft_guide: 1 }, note: '책 시스템 해금 후 제작 성공률을 올리는 기록물입니다.' },
  { id: 'book_camp_manual', name: '캠프 운영서', requires: { fiber: 4, resin: 1, clay: 1, herb: 1 }, baseChance: 0.58, reward: { book_camp_manual: 1 }, note: '책 시스템 해금 후 캠프 행동 피로를 줄이는 기록물입니다.' },
  { id: 'jerky', name: '육포', requires: { meat: 2, resin: 1 }, baseChance: 0.8, reward: { jerky: 1 }, note: '가벼운 회복과 허기 관리용 보존식입니다.' },
  { id: 'herb_tonic', name: '약초 달임', requires: { herb: 2, berry: 1 }, baseChance: 0.72, reward: { herb_tonic: 1 }, note: '허기는 줄지 않지만 HP 회복량이 큽니다.' },
];

export const TECH_TREE = [
  { id: 'GATHERING', name: '채집', era: 'PRIMITIVE', cost: 10, prereqs: [], unlocks: { passives: ['GATHER_SUCCESS_UP'] }, eureka: { type: 'actionSuccess', action: 'gather', count: 3, bonusPct: 0.25, desc: '채집 성공 3회' } },
  { id: 'HUNTING', name: '사냥', era: 'PRIMITIVE', cost: 10, prereqs: [], unlocks: { passives: ['HUNT_SUCCESS_UP'] }, eureka: { type: 'actionSuccess', action: 'hunt', count: 2, bonusPct: 0.25, desc: '사냥 성공 2회' } },
  { id: 'FIREMAKING', name: '불 피우기', era: 'PRIMITIVE', cost: 12, prereqs: ['GATHERING'], unlocks: { passives: ['COOKING_RECOVERY_UP'], camp: ['fire'] }, eureka: { type: 'campAction', kind: 'cook', count: 1, bonusPct: 0.3, desc: '구운 고기 제작 1회' } },
  { id: 'STONE_TOOLS', name: '석기 도구', era: 'PRIMITIVE', cost: 12, prereqs: ['GATHERING'], unlocks: { passives: ['CRAFT_SUCCESS_UP'], recipes: ['stone_axe'] }, eureka: { type: 'recipeCraft', recipeId: 'stone_axe', count: 1, bonusPct: 0.25, desc: '도구 제작 1회' } },
  { id: 'CORDAGE', name: '끈과 밧줄', era: 'PRIMITIVE', cost: 12, prereqs: ['GATHERING'], unlocks: { recipes: ['twine'] }, eureka: { type: 'haveItem', itemId: 'fiber', count: 5, bonusPct: 0.25, desc: '섬유 5개 보유' } },
  { id: 'HERBALISM', name: '약초 지식', era: 'PRIMITIVE', cost: 12, prereqs: ['GATHERING'], unlocks: { passives: ['REST_HEAL_UP'] }, eureka: { type: 'haveItem', itemId: 'herb', count: 3, bonusPct: 0.3, desc: '약초 3개 보유' } },
  { id: 'SHELTER', name: '대피소 짓기', era: 'PRIMITIVE', cost: 14, prereqs: ['FIREMAKING'], unlocks: { camp: ['shelter'] }, eureka: { type: 'surviveDays', count: 3, bonusPct: 0.3, desc: '3일 생존' } },
  { id: 'ORAL_RECORDS', name: '구전 기록', era: 'NEOLITHIC', cost: 18, prereqs: ['HERBALISM', 'SHELTER'], unlocks: { passives: ['RESEARCH_NOTE_UP'] }, eureka: { type: 'weatherTypes', count: 2, bonusPct: 0.25, desc: '서로 다른 날씨 2종 관찰' } },
  { id: 'TRAPPING', name: '덫 사냥', era: 'NEOLITHIC', cost: 16, prereqs: ['HUNTING', 'CORDAGE'], unlocks: { passives: ['HUNT_RISK_DOWN'] }, eureka: { type: 'actionFail', action: 'hunt', count: 1, bonusPct: 0.15, desc: '사냥 실패 1회' } },
  { id: 'ARCHERY', name: '궁술', era: 'NEOLITHIC', cost: 18, prereqs: ['HUNTING', 'CORDAGE'], unlocks: { recipes: ['bow'], passives: ['BOW_HUNT_UP'] }, eureka: { type: 'recipeCraft', recipeId: 'bow', count: 1, bonusPct: 0.3, desc: '활 제작 1회' } },
  { id: 'SETTLEMENT', name: '정착', era: 'NEOLITHIC', cost: 20, prereqs: ['SHELTER'], unlocks: { passives: ['CAMP_SCORE_UP', 'PARTY_CAP_UP'] }, eureka: { type: 'campLevel', key: 'shelterLevel', count: 2, bonusPct: 0.25, desc: '대피소 Lv.2 달성' } },
  { id: 'ARCHIVE', name: '기록 보관', era: 'NEOLITHIC', cost: 24, prereqs: ['SETTLEMENT', 'ORAL_RECORDS'], unlocks: { camp: ['archive_room'], passives: ['RESEARCH_POINT_BONUS', 'ARCHIVE_LOG_UP'] }, eureka: { type: 'campFireDays', count: 2, bonusPct: 0.25, desc: '모닥불을 유지한 밤 2회' } },
  { id: 'WRITING', name: '문자', era: 'ANCIENT', cost: 28, prereqs: ['ARCHIVE'], unlocks: { camp: ['scribe_desk'], passives: ['BOOK_SYSTEM_UNLOCK'] }, eureka: { type: 'surviveDays', count: 7, bonusPct: 0.25, desc: '7일 생존' } },
  { id: 'BOOKCRAFT', name: '책 제작', era: 'ANCIENT', cost: 28, prereqs: ['WRITING', 'CORDAGE'], unlocks: { recipes: ['book_craft_guide', 'book_camp_manual'], passives: ['BOOK_BONUS_UP'] }, eureka: { type: 'haveItem', itemId: 'clay', count: 4, bonusPct: 0.25, desc: '점토 4개 보유' } },
  { id: 'LIBRARY', name: '서가 정리', era: 'ANCIENT', cost: 32, prereqs: ['BOOKCRAFT'], unlocks: { camp: ['library_shelf'], passives: ['RESEARCH_POINT_BONUS_2'] }, eureka: { type: 'recipeCraft', recipeId: 'book_camp_manual', count: 1, bonusPct: 0.3, desc: '캠프 운영서 제작 1회' } },
];

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
  easy: {
    key: 'easy',
    label: '쉬움',
    desc: 'AP가 많고 추위와 허기 부담이 낮습니다.',
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
    desc: '기본 생존 밸런스입니다.',
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
    desc: '허기와 추위가 빠르게 누적됩니다.',
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
    desc: '원본의 생존 압박을 더 강하게 재현합니다.',
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

function difficultyKey(value = 'normal') {
  return DIFFICULTY_PRESETS[value] ? value : 'normal';
}

function difficultyPreset(stateOrKey) {
  const key = typeof stateOrKey === 'string' ? stateOrKey : stateOrKey?.difficulty;
  return DIFFICULTY_PRESETS[difficultyKey(key)];
}

export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function rollWeather(day = 1, rng = Math.random) {
  const snowBias = Math.min(0.2, day * 0.01);
  const roll = rng();
  if (roll > 0.92 - snowBias) return WEATHER[3];
  if (roll > 0.78) return WEATHER[2];
  if (roll > 0.58) return WEATHER[1];
  if (roll < 0.08) return WEATHER[4];
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

function emptyEquipmentSlots() {
  return Object.fromEntries(EQUIPMENT_SLOTS.map((slot) => [slot, null]));
}

function initEquipmentForParty(party) {
  return Object.fromEntries(party.map((member) => [member.id, emptyEquipmentSlots()]));
}

function normalizeEquipment(value, party) {
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

export function initResearchState() {
  return {
    selectedTechId: 'GATHERING',
    progress: {},
    completed: {},
    eureka: {},
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

function applyOwnedPerks(state, meta) {
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

function normalizeResearch(value = {}) {
  const base = initResearchState();
  return {
    ...base,
    ...value,
    selectedTechId: TECH_TREE.some((tech) => tech.id === value.selectedTechId) ? value.selectedTechId : base.selectedTechId,
    progress: value.progress && typeof value.progress === 'object' ? value.progress : base.progress,
    completed: value.completed && typeof value.completed === 'object' ? value.completed : base.completed,
    eureka: value.eureka && typeof value.eureka === 'object' ? value.eureka : base.eureka,
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

export function createNewState(options = {}) {
  const now = options.now || new Date().toISOString();
  const rng = options.rng || Math.random;
  const meta = initMetaState(options.meta);
  const difficulty = difficultyKey(options.difficulty);
  const preset = difficultyPreset(difficulty);
  const party = makeParty();
  const inventory = Object.entries(preset.startInventory || {}).reduce((acc, [itemId, qty]) => ({
    ...acc,
    [itemId]: Math.max(0, Number(acc[itemId] || 0) + Number(qty || 0)),
  }), { wood: 2, stone: 2, fiber: 2, berry: 2 });
  const base = {
    runId: options.runId || `pa-${Date.now().toString(36)}`,
    startedAt: now,
    updatedAt: now,
    difficulty,
    day: 1,
    ap: preset.apMax,
    apMax: preset.apMax,
    weather: rollWeather(1, rng),
    party,
    inventory,
    equipment: initEquipmentForParty(party),
    camp: { fireLevel: 0, shelterLevel: 0, workbenchLevel: 0, archiveRoomLevel: 0, scribeDeskLevel: 0, libraryShelfLevel: 0, fuel: 0 },
    counters: { gather: 0, hunt: 0, craft: 0, camp: 0, meals: 0, events: 0 },
    research: initResearchState(),
    meta,
    log: ['Day 1: 낯선 원시 지대에 도착했습니다. 파티의 첫 목표는 식량과 캠프 확보입니다.'],
    ended: false,
    victory: false,
  };
  return applyOwnedPerks(base, meta);
}

export function normalizeState(value) {
  const base = createNewState();
  if (!value || typeof value !== 'object') return base;
  const research = normalizeResearch(value.research);
  const meta = initMetaState(value.meta);
  const difficulty = difficultyKey(value.difficulty || base.difficulty);
  const preset = difficultyPreset(difficulty);
  const party = (Array.isArray(value.party) && value.party.length ? value.party : base.party).map((member) => ({
    ...member,
    hp: clamp(Number(member.hp ?? 100), 0, 100),
    hunger: clamp(Number(member.hunger ?? 12), 0, 100),
    stamina: clamp(Number(member.stamina ?? 100), 0, 100),
    bodyTemp: clamp(Number(member.bodyTemp ?? 37), 25, 39),
  }));
  const camp = value.camp && typeof value.camp === 'object'
    ? {
      ...base.camp,
      ...value.camp,
      archiveRoomLevel: clamp(Number(value.camp.archiveRoomLevel || 0), 0, 1),
      scribeDeskLevel: clamp(Number(value.camp.scribeDeskLevel || 0), 0, 1),
      libraryShelfLevel: clamp(Number(value.camp.libraryShelfLevel || 0), 0, 1),
    }
    : base.camp;
  return {
    ...base,
    ...value,
    difficulty,
    ap: clamp(Number(value.ap ?? preset.apMax), 0, Math.max(1, Number(value.apMax || preset.apMax))),
    apMax: Math.max(1, Number(value.apMax || preset.apMax)),
    weather: value.weather && typeof value.weather === 'object' ? value.weather : base.weather,
    party,
    inventory: value.inventory && typeof value.inventory === 'object' ? value.inventory : base.inventory,
    equipment: normalizeEquipment(value.equipment, party),
    camp,
    counters: value.counters && typeof value.counters === 'object' ? { ...base.counters, ...value.counters } : base.counters,
    research,
    meta,
    log: Array.isArray(value.log) ? value.log.slice(0, logCapacity({ ...base, ...value, camp })) : base.log,
    victory: Boolean(value.victory),
  };
}

export function getPartyCap(state) {
  const current = normalizeState(state);
  return 3 + (hasTechPassive(current, 'PARTY_CAP_UP') ? 1 : 0);
}

function makePartyMember(student) {
  return {
    ...student,
    hp: 100,
    hunger: 12,
    stamina: 100,
    bodyTemp: 37,
  };
}

export function recruitablePartyRows(state) {
  const current = normalizeState(state);
  const joinedIds = new Set(current.party.map((member) => member.id));
  const partyCap = getPartyCap(current);
  return STUDENTS
    .filter((student) => !joinedIds.has(student.id))
    .map((student) => ({
      ...student,
      canRecruit: current.party.length < partyCap,
      partyCap,
      currentPartySize: current.party.length,
    }));
}

export function recruitPartyMemberAction(state, studentId = '') {
  const current = normalizeState(state);
  const partyCap = getPartyCap(current);
  if (current.party.length >= partyCap) {
    return addLog(current, `파티 인원이 이미 최대입니다. (${current.party.length}/${partyCap})`);
  }

  const joinedIds = new Set(current.party.map((member) => member.id));
  const student = studentId
    ? STUDENTS.find((entry) => entry.id === studentId)
    : STUDENTS.find((entry) => !joinedIds.has(entry.id));
  if (!student) return addLog(current, '합류시킬 학생 후보가 없습니다.');
  if (joinedIds.has(student.id)) return addLog(current, `${student.name}은(는) 이미 파티에 있습니다.`);

  const member = makePartyMember(student);
  const party = [...current.party, member];
  return addLog({
    ...current,
    party,
    equipment: normalizeEquipment(current.equipment, party),
  }, `${member.name} 파티 합류. (파티 ${party.length}/${partyCap})`);
}

export function itemName(id) {
  return ITEMS[id]?.name || id;
}

export function logCapacity(state) {
  return BASE_LOG_LIMIT + (Number(state?.camp?.archiveRoomLevel || 0) > 0 ? ARCHIVE_LOG_LIMIT_BONUS : 0);
}

export function addLog(state, message) {
  return {
    ...state,
    log: [`Day ${state.day}: ${message}`, ...state.log].slice(0, logCapacity(state)),
    updatedAt: new Date().toISOString(),
  };
}

function pickDialogue(actorId, action, result = 'success', rng = Math.random) {
  const pack = DIALOGUES[actorId] || DIALOGUES.shiroko;
  const entry = pack?.[action];
  const lines = Array.isArray(entry) ? entry : entry?.[result];
  if (!Array.isArray(lines) || !lines.length) return '';
  return lines[Math.floor(rng() * lines.length) % lines.length];
}

function addDialogueLog(state, actorId, action, result = 'success', rng = Math.random) {
  const actor = getActor(state, actorId);
  const line = pickDialogue(actorId, action, result, rng);
  if (!line) return state;
  return addLog(state, `${actor?.name || '학생'}: "${line}"`);
}

export function spendResources(inventory, requires) {
  const next = { ...inventory };
  Object.entries(requires).forEach(([id, qty]) => {
    next[id] = Math.max(0, Number(next[id] || 0) - Number(qty || 0));
  });
  return next;
}

export function addItems(inventory, entries) {
  const next = { ...inventory };
  entries.forEach(([id, qty]) => {
    if (!qty) return;
    next[id] = Number(next[id] || 0) + Number(qty || 0);
  });
  return next;
}

export function hasResources(inventory, requires) {
  return Object.entries(requires).every(([id, qty]) => Number(inventory[id] || 0) >= Number(qty || 0));
}

function getTech(techId) {
  return TECH_TREE.find((tech) => tech.id === techId) || null;
}

function prereqsMet(research, tech) {
  return (tech?.prereqs || []).every((techId) => research.completed?.[techId]);
}

function nextAvailableTech(research) {
  return TECH_TREE.find((tech) => !research.completed?.[tech.id] && prereqsMet(research, tech)) || null;
}

function hasTechPassive(state, passiveId) {
  const research = normalizeResearch(state.research);
  return TECH_TREE.some((tech) => research.completed?.[tech.id] && (tech.unlocks?.passives || []).includes(passiveId));
}

function hasTechCampUnlock(state, campId) {
  const research = normalizeResearch(state.research);
  return TECH_TREE.some((tech) => research.completed?.[tech.id] && (tech.unlocks?.camp || []).includes(campId));
}

function bookSystemActive(state) {
  return hasTechPassive(state, 'BOOK_SYSTEM_UNLOCK');
}

function bookCraftChanceBonus(state) {
  if (!bookSystemActive(state) || Number(state.inventory?.book_craft_guide || 0) <= 0) return 0;
  return 0.04 + Number(state.camp?.libraryShelfLevel || 0) * 0.02 + (hasTechPassive(state, 'BOOK_BONUS_UP') ? 0.01 : 0);
}

function bookCampStaminaReduction(state) {
  if (!bookSystemActive(state) || Number(state.inventory?.book_camp_manual || 0) <= 0) return 0;
  return 2 + Number(state.camp?.libraryShelfLevel || 0) + (hasTechPassive(state, 'BOOK_BONUS_UP') ? 1 : 0);
}

function bookResearchBonus(state) {
  if (!bookSystemActive(state)) return 0;
  return Math.min(2, Number(state.inventory?.book_craft_guide || 0) + Number(state.inventory?.book_camp_manual || 0));
}

function completeTechIfReady(state, techId) {
  const research = normalizeResearch(state.research);
  const tech = getTech(techId);
  if (!tech || research.completed[tech.id]) return state;
  const progress = Number(research.progress[tech.id] || 0);
  if (progress < tech.cost) return state;
  const nextResearch = {
    ...research,
    progress: { ...research.progress, [tech.id]: tech.cost },
    completed: { ...research.completed, [tech.id]: true },
  };
  if (nextResearch.selectedTechId === tech.id) {
    nextResearch.selectedTechId = nextAvailableTech(nextResearch)?.id || tech.id;
  }
  return addLog({ ...state, research: nextResearch }, `연구 완료: ${tech.name}`);
}

function addResearchProgress(state, techId, points, source = '연구') {
  const research = normalizeResearch(state.research);
  const tech = getTech(techId);
  if (!tech) return state;
  if (research.completed[tech.id]) return state;
  if (!prereqsMet(research, tech)) return addLog({ ...state, research }, `${tech.name} 선행 연구가 부족합니다.`);
  const progress = Math.min(tech.cost, Number(research.progress[tech.id] || 0) + Math.max(0, Math.floor(points)));
  const next = {
    ...state,
    research: {
      ...research,
      progress: { ...research.progress, [tech.id]: progress },
    },
  };
  const withLog = addLog(next, `${source}: ${tech.name} +${Math.max(0, Math.floor(points))}RP (${progress}/${tech.cost})`);
  return completeTechIfReady(withLog, tech.id);
}

function researchTriggerProgress(state, trigger) {
  const research = normalizeResearch(state.research);
  const counters = research.counters || {};
  const target = Math.max(1, Number(trigger?.count || 1));
  let current = 0;
  if (trigger.type === 'actionSuccess') current = Number(counters.actionSuccess?.[trigger.action] || 0);
  if (trigger.type === 'actionFail') current = Number(counters.actionFail?.[trigger.action] || 0);
  if (trigger.type === 'recipeCraft') current = Number(counters.recipeCraft?.[trigger.recipeId] || 0);
  if (trigger.type === 'campAction') current = Number(counters.campAction?.[trigger.kind] || 0);
  if (trigger.type === 'haveItem') current = Number(state.inventory?.[trigger.itemId] || 0);
  if (trigger.type === 'surviveDays') current = Number(state.day || 1);
  if (trigger.type === 'campLevel') current = Number(state.camp?.[trigger.key] || 0);
  if (trigger.type === 'weatherSeen') current = Number(counters.weatherSeen?.[trigger.weatherId] || 0);
  if (trigger.type === 'weatherTypes') {
    current = Object.values(counters.weatherSeen || {}).filter((value) => Number(value || 0) > 0).length;
  }
  if (trigger.type === 'campFireDays') current = Number(counters.campFireDays || 0);
  return {
    current,
    target,
    done: current >= target,
  };
}

function applyEureka(state) {
  let next = { ...state, research: normalizeResearch(state.research) };
  for (const tech of TECH_TREE) {
    const trigger = tech.eureka;
    if (!trigger || next.research.eureka[tech.id] || next.research.completed[tech.id]) continue;
    if (!researchTriggerProgress(next, trigger).done) continue;
    const bonus = Math.ceil(tech.cost * Number(trigger.bonusPct || 0));
    next = {
      ...next,
      research: { ...next.research, eureka: { ...next.research.eureka, [tech.id]: true } },
    };
    next = addLog(next, `유레카: ${tech.name} (${trigger.desc})`);
    next = addResearchProgress(next, tech.id, bonus, '유레카');
  }
  return next;
}

function recordResearchEvent(state, event) {
  const research = normalizeResearch(state.research);
  const counters = {
    ...research.counters,
    actionSuccess: { ...research.counters.actionSuccess },
    actionFail: { ...research.counters.actionFail },
    recipeCraft: { ...research.counters.recipeCraft },
    campAction: { ...research.counters.campAction },
    weatherSeen: { ...research.counters.weatherSeen },
    campFireDays: Math.max(0, Number(research.counters.campFireDays || 0)),
  };
  if (event.kind === 'action') {
    const bucket = event.ok ? counters.actionSuccess : counters.actionFail;
    bucket[event.action] = Number(bucket[event.action] || 0) + 1;
  }
  if (event.kind === 'recipe' && event.ok) counters.recipeCraft[event.recipeId] = Number(counters.recipeCraft[event.recipeId] || 0) + 1;
  if (event.kind === 'camp') counters.campAction[event.campKind] = Number(counters.campAction[event.campKind] || 0) + 1;
  if (event.kind === 'day') {
    counters.weatherSeen[event.weatherId] = Number(counters.weatherSeen[event.weatherId] || 0) + 1;
    if (event.fireKept) counters.campFireDays = Number(counters.campFireDays || 0) + 1;
  }
  return applyEureka({ ...state, research: { ...research, counters } });
}

function autoResearchForDay(state) {
  const research = normalizeResearch(state.research);
  const techId = research.selectedTechId || nextAvailableTech(research)?.id;
  if (!techId) return state;
  const points = clamp(
    2
    + Number(state.camp.workbenchLevel || 0)
    + Number(state.camp.archiveRoomLevel || 0)
    + Number(state.camp.scribeDeskLevel || 0)
    + Number(state.camp.libraryShelfLevel || 0)
    + (hasTechPassive(state, 'RESEARCH_POINT_BONUS') ? 1 : 0)
    + (hasTechPassive(state, 'RESEARCH_POINT_BONUS_2') ? 1 : 0)
    + bookResearchBonus(state),
    2,
    12
  );
  return addResearchProgress({ ...state, research }, techId, points, '일일 연구');
}

export function inventoryWeight(inventory) {
  return Object.entries(inventory).reduce((sum, [id, qty]) => sum + Number(qty || 0) * Number(ITEMS[id]?.weight || 1), 0);
}

function equipmentWeight(equipment = {}) {
  return Object.values(equipment).reduce((sum, slots) => (
    sum + Object.values(slots || {}).reduce((slotSum, itemId) => (
      slotSum + (itemId ? Number(ITEMS[itemId]?.weight || 0) : 0)
    ), 0)
  ), 0);
}

export function totalCarryWeight(state) {
  const current = normalizeState(state);
  return inventoryWeight(current.inventory) + equipmentWeight(current.equipment);
}

function equipmentBonus(state, actorId, bucket, key) {
  const slots = normalizeEquipment(state.equipment, state.party)[actorId] || {};
  return Object.values(slots).reduce((sum, itemId) => (
    sum + Number(ITEMS[itemId]?.[bucket]?.[key] || 0)
  ), 0);
}

function actorInsulation(state, actorId) {
  const slots = normalizeEquipment(state.equipment, state.party)[actorId] || {};
  return Object.values(slots).reduce((sum, itemId) => sum + Number(ITEMS[itemId]?.insulation || 0), 0);
}

export function partyInsulation(state) {
  const current = normalizeState(state);
  if (!current.party.length) return 0;
  const total = current.party.reduce((sum, member) => sum + actorInsulation(current, member.id), 0);
  return Math.round((total / current.party.length) * 10) / 10;
}

function isEquipped(state, actorId, itemId) {
  return Object.values(normalizeEquipment(state.equipment, state.party)[actorId] || {}).includes(itemId);
}

export function equipmentRows(state, actorId) {
  const current = normalizeState(state);
  const equipment = normalizeEquipment(current.equipment, current.party);
  const slots = equipment[actorId] || emptyEquipmentSlots();
  return EQUIPMENT_SLOTS.map((slot) => {
    const itemId = slots[slot];
    const item = ITEMS[itemId];
    return {
      slot,
      label: EQUIPMENT_SLOT_LABELS[slot],
      itemId: itemId || '',
      itemName: item?.name || '없음',
      insulation: Number(item?.insulation || 0),
      successText: item?.successAdd ? Object.entries(item.successAdd).map(([key, value]) => `${key}+${Math.round(Number(value) * 100)}%`).join(', ') : '',
    };
  });
}

export function equipmentChoicesForSlot(state, actorId, slot) {
  const current = normalizeState(state);
  const equipped = normalizeEquipment(current.equipment, current.party)[actorId]?.[slot] || '';
  const inventoryChoices = Object.entries(current.inventory)
    .filter(([itemId, qty]) => Number(qty || 0) > 0 && ITEMS[itemId]?.type === 'equip' && ITEMS[itemId]?.slot === slot)
    .map(([itemId, qty]) => ({
      itemId,
      name: ITEMS[itemId].name,
      qty: Number(qty || 0),
    }));
  const equippedChoice = equipped && !inventoryChoices.some((item) => item.itemId === equipped)
    ? [{ itemId: equipped, name: ITEMS[equipped]?.name || equipped, qty: 0 }]
    : [];
  return [{ itemId: '', name: '없음', qty: 0 }, ...equippedChoice, ...inventoryChoices];
}

export function equipmentInventoryRows(state) {
  const current = normalizeState(state);
  return Object.entries(current.inventory)
    .filter(([itemId, qty]) => Number(qty || 0) > 0 && ITEMS[itemId]?.type === 'equip')
    .map(([itemId, qty]) => ({
      itemId,
      name: ITEMS[itemId].name,
      slot: ITEMS[itemId].slot,
      slotLabel: EQUIPMENT_SLOT_LABELS[ITEMS[itemId].slot] || ITEMS[itemId].slot,
      qty: Number(qty || 0),
    }))
    .sort((a, b) => a.slotLabel.localeCompare(b.slotLabel, 'ko-KR') || a.name.localeCompare(b.name, 'ko-KR'));
}

export function setEquipmentSlotAction(state, actorId, slot, nextItemId) {
  const current = normalizeState(state);
  const actor = getActor(current, actorId);
  if (!actor) return current;
  if (!EQUIPMENT_SLOTS.includes(slot)) return addLog(current, '장비 슬롯을 찾을 수 없습니다.');
  const nextItem = nextItemId ? ITEMS[nextItemId] : null;
  if (nextItemId && (!nextItem || nextItem.type !== 'equip' || nextItem.slot !== slot)) {
    return addLog(current, '해당 슬롯에 장착할 수 없는 장비입니다.');
  }

  const equipment = normalizeEquipment(current.equipment, current.party);
  const previousItemId = equipment[actorId]?.[slot] || '';
  if (previousItemId === nextItemId) return current;
  if (nextItemId && Number(current.inventory[nextItemId] || 0) <= 0) {
    return addLog(current, `${nextItem.name} 보유 수량이 없습니다.`);
  }
  const inventory = { ...current.inventory };
  if (previousItemId) inventory[previousItemId] = Number(inventory[previousItemId] || 0) + 1;
  if (nextItemId) inventory[nextItemId] = Math.max(0, Number(inventory[nextItemId] || 0) - 1);

  const next = {
    ...current,
    inventory,
    equipment: {
      ...equipment,
      [actorId]: {
        ...(equipment[actorId] || emptyEquipmentSlots()),
        [slot]: nextItemId || null,
      },
    },
  };
  return addLog(next, `${actor.name} 장비 변경: ${EQUIPMENT_SLOT_LABELS[slot]} = ${nextItemId ? ITEMS[nextItemId].name : '없음'}`);
}

function buildEquipmentPool(state) {
  const pool = { ...state.inventory };
  const equipment = normalizeEquipment(state.equipment, state.party);
  Object.values(equipment).forEach((slots) => {
    Object.values(slots || {}).forEach((itemId) => {
      if (!itemId) return;
      pool[itemId] = Number(pool[itemId] || 0) + 1;
    });
  });
  return pool;
}

function preferredActionForRole(role) {
  if (role === '사냥') return 'hunt';
  if (role === '제작') return 'craft';
  return 'gather';
}

function equipmentScoreFor(actor, itemId, mode, weather) {
  const item = ITEMS[itemId];
  if (!item || item.type !== 'equip') return -Infinity;
  const weatherCold = Math.max(0, Number(weather?.cold || 0));
  const weatherWeight = mode === 'weather' ? 9 + weatherCold * 0.35 : 3 + weatherCold * 0.12;
  let score = Number(item.insulation || 0) * weatherWeight;
  const preferredAction = preferredActionForRole(actor?.role);

  Object.entries(item.successAdd || {}).forEach(([action, value]) => {
    const actionWeight = action === preferredAction
      ? mode === 'weather' ? 80 : 150
      : mode === 'weather' ? 55 : 65;
    score += Number(value || 0) * actionWeight;
  });

  Object.entries(item.staminaAdd || {}).forEach(([action, value]) => {
    const staminaWeight = action === preferredAction ? 8 : action === 'rest' ? 5 : 6;
    score += -Number(value || 0) * staminaWeight;
  });

  score -= Number(item.weight || 0) * (mode === 'weather' ? 0.3 : 0.2);
  return score;
}

function bestEquipmentForSlot(state, pool, actor, slot, mode) {
  let bestId = '';
  let bestScore = 0;
  Object.entries(pool).forEach(([itemId, qty]) => {
    if (Number(qty || 0) <= 0) return;
    const item = ITEMS[itemId];
    if (!item || item.type !== 'equip' || item.slot !== slot) return;
    const score = equipmentScoreFor(actor, itemId, mode, state.weather);
    if (score > bestScore) {
      bestId = itemId;
      bestScore = score;
    }
  });
  return bestId;
}

function countEquipmentChanges(before, after, party) {
  return party.reduce((sum, member) => {
    const prev = before[member.id] || emptyEquipmentSlots();
    const next = after[member.id] || emptyEquipmentSlots();
    return sum + EQUIPMENT_SLOTS.filter((slot) => (prev[slot] || '') !== (next[slot] || '')).length;
  }, 0);
}

export function autoEquipAction(state, mode = 'role') {
  const current = normalizeState(state);
  const safeMode = mode === 'weather' ? 'weather' : 'role';
  const before = normalizeEquipment(current.equipment, current.party);
  const pool = buildEquipmentPool(current);
  const equipment = {};

  current.party.forEach((actor) => {
    equipment[actor.id] = emptyEquipmentSlots();
    EQUIPMENT_SLOTS.forEach((slot) => {
      const itemId = bestEquipmentForSlot(current, pool, actor, slot, safeMode);
      if (!itemId) return;
      equipment[actor.id][slot] = itemId;
      pool[itemId] = Math.max(0, Number(pool[itemId] || 0) - 1);
    });
  });

  const inventory = Object.fromEntries(Object.entries(pool).filter(([, qty]) => Number(qty || 0) > 0));
  const changed = countEquipmentChanges(before, equipment, current.party);
  const modeLabel = safeMode === 'weather' ? '날씨' : '역할';
  return addLog({ ...current, inventory, equipment }, `장비 자동 장착 완료(${modeLabel} 모드). 변경 슬롯 ${changed}개.`);
}

export function clearAllEquipmentAction(state) {
  const current = normalizeState(state);
  const pool = buildEquipmentPool(current);
  const equipment = Object.fromEntries(current.party.map((member) => [member.id, emptyEquipmentSlots()]));
  const inventory = Object.fromEntries(Object.entries(pool).filter(([, qty]) => Number(qty || 0) > 0));
  return addLog({ ...current, inventory, equipment }, '모든 학생의 장비를 해제했습니다.');
}

export function averageParty(state, key) {
  if (!state.party.length) return 0;
  return Math.round(state.party.reduce((sum, member) => sum + Number(member[key] || 0), 0) / state.party.length);
}

export function averageBodyTemp(state) {
  if (!state.party.length) return 0;
  const avg = state.party.reduce((sum, member) => sum + Number(member.bodyTemp ?? 37), 0) / state.party.length;
  return Math.round(avg * 10) / 10;
}

export function getActor(state, actorId) {
  return state.party.find((member) => member.id === actorId) || state.party[0];
}

export function updateActor(state, actorId, patch) {
  return {
    ...state,
    party: state.party.map((member) => member.id === actorId ? { ...member, ...patch } : member),
  };
}

function withEventCounter(state) {
  return {
    ...state,
    counters: {
      ...state.counters,
      events: Number(state.counters?.events || 0) + 1,
    },
  };
}

function addEventLog(state, message) {
  return addLog(withEventCounter(state), `탐험 사건: ${message}`);
}

function zoneEventReward(zoneId, action) {
  if (action === 'gather') {
    if (zoneId === 'river') return [['herb', 1], ['clay', 1]];
    if (zoneId === 'cave') return [['flint', 1], ['obsidian_shard', 1]];
    if (zoneId === 'plains') return [['berry', 1], ['fiber', 1]];
    return [['resin', 1], ['berry', 1]];
  }
  if (zoneId === 'plains' || zoneId === 'cave') return [['dino_hide', 1], ['dino_bone', 1]];
  return [['tooth', 1], ['sinew', 1]];
}

function applyExplorationEvent(state, { actorId, action, zoneId = '', ok = true, recipe = null, rng = Math.random } = {}) {
  const chance = ok ? 0.12 : 0.08;
  if (rng() > chance) return state;
  const actor = getActor(state, actorId);
  let next = state;

  if (action === 'gather') {
    if (ok) {
      const rewards = zoneEventReward(zoneId, 'gather').filter(([, qty]) => qty > 0);
      next = { ...next, inventory: addItems(next.inventory, rewards) };
      return addEventLog(next, `${actor.name} 학생이 숨겨진 흔적을 발견했습니다. ${formatGains(rewards)}.`);
    }
    next = updateActor(next, actorId, { hp: clamp(Number(actor.hp || 0) - 3, 0, 100) });
    return addEventLog(next, `${actor.name} 학생이 가시덤불에 긁혔습니다. HP -3.`);
  }

  if (action === 'hunt') {
    if (ok) {
      const rewards = zoneEventReward(zoneId, 'hunt');
      next = {
        ...next,
        inventory: addItems(next.inventory, rewards),
      };
      next = updateActor(next, actorId, { hp: clamp(Number(actor.hp || 0) - 4, 0, 100) });
      return addEventLog(next, `${actor.name} 학생이 큰 사냥감의 흔적을 확보했습니다. ${formatGains(rewards)}, HP -4.`);
    }
    next = updateActor(next, actorId, {
      hp: clamp(Number(actor.hp || 0) - 5, 0, 100),
      stamina: clamp(Number(actor.stamina || 0) - 6, 0, 100),
    });
    return addEventLog(next, `${actor.name} 학생이 포식자를 피해 달아났습니다. HP -5, 스태미나 -6.`);
  }

  if (action === 'craft') {
    if (!ok) return addEventLog(next, `${actor.name} 학생이 실패 원인을 기록했습니다. 다음 제작 판단에 도움이 됩니다.`);
    const [rewardId] = Object.keys(recipe?.reward || {});
    if (!rewardId) return state;
    next = { ...next, inventory: addItems(next.inventory, [[rewardId, 1]]) };
    return addEventLog(next, `${actor.name}의 정교한 마감으로 ${itemName(rewardId)}을(를) 추가로 얻었습니다.`);
  }

  if (action === 'camp') {
    next = {
      ...next,
      camp: { ...next.camp, fuel: Number(next.camp.fuel || 0) + 1 },
      party: next.party.map((member) => ({
        ...member,
        stamina: clamp(Number(member.stamina || 0) + 3, 0, 100),
      })),
    };
    return addEventLog(next, '캠프 동선이 안정됐습니다. 연료 +1, 전원 스태미나 +3.');
  }

  return state;
}

export function actionChance(state, actorId, action, base = 0.55) {
  const actor = getActor(state, actorId);
  const stat = Number(actor?.stats?.[action] || 5);
  const weather = Number(state.weather?.actionMod || 0);
  const camp = action === 'craft' ? Number(state.camp.workbenchLevel || 0) * 0.04 : 0;
  const book = action === 'craft' ? bookCraftChanceBonus(state) : 0;
  const equipment = equipmentBonus(state, actorId, 'successAdd', action);
  const researchBonus =
    (action === 'gather' && hasTechPassive(state, 'GATHER_SUCCESS_UP') ? 0.06 : 0)
    + (action === 'hunt' && hasTechPassive(state, 'HUNT_SUCCESS_UP') ? 0.06 : 0)
    + (action === 'hunt' && isEquipped(state, actorId, 'bow') && hasTechPassive(state, 'BOW_HUNT_UP') ? 0.06 : 0)
    + (action === 'craft' && hasTechPassive(state, 'CRAFT_SUCCESS_UP') ? 0.06 : 0);
  return clamp(base + stat * 0.025 + weather + camp + book + equipment + researchBonus, 0.08, 0.95);
}

function staminaCostWithEquipment(state, actorId, action, baseCost) {
  return Math.max(1, Math.round(Number(baseCost || 0) + equipmentBonus(state, actorId, 'staminaAdd', action)));
}

function actionBodyTempDelta(state, actorId, warmthAdd = 0) {
  const weatherCold = Number(state.weather?.cold || 0);
  const personalWarmth = actorInsulation(state, actorId) * 1.25 + Number(state.camp.fireLevel || 0) * 0.65;
  const coldPressure = Math.max(0, weatherCold - personalWarmth);
  const heatPressure = state.weather?.id === 'heat' ? 0.16 : 0;
  return warmthAdd - coldPressure * 0.035 + heatPressure;
}

export function afterAction(state, actorId, staminaCost, hungerAdd = 3, options = {}) {
  const actor = getActor(state, actorId);
  const bodyTemp = clamp(
    Number(actor.bodyTemp ?? 37) + actionBodyTempDelta(state, actorId, Number(options.warmthAdd || 0)),
    25,
    39,
  );
  let next = updateActor(state, actorId, {
    stamina: clamp(Number(actor.stamina || 0) - staminaCost, 0, 100),
    hunger: clamp(Number(actor.hunger || 0) + hungerAdd, 0, 100),
    bodyTemp,
  });
  next.ap = Math.max(0, Number(next.ap || 0) - 1);
  if (next.ap <= 0 && !next.ended) next = advanceDay(next, options);
  return next;
}

export function advanceDay(state, options = {}) {
  const preset = difficultyPreset(state);
  const weather = rollWeather(state.day + 1, options.rng || Math.random);
  const warmth = Number(state.camp.fireLevel || 0) * 4 + Number(state.camp.shelterLevel || 0) * 3 + partyInsulation(state) * 2;
  const coldDamage = Math.round(Math.max(0, Number(state.weather?.cold || 0) - warmth) * preset.coldMultiplier);
  const fuelUsed = Number(state.camp.fireLevel || 0) > 0 && Number(state.camp.fuel || 0) > 0 ? 1 : 0;
  const party = state.party.map((member) => {
    const hunger = clamp(Number(member.hunger || 0) + Math.round(8 * preset.hungerMultiplier) + Math.floor(coldDamage / 3), 0, 100);
    const hungerDamage = hunger >= 90 ? 10 : hunger >= 75 ? 4 : 0;
    const shelterRecovery = (34 + Number(state.camp.shelterLevel || 0) * 8) * preset.staminaRecoveryMultiplier;
    const tempRecovery = warmth >= Number(state.weather?.cold || 0) ? 0.65 : 0;
    const bodyTemp = clamp(
      Number(member.bodyTemp ?? 37) - coldDamage * 0.24 - (state.weather?.id === 'snow' ? 0.35 : 0) + tempRecovery,
      25,
      39,
    );
    const hypothermiaDamage = bodyTemp < 31 ? 18 : bodyTemp < 34.5 ? 7 : 0;
    return {
      ...member,
      stamina: clamp(Number(member.stamina || 0) + shelterRecovery, 0, 100),
      hunger,
      bodyTemp,
      hp: clamp(Number(member.hp || 0) - coldDamage - hungerDamage - hypothermiaDamage, 0, 100),
    };
  });
  const ended = party.every((member) => Number(member.hp || 0) <= 0);
  const next = {
    ...state,
    day: state.day + 1,
    ap: state.apMax,
    weather,
    party,
    camp: { ...state.camp, fuel: Math.max(0, Number(state.camp.fuel || 0) - fuelUsed) },
    ended,
  };
  const tempNote = `평균 체온 ${averageBodyTemp(next).toFixed(1)}도`;
  const note = ended
    ? '파티가 더 이상 움직일 수 없습니다. 런을 종료하고 기록을 남기세요.'
    : `새로운 날입니다. 날씨: ${weather.name}, ${weather.temp}도 · ${tempNote}`;
  const logged = addLog(next, fuelUsed ? `${note} 모닥불 연료를 1 소비했습니다.` : note);
  return recordResearchEvent(autoResearchForDay(logged), { kind: 'day', weatherId: weather.id, fireKept: fuelUsed > 0 });
}

export function selectTechAction(state, techId) {
  const current = normalizeState(state);
  const tech = getTech(techId);
  if (!tech) return current;
  if (current.research.completed[tech.id]) return addLog(current, `${tech.name}은(는) 이미 완료된 연구입니다.`);
  if (!prereqsMet(current.research, tech)) return addLog(current, `${tech.name} 선행 연구가 부족합니다.`);
  return addLog({
    ...current,
    research: { ...current.research, selectedTechId: tech.id },
  }, `연구 목표를 ${tech.name}(으)로 변경했습니다.`);
}

export function runResearchAction(state, actorId, options = {}) {
  const current = normalizeState(state);
  if (current.ended || Number(current.ap || 0) <= 0) return addLog(current, '연구할 행동력이 부족합니다.');
  const actor = getActor(current, actorId);
  const techId = current.research.selectedTechId || nextAvailableTech(current.research)?.id;
  const tech = getTech(techId);
  if (!tech) return addLog(current, '연구 가능한 기술이 없습니다.');
  if (current.research.completed[tech.id]) return addLog(current, `${tech.name}은(는) 이미 완료된 연구입니다.`);
  if (!prereqsMet(current.research, tech)) return addLog(current, `${tech.name} 선행 연구가 부족합니다.`);
  const archiveStudy = Number(current.camp.scribeDeskLevel || 0) + Number(current.camp.libraryShelfLevel || 0) + bookResearchBonus(current);
  const points = 3 + Math.floor(Number(actor?.stats?.craft || 5) / 3) + Number(current.camp.workbenchLevel || 0) + archiveStudy;
  const staminaCost = Math.max(5, 14 - Number(current.camp.workbenchLevel || 0) * 2 - Number(current.camp.scribeDeskLevel || 0));
  const researched = addResearchProgress(current, tech.id, points, `${actor.name} 연구`);
  const withDialogue = addDialogueLog(researched, actorId, 'research', 'success', options.rng || Math.random);
  return afterAction(withDialogue, actorId, staminaCost, 2, options);
}

export function buyPerkAction(state, perkId) {
  const current = normalizeState(state);
  const perk = PERK_DEFS.find((item) => item.id === perkId);
  if (!perk) return current;
  const level = perkLevel(current.meta, perk.id);
  if (level >= perk.maxLevel) return addLog(current, '이미 최대 레벨인 특전입니다.');
  if (Number(current.meta.perkPoints || 0) < perk.cost) return addLog(current, '특전 포인트가 부족합니다.');
  return addLog({
    ...current,
    meta: {
      ...current.meta,
      perkPoints: Number(current.meta.perkPoints || 0) - perk.cost,
      ownedPerks: { ...current.meta.ownedPerks, [perk.id]: level + 1 },
    },
  }, `${perk.name} 특전을 구매했습니다. 다음 탐험부터 적용됩니다.`);
}

export function settleRunAction(state) {
  const current = normalizeState(state);
  if (current.meta.lastSettledRunId === current.runId) return addLog(current, '이미 정산한 런입니다.');
  const score = scoreState(current);
  const award = Math.max(1, Math.floor(score / 850));
  return addLog({
    ...current,
    ended: true,
    meta: {
      ...current.meta,
      perkPoints: Number(current.meta.perkPoints || 0) + award,
      lifetimeScore: Number(current.meta.lifetimeScore || 0) + score,
      runsCompleted: Number(current.meta.runsCompleted || 0) + 1,
      lastAward: award,
      lastSettledRunId: current.runId,
    },
  }, `런 정산 완료. 점수 ${score.toLocaleString('ko-KR')} / 특전 +${award}`);
}

export function completeArchiveAction(state) {
  const current = normalizeState(state);
  if (current.victory) return addLog(current, '이미 아카이브를 완성한 런입니다.');
  const victory = archiveVictorySummary(current);
  if (!victory.canComplete) {
    const pending = victory.rows.filter((row) => !row.done).map((row) => row.label).join(', ');
    return addLog(current, `아카이브 완성 조건이 부족합니다. 남은 목표: ${pending || '없음'}.`);
  }
  const nextForScore = { ...current, victory: true };
  const score = scoreState(nextForScore);
  const award = Math.max(3, Math.floor(score / 700));
  return addLog({
    ...nextForScore,
    ended: true,
    meta: {
      ...current.meta,
      perkPoints: Number(current.meta.perkPoints || 0) + award,
      lifetimeScore: Number(current.meta.lifetimeScore || 0) + score,
      runsCompleted: Number(current.meta.runsCompleted || 0) + 1,
      lastAward: award,
      lastSettledRunId: current.runId,
    },
  }, `아카이브 완성. 점수 ${score.toLocaleString('ko-KR')} / 특전 +${award}`);
}

export function startNewRunFromMeta(state, options = {}) {
  const current = normalizeState(state);
  return createNewState({ ...options, meta: current.meta });
}

export function techRows(state) {
  const current = normalizeState(state);
  return TECH_TREE.map((tech) => {
    const progress = Math.min(tech.cost, Number(current.research.progress?.[tech.id] || 0));
    const completed = Boolean(current.research.completed?.[tech.id]);
    const available = !completed && prereqsMet(current.research, tech);
    return {
      ...tech,
      progress,
      completed,
      available,
      selected: current.research.selectedTechId === tech.id,
      eurekaDone: Boolean(current.research.eureka?.[tech.id]),
      progressPct: Math.round((progress / tech.cost) * 100),
    };
  });
}

export function researchInspirationRows(state) {
  const current = normalizeState(state);
  return TECH_TREE
    .filter((tech) => tech.eureka)
    .map((tech) => {
      const status = researchTriggerProgress(current, tech.eureka);
      return {
        techId: tech.id,
        techName: tech.name,
        desc: tech.eureka.desc || '',
        completed: Boolean(current.research.completed?.[tech.id]),
        eurekaDone: Boolean(current.research.eureka?.[tech.id]),
        available: prereqsMet(current.research, tech),
        current: status.current,
        target: status.target,
        progressPct: Math.round((Math.min(status.current, status.target) / status.target) * 100),
      };
    })
    .sort((a, b) => (
      Number(a.completed) - Number(b.completed)
      || Number(b.available) - Number(a.available)
      || Number(a.eurekaDone) - Number(b.eurekaDone)
      || b.progressPct - a.progressPct
      || a.techName.localeCompare(b.techName, 'ko-KR')
    ));
}

export function perkRows(state) {
  const current = normalizeState(state);
  return PERK_DEFS.map((perk) => {
    const level = perkLevel(current.meta, perk.id);
    return {
      ...perk,
      level,
      maxed: level >= perk.maxLevel,
      canBuy: level < perk.maxLevel && Number(current.meta.perkPoints || 0) >= perk.cost,
    };
  });
}

export function researchSummary(state) {
  const current = normalizeState(state);
  const rows = techRows(current);
  const selected = rows.find((tech) => tech.selected) || rows.find((tech) => tech.available) || rows[0];
  return {
    completed: rows.filter((tech) => tech.completed).length,
    total: rows.length,
    selected,
    available: rows.filter((tech) => tech.available).length,
  };
}

export function archiveObjectiveRows(state) {
  const current = normalizeState(state);
  const research = researchSummary(current);
  const alive = current.party.filter((member) => Number(member.hp || 0) > 0).length;
  const books = Number(current.inventory.book_craft_guide || 0) + Number(current.inventory.book_camp_manual || 0);
  const facilities = Number(current.camp.archiveRoomLevel || 0)
    + Number(current.camp.scribeDeskLevel || 0)
    + Number(current.camp.libraryShelfLevel || 0);
  return [
    {
      id: 'survive',
      label: '생존일',
      current: current.day,
      target: ARCHIVE_VICTORY_DAY,
      done: current.day >= ARCHIVE_VICTORY_DAY,
    },
    {
      id: 'research',
      label: '연구',
      current: research.completed,
      target: research.total,
      done: research.completed >= research.total,
    },
    {
      id: 'facilities',
      label: '기록 시설',
      current: facilities,
      target: 3,
      done: facilities >= 3,
    },
    {
      id: 'books',
      label: '책',
      current: books,
      target: 2,
      done: Number(current.inventory.book_craft_guide || 0) > 0 && Number(current.inventory.book_camp_manual || 0) > 0,
    },
    {
      id: 'survivors',
      label: '생존 파티',
      current: alive,
      target: 3,
      done: alive >= 3,
    },
  ];
}

export function archiveVictorySummary(state) {
  const current = normalizeState(state);
  const rows = archiveObjectiveRows(current);
  const completed = rows.filter((row) => row.done).length;
  return {
    rows,
    completed,
    total: rows.length,
    canComplete: completed === rows.length && !current.ended,
    victory: Boolean(current.victory),
    label: current.victory ? '아카이브 완성' : `${completed}/${rows.length}`,
  };
}

export function scoreState(state) {
  const hp = averageParty(state, 'hp');
  const hunger = averageParty(state, 'hunger');
  const research = researchSummary(state);
  const preset = difficultyPreset(state);
  const equipmentCount = Object.values(normalizeEquipment(state.equipment, state.party)).reduce((sum, slots) => (
    sum + Object.values(slots || {}).filter(Boolean).length
  ), 0);
  return Math.max(0, Math.round(
    (state.day * 120
    + Number(state.counters.gather || 0) * 18
    + Number(state.counters.hunt || 0) * 48
    + Number(state.counters.craft || 0) * 34
    + Number(state.camp.fireLevel || 0) * 80
    + Number(state.camp.shelterLevel || 0) * 90
    + Number(state.camp.workbenchLevel || 0) * 70
    + Number(state.camp.archiveRoomLevel || 0) * 95
    + Number(state.camp.scribeDeskLevel || 0) * 90
    + Number(state.camp.libraryShelfLevel || 0) * 105
    + research.completed * 120
    + equipmentCount * 45
    + partyInsulation(state) * 35
    + (state.victory ? 700 : 0)
    + hp * 2
    + (100 - hunger))
    * preset.scoreMultiplier
  ));
}

export function getPlayTimeSec(state) {
  const start = new Date(state.startedAt || '').getTime();
  if (!Number.isFinite(start)) return 0;
  return Math.max(0, Math.floor((Date.now() - start) / 1000));
}

export function summaryForState(state) {
  const preset = difficultyPreset(state);
  const victory = archiveVictorySummary(state);
  const archiveReport = archiveCompletionReportForState(state);
  return {
    day: state.day,
    difficulty: preset.label,
    hp: averageParty(state, 'hp'),
    hunger: averageParty(state, 'hunger'),
    bodyTemp: averageBodyTemp(state),
    ap: state.ap,
    camp: `불 ${state.camp.fireLevel} / 대피소 ${state.camp.shelterLevel} / 작업대 ${state.camp.workbenchLevel} / 기록실 ${state.camp.archiveRoomLevel || 0} / 필사대 ${state.camp.scribeDeskLevel || 0} / 서가 ${state.camp.libraryShelfLevel || 0}`,
    research: `${researchSummary(state).completed}/${TECH_TREE.length}`,
    objectives: `${victory.completed}/${victory.total}`,
    victory: victory.victory,
    perkPoints: Number(state.meta?.perkPoints || 0),
    weight: totalCarryWeight(state),
    insulation: partyInsulation(state),
    score: scoreState(state),
    archiveReport: archiveReport.recordSummary,
  };
}

export function getRunProgressReport(state) {
  const current = normalizeState(state);
  const victory = archiveVictorySummary(current);
  const research = researchSummary(current);
  const hp = averageParty(current, 'hp');
  const hunger = averageParty(current, 'hunger');
  const stamina = averageParty(current, 'stamina');
  const bodyTemp = averageBodyTemp(current);
  const foodUnits = ['berry', 'meat', 'cooked_meat', 'jerky', 'herb_tonic']
    .reduce((sum, id) => sum + Number(current.inventory[id] || 0), 0);
  const fuel = Number(current.camp.fuel || 0);
  const weight = totalCarryWeight(current);
  const insulation = partyInsulation(current);
  const pendingObjectives = victory.rows.filter((row) => !row.done);
  const objectivePct = victory.total ? Math.round((victory.completed / victory.total) * 100) : 0;
  const daysLeft = Math.max(0, ARCHIVE_VICTORY_DAY - Number(current.day || 1));
  let riskScore = 0;
  if (hp < 55) riskScore += 3;
  else if (hp < 75) riskScore += 1;
  if (hunger > 70) riskScore += 3;
  else if (hunger > 45) riskScore += 1;
  if (stamina < 35) riskScore += 2;
  else if (stamina < 55) riskScore += 1;
  if (bodyTemp < 35.6 || bodyTemp > 38.5) riskScore += 2;
  if (foodUnits <= current.party.length) riskScore += 2;
  if (fuel <= 1 && current.weather.temp <= 8) riskScore += 2;
  if (current.ap <= 1 && pendingObjectives.length >= 3) riskScore += 1;

  const riskLevel = riskScore >= 7 ? '위험' : riskScore >= 4 ? '주의' : '안정';
  const riskTone = riskScore >= 7 ? 'danger' : riskScore >= 4 ? 'warning' : 'stable';
  const blockers = [];
  if (foodUnits <= current.party.length) blockers.push(`식량 ${foodUnits}개`);
  if (fuel <= 1) blockers.push(`연료 ${fuel}`);
  if (research.selected && !research.selected.completed) {
    blockers.push(`연구 ${research.selected.name} ${research.selected.progress}/${research.selected.cost}`);
  }
  if (weight >= 24) blockers.push(`무게 ${weight}`);
  if (insulation < Math.max(2, Math.ceil((12 - current.weather.temp) / 3))) blockers.push(`보온 ${insulation}`);

  const recommendations = [];
  if (hp < 65 || stamina < 45) recommendations.push('파티 회복을 위해 휴식 우선');
  if (foodUnits <= current.party.length + 1) recommendations.push('식량 확보를 위해 채집/사냥 우선');
  if (fuel <= 1 || bodyTemp < 36) recommendations.push('연료 확보 후 모닥불 유지');
  if (research.available && research.selected && !research.selected.completed) recommendations.push(`${research.selected.name} 연구 진행`);
  if (pendingObjectives.some((row) => row.id === 'facilities')) recommendations.push('기록 시설 제작 재료 확보');
  if (pendingObjectives.some((row) => row.id === 'books')) recommendations.push('책 제작 루트 점검');
  if (!recommendations.length) recommendations.push(victory.canComplete ? '아카이브 완성 가능' : '현재 운영 유지');

  return {
    objectivePct,
    objectiveLabel: `${victory.completed}/${victory.total}`,
    daysLeft,
    riskLevel,
    riskTone,
    riskScore,
    foodUnits,
    fuel,
    insulation,
    weight,
    pendingObjectives: pendingObjectives.map((row) => row.label),
    blockers: blockers.slice(0, 5),
    recommendations: [...new Set(recommendations)].slice(0, 4),
    headline: victory.victory
      ? '아카이브가 완성된 런입니다.'
      : victory.canComplete
        ? '목표 조건이 모두 충족됐습니다. 아카이브 완성을 누르세요.'
        : `${daysLeft}일 생존 목표까지 남았고, 현재 위험도는 ${riskLevel}입니다.`,
  };
}

function archiveReportStatus(done, victory, ended) {
  if (victory) return '완성';
  if (ended) return done ? '정산 완료' : '미완성';
  return done ? '완성 가능' : '진행 중';
}

export function archiveCompletionReportForState(state) {
  const current = normalizeState(state);
  const victory = archiveVictorySummary(current);
  const research = researchSummary(current);
  const objectives = archiveObjectiveRows(current);
  const hp = averageParty(current, 'hp');
  const hunger = averageParty(current, 'hunger');
  const stamina = averageParty(current, 'stamina');
  const score = scoreState(current);
  const facilities = Number(current.camp.archiveRoomLevel || 0)
    + Number(current.camp.scribeDeskLevel || 0)
    + Number(current.camp.libraryShelfLevel || 0);
  const books = Number(current.inventory.book_craft_guide || 0) + Number(current.inventory.book_camp_manual || 0);
  const equipmentCount = equipmentInventoryRows(current).reduce((sum, row) => sum + Number(row.qty || 0), 0);
  const objectivePct = victory.total ? Math.round((victory.completed / victory.total) * 100) : 0;
  const researchPct = research.total ? Math.round((research.completed / research.total) * 100) : 0;
  const survivalPct = Math.min(100, Math.round((Number(current.day || 1) / ARCHIVE_VICTORY_DAY) * 100));
  const stabilityPct = Math.round(clamp((hp * 0.45) + ((100 - hunger) * 0.25) + (stamina * 0.2) + Math.min(10, partyInsulation(current) * 2), 0, 100));
  const archiveScore = Math.round(clamp(
    objectivePct * 0.34
      + researchPct * 0.22
      + survivalPct * 0.18
      + stabilityPct * 0.14
      + Math.min(100, facilities * 30 + books * 5) * 0.08
      + Math.min(100, score / 28) * 0.04,
    0,
    100,
  ));
  const grade = archiveScore >= 95 ? 'S'
    : archiveScore >= 85 ? 'A'
      : archiveScore >= 70 ? 'B'
        : archiveScore >= 50 ? 'C'
          : 'D';
  const chapters = [
    {
      id: 'survival',
      title: '생존 기록',
      pct: survivalPct,
      status: archiveReportStatus(current.day >= ARCHIVE_VICTORY_DAY, victory.victory, current.ended),
      detail: `Day ${current.day}, 생존 파티 ${current.party.filter((member) => Number(member.hp || 0) > 0).length}/${current.party.length}, 평균 체온 ${averageBodyTemp(current).toFixed(1)}도입니다.`,
    },
    {
      id: 'research',
      title: '연구 기록',
      pct: researchPct,
      status: archiveReportStatus(research.completed >= research.total, victory.victory, current.ended),
      detail: `연구 ${research.completed}/${research.total}, 선택 기술 ${research.selected?.name || '없음'}입니다.`,
    },
    {
      id: 'facilities',
      title: '기록 시설',
      pct: Math.min(100, Math.round((facilities / 3) * 100)),
      status: archiveReportStatus(facilities >= 3, victory.victory, current.ended),
      detail: `기록실 Lv.${Number(current.camp.archiveRoomLevel || 0)}, 필사대 Lv.${Number(current.camp.scribeDeskLevel || 0)}, 서가 Lv.${Number(current.camp.libraryShelfLevel || 0)}입니다.`,
    },
    {
      id: 'books',
      title: '문자/책 보존',
      pct: Math.min(100, Math.round((books / 2) * 100)),
      status: archiveReportStatus(books >= 2, victory.victory, current.ended),
      detail: `제작 안내서 ${Number(current.inventory.book_craft_guide || 0)}권, 야영 매뉴얼 ${Number(current.inventory.book_camp_manual || 0)}권입니다.`,
    },
    {
      id: 'party',
      title: '파티와 장비',
      pct: stabilityPct,
      status: archiveReportStatus(stabilityPct >= 70, victory.victory, current.ended),
      detail: `평균 HP ${hp}, 허기 ${hunger}, 스태미나 ${stamina}, 보온 ${partyInsulation(current)}, 장비 ${equipmentCount}개입니다.`,
    },
  ];
  const handoff = [];
  if (!victory.victory && victory.canComplete) handoff.push('아카이브 완성을 눌러 완성 기록서를 확정하세요.');
  if (!victory.canComplete && !current.ended) {
    const pending = objectives.filter((row) => !row.done).map((row) => row.label);
    handoff.push(`남은 목표: ${pending.join(', ') || '없음'}`);
  }
  if (current.ended && !victory.victory) handoff.push('정산된 미완성 런입니다. 특전으로 다음 런을 강화하세요.');
  if (victory.victory) handoff.push('완성 런입니다. 전적 기록 후 새 런에서 특전을 이어받으세요.');
  if (Number(current.meta?.perkPoints || 0) > 0) handoff.push(`사용 가능 특전 ${Number(current.meta.perkPoints || 0)}pt가 있습니다.`);

  return {
    status: victory.victory ? 'complete' : current.ended ? 'settled' : victory.canComplete ? 'ready' : 'active',
    title: victory.victory ? '원시 아카이브 완성본' : victory.canComplete ? '완성 대기 기록서' : current.ended ? '탐험 정산 기록서' : '탐험 진행 기록서',
    grade,
    archiveScore,
    objectivePct,
    score,
    chapters,
    handoff: handoff.slice(0, 4),
    recordSummary: {
      day: current.day,
      grade,
      archiveScore,
      objectivePct,
      researchPct,
      survivalPct,
      stabilityPct,
      victory: victory.victory,
      score,
    },
  };
}

export function formatRequires(requires) {
  return Object.entries(requires).map(([id, qty]) => `${itemName(id)} ${qty}`).join(', ');
}

export function campFacilityRows(state) {
  const current = normalizeState(state);
  const facilities = [
    {
      id: 'archive_room',
      action: 'archive',
      name: '기록실',
      desc: `로그 저장량 ${BASE_LOG_LIMIT} -> ${BASE_LOG_LIMIT + ARCHIVE_LOG_LIMIT_BONUS}, 일일 연구 +1`,
      level: Number(current.camp.archiveRoomLevel || 0),
      maxLevel: 1,
      cost: { wood: 5, stone: 3, fiber: 3, hide: 1 },
      unlocked: hasTechCampUnlock(current, 'archive_room'),
      buildLabel: '기록실 짓기',
      maxedLabel: '기록실 완성',
      lockedLabel: '기록실 잠김 · 기록 보관 연구 필요',
    },
    {
      id: 'scribe_desk',
      action: 'scribe',
      name: '필사대',
      desc: '일일 연구 +1, 연구 행동 피로 -1',
      level: Number(current.camp.scribeDeskLevel || 0),
      maxLevel: 1,
      cost: { wood: 2, stone: 2, clay: 2, fiber: 2 },
      unlocked: hasTechCampUnlock(current, 'scribe_desk'),
      buildLabel: '필사대 만들기',
      maxedLabel: '필사대 완성',
      lockedLabel: '필사대 잠김 · 문자 연구 필요',
    },
    {
      id: 'library_shelf',
      action: 'library',
      name: '서가',
      desc: '일일 연구 +1, 책 보너스 강화, 기록 점수 증가',
      level: Number(current.camp.libraryShelfLevel || 0),
      maxLevel: 1,
      cost: { wood: 4, fiber: 4, resin: 2, clay: 2 },
      unlocked: hasTechCampUnlock(current, 'library_shelf'),
      buildLabel: '서가 세우기',
      maxedLabel: '서가 완성',
      lockedLabel: '서가 잠김 · 서가 정리 연구 필요',
    },
  ];
  return facilities.map((facility) => ({
    ...facility,
    maxed: facility.level >= facility.maxLevel,
    costText: formatRequires(facility.cost),
    buttonLabel: facility.level >= facility.maxLevel
      ? facility.maxedLabel
      : facility.unlocked
        ? `${facility.buildLabel} · ${formatRequires(facility.cost)}`
        : facility.lockedLabel,
  }));
}

export function formatGains(entries) {
  if (!entries.length) return '획득 없음';
  return entries.map(([id, qty]) => `${itemName(id)} +${qty}`).join(', ');
}

function rollZoneGains(entries, rng = Math.random) {
  return entries.reduce((gains, [id, qty, chance = 1]) => {
    if (rng() > chance) return gains;
    gains.push([id, qty + (rng() < 0.18 ? 1 : 0)]);
    return gains;
  }, []);
}

export function runGatherAction(state, actorId, zoneId, options = {}) {
  const zone = ZONES.find((row) => row.id === zoneId) || ZONES[0];
  const actor = getActor(state, actorId);
  const chance = actionChance(state, actorId, 'gather', 0.5);
  const ok = (options.rng || Math.random)() < chance;
  let next = state;
  if (ok) {
    const gains = rollZoneGains(zone.gather, options.rng || Math.random);
    next = {
      ...next,
      inventory: addItems(next.inventory, gains),
      counters: { ...next.counters, gather: Number(next.counters.gather || 0) + 1 },
    };
    next = addLog(next, `${actor.name}의 채집 성공. ${zone.name}에서 ${formatGains(gains)}.`);
  } else {
    next = addLog(next, `${actor.name}의 채집 실패. ${zone.name}의 날씨와 지형이 좋지 않았습니다.`);
  }
  next = addDialogueLog(next, actorId, 'gather', ok ? 'success' : 'fail', options.rng || Math.random);
  next = applyExplorationEvent(next, { actorId, action: 'gather', zoneId: zone.id, ok, rng: options.rng || Math.random });
  return afterAction(recordResearchEvent(next, { kind: 'action', action: 'gather', ok }), actorId, staminaCostWithEquipment(state, actorId, 'gather', 15), 3, options);
}

export function runHuntAction(state, actorId, zoneId, options = {}) {
  const zone = ZONES.find((row) => row.id === zoneId) || ZONES[0];
  const actor = getActor(state, actorId);
  const chance = actionChance(state, actorId, 'hunt', 0.42);
  const ok = (options.rng || Math.random)() < chance;
  let next = state;
  if (ok) {
    const gains = rollZoneGains(zone.hunt, options.rng || Math.random);
    next = {
      ...next,
      inventory: addItems(next.inventory, gains),
      counters: { ...next.counters, hunt: Number(next.counters.hunt || 0) + 1 },
    };
    next = addLog(next, `${actor.name}의 사냥 성공. ${formatGains(gains)}.`);
  } else {
    const target = getActor(next, actorId);
    const damage = hasTechPassive(next, 'HUNT_RISK_DOWN') ? 7 : 11;
    next = updateActor(next, actorId, { hp: clamp(Number(target.hp || 0) - damage, 0, 100) });
    next = addLog(next, `${actor.name}의 사냥 실패. 반격으로 HP -${damage}.`);
  }
  next = addDialogueLog(next, actorId, 'hunt', ok ? 'success' : 'fail', options.rng || Math.random);
  next = applyExplorationEvent(next, { actorId, action: 'hunt', zoneId: zone.id, ok, rng: options.rng || Math.random });
  return afterAction(recordResearchEvent(next, { kind: 'action', action: 'hunt', ok }), actorId, staminaCostWithEquipment(state, actorId, 'hunt', 24), 5, options);
}

export function runCraftAction(state, actorId, recipeId, options = {}) {
  const recipe = RECIPES.find((row) => row.id === recipeId) || RECIPES[0];
  const actor = getActor(state, actorId);
  if (recipe.id.startsWith('book_') && !hasTechPassive(state, 'BOOK_SYSTEM_UNLOCK')) {
    return addLog(state, `${recipe.name}은(는) 문자 연구 후 제작할 수 있습니다.`);
  }
  if (recipe.id.startsWith('book_') && !hasTechPassive(state, 'BOOK_BONUS_UP')) {
    return addLog(state, `${recipe.name}은(는) 책 제작 연구 후 제작할 수 있습니다.`);
  }
  if (!hasResources(state.inventory, recipe.requires)) {
    return addLog(state, `${recipe.name} 제작 재료가 부족합니다. 필요: ${formatRequires(recipe.requires)}.`);
  }
  const chance = actionChance(state, actorId, 'craft', recipe.baseChance - 0.18);
  const ok = (options.rng || Math.random)() < chance;
  let next = { ...state, inventory: spendResources(state.inventory, recipe.requires) };
  if (ok) {
    next = {
      ...next,
      inventory: addItems(next.inventory, Object.entries(recipe.reward)),
      counters: { ...next.counters, craft: Number(next.counters.craft || 0) + 1 },
    };
    next = addLog(next, `${actor.name}의 제작 성공. ${recipe.name}을(를) 만들었습니다.`);
    next = recordResearchEvent(next, { kind: 'recipe', recipeId: recipe.id, ok: true });
  } else {
    next = addLog(next, `${actor.name}의 제작 실패. 일부 재료를 잃었습니다.`);
  }
  next = addDialogueLog(next, actorId, 'craft', ok ? 'success' : 'fail', options.rng || Math.random);
  next = applyExplorationEvent(next, { actorId, action: 'craft', ok, recipe, rng: options.rng || Math.random });
  return afterAction(recordResearchEvent(next, { kind: 'action', action: 'craft', ok }), actorId, staminaCostWithEquipment(state, actorId, 'craft', 20), 4, options);
}

export function runEatAction(state, actorId, options = {}) {
  const actor = getActor(state, actorId);
  const foodId = ['cooked_meat', 'jerky', 'meat', 'berry', 'herb_tonic']
    .find((id) => ITEMS[id]?.type === 'food' && Number(state.inventory[id] || 0) > 0) || '';
  if (!foodId) return addLog(state, '먹을 음식이 없습니다. 채집이나 사냥으로 식량을 확보하세요.');
  const food = ITEMS[foodId];
  const nutrition = Number(food.nutrition || 0);
  const heal = Number(food.heal || 0);
  const warmth = foodId === 'cooked_meat' ? 1.1 : foodId === 'herb_tonic' ? 0.8 : 0;
  const target = getActor(state, actorId);
  let next = {
    ...state,
    inventory: spendResources(state.inventory, { [foodId]: 1 }),
    counters: { ...state.counters, meals: Number(state.counters.meals || 0) + 1 },
  };
  next = updateActor(next, actorId, {
    hunger: clamp(Number(target.hunger || 0) - nutrition, 0, 100),
    hp: clamp(Number(target.hp || 0) + heal, 0, 100),
    bodyTemp: clamp(Number(target.bodyTemp ?? 37) + warmth, 25, 39),
  });
  next = addLog(next, `${actor.name}이(가) ${itemName(foodId)}을(를) 먹었습니다. 허기 -${nutrition}, HP +${heal}${warmth ? `, 체온 +${warmth.toFixed(1)}` : ''}.`);
  next = addDialogueLog(next, actorId, 'eat', 'success', options.rng || Math.random);
  return afterAction(next, actorId, staminaCostWithEquipment(state, actorId, 'eat', 6), 0, options);
}

export function runRestAction(state, actorId, options = {}) {
  const actor = getActor(state, actorId);
  const target = getActor(state, actorId);
  const heal = hasTechPassive(state, 'REST_HEAL_UP') ? 8 : 4;
  const warmth = Number(state.camp.fireLevel || 0) > 0 && Number(state.camp.fuel || 0) > 0 ? 0.75 : 0.25;
  let next = updateActor(state, actorId, {
    stamina: clamp(Number(target.stamina || 0) + 42 + Number(state.camp.shelterLevel || 0) * 8, 0, 100),
    hp: clamp(Number(target.hp || 0) + heal, 0, 100),
    bodyTemp: clamp(Number(target.bodyTemp ?? 37) + warmth, 25, 39),
  });
  next = addLog(next, `${actor.name}이(가) 휴식했습니다. 스태미나와 HP를 회복하고 체온을 안정시켰습니다.`);
  next = addDialogueLog(next, actorId, 'rest', 'success', options.rng || Math.random);
  next.ap = Math.max(0, Number(next.ap || 0) - 1);
  if (next.ap <= 0 && !next.ended) next = advanceDay(next, options);
  return next;
}

export function runCampAction(state, actorId, kind, options = {}) {
  const actor = getActor(state, actorId);
  let next = state;
  if (kind === 'fuel') {
    if (!hasResources(next.inventory, { wood: 1 })) return addLog(next, '연료로 넣을 나무가 부족합니다.');
    next = { ...next, inventory: spendResources(next.inventory, { wood: 1 }), camp: { ...next.camp, fuel: Number(next.camp.fuel || 0) + 2 } };
    next = addLog(next, `${actor.name}이(가) 모닥불 연료를 보충했습니다. 연료 +2.`);
  }
  if (kind === 'fire') {
    if (!hasResources(next.inventory, { wood: 2, stone: 2 })) return addLog(next, '모닥불 업그레이드 재료가 부족합니다.');
    next = { ...next, inventory: spendResources(next.inventory, { wood: 2, stone: 2 }), camp: { ...next.camp, fireLevel: clamp(Number(next.camp.fireLevel || 0) + 1, 0, 3) } };
    next = addLog(next, `${actor.name}이(가) 모닥불을 업그레이드했습니다. Lv.${next.camp.fireLevel}.`);
  }
  if (kind === 'shelter') {
    if (!hasResources(next.inventory, { wood: 3, fiber: 2, hide: 1 })) return addLog(next, '대피소 재료가 부족합니다.');
    next = { ...next, inventory: spendResources(next.inventory, { wood: 3, fiber: 2, hide: 1 }), camp: { ...next.camp, shelterLevel: clamp(Number(next.camp.shelterLevel || 0) + 1, 0, 3) } };
    next = addLog(next, `${actor.name}이(가) 대피소를 보강했습니다. Lv.${next.camp.shelterLevel}.`);
  }
  if (kind === 'workbench') {
    if (!hasResources(next.inventory, { wood: 4, stone: 2 })) return addLog(next, '작업대 재료가 부족합니다.');
    next = { ...next, inventory: spendResources(next.inventory, { wood: 4, stone: 2 }), camp: { ...next.camp, workbenchLevel: clamp(Number(next.camp.workbenchLevel || 0) + 1, 0, 2) } };
    next = addLog(next, `${actor.name}이(가) 작업대를 만들었습니다. Lv.${next.camp.workbenchLevel}.`);
  }
  if (kind === 'archive') {
    if (!hasTechCampUnlock(next, 'archive_room')) return addLog(next, '기록실은 기록 보관 연구를 완료한 뒤 지을 수 있습니다.');
    if (Number(next.camp.archiveRoomLevel || 0) >= 1) return addLog(next, '기록실은 이미 완성되어 있습니다.');
    if (!hasResources(next.inventory, { wood: 5, stone: 3, fiber: 3, hide: 1 })) return addLog(next, '기록실 재료가 부족합니다.');
    next = {
      ...next,
      inventory: spendResources(next.inventory, { wood: 5, stone: 3, fiber: 3, hide: 1 }),
      camp: { ...next.camp, archiveRoomLevel: 1 },
    };
    next = addLog(next, `${actor.name}이(가) 기록실을 세웠습니다. 로그 저장량과 일일 연구가 증가합니다.`);
  }
  if (kind === 'scribe') {
    if (!hasTechCampUnlock(next, 'scribe_desk')) return addLog(next, '필사대는 문자 연구를 완료한 뒤 만들 수 있습니다.');
    if (Number(next.camp.scribeDeskLevel || 0) >= 1) return addLog(next, '필사대는 이미 완성되어 있습니다.');
    if (!hasResources(next.inventory, { wood: 2, stone: 2, clay: 2, fiber: 2 })) return addLog(next, '필사대 재료가 부족합니다.');
    next = {
      ...next,
      inventory: spendResources(next.inventory, { wood: 2, stone: 2, clay: 2, fiber: 2 }),
      camp: { ...next.camp, scribeDeskLevel: 1 },
    };
    next = addLog(next, `${actor.name}이(가) 필사대를 만들었습니다. 연구 행동과 일일 연구가 강화됩니다.`);
  }
  if (kind === 'library') {
    if (!hasTechCampUnlock(next, 'library_shelf')) return addLog(next, '서가는 서가 정리 연구를 완료한 뒤 세울 수 있습니다.');
    if (Number(next.camp.libraryShelfLevel || 0) >= 1) return addLog(next, '서가는 이미 완성되어 있습니다.');
    if (!hasResources(next.inventory, { wood: 4, fiber: 4, resin: 2, clay: 2 })) return addLog(next, '서가 재료가 부족합니다.');
    next = {
      ...next,
      inventory: spendResources(next.inventory, { wood: 4, fiber: 4, resin: 2, clay: 2 }),
      camp: { ...next.camp, libraryShelfLevel: 1 },
    };
    next = addLog(next, `${actor.name}이(가) 서가를 세웠습니다. 책 보너스와 일일 연구가 강화됩니다.`);
  }
  if (kind === 'cook') {
    if (Number(next.camp.fireLevel || 0) <= 0 || Number(next.camp.fuel || 0) <= 0) return addLog(next, '고기를 구우려면 모닥불과 연료가 필요합니다.');
    if (!hasResources(next.inventory, { meat: 1 })) return addLog(next, '구울 고기가 없습니다.');
    next = {
      ...next,
      inventory: addItems(spendResources(next.inventory, { meat: 1 }), [['cooked_meat', 1]]),
      camp: { ...next.camp, fuel: Math.max(0, Number(next.camp.fuel || 0) - 1) },
    };
    next = addLog(next, `${actor.name}이(가) 고기를 구웠습니다. 구운 고기 +1.`);
  }
  next = addDialogueLog(next, actorId, 'camp', 'success', options.rng || Math.random);
  next = applyExplorationEvent(next, { actorId, action: 'camp', ok: true, rng: options.rng || Math.random });
  next.counters = { ...next.counters, camp: Number(next.counters.camp || 0) + 1 };
  const campStaminaCost = Math.max(5, staminaCostWithEquipment(state, actorId, 'camp', 14) - bookCampStaminaReduction(next));
  return afterAction(recordResearchEvent(next, { kind: 'camp', campKind: kind }), actorId, campStaminaCost, 2, options);
}

function livingParty(state) {
  return state.party.filter((member) => Number(member.hp || 0) > 0);
}

function foodAvailable(state) {
  return ['cooked_meat', 'jerky', 'meat', 'berry', 'herb_tonic']
    .some((id) => Number(state.inventory[id] || 0) > 0);
}

function pickActorForAuto(state, action = 'gather') {
  const candidates = livingParty(state);
  if (!candidates.length) return state.party[0]?.id || '';
  return candidates
    .map((member) => {
      const stamina = Number(member.stamina || 0);
      const hp = Number(member.hp || 0);
      const hungerSafety = 100 - Number(member.hunger || 0);
      return {
        id: member.id,
        score: actionChance(state, member.id, action, action === 'hunt' ? 0.42 : action === 'craft' ? 0.5 : 0.5) * 120
          + stamina * 0.28
          + hp * 0.16
          + hungerSafety * 0.1,
      };
    })
    .sort((a, b) => b.score - a.score)[0].id;
}

function pickAutoCareActor(state) {
  const candidates = livingParty(state);
  if (!candidates.length) return state.party[0]?.id || '';
  return candidates
    .map((member) => ({
      id: member.id,
      score: Number(member.hunger || 0) * 1.6
        + Math.max(0, 55 - Number(member.hp || 0)) * 1.25
        + Math.max(0, 45 - Number(member.stamina || 0))
        + Math.max(0, 35.2 - Number(member.bodyTemp ?? 37)) * 20,
    }))
    .sort((a, b) => b.score - a.score)[0].id;
}

function autoRecipeAllowed(state, recipe) {
  if (!recipe || !hasResources(state.inventory, recipe.requires)) return false;
  if (recipe.id.startsWith('book_') && !hasTechPassive(state, 'BOOK_SYSTEM_UNLOCK')) return false;
  if (recipe.id.startsWith('book_') && !hasTechPassive(state, 'BOOK_BONUS_UP')) return false;
  return true;
}

function pickAutoRecipe(state) {
  const priority = [
    'jerky',
    'herb_tonic',
    'twine',
    'stone_axe',
    'bow',
    'flint_knife',
    'bone_pick',
    'spear',
    'sling',
    'atlatl',
    'leather_strip',
    'hide_coat',
    'hide_pants',
    'shoes_leather',
    'hat_fur',
    'gloves',
    'earmuffs',
    'socks',
    'arm_warmers',
    'leggings',
    'pauldron',
    'fur_coat',
    'fur_pants',
    'fur_hat',
    'fur_boots',
    'fur_earmuffs',
    'fur_socks',
    'fur_gloves',
    'charm',
    'hunter_talisman',
    'crafter_amulet',
    'gatherer_charm',
    'book_craft_guide',
    'book_camp_manual',
  ];
  return priority
    .map((id) => RECIPES.find((recipe) => recipe.id === id))
    .find((recipe) => autoRecipeAllowed(state, recipe)) || null;
}

function pickAutoCampKind(state) {
  if (Number(state.camp.fireLevel || 0) > 0 && Number(state.camp.fuel || 0) > 0 && hasResources(state.inventory, { meat: 1 })) return 'cook';
  if (Number(state.camp.fireLevel || 0) > 0 && Number(state.camp.fuel || 0) < 2 && hasResources(state.inventory, { wood: 1 })) return 'fuel';
  if (Number(state.camp.fireLevel || 0) < 1 && hasResources(state.inventory, { wood: 2, stone: 2 })) return 'fire';
  if (Number(state.camp.shelterLevel || 0) < 1 && hasResources(state.inventory, { wood: 3, fiber: 2, hide: 1 })) return 'shelter';
  if (Number(state.camp.workbenchLevel || 0) < 1 && hasResources(state.inventory, { wood: 4, stone: 2 })) return 'workbench';
  if (hasTechCampUnlock(state, 'archive_room') && Number(state.camp.archiveRoomLevel || 0) < 1 && hasResources(state.inventory, { wood: 5, stone: 3, fiber: 3, hide: 1 })) return 'archive';
  if (hasTechCampUnlock(state, 'scribe_desk') && Number(state.camp.scribeDeskLevel || 0) < 1 && hasResources(state.inventory, { wood: 2, stone: 2, clay: 2, fiber: 2 })) return 'scribe';
  if (hasTechCampUnlock(state, 'library_shelf') && Number(state.camp.libraryShelfLevel || 0) < 1 && hasResources(state.inventory, { wood: 4, fiber: 4, resin: 2, clay: 2 })) return 'library';
  if (Number(state.camp.fireLevel || 0) < 3 && hasResources(state.inventory, { wood: 2, stone: 2 })) return 'fire';
  if (Number(state.camp.shelterLevel || 0) < 3 && hasResources(state.inventory, { wood: 3, fiber: 2, hide: 1 })) return 'shelter';
  if (Number(state.camp.workbenchLevel || 0) < 2 && hasResources(state.inventory, { wood: 4, stone: 2 })) return 'workbench';
  return '';
}

function pickAutoZone(state, action) {
  if (action === 'hunt') {
    if (Number(state.inventory.meat || 0) < 2) return 'plains';
    if (Number(state.inventory.tooth || 0) < 1 || Number(state.inventory.sinew || 0) < 1) return 'forest';
    return 'cave';
  }
  if (Number(state.inventory.wood || 0) < 5 || Number(state.inventory.fiber || 0) < 5) return 'forest';
  if (Number(state.inventory.stone || 0) < 5 || Number(state.inventory.clay || 0) < 2 || Number(state.inventory.herb || 0) < 2) return 'river';
  if (Number(state.inventory.flint || 0) < 2 || Number(state.inventory.obsidian_shard || 0) < 1) return 'cave';
  return 'plains';
}

function autoActionSignature(state) {
  return [
    state.day,
    state.ap,
    state.log.length,
    averageParty(state, 'hp'),
    averageParty(state, 'hunger'),
    averageParty(state, 'stamina'),
    Object.entries(state.inventory).reduce((sum, [, qty]) => sum + Number(qty || 0), 0),
  ].join(':');
}

function runNextAutoArchiveAction(state, options = {}) {
  const careActorId = pickAutoCareActor(state);
  const careActor = getActor(state, careActorId);
  const averageHunger = averageParty(state, 'hunger');
  const foodStock = Number(state.inventory.meat || 0)
    + Number(state.inventory.berry || 0)
    + Number(state.inventory.jerky || 0)
    + Number(state.inventory.cooked_meat || 0);
  if (foodAvailable(state) && (Number(careActor?.hunger || 0) >= 52 || averageHunger >= 50)) {
    return runEatAction(state, careActorId, options);
  }
  if (!foodAvailable(state) && averageHunger >= 70 && Number(careActor?.hp || 0) > 20) {
    return runGatherAction(state, pickActorForAuto(state, 'gather'), 'forest', options);
  }
  if (Number(careActor?.hp || 0) <= 45 || Number(careActor?.stamina || 0) <= 28 || Number(careActor?.bodyTemp ?? 37) <= 34.4) {
    return runRestAction(state, careActorId, options);
  }

  if (averageHunger >= 55 && foodStock < state.party.length + 2) {
    if (averageParty(state, 'hp') < 55) {
      return runGatherAction(state, pickActorForAuto(state, 'gather'), 'forest', options);
    }
    return runHuntAction(state, pickActorForAuto(state, 'hunt'), pickAutoZone(state, 'hunt'), options);
  }

  const campKind = pickAutoCampKind(state);
  if (campKind) return runCampAction(state, pickActorForAuto(state, 'craft'), campKind, options);

  const recipe = pickAutoRecipe(state);
  if (recipe && (Number(state.counters?.craft || 0) < Number(state.counters?.gather || 0) + 2 || recipe.id.startsWith('book_'))) {
    return runCraftAction(state, pickActorForAuto(state, 'craft'), recipe.id, options);
  }

  const research = researchSummary(state);
  if (research.selected && !research.selected.completed && Number(state.day || 1) >= 2) {
    return runResearchAction(state, pickActorForAuto(state, 'craft'), options);
  }

  if (foodStock < state.party.length + 1) {
    return runHuntAction(state, pickActorForAuto(state, 'hunt'), pickAutoZone(state, 'hunt'), options);
  }
  return runGatherAction(state, pickActorForAuto(state, 'gather'), pickAutoZone(state, 'gather'), options);
}

export function runAutoDayAction(state, options = {}) {
  let next = normalizeState(state);
  const hasEquipmentPool = Object.entries(buildEquipmentPool(next))
    .some(([itemId, qty]) => Number(qty || 0) > 0 && ITEMS[itemId]?.type === 'equip');
  if (hasEquipmentPool) {
    next = autoEquipAction(next, Number(next.weather?.cold || 0) >= 5 ? 'weather' : 'role');
  }
  if (next.ended || Number(next.ap || 0) <= 0) return next;

  const startDay = next.day;
  let steps = 0;
  while (!next.ended && Number(next.ap || 0) > 0 && next.day === startDay && steps < 16) {
    const before = autoActionSignature(next);
    next = runNextAutoArchiveAction(next, options);
    steps += 1;
    if (autoActionSignature(next) === before) {
      next = runGatherAction(next, pickActorForAuto(next, 'gather'), pickAutoZone(next, 'gather'), options);
      steps += 1;
      if (autoActionSignature(next) === before) break;
    }
  }

  return addLog(next, `하루 자동 운영 완료: ${steps}회 행동 처리, Day ${next.day}, AP ${next.ap}/${next.apMax}.`);
}
