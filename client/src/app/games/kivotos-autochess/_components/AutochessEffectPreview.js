'use client';

import { useEffect, useRef, useState } from 'react';
import AutochessBoard from './AutochessBoard';
import { CHARACTER_EFFECTS } from '../_lib/autochessCharacterEffects.js';
import { STUDENTS, STUDENT_BY_ID } from '../_lib/autochessData.js';
import { autochessCueProfile, combatSoundCue, createEffectPreview } from '../_lib/autochessCombatSound.js';
import useGameSfx from '../../_lib/useGameSfx';

export default function AutochessEffectPreview({ studentId, onStudentChange, onClose, volume, soundEnabled }) {
  const dialogRef = useRef(null), [sample, setSample] = useState({ kind: '', sequence: 0 });
  const student = STUDENT_BY_ID[studentId], profile = CHARACTER_EFFECTS[studentId];
  const play = useGameSfx({ theme: 'tactical', volume: volume * .24, enabled: volume > 0, resolveProfile: autochessCueProfile });
  const preview = createEffectPreview(studentId, sample.kind, sample.sequence);
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog.open) dialog.showModal();
    return () => { if (dialog.open) dialog.close(); };
  }, []);
  const replay = kind => {
    const sequence = sample.sequence + 1, next = createEffectPreview(studentId, kind, sequence);
    setSample({ kind, sequence });
    const cue = combatSoundCue(next.watch, 0);
    if (cue) play(cue);
  };
  return <dialog ref={dialogRef} className="ac-effect-preview" aria-labelledby="ac-preview-title"
    onCancel={event => { event.preventDefault(); onClose(); }}>
    <div className="ac-preview-heading"><div><small>캐릭터 연출</small><h2 id="ac-preview-title">공격·스킬 미리보기</h2></div>
      <button type="button" className="ac-button" onClick={onClose} autoFocus>미리보기 닫기</button></div>
    <label className="ac-preview-select">미리볼 캐릭터<select aria-label="미리볼 캐릭터" data-game-sfx="off" value={studentId}
      onChange={event => { setSample({ kind: '', sequence: sample.sequence + 1 }); onStudentChange(event.target.value); }}>
      {STUDENTS.map(character => <option key={character.id} value={character.id}>{character.name}</option>)}
    </select></label>
    <p className="ac-preview-description"><strong>{student.name}</strong> · {profile.attackLabel} / {student.skillName}</p>
    <div className="ac-preview-stage"><AutochessBoard player={preview.player} watch={preview.watch} frameIndex={0} effectDuration={400} editable={false} /></div>
    <div className="ac-preview-controls">
      <button type="button" className="ac-button" data-game-sfx="off" onClick={() => replay('attack')}>일반 공격 재생</button>
      <button type="button" className="ac-primary" data-game-sfx="off" onClick={() => replay('skill')}>스킬 재생</button>
    </div>
    <p className="ac-combat-note">{soundEnabled && volume > 0 ? '효과음 ' + Math.round(volume * 100) + '%' : '효과음 꺼짐'} · 연출과 소리를 확인하는 미리보기입니다.</p>
  </dialog>;
}
