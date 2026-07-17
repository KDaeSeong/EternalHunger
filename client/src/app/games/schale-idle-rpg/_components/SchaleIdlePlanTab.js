import {
  GameControlButton,
  SmallStat,
} from '../../_components/GamePlayPrimitives';
import {
  SchaleIdleIconRow,
  SchaleIdlePanelTitle,
} from './SchaleIdleVisuals';

const PLAN_ACTION_KINDS = {
  'buy-offer': 'shop',
  'claim-rewards': 'claim',
  craft: 'craft',
  duty: 'settle',
  rest: 'rest',
  salvage: 'salvage',
  tower: 'tower',
  upgrade: 'research',
};

export default function SchaleIdlePlanTab(props) {
  const {
    dailyPlan,
    runPlanCommand,
  } = props;

  return (
    <>
        <section className="games-detail-grid">
          <section className="games-panel">
            <SchaleIdlePanelTitle action="calendar" title="오늘 플랜" meta={dailyPlan.headline} />
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
                <SchaleIdleIconRow action={PLAN_ACTION_KINDS[action.command?.type] || 'advisor'} key={action.id}>
                  <div>
                    <span>{index + 1}순위 · {action.priority === 'high' ? '즉시' : action.priority === 'low' ? '보류' : '권장'}</span>
                    <strong>{action.title}</strong>
                    <small>{action.detail}</small>
                  </div>
                  <GameControlButton action={PLAN_ACTION_KINDS[action.command?.type] || 'execute'} disabled={!action.command} onClick={() => runPlanCommand(action.command)}>
                    {action.buttonLabel || '실행'}
                  </GameControlButton>
                </SchaleIdleIconRow>
              ))}
            </div>
          </section>

          <section className="games-panel">
            <SchaleIdlePanelTitle action="status" title="운영 체크" meta={dailyPlan.roadmapHeadline} />
            <div className="game-save-list">
              {dailyPlan.checkCards.map((item) => (
                <SchaleIdleIconRow action={item.status === 'complete' ? 'complete' : item.status === 'ready' ? 'wait' : 'status'} key={item.id}>
                  <div>
                    <span>{item.status === 'complete' ? '완료' : item.status === 'ready' ? '대기' : '진행'}</span>
                    <strong>{item.label} · {item.value}</strong>
                    <small>{item.detail}</small>
                  </div>
                  <strong>{item.status === 'complete' ? 'OK' : item.status === 'ready' ? '확인' : '진행'}</strong>
                </SchaleIdleIconRow>
              ))}
            </div>
          </section>

          <section className="games-panel">
            <SchaleIdlePanelTitle action="target" title="다음 목표" meta={dailyPlan.nextAction?.title || '안정 루프'} />
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
                <SchaleIdleIconRow action="warning">
                  <div>
                    <span>현재 병목</span>
                    <strong>{dailyPlan.blockers.join(' / ')}</strong>
                  </div>
                  <strong>점검</strong>
                </SchaleIdleIconRow>
              </div>
            ) : null}
          </section>
        </section>
                </>
  );
}
