import Link from 'next/link';
import { formatDate, statusLabel } from '../_lib/gameRoomDetailUtils';

export default function GameRoomOverviewPanels(props) {
  const {
    active,
    busy,
    canSaveRoom,
    currentReady,
    game,
    room,
    runAction,
  } = props;

  return (
    <>
            <section className="games-summary" aria-label="게임방 요약">
              <div className="games-metric">
                <span>상태</span>
                <strong>{statusLabel(room.status)}</strong>
              </div>
              <div className="games-metric">
                <span>참가자</span>
                <strong>{Number(room.playerCount || 0)}/{Number(room.maxPlayers || 0)}</strong>
              </div>
              <div className="games-metric">
                <span>리비전</span>
                <strong>{Number(room.revision || 0)}</strong>
              </div>
              <div className="games-metric">
                <span>최근 갱신</span>
                <strong>{formatDate(room.lastActivityAt || room.updatedAt)}</strong>
              </div>
            </section>

            <section className="games-detail-grid">
              <section className="games-panel">
                <div className="games-panel-title">
                  <h2>방 조작</h2>
                  <span>{room.mode || '모드 미지정'}</span>
                </div>
                <div className="game-room-action-grid">
                  {!room.isParticipant && active ? (
                    <button type="button" onClick={() => runAction('join', 'join')} disabled={Boolean(busy)}>
                      {busy === 'join' ? '참가 중...' : '참가'}
                    </button>
                  ) : null}
                  {room.isParticipant && active ? (
                    <button type="button" onClick={() => runAction('ready', 'ready', { status: currentReady ? 'joined' : 'ready' })} disabled={Boolean(busy)}>
                      {currentReady ? '준비 취소' : '준비'}
                    </button>
                  ) : null}
                  {room.isParticipant && active ? (
                    <button type="button" onClick={() => runAction('leave', 'leave')} disabled={Boolean(busy)}>
                      나가기
                    </button>
                  ) : null}
                  {room.isHost && room.status === 'open' ? (
                    <button type="button" onClick={() => runAction('start', 'status', { status: 'playing' })} disabled={Boolean(busy)}>
                      시작
                    </button>
                  ) : null}
                  {room.isHost && room.status === 'playing' ? (
                    <button type="button" onClick={() => runAction('finish', 'status', { status: 'finished' })} disabled={Boolean(busy)}>
                      완료
                    </button>
                  ) : null}
                  {room.recordedAt ? (
                    <Link href={`/games/records?gameSlug=${room.gameSlug}`}>기록 보기</Link>
                  ) : null}
                  {canSaveRoom ? (
                    <Link href={`/games/saves?gameSlug=${room.gameSlug}`}>저장 슬롯</Link>
                  ) : null}
                  {room.isHost && active ? (
                    <button type="button" className="is-danger" onClick={() => runAction('close', 'status', { status: 'closed' })} disabled={Boolean(busy)}>
                      종료
                    </button>
                  ) : null}
                </div>
              </section>

              <section className="games-panel">
                <div className="games-panel-title">
                  <h2>방 정보</h2>
                  <span>{room.visibility === 'private' ? '비공개' : '공개'}</span>
                </div>
                <dl className="game-room-info-list">
                  <div><dt>게임</dt><dd>{game?.title || room.gameSlug}</dd></div>
                  <div><dt>방장</dt><dd>{room.hostName || '방장'}</dd></div>
                  <div><dt>상태 데이터</dt><dd>{Number(room.stateBytes || 0).toLocaleString('ko-KR')} B</dd></div>
                  <div><dt>생성</dt><dd>{formatDate(room.createdAt)}</dd></div>
                  <div><dt>기록</dt><dd>{room.recordedAt ? `${formatDate(room.recordedAt)} · ${Number(room.recordCount || 0)}건` : '아직 없음'}</dd></div>
                </dl>
              </section>
            </section>

    </>
  );
}
