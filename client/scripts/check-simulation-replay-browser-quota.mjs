/*
 * Destructive browser-gate driver. It never starts Chrome, a server, or a
 * profile; the owner must provide EH_CDP_HTTP and EH_QUOTA_ORIGIN.
 */
const cdpHttp = process.env.EH_CDP_HTTP;
const origin = process.env.EH_QUOTA_ORIGIN;
const timeoutMs = Number(process.env.EH_QUOTA_TIMEOUT_MS || 900000);
if (!cdpHttp || !origin) throw new Error('EH_CDP_HTTP와 EH_QUOTA_ORIGIN을 함께 지정하세요. 예: EH_CDP_HTTP=http://127.0.0.1:9333');
const deadline = Date.now() + timeoutMs;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
function remaining(label) { const left = deadline - Date.now(); if (left <= 0) throw new Error(`${label}: 전체 timeout ${timeoutMs}ms 초과`); return left; }

class CdpPage {
  constructor(info) { this.info = info; this.socket = null; this.nextId = 0; this.pending = new Map(); }
  async connect() {
    this.socket = new WebSocket(this.info.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => { this.socket.addEventListener('open', resolve, { once: true }); this.socket.addEventListener('error', reject, { once: true }); });
    this.socket.addEventListener('message', (event) => { const data = JSON.parse(event.data); const job = this.pending.get(data.id); if (!job) return; this.pending.delete(data.id); if (data.error) job.reject(new Error(`${data.error.code}: ${data.error.message}`)); else job.resolve(data.result); });
    return this;
  }
  send(method, params = {}) { const id = ++this.nextId; return new Promise((resolve, reject) => { this.pending.set(id, { resolve, reject }); this.socket.send(JSON.stringify({ id, method, params })); }); }
  async evaluate(expression) { const result = await this.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true, userGesture: true }); if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text || 'Runtime.evaluate 실패'); return result.result?.value; }
  close() { this.socket?.close(); }
}

