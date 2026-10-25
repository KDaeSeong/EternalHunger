import Image from 'next/image';
import { GameControlButton } from '../../_components/GamePlayPrimitives';
import {
  PARTY_SORT_OPTIONS,
  actionLabel,
  chanceText,
} from '../_lib/primitiveArchivePageRuntime';
import { PrimitiveArchiveIconRow, PrimitiveArchivePanelTitle } from './PrimitiveArchiveVisuals';

function positiveValue(value) {
  if (typeof value !== 'number' && typeof value !== 'string') return null;
  if (typeof value === 'string' && !value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function deathDetails(member) {
  const record = member?.deathRecord;
  if (!record || typeof record !== 'object' || Array.isArray(record)) return '사망 원인 기록 없음';

  const parts = [];
  const day = positiveValue(record.day);
  const source = record.source === 'night' ? '밤 정산' : record.source === 'action' ? '행동 중' : '';
  const reason = typeof record.reason === 'string' ? record.reason.trim() : '';
  const damage = positiveValue(record.damage);
  const components = [
    ['추위', positiveValue(record.coldDamage)],
    ['허기', positiveValue(record.hungerDamage)],
    ['저체온', positiveValue(record.hypothermiaDamage)],
  ].filter(([, value]) => value !== null).map(([label, value]) => `${label} ${value}`);

  if (day !== null) parts.push(`${day}일차`);
  if (source) parts.push(source);
  if (reason) parts.push(reason);
  if (damage !== null) {
    parts.push(`HP 피해 ${damage}${components.length ? ` (${components.join(' · ')})` : ''}`);
  } else if (components.length) {
    parts.push(`피해 ${components.join(' · ')}`);
  }
  if (!reason) parts.push('사망 원인 기록 없음');
  return parts.join(' · ') || '사망 원인 기록 없음';
}

export default function PrimitiveArchivePartyWorkspace(props) {
  const {
    actorId,
    archiveVictory,
    busy,
    completeRun,
    hydrated,
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
        <PrimitiveArchivePanelTitle
          action="formation"
          title="파티"
          meta={`${state.party.length}/${partyCap} · ${state.weather.name} · ${state.weather.temp}°C`}
        />
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
              <GameControlButton action="recruit" disabled={!hydrated || Boolean(busy) || state.ended || !selectedRecruit?.canRecruit || state.party.length >= partyCap} onClick={recruitMember}>합류</GameControlButton>
            </div>
          ) : null}
        </div>
        <p className="games-muted">현재 조건의 밤 생존 예측입니다. 식사·휴식·연료·장비를 바꾸면 예측도 달라집니다. 모닥불과 대피소는 공유하지만 옷은 착용자만 보호합니다.</p>
        <div className="primitive-party-list">
          {partyView.map(({ member, chances, basisAction, basisChance, badges, nightSurvival }) => (
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
                {Number(member.hp || 0) > 0 ? (
                  <small>추천 {actionLabel(basisAction)} {chanceText(basisChance)} · 채집 {chanceText(chances.gather)} · 사냥 {chanceText(chances.hunt)} · 제작 {chanceText(chances.craft)}</small>
                ) : (
                  <small>{deathDetails(member)}</small>
                )}
                {Number(member.hp || 0) > 0 && nightSurvival ? (
                  <small className="primitive-night-forecast">
                    <span>밤 예상 HP {nightSurvival.currentHp} → {nightSurvival.hp} · 개인 보온 {nightSurvival.insulation}</span>
                    <span>추위 {nightSurvival.coldDamage} / 허기 {nightSurvival.hungerDamage} / 저체온 {nightSurvival.hypothermiaDamage} 피해</span>
                  </small>
                ) : null}
              </span>
            </button>
          ))}
        </div>
      </section>

      <section className="games-panel primitive-objective-panel">
        <PrimitiveArchivePanelTitle
          action={archiveVictory.canComplete ? 'primitive-victory' : 'target'}
          title="아카이브 목표"
          meta={archiveVictory.label}
        />
        <div className="game-save-list">
          {archiveVictory.rows.map((row) => (
            <PrimitiveArchiveIconRow
              action={row.done ? 'primitive-victory' : 'target'}
              className={row.done ? 'is-good' : 'is-watch'}
              label={row.label}
              key={row.id}
            >
              <div>
                <span>{row.done ? '완료' : '진행 중'}</span>
                <strong>{row.label}</strong>
              </div>
              <strong>{row.current}/{row.target}</strong>
            </PrimitiveArchiveIconRow>
          ))}
        </div>
        <GameControlButton
          action="complete"
          onClick={completeRun}
          disabled={!hydrated || Boolean(busy) || !archiveVictory.canComplete || typeof completeRun !== 'function'}
          title="기초 완주로 현재 런을 종료하고 보상을 정산합니다."
        >
          기초 아카이브 완성·런 종료
        </GameControlButton>
      </section>
    </section>
  );
}
