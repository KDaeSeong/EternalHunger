export const EQUIP_SLOTS = ['weapon', 'head', 'clothes', 'arm', 'shoes'];

export const START_WEAPON_TYPES = [
  '권총', '돌격소총', '돌소총', '저격총', '장갑', '톤파', '쌍절곤', '아르카나', '검', '쌍검', '망치',
  '방망이', '채찍', '투척', '암기', '활', '석궁', '도끼', '단검', '창', '레이피어',
];

export const INIT_DEPENDENCY_PATHS = [
  '/characters',
  '/settings',
  '/user/me',
  '/public/items',
  '/public/maps',
  '/public/kiosks',
  '/public/drone-offers',
  '/public/perks',
  '/trades',
  '/trades?mine=true',
];

export const SLOT_ICON = { weapon: '⚔️', head: '🪖', clothes: '👕', arm: '🦾', shoes: '👟' };

export const LUMIA_ZONE_POS = {
  gas_station: { x: 36, y: 17 },
  alley: { x: 57, y: 19 },
  temple: { x: 79, y: 30 },
  archery: { x: 25, y: 34 },
  school: { x: 42, y: 43 },
  police: { x: 64, y: 37 },
  firestation: { x: 58, y: 46 },
  stream: { x: 84, y: 47 },
  hotel: { x: 17, y: 53 },
  lab: { x: 50, y: 56 },
  park: { x: 75, y: 60 },
  hospital: { x: 95, y: 64 },
  beach: { x: 13, y: 70 },
  forest: { x: 44, y: 70 },
  cemetery: { x: 70, y: 72 },
  factory: { x: 91, y: 80 },
  apartment: { x: 25, y: 84 },
  cathedral: { x: 55, y: 82 },
  warehouse: { x: 34, y: 91 },
  port: { x: 48, y: 95 },
  barge: { x: 68, y: 94 },
  pond: { x: 75, y: 60 },
  residential: { x: 25, y: 84 },
};

export const LUMIA_DEFAULT_ROAD_EDGES = [
  ['alley', 'gas_station'],
  ['alley', 'police'],
  ['alley', 'temple'],
  ['gas_station', 'archery'],
  ['gas_station', 'school'],
  ['gas_station', 'firestation'],
  ['archery', 'school'],
  ['archery', 'hotel'],
  ['school', 'firestation'],
  ['school', 'hotel'],
  ['school', 'forest'],
  ['school', 'lab'],
  ['police', 'temple'],
  ['police', 'firestation'],
  ['police', 'stream'],
  ['firestation', 'park'],
  ['firestation', 'lab'],
  ['temple', 'stream'],
  ['stream', 'park'],
  ['stream', 'hospital'],
  ['park', 'hospital'],
  ['park', 'cemetery'],
  ['hospital', 'cemetery'],
  ['hospital', 'factory'],
  ['hotel', 'beach'],
  ['hotel', 'forest'],
  ['beach', 'forest'],
  ['beach', 'apartment'],
  ['forest', 'apartment'],
  ['forest', 'cathedral'],
  ['forest', 'lab'],
  ['apartment', 'warehouse'],
  ['apartment', 'cathedral'],
  ['cemetery', 'cathedral'],
  ['cemetery', 'factory'],
  ['cemetery', 'lab'],
  ['cathedral', 'warehouse'],
  ['cathedral', 'factory'],
  ['cathedral', 'port'],
  ['warehouse', 'port'],
  ['port', 'barge'],
  ['port', 'factory'],
  ['barge', 'factory'],
];

export const LUMIA_DEFAULT_SPECIAL_EDGES = [
  ['park', 'cemetery', 'jump_paddle'],
];

export const LUMIA_DEFAULT_EDGES = [
  ...LUMIA_DEFAULT_ROAD_EDGES,
  ...LUMIA_DEFAULT_SPECIAL_EDGES,
];
