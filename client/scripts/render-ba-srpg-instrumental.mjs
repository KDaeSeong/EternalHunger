import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  renderPhysicalModelSoundtrack,
} from './render-eternal-hunger-instrumental.mjs';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = path.resolve(SCRIPT_DIR, '..', 'public', 'audio', 'ba-srpg');

export const BA_SRPG_RENDER_TRACKS = Object.freeze([
  {
    theme: 'srpg-command', file: 'command', title: '작전실의 푸른 전파', bars: 36,
    lead: 'clarinet', counter: 'celesta', pad: 'strings', highStrings: 'violin', midStrings: 'viola',
    lowStrings: 'cello', woodwind: 'flute', brassSection: 'horn', lowBrass: 'trombone', harp: 'harp',
    percussion: 'orchestral', drumScale: 0.5, room: 0.28,
  },
  {
    theme: 'srpg-deployment', file: 'deployment', title: '출정 준비 완료', bars: 40,
    lead: 'horn', counter: 'guitar', pad: 'strings', highStrings: 'violin', midStrings: 'viola',
    lowStrings: 'cello', woodwind: 'clarinet', brassSection: 'trumpet', lowBrass: 'trombone', harp: 'harp',
    percussion: 'hybrid-orchestra', drumScale: 0.96, room: 0.19,
  },
  {
    theme: 'srpg-town', file: 'town', title: '거점의 오후', bars: 36,
    lead: 'piano', counter: 'flute', pad: 'strings', highStrings: 'violin', midStrings: 'viola',
    lowStrings: 'cello', woodwind: 'clarinet', brassSection: 'horn', lowBrass: 'trombone', harp: 'harp',
    percussion: 'orchestral', drumScale: 0.38, room: 0.31,
  },
  {
    theme: 'srpg-battle', file: 'battle', title: '격자 위의 교전', bars: 44,
    lead: 'trumpet', counter: 'violin', pad: 'strings', highStrings: 'violin', midStrings: 'viola',
    lowStrings: 'cello', woodwind: 'clarinet', brassSection: 'trumpet', lowBrass: 'trombone', harp: 'harp',
    percussion: 'hybrid-orchestra', drumScale: 1.18, room: 0.16,
  },
  {
    theme: 'srpg-crisis', file: 'crisis', title: '붉은 경계선', bars: 44,
    lead: 'viola', counter: 'trumpet', pad: 'choir', highStrings: 'violin', midStrings: 'viola',
    lowStrings: 'cello', woodwind: 'oboe', brassSection: 'trumpet', lowBrass: 'trombone', harp: 'harp',
    percussion: 'hybrid-orchestra', drumScale: 1.24, room: 0.19,
  },
  {
    theme: 'srpg-victory', file: 'victory', title: '임무 완료 보고', bars: 36,
    lead: 'violin', counter: 'horn', pad: 'strings', highStrings: 'violin', midStrings: 'viola',
    lowStrings: 'cello', woodwind: 'flute', brassSection: 'trumpet', lowBrass: 'trombone', harp: 'harp',
    percussion: 'hybrid-orchestra', drumScale: 0.96, room: 0.27,
  },
  {
    theme: 'srpg-defeat', file: 'defeat', title: '귀환하지 못한 신호', bars: 28,
    lead: 'cello', counter: 'piano', pad: 'choir', highStrings: 'violin', midStrings: 'viola',
    lowStrings: 'cello', woodwind: 'oboe', brassSection: 'horn', lowBrass: 'trombone', harp: 'harp',
    percussion: 'orchestral', drumScale: 0.26, room: 0.35,
  },
]);

await renderPhysicalModelSoundtrack({
  tracks: BA_SRPG_RENDER_TRACKS,
  outputDir: OUTPUT_DIR,
  soundtrackName: 'BA SRPG',
  renderer: 'physical-model-v2-orchestra',
  channels: 2,
});
