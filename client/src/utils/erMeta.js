// Eternal Return inspired meta rules for the spectator simulation.
// This is intentionally a systems model, not a verbatim live-data dump.

export const ER_WEAPON_TYPES_KO = [
  '권총',
  '돌격소총',
  '저격총',
  '글러브',
  '톤파',
  '쌍절곤',
  '아르카나',
  '양손검',
  '쌍검',
  '망치',
  '방망이',
  '채찍',
  '투척',
  '암기',
  '활',
  '석궁',
  '도끼',
  '단검',
  '창',
  '레이피어',
  '기타',
  '카메라',
];

const WEAPON_ALIASES = {
  pistol: '권총',
  handgun: '권총',
  'assault rifle': '돌격소총',
  assault_rifle: '돌격소총',
  rifle: '돌격소총',
  'sniper rifle': '저격총',
  sniper: '저격총',
  glove: '글러브',
  gloves: '글러브',
  knuckle: '글러브',
  tonfa: '톤파',
  nunchaku: '쌍절곤',
  arcana: '아르카나',
  sword: '양손검',
  'two-handed sword': '양손검',
  twohandsword: '양손검',
  dualswords: '쌍검',
  'dual swords': '쌍검',
  hammer: '망치',
  bat: '방망이',
  whip: '채찍',
  throw: '투척',
  throwing: '투척',
  shuriken: '암기',
  bow: '활',
  crossbow: '석궁',
  axe: '도끼',
  dagger: '단검',
  spear: '창',
  rapier: '레이피어',
  guitar: '기타',
  camera: '카메라',
  검: '양손검',
  권총: '권총',
  돌격소총: '돌격소총',
  저격총: '저격총',
  글러브: '글러브',
  장갑: '글러브',
  톤파: '톤파',
  쌍절곤: '쌍절곤',
  아르카나: '아르카나',
  양손검: '양손검',
  쌍검: '쌍검',
  망치: '망치',
  방망이: '방망이',
  채찍: '채찍',
  투척: '투척',
  암기: '암기',
  활: '활',
  석궁: '석궁',
  도끼: '도끼',
  단검: '단검',
  창: '창',
  레이피어: '레이피어',
  기타: '기타',
  카메라: '카메라',
};

const RANGED_WEAPONS = new Set(['권총', '돌격소총', '저격총', '아르카나', '투척', '암기', '활', '석궁', '기타', '카메라']);
const QUICK_WEAPONS = new Set(['권총', '돌격소총', '글러브', '쌍검', '단검', '레이피어', '기타']);
const HEAVY_WEAPONS = new Set(['저격총', '양손검', '망치', '방망이', '도끼', '창', '석궁']);

export const ER_WEAPON_MASTERY_MAX_LEVEL = 20;
export const ER_WEAPON_MASTERY_XP_PER_LEVEL = 24;

export function normalizeErWeaponType(raw) {
  const value = String(raw || '').trim();
  if (!value) return '';
  if (ER_WEAPON_TYPES_KO.includes(value)) return value;
  const key = value.toLowerCase().replace(/\s+/g, ' ').trim();
  return WEAPON_ALIASES[value] || WEAPON_ALIASES[key] || value;
}

export function isErRangedWeaponType(raw) {
  return RANGED_WEAPONS.has(normalizeErWeaponType(raw));
}

export function getErWeaponProfile(raw) {
  const weaponType = normalizeErWeaponType(raw);
  const ranged = isErRangedWeaponType(weaponType);
  return {
    weaponType,
    ranged,
    quick: QUICK_WEAPONS.has(weaponType),
    heavy: HEAVY_WEAPONS.has(weaponType),
    attackStat: ranged ? 'sht' : 'str',
  };
}

export function getWeaponMasteryLevel(character) {
  const explicit = Math.floor(Number(character?.weaponMasteryLevel || 0));
  const xp = Math.max(0, Math.floor(Number(character?.weaponMasteryXp || 0)));
  const fromXp = 1 + Math.floor(xp / ER_WEAPON_MASTERY_XP_PER_LEVEL);
  const level = explicit > 0 ? Math.max(explicit, fromXp) : fromXp;
  return Math.max(1, Math.min(ER_WEAPON_MASTERY_MAX_LEVEL, level));
}

export function addWeaponMasteryXp(character, amount = 0) {
  if (!character || typeof character !== 'object') return null;
  const gain = Math.max(0, Math.floor(Number(amount || 0)));
  if (gain <= 0) return null;
  const beforeLevel = getWeaponMasteryLevel(character);
  const beforeXp = Math.max(0, Math.floor(Number(character.weaponMasteryXp || 0)));
  const nextXp = beforeXp + gain;
  character.weaponMasteryXp = nextXp;
  character.weaponMasteryLevel = Math.max(beforeLevel, getWeaponMasteryLevel({ ...character, weaponMasteryXp: nextXp, weaponMasteryLevel: 0 }));
  return {
    xpGain: gain,
    beforeXp,
    afterXp: nextXp,
    beforeLevel,
    afterLevel: character.weaponMasteryLevel,
    leveledUp: character.weaponMasteryLevel > beforeLevel,
  };
}

