import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  renderPhysicalModelSoundtrack,
} from './render-eternal-hunger-instrumental.mjs';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = path.resolve(SCRIPT_DIR, '..', 'public', 'audio', 'school-simulator');

export const SCHOOL_SIMULATOR_RENDER_TRACKS = Object.freeze([
  {
    theme: 'school-morning', file: 'morning', title: '아침 조회', bars: 34,
    lead: 'piano', counter: 'bell', pad: 'strings', highStrings: 'violin', midStrings: 'viola',
    lowStrings: 'cello', woodwind: 'flute', brassSection: 'horn', lowBrass: 'trombone', harp: 'harp',
    percussion: 'orchestral', drumScale: 0.42, room: 0.28,
  },
  {
    theme: 'school-classroom', file: 'classroom', title: '교실의 리듬', bars: 40,
    lead: 'clarinet', counter: 'piano', pad: 'strings', highStrings: 'violin', midStrings: 'viola',
    lowStrings: 'cello', woodwind: 'flute', brassSection: 'horn', lowBrass: 'trombone', harp: 'harp',
    percussion: 'orchestral', drumScale: 0.62, room: 0.24,
  },
  {
    theme: 'school-counseling-room', file: 'counseling', title: '상담실의 오후', bars: 34,
    lead: 'oboe', counter: 'cello', pad: 'choir', highStrings: 'violin', midStrings: 'viola',
    lowStrings: 'cello', woodwind: 'clarinet', brassSection: 'horn', lowBrass: 'trombone', harp: 'harp',
    percussion: 'orchestral', drumScale: 0.24, room: 0.38,
  },
  {
    theme: 'school-campus', file: 'campus', title: '캠퍼스 산책', bars: 38,
    lead: 'guitar', counter: 'flute', pad: 'strings', highStrings: 'violin', midStrings: 'viola',
    lowStrings: 'cello', woodwind: 'clarinet', brassSection: 'horn', lowBrass: 'trombone', harp: 'harp',
    percussion: 'orchestral', drumScale: 0.65, room: 0.26,
  },
  {
    theme: 'school-festival', file: 'festival', title: '축제 준비', bars: 44,
    lead: 'trumpet', counter: 'violin', pad: 'strings', highStrings: 'violin', midStrings: 'viola',
    lowStrings: 'cello', woodwind: 'flute', brassSection: 'trumpet', lowBrass: 'trombone', harp: 'harp',
    percussion: 'hybrid-orchestra', drumScale: 1.15, room: 0.19,
  },
  {
    theme: 'school-incident-alert', file: 'incident', title: '비상 방송', bars: 44,
    lead: 'horn', counter: 'trumpet', pad: 'choir', highStrings: 'violin', midStrings: 'viola',
    lowStrings: 'cello', woodwind: 'oboe', brassSection: 'trumpet', lowBrass: 'trombone', harp: 'harp',
    percussion: 'hybrid-orchestra', drumScale: 1.24, room: 0.16,
  },
  {
    theme: 'school-semester-finale', file: 'semester', title: '학기의 끝', bars: 36,
    lead: 'violin', counter: 'piano', pad: 'choir', highStrings: 'violin', midStrings: 'viola',
    lowStrings: 'cello', woodwind: 'flute', brassSection: 'horn', lowBrass: 'trombone', harp: 'harp',
    percussion: 'orchestral', drumScale: 0.58, room: 0.34,
  },
  {
    theme: 'school-afterschool', file: 'afterschool', title: '방과 후 기록', bars: 33,
    lead: 'celesta', counter: 'guitar', pad: 'choir', highStrings: 'violin', midStrings: 'viola',
    lowStrings: 'cello', woodwind: 'clarinet', brassSection: 'horn', lowBrass: 'trombone', harp: 'harp',
    percussion: 'orchestral', drumScale: 0.28, room: 0.39,
  },
]);

await renderPhysicalModelSoundtrack({
  tracks: SCHOOL_SIMULATOR_RENDER_TRACKS,
  outputDir: OUTPUT_DIR,
  soundtrackName: 'School Simulator',
  renderer: 'physical-model-v2-orchestra',
  channels: 2,
});
