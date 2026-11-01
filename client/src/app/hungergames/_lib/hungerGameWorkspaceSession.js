// Presentation ownership only. No request credentials or editor drafts enter a pack.
export function createHungerWorkspaceSession({ captureSession, isCurrentSession }) {
  let mounted = false;
  let ready = false;
  let revision = 0;
  let sequence = 0;
  let pending = null;
  const canEdit = (expected = revision) => mounted && ready && !pending && expected === revision;
  const owns = (request) => mounted && Boolean(request) && pending === request;
  return {
    activate() { mounted = true; },
    dispose() { mounted = false; ready = false; pending = null; sequence += 1; },
    setReady(value) { ready = Boolean(value); },
    revision: () => revision,
    canEdit,
    replace() { revision += 1; return revision; },
    begin(account = false) {
      if (!canEdit()) return null;
      const session = account ? captureSession() : null;
      if (account && (!session?.scope || session.scope === 'anon')) return null;
      pending = { id: ++sequence, revision, session };
      return pending;
    },
    current(request) {
      return owns(request) && request.revision === revision
        && (!request.session || isCurrentSession(request.session));
    },
    finish(request) {
      if (!owns(request)) return false;
      pending = null;
      return true;
    },
    authChanged() {
      if (!pending?.session || isCurrentSession(pending.session)) return false;
      pending = null; sequence += 1;
      return true;
    },
  };
}
