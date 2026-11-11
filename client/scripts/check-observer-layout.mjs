import './lib/register-simulation-modules.mjs';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';
import postcss from 'postcss';

const components = new Set([
  '../src/app/simulation/_components/SimulationControlPanel.js',
  '../src/app/simulation/_components/SimulationMarketSeedCard.js',
  '../src/app/simulation/_components/SimulationSurvivorBoard.js',
  '../src/app/games/_components/GameActionIcon.js',
].map((path) => new URL(path, import.meta.url).href));
const cosmeticStylesUrl = new URL('../src/styles/PerkCosmetics.css', import.meta.url).href;
registerHooks({ resolve(specifier, context, nextResolve) {
  return nextResolve(['next/image', 'next/link'].includes(specifier) ? `${specifier}.js` : specifier, context);
}, load(url, context, nextLoad) {
  // SSR checks retain real component markup; CSS has no executable Node module.
  if (url === cosmeticStylesUrl) return { format: 'module', shortCircuit: true, source: '' };
  if ((!components.has(url) && !url.includes('/_components/')) || !url.endsWith('.js')) return nextLoad(url, context);
  // Next's bundler unwraps this CJS default; native Node ESM does not. Keep
  // the real Next Image component rather than replacing it with a test mock.
  const source = readFileSync(new URL(url), 'utf8').replace("import Image from 'next/image';",
    "import NextImage from 'next/image'; const Image = NextImage.default || NextImage;");
  return { format: 'module', shortCircuit: true, source: ts.transpileModule(source, {
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext },
  }).outputText };
} });
const { default: Control } = await import('../src/app/simulation/_components/SimulationControlPanel.js');
const { default: Seed } = await import('../src/app/simulation/_components/SimulationMarketSeedCard.js');
const { default: SurvivorBoard } = await import('../src/app/simulation/_components/SimulationSurvivorBoard.js');
const { default: GameScreen } = await import('../src/app/simulation/_components/SimulationGameScreen.js');
const { buildActorTeamState } = await import('../src/app/simulation/_lib/simulationPageRuntime.js');
const readComponent = (name) => readFileSync(new URL(`../src/app/simulation/_components/${name}.js`, import.meta.url), 'utf8');
const seedProps = { day: 0, matchSec: 0, runSeed: 'observer-layout-1', seedDraft: 'observer-layout-1' };
const render = (props = {}) => renderToStaticMarkup(React.createElement(Control, {
  day: 0, matchSec: 0, autoSpeed: 32, matchMode: 'squad', characterSkillsEnabled: true,
  settingsContent: React.createElement(Seed, { ...seedProps, ...props }), ...props,
}));
const normal = render();
let passed = 0;
const check = (name, run) => { run(); passed += 1; console.log(`PASS ${name}`); };
check('ready and active screens retain both observer HUD slots before the map', () => {
  const screen = readComponent('SimulationGameScreen');
  assert.match(screen, /data-observer-hud-slot="forbidden"/,
    'The forbidden HUD slot must exist even when its status bar returns null.');
  assert.match(screen, /data-observer-hud-slot="feedback"/,
    'The event HUD slot must exist even when no event feedback is present.');
});
check('actual screen HUD regions survive ready, forbidden, event, combined, long, closed and ended states', () => {
  const forbidden = { visible: true, forbiddenCnt: 4, total: 21, safeLeft: 17, riskyCount: 2 };
  const feedback = { label: '교전', text: '같은 지역에서 실제 교전이 발생했습니다.', tone: 'warning' };
  const variants = [
    { day: 0 }, { day: 4, detonationRiskSummary: forbidden }, { day: 4, eventFeedback: feedback },
    { day: 4, detonationRiskSummary: forbidden, eventFeedback: feedback },
    { day: 4, detonationRiskSummary: forbidden, forbiddenAddedNow: ['긴 지역 이름'.repeat(8)],
      eventFeedback: { ...feedback, text: '긴 실제 사건 설명 '.repeat(40) } },
    { day: 6, detonationRiskSummary: { ...forbidden, allZonesClosed: true, safeLeft: 0 } },
    { day: 6, isGameOver: true, detonationRiskSummary: forbidden, eventFeedback: feedback },
  ];
  for (const variant of variants) {
    const screen = GameScreen({ survivors: [], phase: 'night', forbiddenAddedNow: [], getZoneName: id => id, ...variant });
    const children = React.Children.toArray(screen.props.children);
    const slots = children.filter(child => child.props?.['data-observer-hud-slot']);
    assert.deepEqual(slots.map(slot => slot.props['data-observer-hud-slot']), ['forbidden', 'feedback']);
    assert.ok(children.indexOf(slots[1]) < children.findIndex(child => child.type?.name === 'SimulationMainStage'));
    for (const slot of slots) {
      const active = slot.props['data-observer-hud-slot'] === 'forbidden'
        ? Boolean(variant.detonationRiskSummary?.visible) : Boolean(variant.eventFeedback);
      assert.equal(slot.props.tabIndex, active ? 0 : -1);
      assert.equal(slot.props.role, active ? 'region' : undefined);
      assert.equal(slot.props['aria-hidden'], active ? undefined : true);
      assert.equal(Boolean(slot.props['aria-label']), active);
      const html = renderToStaticMarkup(slot);
      if (active) { assert.match(html, /tabindex="0"/); assert.match(html, /role="region"/); }
      else { assert.match(html, /aria-hidden="true"/); assert.match(html, /tabindex="-1"/); }
      if (slot.props['data-observer-hud-slot'] === 'feedback' && variant.eventFeedback) {
        assert.ok(html.includes(variant.eventFeedback.text), 'Preserve the complete event text rather than shortening it for fit.');
      }
      if (slot.props['data-observer-hud-slot'] === 'forbidden' && variant.detonationRiskSummary?.allZonesClosed) {
        assert.ok(html.includes('전지역 폐쇄'));
      }
      if (slot.props['data-observer-hud-slot'] === 'forbidden' && variant.forbiddenAddedNow?.length) {
        assert.ok(html.includes(variant.forbiddenAddedNow[0]));
      }
    }
  }
});
check('map preparation locks manual and auto start with a distinct readying label', () => {
  const html = render({ mapPreparation: { name: 'Preparing' }, isAdvancing: true, actionDisabled: true, autoDisabled: true, speedDisabled: true });
  assert.match(html, /지도 준비 중/);
  assert.match(html, /class="btn-proceed"[^>]*disabled=""/);
  assert.match(html, /title="오토 진행은[^>]*disabled=""|disabled=""[^>]*title="오토 진행은/);
  assert.match(readComponent('SimulationMainStage'), /autoDisabled=\{Boolean\(mapPreparation\)/);
});
check('ordinary in-progress autoplay remains stoppable outside map preparation', () => {
  const html = render({ isAdvancing: true, actionDisabled: true, autoPlay: true, autoDisabled: false });
  assert.match(html, /오토 정지/);
  const autoButton = html.match(/<button[^>]*title="오토 진행은[^>]*>/)?.[0];
  assert.ok(autoButton); assert.doesNotMatch(autoButton, /disabled/);
});
check('one primary action; no duplicate header action', () => {
  assert.equal((normal.match(/class="btn-proceed"/g) || []).length, 1);
  assert.doesNotMatch(readComponent('SimulationScreenHeader'), /sim-header-proceed|onProceed/);
});
check('play and speed remain outside collapsed settings', () => {
  const settingsStart = normal.indexOf('<details');
  assert.ok(settingsStart > normal.indexOf('class="btn-proceed"'));
  assert.ok(settingsStart > normal.indexOf('최대 32배속'));
  assert.match(normal, /<details name="simulation-tools" class="simulation-match-settings"><summary>/);
});
check('pregame mode, skills, prediction and seed are still available', () => {
  for (const text of ['스쿼드', '솔로', '캐릭터 스킬', '승자 예측', '경기 시드', '새 시드', 'observer-layout-1']) assert.ok(normal.includes(text), text);
  assert.match(normal, /aria-label="경기 시드"[^>]*value="observer-layout-1"/);
});
check('authenticated prediction explains server-confirmed rewards, not a guaranteed credit', () => {
  const html = render({ guestMode: false });
  assert.match(html, /계정 경기 저장 성공 시 기본 50LP · 예측 성공 \+100LP/);
  assert.doesNotMatch(html, /영구 LP 보상 없음|계정 LP 보상 없음/);
});
check('guest and developer-manipulated matches do not advertise account rewards', () => {
  for (const props of [{ guestMode: true }, { guestMode: false, devRunTainted: true }, {}]) {
    const html = render(props);
    assert.match(html, /계정 LP 보상 없음/);
    assert.doesNotMatch(html, /기본 50LP|예측 성공 \+100LP/);
  }
  assert.match(render({ guestMode: true }), /비로그인 경기/);
  assert.match(render({ guestMode: false, devRunTainted: true }), /개발자 조작 경기/);
});
check('prediction help retains the started-match lock and receives existing session context', () => {
  assert.match(render({ guestMode: false, matchSec: 10 }), /경기 시작 후 변경 불가/);
  const source = readComponent('SimulationMainStage');
  const controls = source.slice(source.indexOf('<SimulationControlPanel'));
  assert.match(controls, /guestMode=\{guestMode\}/);
  assert.match(controls, /devRunTainted=\{devRunTainted\}/);
  const stage = readComponent('SimulationGameScreen').slice(readComponent('SimulationGameScreen').indexOf('<SimulationMainStage'));
  assert.match(stage, /guestMode=\{guestMode\}/);
  assert.match(stage, /devRunTainted=\{devRunTainted\}/);
});
check('replay preserves read-only input and removes prediction', () => {
  const html = render({ replayMode: true, matchModeDisabled: true, characterSkillsDisabled: true });
  assert.match(html, /현재 경기는 시작 조건이 고정/);
  assert.doesNotMatch(html, /승자 예측|aria-label="경기 시드"/);
  assert.match(html, /type="checkbox"[^>]*disabled=""/);
});
check('evaluation has one start, speed, and no editable settings or separate auto button', () => {
  const html = render({ evaluationMode: true });
  assert.match(html, /평가 시작/);
  assert.match(html, /최대 32배속/);
  assert.doesNotMatch(html, /simulation-match-settings|title="오토 진행은|승자 예측/);
  assert.equal((html.match(/<button\b/g) || []).length, 1);
});
check('evaluation running state exposes stop without mutable settings', () => {
  const html = render({ evaluationMode: true, day: 1, autoPlay: true });
  assert.match(html, /오토 정지/);
  assert.doesNotMatch(html, /simulation-match-settings/);
});
check('editable evaluation variants retain their explicit setup', () => {
  const html = render({ evaluationMode: true, draftMode: true });
  assert.match(html, /simulation-match-settings/);
  assert.match(html, /aria-label="경기 시드"/);
  assert.doesNotMatch(html, /승자 예측/);
});
check('end state has only one restart and preserves disabled speed', () => {
  const html = render({ isGameOver: true, speedDisabled: true, autoDisabled: true });
  assert.equal((html.match(/class="btn-restart"/g) || []).length, 1);
  assert.doesNotMatch(html, /class="btn-proceed"/);
  assert.match(html, /class="autoplay-speed"[^>]*disabled=""/);
});
check('controls precede the battlefield, setup retains roster and map editors', () => {
  const source = readComponent('SimulationMainStage');
  const returned = source.slice(source.indexOf('  return ('));
  assert.ok(returned.indexOf('<SimulationControlPanel') < returned.indexOf('{battlefield}'));
  assert.match(source, /settingsContent=\{pregameSettings\}/);
  assert.match(source, /const pregameSettings = <>[\s\S]*seedControl[\s\S]*SimulationPregameRosterSetup[\s\S]*SimulationPregameMapRulesSetup/);
});
check('settings disclosure closes on play and keyboard escape', () => {
  const source = readComponent('SimulationControlPanel');
  assert.match(source, /closeSettings\(\); onProceed\?\.\(\)/);
  assert.match(source, /closeSettings\(\); onToggleAutoPlay\?\.\(\)/);
  assert.match(source, /event.key !== 'Escape' \|\| event.target.closest\('\[role="dialog"\]'\)/);
  assert.match(source, /querySelector\('summary'\)\?\.focus\(\)/);
});
check('log heading and limit notice have separate wrapping space', () => {
  const styles = readFileSync(new URL('../src/styles/ERSimulation.css', import.meta.url), 'utf8');
  assert.match(styles, /\.simulation-page--observer \.log-toolbar-title \{[^}]*white-space: normal;[^}]*overflow: visible;/);
  assert.match(styles, /\.simulation-page--observer \.log-toolbar-limit \{[^}]*flex: 1 0 100%;[^}]*color: #b9cfdc;/);
  assert.match(styles, /\.simulation-page--observer \.log-scroll-area \{[^}]*padding-bottom: 52px;/);
});

const styles = readFileSync(new URL('../src/styles/ERSimulation.css', import.meta.url), 'utf8');
const stylesheet = postcss.parse(styles);
// Evaluate the actual matching class rules and width media cascade for these
// specific HUD elements. This is a source contract, not a browser layout model.
function hudStyle(classes, width, observer = true, tag = '') {
  const available = new Set([...classes, ...(observer ? ['simulation-page', 'simulation-page--observer'] : [])]);
  const result = {}, priorities = {};
  stylesheet.walkRules(rule => {
    for (let parent = rule.parent; parent?.type !== 'root'; parent = parent?.parent) {
      if (!parent) return;
      if (parent.type !== 'atrule') continue;
      if (parent.name !== 'media') return;
      const min = parent.params.match(/min-width:\s*(\d+)px/), max = parent.params.match(/max-width:\s*(\d+)px/);
      if (min && width < Number(min[1]) || max && width > Number(max[1])) return;
      if (/height|prefers|print|orientation/.test(parent.params)) return;
    }
    const matching = rule.selectors.filter(selector => {
      if (selector.endsWith(' > span')) {
        if (tag !== 'span') return false;
        selector = selector.slice(0, -7);
      }
      if (!/^\.[\w.-]+(?:\s+\.[\w.-]+)*$/.test(selector.trim())) return false;
      const names = [...selector.matchAll(/\.([\w-]+)/g)].map(match => match[1]);
      const terminal = [...selector.trim().split(/\s+/).at(-1).matchAll(/\.([\w-]+)/g)].map(match => match[1]);
      return terminal.every(name => classes.includes(name)) && names.length > 0 && names.every(name => available.has(name));
    });
    if (!matching.length) return;
    const specificity = Math.max(...matching.map(selector => (selector.match(/\./g) || []).length));
    rule.walkDecls(declaration => {
      const rank = specificity + (declaration.important ? 1000 : 0);
      if (rank < (priorities[declaration.prop] ?? -1)) return;
      priorities[declaration.prop] = rank; result[declaration.prop] = declaration.value;
    });
  });
  return Object.fromEntries(Object.entries(result).map(([key, value]) => [key,
    value.replace(/var\((--[\w-]+)\)/g, (_match, name) => result[name] ?? `var(${name})`)]));
}
check('the final 785px and desktop cascade fixes HUD allocation while retaining full accessible content', () => {
  for (const width of [785, 999, 1000, 1280]) {
    for (const kind of ['forbidden', 'feedback']) {
      const style = hudStyle(['simulation-observer-hud-slot', `simulation-observer-hud-slot--${kind}`], width);
      const expected = width <= 999 ? kind === 'forbidden' ? '64px' : '56px' : kind === 'forbidden' ? '36px' : '34px';
      assert.equal(style.display, 'block');
      assert.equal(style['block-size'], expected); assert.equal(style['min-block-size'], expected);
      assert.equal(style['max-block-size'], expected); assert.equal(style.flex, `0 0 ${expected}`);
      assert.equal(style.overflow, 'auto'); assert.equal(style['box-sizing'], 'border-box');
    }
    const placeholder = hudStyle(['simulation-field-details', 'simulation-field-details--placeholder'], width);
    assert.equal(placeholder.display, 'block'); assert.equal(placeholder['block-size'], '24px');
    assert.equal(placeholder['min-block-size'], '24px'); assert.equal(placeholder['max-block-size'], '24px');
  }
  assert.equal(hudStyle(['simulation-observer-hud-slot'], 785, false).display, 'contents');
  assert.equal(hudStyle(['simulation-field-details--placeholder'], 785, false).display, 'none');
  const copyText = hudStyle(['simulation-observer-hud-slot', 'simulation-event-feedback__copy'], 785, true, 'span');
  assert.equal(copyText.overflow, 'visible'); assert.equal(copyText['white-space'], 'normal');
  assert.equal(copyText['text-overflow'], 'clip');
});
const mediaBlock = (query) => {
  const start = styles.indexOf(`@media ${query} {`);
  if (start < 0) return '';
  let depth = 1;
  let end = styles.indexOf('{', start) + 1;
  const body = end;
  for (; end < styles.length && depth > 0; end += 1) {
    if (styles[end] === '{') depth += 1;
    if (styles[end] === '}') depth -= 1;
  }
  assert.equal(depth, 0, 'Responsive map rules must form a complete media block.');
  return styles.slice(body, end - 1);
};
check('desktop map reserves readable height without stretching map geometry or modals', () => {
  const desktop = mediaBlock('(min-width: 1000px)');
  assert.ok(/\.simulation-page--observer \.simulation-battlefield-column > \.battlefield-panel:not\(\.modal-open\) \{[^}]*grid-template-rows: auto auto auto minmax\(540px, 1fr\) auto;/.test(desktop),
    'Keep at least 540px for the inline map independently of header/status row height.');
  assert.ok(/\.simulation-page--observer \.simulation-stage \{[^}]*min-height: 680px;[^}]*overflow: visible;/.test(desktop),
    'Allow the desktop stage to grow rather than clip the reserved map row.');
  assert.ok(!/preserveAspectRatio|\.minimap-map-content|\.minimap-svg|\.modal-open \{/.test(desktop),
    'Viewport allocation must not distort island geometry, zoom content, or expanded dialogs.');
});
check('desktop ready and active game-screen states reserve the same top rows and field-summary slot', () => {
  const desktop = mediaBlock('(min-width: 1000px)');
  assert.ok(/\.simulation-page--observer \.simulation-container\.modal-layout \.game-screen \{[^}]*grid-template-rows: auto minmax\(36px, auto\) minmax\(34px, auto\) minmax\(0, 1fr\);/.test(desktop),
    'Reserve row 2 and row 3 space before forbidden-zone and feedback content appears.');
  const stage = readComponent('SimulationMainStage');
  assert.match(stage, /\{day > 0 \? <details className="simulation-field-details">[\s\S]*?<SimulationWorldSpawnToolbar[\s\S]*?<\/details> : <div className="simulation-field-details simulation-field-details--placeholder">\s*필드 현황 · 경기 시작 전\s*<\/div>\}/,
    'Before day one, show the field-status placeholder in the same slot; after start, retain the actual collapsible toolbar.');
  assert.ok(stage.indexOf('className="simulation-field-details simulation-field-details--placeholder"')
    < stage.indexOf('<SimulationMinimapPanel'), 'Keep the reserved field slot before the map in both states.');
  assert.match(styles, /\.simulation-field-details > summary \{ padding: 3px 6px; cursor: pointer; \}/,
    'Leave the native summary list-item marker intact.');
  assert.doesNotMatch(styles, /\.simulation-field-details > summary \{[^}]*display: flex;/);
  assert.ok(/\.simulation-page--observer \.simulation-field-details,\s*\.simulation-page--observer \.simulation-field-details--placeholder \{ min-height: 24px; box-sizing: border-box; \}/.test(desktop),
    'The desktop observer retains the shared 24px field-summary slot.');
  assert.match(desktop, /\.simulation-page--observer \.simulation-field-details > summary \{ min-height: 24px; box-sizing: border-box; \}/);
  assert.match(styles, /\.simulation-field-details--placeholder \{ display: none; \}/,
    'Non-observer layouts keep the preparation placeholder hidden.');
  assert.match(desktop, /\.simulation-page--observer \.simulation-field-details--placeholder \{ display: block; padding: 3px 6px; \}/,
    'Show the same-height preparation text only for desktop observer sessions.');
  assert.match(styles, /\.simulation-field-details \.worldspawn-toolbar \{ position: absolute; top: 100%; left: 0; right: 0;/,
    'The active toolbar remains an overlay rather than increasing the field slot.');
  const narrow = mediaBlock('(max-width: 999px)');
  assert.match(narrow, /\.simulation-container\.modal-layout \.game-screen \{ display: flex;/,
    'Keep the existing narrow-screen conditional layout instead of imposing desktop grid rows.');
  assert.equal(hudStyle(['simulation-field-details', 'simulation-field-details--placeholder'], 785).display, 'block',
    'Observer field readiness space must also be reserved on the narrow flex layout.');
});
check('desktop page can scroll while controls and observation remain bounded', () => {
  const desktop = mediaBlock('(min-width: 1000px)');
  assert.ok(/\.simulation-page\.simulation-page--observer \{[^}]*height: auto;[^}]*min-height: 100dvh;[^}]*overflow: visible;/.test(desktop),
    'A short desktop must not squeeze the map into a fixed 100dvh shell.');
  assert.ok(/\.simulation-page--observer > \.simulation-container \{[^}]*overflow: visible;/.test(desktop));
  assert.ok(/\.simulation-page--observer \.simulation-container\.modal-layout \.game-screen \{[^}]*height: auto;[^}]*overflow: visible;/.test(desktop));
  assert.ok(/\.simulation-page--observer \.simulation-side-column \{[^}]*position: sticky;[^}]*top: 56px;[^}]*align-self: start;[^}]*height: clamp\(320px, calc\(100dvh - 88px\), max\(680px, calc\(100dvh - 180px\)\)\);/.test(desktop),
    'Keep the independently scrollable observer pane below sticky controls and inside short viewports.');
  assert.ok(/\.simulation-page--observer \.control-panel \{[^}]*position: sticky;[^}]*top: 0;/.test(desktop));
});
check('diagnostic panel stays reachable while scrolling without stacking above controls or dialogs', () => {
  assert.match(styles, /\.sim-observer-performance \{[^}]*position: sticky;[^}]*top: 0;[^}]*z-index: 80;/,
    'Keep the diagnostic panel at the viewport top so its start control is reachable with the map in view.');
  assert.match(styles, /\.simulation-page--observer \.control-panel \{[^}]*z-index: 90;/,
    'Ordinary game controls must stack above the diagnostic panel.');
  assert.match(styles, /\.sim-replay-backdrop \{[^}]*z-index: 1200;/,
    'Replay dialogs must remain above the diagnostic panel.');
  assert.match(styles, /\.minimap-panel\.modal-open,\s*\.log-window\.modal-open \{[^}]*z-index: 9001;/,
    'Expanded map dialogs must remain above the diagnostic panel.');
});
check('short desktop retains two columns and only narrow width stacks the observation pane', () => {
  assert.ok(!styles.includes('@media (max-width: 999px), (max-height: 599px)'),
    'Height alone must not hide the log beside the desktop map.');
  const narrow = mediaBlock('(max-width: 999px)');
  assert.ok(/\.simulation-page--observer \.simulation-stage \{[^}]*grid-template-columns: minmax\(0, 1fr\);/.test(narrow));
  assert.ok(/height: clamp\(540px, 80dvh, 760px\);/.test(narrow), 'Preserve the mobile map-height policy.');
  assert.ok(/\.simulation-page--observer \.minimap-team-legend \{[^}]*min-height: 28px;[^}]*overflow-x: auto;[^}]*overflow-y: hidden;/.test(styles),
    'Let overflowing team legends scroll horizontally without a distracting vertical gutter.');
});

