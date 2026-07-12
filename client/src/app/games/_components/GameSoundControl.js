'use client';

import GameActionIcon from './GameActionIcon';
import useGameSfx, { useGameSfxPreference } from '../_lib/useGameSfx';

export default function GameSoundControl({ theme = 'auto' }) {
  const playGameSfx = useGameSfx({ theme, volume: 0.13 });
  const { enabled, toggle } = useGameSfxPreference({ theme });
  const label = enabled ? '효과음 끄기' : '효과음 켜기';

  const handleToggle = () => {
    if (enabled) playGameSfx('audioOff');
    const next = toggle();
    if (next) playGameSfx('audioOn');
  };

  return (
    <button
      type="button"
      className={`games-sfx-toggle${enabled ? ' is-active' : ''}`}
      data-game-sfx="off"
      aria-label={label}
      aria-pressed={enabled}
      title={label}
      onClick={handleToggle}
    >
      <GameActionIcon action={enabled ? 'audio' : 'mute'} label={label} />
      <span className="sr-only">{label}</span>
    </button>
  );
}
