import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  renderPhysicalModelSoundtrack,
} from './render-eternal-hunger-instrumental.mjs';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = path.resolve(SCRIPT_DIR, '..', 'public', 'audio', 'tonkatsu-teacher');

export const TONKATSU_TEACHER_RENDER_TRACKS = Object.freeze([
  {
    theme: 'tonkatsu-opening', file: 'opening', title: '가게 불을 켜다', bars: 36,
    lead: 'piano', counter: 'flute', pad: 'strings', highStrings: 'violin', midStrings: 'viola',
    lowStrings: 'cello', woodwind: 'clarinet', brassSection: 'horn', lowBrass: 'trombone', harp: 'harp',
    percussion: 'orchestral', drumScale: 0.45, room: 0.3,
  },
  {
    theme: 'tonkatsu-kitchen', file: 'kitchen', title: '바삭한 주방', bars: 40,
    lead: 'guitar', counter: 'flute', pad: 'strings', highStrings: 'violin', midStrings: 'viola',
    lowStrings: 'cello', woodwind: 'clarinet', brassSection: 'horn', lowBrass: 'trombone', harp: 'harp',
    percussion: 'hybrid-orchestra', drumScale: 0.98, room: 0.18,
  },
  {
    theme: 'tonkatsu-service', file: 'service', title: '점심시간의 행진', bars: 36,
    lead: 'clarinet', counter: 'guitar', pad: 'strings', highStrings: 'violin', midStrings: 'viola',
    lowStrings: 'cello', woodwind: 'flute', brassSection: 'horn', lowBrass: 'trombone', harp: 'harp',
    percussion: 'hybrid-orchestra', drumScale: 0.88, room: 0.2,
  },
  {
    theme: 'tonkatsu-growth', file: 'growth', title: '비법 연구 노트', bars: 36,
    lead: 'celesta', counter: 'piano', pad: 'choir', highStrings: 'violin', midStrings: 'viola',
    lowStrings: 'cello', woodwind: 'flute', brassSection: 'horn', lowBrass: 'trombone', harp: 'harp',
    percussion: 'orchestral', drumScale: 0.58, room: 0.29,
  },
  {
    theme: 'tonkatsu-contest', file: 'contest', title: '챔피언 테이블', bars: 44,
    lead: 'trumpet', counter: 'violin', pad: 'strings', highStrings: 'violin', midStrings: 'viola',
    lowStrings: 'cello', woodwind: 'clarinet', brassSection: 'trumpet', lowBrass: 'trombone', harp: 'harp',
    percussion: 'hybrid-orchestra', drumScale: 1.18, room: 0.16,
  },
  {
    theme: 'tonkatsu-judge', file: 'judge', title: '맛의 판정', bars: 40,
    lead: 'oboe', counter: 'celesta', pad: 'choir', highStrings: 'violin', midStrings: 'viola',
    lowStrings: 'cello', woodwind: 'oboe', brassSection: 'horn', lowBrass: 'trombone', harp: 'harp',
    percussion: 'orchestral', drumScale: 0.82, room: 0.24,
  },
  {
    theme: 'tonkatsu-celebration', file: 'celebration', title: '축하의 만찬', bars: 36,
    lead: 'violin', counter: 'trumpet', pad: 'strings', highStrings: 'violin', midStrings: 'viola',
    lowStrings: 'cello', woodwind: 'flute', brassSection: 'trumpet', lowBrass: 'trombone', harp: 'harp',
    percussion: 'hybrid-orchestra', drumScale: 0.96, room: 0.28,
  },
  {
    theme: 'tonkatsu-setback', file: 'setback', title: '다시 불을 지피다', bars: 28,
    lead: 'piano', counter: 'cello', pad: 'choir', highStrings: 'violin', midStrings: 'viola',
    lowStrings: 'cello', woodwind: 'oboe', brassSection: 'horn', lowBrass: 'trombone', harp: 'harp',
    percussion: 'orchestral', drumScale: 0.25, room: 0.36,
  },
]);

await renderPhysicalModelSoundtrack({
  tracks: TONKATSU_TEACHER_RENDER_TRACKS,
  outputDir: OUTPUT_DIR,
  soundtrackName: 'Tonkatsu Teacher',
  renderer: 'physical-model-v2-orchestra',
  channels: 2,
});