export const ER_WEAPON_SKILLS = {
  권총: { name: '무빙 리로드', scoreScale: 0.075, escapeBonus: 0.05, critChancePlus: 0.02, log: '무빙 리로드로 사격 각을 다시 잡습니다.' },
  돌격소총: { name: '과열', scoreScale: 0.09, chaseBonus: 0.04, log: '연속 사격으로 압박을 겁니다.' },
  저격총: { name: '저격', scoreScale: 0.13, openerFlatDmg: 5, critChancePlus: 0.04, log: '먼 거리에서 치명적인 한 발을 노립니다.' },
  글러브: { name: '어퍼컷', scoreScale: 0.095, chaseBonus: 0.03, log: '근접 연타로 빈틈을 파고듭니다.' },
  톤파: { name: '고속 회전', scoreScale: 0.065, block: 5, log: '톤파로 피해를 흘려냅니다.' },
  쌍절곤: { name: '맹룡과강', scoreScale: 0.085, escapeBonus: 0.03, log: '변칙적인 궤적으로 흐름을 흔듭니다.' },
  아르카나: { name: 'VF 매개', scoreScale: 0.105, skillAmpPlus: 0.05, log: 'VF 에너지를 증폭합니다.' },
  양손검: { name: '빗겨흘리기', scoreScale: 0.08, block: 7, log: '검격을 받아내고 반격합니다.' },
  쌍검: { name: '쌍검난무', scoreScale: 0.11, chaseBonus: 0.04, log: '연속 베기로 추격 압박을 높입니다.' },
  망치: { name: '갑옷깨기', scoreScale: 0.10, openerFlatDmg: 4, log: '묵직한 타격으로 방어를 무너뜨립니다.' },
  방망이: { name: '풀스윙', scoreScale: 0.095, block: 3, openerFlatDmg: 3, log: '풀스윙으로 거리를 밀어냅니다.' },
  채찍: { name: '갈고리', scoreScale: 0.085, chaseBonus: 0.05, log: '사거리를 이용해 도주 경로를 제한합니다.' },
  투척: { name: '연막', scoreScale: 0.075, escapeBonus: 0.06, log: '연막으로 시야를 끊습니다.' },
  암기: { name: '마름쇠', scoreScale: 0.085, chaseBonus: 0.03, escapeBonus: 0.03, log: '마름쇠로 발을 묶습니다.' },
  활: { name: '곡사', scoreScale: 0.09, critChancePlus: 0.03, log: '곡사로 엄폐 뒤를 견제합니다.' },
  석궁: { name: '강노', scoreScale: 0.10, openerFlatDmg: 4, log: '강한 관통 사격을 준비합니다.' },
  도끼: { name: '피의 나선', scoreScale: 0.10, lifestealPlus: 0.035, log: '강한 일격으로 체력을 회수합니다.' },
  단검: { name: '망토와 단검', scoreScale: 0.09, escapeBonus: 0.05, critChancePlus: 0.025, log: '짧은 은신 기동으로 급소를 노립니다.' },
  창: { name: '그림자 찌르기', scoreScale: 0.10, chaseBonus: 0.04, openerFlatDmg: 3, log: '긴 리치로 진입을 차단합니다.' },
  레이피어: { name: '섬격', scoreScale: 0.095, critChancePlus: 0.035, log: '날카로운 찌르기로 틈을 찌릅니다.' },
  기타: { name: '불협화음', scoreScale: 0.08, skillAmpPlus: 0.04, escapeBonus: 0.03, log: '불협화음으로 전장을 흔듭니다.' },
  카메라: { name: '노출 조절', scoreScale: 0.08, chaseBonus: 0.03, critChancePlus: 0.02, log: '노출을 잡아 약점을 드러냅니다.' },
};

export const ER_TRAITS = {
  adrenaline: {
    name: '아드레날린',
    role: 'sustained_attack',
    scoreScale: 0.045,
    atkSpeedScore: 4,
    log: '아드레날린으로 장기 교전 화력이 상승합니다.',
  },
  devour: {
    name: '흡혈마',
    role: 'sustain',
    scoreScale: 0.035,
    lifestealPlus: 0.035,
    log: '흡혈마 특성으로 교전 유지력이 올라갑니다.',
  },
  ampDrone: {
    name: '증폭 드론',
    role: 'skill_amp',
    scoreScale: 0.04,
    skillAmpPlus: 0.06,
    log: '증폭 드론 특성으로 스킬 위력이 증가합니다.',
  },
  fortress: {
    name: '불굴',
    role: 'defense',
    scoreScale: 0.035,
    block: 4,
    log: '불굴 특성으로 받는 압박을 버팁니다.',
  },
  sprint: {
    name: '스프린터',
    role: 'mobility',
    scoreScale: 0.03,
    escapeBonus: 0.04,
    chaseBonus: 0.03,
    log: '스프린터 특성으로 이동전 우위를 얻습니다.',
  },
};

