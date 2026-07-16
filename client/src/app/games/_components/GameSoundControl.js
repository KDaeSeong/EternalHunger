'use client';

import GameActionIcon from './GameActionIcon';
import useGameSfx, { useGameSfxPreference } from '../_lib/useGameSfx';
import { useGameBgm } from './GameBgmProvider';

export default function GameSoundControl({ theme = 'auto' }) {
  const playGameSfx = useGameSfx({ theme, volume: 0.13 });
  const { enabled: sfxEnabled, toggle: toggleSfx } = useGameSfxPreference({ theme });
  const {
    enabled: musicEnabled,
    isAvailable: musicAvailable,
    label: musicLabel,
    playing,
    setVolume,
    toggleMusic,
    volume,
  } = useGameBgm();
  const sfxLabel = sfxEnabled ? '효과음 끄기' : '효과음 켜기';
  const musicControlLabel = musicEnabled ? '배경음 끄기' : '배경음 켜기';
  const menuLabel = `오디오 설정 · 효과음 ${sfxEnabled ? '켜짐' : '꺼짐'} · 배경음 ${musicEnabled ? '켜짐' : '꺼짐'}`;

  const handleSfxToggle = () => {
    if (sfxEnabled) playGameSfx('audioOff');
    const next = toggleSfx();
    if (next) playGameSfx('audioOn');
  };

  const handleMusicToggle = () => {
    const next = toggleMusic();
    if (sfxEnabled) playGameSfx(next ? 'audioOn' : 'audioOff');
  };

  return (
    <details className="games-audio-menu">
      <summary
        className={`games-sfx-toggle${sfxEnabled || musicEnabled ? ' is-active' : ''}`}
        data-game-sfx="off"
        aria-label={menuLabel}
        title={menuLabel}
      >
        <GameActionIcon action={playing ? 'music' : sfxEnabled ? 'audio' : 'mute'} label={menuLabel} />
        <span className="sr-only">{menuLabel}</span>
      </summary>
      <div className="games-audio-menu__panel" aria-label="오디오 설정 메뉴">
        <div className="games-audio-menu__toggles">
          <button
            type="button"
            className={sfxEnabled ? 'is-active' : ''}
            data-game-sfx="off"
            aria-label={sfxLabel}
            aria-pressed={sfxEnabled}
            title={sfxLabel}
            onClick={handleSfxToggle}
          >
            <GameActionIcon action={sfxEnabled ? 'audio' : 'mute'} label={sfxLabel} />
          </button>
          <button
            type="button"
            className={musicEnabled ? 'is-active' : ''}
            data-game-sfx="off"
            aria-label={musicControlLabel}
            aria-pressed={musicEnabled}
            title={`${musicControlLabel}${musicLabel ? ` · ${musicLabel}` : ''}`}
            disabled={!musicAvailable}
            onClick={handleMusicToggle}
          >
            <GameActionIcon action={musicEnabled ? 'music' : 'music-off'} label={musicControlLabel} />
          </button>
        </div>
        <label className="games-audio-menu__volume" title={`배경음 볼륨 ${Math.round(volume * 100)}%`}>
          <GameActionIcon action="audio" label="배경음 볼륨" />
          <span className="sr-only">배경음 볼륨</span>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={volume}
            disabled={!musicEnabled}
            aria-label="배경음 볼륨"
            aria-valuetext={`${Math.round(volume * 100)}%`}
            onChange={(event) => setVolume(event.target.value)}
          />
        </label>
      </div>
    </details>
  );
}
