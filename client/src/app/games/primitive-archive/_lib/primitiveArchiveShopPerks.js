import { GAMEPLAY_PERK_CODES, gameplayPerkNames, normalizeGameplayPerkCodes } from '../../../../utils/gameplayPerks';
import { startNewRunFromMeta } from './primitiveArchiveEngine';

const PERK_USES = [
  { code: GAMEPLAY_PERK_CODES.CAREFUL_GATHER, key: 'carefulGather', limit: 3 },
  { code: GAMEPLAY_PERK_CODES.RESEARCH_NOTES, key: 'researchNotes', limit: 10 },
];

export function initialArchiveShopPerks(state, codes) {
  return {
    ...state,
    shopPerks: {
      version: 1,
      codes: normalizeGameplayPerkCodes(codes, 'primitive-archive'),
      uses: { carefulGather: 0, researchNotes: 0 },
    },
  };
}

export async function prepareArchiveShopRun({ source, getCurrent, captureCodes, sessionIsCurrent, options }) {
  const shopPerkCodes = await captureCodes();
  if (getCurrent() !== source || !sessionIsCurrent()) {
    const error = new Error('진행 또는 계정이 바뀌어 새 런을 시작하지 않았습니다. 다시 시도해 주세요.');
    error.code = 'ARCHIVE_START_CHANGED';
    throw error;
  }
  return startNewRunFromMeta(source, { ...options, shopPerkCodes });
}

export function archiveShopPerkRows(state) {
  const codes = state?.shopPerks?.version === 1
    ? normalizeGameplayPerkCodes(state.shopPerks.codes, 'primitive-archive') : [];
  return PERK_USES.filter((row) => codes.includes(row.code)).map((row) => {
    const used = state.shopPerks.uses?.[row.key];
    const validUsed = Number.isInteger(used) && used >= 0 && used <= row.limit ? used : row.limit;
    return { ...row, name: gameplayPerkNames([row.code], 'primitive-archive')[0], remaining: row.limit - validUsed };
  });
}
