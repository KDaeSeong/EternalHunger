// A closed/replaced dialog must not accept a late IndexedDB result or navigate.
// Tokens contain no record data; cancellation never deletes persistent records.
export function createReplayHistoryRequests() {
  let generation = 0;
  let pending = false;
  return {
    begin() { if (pending) return null; pending = true; return ++generation; },
    isCurrent(token) { return pending && token === generation; },
    finish(token) {
      if (!pending || token !== generation) return false;
      pending = false;
      return true;
    },
    cancel() { generation += 1; pending = false; },
  };
}

// An unsaved completed run can still be evaluated. Do not retain its full event
// journal in the history/evaluation list just to show this metadata.
export function replayHistoryMetadata(record) {
  return {
    id: record.id,
    finishedAt: record.finishedAt,
    summary: structuredClone(record.summary),
    runSeed: record.runSeed ?? record.input?.runSeed,
    unavailable: record.unavailable || '',
  };
}
