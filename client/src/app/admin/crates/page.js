'use client';

import { useEffect, useMemo, useState } from 'react';
import { RULESETS, getRuleset } from '../../../utils/rulesets';

const OV_KEY = (id) => `eh_ruleset_override_${String(id || 'ER_S10')}`;

function safeParse(raw) {
  try { return JSON.parse(raw); } catch { return null; }
}

function readOverride(id) {
  if (typeof window === 'undefined') return null;
  const raw = window.localStorage.getItem(OV_KEY(id));
  const p = raw ? safeParse(raw) : null;
  return (p && typeof p === 'object' && !Array.isArray(p)) ? p : null;
}

function writeOverride(id, obj) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(OV_KEY(id), JSON.stringify(obj || {}));
}

function deleteOverride(id) {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(OV_KEY(id));
}

function getWeight(ct, key, fallback) {
  const v = ct?.[key];
  const w = (v && typeof v === 'object') ? v.weight : v;
  const n = Number(w);
  return Number.isFinite(n) ? n : fallback;
}

function clamp01(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

// 음식/전설/초월 가중치를 "합=1" 비중으로 정규화합니다.
// - 기존 값이 80/15/5 같은 "가중치"면 자동으로 비중으로 변환
function toShares(foodW, legendW, transW, fallbackShares = [0.8, 0.15, 0.05]) {
  const f = Math.max(0, Number(foodW) || 0);
  const l = Math.max(0, Number(legendW) || 0);
  const t = Math.max(0, Number(transW) || 0);
  const sum = f + l + t;
  if (sum <= 0) return fallbackShares;
  // sum이 1 근처면 이미 비중일 가능성도 있지만, 어차피 합=1로 재정규화
  return [f / sum, l / sum, t / sum];
}

function rebalance3(cur, key, nextShareRaw) {
  const nextShare = clamp01(nextShareRaw);
  const [f0, l0, t0] = Array.isArray(cur) ? cur : [0.8, 0.15, 0.05];
  const rem = Math.max(0, 1 - nextShare);
  if (key === 'food') {
    const other = Math.max(0, l0) + Math.max(0, t0);
    const l = other > 0 ? rem * (l0 / other) : rem / 2;
    const t = rem - l;
    return [nextShare, l, t];
  }
  if (key === 'legend') {
    const other = Math.max(0, f0) + Math.max(0, t0);
    const f = other > 0 ? rem * (f0 / other) : rem / 2;
    const t = rem - f;
    return [f, nextShare, t];
  }
  // trans
  const other = Math.max(0, f0) + Math.max(0, l0);
  const f = other > 0 ? rem * (f0 / other) : rem / 2;
  const l = rem - f;
  return [f, l, nextShare];
}

export default function AdminCratesPage() {
  const [rulesetId, setRulesetId] = useState('ER_S10');
  const [tab, setTab] = useState('food');
  const [message, setMessage] = useState('');

  const base = useMemo(() => RULESETS[rulesetId] || RULESETS.ER_S10, [rulesetId]);
  const current = useMemo(() => getRuleset(rulesetId), [rulesetId, message]);

  // 필드 상자 타입 비중(합=1)
  const [wFood, setWFood] = useState(0.8);
  const [wLegend, setWLegend] = useState(0.15);
  const [wTrans, setWTrans] = useState(0.05);
  const [transOptCount, setTransOptCount] = useState(3);
  const [foodJson, setFoodJson] = useState('');
  const [legendJson, setLegendJson] = useState('');

  const pctFood = Math.round(clamp01(wFood) * 100);
  const pctLegend = Math.round(clamp01(wLegend) * 100);
  const pctTrans = Math.round(clamp01(wTrans) * 100);

  useEffect(() => {
    const ct = (current?.drops || {})?.crateTypes || {};
    const [f, l, t] = toShares(
      getWeight(ct, 'food', 80),
      getWeight(ct, 'legendary_material', 15),
      getWeight(ct, 'transcend_pick', 5),
    );
    setWFood(f);
    setWLegend(l);
    setWTrans(t);
    setTransOptCount(Math.max(2, Math.min(3, Number(ct?.transcend_pick?.optionsCount ?? 3))));
    setFoodJson(JSON.stringify((current?.worldSpawns || {})?.foodCrate || {}, null, 2));
    setLegendJson(JSON.stringify((current?.worldSpawns || {})?.legendaryCrate || {}, null, 2));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rulesetId]);

  const save = () => {
    try {
      const [f, l, t] = toShares(wFood, wLegend, wTrans);
      setWFood(f);
      setWLegend(l);
      setWTrans(t);

      const ov = readOverride(rulesetId) || {};
      ov.drops = ov.drops || {};
      ov.drops.crateTypes = ov.drops.crateTypes || {};
      ov.worldSpawns = ov.worldSpawns || {};

      // 합=1 비중으로 저장(기존 80/15/5 형태도 자동 변환됨)
      ov.drops.crateTypes.food = { ...(ov.drops.crateTypes.food || {}), weight: Math.round(f * 1000) / 1000 };
      ov.drops.crateTypes.legendary_material = { ...(ov.drops.crateTypes.legendary_material || {}), weight: Math.round(l * 1000) / 1000 };
      ov.drops.crateTypes.transcend_pick = { ...(ov.drops.crateTypes.transcend_pick || {}), weight: Math.round(t * 1000) / 1000, optionsCount: Math.max(2, Math.min(3, Number(transOptCount || 3))) };

      const fj = safeParse(foodJson);
      const lj = safeParse(legendJson);
      if (fj && typeof fj === 'object' && !Array.isArray(fj)) ov.worldSpawns.foodCrate = fj;
      if (lj && typeof lj === 'object' && !Array.isArray(lj)) ov.worldSpawns.legendaryCrate = lj;

      writeOverride(rulesetId, ov);
      setMessage('저장 완료 (시뮬 화면 새로고침 권장)');
    } catch (e) {
      setMessage(`저장 실패: ${e?.message || e}`);
    }
  };

  const resetTabToBase = () => {
    const bct = (base?.drops || {})?.crateTypes || {};
    const [f, l, t] = toShares(
      getWeight(bct, 'food', 80),
      getWeight(bct, 'legendary_material', 15),
      getWeight(bct, 'transcend_pick', 5),
    );
    setWFood(f);
    setWLegend(l);
    setWTrans(t);
    setTransOptCount(Math.max(2, Math.min(3, Number(bct?.transcend_pick?.optionsCount ?? 3))));
    setFoodJson(JSON.stringify((base?.worldSpawns || {})?.foodCrate || {}, null, 2));
    setLegendJson(JSON.stringify((base?.worldSpawns || {})?.legendaryCrate || {}, null, 2));
    setMessage('기본값으로 불러옴 (저장 버튼을 눌러야 적용)');
  };

  const clearOverrideAll = () => {
    deleteOverride(rulesetId);
    setMessage('오버라이드 삭제 완료 (시뮬 화면 새로고침 권장)');
  };

  const tabBtn = (key, label) => (
    <button
      key={key}
      className={`admin-btn ${tab === key ? 'primary' : ''}`}
      onClick={() => setTab(key)}
      style={{ minWidth: 110 }}
    >
      {label}
    </button>
  );

  return (
    <div>
      <div className="admin-topbar">
        <h1>상자(드랍)</h1>
        <div className="admin-btn-row">
          <button className="admin-btn" onClick={resetTabToBase}>기본값 불러오기</button>
          <button className="admin-btn" onClick={clearOverrideAll}>오버라이드 삭제</button>
          <button className="admin-btn primary" onClick={save}>저장</button>
        </div>
      </div>

      {message ? (
        <div className="admin-card" style={{ marginBottom: 14 }}>
          <div className="admin-muted">메시지</div>
          <div style={{ marginTop: 6 }}>{message}</div>
        </div>
      ) : null}

      <div className="admin-card" style={{ marginBottom: 14 }}>
        <div className="admin-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
          <div className="admin-field">
            <label>rulesetId</label>
            <select value={rulesetId} onChange={(e) => setRulesetId(e.target.value)}>
              {Object.keys(RULESETS).map((k) => (
                <option key={k} value={k}>{k} · {RULESETS[k]?.label || ''}</option>
              ))}
            </select>
            <div className="admin-muted" style={{ marginTop: 6 }}>
              이 화면의 저장은 서버가 아니라 <b>로컬스토리지</b> 오버라이드입니다.
            </div>
          </div>

          <div className="admin-field">
            <label>필드 상자 타입 비중(합=1)</label>
            <div className="admin-grid" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
              <div>
                <div className="admin-muted">음식: <b>{pctFood}%</b></div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={1}
                  value={pctFood}
                  onChange={(e) => {
                    const [f, l, t] = rebalance3([wFood, wLegend, wTrans], 'food', Number(e.target.value) / 100);
                    setWFood(f); setWLegend(l); setWTrans(t);
                  }}
                />
              </div>
              <div>
                <div className="admin-muted">전설 재료: <b>{pctLegend}%</b></div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={1}
                  value={pctLegend}
                  onChange={(e) => {
                    const [f, l, t] = rebalance3([wFood, wLegend, wTrans], 'legend', Number(e.target.value) / 100);
                    setWFood(f); setWLegend(l); setWTrans(t);
                  }}
                />
              </div>
              <div>
                <div className="admin-muted">초월 선택: <b>{pctTrans}%</b></div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={1}
                  value={pctTrans}
                  onChange={(e) => {
                    const [f, l, t] = rebalance3([wFood, wLegend, wTrans], 'trans', Number(e.target.value) / 100);
                    setWFood(f); setWLegend(l); setWTrans(t);
                  }}
                />
              </div>
            </div>
            <div className="admin-muted" style={{ marginTop: 6 }}>
              초월 선택 후보 수(optionsCount):
              <input style={{ width: 90, marginLeft: 8 }} type="number" value={transOptCount} onChange={(e) => setTransOptCount(e.target.value)} />
            </div>
            <div className="admin-muted" style={{ marginTop: 6 }}>
              현재 합: <b>{pctFood + pctLegend + pctTrans}%</b> · 저장 시 자동으로 합=1로 정규화됩니다.
            </div>
          </div>
        </div>

        <div className="admin-btn-row" style={{ marginTop: 12 }}>
          {tabBtn('food', '음식 상자')}
          {tabBtn('legend', '전설 상자')}
          {tabBtn('trans', '초월 선택')}
        </div>
      </div>

      {tab === 'food' ? (
        <div className="admin-card">
          <h3 style={{ marginTop: 0 }}>월드 스폰: 음식 상자(worldSpawns.foodCrate)</h3>
          <textarea style={{ width: '100%', minHeight: 260 }} value={foodJson} onChange={(e) => setFoodJson(e.target.value)} />
        </div>
      ) : null}

      {tab === 'legend' ? (
        <div className="admin-card">
          <h3 style={{ marginTop: 0 }}>월드 스폰: 전설 상자(worldSpawns.legendaryCrate)</h3>
          <textarea style={{ width: '100%', minHeight: 260 }} value={legendJson} onChange={(e) => setLegendJson(e.target.value)} />
        </div>
      ) : null}

      {tab === 'trans' ? (
        <div className="admin-card">
          <h3 style={{ marginTop: 0 }}>초월 장비 선택 상자</h3>
          <div className="admin-muted">
            필드 상자 타입 가중치/후보 수(optionsCount)만 저장합니다.
          </div>
        </div>
      ) : null}
    </div>
  );
}
