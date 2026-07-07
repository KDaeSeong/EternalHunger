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
                  <div className="games-rank-split">
                    <SmallStat label="HP" value={`${student.currentHp}/${student.hp}`} />
                    <SmallStat label="사기" value={student.morale} />
                    <SmallStat label="승률" value={`${winRatePreview}%`} />
                  </div>
                  <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
                    <ActionButton disabled={!canAct} onClick={() => setState((current) => feedStudentAction(current, studentId, recipeId))}>선택 메뉴 배식</ActionButton>
                    <ActionButton disabled={!canAct} onClick={() => setState((current) => battleAction(current, studentId))}>전투 진행</ActionButton>
                    <ActionButton disabled={!canAct} onClick={() => setState((current) => nextDayAction(current))}>다음 영업일</ActionButton>
                  </div>
                </section>
              </section>
    </>
  );
}
