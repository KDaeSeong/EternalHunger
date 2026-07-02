import { useEffect, useRef } from 'react';
import { INIT_API_TIMEOUT_MS, apiGet, apiGetCached, getToken, getUser, updateStoredUser } from '../../../utils/api';
import { getMatchConfig, normalizeMatchMode } from './matchRosterRuntime';
import { applyUserEconomyProgressToState } from './marketStateRuntime';
import {
  RANDOM_PARTICIPANT_PRESET_ID,
  getInitialParticipantPresetId,
  readLocalParticipantPresets,
} from './participantPresetRuntime';
import {
  buildInitialSimulationRoster,
  enrichInitialRoutePlansForItems,
} from './simulationInitialRosterRuntime';
import {
  formatInitLoadError,
  getApiErrorMessage,
  getRejectedLabels,
  getSettledArray,
  getSettledValue,
  redirectToLogin,
  settleWithin,
} from './simulationInitRuntime';

const SIM_INIT_PING_TIMEOUT_MS = 5000;
const SIM_INIT_REQUIRED_TIMEOUT_MS = Math.min(INIT_API_TIMEOUT_MS, 12000);
const SIM_INIT_HEAVY_TIMEOUT_MS = Math.min(INIT_API_TIMEOUT_MS, 18000);
const SIM_INIT_ITEMS_GRACE_MS = 2500;

