import { playerStatusLabel } from '../_lib/gameRoomDetailUtils';

export default function GameRoomPlayersPanel(props) {
  const {
    game,
    room,
  } = props;

  return (
    <>
            <section className="games-panel">
              <div className="games-panel-title">
                <h2>참가자</h2>
                <span>{Number(room.playerCount || 0)}명</span>
              </div>
              <div className="game-room-player-list">
                {room.players.map((player) => (
                  <article className={`game-room-player is-${player.status}`} key={`${player.userId}-${player.joinedAt}`}>
                    <strong>{player.displayName || player.user?.displayName || '사용자'}</strong>
                    <span>{player.role === 'host' ? '방장' : '참가자'}</span>
                    <em>{playerStatusLabel(player.status)}</em>
                  </article>
                ))}
              </div>
            </section>
    </>
  );
}