const SUBJECT_PRESET_LIST = [
  { code: 'jackie', names: ['재키', 'Jackie'], weapons: ['도끼', '단검', '양손검', '쌍검'], primaryWeapon: '도끼', tacticalSkill: '블래스터', trait: 'devour', role: 'bruiser', statBias: { str: 4, dex: 2, end: 2 }, aggression: 0.08, chase: 0.03, hunt: 0.04 },
  { code: 'aya', names: ['아야', 'Aya'], weapons: ['권총', '돌격소총', '저격총'], primaryWeapon: '권총', tacticalSkill: '리펄서 미사일', trait: 'adrenaline', role: 'marksman', statBias: { sht: 4, dex: 2, agi: 1 }, aggression: 0.04, escape: 0.04 },
  { code: 'fiora', names: ['피오라', 'Fiora'], weapons: ['레이피어', '창', '양손검'], primaryWeapon: '레이피어', tacticalSkill: '진실의 칼날', trait: 'sprint', role: 'duelist', statBias: { str: 3, dex: 3, agi: 2 }, aggression: 0.07, chase: 0.05 },
  { code: 'hyunwoo', names: ['현우', 'Hyunwoo'], weapons: ['글러브', '톤파'], primaryWeapon: '글러브', tacticalSkill: '퀘이크', trait: 'fortress', role: 'tank', statBias: { str: 2, end: 4, men: 2 }, aggression: 0.03, escape: 0.02 },
  { code: 'hyejin', names: ['혜진', 'Hyejin'], weapons: ['활', '암기'], primaryWeapon: '활', tacticalSkill: '아스테니아', trait: 'ampDrone', role: 'mage', statBias: { int: 4, sht: 2, men: 2 }, aggression: 0.03, escape: 0.03 },
  { code: 'isol', names: ['아이솔', 'Isol'], weapons: ['돌격소총', '권총'], primaryWeapon: '돌격소총', tacticalSkill: '무효화', trait: 'adrenaline', role: 'trapper', statBias: { sht: 3, int: 2, dex: 2 }, aggression: 0.03, escape: 0.05 },
  { code: 'dailin', names: ['리 다이린', '리다이린', 'Li Dailin'], weapons: ['글러브', '쌍절곤'], primaryWeapon: '쌍절곤', tacticalSkill: '플라즈마 대시', trait: 'devour', role: 'bruiser', statBias: { str: 3, agi: 3, end: 2 }, aggression: 0.08, chase: 0.04 },
  { code: 'yuki', names: ['유키', 'Yuki'], weapons: ['양손검', '쌍검'], primaryWeapon: '양손검', tacticalSkill: '진실의 칼날', trait: 'fortress', role: 'duelist', statBias: { str: 3, dex: 3, end: 2 }, aggression: 0.06, chase: 0.03 },
  { code: 'hart', names: ['하트', 'Hart'], weapons: ['기타'], primaryWeapon: '기타', tacticalSkill: '치유의 바람', trait: 'ampDrone', role: 'support', statBias: { int: 3, men: 3, agi: 2 }, escape: 0.05, objective: 0.03 },
  { code: 'shoichi', names: ['쇼이치', 'Shoichi'], weapons: ['단검'], primaryWeapon: '단검', tacticalSkill: '플라즈마 대시', trait: 'sprint', role: 'assassin', statBias: { str: 2, agi: 4, dex: 3 }, aggression: 0.08, chase: 0.07 },
  { code: 'cathy', names: ['캐시', 'Cathy'], weapons: ['단검'], primaryWeapon: '단검', tacticalSkill: '치유의 바람', trait: 'devour', role: 'sustain', statBias: { str: 2, dex: 3, men: 2 }, aggression: 0.04, escape: 0.03 },
  { code: 'rozzi', names: ['로지', 'Rozzi'], weapons: ['권총'], primaryWeapon: '권총', tacticalSkill: '플라즈마 대시', trait: 'adrenaline', role: 'skirmisher', statBias: { sht: 3, agi: 3, dex: 2 }, aggression: 0.06, chase: 0.04 },
  { code: 'emma', names: ['엠마', 'Emma'], weapons: ['아르카나'], primaryWeapon: '아르카나', tacticalSkill: '아티팩트', trait: 'ampDrone', role: 'mage', statBias: { int: 4, men: 2, luk: 2 }, escape: 0.04, objective: 0.04 },
  { code: 'sua', names: ['수아', 'Sua'], weapons: ['망치'], primaryWeapon: '망치', tacticalSkill: '초월', trait: 'fortress', role: 'tank', statBias: { str: 2, int: 2, end: 4 }, aggression: 0.03, escape: 0.03 },
  { code: 'eleven', names: ['일레븐', 'Eleven'], weapons: ['망치'], primaryWeapon: '망치', tacticalSkill: '강한 결속', trait: 'fortress', role: 'tank', statBias: { str: 3, end: 4, men: 2 }, aggression: 0.04, hunt: 0.03 },
  { code: 'rio', names: ['리오', 'Rio'], weapons: ['활'], primaryWeapon: '활', tacticalSkill: '리펄서 미사일', trait: 'adrenaline', role: 'marksman', statBias: { sht: 4, dex: 3, agi: 1 }, aggression: 0.05, chase: 0.03 },
  { code: 'luke', names: ['루크', 'Luke'], weapons: ['방망이'], primaryWeapon: '방망이', tacticalSkill: '퀘이크', trait: 'devour', role: 'bruiser', statBias: { str: 4, end: 2, luk: 1 }, aggression: 0.08, hunt: 0.04 },
  { code: 'bianca', names: ['비앙카', 'Bianca'], weapons: ['아르카나'], primaryWeapon: '아르카나', tacticalSkill: '거짓 서약', trait: 'ampDrone', role: 'mage', statBias: { int: 4, men: 2, end: 1 }, aggression: 0.05, escape: 0.03 },
  { code: 'mai', names: ['마이', 'Mai'], weapons: ['채찍'], primaryWeapon: '채찍', tacticalSkill: '빛의 수호', trait: 'sprint', role: 'support', statBias: { dex: 3, men: 3, agi: 2 }, escape: 0.05, objective: 0.04 },
  { code: 'daniel', names: ['다니엘', 'Daniel'], weapons: ['단검'], primaryWeapon: '단검', tacticalSkill: '무효화', trait: 'sprint', role: 'assassin', statBias: { str: 3, agi: 4, dex: 2 }, aggression: 0.07, chase: 0.06 },
  { code: 'elena', names: ['엘레나', 'Elena'], weapons: ['레이피어'], primaryWeapon: '레이피어', tacticalSkill: '아스테니아', trait: 'sprint', role: 'duelist', statBias: { str: 2, agi: 3, dex: 3 }, aggression: 0.05, escape: 0.05 },
  { code: 'piolo', names: ['피올로', 'Piolo'], weapons: ['쌍절곤'], primaryWeapon: '쌍절곤', tacticalSkill: '스트라이더 A-13', trait: 'sprint', role: 'skirmisher', statBias: { str: 3, agi: 3, dex: 2 }, aggression: 0.06, chase: 0.05 },
  { code: 'martina', names: ['마르티나', 'Martina'], weapons: ['카메라'], primaryWeapon: '카메라', tacticalSkill: '빛의 수호', trait: 'ampDrone', role: 'scout', statBias: { sht: 2, int: 3, luk: 2 }, escape: 0.05, objective: 0.06 },
  { code: 'haze', names: ['헤이즈', 'Haze'], weapons: ['돌격소총'], primaryWeapon: '돌격소총', tacticalSkill: '리펄서 미사일', trait: 'adrenaline', role: 'marksman', statBias: { sht: 4, dex: 2, agi: 1 }, aggression: 0.06, chase: 0.03 },
  { code: 'isaac', names: ['아이작', 'Isaac'], weapons: ['톤파'], primaryWeapon: '톤파', tacticalSkill: '퀘이크', trait: 'fortress', role: 'bruiser', statBias: { str: 3, end: 3, dex: 2 }, aggression: 0.07, chase: 0.04 },
  { code: 'theodore', names: ['테오도르', 'Theodore'], weapons: ['저격총'], primaryWeapon: '저격총', tacticalSkill: '리펄서 미사일', trait: 'adrenaline', role: 'marksman', statBias: { sht: 5, dex: 2, men: 1 }, aggression: 0.04, escape: 0.02 },
  { code: 'katja', names: ['카티야', 'Katja'], weapons: ['저격총'], primaryWeapon: '저격총', tacticalSkill: '무효화', trait: 'adrenaline', role: 'marksman', statBias: { sht: 5, agi: 2, dex: 1 }, aggression: 0.05, chase: 0.02 },
  { code: 'charlotte', names: ['샬럿', 'Charlotte'], weapons: ['아르카나'], primaryWeapon: '아르카나', tacticalSkill: '치유의 바람', trait: 'ampDrone', role: 'support', statBias: { int: 3, men: 4, luk: 1 }, escape: 0.05, objective: 0.04 },
  { code: 'bihyung', names: ['비형', 'Bihyung'], weapons: ['투척'], primaryWeapon: '투척', tacticalSkill: '플라즈마 대시', trait: 'sprint', role: 'trickster', statBias: { int: 3, agi: 3, dex: 2 }, aggression: 0.05, escape: 0.05 },
  { code: 'craver', names: ['크레이버', 'Craver'], weapons: ['도끼'], primaryWeapon: '도끼', tacticalSkill: '거짓 서약', trait: 'devour', role: 'bruiser', statBias: { str: 4, end: 2, dex: 2 }, aggression: 0.08, chase: 0.03, hunt: 0.04 },
];

