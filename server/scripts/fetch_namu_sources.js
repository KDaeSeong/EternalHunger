// Download selected NamuWiki raw pages into scripts/namu_pastes.
// The importer stores only derived facts in Mongo, but keeping local raw wiki
// snippets makes the parsing step reproducible while the official API key is pending.
//
// Usage:
//   node scripts/fetch_namu_sources.js
//   node scripts/fetch_namu_sources.js --only weaponSkill
//   node scripts/fetch_namu_sources.js --source ./scripts/namu_sources.json --out ./scripts/namu_pastes

const fs = require('fs');
const path = require('path');
const axios = require('axios');

const DEFAULT_SOURCE = path.join(__dirname, 'namu_sources.json');
const DEFAULT_OUT = path.join(__dirname, 'namu_pastes');

function parseCli(argv) {
  const opt = { source: DEFAULT_SOURCE, out: DEFAULT_OUT, only: '', delayMs: 800 };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--source') opt.source = path.resolve(process.cwd(), argv[++i] || opt.source);
    if (a === '--out') opt.out = path.resolve(process.cwd(), argv[++i] || opt.out);
    if (a === '--only') opt.only = String(argv[++i] || '').trim();
    if (a === '--delay') opt.delayMs = Number(argv[++i] || opt.delayMs);
  }
  if (!Number.isFinite(opt.delayMs) || opt.delayMs < 0) opt.delayMs = 800;
  return opt;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function toRawUrl(url) {
  const raw = String(url || '').trim();
  if (!raw) return '';
  if (raw.includes('/raw/')) return raw;
  return raw.replace('/w/', '/raw/');
}

function safeSlug(value, fallback) {
  return String(value || fallback || 'namu_page')
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9가-힣_-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function headerForSource(source, fetchedAt) {
  const lines = [
    `# @namu-source kind=${source.kind || ''}`,
    `# @namu-source slug=${source.slug || ''}`,
    `# @namu-source title=${source.title || ''}`,
    `# @namu-source url=${source.url || ''}`,
    `# @namu-source fetchedAt=${fetchedAt.toISOString()}`,
    ''
  ];
  return lines.join('\n');
}

function looksLikeBlockedHtml(text) {
  const raw = String(text || '');
  return /<!doctype html>|<html\b|challenge-platform|__CF\$cv\$params|id="app-loading"/i.test(raw)
    && !/\[include\(틀:|^={2,}/m.test(raw);
}

async function fetchRaw(source) {
  const url = toRawUrl(source.url);
  const res = await axios.get(url, {
    responseType: 'text',
    timeout: 30000,
    headers: {
      'User-Agent': 'EternalHunger local data importer'
    },
    transformResponse: [(data) => data]
  });
  if (res.status < 200 || res.status >= 300) {
    throw new Error(`HTTP ${res.status} ${url}`);
  }
  const body = String(res.data || '');
  if (looksLikeBlockedHtml(body)) {
    throw new Error(`NamuWiki returned a browser challenge instead of raw wiki text: ${url}`);
  }
  return body;
}

async function main() {
  const opt = parseCli(process.argv.slice(2));
  const sources = JSON.parse(fs.readFileSync(opt.source, 'utf-8'));
  const selected = (Array.isArray(sources) ? sources : [])
    .filter((source) => !opt.only || source.kind === opt.only || source.slug === opt.only);

  fs.mkdirSync(opt.out, { recursive: true });
  console.log(`Namu sources: ${selected.length}`);

  for (let i = 0; i < selected.length; i++) {
    const source = selected[i];
    const slug = safeSlug(source.slug, source.title);
    const outPath = path.join(opt.out, `${slug}.code`);
    const raw = await fetchRaw(source);
    const payload = `${headerForSource(source, new Date())}${raw.replace(/^\uFEFF/, '')}`;
    fs.writeFileSync(outPath, payload, 'utf-8');
    console.log(`- ${source.kind}:${source.title} -> ${path.relative(process.cwd(), outPath)} (${raw.length} chars)`);
    if (i < selected.length - 1 && opt.delayMs > 0) await sleep(opt.delayMs);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
