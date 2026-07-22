import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  renderPhysicalModelSoundtrack,
} from './render-eternal-hunger-instrumental.mjs';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = path.resolve(SCRIPT_DIR, '..', 'public', 'audio', 'dual-academy-tcg');

export const DUAL_ACADEMY_RENDER_TRACKS = Object.freeze([
  {
    theme: 'academy-ready', file: 'ready', title: '첫 패의 청춘', bars: 36,
    lead: 'vibraphone', counter: 'oboe', pad: 'strings', highStrings: 'violin', midStrings: 'viola',
    lowStrings: 'cello', woodwind: 'flute', brassSection: 'horn', lowBrass: 'trombone', harp: 'harp',
    percussion: 'orchestral', drumScale: 0.46, room: 0.3,
  },
  {
    theme: 'academy-main', file: 'main', title: '필드 전개', bars: 40,
    lead: 'bell', counter: 'flute', pad: 'strings', highStrings: 'violin', midStrings: 'viola',
    lowStrings: 'cello', woodwind: 'bassoon', brassSection: 'horn', lowBrass: 'trombone', harp: 'harp',
    percussion: 'hybrid-orchestra', drumScale: 0.88, room: 0.21,
  },
  {
    theme: 'academy-battle', file: 'battle', title: '전투 페이즈', bars: 44,
    lead: 'trumpet', counter: 'violin', pad: 'strings', highStrings: 'violin', midStrings: 'viola',
    lowStrings: 'cello', woodwind: 'oboe', brassSection: 'trumpet', lowBrass: 'trombone', harp: 'harp',
    percussion: 'hybrid-orchestra', drumScale: 1.18, room: 0.16,
  },
  {
    theme: 'academy-chain', file: 'chain', title: '체인 리액션', bars: 40,
    lead: 'celesta', counter: 'harp', pad: 'strings', highStrings: 'violin', midStrings: 'viola',
    lowStrings: 'cello', woodwind: 'flute', brassSection: 'horn', lowBrass: 'trombone', harp: 'harp',
    percussion: 'hybrid-orchestra', drumScale: 1.02, room: 0.25,
  },
  {
    theme: 'academy-danger', file: 'danger', title: '라이프 브레이크', bars: 44,
    lead: 'viola', counter: 'trumpet', pad: 'strings', highStrings: 'violin', midStrings: 'viola',
    lowStrings: 'cello', woodwind: 'oboe', brassSection: 'trumpet', lowBrass: 'trombone', harp: 'harp',
    percussion: 'hybrid-orchestra', drumScale: 1.24, room: 0.18,
  },
  {
    theme: 'academy-mika', file: 'mika', title: '별빛의 심판', bars: 40,
    lead: 'celesta', counter: 'violin', pad: 'strings', highStrings: 'violin', midStrings: 'viola',
    lowStrings: 'cello', woodwind: 'flute', brassSection: 'horn', lowBrass: 'trombone', harp: 'harp',
    percussion: 'hybrid-orchestra', drumScale: 1.06, room: 0.29,
  },
  {
    theme: 'academy-hina', file: 'hina', title: '규율의 포화', bars: 44,
    lead: 'trumpet', counter: 'viola', pad: 'strings', highStrings: 'violin', midStrings: 'viola',
    lowStrings: 'cello', woodwind: 'oboe', brassSection: 'trumpet', lowBrass: 'trombone', harp: 'harp',
    percussion: 'hybrid-orchestra', drumScale: 1.22, room: 0.16,
  },
  {
    theme: 'academy-yuuka', file: 'yuuka', title: '계산된 방벽', bars: 40,
    lead: 'vibraphone', counter: 'oboe', pad: 'strings', highStrings: 'violin', midStrings: 'viola',
    lowStrings: 'cello', woodwind: 'bassoon', brassSection: 'horn', lowBrass: 'trombone', harp: 'harp',
    percussion: 'orchestral', drumScale: 0.82, room: 0.23,
  },
  {
    theme: 'academy-victory', file: 'victory', title: '듀얼의 종례', bars: 36,
    lead: 'violin', counter: 'horn', pad: 'strings', highStrings: 'violin', midStrings: 'viola',
    lowStrings: 'cello', woodwind: 'flute', brassSection: 'trumpet', lowBrass: 'trombone', harp: 'harp',
    percussion: 'hybrid-orchestra', drumScale: 0.94, room: 0.28,
  },
  {
    theme: 'academy-defeat', file: 'defeat', title: '남겨진 카드', bars: 28,
    lead: 'harp', counter: 'cello', pad: 'strings', highStrings: 'violin', midStrings: 'viola',
    lowStrings: 'cello', woodwind: 'bassoon', brassSection: 'horn', lowBrass: 'trombone', harp: 'harp',
    percussion: 'orchestral', drumScale: 0.25, room: 0.36,
  },
]);

await renderPhysicalModelSoundtrack({
  tracks: DUAL_ACADEMY_RENDER_TRACKS,
  outputDir: OUTPUT_DIR,
  soundtrackName: 'Dual Academy TCG',
  renderer: 'sampled-orchestra-v3-vsco2-ce',
  channels: 2,
});
