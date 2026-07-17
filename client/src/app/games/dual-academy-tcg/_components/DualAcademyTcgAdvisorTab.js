import GameActionIcon from '../../_components/GameActionIcon';

function recommendationIcon(item) {
  const text = `${item?.title || ''} ${item?.detail || ''}`;
  if (/공격|킬각|피해/.test(text)) return 'attack';
  if (/소환|몬스터/.test(text)) return 'summon';
  if (/함정|세트/.test(text)) return 'trap';
  if (/마법|효과|발동/.test(text)) return 'spell';
  if (/페이즈|턴/.test(text)) return 'phase';
  return 'advisor';
}

export default function DualAcademyTcgAdvisorTab(props) {
  const {
    advisorTone,
    turnAdvisor,
  } = props;

  return (
    <section className="tcg-layout is-single">
              <aside className="tcg-panel">
                <h2>턴 어드바이저</h2>
                <section className={`tcg-event-callout is-${advisorTone}`}>
                  <span>{turnAdvisor.phase} · {turnAdvisor.riskLabel}</span>
                  <strong>{turnAdvisor.headline}</strong>
                  <p>준비도 {turnAdvisor.readinessPct}% · 보드 {turnAdvisor.boardDelta >= 0 ? '+' : ''}{turnAdvisor.boardDelta} · LP {turnAdvisor.lpDelta >= 0 ? '+' : ''}{turnAdvisor.lpDelta}</p>
                </section>
                <dl className="tcg-small-stats">
                  <div>
                    <dt><GameActionIcon action="summon" label="패 몬스터" />패 몬스터</dt>
                    <dd>{turnAdvisor.hand.monsters}</dd>
                  </div>
                  <div>
                    <dt><GameActionIcon action="spell" label="패 주문" />패 주문</dt>
                    <dd>{turnAdvisor.hand.spells}</dd>
                  </div>
                  <div>
                    <dt><GameActionIcon action="trap" label="패 함정" />패 함정</dt>
                    <dd>{turnAdvisor.hand.traps}</dd>
                  </div>
                  <div>
                    <dt><GameActionIcon action="zone" label="빈 몬스터 존" />빈 몬스터 존</dt>
                    <dd>{turnAdvisor.openMonster}</dd>
                  </div>
                  <div>
                    <dt><GameActionIcon action="zone" label="빈 마법 함정 존" />빈 마함 존</dt>
                    <dd>{turnAdvisor.openSpellTrap}</dd>
                  </div>
                  <div>
                    <dt><GameActionIcon action="attack" label="킬각 피해" />킬각 피해</dt>
                    <dd>{turnAdvisor.lethal.damage}</dd>
                  </div>
                </dl>
              </aside>
              <aside className="tcg-panel">
                <h2>추천 행동</h2>
                <div className="game-save-list">
                  {turnAdvisor.recommendations.map((item, index) => (
                    <article className="game-save-row game-save-row--icon" key={item.id}>
                      <GameActionIcon action={recommendationIcon(item)} label={item.title} />
                      <div>
                        <span>{item.priority === 'high' ? '우선' : item.priority === 'low' ? '후순위' : '검토'} · {index + 1}</span>
                        <strong>{item.title}</strong>
                        <small>{item.detail}</small>
                      </div>
                      <strong>{item.priority}</strong>
                    </article>
                  ))}
                </div>
              </aside>
              <aside className="tcg-panel">
                <h2>전투선</h2>
                <div className="games-activity-list">
                  <div>
                    <strong>{turnAdvisor.lethal.canAttack ? turnAdvisor.lethal.attackerName : '공격 가능 몬스터 없음'}</strong>
                    <span>
                      {turnAdvisor.lethal.lethal
                        ? `직접 공격으로 ${turnAdvisor.lethal.damage} 피해 마무리 가능`
                        : turnAdvisor.lethal.targetName
                          ? `${turnAdvisor.lethal.targetName} 우선 정리`
                          : turnAdvisor.lethal.canAttack
                            ? `${turnAdvisor.lethal.damage} 직접 피해 가능`
                            : 'MAIN 페이즈 전개 또는 다음 페이즈 진행이 필요합니다.'}
                    </span>
                  </div>
                  <div>
                    <strong>현재 권장</strong>
                    <span>{turnAdvisor.recommendedAction}</span>
                  </div>
                </div>
              </aside>
            </section>
  );
}
