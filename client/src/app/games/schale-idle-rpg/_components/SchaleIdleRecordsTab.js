import {
  SmallStat,
} from '../../_components/GamePlayPrimitives';

export default function SchaleIdleRecordsTab(props) {
  const {
    growthReport,
    state,
  } = props;

  return (
    <>

        <section className="games-dashboard">
          <section className="games-panel">
            <div className="games-panel-title">
              <h2>성장 판단</h2>
              <span>{growthReport.statusTone === 'good' ? '안정' : growthReport.statusTone === 'warn' ? '점검 필요' : '위험'}</span>
            </div>
            <div className="games-rank-split" style={{ marginBottom: 12 }}>
              <SmallStat label="전투력" value={growthReport.combat.power.toLocaleString('ko-KR')} />
              <SmallStat label="연패 보정" value={`+${growthReport.combat.towerCatchupPct}%`} />
              <SmallStat label="빈 슬롯" value={growthReport.resources.missingSlots.length ? growthReport.resources.missingSlots.join(', ') : '없음'} />
              <SmallStat label="연구 가능" value={`${growthReport.resources.readyUpgrades}개`} />
              <SmallStat label="1시간 방치" value={`${growthReport.offlineProjection.hourlyCredits.toLocaleString('ko-KR')} Cr`} />
              <SmallStat label="방치 상한" value={`${growthReport.offlineProjection.capHours}시간`} />
            </div>
            <div className="game-save-list">
              {growthReport.nextMission ? (
                <article className="game-save-row">
                  <div>
                    <span>미션 {growthReport.nextMission.progress}/{growthReport.nextMission.target} · {growthReport.nextMission.pct}%</span>
                    <strong>{growthReport.nextMission.name}</strong>
                  </div>
                </article>
              ) : null}
              {growthReport.nextAchievement ? (
                <article className="game-save-row">
                  <div>
                    <span>업적 {growthReport.nextAchievement.progress}/{growthReport.nextAchievement.target} · {growthReport.nextAchievement.pct}%</span>
                    <strong>{growthReport.nextAchievement.name}</strong>
                  </div>
                </article>
              ) : null}
              {growthReport.blockers.length ? (
                <article className="game-save-row">
                  <div>
                    <span>병목</span>
                    <strong>{growthReport.blockers.join(' / ')}</strong>
                  </div>
                  <strong>점검</strong>
                </article>
              ) : (
                <article className="game-save-row">
                  <div>
                    <span>병목 없음</span>
                    <strong>현재 루프는 안정적으로 이어갈 수 있습니다.</strong>
                  </div>
                  <strong>안정</strong>
                </article>
              )}
            </div>
          </section>

          <section className="games-panel">
            <div className="games-panel-title">
              <h2>근무 보고서</h2>
              <span>{state.lastDutyReport ? `${state.lastDutyReport.fromFloor}-${state.lastDutyReport.toFloor}층` : '없음'}</span>
            </div>
            {state.lastDutyReport ? (
              <div className="games-activity-list">
                <div>
                  <strong>획득 {Number(state.lastDutyReport.totalCreditsGained || 0).toLocaleString('ko-KR')} Cr · {state.lastDutyReport.stoppedReason}</strong>
                </div>
                {(state.lastDutyReport.highlights || []).map((line, index) => (
                  <div key={`${line}-${index}`}>
                    <strong>{line}</strong>
                  </div>
                ))}
              </div>
            ) : <div className="games-empty">아직 방치 정산 보고서가 없습니다.</div>}
          </section>

          <section className="games-panel">
            <div className="games-panel-title">
              <h2>탑 보고서</h2>
              <span>{state.towerLastBatchReport ? `${state.towerLastBatchReport.successes}승 ${state.towerLastBatchReport.failures}패` : '없음'}</span>
            </div>
            {state.towerLastBatchReport ? (
              <div className="games-activity-list">
                <div>
                  <strong>
                    요청 {Number(state.towerLastBatchReport.requested || 0)}회 · {state.towerLastBatchReport.stopOnFail === false ? '실패해도 계속' : '실패 시 중단'}
                    {' · '}
                    획득 {Number(state.towerLastBatchReport.creditsGained || 0).toLocaleString('ko-KR')} Cr · 토큰 {Number(state.towerLastBatchReport.tokensGained || 0)}
                  </strong>
                </div>
                {(state.towerLastBatchReport.logs || []).map((line, index) => (
                  <div key={`${line}-${index}`}>
                    <strong>{line}</strong>
                  </div>
                ))}
              </div>
            ) : <div className="games-empty">아직 탑 도전 보고서가 없습니다.</div>}
          </section>
        </section>

        <section className="games-panel">
          <div className="games-panel-title">
            <h2>최근 로그</h2>
            <span>{state.runId}</span>
          </div>
          <div className="games-activity-list">
            {state.log.slice(0, 12).map((line, index) => (
              <div key={`${line}-${index}`}>
                <strong>{line}</strong>
              </div>
            ))}
          </div>
        </section>
                </>
  );
}