async function pages() { const response = await fetch(`${cdpHttp.replace(/\/$/, '')}/json/list`); if (!response.ok) throw new Error(`CDP /json/list HTTP ${response.status}`); return response.json(); }
async function pageFor(url = origin) { const found = (await pages()).find((item) => item.type === 'page' && item.url.startsWith(url)); if (!found) throw new Error(`CDP 페이지를 찾지 못했습니다: ${url}`); return new CdpPage(found).connect(); }
async function createPage(url) {
  const version = await (await fetch(`${cdpHttp.replace(/\/$/, '')}/json/version`)).json();
  const browser = await new CdpPage({ webSocketDebuggerUrl: version.webSocketDebuggerUrl }).connect();
  const { targetId } = await browser.send('Target.createTarget', { url });
  const until = Date.now() + Math.min(30000, remaining('삭제 탭 열기'));
  let info;
  while (!info && Date.now() < until) { info = (await pages()).find((item) => item.type === 'page' && (item.id === targetId || item.targetId === targetId)); if (!info) await sleep(300); }
  if (!info) { browser.close(); throw new Error(`CDP Target.createTarget 페이지를 찾지 못했습니다: ${targetId}`); }
  const page = await new CdpPage(info).connect();
  page.closeAsync = async () => {
    page.close();
    const closeRequest = browser.send('Target.closeTarget', { targetId }).catch(() => {});
    await Promise.race([closeRequest, sleep(2000)]);
    browser.close();
  };
  return page;
}
async function waitFor(page, predicate, label) { while (true) { remaining(label); if (await page.evaluate(predicate)) return; await sleep(500); } }
async function clickText(page, text, label = text) { const clicked = await page.evaluate(`(() => { const nodes=[...document.querySelectorAll('button,[role="button"]')]; const node=nodes.find((n)=>!n.disabled && n.innerText.trim()==='${text.replaceAll("'", "\\'")}'); if(!node)return false; node.click(); return true; })()`); if (!clicked) throw new Error(`${label} 버튼을 찾지 못했거나 비활성입니다.`); }
async function clickContains(page, text, label = text) { const clicked = await page.evaluate(`(() => { const nodes=[...document.querySelectorAll('button,[role="button"]')]; const node=nodes.find((n)=>!n.disabled && n.innerText.includes('${text.replaceAll("'", "\\'")}')); if(!node)return false; node.click(); return true; })()`); if (!clicked) throw new Error(`${label} 버튼을 찾지 못했거나 비활성입니다.`); }
async function waitText(page, text, label = text) { await waitFor(page, `Boolean(document.body?.innerText.includes('${text.replaceAll("'", "\\'")}'))`, label); }
async function waitAnyText(page, texts, label) {
  await waitFor(page, `Boolean(document.body&&(${JSON.stringify(texts)}).some((text)=>document.body.innerText.includes(text)))`, label);
}
async function runIds(page) {
  return page.evaluate(`(async()=>{
    const dbName='eh_simulation_replays_v1';
    if(typeof indexedDB.databases==='function'){
      const databases=await indexedDB.databases();
      if(!databases.some((entry)=>entry.name===dbName))return [];
    }
    return new Promise((ok,no)=>{
      let db;
      const close=()=>{try{db?.close()}catch{}};
      const fail=(error)=>{close();no(error)};
      const q=indexedDB.open(dbName,1);
      q.onupgradeneeded=()=>{q.transaction?.abort();fail(new Error('기존 replay DB에 runs 저장소가 없습니다.'))};
      q.onerror=()=>fail(q.error);
      q.onsuccess=()=>{
        db=q.result;
        if(!db.objectStoreNames.contains('runs')){fail(new Error('replay DB의 runs 저장소가 없습니다.'));return}
        const tx=db.transaction('runs','readonly');
        const request=tx.objectStore('runs').getAllKeys();
        request.onsuccess=()=>{const ids=request.result.map(String);close();ok(ids)};
        request.onerror=()=>fail(request.error);
        tx.onabort=()=>fail(tx.error||new Error('replay key 조회 transaction이 취소되었습니다.'));
      };
    });
  })()`);
}
async function runSnapshots(page) {
  return page.evaluate(`(async()=>{
    let db;
    try{
      const records=await new Promise((ok,no)=>{
        const q=indexedDB.open('eh_simulation_replays_v1',1);
        q.onerror=()=>no(q.error);
        q.onsuccess=()=>{
          db=q.result;
          const request=db.transaction('runs','readonly').objectStore('runs').getAll();
          request.onsuccess=()=>ok(request.result);
          request.onerror=()=>no(request.error);
        };
      });
      return Promise.all(records.map(async(record)=>{
        const json=JSON.stringify(record);
        const bytes=new TextEncoder().encode(json);
        const digest=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map((value)=>value.toString(16).padStart(2,'0')).join('');
        return {id:String(record.id),bytes:bytes.byteLength,digest};
      }));
    }finally{db?.close()}
  })()`);
}
async function capturedFailedSnapshot(page) {
  return page.evaluate(`(async()=>{
    const json=globalThis.__ehQuotaFailedJson;
    const id=globalThis.__ehQuotaFailedId;
    if(!json||!id)return null;
    const bytes=new TextEncoder().encode(json);
    const digest=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map((value)=>value.toString(16).padStart(2,'0')).join('');
    return {id:String(id),bytes:bytes.byteLength,digest};
  })()`);
}
async function setX32(page) {
  const value = await page.evaluate(`(()=>{const s=[...document.querySelectorAll('select')].find((x)=>[...x.options].some((o)=>o.value==='32'));if(!s)throw Error('x32 배속 선택을 찾지 못했습니다.');s.value='32';s.dispatchEvent(new Event('change',{bubbles:true}));return s.value})()`);
  if (value !== '32') throw new Error(`x32 배속 선택이 반영되지 않았습니다: ${value}`);
}
async function finishActualGame(page, label) {
  await setX32(page);
  await clickText(page, '오토', `${label}: 오토 진행`);
  await clickText(page, '게임 시작', `${label}: 게임 시작`);
  await waitText(page, '게임 종료', `${label}: 실제 완주`);
}
async function changeOneDraftCondition(page) {
  const changed = await page.evaluate(`(()=>{
    const target=[...document.querySelectorAll('input[type="checkbox"]')].find((node)=>!node.disabled&&node.offsetParent!==null&&(node.closest('label')?.innerText||node.parentElement?.innerText||'').includes('캐릭터 스킬'));
    if(!target)throw Error('복사된 시작 조건에서 캐릭터 스킬 선택을 찾지 못했습니다.');
    const before=target.checked;
    target.click();
    return {kind:'characterSkills',before,after:target.checked};
  })()`);
  if (!changed || changed.before === changed.after) throw new Error(`조건 변경이 반영되지 않았습니다: ${JSON.stringify(changed)}`);
  return changed;
}
async function quota(page, quotaSize) { return page.send('Storage.overrideQuotaForOrigin', { origin, quotaSize }); }

