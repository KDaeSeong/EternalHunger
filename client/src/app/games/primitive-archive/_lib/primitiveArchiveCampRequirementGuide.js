import { TECHNOLOGY_TREE } from './primitiveArchiveData.js';

const SUPPORTED_RESOURCES = new Set(['wood', 'stone', 'fiber', 'hide', 'clay', 'resin']);
const SOURCE_ACTIONS = [['gather', '채집'], ['hunt', '사냥']];

export function campRequirementGuide({ action, regions = [] } = {}) {
  if (!action || action.maxed) return { materials: [], research: [], hasHelp: false };

  const visibleRegions = Array.isArray(regions)
    ? regions.filter((region) => region?.revealed === true && !region.safe)
    : [];
  const materials = (Array.isArray(action.materialRows) ? action.materialRows : [])
    .filter((row) => row && Number.isFinite(row.current) && Number.isFinite(row.required)
      && row.current >= 0 && row.required > row.current)
    .map((row) => {
      const supported = SUPPORTED_RESOURCES.has(row.id);
      const sources = supported ? visibleRegions.flatMap((region) => SOURCE_ACTIONS.flatMap(([kind, actionLabel]) => {
        const gains = region.zone?.[kind];
        if (!Array.isArray(gains) || !gains.some((gain) => Array.isArray(gain) && gain[0] === row.id && Number(gain[1]) > 0)) return [];
        return [{ regionId: region.id, regionName: region.name, action: kind, actionLabel, dangerLabel: region.dangerLabel || '위험도 확인 필요' }];
      })) : [];
      return {
        resourceId: row.id, name: row.name, current: row.current, required: row.required,
        missing: row.required - row.current, supported, sources,
      };
    });
  const research = action.unlocked === false
    ? TECHNOLOGY_TREE.filter((technology) => technology.unlocks?.camp?.includes(action.id))
      .map((technology) => ({ technologyId: technology.id, name: technology.name }))
    : [];
  return { materials, research, hasHelp: materials.length > 0 || research.length > 0 || action.unlocked === false };
}
