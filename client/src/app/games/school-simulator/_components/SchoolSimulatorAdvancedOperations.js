import {
  ActionButton,
  SmallStat,
  RecentActionResult,
} from '../../_components/GamePlayPrimitives';
import {
  POLICY_PRESETS,
  RECRUITMENT_STRATEGIES,
  SUBJECT_POLICY_MODES,
  SUBJECT_SHOWCASE_ACTIONS,
  WORK_ACTIONS,
  applySubjectPolicyAction,
  applySubjectShowcaseAction,
  endWeekAction,
  restAction,
  runAdmissionCampaignAction,
  runCareerCounselingAction,
} from '../_lib/schoolSimulatorEngine';

export default function SchoolSimulatorAdvancedOperations({
  actionId,
  applySchoolAction,
  applySelectedAction,
  applySelectedPolicy,
  averages,
  careerRows,
  careerTrackId,
  policyId,
  recentActionText,
  recruitmentStrategyId,
  selectedAction,
  selectedCareer,
  selectedPolicy,
  selectedRecruitment,
  selectedSubject,
  selectedSubjectShowcase,
  selectedSubjectShowcaseAction,
  selectedSubjectShowcaseActive,
  selectedSubjectShowcaseTargets,
  setActionId,
  setCareerTrackId,
  setPolicyId,
  setRecruitmentStrategyId,
  setSubjectId,
  setSubjectModeId,
  setSubjectShowcaseActionId,
  state,
  subjectId,
  subjectModeId,
  subjectShowcaseActionId,
  subjectRows,
  subjectShowcaseSummaryData,
  weekInfo,
}) {
  return (
    <>
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
    </>
  );
}