let page;
let quotaOverridden = false;
try {
  page = await pageFor();
  await page.send('Runtime.enable');
  await waitText(page, '경기 보관함', '초기 게임 화면');
  await clickText(page, '경기 보관함', '빈 보관함 초기화');
  await waitText(page, '이 브라우저에 최근 10경기를 보관합니다.', '빈 보관함 로드');
  const initialIds = await runIds(page);
  if (initialIds.length !== 0) throw new Error(`fresh live-2 profile precondition failed: 첫 경기 전 기록 ${initialIds.length}건`);
  await clickText(page, '보관함 닫기', '빈 보관함 닫기');
  const baselineUsage = await page.send('Storage.getUsageAndQuota', { origin });
  await finishActualGame(page, '첫 번째 x32 경기');
  await waitAnyText(page, ['시작 조건과 전체 사건을 경기 보관함에 저장했습니다.', '완주 기록을 경기 보관함에 저장했습니다.'], '첫 기록 저장');
  const firstIds = await runIds(page); if (firstIds.length !== 1) throw new Error(`첫 기록 수가 1이 아닙니다: ${firstIds.length}`);
  const firstSnapshots = await runSnapshots(page); if (firstSnapshots.length !== 1) throw new Error(`첫 기록 snapshot 수가 1이 아닙니다: ${firstSnapshots.length}`);
  const usage = await page.send('Storage.getUsageAndQuota', { origin });
  const firstReplayUsage = Number(usage.usage) - Number(baselineUsage.usage);
  if (!(firstReplayUsage > 0)) throw new Error(`첫 replay의 물리 usage 증가를 측정하지 못했습니다: baseline=${baselineUsage.usage} first=${usage.usage}`);
  const quotaHeadroom = Math.max(65536, Math.floor(firstReplayUsage * 0.75));
  const quotaSize = Number(usage.usage) + quotaHeadroom;
  await quota(page, quotaSize); quotaOverridden = true;

  await clickText(page, '경기 보관함');
  await waitText(page, '조건 복사·변경', '조건 복사·변경 목록');
  await clickText(page, '조건 복사·변경', '조건 복사·변경');
  await waitText(page, '변경 경기 준비', '변경 경기 초안');
  const changed = await changeOneDraftCondition(page);
  await page.evaluate(`(()=>{const proto=IDBObjectStore.prototype;if(globalThis.__ehQuotaRestorePut)globalThis.__ehQuotaRestorePut();const original=proto.put;proto.put=function(value,...rest){if(this.name==='runs'&&value?.id){globalThis.__ehQuotaFailedId=String(value.id);globalThis.__ehQuotaFailedJson=JSON.stringify(value)}return original.call(this,value,...rest)};globalThis.__ehQuotaRestorePut=()=>{proto.put=original;delete globalThis.__ehQuotaRestorePut}})()`);
  await finishActualGame(page, '두 번째 x32 변경 경기');
  await waitText(page, '경기 보관 실패:', 'quota 저장 실패');
  await waitText(page, '보관 다시 시도', '보관 재시도 UI');
  const failedId = await page.evaluate('globalThis.__ehQuotaFailedId || null');
  if (!failedId) throw new Error('실패한 runs.put record ID를 캡처하지 못했습니다.');
  const failedSnapshot = await capturedFailedSnapshot(page);
  if (!failedSnapshot || failedSnapshot.id !== failedId) throw new Error(`실패 record snapshot을 캡처하지 못했습니다: ${JSON.stringify(failedSnapshot)}`);
  await page.evaluate('globalThis.__ehQuotaRestorePut?.()');
  const afterFailure = await runIds(page); if (afterFailure.length !== 1 || afterFailure[0] !== firstIds[0]) throw new Error(`실패 후 기존 기록 보존 불일치: ${JSON.stringify(afterFailure)}`);
  const afterFailureSnapshots = await runSnapshots(page);
  if (JSON.stringify(afterFailureSnapshots) !== JSON.stringify(firstSnapshots)) throw new Error(`실패 후 기존 기록 payload가 바뀌었습니다: before=${JSON.stringify(firstSnapshots)} after=${JSON.stringify(afterFailureSnapshots)}`);

  const cleanupPage = await createPage(page.info.url);
  try {
    await waitText(cleanupPage, '경기 보관함', '삭제 탭 로드');
    await clickText(cleanupPage, '경기 보관함', '삭제 탭 보관함');
    await waitText(cleanupPage, '기록 삭제', '삭제 목록');
    await clickText(cleanupPage, '기록 삭제', '첫 기록 삭제');
    await clickText(cleanupPage, '삭제 확인', '첫 기록 삭제 확인');
    await waitText(cleanupPage, '경기 기록을 삭제했습니다.', '삭제 완료');
    if ((await runIds(cleanupPage)).length !== 0) throw new Error('보관함 삭제 후 기록이 남아 있습니다.');
  } finally { await cleanupPage.closeAsync?.(); }

  const afterDeletionUsage = await page.send('Storage.getUsageAndQuota', { origin });
  if (afterDeletionUsage.overrideActive !== true || Number(afterDeletionUsage.quota) !== quotaSize) throw new Error(`삭제 뒤 quota override가 유지되지 않았습니다: ${JSON.stringify(afterDeletionUsage)}`);
  if (Number(afterDeletionUsage.usage) >= quotaSize) throw new Error(`삭제 뒤에도 재저장 가능한 quota 여유가 없습니다: usage=${afterDeletionUsage.usage} quota=${quotaSize}`);

  await clickText(page, '보관 다시 시도', '실패 기록 재저장');
  await waitText(page, '완주 기록을 경기 보관함에 저장했습니다.', '재저장 완료');
  const retryIds = await runIds(page);
  if (retryIds.length !== 1) throw new Error(`재저장 후 기록 수가 1이 아닙니다: ${retryIds.length}`);
  if (failedId && retryIds[0] !== failedId) throw new Error(`동일 ID 재저장 불일치: expected=${failedId} actual=${retryIds[0]}`);
  const retrySnapshots = await runSnapshots(page);
  if (retrySnapshots.length !== 1 || retrySnapshots[0].id !== failedSnapshot.id || retrySnapshots[0].bytes !== failedSnapshot.bytes || retrySnapshots[0].digest !== failedSnapshot.digest) throw new Error(`동일 payload 재저장 불일치: failed=${JSON.stringify(failedSnapshot)} retry=${JSON.stringify(retrySnapshots)}`);
  const afterRetryUsage = await page.send('Storage.getUsageAndQuota', { origin });
  if (afterRetryUsage.overrideActive !== true || Number(afterRetryUsage.quota) !== quotaSize || Number(afterRetryUsage.usage) > quotaSize) throw new Error(`재저장 뒤 quota 경계 불일치: ${JSON.stringify(afterRetryUsage)}`);
  console.log(JSON.stringify({ ok: true, origin, baselineUsage: baselineUsage.usage, firstUsage: usage.usage, firstReplayUsage, quotaHeadroom, overriddenQuota: quotaSize, firstSnapshot: firstSnapshots[0], changed, afterDeletionUsage: afterDeletionUsage.usage, failedSnapshot, retrySnapshot: retrySnapshots[0], afterRetryUsage: afterRetryUsage.usage, retryIds, sameId: retryIds[0] === failedId, samePayload: retrySnapshots[0].digest === failedSnapshot.digest }));
} catch (error) {
  console.error(`BROWSER_QUOTA_GATE_FAILED: ${error.stack || error.message}`);
  process.exitCode = 1;
} finally {
  if (page) { try { await page.evaluate(`(()=>{globalThis.__ehQuotaRestorePut?.();delete globalThis.__ehQuotaFailedJson})()`); } catch { /* Page may already be gone. */ } }
  if (page) { try { await quota(page); } catch (error) { console.error(`BROWSER_QUOTA_GATE_CLEANUP_FAILED${quotaOverridden ? '' : ' (quota override was not confirmed)'}: ${error.message}`); process.exitCode = 1; } }
  page?.close();
}
