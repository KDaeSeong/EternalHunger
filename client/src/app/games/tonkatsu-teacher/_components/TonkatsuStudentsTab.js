import { ActionButton, SmallStat } from '../../_components/GamePlayPrimitives';
import {
  battleAction,
  feedStudentAction,
  nextDayAction,
} from '../_lib/tonkatsuTeacherEngine';

export default function TonkatsuStudentsTab(props) {
  const {
    canAct,
    recipeId,
    setState,
    setStudentId,
    state,
    student,
    studentId,
    winRatePreview,
  } = props;

  return (
    <>
              <section className="games-detail-grid">
                <section className="games-panel">
                  <div className="games-panel-title">
                    <h2>학생 지원</h2>
                    <span>{student.name}</span>
                  </div>
                  <label className="game-save-json-field tonkatsu-student-selector">
                    <span>지원 학생</span>
                    <select value={studentId} onChange={(event) => setStudentId(event.target.value)}>
                      {state.students.map((item) => (
                        <option value={item.id} key={item.id}>{item.name} · {item.role}</option>
                      ))}
                    </select>
                  </label>
                  <div className="games-rank-split">
                    <SmallStat label="HP" value={`${student.currentHp}/${student.hp}`} />
                    <SmallStat label="사기" value={student.morale} />
                    <SmallStat label="승률" value={`${winRatePreview}%`} />
                    <SmallStat label="치명타" value={`${Math.round(Number(student.crit || 0) * 100)}%`} />
                    <SmallStat label="회피" value={`${Math.round(Number(student.eva || 0) * 100)}%`} />
                    <SmallStat label="공격 속도" value={`x${Number(student.attackSpeed || 1).toFixed(2)}`} />
                  </div>
                  <p className="tonkatsu-student-note">
                    {student.notes} · 선호 #{student.pref} / 약점 #{student.weak}
                  </p>
                  <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
                    <ActionButton action="serve" cue="off" disabled={!canAct} onClick={() => setState((current) => feedStudentAction(current, studentId, recipeId))}>선택 메뉴 배식</ActionButton>
                    <ActionButton action="combat" cue="off" disabled={!canAct} onClick={() => setState((current) => battleAction(current, studentId))}>전투 진행</ActionButton>
                    <ActionButton action="advance" cue="off" disabled={!canAct} onClick={() => setState((current) => nextDayAction(current))}>다음 영업일</ActionButton>
                  </div>
                </section>
              </section>
    </>
  );
}
