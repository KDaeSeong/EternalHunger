function clamp(value, min, max) {
  return Math.min(max, Math.max(min, Number(value || 0)));
}

function readSigned24(buffer, offset) {
  const value = buffer[offset] | (buffer[offset + 1] << 8) | (buffer[offset + 2] << 16);
  return value & 0x80_0000 ? value - 0x100_0000 : value;
}

export function decodePcmWave(buffer) {
  if (buffer.toString('ascii', 0, 4) !== 'RIFF' || buffer.toString('ascii', 8, 12) !== 'WAVE') {
    throw new Error('Only RIFF/WAVE audio is supported.');
  }

  let format = null;
  let dataOffset = -1;
  let dataSize = 0;
  for (let offset = 12; offset + 8 <= buffer.length;) {
    const chunkId = buffer.toString('ascii', offset, offset + 4);
    const chunkSize = buffer.readUInt32LE(offset + 4);
    const chunkDataOffset = offset + 8;
    if (chunkId === 'fmt ') {
      format = {
        audioFormat: buffer.readUInt16LE(chunkDataOffset),
        channels: buffer.readUInt16LE(chunkDataOffset + 2),
        sampleRate: buffer.readUInt32LE(chunkDataOffset + 4),
        blockAlign: buffer.readUInt16LE(chunkDataOffset + 12),
        bitsPerSample: buffer.readUInt16LE(chunkDataOffset + 14),
      };
    } else if (chunkId === 'data') {
      dataOffset = chunkDataOffset;
      dataSize = Math.min(chunkSize, buffer.length - chunkDataOffset);
    }
    offset = chunkDataOffset + chunkSize + (chunkSize % 2);
  }

  if (!format || dataOffset < 0) throw new Error('WAVE file is missing fmt or data chunks.');
  if (format.audioFormat !== 1) throw new Error(`Unsupported WAVE format: ${format.audioFormat}`);
  if (![1, 2].includes(format.channels)) throw new Error(`Unsupported channel count: ${format.channels}`);
  if (![16, 24].includes(format.bitsPerSample)) {
    throw new Error(`Unsupported PCM depth: ${format.bitsPerSample}`);
  }

  const bytesPerSample = format.bitsPerSample / 8;
  const frameCount = Math.floor(dataSize / format.blockAlign);
  const left = new Float32Array(frameCount);
  const right = new Float32Array(frameCount);
  for (let frame = 0; frame < frameCount; frame += 1) {
    const frameOffset = dataOffset + frame * format.blockAlign;
    for (let channel = 0; channel < format.channels; channel += 1) {
      const sampleOffset = frameOffset + channel * bytesPerSample;
      const value = format.bitsPerSample === 16
        ? buffer.readInt16LE(sampleOffset) / 32_768
        : readSigned24(buffer, sampleOffset) / 8_388_608;
      if (channel === 0) left[frame] = value;
      else right[frame] = value;
    }
    if (format.channels === 1) right[frame] = left[frame];
  }

  return {
    channels: 2,
    sampleRate: format.sampleRate,
    bitsPerSample: format.bitsPerSample,
    left,
    right,
  };
}

export function resampleAndTrimPcmWave(source, targetSampleRate, {
  threshold = 0.00045,
  leadSeconds = 0.018,
  tailSeconds = 0.16,
  maxSeconds = 14,
} = {}) {
  const sourceFrames = source.left.length;
  const leadFrames = Math.round(source.sampleRate * leadSeconds);
  const tailFrames = Math.round(source.sampleRate * tailSeconds);
  let firstActive = 0;
  let lastActive = sourceFrames - 1;

  while (
    firstActive < sourceFrames
    && Math.max(Math.abs(source.left[firstActive]), Math.abs(source.right[firstActive])) < threshold
  ) firstActive += 1;
  while (
    lastActive > firstActive
    && Math.max(Math.abs(source.left[lastActive]), Math.abs(source.right[lastActive])) < threshold
  ) lastActive -= 1;

  const startFrame = Math.max(0, firstActive - leadFrames);
  const requestedEndFrame = Math.min(sourceFrames, lastActive + tailFrames + 1);
  const maxSourceFrames = Math.round(maxSeconds * source.sampleRate);
  const endFrame = Math.min(requestedEndFrame, startFrame + maxSourceFrames);
  const sourceSpan = Math.max(1, endFrame - startFrame);
  const ratio = source.sampleRate / targetSampleRate;
  const outputFrames = Math.max(1, Math.ceil(sourceSpan / ratio));
  const left = new Float32Array(outputFrames);
  const right = new Float32Array(outputFrames);

  for (let frame = 0; frame < outputFrames; frame += 1) {
    const sourcePosition = Math.min(endFrame - 1, startFrame + frame * ratio);
    const index = Math.floor(sourcePosition);
    const nextIndex = Math.min(endFrame - 1, index + 1);
    const fraction = sourcePosition - index;
    left[frame] = source.left[index] + (source.left[nextIndex] - source.left[index]) * fraction;
    right[frame] = source.right[index] + (source.right[nextIndex] - source.right[index]) * fraction;
  }

  const fadeFrames = Math.min(outputFrames, Math.round(targetSampleRate * 0.035));
  for (let frame = 0; frame < fadeFrames; frame += 1) {
    const gain = frame / Math.max(1, fadeFrames - 1);
    left[frame] *= gain;
    right[frame] *= gain;
  }

  return {
    channels: 2,
    sampleRate: targetSampleRate,
    bitsPerSample: 16,
    left,
    right,
  };
}

export function pcmWavePeak(wave) {
  let peak = 0;
  for (let frame = 0; frame < wave.left.length; frame += 1) {
    peak = Math.max(peak, Math.abs(wave.left[frame]), Math.abs(wave.right[frame]));
  }
  return peak;
}

export function encodePcm16StereoWave(wave) {
  const frameCount = Math.min(wave.left.length, wave.right.length);
  const channels = 2;
  const bytesPerSample = 2;
  const blockAlign = channels * bytesPerSample;
  const dataSize = frameCount * blockAlign;
  const output = Buffer.alloc(44 + dataSize);
  output.write('RIFF', 0, 'ascii');
  output.writeUInt32LE(36 + dataSize, 4);
  output.write('WAVE', 8, 'ascii');
  output.write('fmt ', 12, 'ascii');
  output.writeUInt32LE(16, 16);
  output.writeUInt16LE(1, 20);
  output.writeUInt16LE(channels, 22);
  output.writeUInt32LE(wave.sampleRate, 24);
  output.writeUInt32LE(wave.sampleRate * blockAlign, 28);
  output.writeUInt16LE(blockAlign, 32);
  output.writeUInt16LE(16, 34);
  output.write('data', 36, 'ascii');
  output.writeUInt32LE(dataSize, 40);

  for (let frame = 0; frame < frameCount; frame += 1) {
    const left = clamp(wave.left[frame], -1, 1);
    const right = clamp(wave.right[frame], -1, 1);
    output.writeInt16LE(Math.round(left * (left < 0 ? 32_768 : 32_767)), 44 + frame * 4);
    output.writeInt16LE(Math.round(right * (right < 0 ? 32_768 : 32_767)), 46 + frame * 4);
  }
  return output;
}
