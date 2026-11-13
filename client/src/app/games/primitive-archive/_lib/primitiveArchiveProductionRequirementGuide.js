import { WORLD_REGIONS, ZONES, TRIBE_JOBS } from './primitiveArchiveData.js';

const FIELD_ACTIONS = [['gather', '채집'], ['hunt', '사냥']];

function validQuantity(value) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= Number.MAX_SAFE_INTEGER;
}

function researchRows(rows, missingOnly = false) {
  return (Array.isArray(rows) ? rows : []).filter(row => row && typeof row.technologyId === 'string'
    && (!missingOnly || row.completed !== true)).map(row => ({ technologyId: row.technologyId,
    name: row.name || row.technologyId, completed: row.completed === true }));
}

function hasGain(gains, resourceId) {
  return Array.isArray(gains) && gains.some(gain => Array.isArray(gain) && gain[0] === resourceId
    && validQuantity(gain[1]) && gain[1] > 0 && (gain.length < 3 || (validQuantity(gain[2]) && gain[2] > 0)));
}

function fieldSources(resourceId, regions, actions) {
  const direct = regions.flatMap(region => FIELD_ACTIONS.flatMap(([kind, actionLabel]) => (
    hasGain(region.zone?.[kind], resourceId) ? [{ kind, actionId: kind, actionLabel,
      regionId: region.id, regionName: region.name, dangerLabel: region.dangerLabel || '위험도 확인 필요', research: [] }] : []
  )));
  const specialized = actions.flatMap(action => {
    if (!hasGain(action.gains, resourceId) || !Array.isArray(action.zoneIds)) return [];
    const research = researchRows(action.researchRequirements);
    const matching = action.zoneIds.length ? regions.filter(region => action.zoneIds.includes(region.zoneId || region.zone?.id)) : [];
    if (!action.zoneIds.length) return [{ kind: 'specialized', actionId: action.id,
      actionLabel: action.label, regionName: '정착지 생산 구역', research }];
    return matching.map(region => ({ kind: 'specialized', actionId: action.id, actionLabel: action.label,
      regionId: region.id, regionName: region.name, dangerLabel: region.dangerLabel || '위험도 확인 필요', research }));
  });
  return [...direct, ...specialized];
}

export function communitySources(resourceId, sources) {
  return sources.flatMap(source => {
    const job = TRIBE_JOBS.find(row => row.id === source?.id);
    if (!job || !Array.isArray(source.resourceIds) || !source.resourceIds.includes(resourceId)) return [];
    return [{ kind: 'community', actionId: job.id, actionLabel: job.name,
      research: researchRows(source.researchRequirements) }];
  });
}

function materialRow(row, sources) {
  const current = validQuantity(row.current) ? row.current : null;
  const supplyOnly = row.supplyOnly === true;
  const required = !supplyOnly && validQuantity(row.required) ? row.required : null;
  return { resourceId: row.id, name: row.name || row.id, current, required,
    missing: current !== null && required !== null ? Math.max(0, required - current) : null,
    supplyOnly, unknown: current === null || (!supplyOnly && required === null), sources };
}

function uniqueResearch(rows) {
  return [...new Map(rows.map(row => [row.technologyId, row])).values()];
}

function section(rows, requirements, scopeText, options, sourcesFor, annualMode) {
  const materials = rows.filter(row => row && typeof row.id === 'string'
    && (row.supplyOnly === true || !validQuantity(row.current) || !validQuantity(row.required) || row.current < row.required))
    .map(row => {
      const sources = sourcesFor(row.id);
      for (const option of options) {
        if (option.outputItemId !== row.id || !validQuantity(option.outputQuantity) || option.outputQuantity <= 0) continue;
        sources.push({ kind: 'production', actionId: option.id, actionLabel: option.label,
          outputQuantity: option.outputQuantity, research: researchRows(option.researchRequirements),
          materialRows: (Array.isArray(option.materialRows) ? option.materialRows : []).map(input =>
            materialRow(input, sourcesFor(input.id))) });
      }
      return materialRow(row, sources);
    });
  const research = uniqueResearch([...researchRows(requirements, true), ...materials.flatMap(material =>
    material.sources.flatMap(source => researchRows(source.research, true)))]);
  return { materials, research, hasHelp: materials.length > 0 || research.length > 0, scopeText,
    ...(annualMode ? { annualMode: true } : {}) };
}

export function productionRequirementGuide({ processing, education, regions = [] } = {}) {
  const annualMode = processing?.annualMode === true;
  const visibleRegions = annualMode ? [] : (Array.isArray(regions) ? regions : []).flatMap(region => {
    if (region?.revealed !== true || region.safe) return [];
    const known = WORLD_REGIONS.find(candidate => candidate.id === region.id);
    if (!known || known.safe || known.zoneId !== (region.zoneId || region.zone?.id)) return [];
    const zone = ZONES.find(candidate => candidate.id === known.zoneId);
    return zone ? [{ ...known, revealed: true, zone,
      dangerLabel: known.danger <= 1 ? '안전' : known.danger <= 3 ? '주의' : '위험' }] : [];
  });
  const options = Array.isArray(processing?.options) ? processing.options : [];
  const actions = Array.isArray(processing?.acquisitionActions) ? processing.acquisitionActions : [];
  const communities = Array.isArray(processing?.communitySources) ? processing.communitySources : [];
  const sourcesFor = annualMode ? resourceId => communitySources(resourceId, communities)
    : resourceId => fieldSources(resourceId, visibleRegions, actions);
  const processingActive = Boolean(processing?.plan?.actionId);
  const educationActive = validQuantity(education?.plan?.teachers) && education.plan.teachers > 0;
  const processingGuide = section(processingActive && Array.isArray(processing.materialRows) ? processing.materialRows : [],
    processingActive ? processing.researchRequirements : [], annualMode ? '저장된 연간 가공 계획 · 1묶음 기준' : '저장된 가공 계획 · 1묶음 기준', options, sourcesFor, annualMode);
  const educationGuide = section(educationActive && Array.isArray(education.materialRows) ? education.materialRows : [],
    educationActive ? education.researchRequirements : [], annualMode ? '저장된 연간 공교육 계획 · 제지 1묶음 공급 경로' : '저장된 공교육 계획 · 제지 1묶음 공급 경로', options, sourcesFor, annualMode);
  return { processing: processingGuide, education: educationGuide, hasHelp: processingGuide.hasHelp || educationGuide.hasHelp };
}
