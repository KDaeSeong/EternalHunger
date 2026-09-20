import { LUMIA_MINIMAP_REFERENCE_IMAGE, LUMIA_MINIMAP_VIEWBOX } from './simulationConstants.js';

// Display-only survey of the evaluator's 728 x 789 image. Coordinates below are
// image pixels, not the simulation's abstract local metres or navigation nodes.
// Shared border vertices keep neighbouring alert areas joined. The coastline is
// a simplified trace; this is not collision / walkable-terrain data.
const vertices = {
  a: [309, 165], b: [355, 206], c: [333, 250], d: [260, 212],
  e: [234, 235], f: [253, 253], g: [195, 297], h: [336, 297],
  i: [400, 355], j: [449, 280], k: [483, 305], l: [524, 339],
  m: [581, 388], n: [528, 435], o: [585, 484], p: [514, 544],
  q: [455, 495], r: [397, 443], s: [351, 414], t: [278, 375],
  u: [224, 460], v: [188, 423], w: [295, 519], x: [349, 546],
  y: [412, 598], z: [479, 655], aa: [527, 615], ab: [427, 175],
  ac: [519, 232], ad: [481, 267], ae: [153, 392], af: [431, 686], ah: [277, 355],
};
const points = (...values) => values.map((value) => typeof value === 'string' ? vertices[value] : value);

export const LUMIA_REFERENCE_ZONE_PIXELS = Object.freeze({
  gas_station: { anchor: [287, 184], polygon: points([231, 171], [298, 123], [338, 142], 'a', 'b', 'c', 'd') },
  alley: { anchor: [404, 146], polygon: points([298, 123], [341, 87], [355, 96], [354, 109], [378, 93], [418, 113], [442, 127], [479, 151], [499, 153], 'ab', 'b', 'a', [338, 142]) },
  temple: { anchor: [578, 244], polygon: points([499, 153], [519, 177], [542, 177], [594, 194], [648, 238], [659, 253], [675, 278], [660, 290], [657, 315], [630, 340], [560, 278], 'ac', [466, 188]) },
  archery: { anchor: [192, 225], polygon: points([231, 171], 'd', 'e', 'f', 'g', [154, 268], [139, 240], [133, 229], [145, 204], [185, 175], [203, 194]) },
  school: { anchor: [283, 294], polygon: points('d', 'c', [357, 269], 'h', [360, 317], 't', 'ah', 'g', 'f', 'e') },
  police: { anchor: [462, 241], polygon: points('b', 'ab', [466, 188], 'ac', 'ad', 'j', [398, 239], 'c') },
  firestation: { anchor: [395, 318], polygon: points('c', [398, 239], 'j', 'k', [455, 326], 'i', [360, 317], 'h', [357, 269]) },
  stream: { anchor: [565, 342], polygon: points('ac', [560, 278], [630, 340], [625, 358], [649, 376], 'm', 'l', 'k', 'ad') },
  hotel: { anchor: [185, 333], polygon: points([116, 243], [139, 267], 'g', 'ah', 't', 'ae', [111, 423], [74, 393], [60, 373], [66, 357], [65, 344], [79, 331], [72, 322], [84, 285], [93, 273]) },
  lab: { anchor: [350, 375], polygon: points([360, 317], 'i', [434, 380], 's', 't') },
  park: { anchor: [489, 376], polygon: points('k', 'l', 'm', 'n', 'r', 's', [434, 380], 'i', [455, 326]) },
  hospital: { anchor: [638, 424], polygon: points('m', [649, 376], [669, 365], [696, 384], [691, 414], [671, 439], [681, 459], [670, 474], [657, 495], 'o', 'n') },
  beach: { anchor: [127, 458], polygon: points([74, 393], [111, 423], 'ae', 'v', 'u', [148, 521], [101, 510], [73, 479], [61, 464], [65, 451], [48, 442], [45, 426], [61, 430], [60, 411]) },
  forest: { anchor: [290, 455], polygon: points('ae', 't', 's', 'r', 'w', 'u', 'v') },
  cemetery: { anchor: [506, 478], polygon: points('r', 'n', 'o', 'p', 'q') },
  factory: { anchor: [589, 559], polygon: points('o', [657, 495], [678, 516], [667, 532], [653, 553], [629, 571], [630, 588], [601, 612], [580, 628], [571, 626], [549, 647], 'aa', 'p') },
  apartment: { anchor: [228, 531], polygon: points('u', 'w', 'x', [282, 604], [259, 622], [235, 600], [222, 610], [194, 591], [181, 593], [155, 574], [166, 562], [123, 530], [148, 521]) },
  cathedral: { anchor: [417, 532], polygon: points('w', 'r', 'q', 'p', 'aa', 'y', 'x') },
  warehouse: { anchor: [323, 597], polygon: points('x', 'y', [340, 662], [312, 655], [276, 634], [259, 622], [282, 604]) },
  port: { anchor: [430, 636], polygon: points('y', 'aa', 'z', 'af', [398, 714], [374, 706], [365, 704], [348, 679], [336, 684], [340, 662]) },
  barge: { anchor: [478, 708], polygon: points('aa', [549, 647], [559, 660], [573, 668], [534, 700], [518, 704], [454, 761], [401, 726], [398, 714], 'af', 'z') },
});

export function referencePixelToPoint([x, y]) {
  const bounds = LUMIA_MINIMAP_REFERENCE_IMAGE.mapBounds;
  return {
    x: ((x - bounds.x) / bounds.width) * LUMIA_MINIMAP_VIEWBOX.width,
    y: ((y - bounds.y) / bounds.height) * LUMIA_MINIMAP_VIEWBOX.height,
  };
}

export const LUMIA_REFERENCE_ZONES = Object.freeze(Object.fromEntries(
  Object.entries(LUMIA_REFERENCE_ZONE_PIXELS).map(([id, zone]) => [id, {
    anchor: referencePixelToPoint(zone.anchor),
    polygon: zone.polygon.map((point) => {
      const { x, y } = referencePixelToPoint(point);
      return [x, y];
    }),
  }])
));

export const LUMIA_REFERENCE_POSITIONS = Object.freeze(Object.fromEntries(
  Object.entries(LUMIA_REFERENCE_ZONES).map(([id, zone]) => [id, zone.anchor])
));
export const LUMIA_REFERENCE_POLYGONS = Object.freeze(Object.fromEntries(
  Object.entries(LUMIA_REFERENCE_ZONES).map(([id, zone]) => [id, zone.polygon])
));

const labelRects = [
  [247, 102, 303, 129], [419, 107, 477, 136], [618, 198, 647, 227],
  [171, 232, 225, 263], [255, 300, 294, 329], [448, 238, 506, 269],
  [367, 300, 426, 331], [574, 329, 612, 359], [132, 359, 174, 389],
  [323, 390, 381, 421], [473, 381, 513, 410], [646, 447, 691, 477],
  [102, 463, 171, 494], [300, 464, 331, 494], [490, 473, 531, 502],
  [614, 594, 660, 623], [145, 548, 235, 576], [397, 548, 439, 576],
  [249, 623, 292, 651], [368, 665, 411, 695], [502, 712, 559, 741],
];
export const LUMIA_REFERENCE_LABEL_RECTS = Object.freeze(labelRects.map(([x1, y1, x2, y2]) => ({
  min: referencePixelToPoint([x1, y1]), max: referencePixelToPoint([x2, y2]),
})));
