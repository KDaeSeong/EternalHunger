'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { apiGet, apiPost, apiPut } from '../../../utils/api';

function zonesEmpty(m) {
  return !Array.isArray(m?.zones) || m.zones.length === 0;
}

function asId(v) {
  return String(v?._id || v?.id || '');
}

function uniq(list) {
  const out = [];
  const s = new Set();
  const arr = Array.isArray(list) ? list : [];
  for (const v of arr) {
    const k = String(v || '').trim();
    if (!k) continue;
    if (s.has(k)) continue;
    s.add(k);
    out.push(k);
  }
  return out;
}

function localKeyMapLinks(mapId) {
  const id = String(mapId || '').trim();
  return id ? `eh_map_links_${id}` : '';
}

function localKeyHyperloops(mapId) {
  const id = String(mapId || '').trim();
  return id ? `eh_map_hyperloops_${id}` : '';
}

function localKeyHyperloopDeviceZone(mapId) {
  const id = String(mapId || '').trim();
  return id ? `eh_hyperloop_zone_${id}` : '';
}

function localKeyMutantSpawnZone(mapId) {
  const id = String(mapId || '').trim();
  return id ? `eh_mutant_spawn_zone_${id}` : '';
}

function readLocalJsonArray(key) {
  const k = String(key || '').trim();
  if (!k) return [];
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(k);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function writeLocalJsonArray(key, list) {
  const k = String(key || '').trim();
  if (!k) return false;
  if (typeof window === 'undefined') return false;
  try {
    const arr = Array.isArray(list) ? list : [];
    window.localStorage.setItem(k, JSON.stringify(arr));
    return true;
  } catch {
    return false;
  }
}

function readLocalString(key) {
  const k = String(key || '').trim();
  if (!k) return '';
  if (typeof window === 'undefined') return '';
  try {
    return String(window.localStorage.getItem(k) || '');
  } catch {
    return '';
  }
}

function writeLocalString(key, value) {
  const k = String(key || '').trim();
  if (!k) return false;
  if (typeof window === 'undefined') return false;
  try {
    window.localStorage.setItem(k, String(value ?? ''));
    return true;
  } catch {
    return false;
  }
}


const CRATE_TYPES = [
  { key: 'food', label: '음식' },
  { key: 'legendary_material', label: '전설 재료' },
  { key: 'transcend_pick', label: '초월 선택' },
];

const SIM_REFRESH_HINT = '시뮬에서 🔄 맵 새로고침을 눌러 적용';
function withSimRefreshHint(prefix) {
  const p = String(prefix || '').trim() || '✅ 저장 완료';
  return `${p} — ${SIM_REFRESH_HINT}`;
}

export default function AdminMapsPage() {
  const [maps, setMaps] = useState([]);
  const [status, setStatus] = useState('loading'); // loading | ok | error
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [lastResult, setLastResult] = useState(null);

  const [saveToast, setSaveToast] = useState(null);
  const saveToastTimerRef = useRef(null);
  const showSaveToast = (text, kind = 'ok', opts = null) => {
    try {
      if (saveToastTimerRef.current) clearTimeout(saveToastTimerRef.current);
    } catch {}
    const href = String(opts?.href || '').trim();
    setSaveToast({
      text: String(text || ''),
      kind: String(kind || 'ok'),
      href: href || null,
    });
    saveToastTimerRef.current = setTimeout(() => {
      setSaveToast(null);
      saveToastTimerRef.current = null;
    }, 1700);
  };

  useEffect(() => {
    return () => {
      try {
        if (saveToastTimerRef.current) clearTimeout(saveToastTimerRef.current);
      } catch {}
    };
  }, []);

  const [kioskMsg, setKioskMsg] = useState('');
  const [kioskResult, setKioskResult] = useState(null);

  const [coreEditMapId, setCoreEditMapId] = useState(null);
  const [coreSelected, setCoreSelected] = useState([]);
  const [coreMsg, setCoreMsg] = useState('');

  const [kioskZoneSel, setKioskZoneSel] = useState('');
  const [kioskZoneNote, setKioskZoneNote] = useState('');

  const [mapLinksSel, setMapLinksSel] = useState([]);
  const [mapLinksNote, setMapLinksNote] = useState('');

  const [hyperloopSel, setHyperloopSel] = useState([]);
  const [hyperloopNote, setHyperloopNote] = useState('');

  const [hyperloopZoneSel, setHyperloopZoneSel] = useState('');
  const [hyperloopZoneNote, setHyperloopZoneNote] = useState('');

  const [mutantZoneSel, setMutantZoneSel] = useState('');
  const [mutantZoneNote, setMutantZoneNote] = useState('');

  // 🔥 모닥불 / 💧 물 채집 구역(서버 저장)
  const [campfireSel, setCampfireSel] = useState([]); // zoneId[]
  const [campfireNote, setCampfireNote] = useState('');
  const [waterSel, setWaterSel] = useState([]); // zoneId[]
  const [waterNote, setWaterNote] = useState('');

  const [zoneCrateRules, setZoneCrateRules] = useState({});
  const [zoneCrateMsg, setZoneCrateMsg] = useState('');

  const loadZoneCrateRules = async (mapId) => {
    const id = String(mapId || '').trim();
    if (!id) return;
    setZoneCrateMsg('불러오는 중…');
    try {
      const res = await apiGet(`/admin/maps/${id}/crate-allow-deny`);
      const p = (res && typeof res === 'object') ? (res.crateAllowDeny ?? res.zoneCrateRules) : null;
      setZoneCrateRules((p && typeof p === 'object' && !Array.isArray(p)) ? p : {});
      setZoneCrateMsg('');
    } catch (e) {
      setZoneCrateRules({});
      setZoneCrateMsg(e?.response?.data?.error || e.message || '불러오기 실패');
    }
  };


  const load = async () => {
    setStatus('loading');
    setMsg('');
    try {
      const res = await apiGet('/admin/maps');
      const list = Array.isArray(res) ? res : (Array.isArray(res?.maps) ? res.maps : []);
      setMaps(list);
      setStatus('ok');
    } catch (e) {
      setStatus('error');
      setMsg(e?.response?.data?.error || e.message || '맵 로드 실패');
    }
  };

  useEffect(() => {
    load();
  }, []);

  const missing = useMemo(() => (Array.isArray(maps) ? maps.filter(zonesEmpty) : []), [maps]);

  const applyDefaultZones = async (mode) => {
    if (busy) return;
    if (mode === 'force') {
      const ok = window.confirm(
        '정말로 덮어쓸까요?\n\nforce 모드는 기존 zones가 있어도 전부 "기본 맵 구역"으로 덮어씁니다.'
      );
      if (!ok) return;
    }

    setBusy(true);
    setMsg('');
    try {
      const res = await apiPost('/admin/maps/apply-default-zones', { mode });
      setLastResult(res);
      setMsg(res?.message || '적용 완료');
      await load();
    } catch (e) {
      setMsg(e?.response?.data?.error || e.message || '적용 실패');
    } finally {
      setBusy(false);
    }
  };

  const generateKiosks = async (mode) => {
    if (busy) return;
    if (mode === 'force') {
      const ok = window.confirm(
        '정말로 재생성할까요?\n\nforce 모드는 대상 맵의 "키오스크 구역" 키오스크를 삭제 후 다시 만듭니다.'
      );
      if (!ok) return;
    }

    setBusy(true);
    setKioskMsg('');
    try {
      const res = await apiPost('/admin/kiosks/generate', { mode });
      setKioskResult(res);
      setKioskMsg(res?.message || '생성 완료');
    } catch (e) {
      setKioskMsg(e?.response?.data?.error || e.message || '생성 실패');
    } finally {
      setBusy(false);
    }
  };

  const openCoreEditor = (m) => {
    const id = asId(m);
    setCoreEditMapId(id || null);
    const cur = Array.isArray(m?.coreSpawnZones) ? m.coreSpawnZones : [];
    setCoreSelected(uniq(cur));
    setCoreMsg('');
    setKioskZoneSel(String(m?.kioskZoneId || '').trim());
    setKioskZoneNote('');
    setZoneCrateRules({});
    setZoneCrateMsg('');
    setMapLinksSel(uniq(readLocalJsonArray(localKeyMapLinks(id))));
    setMapLinksNote('');
    if (id) loadZoneCrateRules(id);
    setHyperloopSel(uniq(readLocalJsonArray(localKeyHyperloops(id))));
    setHyperloopNote('');
    // 🌀 하이퍼루프 장치 구역: 서버 값 우선, 없으면 로컬(디버그/임시값) 사용
    const hz = String(m?.hyperloopDeviceZoneId || '').trim() || readLocalString(localKeyHyperloopDeviceZone(id));
    setHyperloopZoneSel(hz);
    setHyperloopZoneNote('');
    setMutantZoneSel(readLocalString(localKeyMutantSpawnZone(id)));
    setMutantZoneNote('');

    // 🔥/💧 서버 저장 필드
    setCampfireSel(uniq(Array.isArray(m?.campfireZoneIds) ? m.campfireZoneIds : []));
    setCampfireNote('');
    setWaterSel(uniq(Array.isArray(m?.waterSourceZoneIds) ? m.waterSourceZoneIds : []));
    setWaterNote('');
  };

  const closeCoreEditor = () => {
    setCoreEditMapId(null);
    setCoreSelected([]);
    setCoreMsg('');
    setKioskZoneSel('');
    setKioskZoneNote('');
    setZoneCrateRules({});
    setZoneCrateMsg('');
    setMapLinksSel([]);
    setMapLinksNote('');
    setHyperloopSel([]);
    setHyperloopNote('');
    setHyperloopZoneSel('');
    setHyperloopZoneNote('');
    setMutantZoneSel('');
    setMutantZoneNote('');

    setCampfireSel([]);
    setCampfireNote('');
    setWaterSel([]);
    setWaterNote('');
  };

const selectedMap = useMemo(() => {
    if (!coreEditMapId) return null;
    const id = String(coreEditMapId);
    return (Array.isArray(maps) ? maps : []).find((x) => asId(x) === id) || null;
  }, [maps, coreEditMapId]);

  const availableZoneIds = useMemo(() => {
    const zs = Array.isArray(selectedMap?.zones) ? selectedMap.zones : [];
    const ids = zs.map((z) => String(z?.zoneId || '').trim()).filter(Boolean);
    return uniq(ids);
  }, [selectedMap]);

  const availableZones = useMemo(() => {
    const zs = Array.isArray(selectedMap?.zones) ? selectedMap.zones : [];
    const list = zs
      .map((z, idx) => ({
        zoneId: String(z?.zoneId || '').trim(),
        zoneNo: Number.isFinite(Number(z?.zoneNo)) ? Number(z.zoneNo) : (idx + 1),
        name: String(z?.name || '').trim(),
        hasKiosk: Boolean(z?.hasKiosk),
      }))
      .filter((z) => Boolean(z.zoneId));
    list.sort((a, b) => (a.zoneNo || 0) - (b.zoneNo || 0));
    return list;
  }, [selectedMap]);

  const linkCandidates = useMemo(() => {
    const selfId = asId(selectedMap);
    const list = (Array.isArray(maps) ? maps : [])
      .map((m) => ({ id: asId(m), name: String(m?.name || '').trim() || '맵' }))
      .filter((m) => Boolean(m.id) && m.id !== selfId);
    return list;
  }, [maps, selectedMap]);

  const unknownSelected = useMemo(() => {
    const s = new Set(availableZoneIds);
    return (Array.isArray(coreSelected) ? coreSelected : []).filter((id) => !s.has(String(id)));
  }, [availableZoneIds, coreSelected]);

  const toggleZone = (zoneId) => {
    const id = String(zoneId || '').trim();
    if (!id) return;
    setCoreSelected((prev) => {
      const arr = Array.isArray(prev) ? prev : [];
      if (arr.includes(id)) return arr.filter((x) => x !== id);
      return [...arr, id];
    });
  };

  const toggleMapLink = (otherMapId) => {
    const id = String(otherMapId || '').trim();
    if (!id) return;
    setMapLinksSel((prev) => {
      const arr = Array.isArray(prev) ? prev : [];
      if (arr.includes(id)) return arr.filter((x) => x !== id);
      return uniq([...arr, id]);
    });
  };



  const toggleHyperloop = (otherMapId) => {
    const id = String(otherMapId || '').trim();
    if (!id) return;
    setHyperloopSel((prev) => {
      const arr = Array.isArray(prev) ? prev : [];
      if (arr.includes(id)) return arr.filter((x) => x !== id);
      return uniq([...arr, id]);
    });
  };

  const saveMapLinks = () => {
    const mid = asId(selectedMap);
    if (!mid) return;
    const ok = writeLocalJsonArray(localKeyMapLinks(mid), uniq(mapLinksSel));
    const note = ok ? withSimRefreshHint('✅ 저장 완료') : '⚠️ 저장 실패';
    setMapLinksNote(note);
    showSaveToast(note, ok ? 'ok' : 'error');
  };

  const clearMapLinks = () => {
    setMapLinksSel([]);
    setMapLinksNote('');
  };


  const saveHyperloops = () => {
    const mid = asId(selectedMap);
    if (!mid) return;
    const ok = writeLocalJsonArray(localKeyHyperloops(mid), uniq(hyperloopSel));
    const note = ok ? withSimRefreshHint('✅ 저장 완료') : '⚠️ 저장 실패';
    setHyperloopNote(note);
    showSaveToast(note, ok ? 'ok' : 'error');
  };

  const clearHyperloops = () => {
    const mid = asId(selectedMap);
    if (!mid) return;
    const ok = writeLocalJsonArray(localKeyHyperloops(mid), []);
    setHyperloopSel([]);
    setHyperloopNote(ok ? withSimRefreshHint('✅ 전체 해제') : '⚠️ 저장 실패');
  };


  const saveHyperloopDeviceZone = async () => {
    const mapId = asId(selectedMap);
    if (!mapId) return;
    const v = String(hyperloopZoneSel || '').trim();
    setBusy(true);
    setHyperloopZoneNote('저장 중…');
    try {
      await apiPut(`/admin/maps/${mapId}`, { hyperloopDeviceZoneId: v });
      // 서버 저장 + (옵션) 로컬에도 기록(즉시 시뮬 확인용)
      writeLocalString(localKeyHyperloopDeviceZone(mapId), v);
      setMaps((prev) => (Array.isArray(prev) ? prev : []).map((m) => (asId(m) === mapId ? { ...m, hyperloopDeviceZoneId: v } : m)));
      const note = withSimRefreshHint(v ? `✅ 저장됨: ${v}` : '✅ 자동(첫 구역)');
      setHyperloopZoneNote(note);
      showSaveToast(note, 'ok');
    } catch (e) {
      const err = e?.response?.data?.error || e.message || '저장 실패';
      setHyperloopZoneNote(`⚠️ ${err}`);
      showSaveToast(`⚠️ ${err}`, 'error');
    } finally {
      setBusy(false);
    }
  };

  const clearHyperloopDeviceZone = async () => {
    const mapId = asId(selectedMap);
    if (!mapId) return;
    setBusy(true);
    setHyperloopZoneNote('해제 중…');
    try {
      await apiPut(`/admin/maps/${mapId}`, { hyperloopDeviceZoneId: '' });
      writeLocalString(localKeyHyperloopDeviceZone(mapId), '');
      setHyperloopZoneSel('');
      setMaps((prev) => (Array.isArray(prev) ? prev : []).map((m) => (asId(m) === mapId ? { ...m, hyperloopDeviceZoneId: '' } : m)));
      const note = withSimRefreshHint('✅ 해제 완료');
      setHyperloopZoneNote(note);
      showSaveToast(note, 'ok');
    } catch (e) {
      const err = e?.response?.data?.error || e.message || '해제 실패';
      setHyperloopZoneNote(`⚠️ ${err}`);
      showSaveToast(`⚠️ ${err}`, 'error');
    } finally {
      setBusy(false);
    }
  };

  const saveMutantSpawnZone = () => {
    const mid = asId(selectedMap);
    if (!mid) return;
    const ok = writeLocalString(localKeyMutantSpawnZone(mid), String(mutantZoneSel || '').trim());
    setMutantZoneNote(ok ? withSimRefreshHint('✅ 저장 완료') : '⚠️ 저장 실패');
  };

  const clearMutantSpawnZone = () => {
    const mid = asId(selectedMap);
    if (!mid) return;
    const ok = writeLocalString(localKeyMutantSpawnZone(mid), '');
    setMutantZoneSel('');
    setMutantZoneNote(ok ? withSimRefreshHint('✅ 해제 완료') : '⚠️ 저장 실패');
  };

  const toggleZoneArray = (setter, zoneId) => {
    const id = String(zoneId || '').trim();
    if (!id) return;
    setter((prev) => {
      const arr = Array.isArray(prev) ? prev : [];
      if (arr.includes(id)) return arr.filter((x) => x !== id);
      return uniq([...arr, id]);
    });
  };

  const saveCampfireZones = async () => {
    const mapId = asId(selectedMap);
    if (!mapId) return;
    setBusy(true);
    setCampfireNote('저장 중…');
    try {
      const next = uniq(campfireSel);
      await apiPut(`/admin/maps/${mapId}`, { campfireZoneIds: next });
      setMaps((prev) => (Array.isArray(prev) ? prev : []).map((m) => (asId(m) === mapId ? { ...m, campfireZoneIds: next } : m)));
      const note = withSimRefreshHint('✅ 저장 완료');
      setCampfireNote(note);
      showSaveToast(note, 'ok');
    } catch (e) {
      const err = e?.response?.data?.error || e.message || '저장 실패';
      setCampfireNote(`⚠️ ${err}`);
      showSaveToast(`⚠️ ${err}`, 'error');
    } finally {
      setBusy(false);
    }
  };

  const saveWaterZones = async () => {
    const mapId = asId(selectedMap);
    if (!mapId) return;
    setBusy(true);
    setWaterNote('저장 중…');
    try {
      const next = uniq(waterSel);
      await apiPut(`/admin/maps/${mapId}`, { waterSourceZoneIds: next });
      setMaps((prev) => (Array.isArray(prev) ? prev : []).map((m) => (asId(m) === mapId ? { ...m, waterSourceZoneIds: next } : m)));
      const note = withSimRefreshHint('✅ 저장 완료');
      setWaterNote(note);
      showSaveToast(note, 'ok');
    } catch (e) {
      const err = e?.response?.data?.error || e.message || '저장 실패';
      setWaterNote(`⚠️ ${err}`);
      showSaveToast(`⚠️ ${err}`, 'error');
    } finally {
      setBusy(false);
    }
  };

  const selectAllZones = () => setCoreSelected(availableZoneIds);
  const clearAllZones = () => setCoreSelected([]);

  const isCrateAllowed = (zoneId, crateKey) => {
    const zid = String(zoneId || '').trim();
    const deny = (zoneCrateRules && zid && Array.isArray(zoneCrateRules[zid])) ? zoneCrateRules[zid] : [];
    return !deny.includes(crateKey);
  };

  const toggleCrateRule = (zoneId, crateKey) => {
    const zid = String(zoneId || '').trim();
    if (!zid) return;
    setZoneCrateRules((prev) => {
      const cur = (prev && typeof prev === 'object') ? prev : {};
      const deny = (Array.isArray(cur[zid]) ? cur[zid] : []).map(String);
      const next = deny.includes(crateKey) ? deny.filter((x) => x != crateKey) : [...deny, crateKey];
      return { ...cur, [zid]: next };
    });
  };

  const saveZoneCrateRules = async () => {
    if (busy) return;
    if (!coreEditMapId) return;

    setBusy(true);
    setZoneCrateMsg('');
    try {
      const res = await apiPost(`/admin/maps/${coreEditMapId}/crate-allow-deny`, {
        crateAllowDeny: zoneCrateRules || {},
      });
      setZoneCrateRules((res && typeof res === 'object' && res.crateAllowDeny) ? res.crateAllowDeny : (zoneCrateRules || {}));
      const line = withSimRefreshHint('✅ 저장 완료');
      setZoneCrateMsg(line);
      showSaveToast(line, 'ok', { href: '/simulation' });
    } catch (e) {
      setZoneCrateMsg(e?.response?.data?.error || e.message || '저장 실패');
    } finally {
      setBusy(false);
    }
  };

  const resetZoneCrateRules = () => {
    setZoneCrateRules({});
    setZoneCrateMsg('초기화됨(저장 필요)');
  };

  const saveKioskZone = async () => {
    if (busy) return;
    if (!coreEditMapId) return;

    setBusy(true);
    setKioskZoneNote('');
    try {
      const next = String(kioskZoneSel || '').trim();
      await apiPut(`/admin/maps/${coreEditMapId}`, { kioskZoneId: next || null });
      const line = withSimRefreshHint('✅ 저장 완료');
      setKioskZoneNote(next ? `${line} — 키오스크 위치 변경은 force 재생성 필요` : line);
      showSaveToast(line, 'ok', { href: '/simulation' });
      await load();
    } catch (e) {
      setKioskZoneNote(e?.response?.data?.error || e.message || '저장 실패');
    } finally {
      setBusy(false);
    }
  };


  const saveCoreSpawnZones = async () => {
    if (busy) return;
    if (!coreEditMapId) return;
    if (unknownSelected.length) {
      setCoreMsg(`존 ID가 존재하지 않습니다: ${unknownSelected.join(', ')}`);
      return;
    }

    setBusy(true);
    setCoreMsg('');
    try {
      const res = await apiPost(`/admin/maps/${coreEditMapId}/core-spawn-zones`, {
        coreSpawnZones: coreSelected,
      });
      const line = withSimRefreshHint('✅ 저장 완료');
      setCoreMsg(line);
      showSaveToast(line, 'ok', { href: '/simulation' });
      await load();
    } catch (e) {
      setCoreMsg(e?.response?.data?.error || e.message || '저장 실패');
    } finally {
      setBusy(false);
    }
  };

  const regenCoreSpawnZonesFromZones = async () => {
    if (busy) return;
    if (!coreEditMapId) return;

    setBusy(true);
    setCoreMsg('');
    try {
      const res = await apiPost(`/admin/maps/${coreEditMapId}/core-spawn-zones`, { mode: 'fromZones' });
      const next = Array.isArray(res?.coreSpawnZones) ? res.coreSpawnZones : [];
      setCoreSelected(uniq(next));
      const line = withSimRefreshHint(res?.message || '✅ 재생성 완료');
      setCoreMsg(line);
      showSaveToast(line, 'ok', { href: '/simulation' });
      await load();
    } catch (e) {
      setCoreMsg(e?.response?.data?.error || e.message || '재생성 실패');
    } finally {
      setBusy(false);
    }
  };

  const wrap = {
    maxWidth: 1000,
    margin: '0 auto',
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
  };

  const card = {
    border: '1px solid rgba(255,255,255,0.10)',
    borderRadius: 14,
    padding: 14,
    background: 'rgba(255,255,255,0.03)',
  };

  const btn = {
    padding: '10px 12px',
    borderRadius: 10,
    border: '1px solid rgba(255,255,255,0.16)',
    background: '#0b1220',
    color: '#e5e7eb',
    fontWeight: 800,
    cursor: busy ? 'not-allowed' : 'pointer',
    opacity: busy ? 0.6 : 1,
  };

  const select = {
    padding: '10px 12px',
    borderRadius: 10,
    border: '1px solid rgba(255,255,255,0.16)',
    background: '#0b1220',
    color: '#e5e7eb',
    fontWeight: 800,
    minWidth: 320,
  };

  const danger = {
    ...btn,
    border: '1px solid rgba(239,68,68,0.5)',
  };

  const pill = (ok) => ({
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    fontSize: 12,
    padding: '4px 10px',
    borderRadius: 999,
    border: '1px solid rgba(255,255,255,0.10)',
    background: ok ? 'rgba(34,197,94,0.10)' : 'rgba(239,68,68,0.10)',
    color: ok ? '#86efac' : '#fca5a5',
  });

  const checkWrap = {
    marginTop: 10,
    padding: 10,
    borderRadius: 12,
    border: '1px solid rgba(255,255,255,0.10)',
    background: 'rgba(0,0,0,0.12)',
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8,
  };

  const checkItem = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '6px 10px',
    borderRadius: 999,
    border: '1px solid rgba(255,255,255,0.10)',
    background: 'rgba(255,255,255,0.03)',
    cursor: busy ? 'not-allowed' : 'pointer',
    userSelect: 'none',
  };

  const codeBox = {
    marginTop: 6,
    padding: '10px 12px',
    borderRadius: 10,
    border: '1px solid rgba(255,255,255,0.10)',
    background: 'rgba(0,0,0,0.22)',
    fontFamily:
      'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
    fontSize: 12,
    lineHeight: 1.5,
    color: '#e5e7eb',
    overflowX: 'auto',
    whiteSpace: 'pre',
  };

  const getKioskTargetText = (m) => {
    if (!m) return '';
    const desired = String(m?.kioskZoneId || '').trim();
    if (!desired) return '자동(병원→첫 키오스크존)';
    const z = Array.isArray(m?.zones) ? m.zones.find((it) => String(it?.zoneId) === desired) : null;
    if (!z) return `${desired} (존 정보 없음)`;
    const no = z?.zoneNo ? String(z.zoneNo) : '?';
    const nm = String(z?.name || z?.zoneId || desired);
    return `${no}. ${nm} (${desired})`;
  };

  return (
    <div style={wrap}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'end', gap: 12 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: '-0.4px' }}>맵/구역 관리자</div>
          <div style={{ opacity: 0.8, lineHeight: 1.5, marginTop: 4 }}>
            기본 맵 구역(DEFAULT_ZONES) 적용/상태 확인 + 자연 코어(coreSpawnZones) 편집.
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {saveToast ? (
            <div
              style={{
                ...pill(saveToast.kind === 'ok'),
                cursor: saveToast.href ? 'pointer' : 'default',
                textDecoration: saveToast.href ? 'underline' : 'none',
              }}
              role={saveToast.href ? 'button' : undefined}
              tabIndex={saveToast.href ? 0 : undefined}
              onClick={() => {
                if (!saveToast.href) return;
                try {
                  window.open(saveToast.href, '_blank', 'noopener,noreferrer');
                } catch {}
              }}
              onKeyDown={(e) => {
                if (!saveToast.href) return;
                if (e.key !== 'Enter' && e.key !== ' ') return;
                e.preventDefault();
                try {
                  window.open(saveToast.href, '_blank', 'noopener,noreferrer');
                } catch {}
              }}
              title={saveToast.href ? '클릭하면 시뮬 페이지를 새 탭으로 엽니다' : undefined}
            >
              {saveToast.kind === 'ok' ? '✅ ' : '⚠️ '}
              {saveToast.text}
              {saveToast.href ? ' 🔗' : ''}
            </div>
          ) : null}
          <button style={btn} onClick={load} disabled={busy}>
            새로고침
          </button>
        </div>
      </div>

      <div style={card}>
        <div style={{ fontWeight: 900, marginBottom: 10 }}>기본 구역 적용</div>
        <div style={{ opacity: 0.85, lineHeight: 1.6 }}>
          기존 맵에 zones가 비어있으면, 시뮬에서 이동/상자 파밍/키오스크 위치 판정이 깨질 수 있어서
          <b> 기본 맵 구역 세트</b>를 넣어주는 기능.
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 12, flexWrap: 'wrap' }}>
          <button style={btn} onClick={() => applyDefaultZones('missing')} disabled={busy}>
            zones 비어있는 맵에만 적용
          </button>
          <button style={danger} onClick={() => applyDefaultZones('force')} disabled={busy}>
            force 덮어쓰기(주의)
          </button>
        </div>

        {msg ? (
          <div style={{ marginTop: 12, opacity: 0.9 }}>
            <span style={{ fontWeight: 800 }}>메시지:</span> {msg}
          </div>
        ) : null}

        {lastResult ? (
          <div style={{ marginTop: 10, opacity: 0.85, fontSize: 13, lineHeight: 1.6 }}>
            대상 {lastResult?.targetCount ?? '-'}개 중 업데이트 {lastResult?.updatedCount ?? '-'}개 / 스킵{' '}
            {lastResult?.skippedCount ?? '-'}개
          </div>
        ) : null}
      </div>

      <div style={card}>
        <div style={{ fontWeight: 900, marginBottom: 10 }}>키오스크 배치 생성</div>
        <div style={{ opacity: 0.85, lineHeight: 1.6 }}>
          맵 zones 중 <b>키오스크가 있는 구역</b>(병원/성당/경찰서/소방서/양궁장/절/창고/연구소/호텔/학교)을 찾아서
          DB에 <b>실제 키오스크 배치 문서</b>를 생성해줘.
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 12, flexWrap: 'wrap' }}>
          <button style={btn} onClick={() => generateKiosks('missing')} disabled={busy}>
            없는 것만 생성
          </button>
          <button style={danger} onClick={() => generateKiosks('force')} disabled={busy}>
            force 재생성(주의)
          </button>
        </div>

        <div style={{ marginTop: 10, opacity: 0.78, fontSize: 13, lineHeight: 1.55 }}>
          <b>생성 대상 존:</b> 각 맵의 kioskZoneId(없으면 자동) 기준으로 <b>맵당 1개</b>만 생성
          {status === 'ok' && coreEditMapId && selectedMap ? (
            <>
              <br />
              (현재 편집 중인 맵: <b>{String(selectedMap?.name || '맵')}</b> → {getKioskTargetText(selectedMap)})
            </>
          ) : null}
        </div>

        {kioskMsg ? (
          <div style={{ marginTop: 12, opacity: 0.9 }}>
            <span style={{ fontWeight: 800 }}>메시지:</span> {kioskMsg}
          </div>
        ) : null}

        {kioskResult ? (
          <div style={{ marginTop: 10, opacity: 0.85, fontSize: 13, lineHeight: 1.6 }}>
            대상 맵 {kioskResult?.targetMapCount ?? '-'}개 / 키오스크 구역 {kioskResult?.targetKioskZoneCount ?? '-'}개
            <br />
            생성 {kioskResult?.createdCount ?? '-'}개 / 스킵 {kioskResult?.skippedCount ?? '-'}개
            {Number(kioskResult?.deletedCount || 0) > 0 ? (
              <>
                <br />
                (force 삭제 {kioskResult?.deletedCount}개)
              </>
            ) : null}
          </div>
        ) : null}
      </div>

      {status === 'ok' && coreEditMapId ? (
        <div style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'end', gap: 12 }}>
            <div>
              <div style={{ fontWeight: 900 }}>자연 코어 스폰 허용 구역(coreSpawnZones)</div>
              <div style={{ opacity: 0.75, marginTop: 4, lineHeight: 1.5 }}>
                zoneId를 체크로 선택해서 저장해. (오타 방지용)
              </div>
            </div>
            <button style={danger} onClick={closeCoreEditor} disabled={busy}>
              닫기
            </button>
          </div>

          {selectedMap ? (
            <div style={{ marginTop: 10, opacity: 0.85, lineHeight: 1.6 }}>
              <b>{String(selectedMap?.name || '맵')}</b> / id: {asId(selectedMap) || '-'}
              <br />
              사용 가능한 zoneId: {availableZoneIds.join(', ') || '—'}
            </div>
          ) : (
            <div style={{ marginTop: 10, opacity: 0.85 }}>선택된 맵을 찾을 수 없습니다.</div>
          )}

          {selectedMap ? (
            <div style={{ marginTop: 12, borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 12 }}>
              <div style={{ fontWeight: 900 }}>키오스크 배치 존(맵당 1개)</div>
              <div style={{ opacity: 0.75, marginTop: 4, lineHeight: 1.5 }}>
                지정하면 키오스크 생성 시 해당 존에 <b>1개</b>만 배치됩니다. (이미 생성된 키오스크는 <b>force 재생성</b> 필요)
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                <select
                  style={select}
                  value={kioskZoneSel}
                  onChange={(e) => setKioskZoneSel(e.target.value)}
                  disabled={busy || !selectedMap}
                >
                  <option value="">자동(병원→첫 키오스크존)</option>
                  {availableZones.map((z) => (
                    <option key={`kiosk-${z.zoneId}`} value={z.zoneId}>
                      {`${z.zoneNo}. ${z.name || z.zoneId} (${z.zoneId})${z.hasKiosk ? '' : ' · 일반'}`}
                    </option>
                  ))}
                </select>
                <button style={btn} onClick={saveKioskZone} disabled={busy || !selectedMap}>
                  저장
                </button>
                <button style={btn} onClick={() => setKioskZoneSel('')} disabled={busy || !selectedMap}>
                  초기화
                </button>
                {kioskZoneNote ? <div style={{ opacity: 0.85 }}>{kioskZoneNote}</div> : null}
              </div>
            </div>
          ) : null}

          {selectedMap ? (
            <div style={{ marginTop: 12, borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 12 }}>
              <div style={{ fontWeight: 900 }}>맵 연결(동선)</div>
              <div style={{ opacity: 0.75, marginTop: 4, lineHeight: 1.5 }}>
                이 맵에서 이동 가능한 다음 맵을 체크로 지정해. (로컬 저장)
              </div>

              <div style={{ display: 'flex', gap: 10, marginTop: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                <button style={btn} onClick={saveMapLinks} disabled={busy || !selectedMap}>
                  저장
                </button>
                <button style={btn} onClick={clearMapLinks} disabled={busy || !selectedMap}>
                  전체 해제
                </button>
                {mapLinksNote ? <div style={{ opacity: 0.85 }}>{mapLinksNote}</div> : null}
              </div>

              <div style={checkWrap}>
                {linkCandidates.map((m) => (
                  <label key={`link-${m.id}`} style={checkItem}>
                    <input
                      type="checkbox"
                      checked={Array.isArray(mapLinksSel) ? mapLinksSel.includes(m.id) : false}
                      onChange={() => toggleMapLink(m.id)}
                      disabled={busy}
                    />
                    <span style={{ fontWeight: 800 }}>{m.name}</span>
                  </label>
                ))}
                {linkCandidates.length === 0 ? <div style={{ opacity: 0.75 }}>연결할 다른 맵이 없습니다.</div> : null}
              </div>
            </div>
          ) : null}

          {selectedMap ? (
            <div style={{ marginTop: 12, borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 12 }}>
              <div style={{ fontWeight: 900 }}>하이퍼루프(즉시 이동)</div>
              <div style={{ opacity: 0.75, marginTop: 4, lineHeight: 1.5 }}>
                이 맵에 설치된 하이퍼루프로 즉시 이동 가능한 목적지 맵을 체크로 지정해. (로컬 저장)
              </div>

              <div style={{ display: 'flex', gap: 10, marginTop: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                <button style={btn} onClick={saveHyperloops} disabled={busy || !selectedMap}>
                  저장
                </button>
                <button style={btn} onClick={clearHyperloops} disabled={busy || !selectedMap}>
                  전체 해제
                </button>
                {hyperloopNote ? <div style={{ opacity: 0.85 }}>{hyperloopNote}</div> : null}
              </div>

              <div style={checkWrap}>
                {linkCandidates.map((m) => (
                  <label key={`hl-${m.id}`} style={checkItem}>
                    <input
                      type="checkbox"
                      checked={Array.isArray(hyperloopSel) ? hyperloopSel.includes(m.id) : false}
                      onChange={() => toggleHyperloop(m.id)}
                      disabled={busy}
                    />
                    <span style={{ fontWeight: 800 }}>{m.name}</span>
                  </label>
                ))}
                {linkCandidates.length === 0 ? <div style={{ opacity: 0.75 }}>이동할 다른 맵이 없습니다.</div> : null}
              </div>
            </div>
          ) : null}
	          {selectedMap ? (
	            <>
	              <div style={{ marginTop: 12, borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 12 }}>
              <div style={{ fontWeight: 900 }}>하이퍼루프 장치 구역</div>
              <div style={{ opacity: 0.75, marginTop: 4, lineHeight: 1.5 }}>
                이 맵에서 하이퍼루프를 사용할 수 있는 "장치(패드) 구역"을 지정합니다. (로컬 저장)
              </div>

              <div style={{ display: 'flex', gap: 10, marginTop: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                <select
                  style={select}
                  value={hyperloopZoneSel}
                  onChange={(e) => setHyperloopZoneSel(String(e.target.value || ''))}
                  disabled={busy || !selectedMap}
                >
                  <option value="">자동(첫 구역)</option>
                  {availableZones.map((z) => (
                    <option key={`hz-${z.zoneId}`} value={z.zoneId}>
                      {`${z.zoneNo}. ${z.name || z.zoneId} (${z.zoneId})`}
                    </option>
                  ))}
                </select>
                <button style={btn} onClick={saveHyperloopDeviceZone} disabled={busy || !selectedMap}>
                  저장
                </button>
                <button style={btn} onClick={clearHyperloopDeviceZone} disabled={busy || !selectedMap}>
                  해제
                </button>
                {hyperloopZoneNote ? <div style={{ opacity: 0.85 }}>{hyperloopZoneNote}</div> : null}
              </div>
	              </div>

	              <div style={{ marginTop: 12, borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 12 }}>
              <div style={{ fontWeight: 900 }}>변이 야생동물(밤) 스폰 구역</div>
              <div style={{ opacity: 0.75, marginTop: 4, lineHeight: 1.5 }}>
                매 밤 시작 시, 이 맵의 지정 구역에 변이 야생동물이 1마리 스폰됨. (로컬 저장)
              </div>

              <div style={{ display: 'flex', gap: 10, marginTop: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                <select
                  style={select}
                  value={mutantZoneSel}
                  onChange={(e) => setMutantZoneSel(String(e.target.value || ''))}
                  disabled={busy || !selectedMap}
                >
                  <option value="">미사용(랜덤)</option>
                  {availableZones.map((z) => (
                    <option key={`mutant-${z.zoneId}`} value={z.zoneId}>
                      {`${z.zoneNo}. ${z.name || z.zoneId} (${z.zoneId})`}
                    </option>
                  ))}
                </select>
                <button style={btn} onClick={saveMutantSpawnZone} disabled={busy || !selectedMap}>
                  저장
                </button>
                <button style={btn} onClick={clearMutantSpawnZone} disabled={busy || !selectedMap}>
                  해제
                </button>
                {mutantZoneNote ? <div style={{ opacity: 0.85 }}>{mutantZoneNote}</div> : null}
              </div>
	              </div>

                  <div style={{ marginTop: 12, borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 12 }}>
                    <div style={{ fontWeight: 900 }}>🔥 모닥불(요리) 구역</div>
                    <div style={{ opacity: 0.75, marginTop: 4, lineHeight: 1.5 }}>
                      선택한 존에서는 시뮬이 <b>고기 → 스테이크</b>를 자동으로 굽습니다. (서버 저장)
                    </div>

                    <div style={{ display: 'flex', gap: 10, marginTop: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                      <button style={btn} onClick={saveCampfireZones} disabled={busy || !selectedMap}>
                        저장
                      </button>
                      <button style={btn} onClick={() => setCampfireSel([])} disabled={busy || !selectedMap}>
                        전체 해제
                      </button>
                      {campfireNote ? <div style={{ opacity: 0.85 }}>{campfireNote}</div> : null}
                    </div>

                    <div style={checkWrap}>
                      {availableZones.map((z) => (
                        <label key={`camp-${z.zoneId}`} style={checkItem}>
                          <input
                            type="checkbox"
                            checked={Array.isArray(campfireSel) ? campfireSel.includes(z.zoneId) : false}
                            onChange={() => toggleZoneArray(setCampfireSel, z.zoneId)}
                            disabled={busy}
                          />
                          <span style={{ fontWeight: 800 }}>{`${z.zoneNo}. ${z.name || z.zoneId} (${z.zoneId})`}</span>
                        </label>
                      ))}
                      {availableZones.length === 0 ? <div style={{ opacity: 0.75 }}>zones가 없어서 선택할 수 없습니다.</div> : null}
                    </div>
                  </div>

                  <div style={{ marginTop: 12, borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 12 }}>
                    <div style={{ fontWeight: 900 }}>💧 물 채집 구역</div>
                    <div style={{ opacity: 0.75, marginTop: 4, lineHeight: 1.5 }}>
                      선택한 존에서는 시뮬이 <b>물</b>을 자동으로 채집할 수 있습니다. (서버 저장)
                    </div>

                    <div style={{ display: 'flex', gap: 10, marginTop: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                      <button style={btn} onClick={saveWaterZones} disabled={busy || !selectedMap}>
                        저장
                      </button>
                      <button style={btn} onClick={() => setWaterSel([])} disabled={busy || !selectedMap}>
                        전체 해제
                      </button>
                      {waterNote ? <div style={{ opacity: 0.85 }}>{waterNote}</div> : null}
                    </div>

                    <div style={checkWrap}>
                      {availableZones.map((z) => (
                        <label key={`water-${z.zoneId}`} style={checkItem}>
                          <input
                            type="checkbox"
                            checked={Array.isArray(waterSel) ? waterSel.includes(z.zoneId) : false}
                            onChange={() => toggleZoneArray(setWaterSel, z.zoneId)}
                            disabled={busy}
                          />
                          <span style={{ fontWeight: 800 }}>{`${z.zoneNo}. ${z.name || z.zoneId} (${z.zoneId})`}</span>
                        </label>
                      ))}
                      {availableZones.length === 0 ? <div style={{ opacity: 0.75 }}>zones가 없어서 선택할 수 없습니다.</div> : null}
                    </div>
                  </div>
	            </>
          ) : null}




          <div style={{ display: 'flex', gap: 10, marginTop: 12, flexWrap: 'wrap' }}>
            <button style={btn} onClick={saveCoreSpawnZones} disabled={busy || !selectedMap}>
              저장
            </button>
            <button style={btn} onClick={regenCoreSpawnZonesFromZones} disabled={busy || !selectedMap}>
              zones.coreSpawn에서 재생성
            </button>
            <button style={btn} onClick={selectAllZones} disabled={busy || !selectedMap}>
              전체 선택
            </button>
            <button style={btn} onClick={clearAllZones} disabled={busy || !selectedMap}>
              전체 해제
            </button>
          </div>

          <div style={{ marginTop: 12, opacity: 0.85 }}>
            선택: <b>{Array.isArray(coreSelected) ? coreSelected.length : 0}</b>개
            <div style={codeBox}>
              {Array.isArray(coreSelected) && coreSelected.length ? coreSelected.join(', ') : '—'}
            </div>
          </div>

          {selectedMap ? (
            <div style={checkWrap}>
              {availableZoneIds.map((zid) => (
                <label key={zid} style={checkItem}>
                  <input
                    type="checkbox"
                    checked={Array.isArray(coreSelected) ? coreSelected.includes(zid) : false}
                    onChange={() => toggleZone(zid)}
                    disabled={busy}
                  />
                  <span style={{ fontWeight: 800 }}>{zid}</span>
                </label>
              ))}
              {availableZoneIds.length === 0 ? <div style={{ opacity: 0.75 }}>zones가 없어서 선택할 수 없습니다.</div> : null}
            </div>
          ) : null}

          

          <div style={{ marginTop: 14 }}>
            <div style={{ fontWeight: 900 }}>존별 상자 스폰 허용/금지(DB 저장)</div>
            <div style={{ opacity: 0.75, marginTop: 4, lineHeight: 1.5 }}>
              특정 존에서 전설/초월 상자를 금지하는 용도. (관리자 설정은 <b>서버(DB)</b>에 저장됩니다)
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 10, flexWrap: 'wrap' }}>
              <button style={btn} onClick={saveZoneCrateRules} disabled={busy || !selectedMap}>저장(DB)</button>
              <button style={btn} onClick={resetZoneCrateRules} disabled={busy || !selectedMap}>초기화</button>
              {zoneCrateMsg ? <div style={{ opacity: 0.85, marginLeft: 6 }}>{zoneCrateMsg}</div> : null}
            </div>

            {selectedMap ? (
              <div style={{ ...checkWrap, marginTop: 12, flexDirection: 'column', alignItems: 'stretch' }}>
                {availableZoneIds.map((zid) => (
                  <div key={`crateRule-${zid}`} style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                    <div style={{ minWidth: 60, fontWeight: 900 }}>{zid}</div>
                    {CRATE_TYPES.map((ct) => (
                      <label key={`${zid}-${ct.key}`} style={checkItem}>
                        <input
                          type="checkbox"
                          checked={isCrateAllowed(zid, ct.key)}
                          onChange={() => toggleCrateRule(zid, ct.key)}
                          disabled={busy}
                        />
                        <span style={{ fontWeight: 800 }}>{ct.label}</span>
                      </label>
                    ))}
                  </div>
                ))}
              </div>
            ) : null}
          </div>
{unknownSelected.length ? (
            <div style={{ marginTop: 10, color: '#fca5a5', lineHeight: 1.6 }}>
              존재하지 않는 zoneId가 포함되어 있어 저장을 막았어: {unknownSelected.join(', ')}
              <br />
              (표에서 zones를 먼저 적용하거나, zones.coreSpawn에서 재생성 후 다시 시도)
            </div>
          ) : null}

          {coreMsg ? <div style={{ marginTop: 10, opacity: 0.9 }}>{coreMsg}</div> : null}
        </div>
      ) : null}

      <div style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'end', gap: 12 }}>
          <div>
            <div style={{ fontWeight: 900 }}>현재 맵 상태</div>
            <div style={{ opacity: 0.75, marginTop: 4, lineHeight: 1.5 }}>
              {status === 'loading' && '불러오는 중…'}
              {status === 'ok' && `총 ${maps.length}개 / zones 비어있음 ${missing.length}개`}
              {status === 'error' && '로드 실패'}
            </div>
          </div>
          {status === 'ok' ? (
            <div style={pill(missing.length === 0)}>{missing.length === 0 ? '✅ OK' : '⚠️ zones 누락'}</div>
          ) : null}
        </div>

        {status === 'error' ? <div style={{ marginTop: 10, color: '#fca5a5' }}>{msg}</div> : null}

        {status === 'ok' ? (
          <div style={{ marginTop: 12 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', fontSize: 12, opacity: 0.8, padding: '8px 6px' }}>이름</th>
                  <th style={{ textAlign: 'left', fontSize: 12, opacity: 0.8, padding: '8px 6px' }}>zones</th>
                  <th style={{ textAlign: 'left', fontSize: 12, opacity: 0.8, padding: '8px 6px' }}>id</th>
                  <th style={{ textAlign: 'left', fontSize: 12, opacity: 0.8, padding: '8px 6px' }}>coreSpawnZones</th>
                  <th style={{ textAlign: 'left', fontSize: 12, opacity: 0.8, padding: '8px 6px' }}>편집</th>
                </tr>
              </thead>
              <tbody>
                {maps.slice(0, 40).map((m) => (
                  <tr key={asId(m) || Math.random()}>
                    <td style={{ padding: '10px 6px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                      {String(m?.name || '-')}
                    </td>
                    <td style={{ padding: '10px 6px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                      {zonesEmpty(m) ? '—' : String(m?.zones?.length ?? '-')}
                    </td>
                    <td style={{ padding: '10px 6px', borderTop: '1px solid rgba(255,255,255,0.06)', opacity: 0.7 }}>
                      {asId(m) || '-'}
                    </td>
                    <td style={{ padding: '10px 6px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                      {Array.isArray(m?.coreSpawnZones) ? String(m.coreSpawnZones.length) : '0'}
                    </td>
                    <td style={{ padding: '10px 6px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                      <button style={btn} disabled={busy} onClick={() => openCoreEditor(m)}>
                        코어 편집
                      </button>
                    </td>
                  </tr>
                ))}
                {maps.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ padding: '10px 6px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                      맵이 없습니다.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
            {maps.length > 40 ? (
              <div style={{ marginTop: 10, opacity: 0.65, fontSize: 12 }}>
                (표시는 40개까지만. 더 필요하면 검색 UI 붙이면 됨.)
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
