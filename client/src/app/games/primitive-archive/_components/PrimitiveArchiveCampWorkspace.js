import {
  ActionButton,
  GameControlButton,
  RecentActionResult,
  SmallStat,
} from '../../_components/GamePlayPrimitives';
import GameActionIcon from '../../_components/GameActionIcon';
import { PrimitiveArchivePanelTitle } from './PrimitiveArchiveVisuals';
import { campFireActive } from '../_lib/primitiveArchiveEngine';
import { campRequirementGuide } from '../_lib/primitiveArchiveCampRequirementGuide';

function MaterialStatus({ rows = [] }) {
  return (
    <span className="primitive-material-status">
      {rows.map((row) => (
        <span className={row.met ? 'is-ready' : 'is-missing'} key={row.id}>
          {row.name} {row.current}/{row.required}
        </span>
      ))}
    </span>
  );
}

function CampRequirementGuide({ action, regions, onOpenRequirementHelp, annualMode = false }) {
  const guide = campRequirementGuide({ action, regions });
  if (!guide.hasHelp) return null;
  const canNavigate = typeof onOpenRequirementHelp === 'function';
  return (
    <details className="primitive-requirement-guide">
      <summary>{labelForAction(action)} · 획득 방법·선행 연구</summary>
      <div className="primitive-requirement-guide__body">
        <p>{annualMode ? '시설은 실제 비축 자재와 관리 행동력을 사용합니다. 부족한 자재는 공동체의 직업 생산·가공·교역과 발전 조건을 확인하세요.' : '안내를 열거나 다른 화면을 보는 것은 행동력을 쓰지 않습니다. 지역 지정·채집·사냥·연구는 해당 화면에서 직접 선택합니다.'}</p>
        {guide.materials.map((material) => (
          <div className="primitive-requirement-guide__material" key={material.resourceId}>
            <strong>{material.name} {material.current}/{material.required} · {material.missing}개 부족</strong>
            {annualMode ? null : !material.supported ? <p>이 재료의 획득 경로는 이 안내에서 제공하지 않습니다.</p>
              : !material.sources.length ? <p>현재 발견한 행동 지역에서 확인된 채집·사냥 경로가 없습니다.</p>
                : <ul>{material.sources.map((source) => (
                  <li key={`${source.regionId}-${source.action}`}>
                    <span>{source.regionName} · {source.actionLabel} · {source.dangerLabel}</span>
                    <button type="button" disabled={!canNavigate} onClick={() => onOpenRequirementHelp?.({ kind: 'map', resourceId: material.resourceId, regionId: source.regionId })}>지도에서 확인</button>
                  </li>
                ))}</ul>}
          </div>
        ))}
        {!annualMode && guide.materials.some((material) => material.sources.length) ? <p>발견한 지역의 자원표에 있는 경로입니다. 행동 성공이나 재료 획득을 보장하지 않습니다. 지도 제작 전에는 행동 지역을 지정할 수 없습니다.</p> : null}
        {guide.research.map((technology) => (
          <div className="primitive-requirement-guide__research" key={technology.technologyId}>
            <span>시설 해금 연구: {technology.name}</span>
            <button type="button" disabled={!canNavigate} onClick={() => onOpenRequirementHelp?.({ kind: 'research', technologyId: technology.technologyId })}>선행 연구 보기</button>
          </div>
        ))}
        {action.unlocked === false && !guide.research.length ? <p>{action.reason || '시설의 선행 조건을 확인해 주세요.'} 연결할 해금 연구는 확인되지 않았습니다.</p> : null}
      </div>
    </details>
  );
}

function labelForAction(action) {
  return action.name || action.label || '캠프';
}

function CampActionControl({ action, canAct, label, onClick, regions, onOpenRequirementHelp, annualMode }) {
  const enabled = canAct && action.enabled;
  return (
    <div className="primitive-camp-action-entry">
      <ActionButton
        action={action.action || 'camp'}
        cue="off"
        className={action.enabled ? '' : 'is-unavailable'}
        disabled={!enabled}
        title={action.reason}
        onClick={onClick}
      >
        <span className="primitive-camp-action-label">{label}</span>
        <MaterialStatus rows={action.materialRows} />
      </ActionButton>
      <CampRequirementGuide action={action} regions={regions} onOpenRequirementHelp={onOpenRequirementHelp} annualMode={annualMode} />
    </div>
  );
}

