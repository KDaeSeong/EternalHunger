const GAME_SLUG = 'infinite-defense';
const SAVE_VERSION = 'infinite-defense-v1';
const QUICK_SAVE_SLOT = 'infinite-defense-main';
const STEP_SECONDS = 0.1;
const OFFLINE_CAP_SECONDS = 8 * 60 * 60;
const MAP = { width: 12, height: 8 };
const ROUTE = [
  { x: -0.5, y: 1.5 }, { x: 3.5, y: 1.5 }, { x: 3.5, y: 5.5 },
  { x: 7.5, y: 5.5 }, { x: 7.5, y: 2.5 }, { x: 12.5, y: 2.5 },
];
const PADS = [
  { id: 'p1', x: 1.5, y: 2.6 }, { id: 'p2', x: 2.4, y: 4.3 },
  { id: 'p3', x: 4.6, y: 2.5 }, { id: 'p4', x: 5.1, y: 4.4 },
  { id: 'p5', x: 6.6, y: 6.5 }, { id: 'p6', x: 8.7, y: 4.1 },
  { id: 'p7', x: 9.8, y: 1.1 }, { id: 'p8', x: 10.6, y: 3.7 },
];
const STAT_DEFS = [
  { id: 'dexterity', name: '손재주', effect: '채굴 생산량 증가', unit: '채굴' },
  { id: 'shooting', name: '사격', effect: '사거리 증가', unit: '사거리' },
  { id: 'agility', name: '민첩성', effect: '공격 간격 감소', unit: '공격 속도' },
];
const STUDENTS = [
  { id: 'shiroko', name: '시로코', role: '정밀 사격', color: '#75d9e8', cost: 72,
    damage: 13, range: 2.65, interval: 0.95, mining: 1.4, splash: 0, pierce: 0, slow: 0,
    stats: { dexterity: 7, shooting: 9, agility: 7 }, note: '긴 사거리로 먼저 진입한 적을 집중 공격합니다.' },
  { id: 'hina', name: '히나', role: '광역 제압', color: '#c9a3ff', cost: 110,
    damage: 10, range: 2.25, interval: 0.75, mining: 0.9, splash: 0.8, pierce: 0, slow: 0,
    stats: { dexterity: 4, shooting: 8, agility: 8 }, note: '적이 모인 곳에 범위 피해를 줍니다.' },
  { id: 'aris', name: '아리스', role: '장갑 관통', color: '#8dadff', cost: 125,
    damage: 30, range: 3.0, interval: 1.8, mining: 1.0, splash: 0, pierce: 0.85, slow: 0,
    stats: { dexterity: 5, shooting: 10, agility: 4 }, note: '방어력을 대부분 무시하는 고위력 포격입니다.' },
  { id: 'yuzu', name: '유즈', role: '유탄 포격', color: '#ffba8a', cost: 95,
    damage: 23, range: 2.6, interval: 1.7, mining: 1.3, splash: 1.25, pierce: 0.15, slow: 0,
    stats: { dexterity: 8, shooting: 7, agility: 4 }, note: '느리지만 넓은 범위에 유탄 피해를 줍니다.' },
  { id: 'noa', name: '노아', role: '생산 지원', color: '#f0c5ef', cost: 65,
    damage: 8, range: 2.6, interval: 1.0, mining: 2.2, splash: 0, pierce: 0, slow: 0,
    stats: { dexterity: 10, shooting: 6, agility: 6 }, note: '손재주가 높아 채굴에 배치하면 생산량이 큽니다.' },
  { id: 'yuuka', name: '유우카', role: '진입 저지', color: '#98b5ff', cost: 80,
    damage: 10, range: 2.15, interval: 1.0, mining: 1.6, splash: 0, pierce: 0, slow: 0.35,
    stats: { dexterity: 9, shooting: 6, agility: 5 }, note: '명중한 적을 1.5초 동안 느리게 합니다.' },
];
const ENEMY_TYPES = {
  scout: { name: '정찰 로봇', hp: 27, speed: 0.85, armor: 0, reward: 8, leak: 1, color: '#f58f84', shape: 'circle' },
  runner: { name: '돌격 드론', hp: 20, speed: 1.5, armor: 0, reward: 9, leak: 1, color: '#f9cc75', shape: 'diamond' },
  armored: { name: '장갑 병기', hp: 65, speed: 0.55, armor: 5, reward: 14, leak: 2, color: '#a8aec8', shape: 'square' },
  swarm: { name: '소형 군집', hp: 15, speed: 1.05, armor: 1, reward: 5, leak: 1, color: '#83dbb7', shape: 'triangle' },
  boss: { name: '거점 파괴자', hp: 1000, speed: 0.34, armor: 8, reward: 250, leak: 25, color: '#f16b86', shape: 'boss' },
};

export { GAME_SLUG, SAVE_VERSION, QUICK_SAVE_SLOT, STEP_SECONDS, OFFLINE_CAP_SECONDS, MAP, ROUTE, PADS, STAT_DEFS, STUDENTS, ENEMY_TYPES };
