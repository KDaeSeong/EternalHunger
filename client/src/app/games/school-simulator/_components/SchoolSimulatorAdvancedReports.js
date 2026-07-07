import {
  SmallStat,
} from '../../_components/GamePlayPrimitives';
import {
  ScoreBar,
} from '../_lib/schoolSimulatorPlayHelpers';

export default function SchoolSimulatorAdvancedReports({
  averages,
  careerRows,
  report,
  state,
  subjectRows,
}) {
  return (
    <>
    <section className="games-dashboard">
                <section className="games-panel">
                  <div className="games-panel-title">
                    <h2>학기 리포트</h2>
                    <span>{report.headline} · {report.status}</span>
                  </div>
                  <div className="games-rank-split">
                    <SmallStat label="운영 점수" value={report.score.toLocaleString('ko-KR')} />
                    <SmallStat label="교과 평균" value={report.academic.subjectAverage} />
                    <SmallStat label="위험 학생" value={`${report.wellbeing.atRiskCount}명`} />
                    <SmallStat label="예산 여유" value={`${report.operations.budgetRunwayWeeks}주`} />
                  </div>
                  <div className="games-activity-list">
                    {report.recommendations.map((item, index) => (
                      <div key={`${item}-${index}`}>
                        <strong>{item}</strong>
                      </div>
                    ))}
                  </div>
                </section>
        
                <section className="games-panel">
                  <div className="games-panel-title">
                    <h2>운영 위험</h2>
                    <span>{report.risks.length}건</span>
                  </div>
                  <div className="game-save-list">
                    {report.risks.slice(0, 4).map((risk) => (
                      <article className="game-save-row" key={`${risk.level}-${risk.title}`}>
                        <div>
                          <span>{risk.detail}</span>
                          <strong>{risk.title}</strong>
                        </div>
                        <strong>{risk.level === 'critical' ? '긴급' : risk.level === 'warn' ? '주의' : '양호'}</strong>
                      </article>
                    ))}
                  </div>
                </section>
        
                <section className="games-panel">
                  <div className="games-panel-title">
                    <h2>하위 교과</h2>
                    <span>보강 우선순위</span>
                  </div>
                  <div className="game-save-list">
                    {report.subjectRows.slice(0, 4).map((subject) => (
                      <article className="game-save-row" key={subject.id}>
                        <div>
                          <span>{subject.modeLabel} / 약점 {subject.weakCount}명 / 우수 {subject.highCount}명</span>
                          <strong>{subject.label}</strong>
                        </div>
                        <strong>{subject.averageScore}</strong>
                      </article>
                    ))}
                  </div>
                </section>
              </section>

    <section className="games-dashboard">
                <section className="games-panel">
                  <div className="games-panel-title">
                    <h2>진로 트랙 진단</h2>
                    <span>준비도 {report.operations.careerAverage}</span>
                  </div>
                  <div className="game-save-list">
                    {report.careerRows.filter((track) => track.count > 0).slice(0, 5).map((track) => (
                      <article className="game-save-row" key={track.id}>
                        <div>
                          <span>만족 {track.averageSatisfaction} / 스트레스 {track.averageStress}</span>
                          <strong>{track.label} · {track.count}명</strong>
                        </div>
                        <strong>{track.averageReadiness}</strong>
                      </article>
                    ))}
                  </div>
                </section>
        
                <section className="games-panel">
                  <div className="games-panel-title">
                    <h2>학업/회복 밸런스</h2>
                    <span>최근 시험 {report.academic.recentExamAverage || '없음'}</span>
                  </div>
                  <div className="game-save-list">
                    <ScoreBar label="이해도" value={report.academic.understanding} />
                    <ScoreBar label="성실도" value={report.academic.diligence} />
                    <ScoreBar label="만족도" value={report.wellbeing.satisfaction} />
                    <ScoreBar label="건강" value={report.wellbeing.health} />
                  </div>
                </section>
        
                <section className="games-panel">
                  <div className="games-panel-title">
                    <h2>운영 체력</h2>
                    <span>동아리 영향 {report.operations.clubInfluence}</span>
                  </div>
                  <div className="game-save-list">
                    <ScoreBar label="교사 사기" value={report.operations.teacherMorale} />
                    <ScoreBar label="교사 피로 역산" value={100 - report.operations.teacherFatigue} />
                    <ScoreBar label="시설 상태" value={report.operations.facilityCondition} />
                    <ScoreBar label="모집 경쟁력" value={Math.min(100, report.operations.competitionRate * 20)} />
                  </div>
                </section>
              </section>

    <section className="games-dashboard">
                <section className="games-panel">
                  <div className="games-panel-title">
                    <h2>학교 문화</h2>
                    <span>위험 {state.school.riskLevel}</span>
                  </div>
                  <div className="game-save-list">
                    <ScoreBar label="학업" value={state.school.culture.academic} />
                    <ScoreBar label="복지" value={state.school.culture.welfare} />
                    <ScoreBar label="자치" value={state.school.culture.autonomy} />
                    <ScoreBar label="공동체" value={state.school.culture.community} />
                  </div>
                </section>
        
                <section className="games-panel">
                  <div className="games-panel-title">
                    <h2>평판</h2>
                    <span>브랜드 {state.school.admissions.brandAwareness}</span>
                  </div>
                  <div className="game-save-list">
                    <ScoreBar label="학업 평판" value={state.school.reputation.academic} />
                    <ScoreBar label="안전 평판" value={state.school.reputation.safety} />
                    <ScoreBar label="복지 평판" value={state.school.reputation.wellbeing} />
                    <ScoreBar label="재정 평판" value={state.school.reputation.finance} />
                  </div>
                </section>
        
                <section className="games-panel">
                  <div className="games-panel-title">
                    <h2>평균 지표</h2>
                    <span>{state.students.length}명</span>
                  </div>
                  <div className="game-save-list">
                    <ScoreBar label="성실도" value={averages.diligence} />
                    <ScoreBar label="이해도" value={averages.understanding} />
                    <ScoreBar label="건강" value={averages.health} />
                    <ScoreBar label="진로 준비" value={Math.round((averages.understanding + averages.autonomy) / 2)} />
                  </div>
                </section>
              </section>
    </>
  );
}
