import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  renderPhysicalModelSoundtrack,
} from './render-eternal-hunger-instrumental.mjs';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = path.resolve(SCRIPT_DIR, '..', 'public', 'audio', 'si-coding-sim');

export const SI_CODING_RENDER_TRACKS = Object.freeze([
  {
    theme: 'coding-focus', file: 'focus', title: '집중 모드', bars: 36,
    lead: 'vibraphone', counter: 'celesta', pad: 'strings', highStrings: 'violin', midStrings: 'viola',
    lowStrings: 'cello', woodwind: 'bassoon', brassSection: 'horn', lowBrass: 'trombone', harp: 'harp',
    percussion: 'orchestral', drumScale: 0.52, room: 0.26,
  },
  {
    theme: 'coding-docs', file: 'docs', title: '명세의 여백', bars: 34,
    lead: 'oboe', counter: 'harp', pad: 'strings', highStrings: 'violin', midStrings: 'viola',
    lowStrings: 'cello', woodwind: 'flute', brassSection: 'horn', lowBrass: 'trombone', harp: 'harp',
    percussion: 'orchestral', drumScale: 0.28, room: 0.36,
  },
  {
    theme: 'coding-execution', file: 'execution', title: '실행 파이프라인', bars: 42,
    lead: 'violin', counter: 'vibraphone', pad: 'strings', highStrings: 'violin', midStrings: 'viola',
    lowStrings: 'cello', woodwind: 'bassoon', brassSection: 'trumpet', lowBrass: 'trombone', harp: 'harp',
    percussion: 'hybrid-orchestra', drumScale: 1.02, room: 0.19,
  },
  {
    theme: 'coding-audit', file: 'audit', title: '리뷰 대기열', bars: 38,
    lead: 'oboe', counter: 'vibraphone', pad: 'strings', highStrings: 'violin', midStrings: 'viola',
    lowStrings: 'cello', woodwind: 'bassoon', brassSection: 'horn', lowBrass: 'trombone', harp: 'harp',
    percussion: 'orchestral', drumScale: 0.6, room: 0.27,
  },
  {
    theme: 'coding-risk', file: 'risk', title: '장애 대응', bars: 44,
    lead: 'horn', counter: 'cello', pad: 'strings', highStrings: 'violin', midStrings: 'viola',
    lowStrings: 'cello', woodwind: 'oboe', brassSection: 'trumpet', lowBrass: 'trombone', harp: 'harp',
    percussion: 'hybrid-orchestra', drumScale: 1.26, room: 0.16,
  },
  {
    theme: 'coding-success', file: 'success', title: '그린 빌드', bars: 36,
    lead: 'trumpet', counter: 'celesta', pad: 'strings', highStrings: 'violin', midStrings: 'viola',
    lowStrings: 'cello', woodwind: 'flute', brassSection: 'trumpet', lowBrass: 'trombone', harp: 'harp',
    percussion: 'hybrid-orchestra', drumScale: 0.88, room: 0.25,
  },
  {
    theme: 'coding-delivery', file: 'delivery', title: '릴리스 완료', bars: 40,
    lead: 'violin', counter: 'bell', pad: 'strings', highStrings: 'violin', midStrings: 'viola',
    lowStrings: 'cello', woodwind: 'flute', brassSection: 'horn', lowBrass: 'trombone', harp: 'harp',
    percussion: 'hybrid-orchestra', drumScale: 0.82, room: 0.3,
  },
]);

await renderPhysicalModelSoundtrack({
  tracks: SI_CODING_RENDER_TRACKS,
  outputDir: OUTPUT_DIR,
  soundtrackName: 'SI Coding Simulator',
  renderer: 'sampled-orchestra-v3-vsco2-ce',
  channels: 2,
});
