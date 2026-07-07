import {
  KeywordBadges,
  cardAtk,
  cardKind,
  subType,
} from './TcgPlayBoard';

export default function DualAcademyTcgHandTab(props) {
  const {
    canMain,
    playSelected,
    selectedCard,
    selectedHandId,
    setSelectedHandId,
    state,
  } = props;

  return (
    <section className="tcg-hand">
            <div className="tcg-lane-title">
              <h2>내 패</h2>
              <span>{state.players.player.hand.length}장 · 선택: {selectedCard?.name || '없음'}</span>
            </div>
            <div className="tcg-card-controls" style={{ marginBottom: 12 }}>
              <button type="button" onClick={playSelected} disabled={!selectedCard || !canMain}>
                선택 카드 실행
              </button>
              <button type="button" onClick={() => setSelectedHandId('')} disabled={!selectedHandId}>
                선택 해제
              </button>
            </div>
            <div className="tcg-hand-row">
              {state.players.player.hand.map((card) => (
                <article className={`tcg-card is-${card.tone} ${selectedHandId === card.instanceId ? 'is-selected' : ''}`} key={card.instanceId}>
                  <div className="tcg-card-head">
                    <span>{card.cost ?? '-'}</span>
                    <strong>{cardKind(card)} {subType(card)}</strong>
                  </div>
                  <div className="tcg-card-art" />
                  <h3>{card.name}</h3>
                  <KeywordBadges card={card} />
                  <p>{Array.isArray(card.text) ? card.text.join(' ') : card.text}</p>
                  {cardKind(card) === 'Monster' ? <span>ATK {cardAtk(card)} / HP {card.health}</span> : null}
                  <button type="button" onClick={() => setSelectedHandId((current) => current === card.instanceId ? '' : card.instanceId)} disabled={!canMain}>
                    {selectedHandId === card.instanceId ? '선택됨' : '선택'}
                  </button>
                </article>
              ))}
              {!state.players.player.hand.length ? <div className="tcg-empty-zone">패가 없습니다.</div> : null}
            </div>
          </section>
  );
}
