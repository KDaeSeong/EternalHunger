import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  GAME_BGM_LAYER_ROLES,
  gameBgmProfile,
} from '../src/app/games/_lib/gameBgmProfiles.js';
import {
  COMPANY_REPORT_BGM_SCENES,
  COMPANY_REPORT_SOUNDTRACK,
  companyReportResultMusic,
  resolveCompanyReportBgmScene,
} from '../src/app/games/company-report/_lib/companyReportSoundtrack.js';

const routeUrl = new URL('../src/app/games/company-report/', import.meta.url);
const pageSource = await readFile(new URL('play/page.js', routeUrl), 'utf8');
const featureSource = await readFile(new URL('_components/CompanyReportFeatureTabs.js', routeUrl), 'utf8');
const profileSource = await readFile(new URL('../src/app/games/_lib/gameBgmProfiles.js', import.meta.url), 'utf8');
const iconSource = await readFile(new URL('../src/app/games/_components/GameActionIcon.js', import.meta.url), 'utf8');
const cssSource = await readFile(new URL('../src/styles/AppShell.css', import.meta.url), 'utf8');

assert.equal(COMPANY_REPORT_SOUNDTRACK.length, 7, '회사 리포트는 7개 상황별 음악 장면을 제공해야 합니다.');
assert.equal(new Set(COMPANY_REPORT_SOUNDTRACK.map((row) => row.theme)).size, 7, '회사 리포트 음악 테마는 중복되면 안 됩니다.');
assert.ok(GAME_BGM_LAYER_ROLES.includes('string-ensemble'), '배경음 엔진은 스트링 레이어를 제공해야 합니다.');
assert.ok(GAME_BGM_LAYER_ROLES.includes('synth-pulse'), '배경음 엔진은 펄스 레이어를 제공해야 합니다.');

for (const row of COMPANY_REPORT_SOUNDTRACK) {
  const profile = gameBgmProfile(row.theme);
  assert.match(profile.label, /^회사 리포트 OST/, `${row.theme}에는 전용 재생 라벨이 필요합니다.`);
  assert.equal(profile.arrangement.length, 10, `${row.theme}은 10개 구간 편곡이어야 합니다.`);
  assert.ok(profile.steps >= 32 * 16, `${row.theme}은 짧은 루프가 아닌 장편 편곡이어야 합니다.`);
  assert.ok(profile.orchestration.stringGain > 0, `${row.theme}은 스트링 레이어를 사용해야 합니다.`);
  assert.ok(profile.orchestration.pluckGain > 0, `${row.theme}은 플럭 레이어를 사용해야 합니다.`);
}

const safeCompany = {
  cashKrw: 500_000_000,
  cashRunwayMonths: 8,
  disclosureRisk: 20,
  operatingProfit: 10_000_000,
};
assert.equal(resolveCompanyReportBgmScene({ ...safeCompany, activeTabId: 'board' }), COMPANY_REPORT_BGM_SCENES.board);
assert.equal(resolveCompanyReportBgmScene({ ...safeCompany, activeTabId: 'trade' }), COMPANY_REPORT_BGM_SCENES.trade);
assert.equal(resolveCompanyReportBgmScene({ ...safeCompany, activeTabId: 'close' }), COMPANY_REPORT_BGM_SCENES.closing);
assert.equal(resolveCompanyReportBgmScene({ ...safeCompany, activeTabId: 'global' }), COMPANY_REPORT_BGM_SCENES.global);
assert.equal(resolveCompanyReportBgmScene({ ...safeCompany, activeTabId: 'capital' }), COMPANY_REPORT_BGM_SCENES.capital);
assert.equal(resolveCompanyReportBgmScene({ ...safeCompany, activeTabId: 'ledger' }), COMPANY_REPORT_BGM_SCENES.audit);
assert.equal(resolveCompanyReportBgmScene({ ...safeCompany, activeTabId: 'trade', cashRunwayMonths: 1 }), COMPANY_REPORT_BGM_SCENES.crisis);
assert.equal(resolveCompanyReportBgmScene({ ...safeCompany, activeTabId: 'board', disclosureRisk: 65 }), COMPANY_REPORT_BGM_SCENES.crisis);

assert.equal(companyReportResultMusic({ key: 'orderCreated' })?.theme, COMPANY_REPORT_BGM_SCENES.trade);
assert.equal(companyReportResultMusic({ key: 'monthClosed' })?.theme, COMPANY_REPORT_BGM_SCENES.closing);
assert.equal(companyReportResultMusic({ key: 'globalSettled' })?.theme, COMPANY_REPORT_BGM_SCENES.global);
assert.equal(companyReportResultMusic({ key: 'capitalRaised' })?.theme, COMPANY_REPORT_BGM_SCENES.capital);
assert.equal(companyReportResultMusic({ key: 'snapshotSaved' })?.theme, COMPANY_REPORT_BGM_SCENES.audit);
assert.equal(companyReportResultMusic({ key: 'blocked' })?.theme, COMPANY_REPORT_BGM_SCENES.crisis);
assert.equal(companyReportResultMusic({ key: 'idle' }), null);

for (const token of [
  'useGameBgm',
  'resolveCompanyReportBgmScene',
  'companyReportResultMusic',
  'setMusicScene(baseMusicScene)',
  'activeTabId={activeFeatureTabId}',
  'onActiveTabChange={setActiveFeatureTabId}',
]) {
  assert.ok(pageSource.includes(token), `플레이 페이지에 ${token} 연동이 필요합니다.`);
}
assert.ok(featureSource.includes("import GameActionIcon"), '운영 큐와 리스크에 행동 아이콘을 사용해야 합니다.');
assert.ok(featureSource.includes('company-report-icon-row'), '회사 리포트 전용 아이콘 행이 필요합니다.');
assert.ok(featureSource.includes('onTabChange={onActiveTabChange}'), '탭 상태는 음악 장면 전환을 위해 제어형이어야 합니다.');
assert.ok(!featureSource.includes("useState('board')"), '회사 리포트 탭 상태를 컴포넌트 내부에 가두면 안 됩니다.');
assert.ok(cssSource.includes('.game-save-row.company-report-icon-row'), '아이콘 행 데스크톱 레이아웃이 필요합니다.');
assert.ok(cssSource.includes('.company-report-icon-row > .game-action-icon'), '아이콘 시각 스타일이 필요합니다.');

for (const action of ['finance', 'trade', 'closing', 'contract', 'capital', 'snapshot', 'warning']) {
  assert.match(iconSource, new RegExp(`\\b${action}:`), `${action} 행동 아이콘 매핑이 필요합니다.`);
}
for (const arrangement of ['companyBoard', 'companyTrade', 'companyClosing', 'companyGlobal', 'companyCapital', 'companyAudit', 'companyCrisis']) {
  assert.ok(profileSource.includes(`${arrangement}: sceneArrangement`), `${arrangement} 장편 편곡이 필요합니다.`);
}

console.log('soundtrackScenes', COMPANY_REPORT_SOUNDTRACK.length);
console.log('profileBars', COMPANY_REPORT_SOUNDTRACK.map((row) => gameBgmProfile(row.theme).steps / 16).join(','));
console.log('controlledTabs', true);
console.log('iconRows', true);
