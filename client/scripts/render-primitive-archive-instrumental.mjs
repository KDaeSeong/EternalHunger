import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  renderPhysicalModelSoundtrack,
} from './render-eternal-hunger-instrumental.mjs';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = path.resolve(SCRIPT_DIR, '..', 'public', 'audio', 'primitive-archive');

export const PRIMITIVE_ARCHIVE_RENDER_TRACKS = Object.freeze([
  { theme: 'archive-survival', file: 'survival', title: '불씨와 첫 발자국', bars: 20, lead: 'flute', counter: 'pluck', pad: 'choir', percussion: 'tribal', drumScale: 0.58, room: 0.24 },
  { theme: 'archive-frontier', file: 'frontier', title: '경계 너머', bars: 20, lead: 'flute', counter: 'bell', pad: 'strings', percussion: 'tribal', drumScale: 0.72, room: 0.22 },
  { theme: 'archive-insight', file: 'insight', title: '별 아래의 문답', bars: 20, lead: 'piano', counter: 'bell', pad: 'choir', percussion: 'tribal', drumScale: 0.42, room: 0.28 },
  { theme: 'archive-settlement', file: 'settlement', title: '돌과 나무의 노래', bars: 20, lead: 'pluck', counter: 'flute', pad: 'strings', percussion: 'tribal', drumScale: 0.82, room: 0.18 },
  { theme: 'archive-crisis', file: 'crisis', title: '겨울의 이빨', bars: 24, lead: 'brass', counter: 'strings', pad: 'choir', percussion: 'tribal', drumScale: 1.08, room: 0.15 },
  { theme: 'archive-era', file: 'era', title: '새 시대의 문', bars: 20, lead: 'brass', counter: 'bell', pad: 'strings', percussion: 'tribal', drumScale: 0.88, room: 0.2 },
  { theme: 'archive-legacy', file: 'legacy', title: '기록은 남는다', bars: 16, lead: 'piano', counter: 'flute', pad: 'choir', percussion: 'tribal', drumScale: 0.28, room: 0.3 },
]);

await renderPhysicalModelSoundtrack({
  tracks: PRIMITIVE_ARCHIVE_RENDER_TRACKS,
  outputDir: OUTPUT_DIR,
  soundtrackName: 'Civilization Archive',
});
