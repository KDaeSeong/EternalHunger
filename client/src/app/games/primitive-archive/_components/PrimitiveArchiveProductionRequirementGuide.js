'use client';

function ResearchRows({ rows = [], scope, onOpenRequirementHelp }) {
  return rows.filter(row => !row.completed).map(row => <div className="primitive-requirement-guide__research" key={row.technologyId}>
    <span>선행 연구: {row.name}</span>
    <button type="button" disabled={typeof onOpenRequirementHelp !== 'function'}
      onClick={() => onOpenRequirementHelp?.({ kind: 'research', scope, technologyId: row.technologyId })}>선행 연구 보기</button>
  </div>);
}

function MaterialRows({ rows = [], scope, onOpenRequirementHelp, recipeInput = false, annualMode = false }) {
  return rows.map(material => <div className="primitive-requirement-guide__material" key={material.resourceId}>
    <strong>{material.name}{material.supplyOnly
      ? ` · 공급 경로 · 현재 비축 ${material.unknown ? '확인 불가' : material.current}`
      : material.unknown ? ' · 현재 비축 확인 불가'
        : ` ${material.current}/${material.required} · ${material.missing > 0 ? `${material.missing}개 부족` : '1묶음 재료 충족'}`}</strong>
    {recipeInput ? <p>생산 1묶음 투입 {material.required === null ? '확인 불가' : `${material.required}개`}</p> : null}
    {!material.sources?.length ? <p>{annualMode ? '현재 공동체 직업 생산에서 확인된 공급 경로가 없습니다.' : '현재 발견한 지역에서 확인된 획득 경로가 없습니다.'}</p>
      : <ul>{material.sources.map((source, index) => <li key={`${source.kind}-${source.actionId}-${source.regionId || ''}-${index}`}>
        <span>{source.kind === 'community' ? '공동체 직업 · ' : ''}{source.regionName ? `${source.regionName} · ` : ''}{source.actionLabel}{source.dangerLabel ? ` · ${source.dangerLabel}` : ''}
          {source.kind === 'production' && source.outputQuantity ? ` · 1묶음 산출 ${source.outputQuantity}개` : ''}</span>
        {source.regionId ? <button type="button" disabled={typeof onOpenRequirementHelp !== 'function'}
          onClick={() => onOpenRequirementHelp?.({ kind: 'map', scope, resourceId: material.resourceId,
            regionId: source.regionId, sourceKind: source.kind, actionId: source.actionId })}>지도에서 확인</button> : null}
        <ResearchRows rows={source.research} scope={scope} onOpenRequirementHelp={onOpenRequirementHelp} />
        {source.kind === 'production' ? <MaterialRows rows={source.materialRows} scope={scope}
          onOpenRequirementHelp={onOpenRequirementHelp} recipeInput annualMode={annualMode} /> : null}
      </li>)}</ul>}
  </div>);
}

export default function PrimitiveArchiveProductionRequirementGuide({ guide, scope, onOpenRequirementHelp }) {
  if (!guide?.hasHelp) return null;
  return <details className="primitive-requirement-guide">
    <summary>{scope === 'education' ? '공교육 종이 공급·선행 연구' : '저장된 가공 계획 · 재료 획득·선행 연구'}</summary>
    <div className="primitive-requirement-guide__body">
      <p>{guide.scopeText}</p>
      <p>입력 중인 초안이 아닌 저장된 계획의 안내입니다. 화면을 열어도 계획·재고·행동력은 바뀌지 않습니다. {guide.annualMode ? '직업 배치와 연구는 해당 화면에서 직접 선택합니다.' : '지역과 연구는 해당 화면에서 직접 선택합니다.'}</p>
      {scope === 'education' ? <p>교원 수에 따른 추가 필요량을 계산하지 않고, 제지 1묶음의 종이 공급 경로를 안내합니다. {guide.annualMode ? '올해 가공에서 생산한 종이는 다음 연간 교육부터 사용합니다.' : '같은 아침에 생산한 종이는 다음 날 교육부터 사용합니다.'}</p> : null}
      <MaterialRows rows={guide.materials} scope={scope} onOpenRequirementHelp={onOpenRequirementHelp} annualMode={guide.annualMode === true} />
      <ResearchRows rows={guide.research} scope={scope} onOpenRequirementHelp={onOpenRequirementHelp} />
      <p>{guide.annualMode ? '공동체 직업이 생산할 수 있는 재료의 안내입니다. 실제 직업 배치·선행 연구·생산 주기와 앞선 소비에 따라 산출이 달라지며, 현재 생산량이나 다음 정산의 획득을 보장하지 않습니다.' : '발견한 지역에서 확인된 경로이며 행동 성공이나 획득을 보장하지 않습니다. 지도 제작 전에는 행동 지역을 지정할 수 없습니다.'}</p>
    </div>
  </details>;
}
