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

function exists(p) {
  try {
    return fs.existsSync(p);
  } catch {
    return false;
  }
}

function safeUnlink(p) {
  try {
    if (exists(p) && fs.statSync(p).isFile()) {
      fs.unlinkSync(p);
      console.log(`[prebuild] removed: ${p}`);
      return true;
    }
  } catch (e) {
    console.warn(`[prebuild] failed to remove ${p}: ${e?.message || e}`);
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
  } catch (e) {
    console.warn(`[prebuild] rename failed (${src} -> ${dst}): ${e?.message || e}`);
    // fallback: copy + unlink
    try {
      safeMkdir(path.dirname(dst));
      fs.copyFileSync(src, dst);
      fs.unlinkSync(src);
      console.log(`[prebuild] copied+removed: ${src} -> ${dst}`);
      return true;
    } catch (e2) {
      console.warn(`[prebuild] copy fallback failed (${src} -> ${dst}): ${e2?.message || e2}`);
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
  ].map((p) => path.join(root, p));

  const middlewareCandidates = [
    'middleware.js',
    'middleware.ts',
    path.join('src', 'middleware.js'),
    path.join('src', 'middleware.ts'),
    path.join('src', 'src', 'middleware.js'),
    path.join('src', 'src', 'middleware.ts'),
  ].map((p) => path.join(root, p));

  // 1) If proxy exists in src/src but not src, move it up.
  for (const ext of ['js', 'ts']) {
    const nested = path.join(root, 'src', 'src', `proxy.${ext}`);
    const target = path.join(root, 'src', `proxy.${ext}`);
    if (exists(nested)) {
      if (!exists(target)) {
        safeMove(nested, target);
      } else {
        // already have target; remove nested to avoid duplicates
        safeUnlink(nested);
      }
    }
  }

  // refresh proxy detection after move
  const proxyExists = proxyCandidates.some((p) => exists(p));

  // 2) If any proxy exists, remove all middleware variants.
  if (proxyExists) {
    for (const mw of middlewareCandidates) {
      safeUnlink(mw);
    }
  }

  // 3) Also remove any remaining nested proxy duplicates (src/src/proxy.*)
  for (const ext of ['js', 'ts']) {
    const nested = path.join(root, 'src', 'src', `proxy.${ext}`);
    if (exists(nested)) safeUnlink(nested);
  }

  console.log(`[prebuild] proxyExists=${proxyExists}`);
}

main();
