import { CROSSOVER_BY_ID } from '../../_lib/crossoverCharacters.js';

const GAME_SLUG = 'kivotos-autochess';
const SAVE_VERSION = 'kivotos-autochess-v2';
const LEGACY_SAVE_VERSION = 'kivotos-autochess-v1';
const SUPPORTED_SAVE_VERSIONS = [SAVE_VERSION, LEGACY_SAVE_VERSION];
const QUICK_SAVE_SLOT = 'kivotos-autochess-main';
const BOARD = { cols: 6, rows: 8, homeRows: 4 };
const BENCH_SIZE = 9;
const MAX_LEVEL = 8;
const MAX_ROUNDS = 30;
const MAX_FRAMES = 152;
const XP_THRESHOLDS = [0, 2, 4, 6, 10, 16, 22, 30, Infinity];
const SHOP_ODDS = {
  1: [100, 0, 0, 0, 0], 2: [90, 10, 0, 0, 0], 3: [75, 25, 0, 0, 0],
  4: [55, 30, 15, 0, 0], 5: [40, 35, 20, 5, 0], 6: [28, 32, 27, 12, 1],
  7: [20, 28, 30, 18, 4], 8: [16, 24, 30, 22, 8],
};
const COPIES_BY_COST = [0, 24, 20, 16, 12, 10];
const ACADEMIES = {
  abydos: { name: '아비도스', color: '#60bfcf', label: '모래 방벽', description: '전투 시작 시 모든 아군에게 최대 체력의 15% / 28% 보호막', thresholds: [2, 4] },
  gehenna: { name: '게헨나', color: '#da8092', label: '집중 포화', description: '모든 아군의 공격력 +12% / +25%', thresholds: [2, 4] },
  millennium: { name: '밀레니엄', color: '#899adf', label: '전술 연산', description: '모든 아군의 시작 마나 +15 / +30, 마나 획득 +20% / +40%', thresholds: [2, 4] },
  trinity: { name: '트리니티', color: '#d6b866', label: '회복의 맹세', description: '모든 아군이 일반 공격 피해의 10% / 22%만큼 체력 회복', thresholds: [2, 4] },
  nte: { name: '헤테로 시티', color: '#e59787', label: '이상 차폐', description: '모든 아군이 첫 스킬 사용 시 최대 체력의 12% / 24% 보호막 획득', thresholds: [2, 4] },
  genshin: { name: '티바트', color: '#c8ac69', label: '원소 공명', description: '모든 아군의 스킬 피해·회복·보호막 효과 +15% / +30%', thresholds: [2, 4] },
};
const ROLES = {
  guard: { name: '방어', description: '방어 학생의 체력 +20% / +40%', thresholds: [2, 4] },
  shooter: { name: '사격', description: '사격 학생의 공격 속도 +15% / +30%', thresholds: [2, 4] },
  support: { name: '지원', description: '지원 학생의 스킬 효과 +20% / +40%', thresholds: [2, 4] },
};
const BASE_STUDENTS = [
  { id: 'serika', name: '세리카', academy: 'abydos', role: 'shooter', cost: 1, hp: 460, atk: 55, range: 3, interval: 1, skill: 'burst', skillName: '집중 사격' },
  { id: 'ayane', name: '아야네', academy: 'abydos', role: 'support', cost: 1, hp: 430, atk: 32, range: 3, interval: 1.25, skill: 'heal', skillName: '보급 지원' },
  { id: 'nonomi', name: '노노미', academy: 'abydos', role: 'shooter', cost: 2, hp: 570, atk: 60, range: 3, interval: 1.05, skill: 'blast', skillName: '광역 제압' },
  { id: 'shiroko', name: '시로코', academy: 'abydos', role: 'shooter', cost: 3, hp: 650, atk: 84, range: 4, interval: 1.1, skill: 'burst', skillName: '정밀 사격' },
  { id: 'hoshino', name: '호시노', academy: 'abydos', role: 'guard', cost: 4, hp: 1250, atk: 68, range: 1, interval: 1.05, skill: 'shield', skillName: '전선 유지' },
  { id: 'haruka', name: '하루카', academy: 'gehenna', role: 'guard', cost: 1, hp: 790, atk: 39, range: 1, interval: 1.05, skill: 'shield', skillName: '돌파 방벽' },
  { id: 'mutsuki', name: '무츠키', academy: 'gehenna', role: 'shooter', cost: 2, hp: 510, atk: 65, range: 3, interval: 1.15, skill: 'blast', skillName: '유탄 폭격' },
  { id: 'iori', name: '이오리', academy: 'gehenna', role: 'shooter', cost: 3, hp: 650, atk: 88, range: 3, interval: 1.1, skill: 'pierce', skillName: '관통 연사' },
  { id: 'ako', name: '아코', academy: 'gehenna', role: 'support', cost: 4, hp: 760, atk: 47, range: 3, interval: 1.1, skill: 'rally', skillName: '전술 지휘' },
  { id: 'hina', name: '히나', academy: 'gehenna', role: 'shooter', cost: 5, hp: 980, atk: 108, range: 4, interval: 1.05, skill: 'blast', skillName: '압도적 화력' },
  { id: 'yuuka', name: '유우카', academy: 'millennium', role: 'guard', cost: 1, hp: 820, atk: 35, range: 1, interval: 1.1, skill: 'shield', skillName: '엄폐 전개' },
  { id: 'momoi', name: '모모이', academy: 'millennium', role: 'shooter', cost: 1, hp: 450, atk: 57, range: 3, interval: 1, skill: 'burst', skillName: '속사 사격' },
  { id: 'midori', name: '미도리', academy: 'millennium', role: 'support', cost: 2, hp: 530, atk: 48, range: 3, interval: 1.1, skill: 'heal', skillName: '회복 지원' },
  { id: 'noa', name: '노아', academy: 'millennium', role: 'support', cost: 3, hp: 660, atk: 55, range: 3, interval: 1.1, skill: 'rally', skillName: '표적 분석' },
  { id: 'aris', name: '아리스', academy: 'millennium', role: 'shooter', cost: 5, hp: 1030, atk: 143, range: 4, interval: 1.5, skill: 'pierce', skillName: '레일건 발사' },
  { id: 'hanako', name: '하나코', academy: 'trinity', role: 'support', cost: 2, hp: 550, atk: 42, range: 3, interval: 1.2, skill: 'heal', skillName: '광역 회복' },
  { id: 'koharu', name: '코하루', academy: 'trinity', role: 'support', cost: 3, hp: 700, atk: 62, range: 3, interval: 1.1, skill: 'heal', skillName: '회복 투척' },
  { id: 'azusa', name: '아즈사', academy: 'trinity', role: 'shooter', cost: 4, hp: 780, atk: 120, range: 4, interval: 1.25, skill: 'pierce', skillName: '약점 사격' },
  { id: 'tsurugi', name: '츠루기', academy: 'trinity', role: 'guard', cost: 4, hp: 1160, atk: 90, range: 1, interval: .9, skill: 'burst', skillName: '근접 돌파' },
  { id: 'mika', name: '미카', academy: 'trinity', role: 'guard', cost: 5, hp: 1350, atk: 125, range: 1, interval: .9, skill: 'blast', skillName: '결정타' },
];
const LEGACY_STUDENT_IDS = BASE_STUDENTS.map(student => student.id);
const CROSSOVER_STUDENTS = [
  {
    "id": "nte-fadia",
    "academy": "nte",
    "role": "guard",
    "cost": 1,
    "hp": 840,
    "atk": 36,
    "range": 1,
    "interval": 1.15,
    "skill": "shield",
    "skillName": "고통 분담"
  },
  {
    "id": "nte-sakiri",
    "academy": "nte",
    "role": "support",
    "cost": 2,
    "hp": 550,
    "atk": 38,
    "range": 3,
    "interval": 1.2,
    "skill": "rally",
    "skillName": "이상 제어"
  },
  {
    "id": "nte-jiuyuan",
    "academy": "nte",
    "role": "shooter",
    "cost": 2,
    "hp": 530,
    "atk": 65,
    "range": 4,
    "interval": 1.2,
    "skill": "burst",
    "skillName": "표적 사격"
  },
  {
    "id": "nte-hathor",
    "academy": "nte",
    "role": "shooter",
    "cost": 3,
    "hp": 680,
    "atk": 80,
    "range": 3,
    "interval": 1.2,
    "skill": "blast",
    "skillName": "중화기 포격"
  },
  {
    "id": "nte-daffodil",
    "academy": "nte",
    "role": "guard",
    "cost": 4,
    "hp": 1080,
    "atk": 98,
    "range": 1,
    "interval": 0.9,
    "skill": "pierce",
    "skillName": "이상 절단"
  },
  {
    "id": "nte-nanally",
    "academy": "nte",
    "role": "shooter",
    "cost": 5,
    "hp": 1000,
    "atk": 128,
    "range": 3,
    "interval": 0.9,
    "skill": "burst",
    "skillName": "번개 연타"
  },
  {
    "id": "gi-lisa",
    "academy": "genshin",
    "role": "shooter",
    "cost": 1,
    "hp": 460,
    "atk": 50,
    "range": 3,
    "interval": 1.15,
    "skill": "blast",
    "skillName": "뇌광 방전"
  },
  {
    "id": "gi-jean",
    "academy": "genshin",
    "role": "support",
    "cost": 2,
    "hp": 610,
    "atk": 45,
    "range": 2,
    "interval": 1.2,
    "skill": "heal",
    "skillName": "민들레 바람"
  },
  {
    "id": "gi-ningguang",
    "academy": "genshin",
    "role": "shooter",
    "cost": 2,
    "hp": 570,
    "atk": 65,
    "range": 3,
    "interval": 1.1,
    "skill": "burst",
    "skillName": "별조각 사격"
  },
  {
    "id": "gi-diluc",
    "academy": "genshin",
    "role": "guard",
    "cost": 3,
    "hp": 980,
    "atk": 80,
    "range": 1,
    "interval": 1,
    "skill": "blast",
    "skillName": "여명"
  },
  {
    "id": "gi-keqing",
    "academy": "genshin",
    "role": "guard",
    "cost": 4,
    "hp": 1000,
    "atk": 105,
    "range": 1,
    "interval": 0.75,
    "skill": "burst",
    "skillName": "천가 순유"
  },
  {
    "id": "gi-zhongli",
    "academy": "genshin",
    "role": "guard",
    "cost": 5,
    "hp": 1450,
    "atk": 80,
    "range": 2,
    "interval": 1.15,
    "skill": "shield",
    "skillName": "옥홀 방패"
  }
].map(student => ({ ...CROSSOVER_BY_ID[student.id], ...student }));
const STUDENTS = [...BASE_STUDENTS.map(student => ({ ...student, origin: 'blue-archive' })), ...CROSSOVER_STUDENTS];
const STUDENT_BY_ID = Object.assign(Object.create(null), Object.fromEntries(STUDENTS.map(s => [s.id, s])));
const BOT_NAMES = ['아비도스 연구팀', '게헨나 전술반', '밀레니엄 연산부', '트리니티 원정대', '헤테로 시티 헌터', '티바트 원정대', '샬레 혼성팀'];

export { GAME_SLUG, SAVE_VERSION, LEGACY_SAVE_VERSION, SUPPORTED_SAVE_VERSIONS, LEGACY_STUDENT_IDS, QUICK_SAVE_SLOT, BOARD, BENCH_SIZE, MAX_LEVEL, MAX_ROUNDS, MAX_FRAMES, XP_THRESHOLDS, SHOP_ODDS, COPIES_BY_COST, ACADEMIES, ROLES, STUDENTS, STUDENT_BY_ID, BOT_NAMES };
