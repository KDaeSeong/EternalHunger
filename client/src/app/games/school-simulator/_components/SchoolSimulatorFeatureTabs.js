import { GameFeatureTabs } from '../../_components/GamePlayShell';
import SchoolSimulatorAdvancedTab from './SchoolSimulatorAdvancedTab';
import { ActionButton, SmallStat, RecentActionResult } from '../../_components/GamePlayPrimitives';
import {
  applySubjectPolicyAction,
  applySubjectShowcaseAction,
  applyTeacherAction,
  applyWeeklyEventChoice,
  applyWorkAction,
  endWeekAction,
  launchFestivalAction,
  runAdmissionCampaignAction,
  runCareerCounselingAction,
  runClubRecruitmentAction,
  startClubShowcaseAction,
} from '../_lib/schoolSimulatorEngine';
import { ScoreBar } from '../_lib/schoolSimulatorPlayHelpers';

export default function SchoolSimulatorFeatureTabs(props) {
  const {
    applySchoolAction,
    averages,
    careCommandDisabled,
    careReport,
    careerRows,
    careerTrackId,
    clubId,
    clubs,
    events,
    festival,
    festivalId,
    primaryRisk,
    recentActionText,
    recommendedAction,
    recruitmentStrategyId,
    report,
    riskStudents,
    runCareCommand,
    scenarioReport,
    selectedCareer,
    selectedClub,
    selectedFestival,
    selectedRecruitment,
    selectedSubject,
    selectedSubjectShowcaseAction,
    selectedSubjectShowcaseActive,
    selectedTeacher,
    selectedTeacherAction,
    state,
    subjectId,
    subjectModeId,
    subjectShowcaseActionId,
    subjectRows,
    teacherActionId,
    teacherId,
    teachers,
  } = props;
  return (
      <GameFeatureTabs
        tabs={[
          {
            id: 'operations',
            label: '운영 보드',
            badge: report.status,
            children: (
              <section className="games-dashboard">
                <section className="games-panel">
                  <div className="games-panel-title">
                    <h2>이번 주 운영 판단</h2>
                    <span>{report.headline}</span>
                  </div>
                  <div className="games-rank-split">
                    <SmallStat label="운영 점수" value={report.score.toLocaleString('ko-KR')} />
                    <SmallStat label="예산 여유" value={`${report.operations.budgetRunwayWeeks}주`} />
                    <SmallStat label="위험 학생" value={`${report.wellbeing.atRiskCount}명`} />
                    <SmallStat label="AP" value={state.player.weeklyActionPoint} />
                  </div>
                  <div className="game-save-list" style={{ marginTop: 12 }}>
                    {report.risks.slice(0, 3).map((risk) => (
                      <article className="game-save-row" key={`${risk.level}-${risk.title}`}>
                        <div>
                          <span>{risk.level === 'critical' ? '긴급' : risk.level === 'warn' ? '주의' : '안정'}</span>
                          <strong>{risk.title}</strong>
                          <small>{risk.action}</small>
                        </div>
                      </article>
                    ))}
                  </div>
                </section>
                <section className="games-panel">
                  <div className="games-panel-title">
                    <h2>추천 행동</h2>
                    <span>{recommendedAction.label}</span>
                  </div>
                  <p style={{ color: '#64717d', fontWeight: 800, lineHeight: 1.55 }}>
                    {primaryRisk?.detail || recommendedAction.description}
                  </p>
                  <div className="games-rank-split">
                    <SmallStat label="필요 AP" value={recommendedAction.apCost} />
                    <SmallStat label="비용" value={recommendedAction.budgetCost.toLocaleString('ko-KR')} />
                    <SmallStat label="체력" value={state.player.energy} />
                    <SmallStat label="멘탈" value={state.player.mental} />
                  </div>
                  <div style={{ display: 'grid', gap: 8 }}>
                    <ActionButton onClick={() => applySchoolAction('추천 행동', (current) => applyWorkAction(current, recommendedAction.id))} disabled={state.player.weeklyActionPoint < recommendedAction.apCost}>
                      추천 행동 실행
                    </ActionButton>
                    <ActionButton onClick={() => applySchoolAction('다음 주 진행', (current) => endWeekAction(current))}>다음 주로 진행</ActionButton>
                  </div>
                  <RecentActionResult label="최근 학교 운영 결과" text={recentActionText} pinned />
                </section>
              </section>
            ),
          },
          {
            id: 'tutorial',
            label: '튜토리얼/밸런스',
            badge: `${report.tutorialPct}%`,
            children: (
              <section className="games-dashboard">
                <section className="games-panel">
                  <div className="games-panel-title">
                    <h2>초반 운영 체크</h2>
                    <span>{report.tutorialPct}%</span>
                  </div>
                  <div className="game-save-list">
                    {report.tutorialRows.map((row) => (
                      <article className="game-save-row" key={row.id}>
                        <div>
                          <span>{row.done ? '완료' : `${row.progressPct}%`}</span>
                          <strong>{row.title}</strong>
                          <small>{row.detail}</small>
                          <small>{row.actionHint}</small>
                        </div>
                        <strong>{row.done ? 'OK' : '진행'}</strong>
                      </article>
                    ))}
                  </div>
                </section>
                <section className="games-panel">
                  <div className="games-panel-title">
                    <h2>학기 밸런스</h2>
                    <span>{report.balanceScore}%</span>
                  </div>
                  <div className="game-save-list">
                    {report.balanceRows.map((row) => (
                      <article className="game-save-row" key={row.id}>
                        <div>
                          <span>{row.tone === 'good' ? '안정' : row.tone === 'watch' ? '주의' : '위험'} · {row.pct}%</span>
                          <strong>{row.label}: {row.value}</strong>
                          <small>{row.detail}</small>
                        </div>
                        <strong>{row.tone === 'good' ? 'OK' : row.tone === 'watch' ? '조정' : '우선'}</strong>
                      </article>
                    ))}
                  </div>
                </section>
              </section>
            ),
          },
          {
            id: 'scenario',
            label: '시나리오/연출',
            badge: `${scenarioReport.sceneScore}%`,
            children: (
              <section className="games-dashboard">
                <section className="games-panel">
                  <div className="games-panel-title">
                    <h2>학교별 시나리오</h2>
                    <span>{scenarioReport.schoolScenario}</span>
                  </div>
                  <div className="games-rank-split" style={{ marginBottom: 12 }}>
                    <SmallStat label="장면 점수" value={`${scenarioReport.sceneScore}%`} />
                    <SmallStat label="시나리오" value={scenarioReport.scenarioRows.length} />
                    <SmallStat label="학년 이벤트" value={scenarioReport.gradeRows.length} />
                    <SmallStat label="사운드 큐" value={scenarioReport.soundCues.length} />
                  </div>
                  <div className="game-save-list">
                    {scenarioReport.scenarioRows.map((row) => (
                      <article className="game-save-row" key={row.id}>
                        <div>
                          <span>{row.focus} · {row.pct}%</span>
                          <strong>{row.title}</strong>
                          <small>{row.detail}</small>
                        </div>
                        <strong>{row.tone === 'risk' ? '주의' : row.tone === 'ready' ? '준비' : '세팅'}</strong>
                      </article>
                    ))}
                  </div>
                </section>
                <section className="games-panel">
                  <div className="games-panel-title">
                    <h2>학년별 이벤트 변형</h2>
                    <span>1·2·3학년</span>
                  </div>
                  <div className="game-save-list">
                    {scenarioReport.gradeRows.map((row) => (
                      <article className="game-save-row" key={row.id}>
                        <div>
                          <span>{row.focus} · {row.pct}%</span>
                          <strong>{row.title}</strong>
                          <small>{row.detail}</small>
                        </div>
                        <strong>{row.tone === 'risk' ? '회복' : row.tone === 'ready' ? '진행' : '준비'}</strong>
                      </article>
                    ))}
                  </div>
                </section>
                <section className="games-panel">
                  <div className="games-panel-title">
                    <h2>연출 컷</h2>
                    <span>수업 · 행사 · 시험</span>
                  </div>
                  <div className="game-save-list">
                    {scenarioReport.productionRows.map((row) => (
                      <article className="game-save-row" key={row.id}>
                        <div>
                          <span>{row.focus} · {row.pct}%</span>
                          <strong>{row.title}</strong>
                          <small>{row.detail}</small>
                        </div>
                        <strong>{row.tone === 'risk' ? '점검' : row.tone === 'ready' ? '연출' : '대기'}</strong>
                      </article>
                    ))}
                  </div>
                </section>
                <section className="games-panel">
                  <div className="games-panel-title">
                    <h2>사운드 큐</h2>
                    <span>{scenarioReport.soundCues.length}개</span>
                  </div>
                  <div className="game-save-list">
                    {scenarioReport.soundCues.map((cue) => (
                      <article className="game-save-row" key={cue.id}>
                        <div>
                          <span>{cue.target}</span>
                          <strong>{cue.cue}</strong>
                          <small>{cue.detail}</small>
                        </div>
                      </article>
                    ))}
                  </div>
                </section>
                <section className="games-panel">
                  <div className="games-panel-title">
                    <h2>다음 장면 추천</h2>
                    <span>추천</span>
                  </div>
                  <div className="games-activity-list">
                    {scenarioReport.recommendations.map((line) => (
                      <div key={line}><strong>{line}</strong></div>
                    ))}
                  </div>
                </section>
              </section>
            ),
          },
          {
            id: 'events',
            label: '사건 대응',
            badge: events.pending ? '대응' : `${events.history.length}건`,
            children: (
              <section className="games-detail-grid">
                <section className="games-panel">
                  <div className="games-panel-title">
                    <h2>미해결 사건</h2>
                    <span>{events.status}</span>
                  </div>
                  {events.pending ? (
                    <>
                      <div className="game-save-row">
                        <div>
                          <span>{events.pending.category} · {events.pending.weekLabel}</span>
                          <strong>{events.pending.title}</strong>
                          <small>{events.pending.summary}</small>
                        </div>
                      </div>
                      <div style={{ display: 'grid', gap: 8, marginTop: 10 }}>
                        {events.pending.choices.map((choice) => (
                          <ActionButton
                            key={choice.id}
                            onClick={() => applySchoolAction('사건 대응', (current) => applyWeeklyEventChoice(current, choice.id))}
                            disabled={state.player.weeklyActionPoint < choice.apCost || state.school.budget < choice.budgetCost}
                          >
                            {choice.label} · AP {choice.apCost}
                          </ActionButton>
                        ))}
                      </div>
                      <RecentActionResult label="최근 사건 대응 결과" text={recentActionText} />
                    </>
                  ) : <div className="games-empty">미해결 사건이 없습니다.</div>}
                </section>
                <section className="games-panel">
                  <div className="games-panel-title">
                    <h2>최근 처리</h2>
                    <span>{events.history.length}건</span>
                  </div>
                  <div className="game-save-list">
                    {events.history.length ? events.history.slice(0, 4).map((event) => (
                      <article className="game-save-row" key={`${event.id}-${event.resolvedAt || event.choiceId}`}>
                        <div>
                          <span>{event.category} · {event.choiceLabel || '대응 완료'}</span>
                          <strong>{event.title}</strong>
                        </div>
                        <strong>{event.weekLabel}</strong>
                      </article>
                    )) : <div className="games-empty">아직 처리한 사건이 없습니다.</div>}
                  </div>
                </section>
              </section>
            ),
          },
          {
            id: 'class',
            label: '수업/입학',
            badge: `${report.academic.subjectAverage}점`,
            children: (
              <section className="games-detail-grid">
                <section className="games-panel">
                  <div className="games-panel-title">
                    <h2>수업 운영</h2>
                    <span>{selectedSubject.label}</span>
                  </div>
                  <div className="games-rank-split">
                    <SmallStat label="현재 방식" value={selectedSubject.modeLabel} />
                    <SmallStat label="평균" value={selectedSubject.averageScore} />
                    <SmallStat label="약점" value={`${report.subjectRows[0]?.weakCount || 0}명`} />
                  </div>
                  <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
                    <ActionButton onClick={() => applySchoolAction('수업 방식 변경', (current) => applySubjectPolicyAction(current, subjectId, subjectModeId))} disabled={state.player.weeklyActionPoint < 1}>수업 방식 변경</ActionButton>
                    <ActionButton
                      onClick={() => applySchoolAction('공개 활동 시작', (current) => applySubjectShowcaseAction(current, subjectId, subjectShowcaseActionId))}
                      disabled={state.player.weeklyActionPoint < selectedSubjectShowcaseAction.apCost || state.school.budget < selectedSubjectShowcaseAction.budgetCost || selectedSubjectShowcaseActive}
                    >
                      공개 활동 시작
                    </ActionButton>
                  </div>
                  <RecentActionResult label="최근 수업 결과" text={recentActionText} />
                </section>
                <section className="games-panel">
                  <div className="games-panel-title">
                    <h2>입학 모집</h2>
                    <span>{selectedRecruitment.label}</span>
                  </div>
                  <div className="games-rank-split">
                    <SmallStat label="지원자" value={state.school.admissions.applications} />
                    <SmallStat label="경쟁률" value={`${state.school.admissions.competitionRate}:1`} />
                    <SmallStat label="브랜드" value={state.school.admissions.brandAwareness} />
                  </div>
                  <ActionButton onClick={() => applySchoolAction('모집 캠페인', (current) => runAdmissionCampaignAction(current, recruitmentStrategyId))} disabled={state.player.weeklyActionPoint < 2}>
                    모집 캠페인
                  </ActionButton>
                  <RecentActionResult label="최근 입학 결과" text={recentActionText} />
                </section>
              </section>
            ),
          },
          {
            id: 'students',
            label: '학생/진로',
            badge: `${riskStudents.length}위험`,
            children: (
              <section className="games-detail-grid">
                <section className="games-panel">
                  <div className="games-panel-title">
                    <h2>학생 케어 보드</h2>
                    <span>{careReport.headline}</span>
                  </div>
                  <div className="games-rank-split" style={{ marginBottom: 12 }}>
                    <SmallStat label="위험 학생" value={`${careReport.highStudentCount}명`} />
                    <SmallStat label="최우선" value={careReport.studentRows[0]?.name || '-'} />
                    <SmallStat label="AP" value={state.player.weeklyActionPoint} />
                    <SmallStat label="예산" value={state.school.budget.toLocaleString('ko-KR')} />
                  </div>
                  <div className="game-save-list">
                    {careReport.studentRows.slice(0, 4).map((student) => (
                      <article className="game-save-row" key={student.id}>
                        <div>
                          <span>{student.tone} · {student.grade}학년 {student.classNo}반 · 케어 {student.score}</span>
                          <strong>{student.name}</strong>
                          <small>스트레스 {student.stress} · 건강 {student.health} · 만족 {student.satisfaction}</small>
                          <small>{student.detail}</small>
                        </div>
                        <button
                          type="button"
                          disabled={careCommandDisabled(student.command)}
                          onClick={() => runCareCommand(student.command)}
                        >
                          {student.command.label}
                        </button>
                      </article>
                    ))}
                  </div>
                </section>

                <section className="games-panel">
                  <div className="games-panel-title">
                    <h2>학생 상태</h2>
                    <span>{state.students.length}명</span>
                  </div>
                  <div className="game-save-list">
                    <ScoreBar label="이해도" value={averages.understanding} />
                    <ScoreBar label="만족도" value={averages.satisfaction} />
                    <ScoreBar label="건강" value={averages.health} />
                    <ScoreBar label="스트레스 억제" value={100 - averages.stress} />
                  </div>
                </section>
                <section className="games-panel">
                  <div className="games-panel-title">
                    <h2>진로 지도</h2>
                    <span>{selectedCareer.label}</span>
                  </div>
                  <div className="games-rank-split">
                    <SmallStat label="평균 준비" value={careerRows.find((track) => track.id === careerTrackId)?.averageReadiness || 0} />
                    <SmallStat label="진로 기록" value={state.careerReports.length} />
                    <SmallStat label="대상" value="하위 6명" />
                  </div>
                  <ActionButton onClick={() => applySchoolAction('진로 상담', (current) => runCareerCounselingAction(current, careerTrackId))} disabled={state.player.weeklyActionPoint < 2}>
                    진로 상담 실행
                  </ActionButton>
                  <RecentActionResult label="최근 진로 결과" text={recentActionText} />
                </section>
              </section>
            ),
          },
          {
            id: 'staff',
            label: '교사/시설',
            badge: `${teachers.length}명`,
            children: (
              <section className="games-detail-grid">
                <section className="games-panel">
                  <div className="games-panel-title">
                    <h2>교사/시설 케어 보드</h2>
                    <span>{careReport.highStaffCount ? `${careReport.highStaffCount}건 위험` : '안정'}</span>
                  </div>
                  <div className="games-rank-split" style={{ marginBottom: 12 }}>
                    <SmallStat label="운영 위험" value={`${careReport.highStaffCount}건`} />
                    <SmallStat label="시설 점검" value={`${careReport.facilityRiskCount}곳`} />
                    <SmallStat label="최우선" value={careReport.staffRows[0]?.name || '-'} />
                    <SmallStat label="다음 액션" value={careReport.nextAction?.command?.label || '-'} />
                  </div>
                  <div className="game-save-list">
                    {careReport.staffRows.slice(0, 5).map((row) => (
                      <article className="game-save-row" key={`${row.kind}-${row.id}`}>
                        <div>
                          <span>{row.tone} · {row.label} · 점수 {row.score}</span>
                          <strong>{row.name}</strong>
                          <small>{row.detail}</small>
                        </div>
                        <button
                          type="button"
                          disabled={careCommandDisabled(row.command)}
                          onClick={() => runCareCommand(row.command)}
                        >
                          {row.command.label}
                        </button>
                      </article>
                    ))}
                  </div>
                </section>

                <section className="games-panel">
                  <div className="games-panel-title">
                    <h2>교사 액션</h2>
                    <span>{selectedTeacher?.name || '교사'}</span>
                  </div>
                  <div className="games-rank-split">
                    <SmallStat label="평가" value={`${selectedTeacher?.evaluationGrade || '-'} / ${selectedTeacher?.evaluationScore || 0}`} />
                    <SmallStat label="피로" value={selectedTeacher?.fatigue || 0} />
                    <SmallStat label="사기" value={selectedTeacher?.morale || 0} />
                  </div>
                  <ActionButton
                    onClick={() => applySchoolAction('교사 액션', (current) => applyTeacherAction(current, selectedTeacher?.id || teacherId, teacherActionId))}
                    disabled={!selectedTeacher || state.player.weeklyActionPoint < selectedTeacherAction.apCost || state.school.budget < selectedTeacherAction.budgetCost}
                  >
                    {selectedTeacherAction.label} 실행
                  </ActionButton>
                  <RecentActionResult label="최근 교사 결과" text={recentActionText} />
                </section>
                <section className="games-panel">
                  <div className="games-panel-title">
                    <h2>시설 상태</h2>
                    <span>{state.facilities.length}곳</span>
                  </div>
                  <div className="game-save-list">
                    {state.facilities.slice(0, 4).map((facility) => (
                      <article className="game-save-row" key={facility.id}>
                        <div>
                          <span>{facility.type} · 수용 {facility.capacity}</span>
                          <strong>{facility.name}</strong>
                        </div>
                        <strong>{facility.condition}</strong>
                      </article>
                    ))}
                  </div>
                </section>
              </section>
            ),
          },
          {
            id: 'clubs',
            label: '동아리/행사',
            badge: festival.active ? '행사중' : `${clubs.length}개`,
            children: (
              <section className="games-detail-grid">
                <section className="games-panel">
                  <div className="games-panel-title">
                    <h2>동아리 운영</h2>
                    <span>{selectedClub.label}</span>
                  </div>
                  <div className="games-rank-split">
                    <SmallStat label="회원" value={`${selectedClub.memberCount}/${selectedClub.capacity}`} />
                    <SmallStat label="분위기" value={selectedClub.clubMood} />
                    <SmallStat label="영향력" value={selectedClub.influence} />
                  </div>
                  <div style={{ display: 'grid', gap: 8 }}>
                    <ActionButton onClick={() => applySchoolAction('동아리 신입 모집', (current) => runClubRecruitmentAction(current, clubId))} disabled={state.player.weeklyActionPoint < 2}>신입 모집</ActionButton>
                    <ActionButton onClick={() => applySchoolAction('동아리 발표회 준비', (current) => startClubShowcaseAction(current, clubId))} disabled={state.player.weeklyActionPoint < 2 || selectedClub.showcaseWeeksRemaining > 0}>발표회 준비</ActionButton>
                  </div>
                  <RecentActionResult label="최근 동아리 결과" text={recentActionText} />
                </section>
                <section className="games-panel">
                  <div className="games-panel-title">
                    <h2>축제</h2>
                    <span>{festival.active ? `${festival.active.weeksRemaining}주 남음` : '대기'}</span>
                  </div>
                  <div className="games-rank-split">
                    <SmallStat label="선택" value={selectedFestival.label} />
                    <SmallStat label="기간" value={`${selectedFestival.weeks}주`} />
                    <SmallStat label="기록" value={festival.history.length} />
                  </div>
                  <ActionButton onClick={() => applySchoolAction('행사 시작', (current) => launchFestivalAction(current, festivalId))} disabled={state.player.weeklyActionPoint < 3 || Boolean(festival.active)}>
                    행사 시작
                  </ActionButton>
                  <RecentActionResult label="최근 행사 결과" text={recentActionText} />
                </section>
              </section>
            ),
          },
          {
            id: 'advanced',
            label: '상세 운영',
            badge: `${state.semesterHistory.length}학기`,
            children: (
              <SchoolSimulatorAdvancedTab {...props} />
            ),
          },
        ]}
      />
  );
}
