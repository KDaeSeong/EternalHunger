import { readdirSync } from 'node:fs';
import { join } from 'node:path';

// Generation and production build verification must fingerprint the same inputs.
export function getSimulationEngineSourcePaths(clientRoot) {
  const paths = ['src/app/simulation/tacticalSkillTable.js', '../shared/marketItemPolicy.cjs',
    '../shared/equipmentStatContract.cjs', '../shared/importedEquipmentStats.generated.json',
    'src/app/simulation/_generated/guestItemCatalog.generated.js'];
  for (const directory of ['src/app/simulation/_lib', 'src/utils']) {
    for (const name of readdirSync(join(clientRoot, directory))) {
      if (name.endsWith('.js')) paths.push(`${directory}/${name}`);
    }
  }
  return paths.sort();
}
