import { CAREER_TRACKS, SUBJECTS, TEACHER_ACTIONS } from './schoolSimulatorEngine';
function subjectLabel(subjectId) {
  return SUBJECTS.find((subject) => subject.id === subjectId)?.label || subjectId || '-';
}

function careerLabel(trackId) {
  return CAREER_TRACKS.find((track) => track.id === trackId)?.label || trackId || '-';
}

function studentCareScore(student) {
  const weakestScore = Math.min(...Object.values(student.subjectScores || { base: student.understanding || 50 }));
  return Math.round(
    Math.max(0, Number(student.stress || 0) - 48) * 1.4
    + Math.max(0, 62 - Number(student.health || 0)) * 1.2
    + Math.max(0, 58 - Number(student.satisfaction || 0))
    + Math.max(0, 58 - Number(student.careerReadiness || 0)) * (Number(student.grade || 1) >= 3 ? 1.1 : 0.45)
    + Math.max(0, 58 - weakestScore) * 0.8
  );
}

function buildStudentCareRows(students = []) {
  return students.map((student) => {
    const subjectEntries = Object.entries(student.subjectScores || {});
    const weakest = subjectEntries.sort((a, b) => Number(a[1] || 0) - Number(b[1] || 0))[0] || [student.weakSubject, student.understanding || 50];
    const score = studentCareScore(student);
    const needsRecovery = Number(student.stress || 0) >= 64 || Number(student.health || 0) <= 55 || Number(student.satisfaction || 0) <= 52;
    const needsCareer = Number(student.grade || 1) >= 3 && Number(student.careerReadiness || 0) < 62;
    const needsLearning = Number(weakest[1] || 0) < 58;
    const command = needsRecovery
      ? { type: 'work', actionId: 'boostCounseling', label: '상담 강화' }
      : needsCareer
        ? { type: 'career', trackId: student.careerTrack, label: '진로 상담' }
        : needsLearning
          ? { type: 'work', actionId: 'libraryProgram', label: '학습 프로그램' }
          : { type: 'work', actionId: 'studentCouncilMeeting', label: '학생회 협의' };
    return {
      id: student.id,
      name: student.name,
      grade: student.grade,
      classNo: student.classNo,
      stress: student.stress,
      health: student.health,
      satisfaction: student.satisfaction,
      careerReadiness: student.careerReadiness,
      careerTrack: student.careerTrack,
      weakestSubject: weakest[0],
      weakestScore: Math.round(Number(weakest[1] || 0)),
      score,
      tone: score >= 55 ? '위험' : score >= 28 ? '주의' : '안정',
      detail: `약점 ${subjectLabel(weakest[0])} ${Math.round(Number(weakest[1] || 0))} · 진로 ${careerLabel(student.careerTrack)} ${student.careerReadiness}`,
      command,
    };
  }).sort((a, b) => b.score - a.score);
}

function buildStaffCareRows(teachers = [], facilities = []) {
  const teacherRowsForCare = teachers.map((teacher) => {
    const score = Math.round(
      Number(teacher.attritionRisk || 0)
      + Math.max(0, Number(teacher.fatigue || 0) - 45) * 0.9
      + Math.max(0, 58 - Number(teacher.morale || 0)) * 0.8
      + (Number(teacher.contractWeeksRemaining || 99) <= 3 ? 18 : 0)
    );
    const actionId = teacher.isOnLeave || Number(teacher.fatigue || 0) >= 66
      ? 'teacher_recovery'
      : Number(teacher.contractWeeksRemaining || 99) <= 3
        ? 'teacher_contract_renewal'
        : Number(teacher.attritionRisk || 0) >= 62
          ? 'mentor_case_conference'
          : 'teacher_evaluation_review';
    const action = TEACHER_ACTIONS.find((item) => item.id === actionId) || TEACHER_ACTIONS[0];
    return {
      id: teacher.id,
      kind: 'teacher',
      name: teacher.name,
      label: `${teacher.subject} · ${teacher.evaluationGrade || '-'}등급`,
      score,
      tone: score >= 72 ? '위험' : score >= 42 ? '주의' : '안정',
      detail: `피로 ${teacher.fatigue} · 사기 ${teacher.morale} · 이탈 위험 ${teacher.attritionRisk}`,
      command: { type: 'teacher', teacherId: teacher.id, actionId, label: action.label },
    };
  });
  const facilityRows = facilities.map((facility) => {
    const score = Math.round(Math.max(0, 82 - Number(facility.condition || 0)) + Math.max(0, 55 - Number(facility.capacity || 0)) * 0.2);
    return {
      id: facility.id,
      kind: 'facility',
      name: facility.name,
      label: `${facility.type} · 수용 ${facility.capacity}`,
      score,
      tone: score >= 34 ? '위험' : score >= 18 ? '주의' : '안정',
      detail: `상태 ${facility.condition}. 시설 보수로 안전 평판과 리스크를 관리하세요.`,
      command: { type: 'work', actionId: 'facilityMaintenance', label: '시설 보수' },
    };
  });
  return [...teacherRowsForCare, ...facilityRows].sort((a, b) => b.score - a.score);
}

export function buildSchoolCareReport(state, teachers = []) {
  const students = Array.isArray(state.students) ? state.students : [];
  const facilities = Array.isArray(state.facilities) ? state.facilities : [];
  const studentRows = buildStudentCareRows(students);
  const staffRows = buildStaffCareRows(teachers, facilities);
  const highStudentCount = studentRows.filter((row) => row.tone === '위험').length;
  const highStaffCount = staffRows.filter((row) => row.tone === '위험').length;
  const facilityRiskCount = staffRows.filter((row) => row.kind === 'facility' && row.tone !== '안정').length;
  const topStudent = studentRows[0] || null;
  const topStaff = staffRows[0] || null;
  const nextAction = topStudent && (!topStaff || topStudent.score >= topStaff.score)
    ? {
      title: `${topStudent.name} 케어`,
      detail: topStudent.detail,
      command: topStudent.command,
    }
    : topStaff ? {
      title: `${topStaff.name} 점검`,
      detail: topStaff.detail,
      command: topStaff.command,
    } : null;
  return {
    headline: highStudentCount || highStaffCount
      ? `학생 ${highStudentCount}명 · 운영 ${highStaffCount}건 위험`
      : '학생/운영 안정',
    highStudentCount,
    highStaffCount,
    facilityRiskCount,
    studentRows,
    staffRows,
    nextAction,
  };
}
