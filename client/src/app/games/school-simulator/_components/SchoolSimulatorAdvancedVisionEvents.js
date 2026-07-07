import {
  ActionButton,
  SmallStat,
  RecentActionResult,
} from '../../_components/GamePlayPrimitives';
import {
  applySchoolVisionAction,
  applyWeeklyEventChoice,
} from '../_lib/schoolSimulatorEngine';
import {
  ScoreBar,
} from '../_lib/schoolSimulatorPlayHelpers';

export default function SchoolSimulatorAdvancedVisionEvents({
  applySchoolAction,
  averages,
  events,
  longTerm,
  recentActionText,
  state,
}) {
  return (
    <>
    <section className="games-dashboard">
                <section className="games-panel">
                  <div className="games-panel-title">
                    <h2>장기 학교 비전</h2>
                    <span>{longTerm.evaluation.visionLabel}</span>
                  </div>
                  <label className="game-save-json-field">
                    <span>비전</span>
                    <select value={state.school.vision} onChange={(event) => applySchoolAction('장기 학교 비전', (current) => applySchoolVisionAction(current, event.target.value))}>
                      {longTerm.visions.map((vision) => <option value={vision.id} key={vision.id}>{vision.label}</option>)}
                    </select>
                  </label>
                  <RecentActionResult label="최근 비전 조정 결과" text={recentActionText} />
                  <p style={{ color: '#64717d', fontWeight: 800, lineHeight: 1.55 }}>{longTerm.evaluation.goal}</p>
                  <div className="games-rank-split">
                    <SmallStat label="평가" value={`${longTerm.evaluation.grade}등급`} />
                    <SmallStat label="종합" value={longTerm.evaluation.score} />
                    <SmallStat label="목표 기간" value={`${longTerm.targetYears}년`} />
                  </div>
                </section>
        
                <section className="games-panel">
                  <div className="games-panel-title">
                    <h2>장기 지표</h2>
                    <span>{longTerm.evaluation.note}</span>
                  </div>
                  <div className="game-save-list">
                    <ScoreBar label="학업" value={longTerm.evaluation.metrics.academic} />
                    <ScoreBar label="복지" value={longTerm.evaluation.metrics.wellbeing} />
                    <ScoreBar label="자율" value={longTerm.evaluation.metrics.autonomy} />
                    <ScoreBar label="공동체" value={longTerm.evaluation.metrics.community} />
                    <ScoreBar label="입학" value={longTerm.evaluation.metrics.admissions} />
                    <ScoreBar label="교사 안정" value={longTerm.evaluation.metrics.teacher} />
                  </div>
                </section>
        
                <section className="games-panel">
                  <div className="games-panel-title">
                    <h2>위기와 성취</h2>
                    <span>기록 {longTerm.evaluationHistory.length}</span>
                  </div>
                  <div className="game-save-list">
                    {longTerm.risks.slice(0, 3).map((risk) => (
                      <article className="game-save-row" key={`${risk.level}-${risk.title}`}>
                        <div>
                          <span>{risk.detail}</span>
                          <strong>{risk.title}</strong>
                        </div>
                        <strong>{risk.level === 'critical' ? '긴급' : risk.level === 'warn' ? '주의' : '안정'}</strong>
                      </article>
                    ))}
                    {longTerm.achievements.slice(0, 2).map((achievement) => (
                      <article className="game-save-row" key={achievement.id}>
                        <div>
                          <span>{achievement.year}년 {achievement.semester}학기 {achievement.week}주</span>
                          <strong>{achievement.label}</strong>
                        </div>
                        <strong>성과</strong>
                      </article>
                    ))}
                  </div>
                </section>
              </section>

    <section className="games-dashboard">
                <section className="games-panel">
                  <div className="games-panel-title">
                    <h2>주간 사건 대응</h2>
                    <span>{events.status}</span>
                  </div>
                  {events.pending ? (
                    <>
                      <div className="game-save-row">
                        <div>
                          <span>{events.pending.category} · {events.pending.weekLabel} · {events.pending.targetLabel}</span>
                          <strong>{events.pending.title}</strong>
                          <small>{events.pending.summary}</small>
                        </div>
                        <strong>{events.pending.tone === 'good' ? '호재' : events.pending.tone === 'critical' ? '긴급' : '주의'}</strong>
                      </div>
                      <div style={{ display: 'grid', gap: 8, marginTop: 10 }}>
                        {events.pending.choices.map((choice) => (
                          <ActionButton
                            key={choice.id}
                            onClick={() => applySchoolAction('사건 대응', (current) => applyWeeklyEventChoice(current, choice.id))}
                            disabled={state.player.weeklyActionPoint < choice.apCost || state.school.budget < choice.budgetCost}
                          >
                            {choice.label} · AP {choice.apCost} · {choice.budgetCost.toLocaleString('ko-KR')}
                          </ActionButton>
                        ))}
                      </div>
                      <RecentActionResult label="최근 사건 대응 결과" text={recentActionText} />
                    </>
                  ) : (
                    <div className="games-empty">미해결 사건이 없습니다. 주차를 정산하면 학생, 교사, 시설, 모집 관련 사건이 발생할 수 있습니다.</div>
                  )}
                </section>
        
                <section className="games-panel">
                  <div className="games-panel-title">
                    <h2>사건 처리 기록</h2>
                    <span>{events.history.length}건</span>
                  </div>
                  <div className="game-save-list">
                    {events.history.length ? events.history.slice(0, 4).map((event) => (
                      <article className="game-save-row" key={`${event.id}-${event.resolvedAt || event.choiceId}`}>
                        <div>
                          <span>{event.category} · {event.choiceLabel || '대응 완료'}</span>
                          <strong>{event.title}</strong>
                          <small>{event.result || event.summary}</small>
                        </div>
                        <strong>{event.weekLabel}</strong>
                      </article>
                    )) : <div className="games-empty">아직 처리한 사건이 없습니다.</div>}
                  </div>
                </section>
        
                <section className="games-panel">
                  <div className="games-panel-title">
                    <h2>사건 영향</h2>
                    <span>운영 변수</span>
                  </div>
                  <div className="game-save-list">
                    <ScoreBar label="위험 억제" value={100 - state.school.riskLevel} />
                    <ScoreBar label="안전 평판" value={state.school.reputation.safety} />
                    <ScoreBar label="관계 안정" value={averages.relation} />
                    <ScoreBar label="교사 안정" value={100 - averages.teacherFatigue} />
                  </div>
                </section>
              </section>
    </>
  );
}
