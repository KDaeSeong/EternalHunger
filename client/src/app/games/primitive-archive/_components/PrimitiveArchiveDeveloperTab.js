import { GameControlButton } from '../../_components/GamePlayPrimitives';
import { PrimitiveArchivePanelTitle } from './PrimitiveArchiveVisuals';

function presetBonuses(rows, value) {
  return Object.fromEntries((rows || []).map((row) => [row.id, value]));
}

export default function PrimitiveArchiveDeveloperTab({
  developerTools,
  resetDeveloperTools,
  updateDeveloperTools,
}) {
  const rows = developerTools?.rows || [];
  const enabled = Boolean(developerTools?.enabled);

  const applyPreset = (value) => {
    updateDeveloperTools({ enabled: true, actionBonuses: presetBonuses(rows, value) });
  };

  return (
    <div className="primitive-workspace-panel" role="tabpanel">
      <section className="games-panel primitive-developer-panel">
        <PrimitiveArchivePanelTitle
          action="developer"
          title="문명 아카이브 개발자 도구"
          meta={enabled ? '보정 적용 중' : '일반 규칙'}
        />
        <div className="primitive-developer-toggles">
          <label>
            <input
              type="checkbox"
              checked={enabled}
              onChange={(event) => updateDeveloperTools({ enabled: event.target.checked })}
            />
            <span>개발자 보정 사용</span>
          </label>
          <label>
            <input
              type="checkbox"
              checked={Boolean(developerTools?.guaranteedSuccess)}
              disabled={!enabled}
              onChange={(event) => updateDeveloperTools({ guaranteedSuccess: event.target.checked })}
            />
            <span>모든 행동 강제 성공</span>
          </label>
          <label>
            <input
              type="checkbox"
              checked={Boolean(developerTools?.unlockSpecializedActions)}
              disabled={!enabled}
              onChange={(event) => updateDeveloperTools({ unlockSpecializedActions: event.target.checked })}
            />
            <span>특화 생업 해금 미리보기</span>
          </label>
        </div>

        <div className="primitive-developer-sliders" aria-label="행동 성공률 보정">
          {rows.map((row) => (
            <label key={row.id}>
              <span>{row.label}</span>
              <input
                type="range"
                min="-50"
                max="50"
                step="5"
                value={row.valuePct}
                disabled={!enabled}
                onChange={(event) => updateDeveloperTools({
                  actionBonuses: { [row.id]: Number(event.target.value) / 100 },
                })}
              />
              <strong>{row.valuePct >= 0 ? '+' : ''}{row.valuePct}%p</strong>
            </label>
          ))}
        </div>

        <div className="primitive-developer-presets">
          <GameControlButton action="debuff" cue="off" onClick={() => applyPreset(-0.2)}>불리한 환경</GameControlButton>
          <GameControlButton action="reset" cue="off" onClick={() => applyPreset(0)}>보정 0</GameControlButton>
          <GameControlButton action="buff" cue="off" onClick={() => applyPreset(0.2)}>풍요 환경</GameControlButton>
          <GameControlButton action="reset" cue="off" onClick={resetDeveloperTools}>전체 초기화</GameControlButton>
        </div>

        <p className="primitive-developer-note">
          저장 데이터에 함께 보존되는 테스트 설정입니다. 개발자 보정을 끄면 수치는 유지되지만 실제 판정에는 적용되지 않습니다.
        </p>
      </section>
    </div>
  );
}
