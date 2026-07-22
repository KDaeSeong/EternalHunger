import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  renderPhysicalModelSoundtrack,
} from './render-eternal-hunger-instrumental.mjs';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = path.resolve(SCRIPT_DIR, '..', 'public', 'audio', 'racing-logos-demo');

export const RACING_LOGOS_RENDER_TRACKS = Object.freeze([
  {
    theme: 'racing-garage', file: 'garage', title: '피트 개장', bars: 34,
    lead: 'vibraphone', counter: 'bassoon', pad: 'strings', highStrings: 'violin', midStrings: 'viola',
    lowStrings: 'cello', woodwind: 'flute', brassSection: 'horn', lowBrass: 'trombone', harp: 'harp',
    percussion: 'motorsport-orchestra', drumScale: 0.52, room: 0.24,
  },
  {
    theme: 'racing-telemetry', file: 'telemetry', title: '텔레메트리 라인', bars: 40,
    lead: 'celesta', counter: 'vibraphone', pad: 'strings', highStrings: 'violin', midStrings: 'viola',
    lowStrings: 'cello', woodwind: 'flute', brassSection: 'horn', lowBrass: 'trombone', harp: 'harp',
    percussion: 'motorsport-orchestra', drumScale: 0.68, room: 0.18,
  },
  {
    theme: 'racing-grid', file: 'grid', title: '스타팅 그리드', bars: 42,
    lead: 'trumpet', counter: 'bell', pad: 'strings', highStrings: 'violin', midStrings: 'viola',
    lowStrings: 'cello', woodwind: 'oboe', brassSection: 'trumpet', lowBrass: 'trombone', harp: 'harp',
    percussion: 'motorsport-orchestra', drumScale: 1.02, room: 0.16,
  },
  {
    theme: 'racing-circuit', file: 'circuit', title: '풀 스로틀', bars: 44,
    lead: 'violin', counter: 'vibraphone', pad: 'strings', highStrings: 'violin', midStrings: 'viola',
    lowStrings: 'cello', woodwind: 'flute', brassSection: 'trumpet', lowBrass: 'trombone', harp: 'harp',
    percussion: 'motorsport-orchestra', drumScale: 1.24, room: 0.13,
  },
  {
    theme: 'racing-red-flag', file: 'red-flag', title: '레드 플래그', bars: 44,
    lead: 'trumpet', counter: 'cello', pad: 'strings', highStrings: 'violin', midStrings: 'viola',
    lowStrings: 'cello', woodwind: 'oboe', brassSection: 'horn', lowBrass: 'trombone', harp: 'harp',
    percussion: 'motorsport-orchestra', drumScale: 1.16, room: 0.15,
  },
  {
    theme: 'racing-podium', file: 'podium', title: '체커드 플래그', bars: 36,
    lead: 'trumpet', counter: 'violin', pad: 'strings', highStrings: 'violin', midStrings: 'viola',
    lowStrings: 'cello', woodwind: 'flute', brassSection: 'trumpet', lowBrass: 'trombone', harp: 'harp',
    percussion: 'hybrid-orchestra', drumScale: 0.82, room: 0.3,
  },
  {
    theme: 'racing-archive', file: 'archive', title: '경기 후 리포트', bars: 33,
    lead: 'harp', counter: 'celesta', pad: 'strings', highStrings: 'violin', midStrings: 'viola',
    lowStrings: 'cello', woodwind: 'bassoon', brassSection: 'horn', lowBrass: 'trombone', harp: 'harp',
    percussion: 'orchestral', drumScale: 0.18, room: 0.42,
  },
]);

await renderPhysicalModelSoundtrack({
  tracks: RACING_LOGOS_RENDER_TRACKS,
  outputDir: OUTPUT_DIR,
  soundtrackName: 'Racing Logos',
  renderer: 'sampled-orchestra-v3-vsco2-ce',
  channels: 2,
});
