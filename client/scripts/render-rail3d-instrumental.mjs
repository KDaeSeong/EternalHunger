import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  renderPhysicalModelSoundtrack,
} from './render-eternal-hunger-instrumental.mjs';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = path.resolve(SCRIPT_DIR, '..', 'public', 'audio', 'rail3d-sim');

export const RAIL3D_RENDER_TRACKS = Object.freeze([
  {
    theme: 'rail-yard', file: 'yard', title: '첫차 준비', bars: 32,
    lead: 'celesta', counter: 'bassoon', pad: 'strings', highStrings: 'violin', midStrings: 'viola',
    lowStrings: 'cello', woodwind: 'flute', brassSection: 'horn', lowBrass: 'trombone', harp: 'harp',
    percussion: 'industrial-orchestra', drumScale: 0.4, room: 0.32,
  },
  {
    theme: 'rail-mainline', file: 'mainline', title: '푸른 본선', bars: 36,
    lead: 'violin', counter: 'vibraphone', pad: 'strings', highStrings: 'violin', midStrings: 'viola',
    lowStrings: 'cello', woodwind: 'flute', brassSection: 'horn', lowBrass: 'trombone', harp: 'harp',
    percussion: 'industrial-orchestra', drumScale: 0.88, room: 0.18,
  },
  {
    theme: 'rail-dispatch', file: 'dispatch', title: '관제의 손', bars: 40,
    lead: 'bassoon', counter: 'trumpet', pad: 'strings', highStrings: 'violin', midStrings: 'viola',
    lowStrings: 'cello', woodwind: 'oboe', brassSection: 'horn', lowBrass: 'trombone', harp: 'harp',
    percussion: 'industrial-orchestra', drumScale: 0.98, room: 0.16,
  },
  {
    theme: 'rail-congestion', file: 'congestion', title: '붉은 신호', bars: 40,
    lead: 'trumpet', counter: 'cello', pad: 'strings', highStrings: 'violin', midStrings: 'viola',
    lowStrings: 'cello', woodwind: 'oboe', brassSection: 'trumpet', lowBrass: 'trombone', harp: 'harp',
    percussion: 'industrial-orchestra', drumScale: 1.2, room: 0.14,
  },
  {
    theme: 'rail-arrival', file: 'arrival', title: '종착의 불빛', bars: 32,
    lead: 'horn', counter: 'bell', pad: 'strings', highStrings: 'violin', midStrings: 'viola',
    lowStrings: 'cello', woodwind: 'flute', brassSection: 'trumpet', lowBrass: 'trombone', harp: 'harp',
    percussion: 'orchestral', drumScale: 0.72, room: 0.3,
  },
  {
    theme: 'rail-archive', file: 'archive', title: '막차 이후', bars: 28,
    lead: 'harp', counter: 'celesta', pad: 'strings', highStrings: 'violin', midStrings: 'viola',
    lowStrings: 'cello', woodwind: 'bassoon', brassSection: 'horn', lowBrass: 'trombone', harp: 'harp',
    percussion: 'orchestral', drumScale: 0.2, room: 0.42,
  },
]);

await renderPhysicalModelSoundtrack({
  tracks: RAIL3D_RENDER_TRACKS,
  outputDir: OUTPUT_DIR,
  soundtrackName: 'Rail3D Simulator',
  renderer: 'sampled-orchestra-v3-vsco2-ce',
  channels: 2,
});
