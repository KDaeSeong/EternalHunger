import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  renderPhysicalModelSoundtrack,
} from './render-eternal-hunger-instrumental.mjs';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = path.resolve(SCRIPT_DIR, '..', 'public', 'audio', 'twenty-questions');

export const TWENTY_QUESTIONS_RENDER_TRACKS = Object.freeze([
  {
    theme: 'twenty-lobby', file: 'lobby', title: '열린 문제집', bars: 34,
    lead: 'vibraphone', counter: 'flute', pad: 'strings', highStrings: 'violin', midStrings: 'viola',
    lowStrings: 'cello', woodwind: 'bassoon', brassSection: 'horn', lowBrass: 'trombone', harp: 'harp',
    percussion: 'orchestral', drumScale: 0.2, room: 0.4,
  },
  {
    theme: 'twenty-create', file: 'create', title: '비밀을 봉인하다', bars: 36,
    lead: 'harp', counter: 'vibraphone', pad: 'strings', highStrings: 'violin', midStrings: 'viola',
    lowStrings: 'cello', woodwind: 'flute', brassSection: 'horn', lowBrass: 'trombone', harp: 'harp',
    percussion: 'orchestral', drumScale: 0.32, room: 0.32,
  },
  {
    theme: 'twenty-inquiry', file: 'inquiry', title: '단서의 연쇄', bars: 38,
    lead: 'bassoon', counter: 'vibraphone', pad: 'strings', highStrings: 'violin', midStrings: 'viola',
    lowStrings: 'cello', woodwind: 'oboe', brassSection: 'horn', lowBrass: 'trombone', harp: 'harp',
    percussion: 'orchestral', drumScale: 0.4, room: 0.3,
  },
  {
    theme: 'twenty-pending', file: 'pending', title: '대답을 기다리며', bars: 38,
    lead: 'bassoon', counter: 'celesta', pad: 'strings', highStrings: 'violin', midStrings: 'viola',
    lowStrings: 'cello', woodwind: 'flute', brassSection: 'horn', lowBrass: 'trombone', harp: 'harp',
    percussion: 'orchestral', drumScale: 0.5, room: 0.3,
  },
  {
    theme: 'twenty-guess', file: 'guess', title: '마지막 가설', bars: 42,
    lead: 'violin', counter: 'bassoon', pad: 'strings', highStrings: 'violin', midStrings: 'viola',
    lowStrings: 'cello', woodwind: 'oboe', brassSection: 'trumpet', lowBrass: 'trombone', harp: 'harp',
    percussion: 'hybrid-orchestra', drumScale: 1.02, room: 0.18,
  },
  {
    theme: 'twenty-reveal', file: 'reveal', title: '비밀이 풀리다', bars: 36,
    lead: 'flute', counter: 'bell', pad: 'strings', highStrings: 'violin', midStrings: 'viola',
    lowStrings: 'cello', woodwind: 'bassoon', brassSection: 'trumpet', lowBrass: 'trombone', harp: 'harp',
    percussion: 'hybrid-orchestra', drumScale: 0.68, room: 0.36,
  },
  {
    theme: 'twenty-setback', file: 'setback', title: '닫힌 가능성', bars: 34,
    lead: 'oboe', counter: 'bassoon', pad: 'strings', highStrings: 'violin', midStrings: 'viola',
    lowStrings: 'cello', woodwind: 'oboe', brassSection: 'horn', lowBrass: 'trombone', harp: 'harp',
    percussion: 'orchestral', drumScale: 0.16, room: 0.44,
  },
]);

await renderPhysicalModelSoundtrack({
  tracks: TWENTY_QUESTIONS_RENDER_TRACKS,
  outputDir: OUTPUT_DIR,
  soundtrackName: 'Twenty Questions',
  renderer: 'sampled-orchestra-v3-vsco2-ce',
  channels: 2,
});
