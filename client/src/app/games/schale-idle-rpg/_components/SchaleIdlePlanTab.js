import {
  SmallStat,
} from '../../_components/GamePlayPrimitives';

export default function SchaleIdlePlanTab(props) {
  const {
    dailyPlan,
    runPlanCommand,
  } = props;

  return (
    <>
        <section className="games-detail-grid">
          <section className="games-panel">
            <div className="games-panel-title">
              <h2>오늘 플랜</h2>
              <span>{dailyPlan.headline}</span>
            </div>
            <div className="games-rank-split" style={{ marginBottom: 12 }}>
              <SmallStat label="준비도" value={`${dailyPlan.readinessPct}%`} />
              <SmallStat label="상태" value={dailyPlan.riskLabel} />
              <SmallStat label="우선 작업" value={`${dailyPlan.highPriorityCount}개`} />
              <SmallStat label="메인 승률" value={`${dailyPlan.projections.mainProbabilityPct}%`} />
              <SmallStat label="탑 승률" value={`${dailyPlan.projections.towerProbabilityPct}%`} />
              <SmallStat label="방치" value={`${dailyPlan.projections.hourlyCredits.toLocaleString('ko-KR')} Cr/h`} />
            </div>
            <div className="game-save-list">
              {dailyPlan.priorityActions.map((action, index) => (
                <article className="game-save-row" key={action.id}>
                  <div>
                    <span>{index + 1}순위 · {action.priority === 'high' ? '즉시' : action.priority === 'low' ? '보류' : '권장'}</span>
                    <strong>{action.title}</strong>
                    <small>{action.detail}</small>
                  </div>
                  <button type="button" disabled={!action.command} onClick={() => runPlanCommand(action.command)}>
                    {action.buttonLabel || '실행'}
                  </button>
                </article>
              ))}
            </div>
          </section>

          <section className="games-panel">
            <div className="games-panel-title">
              <h2>운영 체크</h2>
              <span>{dailyPlan.roadmapHeadline}</span>
            </div>
            <div className="game-save-list">
              {dailyPlan.checkCards.map((item) => (
                <article className="game-save-row" key={item.id}>
                  <div>
                    <span>{item.status === 'complete' ? '완료' : item.status === 'ready' ? '대기' : '진행'}</span>
                    <strong>{item.label} · {item.value}</strong>
                    <small>{item.detail}</small>
                  </div>
                  <strong>{item.status === 'complete' ? 'OK' : item.status === 'ready' ? '확인' : '진행'}</strong>
                </article>
              ))}
            </div>
          </section>

          <section className="games-panel">
            <div className="games-panel-title">
              <h2>다음 목표</h2>
              <span>{dailyPlan.nextAction?.title || '안정 루프'}</span>
            </div>
            <div className="games-empty" style={{ textAlign: 'left', marginBottom: 12 }}>
              {dailyPlan.nextAction ? (
                <>
                  <strong>{dailyPlan.nextAction.action}</strong>
                  <br />
                  {dailyPlan.nextAction.detail}
                </>
              ) : '현재는 메인 정산, 탑 도전, 보상 수령 루프를 반복하면 됩니다.'}
            </div>
            <div className="games-rank-split">
              <SmallStat label="시간당 토큰" value={`+${dailyPlan.projections.hourlyTokens}`} />
              <SmallStat label="방치 상한" value={`${dailyPlan.projections.capHours}시간`} />
              <SmallStat label="병목" value={dailyPlan.blockers.length ? `${dailyPlan.blockers.length}개` : '없음'} />
            </div>
            {dailyPlan.blockers.length ? (
              <div className="game-save-list" style={{ marginTop: 12 }}>
                <article className="game-save-row">
                  <div>
                    <span>현재 병목</span>
                    <strong>{dailyPlan.blockers.join(' / ')}</strong>
                  </div>
                  <strong>점검</strong>
                </article>
              </div>
            ) : null}
          </section>
        </section>
                </>
  );
}
