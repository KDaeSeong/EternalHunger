import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  renderPhysicalModelSoundtrack,
} from './render-eternal-hunger-instrumental.mjs';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = path.resolve(SCRIPT_DIR, '..', 'public', 'audio', 'ba-vanguard');

export const BA_VANGUARD_RENDER_TRACKS = Object.freeze([
  {
    theme: 'vanguard-ready', file: 'ready', title: '셔플 전의 정적', bars: 36,
    lead: 'piano', counter: 'clarinet', pad: 'strings', highStrings: 'violin', midStrings: 'viola',
    lowStrings: 'cello', woodwind: 'flute', brassSection: 'horn', lowBrass: 'trombone', harp: 'harp',
    percussion: 'orchestral', drumScale: 0.48, room: 0.28,
  },
  {
    theme: 'vanguard-ride', file: 'ride', title: '라이드 더 뱅가드', bars: 40,
    lead: 'violin', counter: 'guitar', pad: 'strings', highStrings: 'violin', midStrings: 'viola',
    lowStrings: 'cello', woodwind: 'flute', brassSection: 'horn', lowBrass: 'trombone', harp: 'harp',
    percussion: 'hybrid-orchestra', drumScale: 0.94, room: 0.2,
  },
  {
    theme: 'vanguard-battle', file: 'battle', title: '트윈 드라이브', bars: 44,
    lead: 'trumpet', counter: 'violin', pad: 'strings', highStrings: 'violin', midStrings: 'viola',
    lowStrings: 'cello', woodwind: 'clarinet', brassSection: 'trumpet', lowBrass: 'trombone', harp: 'harp',
    percussion: 'hybrid-orchestra', drumScale: 1.16, room: 0.16,
  },
  {
    theme: 'vanguard-guard', file: 'guard', title: '실드 인터셉트', bars: 40,
    lead: 'oboe', counter: 'cello', pad: 'choir', highStrings: 'violin', midStrings: 'viola',
    lowStrings: 'cello', woodwind: 'oboe', brassSection: 'horn', lowBrass: 'trombone', harp: 'harp',
    percussion: 'orchestral', drumScale: 0.86, room: 0.24,
  },
  {
    theme: 'vanguard-trigger', file: 'trigger', title: '체크 더 트리거', bars: 44,
    lead: 'celesta', counter: 'trumpet', pad: 'choir', highStrings: 'violin', midStrings: 'viola',
    lowStrings: 'cello', woodwind: 'flute', brassSection: 'trumpet', lowBrass: 'trombone', harp: 'harp',
    percussion: 'hybrid-orchestra', drumScale: 1.2, room: 0.22,
  },
  {
    theme: 'vanguard-victory', file: 'victory', title: '스탠드 업, 빅토리', bars: 36,
    lead: 'violin', counter: 'horn', pad: 'strings', highStrings: 'violin', midStrings: 'viola',
    lowStrings: 'cello', woodwind: 'flute', brassSection: 'trumpet', lowBrass: 'trombone', harp: 'harp',
    percussion: 'hybrid-orchestra', drumScale: 0.98, room: 0.26,
  },
  {
    theme: 'vanguard-defeat', file: 'defeat', title: '엔드 페이즈', bars: 28,
    lead: 'piano', counter: 'cello', pad: 'choir', highStrings: 'violin', midStrings: 'viola',
    lowStrings: 'cello', woodwind: 'oboe', brassSection: 'horn', lowBrass: 'trombone', harp: 'harp',
    percussion: 'orchestral', drumScale: 0.28, room: 0.34,
  },
]);

await renderPhysicalModelSoundtrack({
  tracks: BA_VANGUARD_RENDER_TRACKS,
  outputDir: OUTPUT_DIR,
  soundtrackName: 'BA Vanguard',
  renderer: 'physical-model-v2-orchestra',
  channels: 2,
});