export default function PrimitiveArchiveCampWorkspace(props) {
  const {
    actionFeedback,
    annual,
    actor,
    campActions,
    campFacilities,
    canAct,
    exploration,
    onOpenRequirementHelp,
    recentActionText,
    regions,
    runCamp,
    runEventChain,
    runProgressReport,
    runRecoveryChoice,
    state,
  } = props;
  const guideRegions = exploration?.rows || regions || [];
  const annualMode = Boolean(annual?.annualMode);
  const actorCanAct = canAct && (annualMode || Number(actor?.hp || 0) > 0);
  const visibleCampActions = annualMode ? (campActions || []).filter(row => !['fire', 'fuel', 'cook'].includes(row.id)) : campActions || [];
  const fireStatus = Number(state.camp.fireLevel || 0) <= 0
    ? '미설치' : campFireActive(state) ? '불 켜짐' : '불 꺼짐';

  return (
    <section className="games-detail-grid primitive-workspace-panel" role="tabpanel">
      <section className="games-panel">
        <PrimitiveArchivePanelTitle action="primitive-camp" title={annualMode ? '공동체 시설 투자' : '캠프'} meta={annualMode ? `관리 AP ${state.ap}/${state.apMax}` : `연료 ${state.camp.fuel}`} />
        <div className="games-rank-split games-rank-split--compact primitive-camp-stat-grid">
          {!annualMode ? <SmallStat icon="fuel" label={`모닥불 Lv.${state.camp.fireLevel}`} value={fireStatus} /> : null}
          <SmallStat icon="camp" label="대피소" value={`Lv.${state.camp.shelterLevel}`} />
          <SmallStat icon="craft" label="작업대" value={`Lv.${state.camp.workbenchLevel}`} />
          <SmallStat icon="archive" label="기록실" value={`Lv.${state.camp.archiveRoomLevel || 0}`} />
          <SmallStat icon="scribe" label="필사대" value={`Lv.${state.camp.scribeDeskLevel || 0}`} />
          <SmallStat icon="library" label="서가" value={`Lv.${state.camp.libraryShelfLevel || 0}`} />
        </div>
        <p className="games-muted">{annualMode ? '작업대와 기록·교육 시설은 실제 자재와 관리 행동력으로 투자합니다. 시설의 선행 연구와 현재 재료를 확인하세요.' : '연료가 있어야 모닥불이 추위를 막아 줍니다. 대피소와 보온 장비는 연료 없이도 보호하며, 요리와 밤을 지내는 데 쓸 연료를 각각 준비해야 합니다.'}</p>
        <div className="primitive-camp-action-grid">
          {visibleCampActions.map((action) => (
            <CampActionControl
              action={action}
              canAct={actorCanAct}
              key={action.id}
              label={action.label}
              onClick={() => runCamp(action.id)}
              regions={guideRegions}
              onOpenRequirementHelp={onOpenRequirementHelp}
              annualMode={annualMode}
            />
          ))}
          {campFacilities.map((facility) => (
            <CampActionControl
              action={{ ...facility, action: 'camp' }}
              canAct={actorCanAct}
              key={facility.id}
              label={facility.buttonLabel}
              onClick={() => runCamp(facility.action)}
              regions={guideRegions}
              onOpenRequirementHelp={onOpenRequirementHelp}
              annualMode={annualMode}
            />
          ))}
        </div>
        <RecentActionResult
          action={actionFeedback?.action || 'camp'}
          label={actionFeedback?.label || '이번 캠프 결과'}
          text={recentActionText}
          tone={actionFeedback?.tone || 'ready'}
          pinned
        />
        <details className="primitive-facility-details">
          <summary>기록 시설 효과 보기</summary>
          <div>
            {campFacilities.map((facility) => (
              <p key={`${facility.id}-desc`}><strong>{facility.name}</strong>{facility.desc}</p>
            ))}
          </div>
        </details>
      </section>

      {!annualMode ? <section className="games-panel">
        <PrimitiveArchivePanelTitle
          action={runProgressReport.riskTone === 'danger' ? 'primitive-survival-fail' : 'status'}
          title="런 리포트"
          meta={`${runProgressReport.riskLevel} · 목표 ${runProgressReport.objectivePct}%`}
        />
        <p className="primitive-run-headline">{runProgressReport.headline}</p>
        <div className="games-rank-split games-rank-split--compact primitive-run-stat-grid">
          <SmallStat icon="target" label="목표" value={runProgressReport.objectiveLabel} />
          <SmallStat icon="calendar" label="남은 생존" value={`${runProgressReport.daysLeft}일`} />
          <SmallStat icon="consume" label="식량" value={runProgressReport.foodUnits} />
          <SmallStat icon="fuel" label="연료" value={runProgressReport.fuel} />
          <SmallStat icon="camp" label="보온" value={runProgressReport.insulation} />
          <SmallStat icon="inventory" label="무게" value={runProgressReport.weight} />
          <SmallStat icon="event" label="사건" value={runProgressReport.eventLabel} />
          <SmallStat icon="discover" label="희귀" value={`${runProgressReport.rareResourceTotal}개`} />
        </div>
        <div className="game-save-list primitive-response-list">
          <article className="game-save-row game-save-row--icon">
            <GameActionIcon action={runProgressReport.riskTone === 'danger' ? 'warning' : 'status'} label="현재 병목" />
            <div>
              <span>병목</span>
              <strong>{runProgressReport.blockers.length ? runProgressReport.blockers.join(' / ') : '뚜렷한 병목 없음'}</strong>
              <small>{runProgressReport.recommendations.join(' / ')}</small>
            </div>
            <strong>{runProgressReport.riskTone === 'danger' ? '위험' : runProgressReport.riskTone === 'warning' ? '주의' : '안정'}</strong>
          </article>
          {(runProgressReport.activeEventChains || []).map((chain) => (
            <article className="game-save-row game-save-row--icon" key={chain.id}>
              <GameActionIcon action="event" label={chain.title} />
              <div>
                <span>{chain.stageLabel} · 담당 {chain.actorName || '없음'} · {chain.costText}</span>
                <strong>{chain.title}</strong>
                <small>{chain.detail}</small>
              </div>
              <GameControlButton action="event" cue="off" disabled={!canAct || !chain.enabled} onClick={() => runEventChain(chain.id)}>{chain.actionLabel}</GameControlButton>
            </article>
          ))}
          {(runProgressReport.recoveryChoices || []).map((choice) => (
            <article className="game-save-row game-save-row--icon" key={choice.id}>
              <GameActionIcon action={choice.tone === 'danger' ? 'warning' : 'rest'} label={choice.title} />
              <div>
                <span>{choice.costText} · {choice.tone === 'danger' ? '긴급' : choice.tone === 'low' ? '정비' : '대응'}</span>
                <strong>{choice.title}</strong>
                <small>{choice.detail}</small>
              </div>
              <GameControlButton action="execute" cue="off" disabled={!canAct || !choice.enabled} onClick={() => runRecoveryChoice(choice.id)}>실행</GameControlButton>
            </article>
          ))}
        </div>
      </section> : null}
    </section>
  );
}
