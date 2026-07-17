export const BA_SRPG_BGM_SCENES = Object.freeze({
  command: 'srpg-command',
  deployment: 'srpg-deployment',
  town: 'srpg-town',
  battle: 'srpg-battle',
  crisis: 'srpg-crisis',
  victory: 'srpg-victory',
  defeat: 'srpg-defeat',
});

export const BA_SRPG_SOUNDTRACK = Object.freeze([
  Object.freeze({ scene: 'command', theme: BA_SRPG_BGM_SCENES.command, title: '작전실의 푸른 전파', icon: 'srpg-command' }),
  Object.freeze({ scene: 'deployment', theme: BA_SRPG_BGM_SCENES.deployment, title: '출정 준비 완료', icon: 'srpg-deployment' }),
  Object.freeze({ scene: 'town', theme: BA_SRPG_BGM_SCENES.town, title: '거점의 오후', icon: 'srpg-town' }),
  Object.freeze({ scene: 'battle', theme: BA_SRPG_BGM_SCENES.battle, title: '격자 위의 교전', icon: 'srpg-battle' }),
  Object.freeze({ scene: 'crisis', theme: BA_SRPG_BGM_SCENES.crisis, title: '붉은 경계선', icon: 'srpg-crisis' }),
  Object.freeze({ scene: 'victory', theme: BA_SRPG_BGM_SCENES.victory, title: '임무 완료 보고', icon: 'srpg-victory' }),
  Object.freeze({ scene: 'defeat', theme: BA_SRPG_BGM_SCENES.defeat, title: '귀환하지 못한 신호', icon: 'srpg-defeat' }),
]);

function hpRatio(rows) {
  if (!Array.isArray(rows) || !rows.length) return 1;
  const current = rows.reduce((sum, row) => sum + Math.max(0, Number(row?.hp || 0)), 0);
  const maximum = rows.reduce((sum, row) => sum + Math.max(1, Number(row?.maxHp || row?.hp || 1)), 0);
  return maximum > 0 ? current / maximum : 1;
}

export function resolveBaSrpgBgmScene({ activeTabId = 'mission', battle, battleForecast } = {}) {
  const phase = String(battle?.phase || 'player');
  if (phase === 'cleared') return BA_SRPG_BGM_SCENES.victory;
  if (phase === 'failed') return BA_SRPG_BGM_SCENES.defeat;

  if (activeTabId === 'town') return BA_SRPG_BGM_SCENES.town;
  if (activeTabId === 'mission') return BA_SRPG_BGM_SCENES.deployment;
  if (activeTabId === 'campaign-expansion' || activeTabId === 'inventory') {
    return BA_SRPG_BGM_SCENES.command;
  }

  const allies = Array.isArray(battle?.units) ? battle.units : [];
  const aliveAllies = allies.filter((unit) => Number(unit?.hp || 0) > 0).length;
  const crisis = String(battleForecast?.threatLevel || '') === '위험'
    || Number(battleForecast?.highThreatCount || 0) > 0
    || (allies.length > 0 && aliveAllies <= Math.max(1, Math.floor(allies.length / 2)))
    || hpRatio(allies) <= 0.42;

  return crisis ? BA_SRPG_BGM_SCENES.crisis : BA_SRPG_BGM_SCENES.battle;
}

export function baSrpgResultMusic(presentation, cue = '') {
  const action = String(presentation?.action || '');
  const signal = String(cue || presentation?.cue || '');

  if (signal === 'victory' || action === 'victory') {
    return { theme: BA_SRPG_BGM_SCENES.victory, durationMs: 18_000 };
  }
  if (signal === 'defeat' || action === 'defeat') {
    return { theme: BA_SRPG_BGM_SCENES.defeat, durationMs: 16_000 };
  }
  if (signal === 'deploy' || signal === 'formation' || action === 'deploy' || action === 'formation') {
    return { theme: BA_SRPG_BGM_SCENES.deployment, durationMs: 9_000 };
  }
  if (
    /^missionEvent/.test(signal)
    || /^enemy/.test(signal)
    || signal === 'unitDown'
    || action.startsWith('srpg-event')
    || action.startsWith('srpg-enemy')
  ) {
    return { theme: BA_SRPG_BGM_SCENES.crisis, durationMs: 11_000 };
  }
  if (
    ['propertyBuy', 'propertyRent', 'propertyLease', 'propertyUpgrade', 'edict', 'shopRefresh', 'shop', 'craftComplete', 'equip', 'claim', 'rest'].includes(signal)
    || ['property-buy', 'property-rent', 'property-lease', 'property-upgrade', 'edict', 'refresh', 'shop', 'craft', 'equip', 'claim', 'rest'].includes(action)
  ) {
    return { theme: BA_SRPG_BGM_SCENES.town, durationMs: 8_000 };
  }
  if (
    ['objectiveCapture', 'elimination', 'reactionShot', 'overwatch', 'smoke', 'coverBreak', 'burst', 'combat', 'guard', 'statusApply', 'statusResist', 'buff', 'debuff', 'attackMiss', 'consume', 'move'].includes(signal)
    || action.startsWith('srpg-objective')
  ) {
    return { theme: BA_SRPG_BGM_SCENES.battle, durationMs: 9_000 };
  }
  return null;
}
