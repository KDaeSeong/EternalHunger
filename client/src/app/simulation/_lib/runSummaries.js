import { buildRunActionSummary } from './runActionSummary';
import {
  buildCreditSourceSummary,
  buildGainDetailSummary,
  buildGainSourceSummary,
  buildSpecialSourceSummary,
} from './runGainSummaries';
import { buildObjectiveSummary } from './runObjectiveSummary';
import { buildRunProgressSummary } from './runProgressSummary';
import {
  createObjectiveFallback,
  createRunActionFallback,
  createRunProgressFallback,
  createRunSupportFallback,
} from './runSummaryShared';
import { buildRunSupportSummary } from './runSupportSummary';

export {
  buildCreditSourceSummary,
  buildGainDetailSummary,
  buildGainSourceSummary,
  buildObjectiveSummary,
  buildRunActionSummary,
  buildRunProgressSummary,
  buildRunSupportSummary,
  buildSpecialSourceSummary,
};

export function getEmptyRunSummaries() {
  return {
    gainSourceSummary: '',
    creditSourceSummary: '',
    gainDetailSummary: '',
    specialSourceSummary: '',
    runProgressSummary: createRunProgressFallback(),
    runSupportSummary: createRunSupportFallback(),
    runActionSummary: createRunActionFallback(),
    objectiveSummary: createObjectiveFallback(),
    topRankedCharacters: [],
  };
}

export function buildTopRankedCharacters({ survivors, dead, killCounts, assistCounts }) {
  return [...(Array.isArray(survivors) ? survivors : []), ...(Array.isArray(dead) ? dead : [])]
    .filter(Boolean)
    .sort((a, b) => (
      (Number(killCounts?.[b?._id] || 0) - Number(killCounts?.[a?._id] || 0))
      || (Number(assistCounts?.[b?._id] || 0) - Number(assistCounts?.[a?._id] || 0))
    ))
    .slice(0, 3);
}

export function buildRunSummaries({
  runEvents,
  itemNameById,
  zoneNameById,
  itemMetaById,
  survivors,
  dead,
  killCounts,
  assistCounts,
}) {
  return {
    gainSourceSummary: buildGainSourceSummary(runEvents),
    creditSourceSummary: buildCreditSourceSummary(runEvents),
    gainDetailSummary: buildGainDetailSummary({ runEvents, itemNameById, zoneNameById }),
    specialSourceSummary: buildSpecialSourceSummary(runEvents),
    runProgressSummary: buildRunProgressSummary({ runEvents, itemMetaById }),
    runSupportSummary: buildRunSupportSummary({ runEvents, itemNameById }),
    runActionSummary: buildRunActionSummary(runEvents),
    objectiveSummary: buildObjectiveSummary({ runEvents, zoneNameById }),
    topRankedCharacters: buildTopRankedCharacters({ survivors, dead, killCounts, assistCounts }),
  };
}
