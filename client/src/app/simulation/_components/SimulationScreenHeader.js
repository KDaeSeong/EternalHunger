'use client';

import Link from 'next/link';
import GameActionIcon from '../../games/_components/GameActionIcon';
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
  onToggleSfx,
  onToggleDevTools,
  primaryProceedLabel,
  refreshMapSettingsFromServer,
  setUiModal,
  showMarketPanel,
  sfxEnabled,
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
        <span className="weather-badge sim-icon-label">
          <GameActionIcon action={timeOfDay === 'day' ? 'season' : 'rest'} label={timeOfDay === 'day' ? '낮' : '밤'} />
          {timeOfDay === 'day' ? '낮' : '밤'}
        </span>
        <span className="weather-badge sim-icon-label">
          <GameActionIcon action="clock" label="경기 시간" />
          {formatClock(matchSec)}
        </span>

        {isGameOver ? (
          <button
            className="btn-restart sim-header-proceed"
            type="button"
            data-game-sfx="start"
            onClick={() => window.location.reload()}
          >
            <GameActionIcon action="reset" label={primaryProceedLabel} />
            {primaryProceedLabel}
          </button>
        ) : (
          <button
            className="btn-proceed sim-header-proceed"
            type="button"
            data-game-sfx="off"
            onClick={onProceed}
            disabled={actionDisabled}
            title={startBlocked ? startBlockedText : '현재 페이즈를 진행합니다.'}
          >
            <GameActionIcon action="advance" label={primaryProceedLabel} />
            {primaryProceedLabel}
          </button>
        )}

        <button
          className="btn-secondary sim-mobile-core-btn"
          type="button"
          data-game-sfx="nav"
          onClick={() => setUiModal('map')}
          disabled={loading || isAdvancing}
          style={{ padding: '6px 10px', fontSize: 12 }}
        >
          <GameActionIcon action="map" label="미니맵" />
          미니맵
        </button>
        <button
          className="btn-secondary sim-mobile-core-btn"
          type="button"
          data-game-sfx="nav"
          onClick={() => setUiModal('chars')}
          disabled={loading || isAdvancing}
          style={{ padding: '6px 10px', fontSize: 12 }}
        >
          <GameActionIcon action="players" label="캐릭터" />
          캐릭터
        </button>
        <button
          className="btn-secondary sim-mobile-core-btn"
          type="button"
          data-game-sfx="nav"
          onClick={() => setUiModal('log')}
          disabled={loading || isAdvancing}
          style={{ padding: '6px 10px', fontSize: 12 }}
        >
          <GameActionIcon action="logs" label="로그" />
          로그
        </button>

        <button
          className={`btn-secondary sim-devtools-btn ${showMarketPanel ? 'active' : ''}`}
          type="button"
          data-game-sfx="toggle"
          onClick={onToggleDevTools}
          style={{ padding: '6px 10px', fontSize: 12 }}
          title="상점/조합/교환 및 테스트용 개발자 도구를 엽니다."
        >
          <GameActionIcon action="settings" label={showMarketPanel ? '도구 닫기' : '개발자'} />
          {showMarketPanel ? '도구 닫기' : '개발자'}
        </button>

        <button
          className="btn-secondary sim-refresh-btn"
          type="button"
          data-game-sfx="load"
          onClick={() => { void fireAndReport('refreshMapSettings.manual', () => refreshMapSettingsFromServer('manual')); }}
          disabled={loading || isAdvancing || isGameOver}
          style={{ padding: '6px 10px', fontSize: 12 }}
          title="서버에 저장된 맵 설정(crateAllowDeny 등)을 새로 불러옵니다."
        >
          <GameActionIcon action={isRefreshingMapSettings ? 'wait' : 'refresh'} label="맵 새로고침" />
          {isRefreshingMapSettings ? '새로고침 중...' : '맵 새로고침'}
        </button>

        <button
          className={`btn-secondary sim-sfx-btn ${sfxEnabled ? 'active' : ''}`}
          type="button"
          data-game-sfx="toggle"
          aria-label={sfxEnabled ? '효과음 끄기' : '효과음 켜기'}
          aria-pressed={sfxEnabled}
          onClick={onToggleSfx}
          title={sfxEnabled ? '효과음 끄기' : '효과음 켜기'}
        >
          <GameActionIcon action={sfxEnabled ? 'audio' : 'mute'} label={sfxEnabled ? '효과음 켜짐' : '효과음 꺼짐'} />
        </button>

        {mapRefreshToast ? (
          <span
            className="weather-badge"
            style={{ fontSize: 12, maxWidth: 220, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
            title={mapRefreshToast.text}
          >
            <GameActionIcon action={mapRefreshToast.kind === 'error' ? 'warning' : 'complete'} label={mapRefreshToast.kind === 'error' ? '오류' : '완료'} />
            {mapRefreshToast.text}
          </span>
        ) : null}
      </div>
    </div>
  );
}
