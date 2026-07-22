import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  renderPhysicalModelSoundtrack,
} from './render-eternal-hunger-instrumental.mjs';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = path.resolve(SCRIPT_DIR, '..', 'public', 'audio', 'company-report');

export const COMPANY_REPORT_RENDER_TRACKS = Object.freeze([
  {
    theme: 'company-board', file: 'board', title: '개장 전 브리핑', bars: 34,
    lead: 'piano', counter: 'clarinet', pad: 'strings', highStrings: 'violin', midStrings: 'viola',
    lowStrings: 'cello', woodwind: 'flute', brassSection: 'horn', lowBrass: 'trombone', harp: 'harp',
    percussion: 'orchestral', drumScale: 0.35, room: 0.29,
  },
  {
    theme: 'company-trade', file: 'trade', title: '주문 흐름', bars: 40,
    lead: 'guitar', counter: 'flute', pad: 'strings', highStrings: 'violin', midStrings: 'viola',
    lowStrings: 'cello', woodwind: 'clarinet', brassSection: 'horn', lowBrass: 'trombone', harp: 'harp',
    percussion: 'hybrid-orchestra', drumScale: 0.78, room: 0.19,
  },
  {
    theme: 'company-closing', file: 'closing', title: '월말의 숫자', bars: 40,
    lead: 'cello', counter: 'piano', pad: 'choir', highStrings: 'violin', midStrings: 'viola',
    lowStrings: 'cello', woodwind: 'oboe', brassSection: 'horn', lowBrass: 'trombone', harp: 'harp',
    percussion: 'orchestral', drumScale: 0.42, room: 0.33,
  },
  {
    theme: 'company-global', file: 'global', title: '환율의 파도', bars: 42,
    lead: 'violin', counter: 'flute', pad: 'strings', highStrings: 'violin', midStrings: 'viola',
    lowStrings: 'cello', woodwind: 'clarinet', brassSection: 'trumpet', lowBrass: 'trombone', harp: 'harp',
    percussion: 'hybrid-orchestra', drumScale: 0.92, room: 0.22,
  },
  {
    theme: 'company-capital', file: 'capital', title: '시장 개장', bars: 43,
    lead: 'trumpet', counter: 'violin', pad: 'strings', highStrings: 'violin', midStrings: 'viola',
    lowStrings: 'cello', woodwind: 'flute', brassSection: 'trumpet', lowBrass: 'trombone', harp: 'harp',
    percussion: 'hybrid-orchestra', drumScale: 1.1, room: 0.18,
  },
  {
    theme: 'company-audit', file: 'audit', title: '원장의 잔향', bars: 33,
    lead: 'oboe', counter: 'celesta', pad: 'choir', highStrings: 'violin', midStrings: 'viola',
    lowStrings: 'cello', woodwind: 'clarinet', brassSection: 'horn', lowBrass: 'trombone', harp: 'harp',
    percussion: 'orchestral', drumScale: 0.2, room: 0.4,
  },
  {
    theme: 'company-crisis', file: 'crisis', title: '현금 경보', bars: 44,
    lead: 'horn', counter: 'trumpet', pad: 'choir', highStrings: 'violin', midStrings: 'viola',
    lowStrings: 'cello', woodwind: 'oboe', brassSection: 'trumpet', lowBrass: 'trombone', harp: 'harp',
    percussion: 'hybrid-orchestra', drumScale: 1.24, room: 0.16,
  },
]);

await renderPhysicalModelSoundtrack({
  tracks: COMPANY_REPORT_RENDER_TRACKS,
  outputDir: OUTPUT_DIR,
  soundtrackName: 'Company Report',
  renderer: 'physical-model-v2-orchestra',
  channels: 2,
});
