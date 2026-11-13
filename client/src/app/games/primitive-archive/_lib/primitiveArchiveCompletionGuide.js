import { campRequirementGuide } from './primitiveArchiveCampRequirementGuide';
import { communitySources } from './primitiveArchiveProductionRequirementGuide';
import { TECHNOLOGY_TREE, CIVIC_TREE } from './primitiveArchiveData';

// These identify the two books consumed by archiveObjectiveRows' books gate.
// Progress and completion always come from that gate, never a parallel score.
const COMPLETION_BOOK_IDS = new Set(['book_craft_guide', 'book_camp_manual']);

export function primitiveArchiveCompletionGuide({ state, archiveVictory = {}, facilities = [], recipes = [],
  technologies = [], civics = [], regions = [], processing = null } = {}) {
  const rows = (archiveVictory.rows || []).map(row => ({ ...row }));
  const remaining = rows.filter(row => !row.done);
  const requiredProjection = (catalog, progress) => catalog.filter(row => row.archiveRequired)
    .map(row => ({ id: row.id, name: row.name, archiveRequired: true, completed: Boolean(progress?.completed?.[row.id]),
      available: (row.prereqs || []).every(id => Boolean(state?.research?.completed?.[id] || state?.civics?.completed?.[id])),
      reason: `실제 진행 ${Number(progress?.progress?.[row.id] || 0)}/${row.cost}` }));
  const requiredTechnologies = technologies.length ? technologies : requiredProjection(TECHNOLOGY_TREE, state?.research);
  const requiredCivics = civics.length ? civics : requiredProjection(CIVIC_TREE, state?.civics);
  const base = { rows, remaining, candidates: [], objective: null };
  if (state?.ended || !(state?.party || []).some(member => Number(member.hp) > 0)) return { ...base, status: 'ended' };
  if (archiveVictory.canComplete || (rows.length > 0 && remaining.length === 0)) return { ...base, status: 'complete' };
  const candidates = [];
  const annualMode = state?.calendar?.mode === 'annual';
  const materialText = materials => materials.map(row => `${row.name} ${row.missing}개 부족`).join(' · ');
  const add = (kind, row, guide) => {
    const materials = guide.materials.map(material => ({ ...material,
      sources: annualMode ? communitySources(material.resourceId,
        Array.isArray(processing?.communitySources) ? processing.communitySources : []) : material.sources,
      crafting: recipes.filter(recipe => Number(recipe.reward?.[material.resourceId] || 0) > 0)
        .map(recipe => ({ recipeId: recipe.id, name: recipe.name, unlocked: recipe.unlocked !== false, materialText: recipe.materialText || '' })) }));
    const research = [...new Map([...guide.research, ...materials.flatMap(material => material.sources
      .flatMap(source => source.research || []).filter(row => row.completed !== true))]
      .filter(row => row.completed !== true).map(row => [row.technologyId, { ...row }])).values()];
    const unlocked = row.unlocked !== false;
    const helpRequests = [
      ...research.map(tech => ({ kind: 'research', technologyId: tech.technologyId })),
      ...materials.flatMap(material => material.sources.map(source => source.kind === 'community'
        ? { kind: 'community', resourceId: material.resourceId, actionId: source.actionId }
        : { kind: 'map', resourceId: material.resourceId, regionId: source.regionId })),
    ];
    const detail = [materialText(materials), research.length ? `필요 연구: ${research.map(tech => tech.name).join(' · ')}` : '',
      kind === 'book' ? `제작: ${row.name}` : '',
      ...materials.flatMap(material => material.crafting.map(recipe => `${material.name} 제작: ${recipe.name}${recipe.materialText ? ` · ${recipe.materialText}` : ''}`)),
      !unlocked && !research.length ? row.lockedReason || row.reason || row.lockedLabel || '해금 조건 확인 필요' : '',
    ].filter(Boolean).join(' · ') || '재료 준비 완료 · 실행 대상과 관리 행동력을 확인하세요.';
    const annualBook = kind === 'book' && state?.calendar?.mode === 'annual';
    const processingActionId = annualBook ? `annual_${row.id}` : '';
    candidates.push({ kind, id: row.id, title: `기초 완주 준비: ${row.name}`,
      detail: annualBook ? `${detail} · 공동체 가공 계획에 지정하면 실제 일손과 재료로 다음 1년 운영 때 생산합니다. 끈이 부족하면 끈 가공부터 준비하세요.` : detail,
      targetTab: kind === 'facility' ? 'camp' : annualBook ? 'tribe' : 'actions',
      actionLabel: kind === 'facility' ? '필수 시설 확인' : annualBook ? '공동체 책 가공 확인' : '책 제작 확인',
      unlocked, blocked: false, materials, research, helpRequests, recipeId: kind === 'book' ? row.id : '', processingActionId });
  };
  if (remaining.some(row => row.id === 'facilities')) {
    for (const facility of facilities.filter(row => !row.maxed)) {
      add('facility', facility, campRequirementGuide({ action: facility, regions }));
    }
  }
  if (remaining.some(row => row.id === 'books')) {
    for (const recipe of recipes.filter(row => COMPLETION_BOOK_IDS.has(row.id) && Number(state?.inventory?.[row.id] || 0) < 1)) {
      // The same physical resource/visible-region guide applies to recipe rows.
      const guide = campRequirementGuide({ action: { ...recipe, unlocked: true }, regions });
      guide.research = recipe.unlocked === false && recipe.techId ? [{ technologyId: recipe.techId, name: recipe.techName }] : [];
      add('book', recipe, guide);
    }
  }
  if (remaining.some(row => row.id === 'research')) {
    for (const row of [...requiredTechnologies, ...requiredCivics].filter(row => row.archiveRequired && !row.completed)) {
      candidates.push({ kind: 'research', id: row.id, title: `기초 완주 연구: ${row.name}`,
        detail: row.reason || row.lockedReason || '발전 화면에서 실제 남은 연구 조건을 확인하세요.',
        targetTab: 'growth', actionLabel: '필수 발전 확인', unlocked: row.available !== false, materials: [], research: [], helpRequests: [] });
    }
  }
  // Available physical goals remain visible while another research is selected.
  const objective = candidates.find(row => row.kind !== 'research' && row.unlocked && !row.blocked)
    || candidates.find(row => row.kind !== 'research') || candidates[0] || null;
  return { ...base, status: 'pending', candidates, objective };
}
