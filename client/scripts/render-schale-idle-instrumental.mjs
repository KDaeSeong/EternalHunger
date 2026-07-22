import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  renderPhysicalModelSoundtrack,
} from './render-eternal-hunger-instrumental.mjs';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = path.resolve(SCRIPT_DIR, '..', 'public', 'audio', 'schale-idle-rpg');

export const SCHALE_IDLE_RENDER_TRACKS = Object.freeze([
  {
    theme: 'idle-briefing', file: 'briefing', title: '샬레 브리핑', bars: 34,
    lead: 'piano', counter: 'clarinet', pad: 'strings', highStrings: 'violin', midStrings: 'viola',
    lowStrings: 'cello', woodwind: 'flute', brassSection: 'horn', lowBrass: 'trombone', harp: 'harp',
    percussion: 'orchestral', drumScale: 0.38, room: 0.32,
  },
  {
    theme: 'idle-patrol', file: 'patrol', title: '오늘의 당직', bars: 40,
    lead: 'guitar', counter: 'flute', pad: 'strings', highStrings: 'violin', midStrings: 'viola',
    lowStrings: 'cello', woodwind: 'clarinet', brassSection: 'horn', lowBrass: 'trombone', harp: 'harp',
    percussion: 'hybrid-orchestra', drumScale: 0.86, room: 0.21,
  },
  {
    theme: 'idle-workshop', file: 'workshop', title: '장비 공방', bars: 38,
    lead: 'celesta', counter: 'guitar', pad: 'strings', highStrings: 'violin', midStrings: 'viola',
    lowStrings: 'cello', woodwind: 'clarinet', brassSection: 'horn', lowBrass: 'trombone', harp: 'harp',
    percussion: 'hybrid-orchestra', drumScale: 0.9, room: 0.19,
  },
  {
    theme: 'idle-tower', file: 'tower', title: '시련의 탑', bars: 46,
    lead: 'trumpet', counter: 'violin', pad: 'choir', highStrings: 'violin', midStrings: 'viola',
    lowStrings: 'cello', woodwind: 'oboe', brassSection: 'trumpet', lowBrass: 'trombone', harp: 'harp',
    percussion: 'hybrid-orchestra', drumScale: 1.22, room: 0.17,
  },
  {
    theme: 'idle-breakthrough', file: 'breakthrough', title: '전력 돌파', bars: 40,
    lead: 'violin', counter: 'horn', pad: 'strings', highStrings: 'violin', midStrings: 'viola',
    lowStrings: 'cello', woodwind: 'flute', brassSection: 'trumpet', lowBrass: 'trombone', harp: 'harp',
    percussion: 'hybrid-orchestra', drumScale: 1.02, room: 0.23,
  },
  {
    theme: 'idle-reward', file: 'reward', title: '빛나는 전리품', bars: 36,
    lead: 'celesta', counter: 'flute', pad: 'choir', highStrings: 'violin', midStrings: 'viola',
    lowStrings: 'cello', woodwind: 'clarinet', brassSection: 'horn', lowBrass: 'trombone', harp: 'harp',
    percussion: 'orchestral', drumScale: 0.55, room: 0.32,
  },
  {
    theme: 'idle-setback', file: 'setback', title: '당직 위기', bars: 40,
    lead: 'cello', counter: 'piano', pad: 'choir', highStrings: 'violin', midStrings: 'viola',
    lowStrings: 'cello', woodwind: 'oboe', brassSection: 'horn', lowBrass: 'trombone', harp: 'harp',
    percussion: 'orchestral', drumScale: 0.42, room: 0.35,
  },
]);

await renderPhysicalModelSoundtrack({
  tracks: SCHALE_IDLE_RENDER_TRACKS,
  outputDir: OUTPUT_DIR,
  soundtrackName: 'Schale Idle RPG',
  renderer: 'physical-model-v2-orchestra',
  channels: 2,
});
