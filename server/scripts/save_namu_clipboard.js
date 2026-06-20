// Save NamuWiki source text from the Windows clipboard into scripts/namu_pastes.
//
// Fast workflow:
//   1) Open a NamuWiki edit/source page in the browser.
//   2) Select all source text and copy it.
//   3) Run:
//      node scripts/save_namu_clipboard.js --slug subjects
//
// The script can fill title/kind/url from scripts/namu_sources.json when --slug
// matches one of the configured sources.

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const DEFAULT_SOURCES = path.join(__dirname, 'namu_sources.json');
const DEFAULT_OUT = path.join(__dirname, 'namu_pastes');

function parseCli(argv) {
  const opt = {
    source: DEFAULT_SOURCES,
    out: DEFAULT_OUT,
    slug: '',
    kind: '',
    title: '',
    url: '',
    file: '',
    importAfter: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--source') opt.source = path.resolve(process.cwd(), argv[++i] || opt.source);
    if (a === '--out') opt.out = path.resolve(process.cwd(), argv[++i] || opt.out);
    if (a === '--slug') opt.slug = String(argv[++i] || '').trim();
    if (a === '--kind') opt.kind = String(argv[++i] || '').trim();
    if (a === '--title') opt.title = String(argv[++i] || '').trim();
    if (a === '--url') opt.url = String(argv[++i] || '').trim();
    if (a === '--file') opt.file = String(argv[++i] || '').trim();
    if (a === '--import') opt.importAfter = true;
  }
  return opt;
}

function readSources(filePath) {
  try {
    const rows = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    return Array.isArray(rows) ? rows : [];
  } catch (_) {
    return [];
  }
}

function safeSlug(value, fallback = 'namu_page') {
  return String(value || fallback)
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9가-힣_-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function getClipboardText() {
  const commands = [
    ['powershell.exe', ['-NoProfile', '-Command', 'Get-Clipboard -Raw']],
    ['powershell.exe', ['-NoProfile', '-Command', 'Get-Clipboard | Out-String']],
  ];
  for (const [cmd, args] of commands) {
    try {
      const text = execFileSync(cmd, args, { encoding: 'utf8', maxBuffer: 50 * 1024 * 1024 });
      if (String(text || '').trim()) return String(text).replace(/^\uFEFF/, '');
    } catch (_) {}
  }
  return '';
}

function looksLikeWikiSource(text) {
  const raw = String(text || '');
  return /\[include\(틀:|^\s*={2,6}\s*[^=\n]+?\s*={2,6}\s*$/m.test(raw) || /\[\[분류:/.test(raw);
}

function inferKindFromText(text) {
  const raw = String(text || '');
  if (/\[\[분류:이터널 리턴\/실험체\]\]|실험체 목록|\[include\(틀:이터널 리턴\/실험체\)\]/.test(raw)) return 'subjectIndex';
  if (/무기\s*스킬/.test(raw.slice(0, 3000))) return 'weaponSkill';
  if (/전술\s*스킬/.test(raw.slice(0, 3000))) return 'tacticalSkill';
  if (/특성/.test(raw.slice(0, 3000))) return 'trait';
  if (/루미아\s*섬/.test(raw.slice(0, 3000))) return 'map';
  if (/가이드/.test(raw.slice(0, 3000))) return 'guide';
  if (/\[include\(틀:이터널 리턴\/아이템/.test(raw)) return 'item';
  return 'unknown';
}

function headerForSource(source) {
  return [
    `# @namu-source kind=${source.kind || ''}`,
    `# @namu-source slug=${source.slug || ''}`,
    `# @namu-source title=${source.title || ''}`,
    `# @namu-source url=${source.url || ''}`,
    `# @namu-source capturedAt=${new Date().toISOString()}`,
    '',
  ].join('\n');
}

function main() {
  const opt = parseCli(process.argv.slice(2));
  const sources = readSources(opt.source);
  const known = sources.find((row) => row.slug === opt.slug || row.kind === opt.slug) || {};

  const text = opt.file
    ? fs.readFileSync(path.resolve(process.cwd(), opt.file), 'utf-8')
    : getClipboardText();

  if (!String(text || '').trim()) {
    throw new Error('클립보드가 비어 있습니다. 나무위키 원문을 복사한 뒤 다시 실행하세요.');
  }
  if (!looksLikeWikiSource(text)) {
    throw new Error('클립보드 내용이 위키 원문처럼 보이지 않습니다. 편집/원문 화면의 전체 텍스트를 복사했는지 확인하세요.');
  }

  const kind = opt.kind || known.kind || inferKindFromText(text);
  const title = opt.title || known.title || opt.slug || 'namu page';
  const slug = safeSlug(opt.slug || known.slug || title);
  const source = {
    kind,
    slug,
    title,
    url: opt.url || known.url || '',
  };

  fs.mkdirSync(opt.out, { recursive: true });
  const outPath = path.join(opt.out, `${slug}.code`);
  fs.writeFileSync(outPath, `${headerForSource(source)}${String(text).replace(/^\uFEFF/, '')}`, 'utf-8');
  console.log(`Saved: ${path.relative(process.cwd(), outPath)} (${String(text).length} chars, kind=${kind})`);

  if (opt.importAfter) {
    execFileSync(process.execPath, ['scripts/import_namu_pasted.js', 'import-all', outPath], {
      cwd: path.join(__dirname, '..'),
      stdio: 'inherit',
    });
  }
}

try {
  main();
} catch (e) {
  console.error(e);
  process.exit(1);
}
