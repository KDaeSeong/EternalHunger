import { RECORD_RESULT_OPTIONS, playerDisplayName, userIdOf } from '../_lib/gameRoomDetailUtils';

export default function GameRoomRecordPanel(props) {
  const {
    busy,
    canRecordResult,
    game,
    recordForm,
    recordRoomResult,
    room,
    roomPlayers,
    setRecordForm,
  } = props;

  return (
    <>
            {canRecordResult ? (
              <form className="games-panel game-room-record-panel" onSubmit={recordRoomResult}>
                <div className="games-panel-title">
                  <h2>결과 확정</h2>
                  <span>전적 {roomPlayers.length}건 생성</span>
                </div>
                <div className="game-room-record-grid">
                  <label>
                    <span>기록 제목</span>
                    <input
                      value={recordForm.title}
                      maxLength={120}
                      disabled={Boolean(busy)}
                      onChange={(event) => setRecordForm({ ...recordForm, title: event.target.value })}
                    />
                  </label>
                  <label>
                    <span>승자</span>
                    <select
                      value={recordForm.winnerUserId}
                      disabled={Boolean(busy)}
                      onChange={(event) => setRecordForm({ ...recordForm, winnerUserId: event.target.value })}
                    >
                      <option value="">승자 없음</option>
                      {roomPlayers.map((player) => (
                        <option value={userIdOf(player.userId)} key={`winner-${player.userId}`}>{playerDisplayName(player)}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span>공통 결과</span>
                    <select
                      value={recordForm.result}
                      disabled={Boolean(busy) || Boolean(recordForm.winnerUserId)}
                      onChange={(event) => setRecordForm({ ...recordForm, result: event.target.value })}
                    >
                      {RECORD_RESULT_OPTIONS.map(([value, label]) => (
                        <option value={value} key={value}>{label}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span>점수</span>
                    <input
                      type="number"
                      value={recordForm.score}
                      disabled={Boolean(busy)}
                      onChange={(event) => setRecordForm({ ...recordForm, score: event.target.value })}
                    />
                  </label>
                  <label>
                    <span>플레이 시간(초)</span>
                    <input
                      type="number"
                      min="0"
                      value={recordForm.playTimeSec}
                      disabled={Boolean(busy)}
                      onChange={(event) => setRecordForm({ ...recordForm, playTimeSec: event.target.value })}
                    />
                  </label>
                </div>
                <label className="game-room-record-note">
                  <span>메모</span>
                  <textarea
                    rows={3}
                    value={recordForm.note}
                    disabled={Boolean(busy)}
                    onChange={(event) => setRecordForm({ ...recordForm, note: event.target.value })}
                  />
                </label>
                <div className="game-room-record-help">
                  {recordForm.winnerUserId ? '선택한 승자는 승리, 나머지 참가자는 패배로 저장됩니다.' : '승자 없음이면 공통 결과가 모든 참가자 기록에 적용됩니다.'}
                </div>
                <div className="account-actions">
                  <button type="submit" disabled={Boolean(busy)}>{busy === 'record' ? '기록 중...' : '전적 생성'}</button>
                </div>
              </form>
            ) : null}

    </>
  );
}
