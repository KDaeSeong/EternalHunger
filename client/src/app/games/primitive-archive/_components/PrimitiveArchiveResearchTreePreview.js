'use client';

import { useMemo, useState } from 'react';
import GameActionIcon from '../../_components/GameActionIcon';
import {
  RESEARCH_ERA_LABELS,
  RESEARCH_TAG_LABELS,
} from '../_lib/primitiveArchivePageRuntime';

export default function PrimitiveArchiveResearchTreePreview({ researchMap }) {
  const [focusId, setFocusId] = useState(researchMap.nodes[0]?.id || '');
  const [query, setQuery] = useState('');
  const [era, setEra] = useState('ALL');
  const nodeById = useMemo(
    () => Object.fromEntries(researchMap.nodes.map((node) => [node.id, node])),
    [researchMap.nodes],
  );
  const focusedNode = nodeById[focusId] || researchMap.nodes[0];
  const normalizedQuery = query.trim().toLowerCase();
  const isMuted = (node) => {
    if (era !== 'ALL' && node.era !== era) return true;
    if (!normalizedQuery) return false;
    return !`${node.name} ${node.id} ${(node.tags || []).join(' ')}`.toLowerCase().includes(normalizedQuery);
  };

  return (
    <section className="games-panel primitive-research-workspace primitive-research-preview" id="primitive-research-tree-preview">
      <div className="games-panel-title">
        <div>
          <h2>기술 트리 미리보기</h2>
          <span>{researchMap.nodes.length}개 기술 · T1-T{researchMap.tierCount} 전체 공개</span>
        </div>
        <strong>목표 지정 잠김</strong>
      </div>

      <div className="primitive-research-preview__notice">
        <GameActionIcon action="lock" label="연구 잠김" />
        <div>
          <strong>기술 정보는 지금부터 확인할 수 있습니다.</strong>
          <span>시설 조건을 달성하면 이 트리에서 목표 지정과 직접 연구가 활성화됩니다.</span>
        </div>
      </div>

      <div className="primitive-research-toolbar">
        <label className="game-save-json-field">
          <span>기술 검색</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="기술명, ID, 분야"
          />
        </label>
        <label className="game-save-json-field">
          <span>시대 필터</span>
          <select value={era} onChange={(event) => setEra(event.target.value)}>
            <option value="ALL">전체 시대</option>
            {researchMap.eras.map((row) => (
              <option value={row.era} key={row.era}>{row.label} · {row.total}개</option>
            ))}
          </select>
        </label>
        <div className="primitive-research-legend" aria-label="미리보기 상태 범례">
          <span className="is-ready">발전 후 연구</span>
          <span className="is-locked">선행 기술 필요</span>
          <span>선택하면 상세 표시</span>
        </div>
      </div>

      <div className="primitive-research-layout">
        <div className="primitive-research-canvas-scroll" tabIndex={0} aria-label="가로로 스크롤 가능한 기술 트리 미리보기">
          <div className="primitive-research-canvas" style={{ width: researchMap.width, height: researchMap.height }}>
            <svg
              className="primitive-research-edges"
              width={researchMap.width}
              height={researchMap.height}
              viewBox={`0 0 ${researchMap.width} ${researchMap.height}`}
              aria-hidden="true"
            >
              {researchMap.edges.map((edge) => (
                <path
                  className={[
                    edge.pathClass,
                    edge.available ? 'is-ready' : '',
                    edge.from === focusId || edge.to === focusId ? 'is-focused' : '',
                  ].filter(Boolean).join(' ')}
                  data-from={edge.from}
                  data-to={edge.to}
                  d={edge.path}
                  key={edge.id}
                />
              ))}
            </svg>
            <div className="primitive-research-tier-headers" aria-hidden="true">
              {researchMap.tierHeaders.map((tier) => (
                <div className="primitive-research-tier-header" key={tier.tier} style={{ left: tier.x, width: tier.width }}>
                  <span>T{tier.tier}</span>
                  <strong>{tier.name}</strong>
                  <small>{tier.count}개 기술</small>
                </div>
              ))}
            </div>
            {researchMap.nodes.map((node) => {
              const muted = isMuted(node);
              const nodeClass = [
                'primitive-research-node',
                node.available ? 'is-ready' : 'is-locked',
                focusId === node.id ? 'is-focused' : '',
                muted ? 'is-muted' : '',
              ].filter(Boolean).join(' ');
              return (
                <button
                  type="button"
                  className={nodeClass}
                  data-game-sfx="select"
                  data-tech-id={node.id}
                  key={node.id}
                  aria-pressed={focusId === node.id}
                  onClick={() => setFocusId(node.id)}
                  style={{ left: node.x, top: node.y, width: node.width, height: node.height }}
                >
                  <span className="primitive-research-node__head">
                    <strong>{node.name}</strong>
                    <em>{node.available ? '발전 후 가능' : '선행 필요'}</em>
                  </span>
                  <small>T{node.tier} · {RESEARCH_ERA_LABELS[node.era] || node.era} · 비용 {node.cost}</small>
                  <span className="primitive-research-node__tags">
                    {(node.tags || []).slice(0, 1).map((tag) => <i key={tag}>{RESEARCH_TAG_LABELS[tag] || tag}</i>)}
                    {node.eureka ? <i>유</i> : null}
                    {node.inspiration ? <i>영</i> : null}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <aside className="primitive-research-inspector">
          {focusedNode ? (
            <>
              <div className="primitive-research-inspector__head">
                <div>
                  <span>T{focusedNode.tier} · {RESEARCH_ERA_LABELS[focusedNode.era] || focusedNode.era}</span>
                  <h3>{focusedNode.name}</h3>
                </div>
                <strong>비용 {focusedNode.cost}</strong>
              </div>
              <p>{focusedNode.description || focusedNode.nextStepText}</p>
              <div className="primitive-research-inspector__section">
                <span>선행 기술</span>
                <div className="games-chip-row">
                  {(focusedNode.prereqs || []).length ? focusedNode.prereqs.map((techId) => (
                    <button type="button" data-game-sfx="select" key={techId} onClick={() => setFocusId(techId)}>
                      {nodeById[techId]?.name || techId}
                    </button>
                  )) : <span className="games-tag">선행 기술 없음</span>}
                </div>
              </div>
              <div className="primitive-research-inspector__section">
                <span>후속 기술</span>
                <div className="games-chip-row">
                  {(focusedNode.nextTechIds || []).length ? focusedNode.nextTechIds.map((techId) => (
                    <button type="button" data-game-sfx="select" key={techId} onClick={() => setFocusId(techId)}>
                      {nodeById[techId]?.name || techId}
                    </button>
                  )) : <span className="games-tag">최종 기술</span>}
                </div>
              </div>
              <div className="primitive-research-inspector__section">
                <span>해금 효과</span>
                <strong>{focusedNode.unlockText}</strong>
              </div>
              <div className="primitive-research-inspector__section">
                <span>유레카 · 영감</span>
                <strong>
                  유레카 {focusedNode.eureka?.desc || '없음'}
                  <br />
                  영감 {focusedNode.inspiration?.desc || '없음'}
                </strong>
              </div>
              <div className="primitive-research-preview__locked-action">
                <GameActionIcon action="lock" label="발전 조건 필요" />
                캠프 시설을 발전시키면 목표 지정과 연구가 열립니다.
              </div>
            </>
          ) : <div className="games-empty">표시할 기술이 없습니다.</div>}
        </aside>
      </div>
      <p className="primitive-research-scroll-note">트리를 가로·세로로 스크롤하고 노드를 선택하면 선행 관계와 해금 효과를 미리 볼 수 있습니다.</p>
    </section>
  );
}
