import {
  ActionButton,
  GameControlButton,
  RecentActionResult,
  SmallStat,
} from '../../_components/GamePlayPrimitives';

export default function PrimitiveArchiveCampWorkspace(props) {
  const {
    actionFeedback,
    campFacilities,
    canAct,
    recentActionText,
    runCamp,
    runEventChain,
    runProgressReport,
    runRecoveryChoice,
    state,
  } = props;

  return (
    <section className="games-detail-grid primitive-workspace-panel" role="tabpanel">
      <section className="games-panel">
        <div className="games-panel-title">
          <h2>런 리포트</h2>
          <span>{runProgressReport.riskLevel} · 목표 {runProgressReport.objectivePct}%</span>
        </div>
        <p className="primitive-run-headline">{runProgressReport.headline}</p>
        <div className="games-rank-split games-rank-split--compact primitive-run-stat-grid">
          <SmallStat label="목표" value={runProgressReport.objectiveLabel} />
          <SmallStat label="남은 생존" value={`${runProgressReport.daysLeft}일`} />
          <SmallStat label="식량" value={runProgressReport.foodUnits} />
          <SmallStat label="연료" value={runProgressReport.fuel} />
          <SmallStat label="보온" value={runProgressReport.insulation} />
          <SmallStat label="무게" value={runProgressReport.weight} />
          <SmallStat label="사건" value={runProgressReport.eventLabel} />
          <SmallStat label="희귀" value={`${runProgressReport.rareResourceTotal}개`} />
        </div>
        <div className="game-save-list primitive-response-list">
          <article className="game-save-row">
            <div>
              <span>병목</span>
              <strong>{runProgressReport.blockers.length ? runProgressReport.blockers.join(' / ') : '뚜렷한 병목 없음'}</strong>
              <small>{runProgressReport.recommendations.join(' / ')}</small>
            </div>
            <strong>{runProgressReport.riskTone === 'danger' ? '위험' : runProgressReport.riskTone === 'warning' ? '주의' : '안정'}</strong>
          </article>
          {(runProgressReport.activeEventChains || []).map((chain) => (
            <article className="game-save-row" key={chain.id}>
              <div>
                <span>{chain.stageLabel} · {chain.costText}</span>
                <strong>{chain.title}</strong>
                <small>{chain.detail}</small>
              </div>
              <GameControlButton action="event" disabled={!canAct || !chain.enabled} onClick={() => runEventChain(chain.id)}>{chain.actionLabel}</GameControlButton>
            </article>
          ))}
          {(runProgressReport.recoveryChoices || []).map((choice) => (
            <article className="game-save-row" key={choice.id}>
              <div>
                <span>{choice.costText} · {choice.tone === 'danger' ? '긴급' : choice.tone === 'low' ? '정비' : '대응'}</span>
                <strong>{choice.title}</strong>
                <small>{choice.detail}</small>
              </div>
              <GameControlButton action="execute" disabled={!canAct || !choice.enabled} onClick={() => runRecoveryChoice(choice.id)}>실행</GameControlButton>
            </article>
          ))}
        </div>
      </section>

      <section className="games-panel">
        <div className="games-panel-title">
          <h2>캠프</h2>
          <span>연료 {state.camp.fuel}</span>
        </div>
        <div className="games-rank-split games-rank-split--compact primitive-camp-stat-grid">
          <div><span>모닥불</span><strong>Lv.{state.camp.fireLevel}</strong></div>
          <div><span>대피소</span><strong>Lv.{state.camp.shelterLevel}</strong></div>
          <div><span>작업대</span><strong>Lv.{state.camp.workbenchLevel}</strong></div>
          <div><span>기록실</span><strong>Lv.{state.camp.archiveRoomLevel || 0}</strong></div>
          <div><span>필사대</span><strong>Lv.{state.camp.scribeDeskLevel || 0}</strong></div>
          <div><span>서가</span><strong>Lv.{state.camp.libraryShelfLevel || 0}</strong></div>
        </div>
        <div className="primitive-camp-action-grid">
          <ActionButton action="fuel" cue="off" disabled={!canAct} onClick={() => runCamp('fuel')}>연료 넣기 · 나무 1</ActionButton>
          <ActionButton action="camp" cue="off" disabled={!canAct} onClick={() => runCamp('fire')}>모닥불 강화 · 나무 2, 돌 2</ActionButton>
          <ActionButton action="camp" cue="off" disabled={!canAct} onClick={() => runCamp('shelter')}>대피소 강화 · 나무 3, 섬유 2, 가죽 1</ActionButton>
          <ActionButton action="craft" cue="off" disabled={!canAct} onClick={() => runCamp('workbench')}>작업대 제작 · 나무 4, 돌 2</ActionButton>
          <ActionButton action="consume" cue="off" disabled={!canAct} onClick={() => runCamp('cook')}>고기 굽기 · 고기 1, 연료 1</ActionButton>
          {campFacilities.map((facility) => (
            <ActionButton action="camp" cue="off" key={facility.id} disabled={!canAct || !facility.unlocked || facility.maxed} onClick={() => runCamp(facility.action)}>
              {facility.buttonLabel}
            </ActionButton>
          ))}
        </div>
        <RecentActionResult
          action={actionFeedback?.action || 'camp'}
          label="이번 캠프 결과"
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
