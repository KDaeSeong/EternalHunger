'use client';

import { useEffect, useRef, useState } from 'react';
import DefenseBoard from './DefenseBoard';
import { STUDENTS } from '../_lib/infiniteDefenseData.js';
import { createDefenseEffectPreview, defenseEffectEvents } from '../_lib/infiniteDefenseEffects.js';
import { defenseCueProfile, defenseSoundCue } from '../_lib/infiniteDefenseSound.js';
import useGameSfx from '../../_lib/useGameSfx';

export default function DefenseEffectPreview({ studentId,onStudentChange,onClose,volume,soundEnabled }) {
  const dialogRef=useRef(null),[sample,setSample]=useState({stage:'',sequence:0});
  const student=STUDENTS.find(row=>row.id===studentId),state=createDefenseEffectPreview(studentId,sample.stage,sample.sequence);
  const play=useGameSfx({theme:'tactical',volume:volume*.24,enabled:volume>0,resolveProfile:defenseCueProfile});
  useEffect(()=>{const dialog=dialogRef.current;if(!dialog.open)dialog.showModal();return()=>{if(dialog.open)dialog.close();};},[]);
  const replay=stage=>{const sequence=sample.sequence+1,next=createDefenseEffectPreview(studentId,stage,sequence);setSample({stage,sequence});
    const cue=defenseSoundCue(defenseEffectEvents(next),stage);if(cue)play(cue);};
  return <dialog ref={dialogRef} className="defense-effect-preview" aria-labelledby="defense-preview-title"
    onCancel={event=>{event.preventDefault();onClose();}}>
    <div className="defense-preview-heading"><div><small>캐릭터 연출</small><h2 id="defense-preview-title">공격·스킬 미리보기</h2></div>
      <button type="button" className="defense-button" onClick={onClose} autoFocus>미리보기 닫기</button></div>
    <label className="defense-preview-select">미리볼 캐릭터<select aria-label="미리볼 캐릭터" data-game-sfx="off" value={studentId}
      onChange={event=>{setSample({stage:'',sequence:sample.sequence+1});onStudentChange(event.target.value);}}>
      {STUDENTS.map(row=><option value={row.id} key={row.id}>{row.name}</option>)}</select></label>
    <p className="defense-preview-description"><strong>{student.name}</strong> · {student.role}<br />디펜스의 실제 공격과 광역·관통·둔화·생산 지원을 표현합니다.</p>
    <div className="defense-preview-stage"><DefenseBoard state={state} selectedId={studentId} disabled
      effectStage={sample.stage} effectScope={'defense-preview-'+sample.sequence} effectDuration={400} /></div>
    <div className="defense-preview-controls"><button type="button" className="defense-button" data-game-sfx="off" onClick={()=>replay('attack')}>일반 공격 재생</button>
      <button type="button" className="defense-primary" data-game-sfx="off" onClick={()=>replay('skill')}>특성·스킬 재생</button></div>
    <p className="defense-preview-note">{soundEnabled&&volume>0?'효과음 '+Math.round(volume*100)+'%':'효과음 꺼짐'} · 미리보기는 작전 진행에 영향을 주지 않습니다.</p>
  </dialog>;
}
