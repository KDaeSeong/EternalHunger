import { GameFeatureTabs } from '../../_components/GamePlayShell';
import { ActionButton, SmallStat, RecentActionResult } from '../../_components/GamePlayPrimitives';
import {
  CAREER_TRACKS,
  FESTIVAL_TYPES,
  POLICY_PRESETS,
  RECRUITMENT_STRATEGIES,
  SUBJECT_POLICY_MODES,
  SUBJECT_SHOWCASE_ACTIONS,
  SUBJECTS,
  TEACHER_ACTIONS,
  WORK_ACTIONS,
  applySchoolVisionAction,
  applySubjectPolicyAction,
  applySubjectShowcaseAction,
  applyTeacherAction,
  applyWeeklyEventChoice,
  applyWorkAction,
  endWeekAction,
  launchFestivalAction,
  restAction,
  runAdmissionCampaignAction,
  runCareerCounselingAction,
  runClubRecruitmentAction,
  startClubShowcaseAction,
} from '../_lib/schoolSimulatorEngine';
import { ScoreBar } from '../_lib/schoolSimulatorPlayHelpers';

export default function SchoolSimulatorFeatureTabs({
  actionId,
  applySchoolAction,
  applySelectedAction,
  applySelectedPolicy,
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
  longTerm,
  policyId,
  primaryRisk,
  recentActionText,
  recommendedAction,
  recruitmentStrategyId,
  report,
  riskStudents,
  runCareCommand,
  scenarioReport,
  selectedAction,
  selectedCareer,
  selectedClub,
  selectedFestival,
  selectedPolicy,
  selectedRecruitment,
  selectedSubject,
  selectedSubjectMode,
  selectedSubjectShowcase,
  selectedSubjectShowcaseAction,
  selectedSubjectShowcaseActive,
  selectedSubjectShowcaseTargets,
  selectedTeacher,
  selectedTeacherAction,
  setActionId,
  setCareerTrackId,
  setClubId,
  setFestivalId,
  setPolicyId,
  setRecruitmentStrategyId,
  setSubjectId,
  setSubjectModeId,
  setSubjectShowcaseActionId,
  setTeacherActionId,
  setTeacherId,
  state,
  subjectId,
  subjectModeId,
  subjectShowcaseActionId,
  subjectRows,
  subjectShowcaseSummaryData,
  subjectShowcases,
  teacherActionId,
  teacherId,
  teachers,
  topStudents,
  weekInfo,
}) {
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

      <section className="games-detail-grid">
        <section className="games-panel">
          <div className="games-panel-title">
            <h2>주간 운영</h2>
            <span>{weekInfo.label}</span>
          </div>
          <label className="game-save-json-field">
            <span>운영 행동</span>
            <select value={actionId} onChange={(event) => setActionId(event.target.value)}>
              {WORK_ACTIONS.map((action) => (
                <option value={action.id} key={action.id}>
                  {action.label} / AP {action.apCost} / {action.budgetCost.toLocaleString('ko-KR')}
                </option>
              ))}
            </select>
          </label>
          <p style={{ color: '#64717d', fontWeight: 800, lineHeight: 1.55 }}>{selectedAction.description}</p>
          <div className="games-rank-split">
            <SmallStat label="필요 AP" value={selectedAction.apCost} />
            <SmallStat label="비용" value={selectedAction.budgetCost.toLocaleString('ko-KR')} />
            <SmallStat label="체력" value={state.player.energy} />
            <SmallStat label="멘탈" value={state.player.mental} />
          </div>
          <ActionButton onClick={applySelectedAction} disabled={state.player.weeklyActionPoint < selectedAction.apCost}>
            선택 행동 실행
          </ActionButton>
          <RecentActionResult label="최근 주간 운영 결과" text={recentActionText} />
        </section>

        <section className="games-panel">
          <div className="games-panel-title">
            <h2>정책 프리셋</h2>
            <span>{selectedPolicy.label}</span>
          </div>
          <label className="game-save-json-field">
            <span>정책</span>
            <select value={policyId} onChange={(event) => setPolicyId(event.target.value)}>
              {POLICY_PRESETS.map((policy) => (
                <option value={policy.id} key={policy.id}>
                  {policy.label} / {policy.budgetCost.toLocaleString('ko-KR')}
                </option>
              ))}
            </select>
          </label>
          <div className="games-rank-split">
            <SmallStat label="현재 정책" value={POLICY_PRESETS.find((item) => item.id === state.school.policyPreset)?.label || state.school.policyPreset} />
            <SmallStat label="변경 비용" value={selectedPolicy.budgetCost.toLocaleString('ko-KR')} />
            <SmallStat label="지원자" value={state.school.admissions.applications} />
            <SmallStat label="경쟁률" value={`${state.school.admissions.competitionRate}:1`} />
          </div>
          <ActionButton onClick={applySelectedPolicy} disabled={state.player.weeklyActionPoint < 1 || state.school.policyPreset === policyId}>
            정책 적용
          </ActionButton>
          <RecentActionResult label="최근 정책 결과" text={recentActionText} />
        </section>

        <section className="games-panel">
          <div className="games-panel-title">
            <h2>주차 정산</h2>
            <span>{weekInfo.examType ? '시험 주간' : '일반 주간'}</span>
          </div>
          <div className="games-rank-split">
            <SmallStat label="스트레스" value={averages.stress} />
            <SmallStat label="만족도" value={averages.satisfaction} />
            <SmallStat label="교사 사기" value={averages.teacherMorale} />
            <SmallStat label="시설" value={averages.facilityCondition} />
          </div>
          <div style={{ display: 'grid', gap: 8 }}>
            <ActionButton onClick={() => applySchoolAction('다음 주 진행', (current) => endWeekAction(current))}>다음 주로 진행</ActionButton>
            <ActionButton onClick={() => applySchoolAction('운영진 휴식', (current) => restAction(current))} disabled={state.player.weeklyActionPoint < 2}>지친 운영진 휴식</ActionButton>
          </div>
          <RecentActionResult label="최근 정산 결과" text={recentActionText} />
        </section>
      </section>

      <section className="games-detail-grid">
        <section className="games-panel">
          <div className="games-panel-title">
            <h2>과목 운영</h2>
            <span>{selectedSubject.teacherName}</span>
          </div>
          <label className="game-save-json-field">
            <span>교과</span>
            <select value={subjectId} onChange={(event) => setSubjectId(event.target.value)}>
              {subjectRows.map((subject) => (
                <option value={subject.id} key={subject.id}>{subject.label} · 평균 {subject.averageScore}</option>
              ))}
            </select>
          </label>
          <label className="game-save-json-field">
            <span>방식</span>
            <select value={subjectModeId} onChange={(event) => setSubjectModeId(event.target.value)}>
              {SUBJECT_POLICY_MODES.map((mode) => <option value={mode.id} key={mode.id}>{mode.label}</option>)}
            </select>
          </label>
          <div className="games-rank-split">
            <SmallStat label="현재 방식" value={selectedSubject.modeLabel} />
            <SmallStat label="평균" value={selectedSubject.averageScore} />
            <SmallStat label="교사" value={selectedSubject.teacherName} />
          </div>
          <label className="game-save-json-field">
            <span>공개 활동</span>
            <select value={subjectShowcaseActionId} onChange={(event) => setSubjectShowcaseActionId(event.target.value)}>
              {SUBJECT_SHOWCASE_ACTIONS.map((action) => (
                <option value={action.id} key={action.id}>
                  {action.label} / AP {action.apCost} / {action.budgetCost.toLocaleString('ko-KR')}
                </option>
              ))}
            </select>
          </label>
          <p style={{ color: '#64717d', fontWeight: 800, lineHeight: 1.55 }}>
            {selectedSubjectShowcaseAction.description}
          </p>
          <div className="games-rank-split">
            <SmallStat label="진행 상태" value={selectedSubjectShowcase?.activeText || '대기'} />
            <SmallStat label="대상 후보" value={`${selectedSubjectShowcaseTargets}명`} />
            <SmallStat label="브랜드 잠재" value={selectedSubjectShowcase?.brandPotential || 0} />
            <SmallStat label="진행 활동" value={subjectShowcaseSummaryData.activeCount} />
          </div>
          <div style={{ display: 'grid', gap: 8 }}>
            <ActionButton onClick={() => applySchoolAction('수업 방식 변경', (current) => applySubjectPolicyAction(current, subjectId, subjectModeId))} disabled={state.player.weeklyActionPoint < 1}>수업 방식 변경</ActionButton>
            <ActionButton
              onClick={() => applySchoolAction('공개 활동 시작', (current) => applySubjectShowcaseAction(current, subjectId, subjectShowcaseActionId))}
              disabled={
                state.player.weeklyActionPoint < selectedSubjectShowcaseAction.apCost
                || state.school.budget < selectedSubjectShowcaseAction.budgetCost
                || selectedSubjectShowcaseActive
              }
            >
              공개 활동 시작
            </ActionButton>
          </div>
          <RecentActionResult label="최근 과목 운영 결과" text={recentActionText} />
          <p style={{ color: '#6c7884', fontWeight: 800, lineHeight: 1.55 }}>
            {selectedSubjectShowcase?.lastLog || subjectShowcaseSummaryData.note}
          </p>
        </section>

        <section className="games-panel">
          <div className="games-panel-title">
            <h2>입학 모집</h2>
            <span>{selectedRecruitment.label}</span>
          </div>
          <label className="game-save-json-field">
            <span>모집 전략</span>
            <select value={recruitmentStrategyId} onChange={(event) => setRecruitmentStrategyId(event.target.value)}>
              {RECRUITMENT_STRATEGIES.map((strategy) => <option value={strategy.id} key={strategy.id}>{strategy.label}</option>)}
            </select>
          </label>
          <div className="games-rank-split">
            <SmallStat label="지원자" value={state.school.admissions.applications} />
            <SmallStat label="관심도" value={state.school.admissions.inboundInterest} />
            <SmallStat label="신입 질" value={state.school.admissions.nextIntakeQuality} />
            <SmallStat label="홍보 탄력" value={state.school.admissions.marketingMomentum || 0} />
          </div>
          <ActionButton onClick={() => applySchoolAction('모집 캠페인', (current) => runAdmissionCampaignAction(current, recruitmentStrategyId))} disabled={state.player.weeklyActionPoint < 2}>
            모집 캠페인
          </ActionButton>
          <RecentActionResult label="최근 모집 결과" text={recentActionText} />
        </section>

        <section className="games-panel">
          <div className="games-panel-title">
            <h2>진로 지도</h2>
            <span>{selectedCareer.label}</span>
          </div>
          <label className="game-save-json-field">
            <span>트랙</span>
            <select value={careerTrackId} onChange={(event) => setCareerTrackId(event.target.value)}>
              {careerRows.map((track) => <option value={track.id} key={track.id}>{track.label} · {track.count}명</option>)}
            </select>
          </label>
          <div className="games-rank-split">
            <SmallStat label="평균 준비" value={careerRows.find((track) => track.id === careerTrackId)?.averageReadiness || 0} />
            <SmallStat label="기록" value={state.careerReports.length} />
            <SmallStat label="대상" value="하위 6명" />
          </div>
          <ActionButton onClick={() => applySchoolAction('진로 상담', (current) => runCareerCounselingAction(current, careerTrackId))} disabled={state.player.weeklyActionPoint < 2}>
            진로 상담 실행
          </ActionButton>
          <RecentActionResult label="최근 진로 지도 결과" text={recentActionText} />
        </section>
      </section>

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

      <section className="games-dashboard">
        <section className="games-panel">
          <div className="games-panel-title">
            <h2>상위 학생</h2>
            <span>이해도 기준</span>
          </div>
          <div className="game-save-list">
            {topStudents.map((student) => (
              <article className="game-save-row" key={student.id}>
                <div>
                  <span>{student.grade}학년 {student.classNo}반</span>
                  <strong>{student.name}</strong>
                </div>
                <strong>{student.understanding}</strong>
              </article>
            ))}
          </div>
        </section>

        <section className="games-panel">
          <div className="games-panel-title">
            <h2>위기 학생</h2>
            <span>{riskStudents.length}명</span>
          </div>
          <div className="game-save-list">
            {riskStudents.length ? riskStudents.map((student) => (
              <article className="game-save-row" key={student.id}>
                <div>
                  <span>스트레스 {student.stress} / 건강 {student.health}</span>
                  <strong>{student.name}</strong>
                </div>
                <strong>{student.satisfaction}</strong>
              </article>
            )) : <div className="games-empty">현재 즉시 개입이 필요한 학생은 없습니다.</div>}
          </div>
        </section>

        <section className="games-panel">
          <div className="games-panel-title">
            <h2>교사와 시설</h2>
            <span>{teachers.length}명 / {state.facilities.length}곳</span>
          </div>
          <label className="game-save-json-field">
            <span>교사</span>
            <select value={selectedTeacher?.id || teacherId} onChange={(event) => setTeacherId(event.target.value)}>
              {teachers.map((teacher) => <option value={teacher.id} key={teacher.id}>{teacher.name} · {teacher.subject} · {teacher.actionHint}</option>)}
            </select>
          </label>
          <label className="game-save-json-field">
            <span>교사 액션</span>
            <select value={teacherActionId} onChange={(event) => setTeacherActionId(event.target.value)}>
              {TEACHER_ACTIONS.map((action) => (
                <option value={action.id} key={action.id}>{action.label} / AP {action.apCost} / {action.budgetCost.toLocaleString('ko-KR')}</option>
              ))}
            </select>
          </label>
          <div className="games-rank-split">
            <SmallStat label="평가" value={`${selectedTeacher?.evaluationGrade || '-'} / ${selectedTeacher?.evaluationScore || 0}`} />
            <SmallStat label="이탈 위험" value={selectedTeacher?.attritionRisk || 0} />
            <SmallStat label="계약" value={selectedTeacher?.contractWeeksRemaining ?? '-'} />
            <SmallStat label="상태" value={selectedTeacher?.contractStatus || '-'} />
          </div>
          <div style={{ display: 'grid', gap: 8, marginTop: 10 }}>
            <ActionButton
              onClick={() => applySchoolAction('교사 액션', (current) => applyTeacherAction(current, selectedTeacher?.id || teacherId, teacherActionId))}
              disabled={!selectedTeacher || state.player.weeklyActionPoint < selectedTeacherAction.apCost || state.school.budget < selectedTeacherAction.budgetCost}
            >
              {selectedTeacherAction.label} 실행
            </ActionButton>
            <p style={{ color: '#52677a', fontWeight: 700, margin: 0 }}>{selectedTeacherAction.description}</p>
          </div>
          <RecentActionResult label="최근 교사 운영 결과" text={recentActionText} />
          <div className="game-save-list">
            {teachers.slice(0, 6).map((teacher) => (
              <article className="game-save-row" key={teacher.id}>
                <div>
                  <span>{teacher.subject} / 피로 {teacher.fatigue} / 사기 {teacher.morale}</span>
                  <strong>{teacher.name}</strong>
                  <small>{teacher.rank} · {teacher.actionHint}{teacher.profileLog?.[0] ? ` · ${teacher.profileLog[0]}` : ''}</small>
                </div>
                <strong>{teacher.teachingSkill}</strong>
              </article>
            ))}
            {state.facilities.slice(0, 3).map((facility) => (
              <article className="game-save-row" key={facility.id}>
                <div>
                  <span>{facility.type} / 수용 {facility.capacity}</span>
                  <strong>{facility.name}</strong>
                </div>
                <strong>{facility.condition}</strong>
              </article>
            ))}
          </div>
        </section>
      </section>

      <section className="games-dashboard">
        <section className="games-panel">
          <div className="games-panel-title">
            <h2>동아리</h2>
            <span>{selectedClub.label}</span>
          </div>
          <label className="game-save-json-field">
            <span>동아리</span>
            <select value={clubId} onChange={(event) => setClubId(event.target.value)}>
              {clubs.map((club) => <option value={club.id} key={club.id}>{club.label} · {club.memberCount}/{club.capacity}</option>)}
            </select>
          </label>
          <div className="games-rank-split">
            <SmallStat label="분위기" value={selectedClub.clubMood} />
            <SmallStat label="영향력" value={selectedClub.influence} />
            <SmallStat label="리더" value={selectedClub.leaderStudentName} />
            <SmallStat label="발표회" value={selectedClub.showcaseWeeksRemaining ? `${selectedClub.showcaseWeeksRemaining}주` : '대기'} />
          </div>
          <div style={{ display: 'grid', gap: 8 }}>
            <ActionButton onClick={() => applySchoolAction('동아리 신입 모집', (current) => runClubRecruitmentAction(current, clubId))} disabled={state.player.weeklyActionPoint < 2}>신입 모집</ActionButton>
            <ActionButton onClick={() => applySchoolAction('동아리 발표회 준비', (current) => startClubShowcaseAction(current, clubId))} disabled={state.player.weeklyActionPoint < 2 || selectedClub.showcaseWeeksRemaining > 0}>발표회 준비</ActionButton>
          </div>
          <RecentActionResult label="최근 동아리 운영 결과" text={recentActionText} />
        </section>

        <section className="games-panel">
          <div className="games-panel-title">
            <h2>축제</h2>
            <span>{festival.active ? `${festival.active.weeksRemaining}주 남음` : '대기'}</span>
          </div>
          <label className="game-save-json-field">
            <span>행사</span>
            <select value={festivalId} onChange={(event) => setFestivalId(event.target.value)} disabled={Boolean(festival.active)}>
              {FESTIVAL_TYPES.map((item) => <option value={item.id} key={item.id}>{item.label} · {item.budgetCost.toLocaleString('ko-KR')}</option>)}
            </select>
          </label>
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

        <section className="games-panel">
          <div className="games-panel-title">
            <h2>진로/행사 기록</h2>
            <span>{state.careerReports.length + festival.history.length}건</span>
          </div>
          <div className="game-save-list">
            {state.careerReports.slice(0, 3).map((report, index) => (
              <article className="game-save-row" key={`${report.trackId}-${index}`}>
                <div>
                  <span>진로 · {report.students}명</span>
                  <strong>{report.label}</strong>
                </div>
                <strong>{report.week}주</strong>
              </article>
            ))}
            {festival.history.slice(0, 3).map((event, index) => (
              <article className="game-save-row" key={`${event.label}-${index}`}>
                <div>
                  <span>행사 · {event.metric}</span>
                  <strong>{event.label}</strong>
                </div>
                <strong>{event.winnerName}</strong>
              </article>
            ))}
            {!state.careerReports.length && !festival.history.length ? <div className="games-empty">아직 진로/행사 기록이 없습니다.</div> : null}
          </div>
        </section>
      </section>

      <section className="games-dashboard">
        <section className="games-panel">
          <div className="games-panel-title">
            <h2>최근 시험</h2>
            <span>{state.recentExamResults.length}건</span>
          </div>
          <div className="game-save-list">
            {state.recentExamResults.length ? state.recentExamResults.slice(0, 6).map((row) => (
              <article className="game-save-row" key={row.studentId}>
                <div>
                  <span>시험 점수</span>
                  <strong>{row.name}</strong>
                </div>
                <strong>{row.score}</strong>
              </article>
            )) : <div className="games-empty">아직 시험 결과가 없습니다. 3주차, 5주차, 6주차, 9주차, 11주차, 12주차에 시험이 진행됩니다.</div>}
          </div>
        </section>

        <section className="games-panel">
          <div className="games-panel-title">
            <h2>학기 보고서</h2>
            <span>{state.semesterHistory.length}개</span>
          </div>
          <div className="game-save-list">
            {state.semesterHistory.length ? state.semesterHistory.slice(0, 5).map((report, index) => (
              <article className="game-save-row" key={`${report.year}-${report.semester}-${index}`}>
                <div>
                  <span>{report.year}년 {report.semester}학기</span>
                  <strong>학업 {report.academic} / 복지 {report.wellbeing}</strong>
                </div>
                <strong>{report.score}</strong>
              </article>
            )) : <div className="games-empty">12주차를 넘기면 학기 보고서가 생성됩니다.</div>}
          </div>
        </section>

        <section className="games-panel">
          <div className="games-panel-title">
            <h2>운영 로그</h2>
            <span>{state.runId}</span>
          </div>
          <div className="games-activity-list">
            {state.log.slice(0, 10).map((line, index) => (
              <div key={`${line}-${index}`}>
                <strong>{line}</strong>
              </div>
            ))}
          </div>
        </section>
      </section>
              </>
            ),
          },
        ]}
      />
  );
}