const ER_SIGNATURE_MODIFIERS = {
  jackie: { name: '살육 본능', scoreScale: 0.035, lifestealPlus: 0.02, chaseBonus: 0.025, bleedChancePlus: 0.06, log: '상처를 집요하게 파고듭니다.' },
  aya: { name: '정밀 사격', scoreScale: 0.03, critChancePlus: 0.025, escapeBonus: 0.025, log: '거리를 유지하며 사격 각을 잡습니다.' },
  fiora: { name: '펜싱 스텝', scoreScale: 0.03, critChancePlus: 0.025, chaseBonus: 0.035, log: '짧은 진입으로 빈틈을 찌릅니다.' },
  hyunwoo: { name: '철벽 러시', scoreScale: 0.025, block: 4, openerFlatDmg: 2, log: '버티며 밀고 들어갑니다.' },
  hyejin: { name: '부적 연계', scoreScale: 0.03, skillAmpPlus: 0.035, escapeBonus: 0.02, log: '부적 연계로 흐름을 흔듭니다.' },
  isol: { name: '게릴라 전술', scoreScale: 0.025, escapeBonus: 0.045, chaseBonus: 0.02, trapPressure: 0.04, log: '함정과 사격으로 거리를 벌립니다.' },
  dailin: { name: '취권 압박', scoreScale: 0.03, lifestealPlus: 0.02, chaseBonus: 0.025, log: '변칙적인 연타로 흐름을 가져옵니다.' },
  yuki: { name: '단정한 일격', scoreScale: 0.03, block: 2, critChancePlus: 0.02, log: '흔들림 없이 반격 각을 잡습니다.' },
  hart: { name: '응원 리듬', scoreScale: 0.02, skillAmpPlus: 0.025, escapeBonus: 0.035, objectiveBias: 0.025, log: '리듬을 타며 전장을 정리합니다.' },
  shoichi: { name: '암살 설계', scoreScale: 0.04, openerFlatDmg: 3, critChancePlus: 0.035, chaseBonus: 0.035, log: '계산된 진입으로 급소를 노립니다.' },
  cathy: { name: '응급 처치', scoreScale: 0.02, lifestealPlus: 0.025, block: 2, escapeBonus: 0.02, log: '전투 중에도 회복 각을 만듭니다.' },
  rozzi: { name: '기동 사격', scoreScale: 0.03, critChancePlus: 0.02, escapeBonus: 0.025, chaseBonus: 0.025, log: '기동력으로 사격 템포를 유지합니다.' },
  emma: { name: '트릭 쇼', scoreScale: 0.03, skillAmpPlus: 0.04, escapeBonus: 0.03, log: '속임수로 타이밍을 비틉니다.' },
  sua: { name: '견고한 서가', scoreScale: 0.025, block: 5, skillAmpPlus: 0.02, log: '단단하게 버티며 주문을 엮습니다.' },
  eleven: { name: '파티 타임', scoreScale: 0.025, block: 4, lifestealPlus: 0.02, huntBias: 0.02, log: '버티는 힘으로 난전을 끌고 갑니다.' },
  rio: { name: '활의 호흡', scoreScale: 0.035, critChancePlus: 0.025, chaseBonus: 0.02, log: '침착한 연사로 거리를 지배합니다.' },
  luke: { name: '청소 시작', scoreScale: 0.035, openerFlatDmg: 2, lifestealPlus: 0.02, huntBias: 0.025, log: '근접전에서 기세를 빠르게 올립니다.' },
  bianca: { name: '혈류 조작', scoreScale: 0.035, skillAmpPlus: 0.035, lifestealPlus: 0.02, log: '체력을 대가로 압박을 키웁니다.' },
  mai: { name: '전장 재단', scoreScale: 0.02, block: 3, escapeBonus: 0.035, objectiveBias: 0.025, log: '위치를 재단해 위험을 줄입니다.' },
  daniel: { name: '그림자 추적', scoreScale: 0.04, openerFlatDmg: 3, critChancePlus: 0.035, chaseBonus: 0.04, log: '어둠 속에서 마무리 각을 봅니다.' },
  elena: { name: '빙결 검무', scoreScale: 0.03, block: 2, escapeBonus: 0.025, chaseBonus: 0.025, log: '얼음 같은 템포로 거리를 조절합니다.' },
  piolo: { name: '연속 타격', scoreScale: 0.035, chaseBonus: 0.035, escapeBonus: 0.02, log: '연속 타격으로 추격 흐름을 잇습니다.' },
  martina: { name: '취재 본능', scoreScale: 0.02, critChancePlus: 0.02, escapeBonus: 0.04, objectiveBias: 0.04, log: '위험을 기록하며 기회를 포착합니다.' },
  haze: { name: '화력 전개', scoreScale: 0.035, openerFlatDmg: 2, critChancePlus: 0.02, chaseBonus: 0.025, log: '화력으로 진입로를 덮습니다.' },
  isaac: { name: '집요한 추심', scoreScale: 0.035, block: 3, chaseBonus: 0.035, log: '한 번 잡은 흐름을 놓치지 않습니다.' },
  theodore: { name: '지원 저격', scoreScale: 0.035, critChancePlus: 0.04, openerFlatDmg: 2, log: '시야 밖에서 결정타를 준비합니다.' },
  katja: { name: '관측 사격', scoreScale: 0.035, critChancePlus: 0.04, chaseBonus: 0.02, log: '표적을 읽고 약점을 노립니다.' },
  charlotte: { name: '축복의 인도', scoreScale: 0.02, block: 3, skillAmpPlus: 0.025, escapeBonus: 0.035, log: '축복으로 생존 흐름을 이어갑니다.' },
  bihyung: { name: '도깨비 장난', scoreScale: 0.03, escapeBonus: 0.04, chaseBonus: 0.025, trapPressure: 0.025, log: '예측하기 어려운 동선으로 흔듭니다.' },
  craver: { name: '포식 충동', scoreScale: 0.04, openerFlatDmg: 2, lifestealPlus: 0.025, chaseBonus: 0.025, log: '먹잇감을 몰아붙이며 회복합니다.' },
};

