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
  traceSpace: { width: 662, height: 682 },
  notes: 'Pixel-traced from the attached route-planning minimap screenshot; geometry drives rendering, movement distance, and area weights.',
};

export const LUMIA_MINIMAP_VIEWBOX = {
  width: 100,
  height: 103,
  aspectWidth: 662,
  aspectHeight: 682,
};

function toLumiaPoint([x, y]) {
  const trace = LUMIA_MINIMAP_SOURCE.traceSpace;
  return [
    Number(((Number(x || 0) / trace.width) * LUMIA_MINIMAP_VIEWBOX.width).toFixed(2)),
    Number(((Number(y || 0) / trace.height) * LUMIA_MINIMAP_VIEWBOX.height).toFixed(2)),
  ];
}

function toLumiaPos([x, y]) {
  const [nx, ny] = toLumiaPoint([x, y]);
  return { x: nx, y: ny };
}

function toLumiaPolygon(points) {
  return points.map(toLumiaPoint);
}

const LUMIA_ZONE_POS_PIXELS = {
  gas_station: [223, 44],
  alley: [402, 42],
  temple: [584, 142],
  archery: [151, 169],
  school: [229, 229],
  police: [428, 176],
  firestation: [364, 230],
  stream: [551, 264],
  hotel: [108, 290],
  lab: [314, 324],
  park: [456, 319],
  hospital: [618, 382],
  beach: [108, 397],
  forest: [269, 396],
  cemetery: [466, 403],
  factory: [596, 527],
  apartment: [164, 477],
  cathedral: [374, 478],
  warehouse: [229, 561],
  port: [352, 606],
  barge: [496, 649],
};

export const LUMIA_ZONE_POS = {
  ...Object.fromEntries(Object.entries(LUMIA_ZONE_POS_PIXELS).map(([zoneId, point]) => [zoneId, toLumiaPos(point)])),
  pond: toLumiaPos(LUMIA_ZONE_POS_PIXELS.park),
  residential: toLumiaPos(LUMIA_ZONE_POS_PIXELS.apartment),
};

const LUMIA_ISLAND_OUTLINE_PIXELS = [
  [214, 6],
  [292, 14],
  [357, 35],
  [405, 35],
  [440, 72],
  [486, 99],
  [538, 97],
  [583, 136],
  [656, 199],
  [646, 245],
  [654, 313],
  [644, 382],
  [621, 433],
  [653, 477],
  [616, 531],
  [628, 569],
  [563, 594],
  [544, 646],
  [495, 679],
  [424, 651],
  [390, 615],
  [339, 619],
  [304, 571],
  [263, 572],
  [236, 542],
  [192, 544],
  [164, 508],
  [111, 504],
  [85, 457],
  [34, 443],
  [5, 391],
  [29, 340],
  [4, 294],
  [35, 250],
  [14, 206],
  [58, 174],
  [41, 143],
  [100, 99],
  [154, 88],
  [184, 29],
];

export const LUMIA_ISLAND_OUTLINE = toLumiaPolygon(LUMIA_ISLAND_OUTLINE_PIXELS);

const LUMIA_ZONE_POLYGON_PIXELS = {
  gas_station: [[191, 23], [262, 12], [329, 53], [325, 113], [256, 151], [188, 100]],
  alley: [[303, 6], [397, 18], [478, 83], [461, 150], [362, 147], [318, 86]],
  temple: [[464, 77], [547, 99], [654, 186], [644, 246], [548, 258], [466, 162]],
  archery: [[64, 144], [155, 92], [267, 151], [270, 225], [170, 262], [57, 216], [43, 169]],
  school: [[170, 209], [278, 151], [366, 221], [334, 295], [229, 305], [139, 239]],
  police: [[364, 151], [475, 160], [553, 228], [498, 307], [406, 279], [337, 221]],
  firestation: [[329, 245], [407, 267], [500, 323], [453, 395], [342, 373], [276, 302]],
  stream: [[496, 262], [593, 247], [656, 316], [625, 404], [519, 374], [457, 319]],
  hotel: [[36, 239], [139, 243], [223, 306], [173, 393], [66, 382], [6, 309]],
  lab: [[237, 318], [341, 306], [426, 374], [377, 465], [270, 459], [184, 385]],
  park: [[426, 326], [518, 374], [580, 455], [508, 527], [402, 465], [377, 395]],
  hospital: [[570, 356], [654, 382], [649, 470], [606, 546], [518, 523], [508, 432]],
  beach: [[5, 334], [113, 385], [184, 456], [149, 543], [54, 513], [3, 442]],
  forest: [[174, 405], [270, 460], [366, 458], [334, 546], [235, 553], [148, 486]],
  cemetery: [[403, 439], [510, 433], [589, 499], [548, 595], [445, 584], [374, 515]],
  factory: [[550, 520], [631, 545], [654, 624], [596, 678], [499, 633], [490, 560]],
  apartment: [[66, 453], [174, 481], [239, 551], [171, 621], [70, 584], [10, 507]],
  cathedral: [[334, 464], [443, 489], [503, 572], [425, 650], [331, 604], [262, 528]],
  warehouse: [[178, 533], [268, 563], [333, 621], [260, 678], [154, 640], [99, 579]],
  port: [[321, 593], [425, 609], [498, 666], [418, 682], [300, 669], [260, 625]],
  barge: [[477, 624], [590, 641], [649, 675], [560, 682], [430, 682]],
};

export const LUMIA_ZONE_POLYGONS = Object.fromEntries(
  Object.entries(LUMIA_ZONE_POLYGON_PIXELS).map(([zoneId, polygon]) => [zoneId, toLumiaPolygon(polygon)])
);

const LUMIA_HYPERLOOP_MARKER_PIXELS = {
  gas_station: [260, 108],
  temple: [482, 107],
  school: [318, 197],
  stream: [552, 219],
  hotel: [145, 259],
  forest: [247, 338],
  hospital: [580, 350],
  apartment: [180, 448],
  cathedral: [412, 474],
  factory: [552, 472],
  barge: [578, 576],
};

const LUMIA_KIOSK_MARKER_PIXELS = {
  archery: [204, 112],
  police: [362, 122],
  firestation: [400, 222],
  temple: [582, 220],
  school: [232, 273],
  hotel: [96, 323],
  lab: [324, 356],
  hospital: [560, 398],
  cathedral: [330, 445],
  warehouse: [278, 548],
  barge: [407, 610],
};

export const LUMIA_HYPERLOOP_MARKERS = Object.fromEntries(
  Object.entries(LUMIA_HYPERLOOP_MARKER_PIXELS).map(([zoneId, point]) => [zoneId, toLumiaPos(point)])
);

export const LUMIA_KIOSK_MARKERS = Object.fromEntries(
  Object.entries(LUMIA_KIOSK_MARKER_PIXELS).map(([zoneId, point]) => [zoneId, toLumiaPos(point)])
);

export const LUMIA_HYPERLOOP_ZONE_IDS = Object.freeze(Object.keys(LUMIA_HYPERLOOP_MARKERS));
export const LUMIA_KIOSK_ZONE_IDS = Object.freeze(Object.keys(LUMIA_KIOSK_MARKERS));

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
