'use client';

import { useState } from 'react';
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
} from '../_lib/schoolSimulatorEngine';

export default function useSchoolSimulatorSelections() {
  const [actionId, setActionId] = useState(WORK_ACTIONS[0].id);
  const [policyId, setPolicyId] = useState(POLICY_PRESETS[0].id);
  const [subjectId, setSubjectId] = useState(SUBJECTS[0].id);
  const [subjectModeId, setSubjectModeId] = useState(SUBJECT_POLICY_MODES[0].id);
  const [subjectShowcaseActionId, setSubjectShowcaseActionId] = useState(SUBJECT_SHOWCASE_ACTIONS[0].id);
  const [recruitmentStrategyId, setRecruitmentStrategyId] = useState(RECRUITMENT_STRATEGIES[0].id);
  const [careerTrackId, setCareerTrackId] = useState(CAREER_TRACKS[0].id);
  const [clubId, setClubId] = useState('club_research');
  const [festivalId, setFestivalId] = useState(FESTIVAL_TYPES[0].id);
  const [teacherId, setTeacherId] = useState('t_hina');
  const [teacherActionId, setTeacherActionId] = useState(TEACHER_ACTIONS[0].id);

  const resetForNewRun = (nextState) => {
    setActionId(WORK_ACTIONS[0].id);
    setPolicyId(nextState?.school?.policyPreset || POLICY_PRESETS[0].id);
    setSubjectId(SUBJECTS[0].id);
    setSubjectModeId(SUBJECT_POLICY_MODES[0].id);
    setSubjectShowcaseActionId(SUBJECT_SHOWCASE_ACTIONS[0].id);
    setRecruitmentStrategyId(RECRUITMENT_STRATEGIES[0].id);
    setCareerTrackId(CAREER_TRACKS[0].id);
    setClubId('club_research');
    setFestivalId(FESTIVAL_TYPES[0].id);
  };

  const resetForLoadedRun = (nextState) => {
    setPolicyId(nextState?.school?.policyPreset || POLICY_PRESETS[0].id);
  };

  return {
    actionId,
    careerTrackId,
    clubId,
    festivalId,
    policyId,
    recruitmentStrategyId,
    resetForLoadedRun,
    resetForNewRun,
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
    subjectId,
    subjectModeId,
    subjectShowcaseActionId,
    teacherActionId,
    teacherId,
  };
}
