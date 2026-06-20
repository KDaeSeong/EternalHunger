import { getUser } from '../../../utils/api';
import { writeHallOfFameState } from '../../../utils/hallOfFame';

export function normalizeUserStatistics(stats) {
  const src = stats && typeof stats === 'object' ? stats : {};
  const totalGames = Number(src?.totalGames || 0);
  const totalKills = Number(src?.totalKills || 0);
  const totalWins = Number(src?.totalWins || 0);
  return {
    totalGames: Number.isFinite(totalGames) && totalGames > 0 ? Math.floor(totalGames) : 0,
    totalKills: Number.isFinite(totalKills) && totalKills > 0 ? Math.floor(totalKills) : 0,
    totalWins: Number.isFinite(totalWins) && totalWins > 0 ? Math.floor(totalWins) : 0,
  };
}

export function mergeStoredUserProgress(currentUser, patch = {}) {
  const baseUser = currentUser && typeof currentUser === 'object' ? currentUser : {};
  const next = { ...baseUser, ...patch };
  if (patch && Object.prototype.hasOwnProperty.call(patch, 'lp')) {
    const lp = Number(patch.lp || 0);
    next.lp = Number.isFinite(lp) ? lp : Number(baseUser?.lp || 0) || 0;
  }
  if (patch && Object.prototype.hasOwnProperty.call(patch, 'credits')) {
    const credits = Number(patch.credits || 0);
    next.credits = Number.isFinite(credits) ? credits : Number(baseUser?.credits || 0) || 0;
  }
  if (patch && Object.prototype.hasOwnProperty.call(patch, 'statistics')) {
    next.statistics = normalizeUserStatistics(patch.statistics);
  } else if (baseUser?.statistics) {
    next.statistics = normalizeUserStatistics(baseUser.statistics);
  }
  return next;
}

export function saveLocalHallOfFameBackup(winner, killCountsObj, assistCountsObj, participantsList) {
  try {
    const me = getUser();
    const username = me?.username || me?.id || 'guest';
    const idToName = {};
    (participantsList || []).forEach((p) => {
      const id = String(p?._id || p?.id || '');
      if (!id) return;
      idToName[id] = p?.name || p?.nickname || p?.charName || p?.title || id;
    });
    writeHallOfFameState({ username }, (current) => {
      const state = { ...(current || {}), chars: { ...(current?.chars || {}) } };
      Object.entries(killCountsObj || {}).forEach(([pid, k]) => {
        const sid = String(pid || '');
        if (!sid) return;
        const amount = Math.max(0, Number(k || 0) || 0);
        if (!amount) return;
        const entry = state.chars[sid] || { name: idToName[sid] || sid, wins: 0, kills: 0, assists: 0 };
        entry.name = idToName[sid] || entry.name;
        entry.kills = Number(entry.kills || 0) + amount;
        state.chars[sid] = entry;
      });
      Object.entries(assistCountsObj || {}).forEach(([pid, a]) => {
        const sid = String(pid || '');
        if (!sid) return;
        const amount = Math.max(0, Number(a || 0) || 0);
        if (!amount) return;
        const entry = state.chars[sid] || { name: idToName[sid] || sid, wins: 0, kills: 0, assists: 0 };
        entry.name = idToName[sid] || entry.name;
        entry.assists = Number(entry.assists || 0) + amount;
        state.chars[sid] = entry;
      });
      if (winner) {
        const wid = String(winner?._id || winner?.id || '');
        if (wid) {
          const entry = state.chars[wid] || { name: idToName[wid] || winner?.name || wid, wins: 0, kills: 0, assists: 0 };
          entry.name = idToName[wid] || entry.name;
          entry.wins = Number(entry.wins || 0) + 1;
          state.chars[wid] = entry;
        }
      }
      return state;
    }, { winnerId: String(winner?._id || winner?.id || '') });
  } catch (e) {
    console.error('local hof save failed', e);
  }
}
