'use client';

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

export default function SimulationMinimapHyperloopControl({
  day,
  doHyperloopJump,
  hyperloopDestId,
  hyperloopDestIds,
  hyperloopPadName,
  hyperloopPadZoneId,
  isAdvancing,
  isGameOver,
  isSelectedCharOnHyperloopPad,
  loading,
  maps,
  selectedCharId,
  setHyperloopDestId,
}) {
  const destinationIds = safeArray(hyperloopDestIds);
  const disabled = loading || isAdvancing || isGameOver;

  if (day <= 0 || !destinationIds.length) return null;

  return (
    <div className="minimap-hyperloop-control">
      <div className="minimap-hyperloop-row">
        <span title="하이퍼루프는 출발 패드에서 작동하며 이동 ETA는 3초입니다.">
          하이퍼루프
        </span>
        <span>
          패드: <b>{hyperloopPadName || hyperloopPadZoneId || '자동'}</b>
        </span>
        <small>AI 이동은 하이퍼루프 출발 구역에서 같은 맵의 원하는 구역까지 3초 이동으로 계산됩니다.</small>

        {isSelectedCharOnHyperloopPad ? (
          <>
            <select
              value={hyperloopDestId}
              onChange={(e) => setHyperloopDestId(e.target.value)}
              disabled={disabled}
              title="연결된 목적지를 선택합니다."
            >
              {destinationIds.map((id) => {
                const map = safeArray(maps).find((entry) => String(entry?._id) === String(id)) || null;
                return (
                  <option key={`hl-mm-${id}`} value={id}>
                    {map?.name || id}
                  </option>
                );
              })}
            </select>
            <button
              className="btn-secondary"
              onClick={() => doHyperloopJump(hyperloopDestId, selectedCharId)}
              disabled={disabled || !hyperloopDestId || !selectedCharId}
              title="선택한 캐릭터를 목적지로 이동시킵니다."
            >
              이동
            </button>
          </>
        ) : (
          <span className="minimap-hyperloop-muted" title="선택 캐릭터가 패드 구역에 있어야 수동 이동할 수 있습니다.">
            선택 캐릭터가 패드 구역에 있어야 사용 가능
          </span>
        )}
      </div>
    </div>
  );
}
