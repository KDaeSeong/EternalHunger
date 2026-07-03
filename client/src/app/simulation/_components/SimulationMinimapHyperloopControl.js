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
    <div
      style={{
        marginTop: 8,
        padding: '8px 10px',
        borderRadius: 10,
        background: 'rgba(0,0,0,0.22)',
        border: '1px solid rgba(255,255,255,0.10)',
        fontSize: 12,
      }}
    >
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ opacity: 0.9 }} title="하이퍼루프는 맵 내 장치(패드)에서만 사용 가능">
          🌀 하이퍼루프
        </span>
        <span style={{ opacity: 0.9 }}>
          패드: <b>{hyperloopPadName || hyperloopPadZoneId || '자동'}</b>
        </span>

        {isSelectedCharOnHyperloopPad ? (
          <>
            <select
              value={hyperloopDestId}
              onChange={(e) => setHyperloopDestId(e.target.value)}
              disabled={disabled}
              title="어드민(맵)에서 설정한 하이퍼루프 목적지(로컬 저장)"
              style={{
                padding: '6px 8px',
                fontSize: 12,
                borderRadius: 8,
                border: '1px solid rgba(255,255,255,0.18)',
                background: 'rgba(0,0,0,0.20)',
                color: '#fff',
              }}
            >
              {destinationIds.map((id) => {
                const map = safeArray(maps).find((entry) => String(entry?._id) === String(id)) || null;
                return (
                  <option key={`hl-mm-${id}`} value={id} style={{ color: '#000' }}>
                    {map?.name || id}
                  </option>
                );
              })}
            </select>
            <button
              className="btn-secondary"
              onClick={() => doHyperloopJump(hyperloopDestId, selectedCharId)}
              disabled={disabled || !hyperloopDestId || !selectedCharId}
              style={{ padding: '6px 10px', fontSize: 12 }}
              title="하이퍼루프: 선택 캐릭터만 목적지 맵으로 즉시 이동"
            >
              🌀 이동
            </button>
          </>
        ) : (
          <span style={{ opacity: 0.75 }} title="선택 캐릭터가 패드 구역에 있어야 사용할 수 있습니다.">
            선택 캐릭터가 패드 구역에 있어야 사용 가능
          </span>
        )}
      </div>
    </div>
  );
}
