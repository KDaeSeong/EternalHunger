'use client';

import { normalizeSatiety } from '../_lib/satietyRuntime';
import {
  PARTICIPANT_PRESET_LIMIT,
  RANDOM_PARTICIPANT_PRESET_ID,
  normalizeParticipantPresetIds,
} from '../_lib/participantPresetRuntime';

export default function SimulationMarketHeaderPanel({
  addLog,
  applyParticipantPresetToCurrent,
  candidateSurvivors,
  day,
  deleteSelectedParticipantPreset,
  devEventPreviewLimit,
  exportBattleLog,
  isAdvancing,
  isGameOver,
  marketCardRenderLimit,
  matchSec,
  participantPresetName,
  participantPresets,
  runEvents,
  runEventsPreviewText,
  runProgressSummary,
  runSeed,
  saveCurrentParticipantPreset,
  saveSelectedParticipantPresetId,
  seedDraft,
  selectedChar,
  selectedCharId,
  selectedParticipantPresetId,
  setParticipantPresetName,
  setRunSeed,
  setSeedDraft,
  setSelectedCharId,
  setShowAllMarketRows,
  setShowDevDebugDetails,
  setShowDevEventLog,
  setShowMarketPanel,
  showAllMarketRows,
  showDevDebugDetails,
  showDevEventLog,
  survivors,
}) {
  return (
    <div className="market-header">
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 }}>
        <h2 style={{ margin: 0 }}>상점/조합/교환</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button className="market-close" onClick={() => setShowMarketPanel(false)} title="패널 닫기">✕</button>
        </div>
      </div>

      <div className="market-row" style={{ marginTop: 10 }}>
        <div className="market-small">사용 캐릭터</div>
        <select value={selectedCharId} onChange={(e) => setSelectedCharId(e.target.value)} style={{ width: '100%' }}>
          <option value="">(선택)</option>
          {survivors.map((c) => (
            <option key={c._id} value={c._id}>{c.name}</option>
          ))}
        </select>
        {selectedChar ? (
          <div className="market-small" style={{ marginTop: 4 }}>
            HP {Math.round(Number(selectedChar.hp || 0))}/{Math.round(Number(selectedChar.maxHp || 100))}
            {' · '}포만감 {normalizeSatiety(selectedChar.satiety)}/100
          </div>
        ) : null}
      </div>

      <div className="market-row" style={{ marginTop: 10, gap: 8, flexWrap: 'wrap' }}>
        <button
          type="button"
          className="market-mini-btn"
          onClick={() => exportBattleLog('md')}
          title="1일차 낮부터 현재까지 누적된 전투 로그를 Markdown 파일로 저장합니다."
        >
          로그 MD
        </button>
        <button
          type="button"
          className="market-mini-btn"
          onClick={() => exportBattleLog('json')}
          title="1일차 낮부터 현재까지 누적된 전투 로그와 runEvents를 JSON 파일로 저장합니다."
        >
          로그 JSON
        </button>
        <button
          type="button"
          className={`market-mini-btn ${showDevEventLog ? 'active' : ''}`}
          onClick={() => setShowDevEventLog((v) => !v)}
          title="큰 JSON 문자열 생성은 필요할 때만 켭니다."
        >
          {showDevEventLog ? '이벤트 JSON 숨김' : '이벤트 JSON'}
        </button>
        <button
          type="button"
          className={`market-mini-btn ${showDevDebugDetails ? 'active' : ''}`}
          onClick={() => setShowDevDebugDetails((v) => !v)}
          title="AI/제작/런 메트릭 상세 카드를 필요할 때만 렌더합니다."
        >
          {showDevDebugDetails ? '상세 디버그 숨김' : '상세 디버그'}
        </button>
        <button
          type="button"
          className={`market-mini-btn ${showAllMarketRows ? 'active' : ''}`}
          onClick={() => setShowAllMarketRows((v) => !v)}
          title={`상점 목록은 기본 ${marketCardRenderLimit}개만 렌더합니다.`}
        >
          {showAllMarketRows ? '목록 빠르게' : `목록 ${marketCardRenderLimit}개`}
        </button>
      </div>

      <div className="market-card" style={{ marginTop: 10, borderStyle: 'dashed' }}>
        <div className="market-title">🎲 시드(재현)</div>
        <div className="market-small">같은 시드면 랜덤 결과가 재현됩니다. (게임 시작 전에만 변경 권장)</div>
        <div className="market-row" style={{ marginTop: 8, gap: 8 }}>
          <input
            value={seedDraft}
            onChange={(e) => setSeedDraft(e.target.value)}
            placeholder="예) 1700000000000"
            style={{ width: '100%' }}
            disabled={isAdvancing || isGameOver}
          />
          <button
            className="market-mini-btn"
            onClick={() => setRunSeed(String(seedDraft || '').trim() || String(Date.now()))}
            disabled={isAdvancing || isGameOver || day !== 0 || matchSec !== 0}
            title={(day !== 0 || matchSec !== 0) ? '게임 시작 후에는 변경을 권장하지 않습니다.' : ''}
          >
            적용
          </button>
          <button
            className="market-mini-btn"
            onClick={() => { const n = String(Date.now()); setSeedDraft(n); setRunSeed(n); }}
            disabled={isAdvancing || isGameOver || day !== 0 || matchSec !== 0}
          >
            새 시드
          </button>
        </div>
        <div className="market-small">현재: <strong>{runSeed}</strong></div>
      </div>

      <div className="market-card" style={{ marginTop: 10, borderStyle: 'dashed' }}>
        <div className="market-title">👥 참가자 프리셋</div>
        <div className="market-small">
          기본은 무작위 24명입니다. 현재 참가자 24명을 최대 {PARTICIPANT_PRESET_LIMIT}개까지 저장해 시작 전에 적용할 수 있습니다.
        </div>
        <div className="market-row" style={{ marginTop: 8, gap: 8 }}>
          <select
            value={selectedParticipantPresetId}
            onChange={(e) => {
              const id = e.target.value;
              saveSelectedParticipantPresetId(id);
              const preset = (Array.isArray(participantPresets) ? participantPresets : [])
                .find((row) => String(row?.id || '') === String(id));
              setParticipantPresetName(preset?.name || '');
            }}
            style={{ width: '100%' }}
            disabled={isAdvancing || isGameOver}
          >
            <option value={RANDOM_PARTICIPANT_PRESET_ID}>무작위 24명</option>
            {(Array.isArray(participantPresets) ? participantPresets : []).map((preset, index) => (
              <option key={preset.id} value={preset.id}>
                {preset.name || `프리셋 ${index + 1}`} ({normalizeParticipantPresetIds(preset.characterIds).length}명)
              </option>
            ))}
          </select>
          <button
            className="market-mini-btn"
            onClick={() => applyParticipantPresetToCurrent(selectedParticipantPresetId)}
            disabled={isAdvancing || isGameOver || day !== 0 || matchSec !== 0}
            title={(day !== 0 || matchSec !== 0) ? '게임 시작 전에만 적용할 수 있습니다.' : ''}
          >
            적용
          </button>
        </div>
        <div className="market-row" style={{ marginTop: 8, gap: 8 }}>
          <input
            value={participantPresetName}
            onChange={(e) => setParticipantPresetName(e.target.value)}
            placeholder="프리셋 이름"
            style={{ width: '100%' }}
            disabled={isAdvancing || isGameOver}
          />
          <button
            className="market-mini-btn"
            onClick={saveCurrentParticipantPreset}
            disabled={isAdvancing || isGameOver || !survivors.length}
            title="현재 참가자 목록을 저장합니다."
          >
            저장
          </button>
          <button
            className="market-mini-btn"
            onClick={deleteSelectedParticipantPreset}
            disabled={isAdvancing || isGameOver || selectedParticipantPresetId === RANDOM_PARTICIPANT_PRESET_ID}
          >
            삭제
          </button>
        </div>
        <div className="market-small" style={{ marginTop: 6 }}>
          저장됨: <strong>{(Array.isArray(participantPresets) ? participantPresets : []).length}</strong>/{PARTICIPANT_PRESET_LIMIT}
          {' · '}후보: <strong>{(Array.isArray(candidateSurvivors) && candidateSurvivors.length) || survivors.length}</strong>명
        </div>
      </div>

      {showDevEventLog ? (
        <div className="market-card" style={{ marginTop: 10, borderStyle: 'dashed' }}>
          <div className="market-title">🧾 이벤트 로그(JSON)</div>
          <div className="market-small">runEvents: <strong>{runEvents.length}</strong>개 (최근 {devEventPreviewLimit}개만 표시)</div>
          <textarea
            readOnly
            value={runEventsPreviewText}
            style={{ width: '100%', minHeight: 160, marginTop: 8 }}
          />
          <div className="market-actions" style={{ marginTop: 8 }}>
            <button
              onClick={() => {
                try {
                  navigator.clipboard?.writeText(JSON.stringify(runEvents, null, 2));
                  addLog('✅ 이벤트 로그 복사 완료', 'system');
                } catch (e) {
                  addLog('⚠️ 이벤트 로그 복사 실패', 'death');
                }
              }}
              disabled={!runEvents.length}
            >
              전체 복사
            </button>
          </div>
        </div>
      ) : (
        <div className="market-card" style={{ marginTop: 10, borderStyle: 'dashed' }}>
          <div className="market-title">🧾 이벤트 로그(JSON)</div>
          <div className="market-small">runEvents: <strong>{runEvents.length}</strong>개 · 필요할 때만 위의 이벤트 JSON 버튼을 켜세요.</div>
        </div>
      )}

      <div className="market-card" style={{ marginTop: 10, borderStyle: 'dashed' }}>
        <div className="market-title">🌍 런 전체 요약</div>
        <div className="market-small">drone: <b>{Number(runProgressSummary?.droneCalls || 0)}</b> / kiosk: <b>{Number(runProgressSummary?.kioskGains || 0)}</b> / craft: <b>{Number(runProgressSummary?.craftCount || 0)}</b></div>
        <div className="market-small" style={{ marginTop: 6 }}>legend chars: <b>{Number(runProgressSummary?.legendCount || 0)}</b> / transcend chars: <b>{Number(runProgressSummary?.transCount || 0)}</b></div>
        <div className="market-small" style={{ marginTop: 6 }}>death: <b>{Number(runProgressSummary?.totalDeaths || 0)}</b> / revive: <b>{Number(runProgressSummary?.totalRevives || 0)}</b> / flee: <b>{Number(runProgressSummary?.totalFlees || 0)}</b></div>
        <div className="market-small" style={{ marginTop: 6 }}>revive ratio: <b>{Number(runProgressSummary?.reviveRate || 0).toFixed(2)}</b> / flee ratio: <b>{Number(runProgressSummary?.fleeRate || 0).toFixed(2)}</b></div>
        <div className="market-small" style={{ marginTop: 6 }}>legend pace: <b>{String(runProgressSummary?.legendPace || 'pending')}</b> / transcend pace: <b>{String(runProgressSummary?.transPace || 'pending')}</b></div>
        <div className="market-small" style={{ marginTop: 6 }}>first legend: {String(runProgressSummary?.firstLegendText || '-')} / first transcend: {String(runProgressSummary?.firstTransText || '-')}</div>
        <div className="market-small" style={{ marginTop: 6 }}>latest legend: {String(runProgressSummary?.latestLegendText || '-')} / latest transcend: {String(runProgressSummary?.latestTransText || '-')}</div>
      </div>
    </div>
  );
}
