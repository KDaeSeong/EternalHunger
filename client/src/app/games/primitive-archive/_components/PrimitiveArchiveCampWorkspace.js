import {
  ActionButton,
  GameControlButton,
  RecentActionResult,
  SmallStat,
} from '../../_components/GamePlayPrimitives';
import GameActionIcon from '../../_components/GameActionIcon';
import { PrimitiveArchivePanelTitle } from './PrimitiveArchiveVisuals';

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

function CampActionControl({ action, canAct, label, onClick }) {
  const enabled = canAct && action.enabled;
  return (
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
  );
}

export default function PrimitiveArchiveCampWorkspace(props) {
  const {
    actionFeedback,
    actor,
    campActions,
    campFacilities,
    canAct,
    recentActionText,
    runCamp,
    runEventChain,
    runProgressReport,
    runRecoveryChoice,
    state,
  } = props;
  const actorCanAct = canAct && Number(actor?.hp || 0) > 0;

  return (
    <section className="games-detail-grid primitive-workspace-panel" role="tabpanel">
      <section className="games-panel">
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
                <span>{chain.stageLabel} · {chain.costText}</span>
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
      </section>

      <section className="games-panel">
        <PrimitiveArchivePanelTitle action="primitive-camp" title="캠프" meta={`연료 ${state.camp.fuel}`} />
        <div className="games-rank-split games-rank-split--compact primitive-camp-stat-grid">
          <SmallStat icon="fuel" label="모닥불" value={`Lv.${state.camp.fireLevel}`} />
          <SmallStat icon="camp" label="대피소" value={`Lv.${state.camp.shelterLevel}`} />
          <SmallStat icon="craft" label="작업대" value={`Lv.${state.camp.workbenchLevel}`} />
          <SmallStat icon="archive" label="기록실" value={`Lv.${state.camp.archiveRoomLevel || 0}`} />
          <SmallStat icon="document-review" label="필사대" value={`Lv.${state.camp.scribeDeskLevel || 0}`} />
          <SmallStat icon="guide" label="서가" value={`Lv.${state.camp.libraryShelfLevel || 0}`} />
        </div>
        <div className="primitive-camp-action-grid">
          {(campActions || []).map((action) => (
            <CampActionControl
              action={action}
              canAct={actorCanAct}
              key={action.id}
              label={action.label}
              onClick={() => runCamp(action.id)}
            />
          ))}
          {campFacilities.map((facility) => (
            <CampActionControl
              action={{ ...facility, action: 'camp' }}
              canAct={actorCanAct}
              key={facility.id}
              label={facility.buttonLabel}
              onClick={() => runCamp(facility.action)}
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
    </section>
  );
}
