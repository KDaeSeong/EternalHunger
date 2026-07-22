import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  decodePcmWave,
  encodePcm16StereoWave,
  pcmWavePeak,
  resampleAndTrimPcmWave,
} from './audio/pcmWave.mjs';
import {
  VSCO2_CE_MINI_FILES,
  VSCO2_CE_MINI_LIBRARY,
} from './audio/vsco2CeMiniCatalog.mjs';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const CLIENT_ROOT = path.resolve(SCRIPT_DIR, '..');
const sourceDir = process.argv[2] ? path.resolve(process.argv[2]) : null;
const outputDir = process.argv[3]
  ? path.resolve(process.argv[3])
  : path.join(CLIENT_ROOT, 'audio-source', 'vsco2-ce-mini');

if (!sourceDir) {
  throw new Error(
    `Usage: node scripts/prepare-vsco2-ce-mini.mjs <extracted-source-dir> [output-dir]\n`
    + `Download the official CC0 source archive from ${VSCO2_CE_MINI_LIBRARY.sourceArchive}`,
  );
}

await mkdir(outputDir, { recursive: true });
const files = [];
for (const file of VSCO2_CE_MINI_FILES) {
  const sourcePath = path.join(sourceDir, file);
  const source = decodePcmWave(await readFile(sourcePath));
  const prepared = resampleAndTrimPcmWave(source, VSCO2_CE_MINI_LIBRARY.sampleRate);
  const encoded = encodePcm16StereoWave(prepared);
  await writeFile(path.join(outputDir, file), encoded);
  files.push({
    file,
    sourceSampleRate: source.sampleRate,
    sourceBitsPerSample: source.bitsPerSample,
    frames: prepared.left.length,
    durationSeconds: Number((prepared.left.length / prepared.sampleRate).toFixed(3)),
    peak: Number(pcmWavePeak(prepared).toFixed(5)),
    bytes: encoded.length,
  });
  console.log(`${file}: ${(encoded.length / 1_048_576).toFixed(2)} MiB`);
}

const manifest = {
  ...VSCO2_CE_MINI_LIBRARY,
  preparedFormat: 'PCM 16-bit stereo WAV',
  files,
};
await writeFile(path.join(outputDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
console.log(`Prepared ${files.length} CC0 orchestral samples in ${outputDir}.`);
