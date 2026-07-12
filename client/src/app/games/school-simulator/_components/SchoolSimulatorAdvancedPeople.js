import {
  ActionButton,
  SmallStat,
} from '../../_components/GamePlayPrimitives';
import SchoolSimulatorActionResult from './SchoolSimulatorActionResult';
import {
  FESTIVAL_TYPES,
  TEACHER_ACTIONS,
  applyTeacherAction,
  launchFestivalAction,
  runClubRecruitmentAction,
  startClubShowcaseAction,
} from '../_lib/schoolSimulatorEngine';

export default function SchoolSimulatorAdvancedPeople({
  applySchoolAction,
  clubId,
  clubs,
  festival,
  festivalId,
  recentActionText,
  report,
  resultPresentation,
  riskStudents,
  selectedClub,
  selectedFestival,
  selectedTeacher,
  selectedTeacherAction,
  setClubId,
  setFestivalId,
  setTeacherActionId,
  setTeacherId,
  state,
  teacherActionId,
  teacherId,
  teachers,
  topStudents,
}) {
  return (
    <>
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
                      action="lesson"
                      cue="off"
                      onClick={() => applySchoolAction('교사 액션', (current) => applyTeacherAction(current, selectedTeacher?.id || teacherId, teacherActionId))}
                      disabled={!selectedTeacher || state.player.weeklyActionPoint < selectedTeacherAction.apCost || state.school.budget < selectedTeacherAction.budgetCost}
                    >
                      {selectedTeacherAction.label} 실행
                    </ActionButton>
                    <p style={{ color: '#52677a', fontWeight: 700, margin: 0 }}>{selectedTeacherAction.description}</p>
                  </div>
                  <SchoolSimulatorActionResult fallbackLabel="최근 교사 운영 결과" resultPresentation={resultPresentation} text={recentActionText} />
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
                    <ActionButton action="recruit" cue="off" onClick={() => applySchoolAction('동아리 신입 모집', (current) => runClubRecruitmentAction(current, clubId))} disabled={state.player.weeklyActionPoint < 2}>신입 모집</ActionButton>
                    <ActionButton action="festival" cue="off" onClick={() => applySchoolAction('동아리 발표회 준비', (current) => startClubShowcaseAction(current, clubId))} disabled={state.player.weeklyActionPoint < 2 || selectedClub.showcaseWeeksRemaining > 0}>발표회 준비</ActionButton>
                  </div>
                  <SchoolSimulatorActionResult fallbackLabel="최근 동아리 운영 결과" resultPresentation={resultPresentation} text={recentActionText} />
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
                  <ActionButton action="festival" cue="off" onClick={() => applySchoolAction('행사 시작', (current) => launchFestivalAction(current, festivalId))} disabled={state.player.weeklyActionPoint < 3 || Boolean(festival.active)}>
                    행사 시작
                  </ActionButton>
                  <SchoolSimulatorActionResult fallbackLabel="최근 행사 결과" resultPresentation={resultPresentation} text={recentActionText} />
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
  );
}
