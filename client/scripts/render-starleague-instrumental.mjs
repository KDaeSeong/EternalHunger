import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  renderPhysicalModelSoundtrack,
} from './render-eternal-hunger-instrumental.mjs';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = path.resolve(SCRIPT_DIR, '..', 'public', 'audio', 'starleague');

export const STARLEAGUE_RENDER_TRACKS = Object.freeze([
  {
    theme: 'starleague-office', file: 'office', title: '프런트 데스크', bars: 32,
    lead: 'vibraphone', counter: 'oboe', pad: 'strings', highStrings: 'violin', midStrings: 'viola',
    lowStrings: 'cello', woodwind: 'flute', brassSection: 'horn', lowBrass: 'trombone', harp: 'harp',
    percussion: 'orchestral', drumScale: 0.35, room: 0.3,
  },
  {
    theme: 'starleague-broadcast', file: 'broadcast', title: 'ON AIR', bars: 40,
    lead: 'trumpet', counter: 'bell', pad: 'strings', highStrings: 'violin', midStrings: 'viola',
    lowStrings: 'cello', woodwind: 'flute', brassSection: 'trumpet', lowBrass: 'trombone', harp: 'harp',
    percussion: 'hybrid-orchestra', drumScale: 0.95, room: 0.18,
  },
  {
    theme: 'starleague-personal', file: 'personal', title: '별들의 무대', bars: 40,
    lead: 'violin', counter: 'trumpet', pad: 'strings', highStrings: 'violin', midStrings: 'viola',
    lowStrings: 'cello', woodwind: 'oboe', brassSection: 'horn', lowBrass: 'trombone', harp: 'harp',
    percussion: 'hybrid-orchestra', drumScale: 1.05, room: 0.2,
  },
  {
    theme: 'starleague-winners', file: 'winners', title: '승자연전', bars: 40,
    lead: 'horn', counter: 'violin', pad: 'strings', highStrings: 'violin', midStrings: 'viola',
    lowStrings: 'cello', woodwind: 'bassoon', brassSection: 'trumpet', lowBrass: 'trombone', harp: 'harp',
    percussion: 'hybrid-orchestra', drumScale: 1.18, room: 0.17,
  },
  {
    theme: 'starleague-finals', file: 'finals', title: '마지막 한 세트', bars: 44,
    lead: 'trumpet', counter: 'cello', pad: 'strings', highStrings: 'violin', midStrings: 'viola',
    lowStrings: 'cello', woodwind: 'oboe', brassSection: 'trumpet', lowBrass: 'trombone', harp: 'harp',
    percussion: 'hybrid-orchestra', drumScale: 1.28, room: 0.15,
  },
  {
    theme: 'starleague-ceremony', file: 'ceremony', title: '챔피언의 밤', bars: 36,
    lead: 'violin', counter: 'trumpet', pad: 'strings', highStrings: 'violin', midStrings: 'viola',
    lowStrings: 'cello', woodwind: 'flute', brassSection: 'trumpet', lowBrass: 'trombone', harp: 'harp',
    percussion: 'hybrid-orchestra', drumScale: 0.82, room: 0.3,
  },
  {
    theme: 'starleague-archive', file: 'archive', title: '명승부 필름', bars: 32,
    lead: 'harp', counter: 'celesta', pad: 'strings', highStrings: 'violin', midStrings: 'viola',
    lowStrings: 'cello', woodwind: 'bassoon', brassSection: 'horn', lowBrass: 'trombone', harp: 'harp',
    percussion: 'orchestral', drumScale: 0.2, room: 0.4,
  },
]);

await renderPhysicalModelSoundtrack({
  tracks: STARLEAGUE_RENDER_TRACKS,
  outputDir: OUTPUT_DIR,
  soundtrackName: 'Starleague Simulator',
  renderer: 'sampled-orchestra-v3-vsco2-ce',
  channels: 2,
});
