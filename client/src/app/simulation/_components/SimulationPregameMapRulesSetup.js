'use client';

import { useState } from 'react';
import GameActionIcon from '../../games/_components/GameActionIcon';
import {
  clearLocalRulesetOverride,
  readLocalRulesetOverride,
  saveLocalRulesetOverride,
  saveLocalRulesetSelection,
} from '../_lib/localSimulationMapRuntime';
import { DEFAULT_RULESET_ID, RULESETS, normalizeRulesetId } from '../../../utils/rulesets';

function localMapLabel(map) {
  return `${String(map?.name || '이름 없는 지도')} · ${Array.isArray(map?.zones) ? map.zones.length : 0}구역`;
}

function newMapDraft(map) {
  const copy = map && typeof map === 'object' ? JSON.parse(JSON.stringify(map)) : { name: '새 로컬 지도', zones: [] };
  delete copy._id;
  delete copy.id;
  delete copy.updatedAt;
  delete copy.localUser;
  delete copy.guestDefault;
  copy.name = `${String(copy.name || '루미아 섬')} · 새 지도`;
  return copy;
}

function prettyJson(value) {
  try { return JSON.stringify(value, null, 2); } catch { return '{}'; }
}

export default function SimulationPregameMapRulesSetup({
  activeMap,
  activeMapId,
  day,
  disabled,
  guestMode,
  maps,
  onMapChange,
  onMapDelete,
  onMapSave,
  onRulesChanged,
  matchSec,
  settings,
}) {
  const rulesetId = normalizeRulesetId(settings?.rulesetId || DEFAULT_RULESET_ID);
  const [mapJson, setMapJson] = useState(() => prettyJson(activeMap || {}));
  const [rulesJson, setRulesJson] = useState(() => prettyJson(readLocalRulesetOverride(rulesetId) || {}));
  const [mapMessage, setMapMessage] = useState('');
  const [rulesMessage, setRulesMessage] = useState('');

  if (!guestMode || Number(day || 0) !== 0 || Number(matchSec || 0) !== 0) return null;

  function changeMap(event) {
    const result = onMapChange?.(event.target.value);
    if (result === false) setMapMessage('로컬 지도를 선택하지 못했습니다.');
    else setMapMessage('로컬 지도 선택을 저장했습니다.');
  }

  function saveMap() {
    let parsed;
    try { parsed = JSON.parse(mapJson); } catch { setMapMessage('지도 JSON 문법이 올바르지 않습니다.'); return; }
    const result = onMapSave?.(parsed);
    if (!result?.ok) { setMapMessage(result?.errors?.[0] || '지도를 저장하지 못했습니다.'); return; }
    setMapJson(prettyJson(result.map));
    setMapMessage(`저장 완료: ${result.map.name}`);
  }

  function deleteMap() {
    if (!String(activeMapId || '').startsWith('local-map-')) {
      setMapMessage('내장 지도는 삭제할 수 없습니다.');
      return;
    }
    const result = onMapDelete?.(activeMapId);
    setMapMessage(result?.ok ? '로컬 지도를 삭제했습니다.' : (result?.errors?.[0] || '지도를 삭제하지 못했습니다.'));
  }

  function changeRuleset(event) {
    const result = saveLocalRulesetSelection(event.target.value);
    if (!result.ok) { setRulesMessage(result.error); return; }
    onRulesChanged?.(event.target.value);
    setRulesMessage(`규칙 선택 저장: ${event.target.value}`);
  }

  function saveRules() {
    let parsed;
    try { parsed = JSON.parse(rulesJson); } catch { setRulesMessage('규칙 JSON 문법이 올바르지 않습니다.'); return; }
    const result = saveLocalRulesetOverride(rulesetId, parsed);
    if (!result.ok) { setRulesMessage(result.error); return; }
    onRulesChanged?.(rulesetId, result.patch);
    setRulesJson(prettyJson(result.patch));
    setRulesMessage('로컬 규칙을 저장했습니다. 다음 경기 시작 조건에 반영됩니다.');
  }

  function resetRules() {
    const result = clearLocalRulesetOverride(rulesetId);
    if (!result.ok) { setRulesMessage(result.error); return; }
    setRulesJson('{}');
    onRulesChanged?.();
    setRulesMessage('이 규칙셋의 로컬 변경을 초기화했습니다.');
  }

  return (
    <section className="simulation-pregame-map-rules" aria-label="게스트 로컬 지도와 규칙">
      <details open>
        <summary><GameActionIcon action="map" label="로컬 지도와 규칙" /> 로컬 지도·규칙 준비</summary>
        <p className="simulation-pregame-map-rules__hint">로그인 없이 이 브라우저에만 저장됩니다. 경기 시작 뒤에는 조건이 잠깁니다.</p>

        <div className="simulation-pregame-map-rules__row">
          <label>
            <span>지도 선택</span>
            <select value={activeMapId || ''} onChange={changeMap} disabled={disabled}>
              {(Array.isArray(maps) ? maps : []).map((map) => (
                <option key={String(map?._id)} value={String(map?._id)}>
                  {map?.guestDefault ? `내장 지도 · ${map.name}` : localMapLabel(map)}
                </option>
              ))}
            </select>
          </label>
          <button type="button" className="btn-secondary" onClick={() => setMapJson(prettyJson(newMapDraft(activeMap)))} disabled={disabled}>
            새 지도 초안
          </button>
          <button type="button" className="btn-secondary" onClick={deleteMap} disabled={disabled || !String(activeMapId || '').startsWith('local-map-')}>
            삭제
          </button>
        </div>

        <label className="simulation-pregame-map-rules__editor">
          <span>지도 JSON <small>(구역·polygon/center·zoneConnections)</small></span>
          <textarea value={mapJson} onChange={(event) => setMapJson(event.target.value)} disabled={disabled} rows={9} spellCheck="false" />
        </label>
        <div className="simulation-pregame-map-rules__actions">
          <button type="button" className="btn-primary" onClick={saveMap} disabled={disabled}>로컬 지도 저장</button>
          {mapMessage ? <span role="status">{mapMessage}</span> : null}
        </div>

        <div className="simulation-pregame-map-rules__row">
          <label>
            <span>규칙셋 선택</span>
            <select value={rulesetId} onChange={changeRuleset} disabled={disabled}>
              {Object.values(RULESETS).map((ruleset) => <option key={ruleset.id} value={ruleset.id}>{ruleset.label}</option>)}
            </select>
          </label>
          <button type="button" className="btn-secondary" onClick={resetRules} disabled={disabled}>규칙 초기화</button>
        </div>
        <label className="simulation-pregame-map-rules__editor">
          <span>규칙 JSON patch <small>(저장한 값만 기본 규칙에 병합)</small></span>
          <textarea value={rulesJson} onChange={(event) => setRulesJson(event.target.value)} disabled={disabled} rows={7} spellCheck="false" />
        </label>
        <div className="simulation-pregame-map-rules__actions">
          <button type="button" className="btn-primary" onClick={saveRules} disabled={disabled}>로컬 규칙 저장</button>
          {rulesMessage ? <span role="status">{rulesMessage}</span> : null}
        </div>
      </details>
    </section>
  );
}
