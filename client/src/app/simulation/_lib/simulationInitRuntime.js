import { apiGet, apiGetCached, clearAuth } from '../../../utils/api';

let loginRedirectInFlight = false;

function getApiErrorMessage(err, fallback = '요청 실패') {
  return String(err?.response?.data?.error || err?.response?.data?.message || err?.message || fallback);
}

function getSettledValue(result, fallback = null) {
  if (result?.status !== 'fulfilled') return fallback;
  return result.value ?? fallback;
}

function getSettledArray(result) {
  const value = getSettledValue(result, []);
  return Array.isArray(value) ? value : [];
}

function settleWithin(promise, timeoutMs) {
  const ms = Math.max(100, Number(timeoutMs || 1000));
  return new Promise((resolve) => {
    let settled = false;
    const timer = window.setTimeout(() => {
      if (settled) return;
      settled = true;
      resolve({ status: 'timeout', value: [] });
    }, ms);

    Promise.resolve(promise)
      .then((value) => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timer);
        resolve({ status: 'fulfilled', value });
      })
      .catch((reason) => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timer);
        resolve({ status: 'rejected', reason });
      });
  });
}

function getRejectedLabels(pairs) {
  return pairs
    .filter(([, result]) => result?.status === 'rejected')
    .map(([label]) => label);
}

function redirectToLogin(message = '로그인이 필요한 기능입니다. 로그인 페이지로 이동합니다.', shouldClearAuth = false) {
  if (typeof window === 'undefined' || loginRedirectInFlight || window.location.pathname === '/login') return false;
  loginRedirectInFlight = true;
  if (shouldClearAuth) clearAuth();
  alert(message);
  window.location.replace('/login');
  return true;
}

function formatInitLoadError(err) {
  const status = Number(err?.response?.status || 0);
  const requestUrl = String(err?.requestUrl || '');
  const path = requestUrl ? requestUrl.replace(/^https?:\/\/[^/]+/i, '') : '';
  const label = path ? ` (${path})` : '';
  const msg = String(err?.message || err?.originalMessage || '').trim();

  if (err?.code === 'ERR_NETWORK' || /network error/i.test(msg)) {
    return `⚠️ 서버에 연결하지 못했습니다${label}. server 실행 상태와 API 주소를 확인해주세요.`;
  }
  if (status === 404) {
    return `⚠️ 필요한 API를 찾지 못했습니다${label}. API_BASE 또는 서버 라우트를 확인해주세요.`;
  }
  if (status >= 500) {
    return `⚠️ 서버 내부 오류로 초기 데이터를 불러오지 못했습니다${label}. 서버 로그를 확인해주세요.`;
  }
  if (status > 0) {
    return `⚠️ 초기 데이터 로드에 실패했습니다${label}. (${status}) ${msg || '요청 실패'}`;
  }
  return `⚠️ 초기 데이터 로드에 실패했습니다. ${msg || '알 수 없는 오류'}`;
}

async function loadMarketData() {
  const [itemsRes, kiosksRes, droneRes, perksRes] = await Promise.allSettled([
    apiGetCached('/public/items', { ttlMs: 60000, timeoutMs: 20000 }),
    apiGetCached('/public/kiosks', { ttlMs: 60000, timeoutMs: 20000 }),
    apiGetCached('/public/drone-offers', { ttlMs: 60000, timeoutMs: 20000 }),
    apiGetCached('/public/perks', { ttlMs: 60000, timeoutMs: 20000 }),
  ]);

  return {
    publicItems: getSettledArray(itemsRes),
    kiosks: getSettledArray(kiosksRes),
    droneOffers: getSettledArray(droneRes),
    publicPerks: getSettledArray(perksRes),
    failedLabels: getRejectedLabels([
      ['아이템', itemsRes],
      ['키오스크', kiosksRes],
      ['드론 판매', droneRes],
      ['특전', perksRes],
    ]),
  };
}

async function loadTradeData() {
  const [open, mine] = await Promise.allSettled([
    apiGet('/trades'),
    apiGet('/trades?mine=true'),
  ]);

  return {
    tradeOffers: getSettledArray(open),
    myTradeOffers: getSettledArray(mine),
    failedLabels: getRejectedLabels([
      ['오픈 오퍼', open],
      ['내 오퍼', mine],
    ]),
  };
}

export {
  formatInitLoadError,
  getApiErrorMessage,
  getRejectedLabels,
  getSettledArray,
  getSettledValue,
  loadMarketData,
  loadTradeData,
  redirectToLogin,
  settleWithin,
};
