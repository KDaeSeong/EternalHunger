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

const LUMIA_PASSAGE_SEGMENT_PIXELS = [
  { edge: ['alley', 'gas_station'], points: [[223, 103], [318, 104], [402, 107]] },
  { edge: ['alley', 'police'], points: [[402, 108], [414, 142], [428, 176]] },
  { edge: ['alley', 'temple'], points: [[402, 107], [486, 106], [584, 142]] },
  { edge: ['gas_station', 'archery'], points: [[223, 103], [183, 132], [151, 169]] },
  { edge: ['gas_station', 'school'], points: [[223, 103], [226, 160], [229, 229]] },
  { edge: ['gas_station', 'firestation'], points: [[223, 103], [300, 165], [364, 230]] },
  { edge: ['archery', 'school'], points: [[151, 169], [190, 198], [229, 229]] },
  { edge: ['archery', 'hotel'], points: [[151, 169], [128, 229], [108, 290]] },
  { edge: ['school', 'firestation'], points: [[229, 229], [294, 229], [364, 230]] },
  { edge: ['school', 'hotel'], points: [[229, 229], [168, 257], [108, 290]] },
  { edge: ['school', 'forest'], points: [[229, 229], [249, 316], [269, 396]] },
  { edge: ['school', 'lab'], points: [[229, 229], [271, 277], [314, 324]] },
  { edge: ['police', 'temple'], points: [[428, 176], [506, 159], [584, 142]] },
  { edge: ['police', 'firestation'], points: [[428, 176], [396, 203], [364, 230]] },
  { edge: ['police', 'stream'], points: [[428, 176], [492, 220], [551, 264]] },
  { edge: ['firestation', 'park'], points: [[364, 230], [410, 276], [456, 319]] },
  { edge: ['firestation', 'lab'], points: [[364, 230], [338, 277], [314, 324]] },
  { edge: ['temple', 'stream'], points: [[584, 142], [568, 203], [551, 264]] },
  { edge: ['stream', 'park'], points: [[551, 264], [504, 292], [456, 319]] },
  { edge: ['stream', 'hospital'], points: [[551, 264], [584, 322], [618, 382]] },
  { edge: ['park', 'hospital'], points: [[456, 319], [536, 351], [618, 382]] },
  { edge: ['park', 'cemetery'], points: [[456, 319], [461, 361], [466, 403]] },
  { edge: ['hospital', 'cemetery'], points: [[618, 382], [540, 393], [466, 403]] },
  { edge: ['hospital', 'factory'], points: [[618, 382], [607, 456], [596, 527]] },
  { edge: ['hotel', 'beach'], points: [[108, 290], [108, 342], [108, 397]] },
  { edge: ['hotel', 'forest'], points: [[108, 290], [188, 344], [269, 396]] },
  { edge: ['beach', 'forest'], points: [[108, 397], [188, 397], [269, 396]] },
  { edge: ['beach', 'apartment'], points: [[108, 397], [136, 439], [164, 477]] },
  { edge: ['forest', 'apartment'], points: [[269, 396], [218, 437], [164, 477]] },
  { edge: ['forest', 'cathedral'], points: [[269, 396], [322, 438], [374, 478]] },
  { edge: ['forest', 'lab'], points: [[269, 396], [291, 360], [314, 324]] },
  { edge: ['apartment', 'warehouse'], points: [[164, 477], [196, 519], [229, 561]] },
  { edge: ['apartment', 'cathedral'], points: [[164, 477], [270, 478], [374, 478]] },
  { edge: ['cemetery', 'cathedral'], points: [[466, 403], [420, 440], [374, 478]] },
  { edge: ['cemetery', 'factory'], points: [[466, 403], [530, 465], [596, 527]] },
  { edge: ['cemetery', 'lab'], points: [[466, 403], [390, 363], [314, 324]] },
  { edge: ['cathedral', 'warehouse'], points: [[374, 478], [300, 520], [229, 561]] },
  { edge: ['cathedral', 'factory'], points: [[374, 478], [486, 502], [596, 527]] },
  { edge: ['cathedral', 'port'], points: [[374, 478], [362, 543], [352, 606]] },
  { edge: ['warehouse', 'port'], points: [[229, 561], [290, 584], [352, 606]] },
  { edge: ['port', 'barge'], points: [[352, 606], [424, 628], [496, 649]] },
  { edge: ['port', 'factory'], points: [[352, 606], [474, 568], [596, 527]] },
  { edge: ['barge', 'factory'], points: [[496, 649], [546, 589], [596, 527]] },
];

export const LUMIA_PASSAGE_SEGMENTS = Object.freeze(
  LUMIA_PASSAGE_SEGMENT_PIXELS.map((segment) => ({
    edge: segment.edge,
    points: toLumiaPolygon(segment.points),
  }))
);

export const LUMIA_DEFAULT_ROAD_EDGES = LUMIA_PASSAGE_SEGMENTS.map((segment) => segment.edge);

export const LUMIA_DEFAULT_SPECIAL_EDGES = [
  ['park', 'cemetery', 'jump_paddle'],
];

export const LUMIA_DEFAULT_EDGES = [
  ...LUMIA_DEFAULT_ROAD_EDGES,
  ...LUMIA_DEFAULT_SPECIAL_EDGES,
];
