/*
  Next.js 16: `middleware.*` file convention is deprecated in favor of `proxy.*`.
  Build fails if both exist.

  This prebuild script:
  - moves src/src/proxy.(js|ts) -> src/proxy.(js|ts) when needed
  - removes any middleware.(js|ts) variants if any proxy.(js|ts) exists
  - removes duplicate nested proxy files to avoid detection conflicts
*/

const fs = require('fs');
const path = require('path');

function exists(target) {
  try {
    return fs.existsSync(target);
  } catch {
    return false;
  }
}

function safeUnlink(target) {
  try {
    if (exists(target) && fs.statSync(target).isFile()) {
      fs.unlinkSync(target);
      console.log(`[prebuild] removed: ${target}`);
      return true;
    }
  } catch (error) {
    console.warn(`[prebuild] failed to remove ${target}: ${error?.message || error}`);
  }
  return false;
}

function safeMkdir(dir) {
  try {
    fs.mkdirSync(dir, { recursive: true });
  } catch {}
}

function safeMove(src, dst) {
  try {
    safeMkdir(path.dirname(dst));
    fs.renameSync(src, dst);
    console.log(`[prebuild] moved: ${src} -> ${dst}`);
    return true;
  } catch (error) {
    console.warn(`[prebuild] rename failed (${src} -> ${dst}): ${error?.message || error}`);
    try {
      safeMkdir(path.dirname(dst));
      fs.copyFileSync(src, dst);
      fs.unlinkSync(src);
      console.log(`[prebuild] copied+removed: ${src} -> ${dst}`);
      return true;
    } catch (fallbackError) {
      console.warn(`[prebuild] copy fallback failed (${src} -> ${dst}): ${fallbackError?.message || fallbackError}`);
      return false;
    }
  }
}

function main() {
  const root = process.cwd();
  const proxyCandidates = [
    'proxy.js',
    'proxy.ts',
    path.join('src', 'proxy.js'),
    path.join('src', 'proxy.ts'),
    path.join('src', 'src', 'proxy.js'),
    path.join('src', 'src', 'proxy.ts'),
  ].map((candidate) => path.join(root, candidate));
  const middlewareCandidates = [
    'middleware.js',
    'middleware.ts',
    path.join('src', 'middleware.js'),
    path.join('src', 'middleware.ts'),
    path.join('src', 'src', 'middleware.js'),
    path.join('src', 'src', 'middleware.ts'),
  ].map((candidate) => path.join(root, candidate));

  for (const extension of ['js', 'ts']) {
    const nested = path.join(root, 'src', 'src', `proxy.${extension}`);
    const target = path.join(root, 'src', `proxy.${extension}`);
    if (exists(nested)) {
      if (!exists(target)) safeMove(nested, target);
      else safeUnlink(nested);
    }
  }

  const proxyExists = proxyCandidates.some((candidate) => exists(candidate));
  if (proxyExists) middlewareCandidates.forEach((candidate) => safeUnlink(candidate));

  for (const extension of ['js', 'ts']) {
    const nested = path.join(root, 'src', 'src', `proxy.${extension}`);
    if (exists(nested)) safeUnlink(nested);
  }

  console.log(`[prebuild] proxyExists=${proxyExists}`);
}

main();