const boardActor = (name, teamId, teamSlot, hp = 100, extra = {}) => ({
  _id: name, name, teamId, teamSlot, hp, maxHp: 100, zoneId: 'hospital', inventory: [], ...extra,
});
const renderBoard = (survivors, dead, settings = { matchMode: 'squad' }) => renderToStaticMarkup(React.createElement(SurvivorBoard, {
  survivors, dead, settings, uiModal: 'chars', killCounts: {}, getZoneName: zoneId => zoneId,
  getTeamStateForActor: actor => buildActorTeamState(actor, settings, survivors, dead),
}));
const assertCardOrder = (html, names) => {
  const positions = names.map(name => html.indexOf(`<span>${name}</span>`));
  assert.ok(positions.every(position => position >= 0), 'Keep every participant visible.');
  for (let index = 1; index < positions.length; index += 1) {
    assert.ok(positions[index - 1] < positions[index], `${names[index - 1]} must appear before ${names[index]}.`);
  }
};
check('squad order hint reserves close-button space and the button stacks above content', () => {
  const html = renderBoard([], []);
  assert.match(html, /class="survivor-board-order-hint"/);
  const styles = readFileSync(new URL('../src/styles/ERSimulation.css', import.meta.url), 'utf8');
  assert.match(styles, /\.survivor-board\.modal-open \.eh-modal-close \{[^}]*z-index: 1;/);
  assert.match(styles, /\.survivor-board-order-hint \{[^}]*padding-right: 44px;[^}]*color: #b9cfdc;/);
});
check('dead cards use numeric team and original member order, not elimination order', () => {
  const dead = [boardActor('dead-10-2', 'team:10', 2, 0), boardActor('dead-2-3', 'team:2', 3, 0),
    boardActor('dead-1-2', 'team:1', 2, 0), boardActor('dead-2-1', 'team:2', 1, 0), boardActor('dead-10-1', 'team:10', 1, 0)];
  const before = structuredClone(dead);
  const html = renderBoard([], Object.freeze(dead));
  assertCardOrder(html, ['dead-1-2', 'dead-2-1', 'dead-2-3', 'dead-10-1', 'dead-10-2']);
  assert.match(html, /사망자 \(5명\)/); assert.deepEqual(dead, before);
});
check('living cards use the same team order without changing HP, roster, or death separation', () => {
  const survivors = [boardActor('alive-2-2', 'team:2', 2), boardActor('alive-1-3', 'team:1', 3, 17),
    boardActor('alive-2-1', 'team:2', 1)];
  const dead = [boardActor('dead-1-1', 'team:1', 1, 0)];
  const before = structuredClone({ survivors, dead });
  const html = renderBoard(Object.freeze(survivors), Object.freeze(dead));
  assertCardOrder(html, ['alive-1-3', 'alive-2-1', 'alive-2-2', 'dead-1-1']);
  assert.match(html, /생존자 \(3명\)/); assert.match(html, /17\/100/);
  assert.match(html, /사망자 \(1명\)/); assert.match(html, /팀 번호 · 팀원 순서로 표시/);
  assert.deepEqual({ survivors, dead }, before);
});
check('custom team names sort naturally and missing slots use the saved original roster order', () => {
  const actor = (name, teamId, teamName, order) => boardActor(name, teamId, undefined, 0, { teamName, matchTeamRosterIds: order });
  const dead = [actor('custom-10-b', 'custom:10', '부대 10', ['custom-10-a', 'custom-10-b']),
    actor('custom-2-b', 'custom:2', '부대 2', ['custom-2-a', 'custom-2-b']),
    actor('custom-10-a', 'custom:10', '부대 10', ['custom-10-a', 'custom-10-b']),
    actor('custom-2-a', 'custom:2', '부대 2', ['custom-2-a', 'custom-2-b'])];
  assertCardOrder(renderBoard([], dead), ['custom-2-a', 'custom-2-b', 'custom-10-a', 'custom-10-b']);
});
check('explicit one-based slots and saved roster fallbacks share the same member order', () => {
  const rosterIds = ['mixed-a', 'mixed-b', 'mixed-c'];
  const dead = [boardActor('mixed-b', 'team:2', undefined, 0, { matchTeamRosterIds: rosterIds }),
    boardActor('mixed-c', 'team:2', 3, 0), boardActor('mixed-a', 'team:2', 1, 0)];
  assertCardOrder(renderBoard([], dead), rosterIds);
});
check('solo and empty boards preserve their existing order and do not advertise squad grouping', () => {
  const dead = [boardActor('solo-b', 'team:2', 1, 0), boardActor('solo-a', 'team:1', 1, 0)];
  const html = renderBoard([], dead, { matchMode: 'SOLO' });
  assertCardOrder(html, ['solo-b', 'solo-a']); assert.doesNotMatch(html, /팀 번호 · 팀원 순서로 표시/);
  const empty = renderBoard(null, undefined);
  assert.match(empty, /생존자 \(0명\)/); assert.match(empty, /사망자 \(0명\)/);
});
console.log(JSON.stringify({ passed, scope: 'actual controls SSR and ownership checks; viewport fit and interaction require browser checks' }));
