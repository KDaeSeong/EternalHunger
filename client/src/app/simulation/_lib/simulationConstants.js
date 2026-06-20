export const EQUIP_SLOTS = ['weapon', 'head', 'clothes', 'arm', 'shoes'];

export const START_WEAPON_TYPES = [
  '권총', '돌격소총', '돌소총', '저격총', '장갑', '톤파', '쌍절곤', '아르카나', '검', '쌍검', '망치',
  '방망이', '채찍', '투척', '암기', '활', '석궁', '도끼', '단검', '창', '레이피어',
];

export const INIT_DEPENDENCY_PATHS = [
  '/characters',
  '/events',
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
  archery: { x: 18, y: 24 },
  forest: { x: 26, y: 40 },
  temple: { x: 40, y: 26 },
  pond: { x: 52, y: 38 },
  lab: { x: 62, y: 30 },
  school: { x: 76, y: 24 },
  hotel: { x: 84, y: 38 },
  residential: { x: 86, y: 52 },
  hospital: { x: 74, y: 60 },
  police: { x: 60, y: 54 },
  cathedral: { x: 48, y: 48 },
  alley: { x: 52, y: 62 },
  gas_station: { x: 34, y: 68 },
  stream: { x: 40, y: 78 },
  beach: { x: 26, y: 86 },
  port: { x: 50, y: 88 },
  warehouse: { x: 62, y: 84 },
  factory: { x: 70, y: 74 },
  firestation: { x: 78, y: 78 },
};

export const LUMIA_DEFAULT_EDGES = [
  ['gas_station', 'alley'],
  ['gas_station', 'school'],
  ['gas_station', 'archery'],

  ['archery', 'hotel'],
  ['archery', 'school'],
  ['hotel', 'school'],
  ['hotel', 'beach'],

  ['school', 'firestation'],
  ['school', 'forest'],
  ['firestation', 'police'],
  ['firestation', 'lab'],
  ['firestation', 'pond'],

  ['police', 'alley'],
  ['police', 'pond'],
  ['alley', 'temple'],

  ['temple', 'stream'],
  ['stream', 'pond'],
  ['stream', 'hospital'],

  ['pond', 'hospital'],
  ['pond', 'lab'],
  ['pond', 'cathedral'],

  ['lab', 'cathedral'],
  ['forest', 'lab'],
  ['forest', 'beach'],

  ['beach', 'residential'],
  ['residential', 'warehouse'],
  ['warehouse', 'cathedral'],
  ['warehouse', 'port'],

  ['cathedral', 'port'],
  ['cathedral', 'factory'],
  ['factory', 'hospital'],
];
