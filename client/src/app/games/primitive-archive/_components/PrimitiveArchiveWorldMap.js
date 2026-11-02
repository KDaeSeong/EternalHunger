import { useEffect, useRef } from 'react';
import {
  CircleHelp,
  LockKeyhole,
  Mountain,
  TentTree,
  Trees,
  Waves,
  Wheat,
} from 'lucide-react';
import { PrimitiveArchivePanelTitle } from './PrimitiveArchiveVisuals';

const REGION_ICONS = {
  forest: Trees,
  river: Waves,
  cave: Mountain,
  plains: Wheat,
};

function visibleRegion(region, regions) {
  return region.revealed || region.neighbors.some((neighborId) => regions.find((row) => row.id === neighborId)?.revealed);
}

export default function PrimitiveArchiveWorldMap({
  exploration,
  onSelect,
  regions = [],
  selectedRegion,
  selectionUnlocked,
  mapHelpRequest,
}) {
  const helpHeadingRef = useRef(null);
  const helpRegion = mapHelpRequest && regions.find((region) => (
    region.id === mapHelpRequest.regionId && region.revealed === true && !region.safe
      && ['gather', 'hunt'].some((action) => region.zone?.[action]?.some((gain) => gain[0] === mapHelpRequest.resourceId && Number(gain[1]) > 0))
  ));
  const helpRegionId = helpRegion?.id || '';
  const helpResourceId = helpRegion ? mapHelpRequest.resourceId : '';
  useEffect(() => {
    if (!helpRegionId || !helpResourceId) return;
    helpHeadingRef.current?.focus({ preventScroll: true });
    helpHeadingRef.current?.scrollIntoView({ block: 'center' });
  }, [helpRegionId, helpResourceId]);
  const byId = Object.fromEntries(regions.map((region) => [region.id, region]));
  const visibleRegions = regions.filter((region) => visibleRegion(region, regions));
  const visibleEdges = regions.flatMap((region) => region.neighbors
    .filter((neighborId) => region.id < neighborId)
    .map((neighborId) => ({ from: region, to: byId[neighborId] })))
    .filter((edge) => edge.to && (edge.from.revealed || edge.to.revealed));

  return (
    <section className="games-panel primitive-world-map-panel">
      <PrimitiveArchivePanelTitle
        action="primitive-region"
        title="부족의 세계"
        meta={`${exploration?.label || '탐사 기록 없음'} · 경계 ${exploration?.frontier || 0}곳`}
      >
        <strong>{selectionUnlocked ? '지도 제작 완료' : '행동 지역 무작위'}</strong>
      </PrimitiveArchivePanelTitle>
      {helpRegion ? <div className="primitive-map-requirement-help" role="note">
        <h3 ref={helpHeadingRef} tabIndex={-1}>{mapHelpRequest.resourceName || '재료'} 획득 안내 · {helpRegion.name}</h3>
        <p>{helpRegion.yieldHint} · {helpRegion.dangerLabel}. 이 지역의 기대 자원과 위험도를 확인한 뒤 행동을 선택할 수 있습니다. 재료 획득은 행동 결과에 따라 달라집니다.</p>
        {!selectionUnlocked ? <p>지도 제작 연구 전에는 행동 지역을 지정할 수 없습니다. 탐사된 지역 중 무작위로 행동합니다.</p> : <p>이 지역에서 행동하려면 지역을 직접 지정한 뒤 행동 화면에서 채집·사냥을 선택합니다.</p>}
      </div> : null}
      <div className="primitive-world-map-scroll" tabIndex={0} aria-label="가로로 스크롤 가능한 탐사 지도">
        <div className="primitive-world-map-canvas">
          <svg className="primitive-world-map-edges" viewBox="0 0 1000 650" aria-hidden="true">
            {visibleEdges.map(({ from, to }) => (
              <line
                className={from.revealed && to.revealed ? '' : 'is-frontier'}
                key={`${from.id}-${to.id}`}
                x1={from.x}
                y1={from.y}
                x2={to.x}
                y2={to.y}
              />
            ))}
          </svg>
          {visibleRegions.map((region) => {
            const RegionIcon = region.safe ? TentTree : region.revealed ? REGION_ICONS[region.zoneId] || CircleHelp : LockKeyhole;
            const className = [
              'primitive-world-map-node',
              region.revealed ? 'is-revealed' : 'is-hidden',
              region.safe ? 'is-camp' : '',
              region.selected ? 'is-selected' : '',
              helpRegionId === region.id ? 'is-requirement-help' : '',
              region.recentlyDiscovered ? 'is-discovered' : '',
            ].filter(Boolean).join(' ');
            return (
              <button
                type="button"
                className={className}
                data-game-sfx={region.selectable ? 'discover' : 'off'}
                disabled={!region.selectable}
                key={region.id}
                onClick={() => onSelect?.(region.id)}
                style={{ left: `${region.x / 10}%`, top: `${region.y / 6.5}%` }}
                title={region.revealed ? `${region.name} · ${region.yieldHint}` : '미탐사 지역'}
              >
                <span><RegionIcon size={18} strokeWidth={2.2} /></span>
                <strong>{region.revealed ? region.name : '미탐사'}</strong>
                <small>{region.revealed ? `${region.dangerLabel} · 방문 ${region.visits}` : '경계 너머'}</small>
              </button>
            );
          })}
        </div>
      </div>
      <div className="primitive-world-map-detail">
        <div>
          <span>행동 지역</span>
          <strong>{selectionUnlocked ? selectedRegion?.name || '지역을 선택하세요' : '탐사된 지역 중 무작위'}</strong>
        </div>
        <div>
          <span>기대 자원</span>
          <strong>{selectionUnlocked ? selectedRegion?.yieldHint || '-' : '지역마다 다른 자원'}</strong>
        </div>
        <div>
          <span>지형 보정</span>
          <strong>{selectionUnlocked && selectedRegion ? `추가 수확 +${selectedRegion.yieldPct}%` : '행동 시 공개'}</strong>
        </div>
        <div>
          <span>랜드마크</span>
          <strong>{selectionUnlocked ? selectedRegion?.landmark || '-' : '새 지역 발견 시 기록'}</strong>
        </div>
      </div>
    </section>
  );
}
