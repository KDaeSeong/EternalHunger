'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import Link from 'next/link';
import { apiGet, apiPost, apiPut } from '../../utils/api';
import { calculateBattle } from '../../utils/battleLogic';
import { generateDynamicEvent } from '../../utils/eventLogic';
import { updateEffects } from '../../utils/statusLogic';
import { applyItemEffect } from '../../utils/itemLogic';
import { getRuleset, getPhaseDurationSec, getFogLocalTimeSec } from '../../utils/rulesets';
import '../../styles/ERSimulation.css';

function safeTags(item) {
  return Array.isArray(item?.tags) ? item.tags : [];
}

function itemDisplayName(item) {
  return item?.name || item?.text || item?.itemId?.name || '알 수 없는 아이템';
}

function itemIcon(item) {
  const t = String(item?.type || '').toLowerCase();
  const tags = safeTags(item);
  if (tags.includes('heal') || tags.includes('medical')) return '🚑';
  if (t === 'food' || tags.includes('food') || tags.includes('healthy')) return '🍎';
  if (t === 'weapon' || item?.type === '무기') return '⚔️';
  if (item?.type === '방어구') return '🛡️';
  return '📦';
}

function compactIO(list) {
  const map = new Map();
  (Array.isArray(list) ? list : []).forEach((x) => {
    if (!x?.itemId) return;
    const id = String(x.itemId);
    const qty = Math.max(1, Number(x.qty || 1));
    map.set(id, (map.get(id) || 0) + qty);
  });
  return [...map.entries()].map(([itemId, qty]) => ({ itemId, qty }));
}

