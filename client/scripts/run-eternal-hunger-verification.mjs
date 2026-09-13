import { spawn } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, readdirSync, writeFileSync, createWriteStream } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

// Keep terminal output and the real exit code together across interrupted tool
// observations. A stale "running" result is NOT evidence of a live process.
const commands = { full: 'npm run check:eternal-hunger', unit: 'node scripts/check-character-status-skills.mjs' };
const mode = process.argv[2] || 'full';
if (!Object.hasOwn(commands, mode)) throw Error('Use full or unit.');
const root = fileURLToPath(new URL('../', import.meta.url));
const runId = `${new Date().toISOString().replaceAll(':', '-')}-${randomUUID()}`;
const directory = join(root, '.verification-runs', runId);
mkdirSync(directory, { recursive: true });
const log = createWriteStream(join(directory, 'output.log'), { flags: 'wx' });
const resultPath = join(directory, 'result.json');
function fingerprint() {
  const paths = ['src/app/simulation/tacticalSkillTable.js'];
  for (const dir of ['src/app/simulation/_lib', 'src/utils']) {
    for (const file of readdirSync(join(root, dir))) if (file.endsWith('.js')) paths.push(`${dir}/${file}`);
  }
  const hash = createHash('sha256');
  for (const path of paths.sort()) hash.update(path).update('\0').update(readFileSync(join(root, path), 'utf8').replaceAll('\r\n', '\n')).update('\0');
  return hash.digest('hex');
}
const result = { runId, command: commands[mode], startedAt: new Date().toISOString(), pid: process.pid,
  engineBefore: fingerprint(), status: 'running', scope: 'Named command only; not balance, fun or overall-goal acceptance.' };
const persist = () => writeFileSync(resultPath, `${JSON.stringify(result, null, 2)}\n`);
persist(); console.log(`VERIFICATION_RESULT ${resultPath}`);
try {
  const outcome = await new Promise((resolve, reject) => {
    const child = process.platform === 'win32'
      ? spawn(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', commands[mode]], { cwd: root, windowsHide: true })
      : spawn('/bin/sh', ['-c', commands[mode]], { cwd: root });
    child.stdout.on('data', (chunk) => { log.write(chunk); process.stdout.write(chunk); });
    child.stderr.on('data', (chunk) => { log.write(chunk); process.stderr.write(chunk); });
    child.once('error', reject); child.once('close', (code, signal) => resolve({ code, signal }));
  });
  result.exitCode = outcome.code; result.signal = outcome.signal;
  result.engineAfter = fingerprint(); result.sameEngine = result.engineBefore === result.engineAfter;
  result.status = outcome.code === 0 && result.sameEngine ? 'passed' : 'failed';
  process.exitCode = result.status === 'passed' ? 0 : outcome.code || 1;
} catch (error) {
  result.status = 'failed'; result.error = String(error); process.exitCode = 1;
} finally {
  await new Promise((resolve, reject) => { log.once('error', reject); log.end(resolve); });
  result.finishedAt = new Date().toISOString(); persist();
  console.log(`VERIFICATION_COMPLETE ${JSON.stringify(result)}`);
}