export const ER_SUBJECT_PRESETS = SUBJECT_PRESET_LIST.map((preset) => ({
  ...preset,
  weapons: preset.weapons.map(normalizeErWeaponType),
  primaryWeapon: normalizeErWeaponType(preset.primaryWeapon),
}));

function normalizeSubjectName(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[.\-_'"]/g, '')
    .replace(/\s+/g, '')
    .replace(/[•·・]/g, '')
    .trim();
}

const SUBJECT_PRESET_BY_NAME = new Map();
ER_SUBJECT_PRESETS.forEach((preset) => {
  [preset.code, ...(preset.names || [])].forEach((name) => {
    const key = normalizeSubjectName(name);
    if (key) SUBJECT_PRESET_BY_NAME.set(key, preset);
  });
});

export function getErSubjectPreset(characterOrName) {
  const raw = typeof characterOrName === 'string'
    ? characterOrName
    : (characterOrName?.erSubject || characterOrName?.subjectName || characterOrName?.name || characterOrName?.nickname || '');
  const key = normalizeSubjectName(raw);
  return key ? (SUBJECT_PRESET_BY_NAME.get(key) || null) : null;
}

export function getErSignatureModifier(characterOrName) {
  const preset = getErSubjectPreset(characterOrName);
  const rawCode = typeof characterOrName === 'string' ? characterOrName : (characterOrName?.erSubject || preset?.code || '');
  const code = String(rawCode || preset?.code || '').trim().toLowerCase();
  const row = ER_SIGNATURE_MODIFIERS[code] || (preset?.code ? ER_SIGNATURE_MODIFIERS[preset.code] : null);
  return row ? { code: preset?.code || code, ...row } : null;
}

function mergeStatBias(stats, bias, scale = 1) {
  const out = { ...(stats && typeof stats === 'object' ? stats : {}) };
  const mul = Math.max(0, Number(scale || 0));
  if (!(mul > 0)) return out;
  Object.entries(bias || {}).forEach(([key, value]) => {
    const add = Number(value || 0) * mul;
    if (!Number.isFinite(add) || add === 0) return;
    out[key] = Number(out[key] || 0) + add;
  });
  return out;
}

function readCharacterStat(character, key) {
  const rawKey = String(key || '');
  const lower = rawKey.toLowerCase();
  const upper = rawKey.toUpperCase();
  const stats = character?.stats && typeof character.stats === 'object' ? character.stats : {};
  const value = Number(stats?.[rawKey] ?? stats?.[lower] ?? stats?.[upper] ?? character?.[rawKey] ?? character?.[lower] ?? character?.[upper] ?? 0);
  return Number.isFinite(value) ? value : 0;
}

function buildFallbackErPreset(character) {
  const existingWeapon = normalizeErWeaponType(character?.weaponType || '');
  const str = readCharacterStat(character, 'str');
  const sht = readCharacterStat(character, 'sht') || readCharacterStat(character, 'shoot');
  const int = readCharacterStat(character, 'int');
  const end = readCharacterStat(character, 'end');
  const agi = readCharacterStat(character, 'agi');
  const dex = readCharacterStat(character, 'dex');
  const men = readCharacterStat(character, 'men');
  const luk = readCharacterStat(character, 'luk');

  let role = 'bruiser';
  let weapon = 'axe';
  let trait = 'devour';
  let tacticalSkill = 'quake';
  let aggression = 0.04;
  let chase = 0.02;
  let escape = 0.02;
  let objective = 0.02;
  let hunt = 0.02;

  if (sht >= Math.max(str, int, end) && sht > 0) {
    role = 'marksman';
    weapon = sht >= dex + agi + 2 ? 'sniper rifle' : (agi > dex ? 'pistol' : 'assault rifle');
    trait = 'adrenaline';
    tacticalSkill = agi > dex ? 'plasma dash' : 'repulsor missiles';
    aggression = 0.04;
    chase = 0.03;
    escape = 0.04;
    objective = 0.03;
  } else if (int >= Math.max(str, sht, end) && int > 0) {
    const supportLike = men >= Math.max(str, sht, agi) || luk >= int;
    role = supportLike ? 'support' : 'mage';
    weapon = supportLike ? (luk > men ? 'camera' : 'guitar') : 'arcana';
    trait = 'ampDrone';
    tacticalSkill = supportLike ? 'healing wind' : (end > agi ? 'artifact' : 'false oath');
    aggression = supportLike ? -0.02 : 0.03;
    chase = supportLike ? 0.01 : 0.02;
    escape = 0.05;
    objective = supportLike ? 0.07 : 0.05;
    hunt = 0.01;
  } else if (end >= Math.max(str, sht, int, agi) && end > 0) {
    role = 'tank';
    weapon = str >= end - 2 ? 'hammer' : 'tonfa';
    trait = 'fortress';
    tacticalSkill = str >= end - 2 ? 'transcendence' : 'nullification';
    aggression = 0.02;
    chase = 0.01;
    escape = 0.04;
    objective = 0.03;
  } else if (agi >= Math.max(str, sht, int) && agi > 0) {
    role = dex >= str ? 'assassin' : 'skirmisher';
    weapon = dex >= str ? 'dagger' : 'glove';
    trait = 'sprint';
    tacticalSkill = dex >= str ? 'plasma dash' : 'strider a-13';
    aggression = 0.07;
    chase = 0.06;
    escape = 0.04;
    objective = 0.03;
  } else if (dex >= Math.max(sht, int, end) && dex > 0) {
    role = 'duelist';
    weapon = str >= dex ? 'two-handed sword' : 'rapier';
    trait = 'sprint';
    tacticalSkill = 'plasma dash';
    aggression = 0.06;
    chase = 0.05;
    escape = 0.04;
    objective = 0.02;
  } else {
    role = str >= end ? 'bruiser' : 'sustain';
    weapon = str >= end + 2 ? 'axe' : (dex > agi ? 'two-handed sword' : 'glove');
    trait = 'devour';
    tacticalSkill = str >= end + 2 ? 'blaster' : 'quake';
    aggression = 0.06;
    chase = 0.03;
    escape = 0.03;
    objective = 0.02;
    hunt = 0.04;
  }

  const primaryWeapon = normalizeErWeaponType(existingWeapon || weapon);
  return {
    code: `fallback_${role}`,
    names: [],
    weapons: [primaryWeapon],
    primaryWeapon,
    tacticalSkill,
    trait,
    role,
    statBias: {},
    aggression,
    chase,
    escape,
    objective,
    hunt,
  };
}

export function applyErSubjectPreset(character, opts = {}) {
  if (!character || typeof character !== 'object') return character;
  const preset = getErSubjectPreset(character);
  const fallback = opts.allowFallback === false ? null : buildFallbackErPreset(character);
  const activePreset = preset || fallback;
  if (!activePreset) return character;

  const replaceDefaultTactical = opts.replaceDefaultTactical !== false;
  const statBiasScale = preset ? Math.max(0, Number(opts.statBiasScale ?? 1)) : Math.max(0, Number(opts.fallbackStatBiasScale ?? 0));
  const currentTac = String(character?.tacticalSkill || '').trim();
  const tacLooksDefault = !currentTac || currentTac === '블링크' || currentTac.toLowerCase() === 'blink';

  return {
    ...character,
    erSubject: character.erSubject || activePreset.code,
    erRole: character.erRole || activePreset.role,
    erTrait: character.erTrait || activePreset.trait,
    erWeapons: Array.isArray(character.erWeapons) && character.erWeapons.length ? character.erWeapons : activePreset.weapons,
    erAggressionBias: character.erAggressionBias ?? activePreset.aggression ?? 0,
    erEscapeBias: character.erEscapeBias ?? activePreset.escape ?? 0,
    erChaseBias: character.erChaseBias ?? activePreset.chase ?? 0,
    erHuntBias: character.erHuntBias ?? activePreset.hunt ?? 0,
    erObjectiveBias: character.erObjectiveBias ?? activePreset.objective ?? 0,
    weaponType: normalizeErWeaponType(character.weaponType || activePreset.primaryWeapon),
    tacticalSkill: replaceDefaultTactical && tacLooksDefault ? activePreset.tacticalSkill : character.tacticalSkill,
    stats: mergeStatBias(character.stats, activePreset.statBias, statBiasScale),
  };
}

export function pickDefaultErTrait(character) {
  const explicit = String(character?.erTrait || character?.trait || character?.traitCode || '').trim();
  if (explicit && ER_TRAITS[explicit]) return explicit;
  const weaponType = normalizeErWeaponType(character?.weaponType || '');
  if (RANGED_WEAPONS.has(weaponType)) return weaponType === '아르카나' || weaponType === '기타' ? 'ampDrone' : 'adrenaline';
  if (HEAVY_WEAPONS.has(weaponType)) return 'fortress';
  if (QUICK_WEAPONS.has(weaponType)) return 'sprint';
  return 'devour';
}

export function getErTrait(character) {
  const code = pickDefaultErTrait(character);
  return ER_TRAITS[code] ? { code, ...ER_TRAITS[code] } : { code: '', name: '', scoreScale: 0 };
}

function roleBehavior(role) {
  switch (String(role || '')) {
    case 'assassin':
      return { powerScore: 3.5, aggressionBias: 0.08, chaseBonus: 0.07, escapeBonus: 0.03 };
    case 'marksman':
      return { powerScore: 2.5, aggressionBias: 0.04, chaseBonus: 0.03, escapeBonus: 0.05, objectiveBias: 0.03 };
    case 'mage':
      return { powerScore: 2.8, aggressionBias: 0.03, chaseBonus: 0.02, escapeBonus: 0.04, objectiveBias: 0.05 };
    case 'tank':
      return { powerScore: 3.0, aggressionBias: 0.02, chaseBonus: 0.01, escapeBonus: 0.04 };
    case 'support':
      return { powerScore: 1.8, aggressionBias: -0.02, chaseBonus: 0.01, escapeBonus: 0.07, objectiveBias: 0.05 };
    case 'scout':
      return { powerScore: 1.8, aggressionBias: -0.01, chaseBonus: 0.02, escapeBonus: 0.08, objectiveBias: 0.08 };
    case 'trapper':
    case 'trickster':
      return { powerScore: 2.2, aggressionBias: 0.01, chaseBonus: 0.04, escapeBonus: 0.08, objectiveBias: 0.04 };
    case 'duelist':
    case 'skirmisher':
      return { powerScore: 3.2, aggressionBias: 0.06, chaseBonus: 0.06, escapeBonus: 0.04 };
    case 'sustain':
    case 'bruiser':
    default:
      return { powerScore: 3.0, aggressionBias: 0.05, chaseBonus: 0.03, escapeBonus: 0.03, huntBias: 0.03 };
  }
}

function clampBehaviorPct(value, min = -0.25, max = 0.25) {
  const n = Number(value || 0);
  if (!Number.isFinite(n)) return 0;
  return Math.max(min, Math.min(max, n));
}

export function buildErBehaviorModifier(character, settings = {}) {
  const preset = getErSubjectPreset(character);
  const profile = getErWeaponProfile(character?.weaponType || preset?.primaryWeapon || '');
  const skill = ER_WEAPON_SKILLS[profile.weaponType] || null;
  const trait = getErTrait({ ...character, erTrait: character?.erTrait || preset?.trait, weaponType: profile.weaponType });
  const signature = getErSignatureModifier(character);
  const scale = Math.max(0, Number(settings?.battle?.erMetaScale ?? settings?.erMetaScale ?? 1));
  const role = character?.erRole || preset?.role || (profile.ranged ? 'marksman' : profile.heavy ? 'bruiser' : 'skirmisher');
  const roleBase = roleBehavior(role);
  const masteryLevel = getWeaponMasteryLevel(character);

  let powerScore = Number(roleBase.powerScore || 0);
  let aggressionBias = Number(roleBase.aggressionBias || 0) + Number(character?.erAggressionBias ?? preset?.aggression ?? 0);
  let escapeBonus = Number(roleBase.escapeBonus || 0) + Number(character?.erEscapeBias ?? preset?.escape ?? 0);
  let chaseBonus = Number(roleBase.chaseBonus || 0) + Number(character?.erChaseBias ?? preset?.chase ?? 0);
  let huntBias = Number(roleBase.huntBias || 0) + Number(character?.erHuntBias ?? preset?.hunt ?? 0);
  let objectiveBias = Number(roleBase.objectiveBias || 0) + Number(character?.erObjectiveBias ?? preset?.objective ?? 0);
  const roleProfile = roleCombatProfile(role);
  let damageBlock = Number(roleProfile?.block || 0);
  let damageBonus = Number(roleProfile?.openerFlatDmg || 0) + Number(roleProfile?.scoreScale || 0) * 12;
  let bleedChancePlus = 0;
  if (masteryLevel > 1) {
    damageBonus += Math.min(6, (masteryLevel - 1) * 0.35);
    damageBlock += Math.min(4, Math.floor((masteryLevel - 1) / 5));
  }

  if (skill) {
    powerScore += Number(skill.scoreScale || 0) * 18 + Number(skill.openerFlatDmg || 0) * 0.35 + Number(skill.block || 0) * 0.18;
    damageBlock += Number(skill.block || 0);
    damageBonus += Number(skill.openerFlatDmg || 0) + Number(skill.scoreScale || 0) * 10;
    escapeBonus += Number(skill.escapeBonus || 0);
    chaseBonus += Number(skill.chaseBonus || 0);
    if (skill.lifestealPlus) aggressionBias += 0.02;
  }

  if (trait?.code) {
    powerScore += Number(trait.scoreScale || 0) * 18 + Number(trait.block || 0) * 0.15;
    damageBlock += Number(trait.block || 0);
    damageBonus += Number(trait.scoreScale || 0) * 8 + Number(trait.skillAmpPlus || 0) * 14;
    escapeBonus += Number(trait.escapeBonus || 0);
    chaseBonus += Number(trait.chaseBonus || 0);
    if (trait.lifestealPlus) aggressionBias += 0.02;
    if (trait.skillAmpPlus) objectiveBias += 0.02;
  }

  if (signature) {
    powerScore += Number(signature.scoreScale || 0) * 18 + Number(signature.openerFlatDmg || 0) * 0.35 + Number(signature.block || 0) * 0.18;
    damageBlock += Number(signature.block || 0);
    damageBonus += Number(signature.openerFlatDmg || 0) + Number(signature.scoreScale || 0) * 10 + Number(signature.trapPressure || 0) * 7;
    bleedChancePlus += Number(signature.bleedChancePlus || 0);
    escapeBonus += Number(signature.escapeBonus || 0);
    chaseBonus += Number(signature.chaseBonus || 0);
    huntBias += Number(signature.huntBias || 0);
    objectiveBias += Number(signature.objectiveBias || 0);
    if (signature.lifestealPlus) aggressionBias += 0.015;
    if (signature.trapPressure) {
      chaseBonus += Number(signature.trapPressure || 0) * 0.5;
      escapeBonus += Number(signature.trapPressure || 0) * 0.5;
    }
  }

  return {
    subjectCode: character?.erSubject || preset?.code || '',
    role,
    masteryLevel,
    weaponType: profile.weaponType,
    weaponSkill: skill?.name || '',
    traitName: trait?.name || '',
    signatureName: signature?.name || '',
    powerScore: Math.max(0, powerScore * scale),
    damageBlock: Math.max(0, damageBlock * scale),
    damageBonus: Math.max(0, Math.min(18, damageBonus * scale)),
    bleedChancePlus: clampBehaviorPct(bleedChancePlus * scale, 0, 0.2),
    aggressionBias: clampBehaviorPct(aggressionBias * scale),
    escapeBonus: clampBehaviorPct(escapeBonus * scale, 0, 0.35),
    chaseBonus: clampBehaviorPct(chaseBonus * scale, 0, 0.35),
    huntBias: clampBehaviorPct(huntBias * scale, 0, 0.35),
    objectiveBias: clampBehaviorPct(objectiveBias * scale, 0, 0.35),
  };
}

export const ER_CAPSULES = {
  guard: {
    names: ['방어 캡슐', '가드 캡슐', 'Defense Capsule'],
    heal: 8,
    stats: { end: 4, men: 3 },
    shield: 10,
    duration: 3,
    log: '방어 캡슐로 최대 체력과 저항력이 강화됩니다.',
  },
  assault: {
    names: ['공격 캡슐', 'Assault Capsule', 'Offense Capsule'],
    heal: 4,
    stats: { str: 3, sht: 3, dex: 2 },
    regen: 4,
    duration: 3,
    log: '공격 캡슐로 공격력과 흡혈 성능이 강화됩니다.',
  },
  technique: {
    names: ['기술 캡슐', 'Technique Capsule', '스킬 캡슐'],
    heal: 4,
    stats: { int: 4, agi: 2, men: 1 },
    regen: 3,
    duration: 3,
    log: '기술 캡슐로 적응력과 쿨다운 운용이 좋아집니다.',
  },
};

export function getErCapsule(item) {
  const name = String(item?.name || item?.text || item?.itemId?.name || '').trim();
  const tags = Array.isArray(item?.tags) ? item.tags.map((tag) => String(tag || '').toLowerCase()) : [];
  const lower = name.toLowerCase();
  if (!name && !tags.includes('capsule')) return null;
  for (const [code, def] of Object.entries(ER_CAPSULES)) {
    if (tags.includes(`capsule:${code}`)) return { code, ...def };
    if (Array.isArray(def.names) && def.names.some((alias) => lower.includes(String(alias).toLowerCase()) || name.includes(alias))) {
      return { code, ...def };
    }
  }
  return tags.includes('capsule') ? { code: 'technique', ...ER_CAPSULES.technique } : null;
}

function statValue(stats, key) {
  return Math.max(0, Number(stats?.[key] || 0));
}

function roleCombatProfile(role) {
  switch (String(role || '')) {
    case 'assassin':
      return { scoreScale: 0.07, openerFlatDmg: 4, critChancePlus: 0.035, chaseBonus: 0.04 };
    case 'duelist':
      return { scoreScale: 0.06, openerFlatDmg: 2, critChancePlus: 0.025, block: 2, chaseBonus: 0.03 };
    case 'skirmisher':
      return { scoreScale: 0.055, openerFlatDmg: 2, critChancePlus: 0.02, escapeBonus: 0.03, chaseBonus: 0.03 };
    case 'marksman':
      return { scoreScale: 0.055, critChancePlus: 0.03, chaseBonus: 0.02 };
    case 'mage':
      return { scoreScale: 0.05, skillAmpPlus: 0.045, openerFlatDmg: 2 };
    case 'support':
      return { scoreScale: 0.035, skillAmpPlus: 0.025, block: 3, escapeBonus: 0.04 };
    case 'scout':
      return { scoreScale: 0.035, critChancePlus: 0.015, escapeBonus: 0.05, chaseBonus: 0.02 };
    case 'trapper':
    case 'trickster':
      return { scoreScale: 0.045, openerFlatDmg: 2, escapeBonus: 0.04, chaseBonus: 0.03 };
    case 'tank':
      return { scoreScale: 0.045, block: 7, escapeBonus: 0.02 };
    case 'sustain':
      return { scoreScale: 0.045, block: 2, lifestealPlus: 0.025 };
    case 'bruiser':
    default:
      return { scoreScale: 0.05, openerFlatDmg: 1, block: 2, lifestealPlus: 0.015, chaseBonus: 0.02 };
  }
}

export function buildErCombatModifier({ character, stats, opponentStats, equipStats, day = 1, settings = {} }) {
  const preset = getErSubjectPreset(character);
  const profile = getErWeaponProfile(equipStats?.weaponType || character?.weaponType || '');
  const skill = ER_WEAPON_SKILLS[profile.weaponType] || null;
  const trait = getErTrait(character);
  const signature = getErSignatureModifier(character);
  const role = character?.erRole || preset?.role || (profile.ranged ? 'marksman' : profile.heavy ? 'bruiser' : 'skirmisher');
  const roleProfile = roleCombatProfile(role);
  const scale = Math.max(0, Number(settings?.battle?.erMetaScale ?? 1));
  const dayMul = 1 + Math.max(0, Number(day || 1) - 1) * 0.015;
  const attackStat = profile.attackStat;
  const attack = statValue(stats, attackStat);
  const dex = statValue(stats, 'dex');
  const int = statValue(stats, 'int');
  const defenseGap = Math.max(0, statValue(stats, 'end') - statValue(opponentStats, 'end'));
  const equipAtk = Math.max(0, Number(equipStats?.atk || 0));
  const equipAmp = Math.max(0, Number(equipStats?.skillAmp || 0));
  const equipAtkSpeed = Math.max(0, Number(equipStats?.atkSpeed || 0));
  const masteryLevel = getWeaponMasteryLevel(character);
  const basePressure = (attack * 0.65) + (dex * 0.22) + (int * 0.14) + (equipAtk * 0.45) + (defenseGap * 0.12);
  const rolePressure = basePressure + statValue(stats, 'end') * 0.08 + statValue(stats, 'agi') * 0.10 + equipAmp * 10 + equipAtkSpeed * 6;

  let score = 0;
  let offenseBonus = 0;
  let block = 0;
  let escapeBonus = 0;
  let chaseBonus = 0;
  let critChancePlus = 0;
  let lifestealPlus = 0;
  const logs = [];

  if (masteryLevel > 1) {
    const masteryScore = (masteryLevel - 1) * 0.72 * dayMul * scale;
    score += masteryScore;
    offenseBonus += masteryScore * 0.55;
    critChancePlus += Math.min(0.035, (masteryLevel - 1) * 0.002);
    block += Math.min(4, Math.floor((masteryLevel - 1) / 5));
  }

  if (roleProfile) {
    const roleScore = (rolePressure * Number(roleProfile.scoreScale || 0) + Number(roleProfile.openerFlatDmg || 0)) * dayMul * scale;
    score += roleScore;
    offenseBonus += roleScore * 0.45;
    block += Number(roleProfile.block || 0);
    escapeBonus += Number(roleProfile.escapeBonus || 0);
    chaseBonus += Number(roleProfile.chaseBonus || 0);
    critChancePlus += Number(roleProfile.critChancePlus || 0);
    lifestealPlus += Number(roleProfile.lifestealPlus || 0);
    if (roleProfile.skillAmpPlus) offenseBonus += (equipAmp + Number(roleProfile.skillAmpPlus || 0)) * 8 * scale;
  }

  if (skill) {
    const skillScore = (basePressure * Number(skill.scoreScale || 0) + Number(skill.openerFlatDmg || 0)) * dayMul * scale;
    score += skillScore;
    offenseBonus += skillScore * 0.65;
    block += Number(skill.block || 0);
    escapeBonus += Number(skill.escapeBonus || 0);
    chaseBonus += Number(skill.chaseBonus || 0);
    critChancePlus += Number(skill.critChancePlus || 0);
    lifestealPlus += Number(skill.lifestealPlus || 0);
    if (skill.skillAmpPlus) offenseBonus += (equipAmp + Number(skill.skillAmpPlus || 0)) * 9 * scale;
    if (skill.log) logs.push(`[무기 스킬: ${skill.name}] ${skill.log}`);
  }

  if (trait?.code) {
    const traitBase = basePressure + equipAtkSpeed * Number(trait.atkSpeedScore || 0) + equipAmp * 12;
    const traitScore = traitBase * Number(trait.scoreScale || 0) * scale;
    score += traitScore;
    offenseBonus += traitScore * 0.5;
    block += Number(trait.block || 0);
    escapeBonus += Number(trait.escapeBonus || 0);
    chaseBonus += Number(trait.chaseBonus || 0);
    lifestealPlus += Number(trait.lifestealPlus || 0);
    if (trait.skillAmpPlus) offenseBonus += Number(trait.skillAmpPlus || 0) * 8 * scale;
    if (trait.log) logs.push(`[특성: ${trait.name}] ${trait.log}`);
  }

  if (signature) {
    const signatureScore = (rolePressure * Number(signature.scoreScale || 0) + Number(signature.openerFlatDmg || 0)) * dayMul * scale;
    score += signatureScore;
    offenseBonus += signatureScore * 0.55;
    block += Number(signature.block || 0);
    escapeBonus += Number(signature.escapeBonus || 0);
    chaseBonus += Number(signature.chaseBonus || 0);
    critChancePlus += Number(signature.critChancePlus || 0);
    lifestealPlus += Number(signature.lifestealPlus || 0);
    if (signature.skillAmpPlus) offenseBonus += Number(signature.skillAmpPlus || 0) * 9 * scale;
    if (signature.trapPressure) {
      score += rolePressure * Number(signature.trapPressure || 0) * 0.35 * scale;
      block += Number(signature.trapPressure || 0) * 8;
    }
    if (signature.log) logs.push(`[시그니처: ${signature.name}] ${signature.log}`);
  }

  return {
    role,
    masteryLevel,
    weaponType: profile.weaponType,
    weaponSkill: skill?.name || '',
    traitCode: trait?.code || '',
    traitName: trait?.name || '',
    signatureCode: signature?.code || '',
    signatureName: signature?.name || '',
    score,
    offenseBonus,
    block,
    escapeBonus,
    chaseBonus,
    critChancePlus,
    lifestealPlus,
    log: logs.join('\n'),
  };
}
