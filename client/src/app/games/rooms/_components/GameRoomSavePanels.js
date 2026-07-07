import Link from 'next/link';
import { cleanSlotKey, saveSlotLabel } from '../_lib/gameRoomDetailUtils';

export default function GameRoomSavePanels(props) {
  const {
    busy,
    canRestoreRoom,
    canSaveRoom,
    game,
    loadRestoreSlots,
    restoreLoadedFor,
    restoreRoomSnapshot,
    restoreSlotId,
    restoreSlots,
    room,
    saveForm,
    saveRoomSnapshot,
    setRestoreSlotId,
    setSaveForm,
  } = props;

  return (
    <>
            {canSaveRoom ? (
              <form className="games-panel game-room-record-panel" onSubmit={saveRoomSnapshot}>
                <div className="games-panel-title">
                  <h2>진행 저장</h2>
                  <span>리비전 {Number(room.revision || 0)}</span>
                </div>
                <div className="game-room-record-grid is-save">
                  <label>
                    <span>슬롯 키</span>
                    <input
                      value={saveForm.slotKey}
                      maxLength={80}
                      disabled={Boolean(busy)}
                      onChange={(event) => setSaveForm({ ...saveForm, slotKey: cleanSlotKey(event.target.value, '') })}
                    />
                  </label>
                  <label>
                    <span>저장 이름</span>
                    <input
                      value={saveForm.saveName}
                      maxLength={80}
                      disabled={Boolean(busy)}
                      onChange={(event) => setSaveForm({ ...saveForm, saveName: event.target.value })}
                    />
                  </label>
                </div>
                <label className="game-room-record-note">
                  <span>메모</span>
                  <textarea
                    rows={3}
                    value={saveForm.note}
                    disabled={Boolean(busy)}
                    onChange={(event) => setSaveForm({ ...saveForm, note: event.target.value })}
                  />
                </label>
                <div className="game-room-record-help">
                  현재 방의 상태 데이터, 설정, 요약, 리비전을 계정 저장 슬롯에 저장합니다.
                </div>
                <div className="account-actions">
                  <button type="submit" disabled={Boolean(busy)}>{busy === 'save-slot' ? '저장 중...' : '슬롯 저장'}</button>
                  <Link href={`/games/saves?gameSlug=${room.gameSlug}`}>저장 슬롯 보기</Link>
                </div>
              </form>
            ) : null}

            {canRestoreRoom ? (
              <section className="games-panel game-room-record-panel">
                <div className="games-panel-title">
                  <h2>진행 복원</h2>
                  <span>{restoreLoadedFor === room._id ? `${restoreSlots.length}개 슬롯` : '슬롯 미조회'}</span>
                </div>
                <div className="game-room-record-grid is-save">
                  <label>
                    <span>저장 슬롯</span>
                    <select
                      value={restoreSlotId}
                      disabled={Boolean(busy) || !restoreSlots.length}
                      onChange={(event) => setRestoreSlotId(event.target.value)}
                    >
                      {restoreSlots.length ? restoreSlots.map((slot) => (
                        <option value={slot.id} key={slot.id}>{saveSlotLabel(slot)}</option>
                      )) : <option value="">저장 슬롯 없음</option>}
                    </select>
                  </label>
                  <div className="game-room-restore-actions">
                    <button type="button" onClick={loadRestoreSlots} disabled={Boolean(busy)}>
                      {busy === 'load-saves' ? '조회 중...' : '슬롯 조회'}
                    </button>
                    <button type="button" onClick={restoreRoomSnapshot} disabled={Boolean(busy) || !restoreSlotId}>
                      {busy === 'restore-slot' ? '복원 중...' : '방에 복원'}
                    </button>
                  </div>
                </div>
                <div className="game-room-record-help">
                  선택한 저장 슬롯의 상태 데이터와 설정을 현재 방에 적용합니다. 복원 시 현재 방 리비전이 변경됩니다.
                </div>
              </section>
            ) : null}

    </>
  );
}
