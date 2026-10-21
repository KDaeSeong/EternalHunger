import { CIVIC_TREE, TECHNOLOGY_TREE } from './primitiveArchiveData';

const ERAS = [
  { id: 'PRIMITIVE', label: '원시' },
  { id: 'NEOLITHIC', label: '신석기' },
  { id: 'ANCIENT', label: '고대' },
  { id: 'CLASSICAL', label: '고전' },
  { id: 'MEDIEVAL', label: '중세' },
  { id: 'EARLY_MODERN', label: '근세' },
  { id: 'MODERN_EARLY', label: '전기 근대' },
  { id: 'MODERN_LATE', label: '후기 근대' },
];

function completedCount(tree, completedById, eraId) {
  return tree.reduce((count, advancement) => (
    advancement.era === eraId && completedById?.[advancement.id] ? count + 1 : count
  ), 0);
}

export function archiveProgressionSummary(state, archiveVictory) {
  const hasArchiveVictory = archiveVictory && typeof archiveVictory === 'object';
  const basicCompleted = hasArchiveVictory ? Number(archiveVictory.completed) : 0;
  const basicTotal = hasArchiveVictory ? Number(archiveVictory.total) : 0;
  const completed = Number.isFinite(basicCompleted) ? Math.max(0, basicCompleted) : 0;
  const total = Number.isFinite(basicTotal) ? Math.max(0, basicTotal) : 0;
  const ended = Boolean(state?.ended);
  const victory = Boolean(state?.victory);

  return {
    basic: {
      title: '기초 아카이브 완주',
      description: '기초 목표를 마친 뒤 완성을 선택하면 현재 런이 종료되고 보상이 정산됩니다.',
      canComplete: Boolean(!ended && hasArchiveVictory && archiveVictory.canComplete),
      completed,
      total,
      ended,
      victory,
    },
    longTerm: {
      title: '장기 문명 발전',
      description: ended
        ? '이 런은 종료되어 추가 발전할 수 없습니다. 새 런에서 연구와 사회 제도를 발전시킬 수 있습니다. 시대 진입은 해당 시대 항목 하나 이상 완료, 시대 학술 완료는 그 시대 항목 전체 완료를 뜻합니다.'
        : '기초 완성을 선택하기 전에는 같은 런에서 연구와 사회 제도 발전을 이어갈 수 있습니다. 이 시대별 발전은 기초 완주 필수 조건이 아닙니다. 시대 진입은 해당 시대 항목 하나 이상 완료, 시대 학술 완료는 그 시대 항목 전체 완료를 뜻합니다.',
      rows: ERAS.map(({ id, label }) => {
        const totalInEra = TECHNOLOGY_TREE.filter((advancement) => advancement.era === id).length
          + CIVIC_TREE.filter((advancement) => advancement.era === id).length;
        const completedInEra = completedCount(TECHNOLOGY_TREE, state?.research?.completed, id)
          + completedCount(CIVIC_TREE, state?.civics?.completed, id);

        return {
          id,
          label,
          completed: completedInEra,
          total: totalInEra,
          entered: completedInEra > 0,
          complete: totalInEra > 0 && completedInEra === totalInEra,
        };
      }),
    },
  };
}
