import Image from 'next/image';
import { HUNGER_LABELS } from '../_lib/hungerGameContract.js';
import { hungerTraitLabel } from '../../../utils/hungerTraits.js';
import { hungerEffectLabel } from '../_lib/hungerGameText.js';
import { getHungerHistoryView } from '../_lib/hungerGameRuntime.js';
import styles from '../HungerGames.module.css';

function Portrait({ actor, size = 48 }) {
  return actor?.previewImage ? <Image unoptimized src={actor.previewImage} alt={actor.name} width={size} height={size} /> : <span className={styles.avatar} style={{ width: size, height: size }}>{actor?.name?.slice(0, 1) || '?'}</span>;
}

export default function HungerRunViewer({ run, viewIndex, onViewIndex }) {
  if (!run) return <div className={styles.empty}><h2>누가 끝까지 살아남을까요?</h2><p>참가자를 고르고 경기 시작을 누르면 사건을 한 페이즈씩 읽을 수 있습니다.</p><p>샘플의 라이덴 쇼군에는 자연 번개 면역이 지정되어 있습니다. 참가자 탭에서 설정을 바꿀 수 있습니다.</p></div>;
  const history = run.history;
  const view = getHungerHistoryView(run, viewIndex);
  const { index, phase, actors, relationships } = view;
  const alive = actors.filter((actor) => actor.alive);
  const winner = actors.find((actor) => actor.id === view.winnerId);
  const actorById = new Map(actors.map((actor) => [actor.id, actor]));
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
        <div className={styles.story} aria-live="polite">
          {phase?.rows.map((row) => <article className={row.effects.some((effect) => effect.type === 'death') ? styles.deathEvent : styles.storyEvent} key={row.id}>
            <div className={styles.portraits}>{row.participants.map((participant) => <div key={participant.id}><Portrait actor={actorById.get(participant.id)} /><small>{participant.name}</small></div>)}</div>
            <p>{row.text}</p>
            <div className={styles.badges}><span>{row.title}</span>{row.effects.map((effect, effectIndex) => <span key={effectIndex}>{effect.actorName} · {hungerEffectLabel(actorById.get(effect.actorId), effect.type)}{effect.item ? ' (' + effect.item + ')' : ''}</span>)}</div>
          </article>)}
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
        {relationships.length ? <details className={styles.group}><summary>동맹·적대 관계</summary>{relationships.map((relation, relationIndex) => <p key={relationIndex}>{actorById.get(relation.leftId)?.name} · {HUNGER_LABELS[relation.kind]} · {actorById.get(relation.rightId)?.name}</p>)}</details> : null}
      </aside>
    </div>
  );
}
