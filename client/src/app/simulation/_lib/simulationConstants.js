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

export const LUMIA_MINIMAP_SOURCE = {
  source: '20260625214152_1.jpg',
  imageSize: { width: 1920, height: 1080 },
  mapBounds: { x: 1202, y: 190, width: 662, height: 682 },
  notes: 'Normalized from the attached route-planning minimap screenshot; geometry drives both rendering and movement/loot area weights.',
};

export const LUMIA_MINIMAP_VIEWBOX = {
  width: 100,
  height: 103,
  aspectWidth: 662,
  aspectHeight: 682,
};

export const LUMIA_ZONE_POS = {
  gas_station: { x: 34.7, y: 7.2 },
  alley: { x: 58.1, y: 7.8 },
  temple: { x: 88.9, y: 18.8 },
  archery: { x: 21.9, y: 25.2 },
  school: { x: 34.8, y: 33.8 },
  police: { x: 65.0, y: 25.2 },
  firestation: { x: 53.8, y: 34.0 },
  stream: { x: 82.5, y: 39.0 },
  hotel: { x: 18.8, y: 43.9 },
  lab: { x: 44.5, y: 47.2 },
  park: { x: 67.6, y: 46.9 },
  hospital: { x: 93.1, y: 56.4 },
  beach: { x: 12.7, y: 59.0 },
  forest: { x: 43.1, y: 59.6 },
  cemetery: { x: 70.0, y: 59.7 },
  factory: { x: 90.3, y: 77.8 },
  apartment: { x: 22.8, y: 70.8 },
  cathedral: { x: 58.4, y: 70.9 },
  warehouse: { x: 34.0, y: 82.2 },
  port: { x: 50.1, y: 87.5 },
  barge: { x: 72.0, y: 95.0 },
  pond: { x: 67.6, y: 46.9 },
  residential: { x: 22.8, y: 70.8 },
};

export const LUMIA_ISLAND_OUTLINE = [
  [35.6, 1.5],
  [47.8, 3.0],
  [59.2, 7.0],
  [69.4, 12.6],
  [80.2, 20.2],
  [91.3, 30.4],
  [98.6, 43.4],
  [96.5, 54.6],
  [91.8, 65.4],
  [88.7, 76.9],
  [79.6, 88.2],
  [70.3, 98.0],
  [59.5, 100.8],
  [49.3, 94.2],
  [39.7, 87.2],
  [30.4, 83.2],
  [20.3, 78.3],
  [9.8, 71.4],
  [1.7, 60.1],
  [3.5, 47.3],
  [7.5, 36.2],
  [14.6, 27.0],
  [23.1, 18.0],
  [30.7, 9.0],
];

export const LUMIA_ZONE_POLYGONS = {
  gas_station: [[29.4, 4.7], [42.8, 2.8], [54.8, 6.2], [56.4, 15.6], [48.2, 22.0], [36.3, 20.0], [27.7, 12.8]],
  alley: [[52.2, 5.4], [65.6, 8.8], [77.5, 16.8], [75.8, 26.2], [63.2, 25.2], [54.8, 17.5]],
  temple: [[73.2, 17.0], [86.8, 24.0], [97.0, 35.0], [96.0, 46.0], [86.2, 45.0], [77.2, 36.6], [69.4, 26.8]],
  archery: [[15.6, 24.0], [29.6, 15.0], [42.2, 20.8], [40.2, 31.8], [27.7, 37.0], [12.2, 33.2], [8.6, 28.2]],
  school: [[27.7, 32.8], [42.2, 22.0], [54.8, 30.0], [50.2, 42.2], [36.2, 43.7], [24.6, 37.4]],
  police: [[57.6, 23.8], [72.4, 26.0], [81.6, 36.0], [73.2, 45.0], [61.2, 40.7], [53.8, 31.2]],
  firestation: [[49.4, 36.8], [61.0, 39.4], [72.4, 46.8], [66.4, 56.2], [52.2, 54.5], [43.6, 45.0]],
  stream: [[77.0, 38.8], [90.5, 40.4], [98.8, 49.8], [92.6, 61.2], [80.4, 57.8], [70.6, 47.5]],
  hotel: [[7.2, 38.8], [22.4, 36.8], [31.4, 45.2], [25.2, 56.6], [10.6, 54.6], [2.0, 47.0]],
  lab: [[35.4, 46.2], [50.0, 42.8], [62.0, 50.2], [56.4, 62.8], [42.0, 63.2], [31.0, 53.5]],
  park: [[60.6, 46.0], [75.0, 47.4], [84.6, 56.2], [78.0, 68.4], [63.3, 65.2], [55.7, 54.4]],
  hospital: [[84.3, 54.4], [97.4, 56.6], [97.0, 68.8], [89.4, 80.6], [77.2, 72.5], [78.4, 61.5]],
  beach: [[3.6, 53.6], [23.2, 56.8], [33.0, 66.8], [26.0, 78.0], [11.8, 75.5], [1.7, 64.0]],
  forest: [[29.3, 59.2], [44.2, 58.2], [56.2, 68.6], [50.0, 80.8], [34.2, 78.0], [24.0, 67.5]],
  cemetery: [[56.2, 63.2], [72.0, 60.6], [83.2, 70.4], [75.0, 82.9], [60.0, 80.1], [49.6, 69.6]],
  factory: [[75.5, 73.8], [89.0, 75.0], [96.0, 84.2], [88.2, 96.2], [74.3, 91.9], [66.4, 82.0]],
  apartment: [[14.6, 68.4], [31.2, 71.0], [39.6, 80.4], [31.1, 90.0], [16.6, 85.2], [7.0, 74.6]],
  cathedral: [[43.0, 72.6], [59.6, 71.2], [71.2, 81.2], [62.8, 93.6], [48.4, 88.6], [37.2, 81.6]],
  warehouse: [[24.8, 80.2], [39.8, 82.8], [49.2, 91.0], [39.8, 99.0], [24.2, 93.0], [17.0, 86.0]],
  port: [[42.0, 87.4], [58.6, 85.6], [67.6, 94.0], [57.9, 100.9], [42.0, 98.0], [35.2, 91.6]],
  barge: [[62.0, 89.0], [78.8, 91.0], [87.6, 99.6], [74.2, 101.8], [59.2, 96.0]],
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
