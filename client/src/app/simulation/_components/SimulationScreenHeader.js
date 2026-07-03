'use client';

import Link from 'next/link';
import { formatClock } from '../_lib/simulationFormattingRuntime';

export default function SimulationScreenHeader({
  actionDisabled,
  day,
  fireAndReport,
  isAdvancing,
  isGameOver,
  isRefreshingMapSettings,
  loading,
  mapRefreshToast,
  matchSec,
  onProceed,
  onToggleDevTools,
  primaryProceedLabel,
  refreshMapSettingsFromServer,
  setUiModal,
  showMarketPanel,
  startBlocked,
  startBlockedText,
  timeOfDay,
}) {
  return (
    <div className="screen-header">
      <Link href="/" className="simulation-mobile-logo" aria-label="ETERNAL HUNGER 메인">
        <span className="logo-top">ETERNAL</span>
        <span className="logo-main">HUNGER</span>
      </Link>
      <h1>{day === 0 ? 'GAME READY' : `DAY ${day} - ${timeOfDay === 'day' ? 'DAY' : 'NIGHT'}`}</h1>
      <div className="screen-header-right">
        <span className="weather-badge">{timeOfDay === 'day' ? '☀ 낮' : '🌙 밤'}</span>
        <span className="weather-badge">⏱ {formatClock(matchSec)}</span>

        {isGameOver ? (
          <button
            className="btn-restart sim-header-proceed"
            type="button"
            onClick={() => window.location.reload()}
          >
            {primaryProceedLabel}
          </button>
        ) : (
          <button
            className="btn-proceed sim-header-proceed"
            type="button"
            onClick={onProceed}
            disabled={actionDisabled}
            title={startBlocked ? startBlockedText : '현재 페이즈를 진행합니다.'}
          >
            {primaryProceedLabel}
          </button>
        )}

        <button
          className="btn-secondary sim-mobile-core-btn"
          onClick={() => setUiModal('map')}
          disabled={loading || isAdvancing}
          style={{ padding: '6px 10px', fontSize: 12 }}
        >
          🗺️ 미니맵
        </button>
        <button
          className="btn-secondary sim-mobile-core-btn"
          onClick={() => setUiModal('chars')}
          disabled={loading || isAdvancing}
          style={{ padding: '6px 10px', fontSize: 12 }}
        >
          👥 캐릭터
        </button>
        <button
          className="btn-secondary sim-mobile-core-btn"
          onClick={() => setUiModal('log')}
          disabled={loading || isAdvancing}
          style={{ padding: '6px 10px', fontSize: 12 }}
        >
          🧾 로그
        </button>

        <button
          className={`btn-secondary sim-devtools-btn ${showMarketPanel ? 'active' : ''}`}
          onClick={onToggleDevTools}
          style={{ padding: '6px 10px', fontSize: 12 }}
          title="상점/조합/교환 및 테스트용 개발자 도구를 엽니다."
        >
          {showMarketPanel ? '🛠 도구 닫기' : '🛠 개발자'}
        </button>

        <button
          className="btn-secondary sim-refresh-btn"
          onClick={() => { void fireAndReport('refreshMapSettings.manual', () => refreshMapSettingsFromServer('manual')); }}
          disabled={loading || isAdvancing || isGameOver}
          style={{ padding: '6px 10px', fontSize: 12 }}
          title="서버에 저장된 맵 설정(crateAllowDeny 등)을 새로 불러옵니다."
        >
          {isRefreshingMapSettings ? '⏳ 새로고침 중...' : '🔄 맵 새로고침'}
        </button>

        {mapRefreshToast ? (
          <span
            className="weather-badge"
            style={{ fontSize: 12, maxWidth: 220, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
            title={mapRefreshToast.text}
          >
            {mapRefreshToast.kind === 'error' ? '⚠️' : '✅'} {mapRefreshToast.text}
          </span>
        ) : null}
      </div>
    </div>
  );
}