export default function SimulationPage() {
  const [survivors, setSurvivors] = useState([]);
  const [dead, setDead] = useState([]);
  const [events, setEvents] = useState([]);
  const [logs, setLogs] = useState([]);

  const [day, setDay] = useState(0);
  const [phase, setPhase] = useState('night');
  // ⏱ 경기 경과 시간(초) - 하이브리드(페이즈 버튼 + 내부 틱)에서 기준이 되는 절대 시간
  const [matchSec, setMatchSec] = useState(0);
  const [isGameOver, setIsGameOver] = useState(false);
  const [loading, setLoading] = useState(true);

  // 킬 카운트 및 결과창 관리
  const [killCounts, setKillCounts] = useState({});
  const [showResultModal, setShowResultModal] = useState(false);
  const [winner, setWinner] = useState(null);

  // 서버 설정값
  const [settings, setSettings] = useState({
    statWeights: { str: 1, agi: 1, int: 1, men: 1, luk: 1, dex: 1, sht: 1, end: 1 },
    suddenDeathTurn: 5,
    forbiddenZoneStartDay: 3,
    forbiddenZoneDamageBase: 1.5,
    rulesetId: 'ER_S10',
  });

  // 🗺️ 맵 선택(로드맵 2번)
  const [maps, setMaps] = useState([]);
  const [activeMapId, setActiveMapId] = useState('');

const activeMapName = useMemo(() => {
  const list = Array.isArray(maps) ? maps : [];
  return list.find((m) => String(m?._id) === String(activeMapId))?.name || '맵 없음';
}, [maps, activeMapId]);

  // ✅ 상점/조합/교환 패널
  const [marketTab, setMarketTab] = useState('craft'); // craft | kiosk | drone | trade
  const [selectedCharId, setSelectedCharId] = useState('');
  const [credits, setCredits] = useState(0);
  const [publicItems, setPublicItems] = useState([]);
  const [kiosks, setKiosks] = useState([]);
  const [droneOffers, setDroneOffers] = useState([]);
  const [tradeOffers, setTradeOffers] = useState([]);
  const [myTradeOffers, setMyTradeOffers] = useState([]);
  const [qtyMap, setQtyMap] = useState({});
  const [marketMessage, setMarketMessage] = useState('');
  const [tradeDraft, setTradeDraft] = useState({
    give: [{ itemId: '', qty: 1 }],
    want: [{ itemId: '', qty: 1 }],
    wantCredits: 0,
    note: '',
  });

  const logBoxRef = useRef(null);
  const hasInitialized = useRef(false);
  const forbiddenCacheRef = useRef({});

  // ▶️ 오토 플레이(페이즈 자동 진행)
  // - "틱 기반"은 페이즈 내부를 초 단위로 계산하는 엔진이고,
  // - 오토 플레이는 "다음 페이즈" 버튼을 일정 간격으로 자동 눌러주는 UX입니다.
  const [autoPlay, setAutoPlay] = useState(false);
  const [autoSpeed, setAutoSpeed] = useState(1); // 0.5 / 1 / 2 / 4
  const [isAdvancing, setIsAdvancing] = useState(false);
  const isAdvancingRef = useRef(false);
  const proceedPhaseGuardedRef = useRef(null);

  // ✅ 관전자 모드 기본: 상점/조합/교환 UI는 숨김(테스트용 토글)
  const [showMarketPanel, setShowMarketPanel] = useState(false);

  const addLog = (text, type = 'normal') => {
    setLogs((prev) => [...prev, { text, type, id: Date.now() + Math.random() }]);
  };

  useEffect(() => {
  const el = logBoxRef.current;
  if (!el) return;
  // ✅ 로그가 쌓여도 "페이지"가 아니라 로그 창 내부만 스크롤되게 고정
  el.scrollTop = el.scrollHeight;
}, [logs]);

// 선택 캐릭터 기본값 유지
  useEffect(() => {
    if (!survivors?.length) {
      setSelectedCharId('');
      return;
    }
    if (!selectedCharId) {
      setSelectedCharId(survivors[0]._id);
      return;
    }
    if (!survivors.some((s) => String(s._id) === String(selectedCharId))) {
      setSelectedCharId(survivors[0]._id);
    }
  }, [survivors, selectedCharId]);

  const selectedChar = useMemo(() => survivors.find((s) => String(s._id) === String(selectedCharId)) || null, [survivors, selectedCharId]);

  const activeMap = useMemo(
    () => (Array.isArray(maps) ? maps : []).find((m) => String(m._id) === String(activeMapId)) || null,
    [maps, activeMapId]
  );

  const zones = useMemo(() => {
    const z = Array.isArray(activeMap?.zones) ? activeMap.zones : [];
    return z.length ? z : [{ zoneId: '__default__', name: '중앙', isForbidden: false }];
  }, [activeMap]);

  const zoneNameById = useMemo(() => {
    const out = {};
    zones.forEach((z) => {
      if (z?.zoneId) out[String(z.zoneId)] = z.name || String(z.zoneId);
    });
    return out;
  }, [zones]);

  const getZoneName = (zoneId) => {
    const key = String(zoneId || '');
    return zoneNameById[key] || key || '미상';
  };

  // ⏱ mm:ss 포맷
  const formatClock = (totalSec) => {
    const s = Math.max(0, Number(totalSec || 0));
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
  };

  const zoneGraph = useMemo(() => {
    const graph = {};
    const zoneIds = zones.map((z) => String(z.zoneId));
    zoneIds.forEach((id) => (graph[id] = new Set()));
    const conns = Array.isArray(activeMap?.zoneConnections) ? activeMap.zoneConnections : [];
    conns.forEach((c) => {
      const a = String(c?.fromZoneId || '');
      const b = String(c?.toZoneId || '');
      if (!a || !b) return;
      if (!graph[a]) graph[a] = new Set();
      if (!graph[b]) graph[b] = new Set();
      graph[a].add(b);
      if (c?.bidirectional !== false) graph[b].add(a);
    });
    // 동선이 하나도 없으면, "모든 구역 연결" 기본으로 동작(초기 셋업 편의)
    const hasEdges = Object.values(graph).some((s) => (s?.size || 0) > 0);
    if (!hasEdges && zoneIds.length > 1) {
      zoneIds.forEach((a) => {
        zoneIds.forEach((b) => {
          if (a !== b) graph[a].add(b);
        });
      });
    }
    // Set -> Array 변환
    const out = {};
    Object.keys(graph).forEach((k) => (out[k] = [...graph[k]]));
    return out;
  }, [activeMap, zones]);

  const canonicalizeCharName = (name) =>
    (name || '')
      .replace(/\s*[•·・]\s*/g, '·')
      .replace(/\s*-\s*/g, '·')
      .replace(/\s+/g, ' ')
      .trim();

  const seedRng = (seedStr) => {
    // 문자열 -> 32bit seed
    let h = 2166136261;
    for (let i = 0; i < seedStr.length; i++) {
      h ^= seedStr.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    // mulberry32
    let a = h >>> 0;
    return () => {
      a |= 0;
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };

  const getForbiddenZoneIdsForDay = (mapObj, dayNum) => {
    const key = `${String(mapObj?._id || 'no-map')}:${dayNum}`;
    if (forbiddenCacheRef.current[key]) return forbiddenCacheRef.current[key];

    const z = Array.isArray(mapObj?.zones) && mapObj.zones.length ? mapObj.zones : zones;
    const zoneIds = z.map((x) => String(x.zoneId));
    const base = new Set(z.filter((x) => x?.isForbidden).map((x) => String(x.zoneId)));

    const cfg = mapObj?.forbiddenZoneConfig || {};
    const enabled = !!cfg.enabled;
    const startDay = Number(cfg.startPhase ?? settings.forbiddenZoneStartDay ?? 3);

    if (enabled && dayNum >= startDay && zoneIds.length > 0) {
      const extraCount = Math.min(Math.max(1, dayNum - startDay + 1), Math.max(0, zoneIds.length - 1));
      const candidates = zoneIds.filter((id) => !base.has(id));
      const rng = seedRng(`${String(mapObj?._id || '')}:${dayNum}`);
      // Fisher-Yates shuffle 후보
      for (let i = candidates.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
      }
      candidates.slice(0, extraCount).forEach((id) => base.add(id));
    }

    const arr = [...base];
    forbiddenCacheRef.current[key] = arr;
    return arr;
  };

  // ✅ 페이즈 단위 금지구역(하이브리드 규칙)
  // - LEGACY: 기존 일차 기반 로직 사용
  // - ER_S10: 같은 일차라도 morning/night에 따라 금지구역 수가 더 빠르게 증가하도록 단순 모델링
  const getForbiddenZoneIdsForPhase = (mapObj, dayNum, phaseKey, ruleset) => {
    if (!ruleset || ruleset.id !== 'ER_S10') return getForbiddenZoneIdsForDay(mapObj, dayNum);

    const key = `${String(mapObj?._id || 'no-map')}:${dayNum}:${phaseKey}:ER_S10`;
    if (forbiddenCacheRef.current[key]) return forbiddenCacheRef.current[key];

    const z = Array.isArray(mapObj?.zones) && mapObj.zones.length ? mapObj.zones : zones;
    const zoneIds = z.map((x) => String(x.zoneId));
    const base = new Set(z.filter((x) => x?.isForbidden).map((x) => String(x.zoneId)));

    const cfg = mapObj?.forbiddenZoneConfig || {};
    const enabled = !!cfg.enabled;
    const startDay = Number(cfg.startPhase ?? settings.forbiddenZoneStartDay ?? 3);

    if (enabled && dayNum >= startDay && zoneIds.length > 0) {
      // 같은 day라도 night이면 한 단계 더 진행된 것으로 간주
      const phaseIndex = phaseKey === 'night' ? 1 : 0;
      const phaseNumber = (dayNum - startDay) * 2 + phaseIndex + 1;
      const extraCount = Math.min(Math.max(1, phaseNumber), Math.max(0, zoneIds.length - 1));

      const candidates = zoneIds.filter((id) => !base.has(id));
      const rng = seedRng(`${String(mapObj?._id || '')}:${dayNum}:${phaseKey}`);
      for (let i = candidates.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
      }
      candidates.slice(0, extraCount).forEach((id) => base.add(id));
    }

    const arr = [...base];
    forbiddenCacheRef.current[key] = arr;
    return arr;
  };

  const itemNameById = useMemo(() => {
    const m = {};
    (Array.isArray(publicItems) ? publicItems : []).forEach((it) => {
      if (it?._id) m[String(it._id)] = it.name;
    });
    return m;
  }, [publicItems]);

  const craftables = useMemo(() => {
    return (Array.isArray(publicItems) ? publicItems : [])
      .filter((it) => Array.isArray(it?.recipe?.ingredients) && it.recipe.ingredients.length > 0)
      .sort((a, b) => (Number(a.tier || 1) - Number(b.tier || 1)) || String(a.name).localeCompare(String(b.name)));
  }, [publicItems]);

  const inventoryOptions = useMemo(() => {
    const inv = Array.isArray(selectedChar?.inventory) ? selectedChar.inventory : [];
    const map = new Map();
    inv.forEach((x) => {
      const id = x?.itemId ? String(x.itemId) : '';
      const name = itemDisplayName(x);
      if (!id) return;
      const prev = map.get(id);
      const qty = Math.max(1, Number(x.qty || 1));
      if (!prev) map.set(id, { itemId: id, name, qty });
      else map.set(id, { ...prev, qty: prev.qty + qty });
    });
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [selectedChar]);

  const getQty = (key, fallback = 1) => {
    const v = Number(qtyMap[key]);
    if (!Number.isFinite(v) || v <= 0) return fallback;
    return Math.floor(v);
  };

  const setQty = (key, v) => {
    setQtyMap((prev) => ({ ...prev, [key]: v }));
  };

  const patchInventoryOnly = (serverCharacter) => {
    if (!serverCharacter?._id) return;
    setSurvivors((prev) => prev.map((s) => (String(s._id) === String(serverCharacter._id) ? { ...s, inventory: serverCharacter.inventory ?? s.inventory } : s)));
  };

  const syncMyState = async () => {
    try {
      const [me, chars] = await Promise.all([apiGet('/user/me'), apiGet('/characters')]);
      setCredits(Number(me?.credits || 0));
      const list = Array.isArray(chars) ? chars : [];
      setSurvivors((prev) => prev.map((s) => {
        const found = list.find((c) => String(c._id) === String(s._id));
        return found ? { ...s, inventory: found.inventory ?? s.inventory } : s;
      }));
    } catch (e) {
      // 동기화 실패는 치명적이지 않음
      console.error(e);
    }
  };

  const loadMarket = async () => {
    try {
      setMarketMessage('');
      const [itemsRes, kiosksRes, droneRes] = await Promise.all([
        apiGet('/public/items'),
        apiGet('/public/kiosks'),
        apiGet('/public/drone-offers'),
      ]);
      setPublicItems(Array.isArray(itemsRes) ? itemsRes : []);
      setKiosks(Array.isArray(kiosksRes) ? kiosksRes : []);
      setDroneOffers(Array.isArray(droneRes) ? droneRes : []);
    } catch (e) {
      setMarketMessage(e?.response?.data?.error || e.message);
    }
  };

  const loadTrades = async () => {
    try {
      setMarketMessage('');
      const [open, mine] = await Promise.all([
        apiGet('/trades'),
        apiGet('/trades?mine=true'),
      ]);
      setTradeOffers(Array.isArray(open) ? open : []);
      setMyTradeOffers(Array.isArray(mine) ? mine : []);
    } catch (e) {
      setMarketMessage(e?.response?.data?.error || e.message);
    }
  };

  // 초기 데이터 로드 (캐릭터 + 이벤트 + 설정 + 상점 데이터)
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      alert('로그인이 필요한 기능입니다. 로그인 페이지로 이동합니다.');
      window.location.href = '/login';
      return;
    }

    if (hasInitialized.current) return;
    hasInitialized.current = true;

    const fetchData = async () => {
      try {
        const [charRes, eventRes, settingRes, meRes, itemsRes, mapsRes, kiosksRes, droneRes, openTrades, mineTrades] = await Promise.all([
          apiGet('/characters'),
          apiGet('/events'),
          apiGet('/settings'),
          apiGet('/user/me'),
          apiGet('/public/items'),
          apiGet('/public/maps'),
          apiGet('/public/kiosks'),
          apiGet('/public/drone-offers'),
          apiGet('/trades'),
          apiGet('/trades?mine=true'),
        ]);

        if (settingRes) setSettings(settingRes);

        const mapsList = Array.isArray(mapsRes) ? mapsRes : [];
        setMaps(mapsList);
// ✅ 시뮬레이션은 "플레이어가 맵을 선택"하지 않습니다.
// 등록된 맵 중 첫 번째 맵을 시작점으로 사용합니다. (이동/진행 로직은 런타임에서 처리)
const initialMapId = (mapsList[0]?._id ? String(mapsList[0]._id) : '');
if (initialMapId) {
  setActiveMapId(initialMapId);
}

        const initialMap = mapsList.find((m) => String(m?._id) === String(initialMapId)) || null;
        const initialZoneIds = (Array.isArray(initialMap?.zones) && initialMap.zones.length)
          ? initialMap.zones.map((z) => String(z.zoneId))
          : ['__default__'];

        // 🎮 룰 프리셋에 따라 생존자 런타임 상태를 초기화
        const ruleset = getRuleset(settingRes?.rulesetId);
        const det = ruleset?.detonation;
        const energy = ruleset?.gadgetEnergy;

// 🎒 추천 상급 장비(또는 역할)에 맞춰 시작 구역을 가중치 랜덤으로 선택
const pickStartZoneIdForChar = (c) => {
  const zonesArr = Array.isArray(initialMap?.zones) ? initialMap.zones : [];
  const fallback = () => initialZoneIds[Math.floor(Math.random() * initialZoneIds.length)];
  if (!zonesArr.length) return fallback();

  const texts = [];
  const addText = (v) => {
    if (v === null || v === undefined) return;
    const s = String(v).trim();
    if (s) texts.push(s.toLowerCase());
  };

  const addFromList = (arr) => {
    if (!Array.isArray(arr)) return;
    arr.forEach((g) => {
      if (!g) return;
      if (typeof g === 'string') return addText(g);
      addText(g.name);
      addText(g.kind);
      addText(g.category);
      addText(g.type);
      if (Array.isArray(g.tags)) g.tags.forEach(addText);
    });
  };

  addFromList(c?.recommendedHighGear);
  addFromList(c?.recommendedAdvancedGear);
  addFromList(c?.recommendedGear);
  addFromList(c?.advancedGear);

  // 스탯 기반 힌트(데이터가 없을 때)
  const st = c?.stats || c?.stat || c;
  const keys = ['str', 'agi', 'int', 'men', 'luk', 'dex', 'sht', 'end'];
  const top = keys
    .map((k) => [k, Number(st?.[k] ?? st?.[k.toUpperCase()] ?? 0)])
    .sort((a, b) => b[1] - a[1])[0]?.[0];
  if (top) addText(top);

  // gear/stat 힌트를 zone name/tags에 매칭하기 위한 간단 사전
  const keywordMap = {
    keyboard: ['keyboard', '키보드', '키보'],
    mouse: ['mouse', '마우스'],
    monitor: ['monitor', '모니터'],
    weapon: ['weapon', '무기', 'armory', '병기'],
    armor: ['armor', '방어구', '갑옷'],
    food: ['food', '음식', '식당', '편의'],
    sht: ['shoot', '사격', '원거리', '총', 'gun'],
    str: ['melee', '근접', '격투'],
    int: ['lab', '연구', '전산', '컴퓨터'],
    dex: ['craft', '제작', '공작'],
  };

  const expanded = new Set();
  texts.forEach((t) => {
    expanded.add(t);
    Object.entries(keywordMap).forEach(([k, syns]) => {
      const hit = t.includes(k) || syns.some((s) => t.includes(String(s).toLowerCase()));
      if (hit) syns.forEach((s) => expanded.add(String(s).toLowerCase()));
    });
  });

  const hints = [...expanded].filter(Boolean);
  if (!hints.length) return fallback();

  const candidates = zonesArr
    .filter((z) => {
      const name = String(z?.name || '').toLowerCase();
      const tags = Array.isArray(z?.tags) ? z.tags.map((x) => String(x).toLowerCase()) : [];
      return hints.some((h) => name.includes(h) || tags.includes(h));
    })
    .map((z) => String(z.zoneId));

  const pool = candidates.length ? candidates : initialZoneIds;
  return pool[Math.floor(Math.random() * pool.length)];
};
// 로컬 명예의 전당(내 기록) 백업 저장: 서버 저장/조회가 꼬여도 최소한 로컬엔 남게 함
const saveLocalHof = (winner, killCountsObj, participantsList) => {
  try {
    const me = JSON.parse(localStorage.getItem('user') || 'null');
    const username = me?.username || me?.id || 'guest';
    const key = `eh_hof_${username}`;

    const raw = localStorage.getItem(key);
    const state = raw ? JSON.parse(raw) : { winsByChar: {}, killsByChar: {}, updatedAt: 0 };

    // 우승 1회
    if (winner?.name) {
      state.winsByChar[winner.name] = (state.winsByChar[winner.name] || 0) + 1;
    }

    // 킬 누적 (id -> name 변환)
    const idToName = {};
    (participantsList || []).forEach((p) => {
      const id = p?._id || p?.id;
      if (!id) return;
      idToName[id] = p?.name || p?.nickname || p?.charName || p?.title;
    });

    Object.entries(killCountsObj || {}).forEach(([id, k]) => {
      const name = idToName[id];
      if (!name) return;
      const v = Number(k || 0);
      if (!Number.isFinite(v) || v <= 0) return;
      state.killsByChar[name] = (state.killsByChar[name] || 0) + v;
    });

    state.updatedAt = Date.now();
    localStorage.setItem(key, JSON.stringify(state));
  } catch (e) {
    console.error('local hof save failed', e);
  }
};

        const charsWithHp = (Array.isArray(charRes) ? charRes : []).map((c) => ({
          ...c,
          hp: 100,
          zoneId: pickStartZoneIdForChar(c),


          simCredits: 0,
          // 하이브리드(시즌10) 전용 상태
          detonationSec: det ? det.startSec : null,
          detonationMaxSec: det ? det.maxSec : null,
          gadgetEnergy: energy ? energy.start : 0,
          cooldowns: {
            portableSafeZone: 0,
            cnotGate: 0,
          },
          safeZoneUntil: 0,
        }));
        const shuffledChars = charsWithHp.sort(() => Math.random() - 0.5);
        setSurvivors(shuffledChars);
        setEvents(Array.isArray(eventRes) ? eventRes : []);

        // 킬 카운트 초기화
        const initialKills = {};
        (Array.isArray(charRes) ? charRes : []).forEach((c) => {
          initialKills[c._id] = 0;
        });
        setKillCounts(initialKills);

        setCredits(Number(meRes?.credits || 0));
        setPublicItems(Array.isArray(itemsRes) ? itemsRes : []);
        setKiosks(Array.isArray(kiosksRes) ? kiosksRes : []);
        setDroneOffers(Array.isArray(droneRes) ? droneRes : []);
        setTradeOffers(Array.isArray(openTrades) ? openTrades : []);
        setMyTradeOffers(Array.isArray(mineTrades) ? mineTrades : []);

        // 경기 시간도 초기화
        setMatchSec(0);

        addLog('📢 선수들이 경기장에 입장했습니다. 잠시 후 게임이 시작됩니다.', 'system');
      } catch (err) {
        console.error('데이터 로드 실패:', err);
        addLog('⚠️ 데이터를 불러오는데 실패했습니다.', 'death');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // 최신 킬 정보 전달
  const finishGame = async (finalSurvivors, latestKillCounts) => {
    // 게임 종료 시 오토 플레이는 자동으로 해제
    setAutoPlay(false);
    const w = finalSurvivors[0];
    const finalKills = latestKillCounts || killCounts;

    const wId = w ? (w._id || w.id) : null;
    const myKills = wId ? (finalKills[wId] || 0) : 0;
    const rewardLP = 100 + myKills * 10;

    setWinner(w);
    setIsGameOver(true);
    setShowResultModal(true);

    if (w) addLog(`🏆 게임 종료! 최후의 생존자: [${w.name}]`, 'highlight');
    else addLog('💀 생존자가 아무도 없습니다...', 'death');


    // (3) 로컬 백업(캐릭터별: 내 명예의 전당)
    try {
      const me = JSON.parse(localStorage.getItem('user') || 'null');
      const username = me?.username || me?.id || 'guest';
      const key = `eh_hof_${username}`;
      const raw = localStorage.getItem(key);
      const state = raw ? JSON.parse(raw) : { chars: {} };
      if (!state.chars) state.chars = {};

      const participants = [
        ...(Array.isArray(finalSurvivors) ? finalSurvivors : []),
        ...(Array.isArray(dead) ? dead : []),
      ];

      const idToName = {};
      for (const p of participants) {
        const pid = String(p?._id ?? p?.id ?? '');
        if (!pid) continue;
        idToName[pid] = p?.name ?? p?.nickname ?? p?.charName ?? p?.title ?? pid;
      }

      for (const [pid, k] of Object.entries(finalKills || {})) {
        const sid = String(pid);
        if (!sid) continue;
        const entry = state.chars[sid] || { name: idToName[sid] || sid, wins: 0, kills: 0 };
        entry.name = idToName[sid] || entry.name;
        entry.kills = Number(entry.kills || 0) + Number(k || 0);
        state.chars[sid] = entry;
      }

      if (w) {
        const wid = String(w?._id ?? w?.id ?? '');
        if (wid) {
          const entry =
            state.chars[wid] ||
            { name: idToName[wid] || (w?.name ?? w?.nickname ?? w?.charName ?? wid), wins: 0, kills: 0 };
          entry.name = idToName[wid] || entry.name;
          entry.wins = Number(entry.wins || 0) + 1;
          state.chars[wid] = entry;
        }
      }


      // legacy(플레이어 단위) 기록을 1회만 캐릭터로 이관
      // - 과거 데이터는 "어떤 캐릭터가 했는지" 정보를 잃어서 정확 복원은 불가능
      // - 그래서 최초 1회에 한해 '승자 캐릭터'에 합산해 이어갑니다.
      if (!state._migratedFromPlayerV1) {
        try {
          const legacyRaw = localStorage.getItem('eh_local_hof_v1');
          const legacy = legacyRaw ? JSON.parse(legacyRaw) : null;
          const legacyWins = Number(legacy?.wins?.[username] || 0);
          const legacyKills = Number(legacy?.kills?.[username] || 0);

          if ((legacyWins > 0 || legacyKills > 0) && w) {
            const wid2 = String(w?._id ?? w?.id ?? '');
            if (wid2) {
              const entry =
                state.chars[wid2] ||
                { name: idToName[wid2] || (w?.name ?? w?.nickname ?? w?.charName ?? wid2), wins: 0, kills: 0 };
              entry.name = idToName[wid2] || entry.name;
              entry.wins = Number(entry.wins || 0) + legacyWins;
              entry.kills = Number(entry.kills || 0) + legacyKills;
              state.chars[wid2] = entry;
            }
          }
        } catch (e) {
          // ignore
        }
        state._migratedFromPlayerV1 = true;
      }

      localStorage.setItem(key, JSON.stringify(state));
    } catch (e) {
      // ignore
    }
    // 로컬 백업 저장(서버 저장/조회가 꼬여도 홈에서 "내 기록"은 최소한 보이게)
if (w) {
  try {
    const me = JSON.parse(localStorage.getItem('user') || 'null');
    const username = me?.username || me?.id || 'guest';
    const key = 'eh_local_hof_v1';

    const raw = localStorage.getItem(key);
    const data = raw ? JSON.parse(raw) : { wins: {}, kills: {} };
    if (!data.wins) data.wins = {};
    if (!data.kills) data.kills = {};

    const wKey = String(w?._id ?? w?.id ?? '');
    const kills = Number(finalKills?.[wKey] || 0);

    data.wins[username] = Number(data.wins[username] || 0) + 1;
    data.kills[username] = Number(data.kills[username] || 0) + kills;

    localStorage.setItem(key, JSON.stringify(data));
  } catch {
    // localStorage/JSON 실패는 무시
  }
}

    // 서버 저장
    try {
      if (w) {
        await apiPost('/game/end', {
          winnerId: wId,
          killCounts: finalKills,
          fullLogs: logs.map((l) => l.text),
          participants: [...survivors, ...dead],
        });
        addLog('✅ 명예의 전당 저장 완료', 'system');
      }
    } catch (e) {
      console.error(e);
      addLog('⚠️ 명예의 전당 저장 실패', 'death');
    }

    try {
      if (w) {
        const res = await apiPost('/user/update-stats', {
          kills: myKills,
          isWin: true,
          lpEarned: rewardLP,
        });
        addLog(`💾 [전적 저장 완료] LP +${rewardLP} 획득! (현재 총 LP: ${res?.newLp ?? '?'})`, 'system');
        if (typeof res?.credits === 'number') setCredits(res.credits);

        const currentUser = JSON.parse(localStorage.getItem('user'));
        if (currentUser && typeof res?.newLp === 'number') {
          currentUser.lp = res.newLp;
          localStorage.setItem('user', JSON.stringify(currentUser));
        }
      }
    } catch (e) {
      addLog(`⚠️ 전적 저장 실패: ${e?.response?.data?.error || '서버 오류'}`, 'death');
    }
  };

  // --- [핵심] 진행 로직 ---
  const proceedPhase = async () => {
    // 1. 페이즈 및 날짜 변경
    const nextPhase = phase === 'morning' ? 'night' : 'morning';
    let nextDay = day;
    if (phase === 'night') nextDay++;

    // 🎮 룰 프리셋 (기본: ER_S10)
    const ruleset = getRuleset(settings?.rulesetId);
    const phaseDurationSec = getPhaseDurationSec(ruleset, nextDay, nextPhase);
    const phaseStartSec = matchSec;
    const fogLocalSec = getFogLocalTimeSec(ruleset, nextDay, nextPhase, phaseDurationSec);

    // 💰 이번 페이즈 기본 크레딧(시즌10 컨셉)
    const baseCredits = Number(ruleset?.credits?.basePerPhase || 0);

    let earnedCredits = baseCredits;

    setDay(nextDay);
    setPhase(nextPhase);
    addLog(
      `=== ${nextPhase === 'morning' ? '🌞' : '🌙'} ${nextDay}일차 ${nextPhase === 'morning' ? '아침' : '밤'} (⏱ ${phaseDurationSec}s) ===`,
      'day-header'
    );

    // 2. 맵 내부 구역 이동 + 금지구역(구역 기반) 데미지
    const mapObj = activeMap;
    const forbiddenIds = mapObj ? new Set(getForbiddenZoneIdsForPhase(mapObj, nextDay, nextPhase, ruleset)) : new Set();
    const forbiddenNames = [...forbiddenIds].map((zid) => getZoneName(zid)).join(', ');

    const cfg = mapObj?.forbiddenZoneConfig || {};
    // LEGACY 규칙: 금지구역 체류 시 HP 감소
    const damagePerTick = Number(cfg.damagePerTick ?? 0) || Math.round(nextDay * (settings.forbiddenZoneDamageBase || 1.5));

    if (forbiddenIds.size > 0) {
      if (ruleset.id === 'ER_S10') {
        const startSec = Number(ruleset?.detonation?.startSec || 20);
        const maxSec = Number(ruleset?.detonation?.maxSec || 30);
        addLog(`⚠️ 제한구역: ${forbiddenNames} (폭발 타이머: 기본 ${startSec}s / 최대 ${maxSec}s)`, 'system');
      } else {
        addLog(`⚠️ 금지구역: ${forbiddenNames} (해당 구역 체류 시 HP -${damagePerTick})`, 'system');
      }
    }

    const newlyDead = [];
    let updatedSurvivors = (Array.isArray(survivors) ? survivors : [])
      .map((s) => {
        let updated = updateEffects({ ...s });

        // --- 이동 ---
        const currentZone = String(updated.zoneId || zones[0]?.zoneId || '__default__');
        const neighbors = Array.isArray(zoneGraph[currentZone]) ? zoneGraph[currentZone] : [];
        let nextZoneId = currentZone;

        const mustEscape = forbiddenIds.has(currentZone);
        const willMove = mustEscape || Math.random() < 0.6;
        if (willMove) {
          if (neighbors.length > 0) {
                      const safeNeighbors = neighbors.filter((zid) => !forbiddenIds.has(String(zid)));
                      const candidates = safeNeighbors.length ? safeNeighbors : neighbors;
                      nextZoneId = String(candidates[Math.floor(Math.random() * candidates.length)] || currentZone);
          } else {
            // 연결 정보가 없으면(=neighbors가 비면) 맵 전체에서 랜덤 이동
            const allZoneIds = zones.map((z) => String(z.zoneId)).filter(Boolean);
            const safeAll = allZoneIds.filter((zid) => !forbiddenIds.has(String(zid)));
            const pool = safeAll.length ? safeAll : allZoneIds;
            if (pool.length > 0) {
              nextZoneId = String(pool[Math.floor(Math.random() * pool.length)] || currentZone);
            }
          }
        }

        if (String(nextZoneId) !== String(currentZone)) {
          addLog(`🚶 [${updated.name}] 이동: ${getZoneName(currentZone)} → ${getZoneName(nextZoneId)}`, 'normal');
        }
        updated.zoneId = nextZoneId;

        // --- 시즌10 컨셉: 에너지/폭발 타이머(초) 기반 ---
        if (ruleset.id === 'ER_S10') {
          const energyCfg = ruleset?.gadgetEnergy || {};
          const maxEnergy = Number(energyCfg.max ?? 100);
          const gain = Number(energyCfg.gainPerPhase ?? 10);
          const curEnergy = Number(updated.gadgetEnergy ?? 0);
          updated.gadgetEnergy = Math.min(maxEnergy, curEnergy + gain);

          // 기존 저장 데이터와 호환: 필드가 없으면 기본값 주입
          const detCfg = ruleset?.detonation || {};
          if (updated.detonationSec === undefined || updated.detonationSec === null) updated.detonationSec = Number(detCfg.startSec ?? 20);
          if (updated.detonationMaxSec === undefined || updated.detonationMaxSec === null) updated.detonationMaxSec = Number(detCfg.maxSec ?? 30);
          if (!updated.cooldowns) updated.cooldowns = { portableSafeZone: 0, cnotGate: 0 };
          if (updated.safeZoneUntil === undefined || updated.safeZoneUntil === null) updated.safeZoneUntil = 0;
        }

        // --- 금지구역 피해 ---
        if (ruleset.id !== 'ER_S10') {
          if (forbiddenIds.size > 0 && forbiddenIds.has(String(updated.zoneId))) {
            updated.hp = Math.max(0, Number(updated.hp || 0) - damagePerTick);
            if (updated.hp > 0) {
              addLog(`☠️ [${updated.name}] 금지구역(${getZoneName(updated.zoneId)}) 피해: HP -${damagePerTick}`, 'death');
            }
          }

          if (updated.hp <= 0 && Number(s.hp || 0) > 0) {
            addLog(`💀 [${s.name}]이(가) 금지구역을 벗어나지 못하고 사망했습니다.`, 'death');
            newlyDead.push(updated);
          }
        }
        return updated;
      })
      .filter((s) => Number(s.hp || 0) > 0);

    // 2.5) 시즌10 컨셉: 페이즈 내부 틱 시뮬레이션(폭발 타이머/가젯)
    if (ruleset.id === 'ER_S10' && forbiddenIds.size > 0) {
      const tickSec = Number(ruleset?.tickSec || 1);
      const detCfg = ruleset?.detonation || {};
      const decPerSec = Number(detCfg.decreasePerSecForbidden || 1);
      const regenPerSec = Number(detCfg.regenPerSecOutsideForbidden || 1);
      const criticalSec = Number(detCfg.criticalSec || 5);

      const psz = ruleset?.gadgets?.portableSafeZone || {};
      const pszCost = Number(psz.energyCost || 40);
      const pszCd = Number(psz.cooldownSec || 30);
      const pszDur = Number(psz.durationSec || 7);

      const cnot = ruleset?.gadgets?.cnotGate || {};
      const cnotCost = Number(cnot.energyCost || 30);
      const cnotCd = Number(cnot.cooldownSec || 10);

      const allZoneIds = (Array.isArray(mapObj?.zones) && mapObj.zones.length)
        ? mapObj.zones.map((z) => String(z.zoneId))
        : [...forbiddenIds];

      const pickSafeZone = (fromZoneId) => {
        const neighbors = Array.isArray(zoneGraph[fromZoneId]) ? zoneGraph[fromZoneId] : [];
        const safeNeighbors = neighbors.map(String).filter((zid) => !forbiddenIds.has(String(zid)));
        if (safeNeighbors.length) return String(safeNeighbors[Math.floor(Math.random() * safeNeighbors.length)]);
        const safeAll = allZoneIds.filter((zid) => !forbiddenIds.has(String(zid)));
        if (safeAll.length) return String(safeAll[Math.floor(Math.random() * safeAll.length)]);
        return String(fromZoneId);
      };

      // 🌫️ 퍼플 포그(서브웨더) - Day2/Day3/Day4 중간(단순 모델)
      const fogWarningSec = Number(ruleset?.fog?.warningSec || 30);
      const fogDurationSec = Number(ruleset?.fog?.durationSec || 45);
      const fogStartLocal = (fogLocalSec === null || fogLocalSec === undefined) ? null : Number(fogLocalSec);
      const fogWarnLocal = (fogStartLocal !== null) ? Math.max(0, fogStartLocal - fogWarningSec) : null;
      const fogEndLocal = (fogStartLocal !== null) ? fogStartLocal + fogDurationSec : null;

      let aliveMap = new Map(updatedSurvivors.map((s) => [s._id, { ...s, cooldowns: { ...(s.cooldowns || {}) } }]));

      for (let t = 0; t < phaseDurationSec; t += tickSec) {
        const absSec = phaseStartSec + t;

        // 퍼플 포그 안내 로그(과도한 로그 방지: 1회씩만)
        if (fogWarnLocal !== null && t === fogWarnLocal) {
          addLog(`🌫️ 퍼플 포그 경고! 약 ${fogWarningSec}s 후, 일부 구역에서 시야가 악화됩니다.`, 'system');
        }
        if (fogStartLocal !== null && t === fogStartLocal) {
          addLog(`🌫️ 퍼플 포그 확산! (약 ${fogDurationSec}s)`, 'highlight');
        }
        if (fogEndLocal !== null && t === fogEndLocal) {
          addLog(`🌫️ 퍼플 포그가 걷혔습니다.`, 'system');
        }

        for (const s of aliveMap.values()) {
          if (!s || Number(s.hp || 0) <= 0) continue;

          // 쿨다운 감소
          if (s.cooldowns) {
            s.cooldowns.portableSafeZone = Math.max(0, Number(s.cooldowns.portableSafeZone || 0) - tickSec);
            s.cooldowns.cnotGate = Math.max(0, Number(s.cooldowns.cnotGate || 0) - tickSec);
          }

          const zoneId = String(s.zoneId || '__default__');
          const isForbidden = forbiddenIds.has(zoneId);

          if (!isForbidden) {
            // 안전 구역: 폭발 타이머 회복
            if (s.detonationSec !== null && s.detonationSec !== undefined) {
              const maxDet = Number(s.detonationMaxSec || detCfg.maxSec || 30);
              s.detonationSec = Math.min(maxDet, Number(s.detonationSec || 0) + regenPerSec * tickSec);
            }
            continue;
          }

          // 제한구역: 안전지대 효과 중이면 카운트다운 정지
          if (Number(s.safeZoneUntil || 0) > absSec) {
            continue;
          }

          // 제한구역: 폭발 타이머 감소
          s.detonationSec = Math.max(0, Number(s.detonationSec || 0) - decPerSec * tickSec);

          // 위기: 가젯 사용 시도(단순 모델)
          if (Number(s.detonationSec || 0) <= criticalSec) {
            const energyNow = Number(s.gadgetEnergy || 0);

            // 1) CNOT 게이트(간이 텔레포트)
            if (Number(s.cooldowns?.cnotGate || 0) <= 0 && energyNow >= cnotCost) {
              const dest = pickSafeZone(zoneId);
              if (dest && String(dest) !== zoneId) {
                s.zoneId = String(dest);
                s.gadgetEnergy = energyNow - cnotCost;
                s.cooldowns.cnotGate = cnotCd;
                addLog(`🌀 [${s.name}] CNOT 게이트 발동 → ${getZoneName(dest)} (에너지 -${cnotCost})`, 'highlight');
              }
            }

            // 2) 휴대용 안전지대(간이 개인 보호)
            const afterEnergy = Number(s.gadgetEnergy || 0);
            if (forbiddenIds.has(String(s.zoneId || zoneId)) && Number(s.cooldowns?.portableSafeZone || 0) <= 0 && afterEnergy >= pszCost) {
              s.gadgetEnergy = afterEnergy - pszCost;
              s.cooldowns.portableSafeZone = pszCd;
              s.safeZoneUntil = absSec + pszDur;
              addLog(`🛡️ [${s.name}] 휴대용 안전지대 전개 (${pszDur}s) (에너지 -${pszCost})`, 'highlight');
            }
          }

          // 폭발 타이머 만료 → 사망
          if (Number(s.detonationSec || 0) <= 0) {
            s.hp = 0;
            newlyDead.push(s);
            addLog(`💥 [${s.name}] 폭발 타이머가 0이 되어 사망했습니다. (구역: ${getZoneName(zoneId)})`, 'death');
          }
        }
      }

      // 반영
      updatedSurvivors = Array.from(aliveMap.values()).filter((s) => Number(s.hp || 0) > 0);
    }

    if (newlyDead.length) setDead((prev) => [...prev, ...newlyDead]);

    // 확률 보정
    const fogBonus = (ruleset.id === 'ER_S10' && fogLocalSec !== null && fogLocalSec !== undefined) ? 0.08 : 0;
    const battleProb = Math.min(0.85, 0.3 + nextDay * 0.05 + fogBonus);
    const eventProb = Math.min(0.95, battleProb + 0.3);

    // 교전이 특정 캐릭터에 편향되지 않도록(선공/우선순위 이점 제거) 양방향 결과를 비교해 채택
    const pickStat = (c, keys) => {
      for (const k of keys) {
        const v = Number(c?.stats?.[k] ?? c?.[k] ?? c?.[k?.toLowerCase?.()] ?? 0);
        if (Number.isFinite(v) && v > 0) return v;
      }
      return 0;
    };

    const combatScore = (c) => {
      const hp = Math.max(1, Math.min(100, Number(c?.hp ?? 100)));
      const base =
        pickStat(c, ['STR', 'str']) +
        pickStat(c, ['AGI', 'agi']) +
        pickStat(c, ['SHOOT', 'shoot', 'SHT', 'sht']) +
        pickStat(c, ['END', 'end']) +
        pickStat(c, ['MEN', 'men']) * 0.5 +
        pickStat(c, ['INT', 'int']) * 0.3 +
        pickStat(c, ['DEX', 'dex']) * 0.3 +
        pickStat(c, ['LUK', 'luk']) * 0.2;

      return base * (0.5 + hp / 200);
    };

    const pickUnbiasedBattle = (a, b) => {
      const r1 = calculateBattle(a, b, nextDay, settings);
      const r2 = calculateBattle(b, a, nextDay, settings);

      const id1 = r1?.winner?._id ? String(r1.winner._id) : null;
      const id2 = r2?.winner?._id ? String(r2.winner._id) : null;

      // 양방향 결과가 같은 승자를 내면 그대로 사용
      if (id1 && id1 === id2) return r1;
      if (!id1 && id2) return r2;
      if (id1 && !id2) return r1;

      // 승자가 갈리면(선공 이점) 스탯 기반 확률로 한 쪽 결과를 채택
      const sa = combatScore(a);
      const sb = combatScore(b);
      const pRaw = 1 / (1 + Math.exp((sb - sa) / 60));
      const pA = Math.min(0.92, Math.max(0.08, pRaw));
      const chosenId = Math.random() < pA ? String(a._id) : String(b._id);

      return chosenId === id1 ? r1 : r2;
    };


    let todaysSurvivors = [...updatedSurvivors].sort(() => Math.random() - 0.5);
    let survivorMap = new Map(todaysSurvivors.map((s) => [s._id, s]));
    let newDeadIds = [];

    // 이번 턴 킬 모아두기
    let roundKills = {};

    // 3. 메인 루프
    while (todaysSurvivors.length > 0) {
      let actor = todaysSurvivors.pop();
      actor = survivorMap.get(actor._id);

      if (newDeadIds.includes(actor._id) || actor.hp <= 0) continue;

      // 아이템 사용(HP 60 미만)
      if (actor.hp < 60 && Array.isArray(actor.inventory) && actor.inventory.length > 0) {
        const idx = actor.inventory.findIndex((i) => {
          const tags = safeTags(i);
          const t = String(i?.type || '').toLowerCase();
          return tags.includes('heal') || tags.includes('medical') || t === 'food' || tags.includes('food') || tags.includes('healthy');
        });

        if (idx > -1) {
          const itemToUse = actor.inventory[idx];
          const effect = applyItemEffect(actor, itemToUse);
          addLog(effect.log, 'highlight');
          actor.hp = Math.min(100, actor.hp + (effect.recovery || 0));

          // qty 감소(서버형 인벤토리 대응)
          const currentQty = Number(itemToUse?.qty || 1);
          if (Number.isFinite(currentQty) && currentQty > 1) actor.inventory[idx] = { ...itemToUse, qty: currentQty - 1 };
          else actor.inventory.splice(idx, 1);

          survivorMap.set(actor._id, actor);
        }
      }

      const potentialTargets = todaysSurvivors.filter((t) => !newDeadIds.includes(t._id) && String(t?.zoneId || '') === String(actor?.zoneId || ''));
      const canDual = potentialTargets.length > 0;
      const rand = Math.random();

      if (canDual && rand < battleProb) {
        // [⚔️ 전투]
        const target = survivorMap.get(potentialTargets[0]._id);

        // 상대방 행동권 사용
        const targetIndex = todaysSurvivors.findIndex((t) => t._id === target._id);
        if (targetIndex > -1) todaysSurvivors.splice(targetIndex, 1);

	        const actorBattleName = canonicalizeCharName(actor.name);
        const targetBattleName = canonicalizeCharName(target.name);
        const battleResult = pickUnbiasedBattle(
          { ...actor, name: actorBattleName },
          { ...target, name: targetBattleName }
        );
        let battleLog = battleResult.log || '';
        if (actorBattleName && actorBattleName !== actor.name) {
          battleLog = battleLog.split(actorBattleName).join(actor.name);
        }
        if (targetBattleName && targetBattleName !== target.name) {
          battleLog = battleLog.split(targetBattleName).join(target.name);
        }
        addLog(battleLog, battleResult.type);

        if (battleResult.winner) {
          const actorIdStr = String(actor._id);
          const winnerIdStr = String(battleResult.winner._id);
          const winner = winnerIdStr === actorIdStr ? actor : target;
          const loser = winnerIdStr === actorIdStr ? target : actor;
          const winnerId = battleResult.winner._id;

          loser.hp = 0;
          newDeadIds.push(loser._id);
          setDead((prev) => [...prev, loser]);

          roundKills[winnerId] = (roundKills[winnerId] || 0) + 1;

          // 시즌10 컨셉: 처치 보상(폭발 타이머 + 크레딧)
          if (ruleset.id === 'ER_S10') {
            const bonusSec = Number(ruleset?.detonation?.killBonusSec || 5);
            if (winner && winner.detonationSec !== null && winner.detonationSec !== undefined) {
              const maxDet = Number(winner.detonationMaxSec || ruleset?.detonation?.maxSec || 30);
              winner.detonationSec = Math.min(maxDet, Number(winner.detonationSec || 0) + bonusSec);
              addLog(`⏱️ [${winner.name}] 처치 보상: 폭발 타이머 +${bonusSec}s`, 'system');
            }
            const killCredit = Number(ruleset?.credits?.kill || 0);
if (killCredit > 0) {
  earnedCredits += killCredit;
  winner.simCredits = Number(winner.simCredits || 0) + killCredit;
}}
        }
      } else if (canDual && rand < eventProb) {
        // [🤝 2인 이벤트]
        const target = survivorMap.get(potentialTargets[0]._id);
        const targetIndex = todaysSurvivors.findIndex((t) => t._id === target._id);
        if (targetIndex > -1) todaysSurvivors.splice(targetIndex, 1);

        const timeKey = nextPhase === 'night' ? 'night' : 'day';

        // ✅ (로드맵 6-4 + 2번 연동) 시간대/맵 조건을 우선 적용
        let availableEvents = (Array.isArray(events) ? events : []).filter((e) => {
          if (!e) return false;
          if (String(e.type || 'normal') === 'death') return false;

          const sc = Number(e.survivorCount ?? (String(e.text || '').includes('{2}') ? 2 : 1));
          const vc = Number(e.victimCount ?? 0);
          if (sc !== 2 || vc !== 0) return false;

          const tod = String(e.timeOfDay || 'both');
          if (tod !== 'both' && tod !== timeKey) return false;

          // mapId가 비어있으면 "어느 맵에서든" 발생 가능, 값이 있으면 현재 선택 맵과 일치해야 함
          if (activeMapId && e.mapId && String(e.mapId) !== String(activeMapId)) return false;

          // zoneId가 있으면, 현재 캐릭터의 구역과 일치해야 발생
          if (e.zoneId && String(e.zoneId) !== String(actor?.zoneId || '')) return false;
          return true;
        });

        // 구버전 이벤트(텍스트 기반) 호환
        if (availableEvents.length === 0) {
          availableEvents = (Array.isArray(events) ? events : []).filter((e) => {
            if (!e?.text) return false;
            if (String(e.type || 'normal') === 'death') return false;
            if (!String(e.text).includes('{2}')) return false;
            const tod = String(e.timeOfDay || 'both');
            if (tod !== 'both' && tod !== timeKey) return false;
            if (activeMapId && e.mapId && String(e.mapId) !== String(activeMapId)) return false;
	            if (e.zoneId && String(e.zoneId) !== String(actor?.zoneId || '')) return false;
            return true;
          });
        }

        const randomEvent = availableEvents.length
          ? availableEvents[Math.floor(Math.random() * availableEvents.length)]
          : null;

        if (!randomEvent?.text) {
          // (유저용 로그 아님) 조우했지만 이벤트가 없을 때는 조용히 스킵
          survivorMap.set(actor._id, actor);
          survivorMap.set(target._id, target);
          continue;
        }
        const eventText = String(randomEvent.text)
          .replace(/\{1\}/g, `[${actor.name}]`)
          .replace(/\{2\}/g, `[${target.name}]`);
        addLog(eventText, 'normal');
      } else {
        // [🌳 1인 이벤트]
        const timeKey = nextPhase === 'night' ? 'night' : 'day';
        let soloEvents = (Array.isArray(events) ? events : []).filter((e) => {
          if (!e) return false;
          if (String(e.type || 'normal') === 'death') return false;

          const sc = Number(e.survivorCount ?? 1);
          const vc = Number(e.victimCount ?? 0);
          if (sc !== 1 || vc !== 0) return false;

          const tod = String(e.timeOfDay || 'both');
          if (tod !== 'both' && tod !== timeKey) return false;

          if (activeMapId && e.mapId && String(e.mapId) !== String(activeMapId)) return false;
	          if (e.zoneId && String(e.zoneId) !== String(actor?.zoneId || '')) return false;
          return true;
        });

        // 구버전 이벤트(텍스트 기반) 호환: {2} 없는 이벤트를 1인 이벤트로 취급
        if (soloEvents.length === 0) {
          soloEvents = (Array.isArray(events) ? events : []).filter((e) => {
            if (!e?.text) return false;
            if (String(e.type || 'normal') === 'death') return false;
            if (String(e.text).includes('{2}')) return false;
            const tod = String(e.timeOfDay || 'both');
            if (tod !== 'both' && tod !== timeKey) return false;
            if (activeMapId && e.mapId && String(e.mapId) !== String(activeMapId)) return false;
	            if (e.zoneId && String(e.zoneId) !== String(actor?.zoneId || '')) return false;
            return true;
          });
        }

        if (soloEvents.length > 0) {
          const randomEvent = soloEvents[Math.floor(Math.random() * soloEvents.length)];
          const eventText = String(randomEvent.text)
            .replace(/\{1\}/g, `[${actor.name}]`)
            .replace(/\{2\}/g, `[${actor.name}]`);
          addLog(eventText, 'normal');
        } else {
          // 폴백: 동적 이벤트 생성
          const eventResult = generateDynamicEvent(actor, nextDay);
          addLog(eventResult.log, eventResult.damage > 0 ? 'highlight' : 'normal');

          if (eventResult.newItem && (actor.inventory || []).length < 3) {
            actor.inventory = [...(actor.inventory || []), eventResult.newItem];
          }
          if (eventResult.damage) actor.hp -= eventResult.damage;
          if (eventResult.recovery) actor.hp = Math.min(100, actor.hp + eventResult.recovery);
          if (eventResult.newEffect) actor.activeEffects = [...(actor.activeEffects || []), eventResult.newEffect];
        }

        if (actor.hp <= 0) {
          addLog(`💀 [${actor.name}]이(가) 사고로 사망했습니다.`, 'death');
          newDeadIds.push(actor._id);
          setDead((prev) => [...prev, actor]);
        }
      }

      survivorMap.set(actor._id, actor);
    }

    // 4. 킬 카운트 업데이트
    const updatedKillCounts = { ...killCounts };
    Object.keys(roundKills).forEach((killerId) => {
      updatedKillCounts[killerId] = (updatedKillCounts[killerId] || 0) + roundKills[killerId];
    });
    setKillCounts(updatedKillCounts);

    // 5. 생존자 업데이트
    const finalStepSurvivors = Array.from(survivorMap.values()).filter((s) => !newDeadIds.includes(s._id));

    // 💳 크레딧은 화면에 직접 띄우지 않고, 캐릭터별(simCredits)로만 누적 표시합니다.
    // - baseCredits(페이즈 기본)는 생존자에게 분배(합계=baseCredits)
    if (baseCredits > 0 && finalStepSurvivors.length > 0) {
      const aliveCount = finalStepSurvivors.length;
      const share = Math.floor(baseCredits / aliveCount);
      let rem = baseCredits - share * aliveCount;
      finalStepSurvivors.forEach((s) => {
        const add = share + (rem > 0 ? 1 : 0);
        if (rem > 0) rem -= 1;
        s.simCredits = Number(s.simCredits || 0) + add;
      });
    }

    setSurvivors(finalStepSurvivors);

    // 5.5) 경기 시간 진행(초)
    setMatchSec((prev) => prev + phaseDurationSec);

    // 5.6) 크레딧 적립(페이즈 보상 + 처치 보상 등)
    if (earnedCredits > 0) {
      try {
        const res = await apiPost('/credits/earn', { amount: earnedCredits });
        if (typeof res?.credits === 'number') setCredits(res.credits);
} catch (e) {
        // 서버가 꺼져있거나 네트워크 이슈가 있어도 시뮬레이션은 진행되도록
}
    }

    if (finalStepSurvivors.length <= 1) {
      finishGame(finalStepSurvivors, updatedKillCounts);
    }
  };

  // 진행 버튼/오토 플레이 공용 가드(중복 호출 방지)
  const proceedPhaseGuarded = async () => {
    if (isAdvancingRef.current) return;
    if (loading) return;
    if (isGameOver) return;
    if (day === 0 && survivors.length < 2) return;

    isAdvancingRef.current = true;
    setIsAdvancing(true);
    try {
      await proceedPhase();
    } finally {
      isAdvancingRef.current = false;
      setIsAdvancing(false);
    }
  };

  // 오토 플레이가 항상 최신 proceed를 호출하도록 ref에 연결
  useEffect(() => {
    proceedPhaseGuardedRef.current = proceedPhaseGuarded;
  });

  // ▶ 오토 플레이: matchSec(페이즈 종료 시 증가)를 트리거로 다음 페이즈를 자동 진행
  useEffect(() => {
    if (!autoPlay) return;
    if (loading) return;
    if (isGameOver) return;
    if (day === 0 && survivors.length < 2) return;

    const speed = Math.max(0.25, Number(autoSpeed) || 1);
    const baseDelayMs = 1200; // 페이즈 사이 템포(실시간 UX)
    const delayMs = Math.max(150, Math.round(baseDelayMs / speed));

    const id = window.setTimeout(() => {
      // ref를 통해 최신 함수 호출
      proceedPhaseGuardedRef.current?.();
    }, delayMs);

    return () => window.clearTimeout(id);
  }, [autoPlay, autoSpeed, matchSec, loading, isGameOver, day, survivors.length]);

  // ======== Market actions ========
  const ensureCharSelected = () => {
    if (!selectedCharId) {
      setMarketMessage('생존자를 선택해주세요.');
      return false;
    }
    return true;
  };

  const doCraft = async (itemId) => {
    if (!ensureCharSelected()) return;
    try {
      setMarketMessage('');
      const qty = getQty(`craft:${itemId}`, 1);
      const res = await apiPost('/items/craft', { characterId: selectedCharId, itemId, qty });
      if (typeof res?.credits === 'number') setCredits(res.credits);
      if (res?.character) patchInventoryOnly(res.character);
      addLog(`🛠️ [조합] ${res?.message || '조합 완료'} (x${qty})`, 'system');
    } catch (e) {
      setMarketMessage(e?.response?.data?.error || e.message);
      addLog(`⚠️ [조합 실패] ${e?.response?.data?.error || e.message}`, 'death');
    }
  };

  const doKioskTransaction = async (kioskId, catalogIndex) => {
    if (!ensureCharSelected()) return;
    try {
      setMarketMessage('');
      const qty = getQty(`kiosk:${kioskId}:${catalogIndex}`, 1);
      const res = await apiPost(`/kiosks/${kioskId}/transaction`, { characterId: selectedCharId, catalogIndex, qty });
      if (typeof res?.credits === 'number') setCredits(res.credits);
      if (res?.character) patchInventoryOnly(res.character);
      addLog(`🏪 [키오스크] ${res?.message || '거래 완료'} (x${qty})`, 'system');
    } catch (e) {
      setMarketMessage(e?.response?.data?.error || e.message);
      addLog(`⚠️ [키오스크 실패] ${e?.response?.data?.error || e.message}`, 'death');
    }
  };

  const doDroneBuy = async (offerId) => {
    if (!ensureCharSelected()) return;
    try {
      setMarketMessage('');
      const qty = getQty(`drone:${offerId}`, 1);
      const res = await apiPost('/drone/buy', { characterId: selectedCharId, offerId, qty });
      if (typeof res?.credits === 'number') setCredits(res.credits);
      if (res?.character) patchInventoryOnly(res.character);
      addLog(`🚁 [드론] ${res?.message || '구매 완료'} (x${qty})`, 'system');
    } catch (e) {
      setMarketMessage(e?.response?.data?.error || e.message);
      addLog(`⚠️ [드론 구매 실패] ${e?.response?.data?.error || e.message}`, 'death');
    }
  };

  const createTradeOffer = async () => {
    if (!ensureCharSelected()) return;
    try {
      setMarketMessage('');
      const give = compactIO(tradeDraft.give);
      const want = compactIO(tradeDraft.want);
      const wantCredits = Math.max(0, Number(tradeDraft.wantCredits || 0));
      const note = String(tradeDraft.note || '');

      if (give.length === 0) {
        setMarketMessage('give 항목이 비었습니다.');
        return;
      }

      await apiPost('/trades', {
        fromCharacterId: selectedCharId,
        give,
        want,
        wantCredits,
        note,
      });

      addLog('🔁 [거래] 오퍼 생성 완료', 'system');
      setTradeDraft({ give: [{ itemId: '', qty: 1 }], want: [{ itemId: '', qty: 1 }], wantCredits: 0, note: '' });
      await loadTrades();
    } catch (e) {
      setMarketMessage(e?.response?.data?.error || e.message);
      addLog(`⚠️ [거래 오퍼 실패] ${e?.response?.data?.error || e.message}`, 'death');
    }
  };

  const cancelTradeOffer = async (offerId) => {
    try {
      setMarketMessage('');
      await apiPost(`/trades/${offerId}/cancel`, {});
      addLog('🧾 [거래] 오퍼 취소 완료', 'system');
      await loadTrades();
    } catch (e) {
      setMarketMessage(e?.response?.data?.error || e.message);
      addLog(`⚠️ [거래 취소 실패] ${e?.response?.data?.error || e.message}`, 'death');
    }
  };

  const acceptTradeOffer = async (offerId) => {
    if (!ensureCharSelected()) return;
    try {
      setMarketMessage('');
      await apiPost(`/trades/${offerId}/accept`, { toCharacterId: selectedCharId });
      addLog('✅ [거래] 수락 완료', 'system');
      await Promise.all([loadTrades(), syncMyState()]);
    } catch (e) {
      setMarketMessage(e?.response?.data?.error || e.message);
      addLog(`⚠️ [거래 수락 실패] ${e?.response?.data?.error || e.message}`, 'death');
    }
  };

  // 탭 전환 시 필요한 데이터 갱신
  useEffect(() => {
    if (marketTab === 'trade') loadTrades();
    if (marketTab === 'craft' || marketTab === 'kiosk' || marketTab === 'drone') loadMarket();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [marketTab]);

  const forbiddenNow = activeMap
    ? new Set(getForbiddenZoneIdsForPhase(activeMap, day, phase, getRuleset(settings?.rulesetId)))
    : new Set();

  return (
    <main>
      <header>
        <section id="header-id1">
          <ul>
            <li>
              <Link href="/" className="logo-btn">
                <div className="text-logo">
                  <span className="logo-top">PROJECT</span>
                  <span className="logo-main">ARENA</span>
                </div>
              </Link>
            </li>
            <li><Link href="/">메인</Link></li>
            <li><Link href="/characters">캐릭터 설정</Link></li>
            <li><Link href="/details">캐릭터 상세설정</Link></li>
            <li><Link href="/events">이벤트 설정</Link></li>
            <li><Link href="/modifiers">보정치 설정</Link></li>
            <li><Link href="/simulation" style={{ color: '#0288d1' }}>▶ 게임 시작</Link></li>
          </ul>
        </section>
      </header>

      <div className="simulation-container">
        {/* 생존자 현황판 */}
        <aside className="survivor-board">
          <h2>생존자 ({survivors.length}명)</h2>
          <div className="survivor-grid">
            {survivors.map((char) => (
              <div key={char._id} className="survivor-card alive">
                <img src={char.previewImage || '/Images/default_image.png'} alt={char.name} />
                <span>{char.name}</span>
                <div className="skill-tag">⭐ {char.specialSkill?.name || '기본 공격'}</div>
	                <div className={`zone-badge ${forbiddenNow.has(String(char.zoneId || '')) ? 'forbidden' : ''}`}>
	                  📍 {getZoneName(char.zoneId || '__default__')}
	                </div>

                
                <div style={{ fontSize: 12, marginTop: 6, opacity: 0.95 }}>💳 {Number(char.simCredits || 0)} Cr</div>
{settings?.rulesetId === 'ER_S10' && (
                  <div style={{ display: 'flex', gap: 10, justifyContent: 'center', fontSize: 12, opacity: 0.95 }}>
                    <span>⏳ {Number.isFinite(Number(char.detonationSec)) ? Math.max(0, Math.floor(Number(char.detonationSec))) : '-' }s</span>
                    <span>⚡ {Number.isFinite(Number(char.gadgetEnergy)) ? Math.floor(Number(char.gadgetEnergy)) : 0}</span>
                  </div>
                )}

                <div className="inventory-summary">
                  <span className="bag-icon">🎒</span>
                  <span className="inv-count">{Array.isArray(char.inventory) ? char.inventory.length : 0}/3</span>
                  <div className="inv-tooltip">
                    {(Array.isArray(char.inventory) ? char.inventory : []).map((it, i) => (
                      <div key={i} className="inv-item-mini">
                        {itemIcon(it)} {itemDisplayName(it)}
                        {Number(it?.qty || 1) > 1 ? ` x${Number(it.qty)}` : ''}
                      </div>
                    ))}
                  </div>
                </div>

                {killCounts[char._id] > 0 && <span className="kill-badge">⚔️{killCounts[char._id]}</span>}

                <div className="status-effects-container">
                  {char.activeEffects?.map((eff) => (
                    <span key={eff.name} title={eff.name} className="effect-icon">
                      {eff.name === '식중독' ? '🤢' : '🤕'}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <h2 style={{ marginTop: '30px', color: '#ff5252' }}>사망자 ({dead.length}명)</h2>
          <div className="survivor-grid">
            {dead.map((char) => (
              <div key={char._id} className="survivor-card dead">
                <img src={char.previewImage || '/Images/default_image.png'} alt={char.name} />
                <span>{char.name}</span>
                <div className="zone-badge dead">📍 {getZoneName(char.zoneId || '__default__')}</div>
                
                <div style={{ fontSize: 12, marginTop: 6, opacity: 0.95 }}>💳 {Number(char.simCredits || 0)} Cr</div>
{killCounts[char._id] > 0 && <span className="kill-badge">⚔️{killCounts[char._id]}</span>}
              </div>
            ))}
          </div>
        </aside>

        {/* 게임 화면 */}
        <section className={`game-screen ${phase === 'morning' ? 'morning-mode' : 'night-mode'}`}>
          <div className="screen-header">
            <h1>{day === 0 ? 'GAME READY' : `DAY ${day} - ${phase === 'morning' ? 'MORNING' : 'NIGHT'}`}</h1>
            <div className="screen-header-right">
              <span className="weather-badge">{phase === 'morning' ? '☀ 맑음' : '🌙 밤'}</span>
              <span className="weather-badge">⏱ {formatClock(matchSec)}</span>

              <div
                className="map-select"
                title="맵은 플레이어가 선택하지 않으며, 등록된 맵에서 캐릭터가 이동하면서 시뮬레이션이 진행됩니다."
              >
                <span className="map-select-label">🗺️</span>
                <div className="map-select-current">{activeMapName}</div>
              </div>
            </div>
          </div>

          {forbiddenNow.size ? (
            <div className="forbidden-banner">
              ⚠️ 금지구역: {Array.from(forbiddenNow).map((z) => getZoneName(z)).join(', ')}
            </div>
          ) : null}

          <div className="log-window" ref={logBoxRef}>
            {logs.map((log) => (
              <div key={log.id} className={`log-message ${log.type}`}>{log.text}</div>
            ))}          </div>

          <div className="control-panel">
            <div className="control-row">
              {isGameOver ? (
                <button className="btn-restart" onClick={() => window.location.reload()}>🔄 다시 하기</button>
              ) : (
                <button
                  className="btn-proceed"
                  onClick={proceedPhaseGuarded}
                  disabled={loading || isAdvancing || (day === 0 && survivors.length < 2)}
                  style={{ opacity: loading || isAdvancing || (day === 0 && survivors.length < 2) ? 0.5 : 1 }}
                >
                  {loading
                    ? '⏳ 로딩 중...'
                    : isAdvancing
                      ? '⏩ 진행 중...'
                      : survivors.length < 2 && day === 0
                        ? '⚠️ 인원 부족 (2명↑)'
                        : day === 0
                          ? '🔥 게임 시작'
                          : survivors.length <= 1
                            ? '🏆 결과 확인하기'
                            : phase === 'morning'
                              ? '🌙 밤으로 진행'
                              : '🌞 다음 날 아침으로 진행'}
                </button>
              )}

              <button
                className="btn-secondary"
                onClick={() => setShowMarketPanel((v) => !v)}
                title="관전자 모드에서는 기본적으로 숨겨두고, 테스트할 때만 열어쓰세요."
              >
                {showMarketPanel ? '🧪 패널 닫기' : '🧪 패널 열기'}
              </button>

              <button
                className="btn-secondary"
                onClick={() => setAutoPlay((v) => !v)}
                disabled={loading || isGameOver || (day === 0 && survivors.length < 2)}
                title="오토 플레이: 다음 페이즈 버튼을 자동으로 눌러 진행합니다(페이즈 내부는 틱 엔진으로 계산)."
              >
                {autoPlay ? '⏸ 오토' : '▶ 오토'}
              </button>

              <select
                className="autoplay-speed"
                value={autoSpeed}
                onChange={(e) => setAutoSpeed(Number(e.target.value))}
                disabled={loading || isGameOver}
                title="오토 플레이 배속(페이즈 간 템포)"
              >
                <option value={0.5}>x0.5</option>
                <option value={1}>x1</option>
                <option value={2}>x2</option>
                <option value={4}>x4</option>
              </select>
            </div>
          </div>
        </section>

        {/* 🧪 상점/조합/교환 패널 (테스트/디버그용, 기본 숨김) */}
        {showMarketPanel ? (
        <aside className="market-panel">
          <div className="market-header">
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 }}>
              <h2 style={{ margin: 0 }}>상점/조합/교환</h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>                <button className="market-close" onClick={() => setShowMarketPanel(false)} title="패널 닫기">✕</button>
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
            </div>

            <div className="market-tabs">
              <button className={`market-tab ${marketTab === 'craft' ? 'active' : ''}`} onClick={() => setMarketTab('craft')}>🛠️ 조합</button>
              <button className={`market-tab ${marketTab === 'kiosk' ? 'active' : ''}`} onClick={() => setMarketTab('kiosk')}>🏪 키오스크</button>
              <button className={`market-tab ${marketTab === 'drone' ? 'active' : ''}`} onClick={() => setMarketTab('drone')}>🚁 드론</button>
              <button className={`market-tab ${marketTab === 'trade' ? 'active' : ''}`} onClick={() => setMarketTab('trade')}>🔁 교환</button>
            </div>

            {marketMessage ? (
              <div className="market-card" style={{ borderColor: '#ffcdd2', background: '#fff5f5' }}>
                <div style={{ fontWeight: 800, color: '#c62828' }}>알림</div>
                <div className="market-small" style={{ marginTop: 6, color: '#c62828' }}>{marketMessage}</div>
              </div>
            ) : null}
          </div>

          {marketTab === 'craft' ? (
            <div className="market-section">
              <div className="market-small" style={{ marginBottom: 8 }}>레시피가 있는 아이템만 표시됩니다.</div>
              {craftables.length === 0 ? (
                <div className="market-card">조합 가능한 아이템이 없습니다. (관리자에서 레시피를 등록하세요)</div>
              ) : (
                craftables.map((it) => (
                  <div key={it._id} className="market-card">
                    <div className="market-row">
                      <div>
                        <div className="market-title">{it.name}</div>
                        <div className="market-small">tier {it.tier || 1} · {it.rarity || 'common'} · 비용 {Number(it?.recipe?.creditsCost || 0)} Cr</div>
                      </div>
                    </div>

                    <div className="market-small" style={{ marginTop: 8 }}>
                      재료: {(it.recipe.ingredients || []).map((ing) => {
                        const ingId = String(ing.itemId);
                        const ingName = itemNameById[ingId] || ingId;
                        return `${ingName} x${Number(ing.qty || 1)}`;
                      }).join(', ')}
                    </div>

                    <div className="market-actions" style={{ marginTop: 10 }}>
                      <input
                        type="number"
                        min={1}
                        value={getQty(`craft:${it._id}`, 1)}
                        onChange={(e) => setQty(`craft:${it._id}`, e.target.value)}
                      />
                      <button onClick={() => doCraft(it._id)} disabled={!selectedCharId}>조합</button>
                    </div>
                  </div>
                ))
              )}
            </div>
          ) : null}

          {marketTab === 'kiosk' ? (
            <div className="market-section">
              {kiosks.length === 0 ? (
                <div className="market-card">키오스크가 없습니다. (관리자에서 키오스크/카탈로그를 등록하세요)</div>
              ) : (
                kiosks.map((k) => (
                  <div key={k._id} className="market-card">
                    <div className="market-row">
                      <div>
                        <div className="market-title">{k.name || '키오스크'}</div>
                        <div className="market-small">위치: {k.mapId?.name || '미지정'}</div>
                      </div>
                      <button onClick={() => loadMarket()} className="market-mini-btn">새로고침</button>
                    </div>

                    <div style={{ marginTop: 10 }}>
                      {(Array.isArray(k.catalog) ? k.catalog : []).map((entry, idx) => {
                        const mode = entry.mode || 'sell';
                        const label = mode === 'sell' ? '구매' : mode === 'buy' ? '판매' : '교환';
                        const price = Math.max(0, Number(entry.priceCredits || 0));

                        const itemId = entry.itemId?._id || entry.itemId;
                        const itemName = entry.itemId?.name || itemNameById.get(String(itemId)) || String(itemId);

                        const exId = entry.exchange?.giveItemId?._id || entry.exchange?.giveItemId;
                        const exName = entry.exchange?.giveItemId?.name || (exId ? (itemNameById.get(String(exId)) || String(exId)) : '');
                        const exQty = Number(entry.exchange?.giveQty || 1);

                        return (
                          <div key={idx} className="market-subcard">
                            <div className="market-row">
                              <div>
                                <div className="market-title">{label}: {itemName}</div>
                                <div className="market-small">
                                  {mode === 'exchange'
                                    ? `재료: ${exName || '미지정'} x${exQty}`
                                    : `단가: ${price} Cr`}
                                </div>
                              </div>
                            </div>

                            <div className="market-actions" style={{ marginTop: 8 }}>
                              <input
                                type="number"
                                min={1}
                                value={getQty(`kiosk:${k._id}:${idx}`, 1)}
                                onChange={(e) => setQty(`kiosk:${k._id}:${idx}`, e.target.value)}
                              />
                              <button onClick={() => doKioskTransaction(k._id, idx)} disabled={!selectedCharId}>실행</button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))
              )}
            </div>
          ) : null}

          {marketTab === 'drone' ? (
            <div className="market-section">
              {droneOffers.length === 0 ? (
                <div className="market-card">드론 판매 목록이 없습니다. (관리자에서 드론 판매를 등록하세요)</div>
              ) : (
                droneOffers.map((o) => (
                  <div key={o._id} className="market-card">
                    <div className="market-row">
                      <div>
                        <div className="market-title">{o.itemId?.name || '아이템'}</div>
                        <div className="market-small">가격: {Math.max(0, Number(o.priceCredits || 0))} Cr · 티어 제한 ≤ {Number(o.maxTier || 1)}</div>
                      </div>
                      <button onClick={() => loadMarket()} className="market-mini-btn">새로고침</button>
                    </div>
                    <div className="market-actions" style={{ marginTop: 10 }}>
                      <input
                        type="number"
                        min={1}
                        value={getQty(`drone:${o._id}`, 1)}
                        onChange={(e) => setQty(`drone:${o._id}`, e.target.value)}
                      />
                      <button onClick={() => doDroneBuy(o._id)} disabled={!selectedCharId}>구매</button>
                    </div>
                  </div>
                ))
              )}
            </div>
          ) : null}

          {marketTab === 'trade' ? (
            <div className="market-section">
              <div className="market-row" style={{ marginBottom: 8 }}>
                <div className="market-small">오픈 오퍼</div>
                <button onClick={loadTrades} className="market-mini-btn">새로고침</button>
              </div>

              {tradeOffers.length === 0 ? (
                <div className="market-card">현재 오픈 오퍼가 없습니다.</div>
              ) : (
                tradeOffers.map((off) => (
                  <div key={off._id} className="market-card">
                    <div className="market-title">{off.fromCharacterId?.name || '상대'}의 오퍼</div>
                    <div className="market-small" style={{ marginTop: 6 }}>
                      주는 것: {(Array.isArray(off.give) ? off.give : []).map((g) => `${g.itemId?.name || g.itemId} x${g.qty}`).join(', ')}
                    </div>
                    <div className="market-small" style={{ marginTop: 4 }}>
                      원하는 것: {(Array.isArray(off.want) ? off.want : []).length
                        ? (Array.isArray(off.want) ? off.want : []).map((w) => `${w.itemId?.name || w.itemId} x${w.qty}`).join(', ')
                        : '없음'}
                      {Number(off.wantCredits || 0) > 0 ? ` + ${Number(off.wantCredits)} Cr` : ''}
                    </div>
                    {off.note ? <div className="market-small" style={{ marginTop: 6 }}>메모: {off.note}</div> : null}

                    <div className="market-actions" style={{ marginTop: 10 }}>
                      <button onClick={() => acceptTradeOffer(off._id)} disabled={!selectedCharId}>수락</button>
                    </div>
                  </div>
                ))
              )}

              <div className="market-row" style={{ marginTop: 16, marginBottom: 8 }}>
                <div className="market-small">내 오퍼</div>
                <button onClick={loadTrades} className="market-mini-btn">새로고침</button>
              </div>

              {myTradeOffers.length === 0 ? (
                <div className="market-card">내 오퍼가 없습니다.</div>
              ) : (
                myTradeOffers.map((off) => (
                  <div key={off._id} className="market-card">
                    <div className="market-title">상태: {off.status}</div>
                    <div className="market-small" style={{ marginTop: 6 }}>
                      주는 것: {(Array.isArray(off.give) ? off.give : []).map((g) => `${g.itemId?.name || g.itemId} x${g.qty}`).join(', ')}
                    </div>
                    <div className="market-small" style={{ marginTop: 4 }}>
                      원하는 것: {(Array.isArray(off.want) ? off.want : []).length
                        ? (Array.isArray(off.want) ? off.want : []).map((w) => `${w.itemId?.name || w.itemId} x${w.qty}`).join(', ')
                        : '없음'}
                      {Number(off.wantCredits || 0) > 0 ? ` + ${Number(off.wantCredits)} Cr` : ''}
                    </div>
                    <div className="market-actions" style={{ marginTop: 10 }}>
                      {off.status === 'open' ? (
                        <button onClick={() => cancelTradeOffer(off._id)}>취소</button>
                      ) : null}
                    </div>
                  </div>
                ))
              )}

              <div className="market-card" style={{ marginTop: 18 }}>
                <div className="market-title">오퍼 생성</div>
                <div className="market-small" style={{ marginTop: 6 }}>선택한 캐릭터 인벤토리에서 give를 고르고, 원하는 아이템/크레딧을 설정하세요.</div>

                <div style={{ marginTop: 12 }}>
                  <div className="market-small" style={{ fontWeight: 800 }}>주는 것 (give)</div>
                  {(Array.isArray(tradeDraft.give) ? tradeDraft.give : []).map((row, idx) => (
                    <div key={idx} className="market-row" style={{ marginTop: 8, gap: 8 }}>
                      <select
                        value={row.itemId}
                        onChange={(e) => {
                          const next = [...tradeDraft.give];
                          next[idx] = { ...next[idx], itemId: e.target.value };
                          setTradeDraft({ ...tradeDraft, give: next });
                        }}
                        style={{ flex: 1 }}
                      >
                        <option value="">(선택)</option>
                        {inventoryOptions.map((it) => (
                          <option key={it.itemId} value={it.itemId}>{it.name} (보유 {it.qty})</option>
                        ))}
                      </select>
                      <input
                        type="number"
                        min={1}
                        value={row.qty}
                        onChange={(e) => {
                          const next = [...tradeDraft.give];
                          next[idx] = { ...next[idx], qty: e.target.value };
                          setTradeDraft({ ...tradeDraft, give: next });
                        }}
                        style={{ width: 70 }}
                      />
                      <button
                        className="market-mini-btn"
                        onClick={() => {
                          const next = tradeDraft.give.filter((_, i) => i !== idx);
                          setTradeDraft({ ...tradeDraft, give: next.length ? next : [{ itemId: '', qty: 1 }] });
                        }}
                      >
                        삭제
                      </button>
                    </div>
                  ))}
                  <button
                    className="market-mini-btn"
                    style={{ marginTop: 8 }}
                    onClick={() => setTradeDraft({ ...tradeDraft, give: [...tradeDraft.give, { itemId: '', qty: 1 }] })}
                  >
                    + give 추가
                  </button>
                </div>

                <div style={{ marginTop: 14 }}>
                  <div className="market-small" style={{ fontWeight: 800 }}>원하는 것 (want)</div>
                  {(Array.isArray(tradeDraft.want) ? tradeDraft.want : []).map((row, idx) => (
                    <div key={idx} className="market-row" style={{ marginTop: 8, gap: 8 }}>
                      <select
                        value={row.itemId}
                        onChange={(e) => {
                          const next = [...tradeDraft.want];
                          next[idx] = { ...next[idx], itemId: e.target.value };
                          setTradeDraft({ ...tradeDraft, want: next });
                        }}
                        style={{ flex: 1 }}
                      >
                        <option value="">(선택 안 함)</option>
                        {publicItems.map((it) => (
                          <option key={it._id} value={it._id}>{it.name} (tier {it.tier || 1})</option>
                        ))}
                      </select>
                      <input
                        type="number"
                        min={1}
                        value={row.qty}
                        onChange={(e) => {
                          const next = [...tradeDraft.want];
                          next[idx] = { ...next[idx], qty: e.target.value };
                          setTradeDraft({ ...tradeDraft, want: next });
                        }}
                        style={{ width: 70 }}
                      />
                      <button
                        className="market-mini-btn"
                        onClick={() => {
                          const next = tradeDraft.want.filter((_, i) => i !== idx);
                          setTradeDraft({ ...tradeDraft, want: next.length ? next : [{ itemId: '', qty: 1 }] });
                        }}
                      >
                        삭제
                      </button>
                    </div>
                  ))}
                  <button
                    className="market-mini-btn"
                    style={{ marginTop: 8 }}
                    onClick={() => setTradeDraft({ ...tradeDraft, want: [...tradeDraft.want, { itemId: '', qty: 1 }] })}
                  >
                    + want 추가
                  </button>
                </div>

                <div className="market-row" style={{ marginTop: 12, gap: 8 }}>
                  <div className="market-small" style={{ flex: 1 }}>추가 크레딧 요청</div>
                  <input
                    type="number"
                    min={0}
                    value={tradeDraft.wantCredits}
                    onChange={(e) => setTradeDraft({ ...tradeDraft, wantCredits: e.target.value })}
                    style={{ width: 120 }}
                  />
                </div>

                <div className="market-row" style={{ marginTop: 10 }}>
                  <textarea
                    value={tradeDraft.note}
                    onChange={(e) => setTradeDraft({ ...tradeDraft, note: e.target.value })}
                    placeholder="메모(선택)"
                    style={{ width: '100%', minHeight: 64 }}
                  />
                </div>

                <div className="market-actions" style={{ marginTop: 10 }}>
                  <button onClick={createTradeOffer} disabled={!selectedCharId}>오퍼 생성</button>
                </div>
              </div>
            </div>
          ) : null}
        </aside>
        ) : null}
      </div>

      {/* 결과 모달창 */}
      {showResultModal && (
        <div className="result-modal-overlay">
          <div className="result-modal">
            <h1>🏆 게임 종료 🏆</h1>
            {winner ? (
              <div className="winner-section">
                <img src={winner.previewImage} alt="우승자" className="winner-img" />
                <h2>{winner.name}</h2>
                <p>최후의 1인! 생존을 축하합니다!</p>
              </div>
            ) : (
              <h2>생존자가 없습니다...</h2>
            )}

            <div className="stats-summary">
              <h3>⚔️ 킬 랭킹 (Top 3)</h3>
              <ul>
                {[...survivors, ...dead]
                  .sort((a, b) => (killCounts[b._id] || 0) - (killCounts[a._id] || 0))
                  .slice(0, 3)
                  .map((char, idx) => (
                    <li key={char._id}>
                      <span>{idx + 1}위. {char.name}</span>
                      <strong>{killCounts[char._id] || 0} 킬</strong>
                    </li>
                  ))}
              </ul>
            </div>
            <button className="close-btn" onClick={() => setShowResultModal(false)}>닫기</button>
          </div>
        </div>
      )}
    </main>
  );
}
