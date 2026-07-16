'use client';

import Image from 'next/image';
import { useEffect, useMemo, useState } from 'react';
import GameActionIcon from '../../games/_components/GameActionIcon';
import { RANDOM_PARTICIPANT_PRESET_ID } from '../_lib/participantPresetRuntime';
import { validateCustomRosterDraft } from '../_lib/customRosterRuntime';

function actorId(actor) {
  return String(actor?._id || actor?.id || actor?.name || '').trim();
}

function actorName(actor) {
  return String(actor?.name || actor?.nickname || actor?.charName || '이름 없음').trim();
}

function actorTeamNo(actor, fallbackIndex = 0) {
  const raw = String(actor?.matchTeamId || actor?.teamId || '');
  const matched = raw.match(/(\d+)$/);
  const parsed = Number(matched?.[1] || 0);
  return parsed >= 1 && parsed <= 8 ? parsed : Math.floor(fallbackIndex / 3) + 1;
}

function shuffledActors(value) {
  const next = [...(Array.isArray(value) ? value : [])];
  for (let index = next.length - 1; index > 0; index -= 1) {
    const target = Math.floor(Math.random() * (index + 1));
    [next[index], next[target]] = [next[target], next[index]];
  }
  return next;
}

function modeLabel(value) {
  if (value === 'custom') return '사용자 지정 24인';
  if (value === 'preset') return '저장 편성';
  return '무작위 24인';
}

function initialRosterState(survivors, squadMode) {
  const source = Array.isArray(survivors) ? survivors : [];
  const selectedIds = source.map((actor) => actorId(actor)).filter(Boolean).slice(0, 24);
  const teamAssignments = {};
  selectedIds.forEach((id, index) => {
    const actor = source.find((row) => actorId(row) === id);
    teamAssignments[id] = squadMode ? actorTeamNo(actor, index) : index + 1;
  });
  return { selectedIds, teamAssignments };
}

