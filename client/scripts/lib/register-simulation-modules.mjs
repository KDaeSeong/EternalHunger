import * as moduleApi from 'node:module';
import { resolve } from './simulation-module-resolution.mjs';

// Next resolves extensionless local JS imports. Give headless runtime checks
// the same resolution without rewriting or mocking any simulation module.
const hooks = { resolve };

if (typeof moduleApi.registerHooks === 'function') {
  moduleApi.registerHooks(hooks);
} else if (typeof moduleApi.register === 'function') {
  moduleApi.register('./simulation-module-resolution.mjs', import.meta.url);
} else {
  throw new Error('This Node.js version does not provide module customization hooks.');
}
