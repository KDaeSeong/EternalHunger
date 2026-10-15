function isRetryable(error, specifier) {
  return error?.code === 'ERR_MODULE_NOT_FOUND'
    && specifier.startsWith('.')
    && !/\.[a-z]+$/i.test(specifier);
}

function retry(specifier, context, nextResolve, error) {
  if (!isRetryable(error, specifier)) throw error;
  return nextResolve(`${specifier}.js`, context);
}

export function resolve(specifier, context, nextResolve) {
  try {
    const result = nextResolve(specifier, context);
    if (result && typeof result.then === 'function') {
      return Promise.resolve(result).catch(error => retry(specifier, context, nextResolve, error));
    }
    return result;
  } catch (error) {
    return retry(specifier, context, nextResolve, error);
  }
}