function RosterSetupModal({
  applyCustomParticipantRoster,
  candidateSurvivors,
  matchMode,
  onClose,
  survivors,
}) {
  const squadMode = matchMode === 'squad';
  const [initialRoster] = useState(() => initialRosterState(survivors, squadMode));
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState(initialRoster.selectedIds);
  const [showSelectedOnly, setShowSelectedOnly] = useState(false);
  const [teamAssignments, setTeamAssignments] = useState(initialRoster.teamAssignments);
  const [validationMessage, setValidationMessage] = useState('');

  const candidateById = useMemo(() => new Map(
    (Array.isArray(candidateSurvivors) ? candidateSurvivors : [])
      .map((actor) => [actorId(actor), actor])
      .filter(([id]) => id),
  ), [candidateSurvivors]);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const validation = useMemo(() => validateCustomRosterDraft({
    characterIds: selectedIds,
    teamAssignments,
  }, {
    matchMode,
    maxParticipants: 24,
    maxTeams: squadMode ? 8 : 24,
    teamSize: squadMode ? 3 : 1,
  }), [matchMode, selectedIds, squadMode, teamAssignments]);

  const visibleCandidates = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const selected = new Set(selectedIds);
    return [...candidateById.values()]
      .filter((actor) => !showSelectedOnly || selected.has(actorId(actor)))
      .filter((actor) => {
        if (!needle) return true;
        return [actorName(actor), actor?.weaponType, actor?.tacticalSkill]
          .some((value) => String(value || '').toLowerCase().includes(needle));
      })
      .sort((a, b) => actorName(a).localeCompare(actorName(b), 'ko'));
  }, [candidateById, search, selectedIds, showSelectedOnly]);

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const selectedActors = selectedIds.map((id) => candidateById.get(id)).filter(Boolean);
  const teamMembers = squadMode
    ? Array.from({ length: 8 }, (_, index) => selectedActors.filter((actor) => teamAssignments[actorId(actor)] === index + 1))
    : [];

  function distributeTeams(ids) {
    const next = {};
    ids.forEach((id, index) => {
      next[id] = squadMode ? Math.floor(index / 3) + 1 : index + 1;
    });
    setTeamAssignments(next);
  }

  function loadCurrentRoster() {
    const ids = (Array.isArray(survivors) ? survivors : [])
      .map((actor) => actorId(actor))
      .filter(Boolean)
      .slice(0, 24);
    setSelectedIds(ids);
    if (squadMode) {
      const next = {};
      ids.forEach((id, index) => {
        const actor = survivors.find((row) => actorId(row) === id);
        next[id] = actorTeamNo(actor, index);
      });
      setTeamAssignments(next);
    } else {
      distributeTeams(ids);
    }
    setValidationMessage('');
  }

  function loadRandomRoster() {
    const ids = shuffledActors([...candidateById.values()])
      .slice(0, 24)
      .map((actor) => actorId(actor));
    setSelectedIds(ids);
    distributeTeams(ids);
    setValidationMessage('');
  }

  function toggleActor(id) {
    if (!id) return;
    if (selectedSet.has(id)) {
      setSelectedIds((current) => current.filter((value) => value !== id));
      setTeamAssignments((current) => {
        const next = { ...current };
        delete next[id];
        return next;
      });
      setValidationMessage('');
      return;
    }
    if (selectedIds.length >= 24) {
      setValidationMessage('24명을 모두 선택했습니다. 기존 참가자를 해제한 뒤 추가해 주세요.');
      return;
    }
    const nextIds = [...selectedIds, id];
    setSelectedIds(nextIds);
    if (squadMode) {
      const openTeam = Array.from({ length: 8 }, (_, index) => index + 1)
        .find((teamNo) => Number(validation.teamCounts[teamNo] || 0) < 3) || 1;
      setTeamAssignments((current) => ({ ...current, [id]: openTeam }));
    } else {
      setTeamAssignments((current) => ({ ...current, [id]: nextIds.length }));
    }
    setValidationMessage('');
  }

  function changeTeam(id, value) {
    const teamNo = Number(value);
    setTeamAssignments((current) => ({ ...current, [id]: teamNo }));
    setValidationMessage(
      Number(validation.teamCounts[teamNo] || 0) >= 3 && Number(teamAssignments[id]) !== teamNo
        ? `${teamNo}팀이 3명을 넘었습니다. 다른 팀원을 이동해 주세요.`
        : ''
    );
  }

  function applyRoster() {
    const result = applyCustomParticipantRoster?.({
      characterIds: selectedIds,
      teamAssignments,
    });
    if (result?.ok) {
      onClose();
      return;
    }
    setValidationMessage(result?.errors?.[0] || validation.errors[0] || '편성을 완료할 수 없습니다.');
  }

  return (
    <div className="simulation-roster-modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="simulation-roster-modal" role="dialog" aria-modal="true" aria-labelledby="simulation-roster-title">
        <header className="simulation-roster-modal__header">
          <div>
            <span>경기 시작 설정</span>
            <h2 id="simulation-roster-title">사용자 지정 24인 편성</h2>
          </div>
          <button type="button" data-game-sfx="click" onClick={onClose} aria-label="닫기" title="닫기">
            <GameActionIcon action="close" label="닫기" />
          </button>
        </header>

        <div className="simulation-roster-summary" aria-label="편성 현황">
          <span><small>선택</small><strong>{selectedIds.length}/24</strong></span>
          <span><small>모드</small><strong>{squadMode ? '스쿼드' : '솔로'}</strong></span>
          <span><small>팀</small><strong>{squadMode ? `${Object.values(validation.teamCounts).filter((count) => count === 3).length}/8 완성` : '개인전'}</strong></span>
          <span className={validation.ready ? 'is-ready' : 'is-pending'}>
            <small>시작 준비</small><strong>{validation.ready ? '완료' : '편성 중'}</strong>
          </span>
        </div>

        <div className="simulation-roster-toolbar">
          <label>
            <GameActionIcon action="search" label="캐릭터 검색" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="이름·무기·전술 스킬 검색" autoFocus />
          </label>
          <button type="button" className={showSelectedOnly ? 'is-active' : ''} data-game-sfx="toggle" onClick={() => setShowSelectedOnly((value) => !value)}>
            <GameActionIcon action="draft" label="선택한 캐릭터" />
            선택만
          </button>
          <button type="button" data-game-sfx="select" onClick={loadCurrentRoster}>
            <GameActionIcon action="reset" label="현재 편성" />
            현재 편성
          </button>
          <button type="button" data-game-sfx="shuffle" onClick={loadRandomRoster}>
            <GameActionIcon action="shuffle" label="무작위 24명" />
            무작위 24명
          </button>
          {squadMode ? (
            <button type="button" data-game-sfx="confirm" onClick={() => distributeTeams(selectedIds)}>
              <GameActionIcon action="assign" label="균등 배정" />
              균등 배정
            </button>
          ) : null}
        </div>

        <div className={`simulation-roster-workspace${squadMode ? '' : ' is-solo'}`}>
          <section className="simulation-roster-candidates" aria-label="캐릭터 후보">
            <div className="simulation-roster-section-title">
              <strong>캐릭터</strong>
              <span>{visibleCandidates.length}명 표시</span>
            </div>
            <div className="simulation-roster-candidate-grid">
              {visibleCandidates.map((actor) => {
                const id = actorId(actor);
                const selected = selectedSet.has(id);
                return (
                  <button
                    type="button"
                    className={`simulation-roster-candidate${selected ? ' is-selected' : ''}`}
                    data-game-sfx={selected ? 'toggle' : 'select'}
                    aria-pressed={selected}
                    onClick={() => toggleActor(id)}
                    key={id}
                  >
                    <Image src={actor.previewImage || '/Images/default_image.png'} alt="" width={42} height={42} unoptimized />
                    <span>
                      <strong>{actorName(actor)}</strong>
                      <small>{actor.weaponType || '무기 미설정'}</small>
                    </span>
                    {selected ? <b>{squadMode ? `${teamAssignments[id] || '-'}팀` : '선택'}</b> : null}
                  </button>
                );
              })}
            </div>
          </section>

          {squadMode ? (
            <section className="simulation-roster-teams" aria-label="스쿼드 팀 배정">
              <div className="simulation-roster-section-title">
                <strong>스쿼드 배정</strong>
                <span>팀당 3명</span>
              </div>
              <div className="simulation-roster-team-grid">
                {teamMembers.map((members, index) => {
                  const teamNo = index + 1;
                  return (
                    <article className={`simulation-roster-team${members.length === 3 ? ' is-complete' : ''}`} key={teamNo}>
                      <header><strong>{teamNo}팀</strong><span>{members.length}/3</span></header>
                      <div>
                        {members.map((actor) => {
                          const id = actorId(actor);
                          return (
                            <label key={id}>
                              <Image src={actor.previewImage || '/Images/default_image.png'} alt="" width={30} height={30} unoptimized />
                              <span>{actorName(actor)}</span>
                              <select value={teamNo} onChange={(event) => changeTeam(id, event.target.value)} aria-label={`${actorName(actor)} 팀`}>
                                {Array.from({ length: 8 }, (_, teamIndex) => (
                                  <option value={teamIndex + 1} key={teamIndex + 1}>{teamIndex + 1}팀</option>
                                ))}
                              </select>
                            </label>
                          );
                        })}
                        {Array.from({ length: Math.max(0, 3 - members.length) }, (_, slot) => (
                          <span className="simulation-roster-empty-slot" key={slot}>빈 자리</span>
                        ))}
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          ) : null}
        </div>

        <footer className="simulation-roster-modal__footer">
          <p className={validation.ready ? 'is-ready' : ''} role="status">
            {validationMessage || validation.errors[0] || '24인 편성이 완료되었습니다.'}
          </p>
          <div>
            <button type="button" data-game-sfx="click" onClick={onClose}>취소</button>
            <button type="button" className="is-primary" data-game-sfx="off" disabled={!validation.ready} onClick={applyRoster}>
              <GameActionIcon action="confirm" label="편성 적용" />
              이 편성으로 시작
            </button>
          </div>
        </footer>
      </section>
    </div>
  );
}

export default function SimulationPregameRosterSetup({
  applyCustomParticipantRoster,
  applyParticipantPresetToCurrent,
  candidateSurvivors,
  day,
  disabled,
  matchMode,
  matchSec,
  participantSelectionMode,
  survivors,
}) {
  const [open, setOpen] = useState(false);
  if (Number(day || 0) !== 0 || Number(matchSec || 0) !== 0) return null;

  const squadMode = matchMode === 'squad';
  const mode = participantSelectionMode || 'random';

  return (
    <>
      <section className="simulation-pregame-roster" aria-label="참가자 편성 모드">
        <div className="simulation-pregame-roster__status">
          <GameActionIcon action="assign" label="참가자 편성" />
          <span><small>참가자 편성</small><strong>{modeLabel(mode)}</strong></span>
          <span><small>인원</small><strong>{survivors.length}/24명</strong></span>
          <span><small>경기 구성</small><strong>{squadMode ? '8팀 · 3명' : '24인 솔로'}</strong></span>
        </div>
        <div className="simulation-pregame-roster__actions">
          <button
            type="button"
            className={mode === 'random' ? 'is-active' : ''}
            data-game-sfx="shuffle"
            disabled={disabled}
            onClick={() => applyParticipantPresetToCurrent?.(RANDOM_PARTICIPANT_PRESET_ID)}
          >
            <GameActionIcon action="shuffle" label="무작위 24명" />
            무작위
          </button>
          <button
            type="button"
            className={mode !== 'random' ? 'is-active' : ''}
            data-game-sfx="open"
            disabled={disabled}
            onClick={() => setOpen(true)}
          >
            <GameActionIcon action="draft" label="사용자 지정 24명" />
            24인 직접 편성
          </button>
        </div>
      </section>

      {open ? (
        <RosterSetupModal
          applyCustomParticipantRoster={applyCustomParticipantRoster}
          candidateSurvivors={candidateSurvivors}
          matchMode={matchMode}
          onClose={() => setOpen(false)}
          survivors={survivors}
        />
      ) : null}
    </>
  );
}
