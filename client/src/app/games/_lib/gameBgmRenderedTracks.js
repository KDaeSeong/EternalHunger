function renderedTrack(folder, file, options = {}) {
  return Object.freeze({
    src: `/audio/${folder}/${file}.wav`,
    gain: 1.2,
    loop: true,
    loopStartSeconds: 0.85,
    renderer: 'physical-model-v1',
    ...options,
  });
}

const eternalHungerTrack = (file, options = {}) => renderedTrack('eternal-hunger', file, {
  renderer: 'physical-model-v2-orchestra',
  ...options,
});
const primitiveArchiveTrack = (file, options) => renderedTrack('primitive-archive', file, options);
const baVanguardTrack = (file, options = {}) => renderedTrack('ba-vanguard', file, {
  renderer: 'physical-model-v2-orchestra',
  ...options,
});
const baSrpgTrack = (file, options = {}) => renderedTrack('ba-srpg', file, {
  renderer: 'physical-model-v2-orchestra',
  ...options,
});

export const GAME_BGM_RENDERED_TRACKS = Object.freeze({
  'eternal-ready': eternalHungerTrack('ready', { gain: 1.16 }),
  'eternal-day': eternalHungerTrack('day', { gain: 1.22 }),
  'eternal-night': eternalHungerTrack('night', { gain: 1.24 }),
  'eternal-combat': eternalHungerTrack('combat', { gain: 1.18 }),
  'eternal-rift': eternalHungerTrack('rift', { gain: 1.2 }),
  'eternal-boss': eternalHungerTrack('boss', { gain: 1.14 }),
  'eternal-final': eternalHungerTrack('final', { gain: 1.16 }),
  'eternal-result': eternalHungerTrack('result', { gain: 1.2 }),
  'eternal-defeat': eternalHungerTrack('defeat', { gain: 1.2 }),
  'archive-survival': primitiveArchiveTrack('survival', { gain: 1.22 }),
  'archive-frontier': primitiveArchiveTrack('frontier', { gain: 1.2 }),
  'archive-insight': primitiveArchiveTrack('insight', { gain: 1.2 }),
  'archive-settlement': primitiveArchiveTrack('settlement', { gain: 1.22 }),
  'archive-crisis': primitiveArchiveTrack('crisis', { gain: 1.16 }),
  'archive-era': primitiveArchiveTrack('era', { gain: 1.18 }),
  'archive-legacy': primitiveArchiveTrack('legacy', { gain: 1.2 }),
  'vanguard-ready': baVanguardTrack('ready', { gain: 1.18 }),
  'vanguard-ride': baVanguardTrack('ride', { gain: 1.2 }),
  'vanguard-battle': baVanguardTrack('battle', { gain: 1.16 }),
  'vanguard-guard': baVanguardTrack('guard', { gain: 1.18 }),
  'vanguard-trigger': baVanguardTrack('trigger', { gain: 1.16 }),
  'vanguard-victory': baVanguardTrack('victory', { gain: 1.2 }),
  'vanguard-defeat': baVanguardTrack('defeat', { gain: 1.2 }),
  'srpg-command': baSrpgTrack('command', { gain: 1.18 }),
  'srpg-deployment': baSrpgTrack('deployment', { gain: 1.2 }),
  'srpg-town': baSrpgTrack('town', { gain: 1.2 }),
  'srpg-battle': baSrpgTrack('battle', { gain: 1.16 }),
  'srpg-crisis': baSrpgTrack('crisis', { gain: 1.14 }),
  'srpg-victory': baSrpgTrack('victory', { gain: 1.2 }),
  'srpg-defeat': baSrpgTrack('defeat', { gain: 1.2 }),
});

export function gameBgmRenderedTrack(theme) {
  return GAME_BGM_RENDERED_TRACKS[String(theme || '').trim().toLowerCase()] || null;
}
