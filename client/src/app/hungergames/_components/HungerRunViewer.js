import Image from 'next/image';
import { HUNGER_LABELS } from '../_lib/hungerGameContract.js';
import { hungerTraitLabel } from '../../../utils/hungerTraits.js';
import { hungerEffectLabel } from '../_lib/hungerGameText.js';
import { getHungerHistoryView } from '../_lib/hungerGameRuntime.js';
import { getHungerRelationshipView } from '../_lib/hungerGameRelationshipView.js';
import styles from '../HungerGames.module.css';

function Portrait({ actor, size = 48 }) {
  return actor?.previewImage ? <Image unoptimized src={actor.previewImage} alt={actor.name} width={size} height={size} /> : <span className={styles.avatar} style={{ width: size, height: size }}>{actor?.name?.slice(0, 1) || '?'}</span>;
}

export default function HungerRunViewer({ run, viewIndex, onViewIndex, followActorId = '', onFollowActor }) {
  if (!run) return <div className={styles.empty}><h2>누가 끝까지 살아남을까요?</h2><p>참가자를 고르고 경기 시작을 누르면 사건을 한 페이즈씩 읽을 수 있습니다.</p><p>샘플의 라이덴 쇼군에는 자연 번개 면역이 지정되어 있습니다. 참가자 탭에서 설정을 바꿀 수 있습니다.</p></div>;
  const history = run.history;
  const view = getHungerHistoryView(run, viewIndex);
  const { index, phase, actors } = view;
  const { effectsByRow, relationships } = getHungerRelationshipView(history, index);
  const alive = actors.filter((actor) => actor.alive);
  const winner = actors.find((actor) => actor.id === view.winnerId);
  const actorById = new Map(actors.map((actor) => [actor.id, actor]));
  const followedActor = actorById.get(followActorId);
  const phaseRows = phase?.rows || [];
  const visibleRows = followedActor
    ? phaseRows.filter((row) => row.participants.some((participant) => participant.id === followedActor.id))
    : phaseRows;
  let lastAppearance = -1;
  if (followedActor) {
    for (let at = index; at >= 0; at -= 1) {
      if (history[at].rows.some((row) => row.participants.some((participant) => participant.id === followedActor.id))) {
        lastAppearance = at;
        break;
      }
    }
  }
  const teamWin = view.endReason === 'last_team';
  return (
    <div className={styles.runLayout}>
      <section>
        {view.finished ? <div className={styles.result} role="status"><h2>{teamWin && view.winnerTeamId ? '팀 ' + view.winnerTeamId + ' 우승' : winner ? winner.name + ' 우승' : '공동 생존 · ' + alive.length + '명'}</h2>
          <p>{teamWin ? '최후의 생존 팀이 결정되었습니다. 우승 생존자: ' + view.winnerIds.map((id) => actorById.get(id)?.name).join(', ') : winner ? '최후의 생존자가 결정되었습니다.' : '최대 진행 수에 도달해 경기가 끝났습니다. 남은 참가자들은 모두 생존합니다.'}</p></div> : null}
        <div className={styles.toolbar}>
          <div><h2>{phase ? (phase.phase === 'opening' ? '시작' : phase.day + '일차 ' + HUNGER_LABELS[phase.phase]) : '출전 대기'}</h2>{phase ? <p>{HUNGER_LABELS[phase.weather]} · {HUNGER_LABELS[phase.location]}</p> : <p>다음 페이즈를 눌러 시작합니다.</p>}</div>
          <div className={styles.actions}>
            <button type="button" disabled={index <= 0} onClick={() => onViewIndex(index - 1)}>이전 기록</button>
            <span>{history.length ? (index + 1) + ' / ' + history.length : '0 / 0'}</span>
            <button type="button" disabled={index >= history.length - 1} onClick={() => onViewIndex(index + 1)}>다음 기록</button>
            <button type="button" disabled={!history.length || viewIndex < 0} onClick={() => onViewIndex(-1)}>최신 기록</button>
          </div>
        </div>
        <div className={styles.observerFilter}>
          <label className={styles.field}>따라볼 참가자
            <select value={followedActor?.id || ''} disabled={typeof onFollowActor !== 'function'}
              onChange={(event) => onFollowActor?.(event.target.value)}>
              <option value="">전체 사건</option>
              {actors.map((actor) => <option value={actor.id} key={actor.id}>{actor.name}{actor.teamId ? ' · 팀 ' + actor.teamId : ''}</option>)}
            </select>
          </label>
          <div className={styles.actions}>
            <span>{followedActor ? `${followedActor.name} 등장 ${visibleRows.length}건 / 전체 ${phaseRows.length}건` : `전체 사건 ${phaseRows.length}건`}</span>
            {followedActor ? <button type="button" disabled={lastAppearance < 0 || lastAppearance === index}
              onClick={() => { if (lastAppearance >= 0 && lastAppearance < index) onViewIndex?.(lastAppearance); }}>최근 등장 기록</button> : null}
          </div>
        </div>
        {followedActor ? <p className={styles.note}>표시 시점의 {followedActor.name}: {followedActor.alive ? followedActor.injured ? hungerEffectLabel(followedActor, 'injure') : '생존' : hungerEffectLabel(followedActor, 'death')} · 이 참가자가 등장하는 사건만 표시합니다. 생존자 수와 경기 결과는 전체 참가자 기준입니다.</p> : null}
        <div className={styles.story} aria-live="polite">
          {visibleRows.map((row) => <article className={row.effects.some((effect) => effect.type === 'death') ? styles.deathEvent : styles.storyEvent} key={row.id}>
            <div className={styles.portraits}>{row.participants.map((participant) => <div key={participant.id}><Portrait actor={actorById.get(participant.id)} /><small>{participant.name}</small></div>)}</div>
            <p>{row.text}</p>
            <div className={styles.badges}><span>{row.title}</span>{row.outcome ? <span>결과: {row.outcome}</span> : null}{row.effects.map((effect, effectIndex) => {
              const relation = effectsByRow.get(row)?.get(effectIndex);
              return <span key={effectIndex}>{relation
                ? `${actorById.get(relation.actorId)?.name || relation.actorId} · ${actorById.get(relation.otherId)?.name || relation.otherId} · ${relation.label}`
                : `${effect.actorName} · ${hungerEffectLabel(actorById.get(effect.actorId), effect.type)}${effect.item ? ' (' + effect.item + ')' : ''}`}</span>;
            })}</div>
          </article>)}
          {!visibleRows.length ? <p className={styles.filteredEmpty}>{!phase ? '아직 진행한 사건이 없습니다. 다음 페이즈를 눌러 시작하세요.' : followedActor ? '이 페이즈에는 선택한 참가자의 등장 사건이 없습니다. 이전 기록을 보거나 전체 사건으로 바꿔 확인하세요.' : '이 페이즈에는 발생한 사건이 없습니다.'}</p> : null}
        </div>
      </section>
      <aside className={styles.panel}>
        <h2>{view.isLatest ? '생존자' : '당시 생존자'} {alive.length} / {actors.length}</h2>
        <p className={styles.note}>표시 중인 페이즈가 끝난 시점의 상태입니다. 과거 기록에서는 이후의 탈락과 경기 결과를 숨깁니다.</p>
        <div className={styles.survivors}>{actors.map((actor) => <details className={actor.alive ? styles.survivor : styles.eliminated} key={actor.id}>
          <summary><Portrait actor={actor} size={36} /><strong>{actor.name}</strong><span>{actor.alive ? actor.injured ? hungerEffectLabel(actor, 'injure') : '생존' : hungerEffectLabel(actor, 'death')}</span></summary>
          <p>처치 {actor.kills} · {actor.teamId ? '팀 ' + actor.teamId : '개인 참가'}</p>
          {actor.districtId ? <p>출신 구역: {actor.districtId}</p> : null}
          <p>{actor.hungerTraits.length ? actor.hungerTraits.map(hungerTraitLabel).join(', ') : '일반 참가자'}</p>
          <p>아이템: {actor.items.join(', ') || '없음'}</p>
          {actor.death ? <p>탈락 원인: {HUNGER_LABELS[actor.death.cause]}</p> : null}
        </details>)}</div>
        {relationships.length ? <details className={styles.group}><summary>동맹·적대 관계</summary>
          <p className={styles.note}>전체 참가자의 표시 시점 관계입니다. 반복된 같은 관계 효과는 유지로 표시하며, 아래 근거는 마지막 실제 변경 기록입니다.</p>
          <div className={styles.relationshipList}>{relationships.map((relation) => {
            const left = actorById.get(relation.leftId), right = actorById.get(relation.rightId);
            const change = relation.lastChange;
            const canVisit = typeof onViewIndex === 'function' && change.historyIndex >= 0 && change.historyIndex < index;
            const eliminated = left?.alive === false || right?.alive === false;
            return <div className={styles.relationshipEntry} key={relation.key}>
              <p><strong>{left?.name || relation.leftId} · {right?.name || relation.rightId}</strong> · {HUNGER_LABELS[relation.kind]}</p>
              {eliminated ? <p className={styles.relationshipStatus}>탈락자 포함 기록 · {[left, right].filter(Boolean).map((actor) => `${actor.name}: ${actor.alive ? '생존' : hungerEffectLabel(actor, 'death')}`).join(' · ')}</p> : null}
              <p className={styles.relationshipEvidence}>마지막 변화: {change.phase === 'opening' ? '시작' : `${change.day}일차 ${HUNGER_LABELS[change.phase]}`} · {change.title}{change.outcome ? ` · ${change.outcome}` : ''} · {change.label}</p>
              <button type="button" disabled={!canVisit} onClick={() => { if (canVisit) onViewIndex(change.historyIndex); }}
                aria-label={`${left?.name || relation.leftId}·${right?.name || relation.rightId} 마지막 관계 변화 기록 보기`}>관계 변화 기록 보기</button>
            </div>;
          })}</div>
        </details> : null}
      </aside>
    </div>
  );
}
