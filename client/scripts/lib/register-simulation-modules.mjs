import { registerHooks } from 'node:module';

// Next resolves extensionless local JS imports. Give headless runtime checks
// the same resolution without rewriting or mocking any simulation module.
registerHooks({
  resolve(specifier, context, nextResolve) {
    try {
      return nextResolve(specifier, context);
    } catch (error) {
      if (error.code !== 'ERR_MODULE_NOT_FOUND' || !specifier.startsWith('.') || /\.[a-z]+$/i.test(specifier)) throw error;
      return nextResolve(`${specifier}.js`, context);
    }
  },
});
