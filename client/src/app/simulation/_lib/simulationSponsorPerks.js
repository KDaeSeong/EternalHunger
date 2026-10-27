import {
  GAMEPLAY_PERK_CODES,
  getGameplayPerkProduct,
  normalizeGameplayPerkCodes,
} from '../../../utils/gameplayPerks';
import { getActorTeamId } from './teamRuntime';

const GAME_SLUG = 'eternal-hunger';
const START_SPONSOR_CODE = GAMEPLAY_PERK_CODES.START_SPONSOR;
const PROCUREMENT_CODE = GAMEPLAY_PERK_CODES.PROCUREMENT_PARTNER;

export function captureSponsorRunContext(context, currentMap) {
  return { ...context, activeMap: currentMap || context?.activeMap };
}

function actorId(actor) {
  return String(actor?._id || actor?.id || '').trim();
}

export function getSponsorTeamOptions(survivors = []) {
  const teams = new Map();
  (Array.isArray(survivors) ? survivors : []).forEach((actor) => {
    if (!actor || Number(actor.hp || 0) <= 0) return;
    const teamId = getActorTeamId(actor);
    if (!teamId) return;
    if (!teams.has(teamId)) teams.set(teamId, {
      teamId,
      teamName: String(actor.matchTeamName || actor.teamName || actor.name || teamId),
      memberIds: [],
      memberNames: [],
    });
    const team = teams.get(teamId);
    const id = actorId(actor);
    if (id && !team.memberIds.includes(id)) team.memberIds.push(id);
    team.memberNames.push(String(actor.name || actor.nickname || id));
  });
  return [...teams.values()].sort((a, b) => a.teamId.localeCompare(b.teamId));
}

export function createSponsorPerkSnapshot({ codes = [], sponsorTeamId = '', survivors = [] } = {}) {
  const normalizedCodes = normalizeGameplayPerkCodes(codes, GAME_SLUG);
  const teams = getSponsorTeamOptions(survivors);
  const teamId = String(sponsorTeamId || '').trim();
  const team = normalizedCodes.length ? teams.find((row) => row.teamId === teamId) || teams[0] || null : null;
  const scopedCodes = team ? normalizedCodes : [];
  return {
    version: 1,
    gameSlug: GAME_SLUG,
    teamId: team?.teamId || '',
    teamName: team?.teamName || '',
    memberIds: team?.memberIds || [],
    codes: scopedCodes,
  };
}

export function applySponsorPerksToRoster(survivors = [], snapshot = null) {
  const list = Array.isArray(survivors) ? survivors : [];
  if (snapshot?.version !== 1 || snapshot?.gameSlug !== GAME_SLUG || !snapshot.teamId || !Array.isArray(snapshot.codes) || !Array.isArray(snapshot.memberIds)) return list;
  const memberIds = new Set(snapshot.memberIds || []);
  const codes = normalizeGameplayPerkCodes(snapshot.codes, GAME_SLUG);
  const startProduct = codes.includes(START_SPONSOR_CODE) ? getGameplayPerkProduct(START_SPONSOR_CODE) : null;
  const procurementProduct = codes.includes(PROCUREMENT_CODE) ? getGameplayPerkProduct(PROCUREMENT_CODE) : null;
  return list.map((actor) => {
    if (!actor || getActorTeamId(actor) !== snapshot.teamId || !memberIds.has(actorId(actor))) return actor;
    let next = actor;
    if (startProduct && !actor._gameplayPerks?.startSponsorCreditGranted) {
      next = {
        ...next,
        simCredits: Math.max(0, Number(next.simCredits || 0)) + Number(startProduct.effects.amount || 0),
        _gameplayPerks: { ...(next._gameplayPerks || {}), startSponsorCreditGranted: true },
      };
    }
    if (procurementProduct && !next._gameplayPerks?.procurementPartnerApplied) {
      const effects = next._perkRuntime && typeof next._perkRuntime === 'object' ? next._perkRuntime : {};
      const discountPct = Number(procurementProduct.effects.discountPct || 0);
      next = {
        ...next,
        _perkRuntime: {
          ...effects,
          kioskDiscountPct: Math.min(0.95, Number(effects.kioskDiscountPct || 0) + discountPct),
          droneDiscountPct: Math.min(0.95, Number(effects.droneDiscountPct || 0) + discountPct),
        },
        _gameplayPerks: { ...(next._gameplayPerks || {}), procurementPartnerApplied: true },
      };
    }
    return next;
  });
}