export function useSimulationInitialData({
  refs = {},
  helpers = {},
  actions = {},
} = {}) {
  const hasInitialized = useRef(false);
  const { activeMapRef, mapsRef } = refs;
  const { addLog, applyActiveMapId, getDefaultSimulationSettings } = helpers;
  const {
    setAssistCounts,
    setCandidateSurvivors,
    setCredits,
    setDroneOffers,
    setGameEndReason,
    setIsGameOver,
    setKiosks,
    setKillCounts,
    setLoading,
    setMaps,
    setMarketMessage,
    setMatchSec,
    setMyTradeOffers,
    setParticipantPresetName,
    setParticipantPresets,
    setPrevPhaseLogs,
    setPublicItems,
    setPublicPerks,
    setResultSummary,
    setSelectedParticipantPresetId,
    setSettings,
    setShowResultModal,
    setSurvivors,
    setTradeOffers,
    setViewerLp,
    setViewerPerks,
    setWinner,
  } = actions;

  // 초기 데이터 로드 (캐릭터 + 이벤트 + 설정 + 상점 데이터)
  useEffect(() => {
    const token = getToken();
    const me = getUser();
    if (!token || !me?.username) {
      redirectToLogin('로그인 정보가 없거나 만료되었습니다. 다시 로그인해주세요.', true);
      return;
    }

    if (hasInitialized.current) return;
    hasInitialized.current = true;

    const fetchData = async () => {
      try {
        void apiGet('/public/ping', { timeoutMs: SIM_INIT_PING_TIMEOUT_MS })
          .catch((pingErr) => {
            console.warn('[simulation:initPing]', pingErr);
          });

        const itemsLoadPromise = apiGetCached('/public/items', { ttlMs: 60000, timeoutMs: SIM_INIT_HEAVY_TIMEOUT_MS });
        const [criticalResults, quickItemsRes] = await Promise.all([
          Promise.allSettled([
            apiGetCached('/characters?view=simulation', { ttlMs: 8000, timeoutMs: SIM_INIT_REQUIRED_TIMEOUT_MS }),
            apiGetCached('/settings', { ttlMs: 8000, timeoutMs: SIM_INIT_REQUIRED_TIMEOUT_MS }),
            apiGetCached('/user/me', { ttlMs: 8000, timeoutMs: SIM_INIT_REQUIRED_TIMEOUT_MS }),
            apiGetCached('/public/maps', { ttlMs: 60000, timeoutMs: SIM_INIT_REQUIRED_TIMEOUT_MS }),
            apiGetCached('/public/perks', { ttlMs: 60000, timeoutMs: SIM_INIT_REQUIRED_TIMEOUT_MS }),
          ]),
          settleWithin(itemsLoadPromise, SIM_INIT_ITEMS_GRACE_MS),
        ]);
        const [charRes, settingRes, meRes, mapsRes, perksRes] = criticalResults;

        const authRejected = [charRes, settingRes, meRes, mapsRes, perksRes].some((result) => {
          const status = Number(result?.reason?.response?.status || result?.reason?.status || 0);
          return result?.status === 'rejected' && (status === 401 || status === 403);
        });
        if (authRejected) {
          redirectToLogin('세션이 만료되었습니다. 다시 로그인해주세요.', true);
          return;
        }

        const charList = getSettledArray(charRes);
        const settingValue = getSettledValue(settingRes, {});
        const meValue = getSettledValue(meRes, {});
        const mapsList = getSettledArray(mapsRes);
        const itemsValue = getSettledArray(quickItemsRes);
        const perksValue = getSettledArray(perksRes);

        const initFailed = getRejectedLabels([
          ['캐릭터', charRes],
          ['설정', settingRes],
          ['유저 정보', meRes],
          ['맵', mapsRes],
          ['특전', perksRes],
        ]);
        if (initFailed.length) {
          addLog(`⚠️ 초기 데이터 일부 로드 실패: ${initFailed.join(', ')}. 가능한 기본값으로 계속합니다.`, 'system');
        }
        if (!charList.length) {
          addLog('⚠️ 캐릭터 목록이 비어 있습니다. 캐릭터 설정을 확인해주세요.', 'system');
        }
        if (!mapsList.length) {
          addLog('⚠️ 맵 데이터를 불러오지 못했습니다. 임시 기본 구역으로 대기합니다.', 'system');
        }

        const itemsList = Array.isArray(itemsValue) ? itemsValue : [];
        const perksList = Array.isArray(perksValue) ? perksValue : [];

        const loadDeferredInitData = () => {
          void Promise.allSettled([
            apiGetCached('/public/kiosks', { ttlMs: 60000, timeoutMs: 20000 }),
            apiGetCached('/public/drone-offers', { ttlMs: 60000, timeoutMs: 20000 }),
            apiGet('/trades', { timeoutMs: 20000 }),
            apiGet('/trades?mine=true', { timeoutMs: 20000 }),
          ]).then(([kiosksRes, droneRes, openTrades, mineTrades]) => {
            setKiosks(getSettledArray(kiosksRes));
            setDroneOffers(getSettledArray(droneRes));
            setTradeOffers(getSettledArray(openTrades));
            setMyTradeOffers(getSettledArray(mineTrades));

            const failed = getRejectedLabels([
              ['키오스크', kiosksRes],
              ['드론 판매', droneRes],
              ['오픈 오퍼', openTrades],
              ['내 오퍼', mineTrades],
            ]);
            if (failed.length) setMarketMessage(`${failed.join(', ')} 로드 실패`);
          }).catch((err) => {
            console.error('[simulation:deferredData]', err);
            setMarketMessage(getApiErrorMessage(err, '보조 데이터 로드 실패'));
          });
        };

        const storedMatchMode = (() => {
          try {
            return window.localStorage.getItem('eh_sim_match_mode');
          } catch {
            return '';
          }
        })();
        const storedCharacterSkills = (() => {
          try {
            return window.localStorage.getItem('eh_sim_character_skills');
          } catch {
            return '';
          }
        })();
        const storedCharacterSkillSettings = storedCharacterSkills === '0' || storedCharacterSkills === '1'
          ? {
              skills: {
                ...(settingValue?.skills || {}),
                enabled: storedCharacterSkills === '1',
                characterSkills: storedCharacterSkills === '1',
                aiUseSkills: storedCharacterSkills === '1',
              },
            }
          : {};
        const defaultSettings = getDefaultSimulationSettings();
        const initParticipantPresets = readLocalParticipantPresets();
        const initSelectedParticipantPresetIdRaw = getInitialParticipantPresetId();
        const initSelectedParticipantPresetId = initSelectedParticipantPresetIdRaw !== RANDOM_PARTICIPANT_PRESET_ID
          && initParticipantPresets.some((preset) => String(preset?.id || '') === String(initSelectedParticipantPresetIdRaw))
          ? String(initSelectedParticipantPresetIdRaw)
          : RANDOM_PARTICIPANT_PRESET_ID;
        const initSelectedParticipantPresetName = initSelectedParticipantPresetId === RANDOM_PARTICIPANT_PRESET_ID
          ? ''
          : (initParticipantPresets.find((preset) => String(preset?.id || '') === initSelectedParticipantPresetId)?.name || '');
        const loadedSettings = {
          ...defaultSettings,
          ...(settingValue || {}),
          ...storedCharacterSkillSettings,
          matchMode: normalizeMatchMode(storedMatchMode || settingValue?.matchMode || defaultSettings.matchMode),
        };
        setSettings(loadedSettings);
        setParticipantPresets(initParticipantPresets);
        setSelectedParticipantPresetId(initSelectedParticipantPresetId);
        setParticipantPresetName(initSelectedParticipantPresetName);
        setPublicPerks(perksList);
        applyUserEconomyProgressToState({
          credits: meValue?.credits,
          lp: meValue?.lp,
          perks: Array.isArray(meValue?.perks) ? meValue.perks : undefined,
        }, {
          setCredits,
          setViewerLp,
          setViewerPerks,
        });

        mapsRef.current = mapsList;
        setMaps(mapsList);
// ✅ 시뮬레이션은 "플레이어가 맵을 선택"하지 않습니다.
// 등록된 맵 중 첫 번째 맵을 시작점으로 사용합니다. (이동/진행 로직은 런타임에서 처리)
        const initialMapId = (mapsList[0]?._id ? String(mapsList[0]._id) : '');
        if (initialMapId) {
          applyActiveMapId(initialMapId);
        }

        const initialMap = mapsList.find((m) => String(m?._id) === String(initialMapId)) || null;
        activeMapRef.current = initialMap;
        const initialZoneIds = (Array.isArray(initialMap?.zones) && initialMap.zones.length)
          ? initialMap.zones.map((z) => String(z.zoneId))
          : ['__default__'];

        // 🎮 룰 프리셋에 따라 생존자 런타임 상태를 초기화
        const applyLoadedItemsToRuntime = (loadedItems, reason = 'background') => {
          const nextItems = Array.isArray(loadedItems) ? loadedItems : [];
          if (!nextItems.length) return false;
          setPublicItems(nextItems);
          const enrichList = (list) => enrichInitialRoutePlansForItems({
            list,
            routeItems: nextItems,
            initialMap,
          });
          setCandidateSurvivors((prev) => enrichList(prev));
          setSurvivors((prev) => enrichList(prev));
          if (reason === 'background') {
            addLog(`📦 아이템 데이터 로드 완료: ${nextItems.length}개. 참가자 루트 파밍을 보강했습니다.`, 'system');
          }
          return true;
        };

        const { candidateChars, shuffledChars } = buildInitialSimulationRoster({
          charList,
          routeItems: itemsList,
          initialMap,
          initialZoneIds,
          loadedSettings,
          participantPresets: initParticipantPresets,
          selectedParticipantPresetId: initSelectedParticipantPresetId,
          viewerPerks: Array.isArray(meValue?.perks) ? meValue.perks : [],
          publicPerks: perksList,
        });
        setCandidateSurvivors(candidateChars);
        setSurvivors(shuffledChars);

        // 킬 카운트 초기화
        const initialKills = {};
        shuffledChars.forEach((c) => {
          initialKills[c._id] = 0;
        });
        setKillCounts(initialKills);

        // 어시스트 카운트 초기화
        const initialAssists = {};
        const shouldTrackAssists = getMatchConfig(loadedSettings).matchMode !== 'solo';
        shuffledChars.forEach((c) => {
          if (shouldTrackAssists) initialAssists[c._id] = 0;
        });
        setAssistCounts(initialAssists);

        const initialCredits = Number(meValue?.credits || 0);
        setCredits(initialCredits);
        updateStoredUser((currentUser) => ({ ...currentUser, credits: initialCredits }));
        setPublicItems(itemsList);
        setPublicPerks(perksList);
        setKiosks([]);
        setDroneOffers([]);
        setTradeOffers([]);
        setMyTradeOffers([]);

        // 경기 시간도 초기화
        setMatchSec(0);
        setPrevPhaseLogs([]);
        setIsGameOver(false);
        setWinner(null);
        setGameEndReason(null);
        setResultSummary(null);
        setShowResultModal(false);

        addLog('📢 선수들이 경기장에 입장했습니다. 잠시 후 게임이 시작됩니다.', 'system');
        loadDeferredInitData();
        if (quickItemsRes?.status === 'timeout') {
          addLog('⏳ 아이템 데이터 로드가 늦어져 기본 배치로 먼저 준비했습니다. 도착하면 루트 파밍을 자동 보강합니다.', 'system');
          itemsLoadPromise
            .then((loadedItems) => {
              applyLoadedItemsToRuntime(loadedItems, 'background');
            })
            .catch((itemsErr) => {
              console.warn('[simulation:initItems.background]', itemsErr);
              addLog(`⚠️ 아이템 데이터 백그라운드 로드 실패: ${getApiErrorMessage(itemsErr)}`, 'system');
            });
        } else if (quickItemsRes?.status === 'rejected') {
          const itemErr = quickItemsRes.reason;
          console.warn('[simulation:initItems.quick]', itemErr);
          addLog(`⚠️ 아이템 데이터 로드 실패: ${getApiErrorMessage(itemErr)}. 기본 배치로 계속합니다.`, 'system');
        }
      } catch (err) {
        console.error('데이터 로드 실패:', err);
        const status = Number(err?.response?.status || 0);
        if (status === 401 || status === 403) {
          redirectToLogin('세션이 만료되었습니다. 다시 로그인해주세요.', true);
          return;
        }
        addLog(formatInitLoadError(err), 'death');
      } finally {
        setLoading(false);
      }
    };

    void fetchData().catch((err) => {
      console.error('[simulation:fetchData.unhandled]', err);
      addLog(formatInitLoadError(err), 'death');
      setLoading(false);
    });
  }, [
    activeMapRef,
    addLog,
    applyActiveMapId,
    getDefaultSimulationSettings,
    hasInitialized,
    mapsRef,
    setAssistCounts,
    setCandidateSurvivors,
    setCredits,
    setDroneOffers,
    setGameEndReason,
    setIsGameOver,
    setKillCounts,
    setKiosks,
    setLoading,
    setMaps,
    setMarketMessage,
    setMatchSec,
    setMyTradeOffers,
    setParticipantPresetName,
    setParticipantPresets,
    setPrevPhaseLogs,
    setPublicItems,
    setPublicPerks,
    setResultSummary,
    setSelectedParticipantPresetId,
    setSettings,
    setShowResultModal,
    setSurvivors,
    setTradeOffers,
    setViewerLp,
    setViewerPerks,
    setWinner,
  ]);
}
