import Image from 'next/image';
import { ActionButton, GameControlButton } from '../../_components/GamePlayPrimitives';
import { completeArchiveAction } from '../_lib/primitiveArchiveEngine';
import {
  PARTY_SORT_OPTIONS,
  actionLabel,
  chanceText,
} from '../_lib/primitiveArchivePageRuntime';

export default function PrimitiveArchivePartyWorkspace(props) {
  const {
    actorId,
    applyAction,
    archiveVictory,
    partyCap,
    partySort,
    partyView,
    recruitCandidates,
    recruitMember,
    selectedRecruit,
    setActorId,
    setPartySort,
    setSelectedRecruitId,
    state,
  } = props;

  return (
    <section className="games-detail-grid primitive-workspace-panel" role="tabpanel">
      <section className="games-panel">
        <div className="games-panel-title">
          <h2>파티</h2>
          <span>{state.party.length}/{partyCap} · {state.weather.name} · {state.weather.temp}°C</span>
        </div>
        <div className="primitive-party-toolbar">
          <label className="game-save-json-field">
            <span>정렬</span>
            <select value={partySort} onChange={(event) => setPartySort(event.target.value)}>
              {PARTY_SORT_OPTIONS.map((option) => (
                <option value={option.value} key={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
          {recruitCandidates.length ? (
            <div className="primitive-recruit-control">
              <select value={selectedRecruit?.id || ''} onChange={(event) => setSelectedRecruitId(event.target.value)}>
                {recruitCandidates.map((candidate) => (
                  <option value={candidate.id} key={candidate.id}>{candidate.name} · {candidate.role}</option>
                ))}
              </select>
              <GameControlButton action="recruit" disabled={!selectedRecruit || state.party.length >= partyCap} onClick={recruitMember}>합류</GameControlButton>
            </div>
          ) : null}
        </div>
        <div className="primitive-party-list">
          {partyView.map(({ member, chances, basisAction, basisChance, badges }) => (
            <button
              type="button"
              key={member.id}
              data-game-sfx="select"
              onClick={() => setActorId(member.id)}
              className={`primitive-party-member${actorId === member.id ? ' is-active' : ''}`}
            >
              <Image src={member.portrait} alt={member.name} width={44} height={44} />
              <span>
                <strong>{member.name} · {member.role}</strong>
                <small>HP {member.hp} · 허기 {member.hunger} · ST {member.stamina} · 체온 {Number(member.bodyTemp ?? 37).toFixed(1)}° · {badges.join(' / ')}</small>
                <small>추천 {actionLabel(basisAction)} {chanceText(basisChance)} · 채집 {chanceText(chances.gather)} · 사냥 {chanceText(chances.hunt)} · 제작 {chanceText(chances.craft)}</small>
              </span>
            </button>
          ))}
        </div>
      </section>

      <section className="games-panel primitive-objective-panel">
        <div className="games-panel-title">
          <h2>아카이브 목표</h2>
          <span>{archiveVictory.label}</span>
        </div>
        <div className="game-save-list">
          {archiveVictory.rows.map((row) => (
            <article className="game-save-row" key={row.id}>
              <div>
                <span>{row.done ? '완료' : '진행 중'}</span>
                <strong>{row.label}</strong>
              </div>
              <strong>{row.current}/{row.target}</strong>
            </article>
          ))}
        </div>
        <ActionButton action="complete" disabled={!archiveVictory.canComplete} onClick={() => applyAction('아카이브 완성', (current) => completeArchiveAction(current))}>
          아카이브 완성
        </ActionButton>
      </section>
    </section>
  );
}
