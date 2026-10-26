import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';

const rootUrl = new URL('../src/app/games/primitive-archive/_lib/', import.meta.url);
const loreSource = await readFile(new URL('primitiveArchiveAdvancementLore.js', rootUrl), 'utf8');
const loreUrl = `data:text/javascript;base64,${Buffer.from(loreSource).toString('base64')}`;
const dataSource = (await readFile(new URL('primitiveArchiveData.js', rootUrl), 'utf8'))
  .replace("from './primitiveArchiveAdvancementLore';", `from '${loreUrl}';`);
const dataUrl = `data:text/javascript;base64,${Buffer.from(dataSource).toString('base64')}`;
const data = await import(dataUrl);

const rules = {
  basic: { lp: 500, credits: 1000 },
  full: { lp: 1500, credits: 3000 },
  dailyLimit: { lp: 5000, credits: 10000 },
};
const contract = {
  contractVersion: 1,
  gameSlug: data.GAME_SLUG,
  baseDays: data.ARCHIVE_VICTORY_DAY,
  core: {
    technologies: data.TECHNOLOGY_TREE.filter((row) => row.archiveRequired).map((row) => row.id),
    civics: data.CIVIC_TREE.filter((row) => row.archiveRequired).map((row) => row.id),
  },
  full: {
    technologies: data.TECHNOLOGY_TREE.map((row) => row.id),
    civics: data.CIVIC_TREE.map((row) => row.id),
  },
  campRequirements: {
    archiveRoomLevel: 1,
    scribeDeskLevel: 1,
    libraryShelfLevel: 1,
  },
  bookRequirements: ['book_craft_guide', 'book_camp_manual'],
  survivorCount: 3,
  rules,
};

assert.ok(contract.core.technologies.length > 0 && contract.core.civics.length > 0);
assert.equal(contract.core.technologies.every((id) => contract.full.technologies.includes(id)), true);
assert.equal(contract.core.civics.every((id) => contract.full.civics.includes(id)), true);

const outputs = [
  [new URL('../src/app/games/primitive-archive/_lib/primitiveArchiveRewardRules.json', import.meta.url), rules],
  [new URL('../../server/generated/primitiveArchiveRewardContract.json', import.meta.url), contract],
];
const checkOnly = process.argv.includes('--check');
for (const [url, value] of outputs) {
  const expected = `${JSON.stringify(value, null, 2)}\n`;
  if (checkOnly) {
    const current = await readFile(url, 'utf8').catch(() => null);
    assert.equal(current, expected, `${url.pathname} is stale; regenerate reward contracts.`);
  } else {
    await writeFile(url, expected, 'utf8');
  }
}

if (checkOnly) process.stdout.write('Primitive Archive reward contracts are current.\n');
