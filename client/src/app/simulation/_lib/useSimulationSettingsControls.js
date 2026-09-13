import { areCharacterSkillsEnabled } from './characterSkillRuntime';
import {
  applyMatchTeams,
  normalizeMatchMode,
} from './matchRosterRuntime';
import {
  buildCharacterSkillModeSettings,
  buildCharacterSkillsToggleSettings,
} from './simulationPageRuntime';

export function useSimulationSettingsControls({
  day,
  isGameOver,
  setSettings = () => {},
  setSurvivors = () => {},
  settings,
  runLockedRef,
} = {}) {
  const handleMatchModeChange = (value) => {
    if (day > 0 || isGameOver || runLockedRef?.current) return;
    const matchMode = normalizeMatchMode(value);
    const nextSettings = { ...(settings || {}), matchMode };
    try {
      window.localStorage.setItem('eh_sim_match_mode', matchMode);
    } catch {}
    setSettings(nextSettings);
    if (day === 0 && !isGameOver) {
      setSurvivors((prev) => applyMatchTeams(prev, nextSettings));
    }
  };

  const characterSkillsEnabled = areCharacterSkillsEnabled(buildCharacterSkillModeSettings(settings));

  const handleCharacterSkillsToggle = (enabled) => {
    if (day > 0 || isGameOver || runLockedRef?.current) return;
    const on = !!enabled;
    const nextSettings = buildCharacterSkillsToggleSettings(settings, on);
    try {
      window.localStorage.setItem('eh_sim_character_skills', on ? '1' : '0');
    } catch {}
    setSettings(nextSettings);
  };

  return {
    characterSkillsEnabled,
    handleCharacterSkillsToggle,
    handleMatchModeChange,
  };
}
