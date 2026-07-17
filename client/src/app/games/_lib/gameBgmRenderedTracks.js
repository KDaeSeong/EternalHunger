const ETERNAL_HUNGER_AUDIO_ROOT = '/audio/eternal-hunger';

function renderedTrack(file, options = {}) {
  return Object.freeze({
    src: `${ETERNAL_HUNGER_AUDIO_ROOT}/${file}.wav`,
    gain: 1.2,
    loop: true,
    loopStartSeconds: 0.85,
    renderer: 'physical-model-v1',
    ...options,
  });
}

export const GAME_BGM_RENDERED_TRACKS = Object.freeze({
  'eternal-ready': renderedTrack('ready', { gain: 1.16 }),
  'eternal-day': renderedTrack('day', { gain: 1.22 }),
  'eternal-night': renderedTrack('night', { gain: 1.24 }),
  'eternal-combat': renderedTrack('combat', { gain: 1.18 }),
  'eternal-rift': renderedTrack('rift', { gain: 1.2 }),
  'eternal-boss': renderedTrack('boss', { gain: 1.14 }),
  'eternal-final': renderedTrack('final', { gain: 1.16 }),
  'eternal-result': renderedTrack('result', { gain: 1.2 }),
  'eternal-defeat': renderedTrack('defeat', { gain: 1.2 }),
});

export function gameBgmRenderedTrack(theme) {
  return GAME_BGM_RENDERED_TRACKS[String(theme || '').trim().toLowerCase()] || null;
}
