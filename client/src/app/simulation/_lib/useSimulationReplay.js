import { useRef, useState } from 'react';
import { cloneReplayData, compareSimulationReplay, createSimulationRunInput, prepareSimulationRunInput, REPLAY_SCHEMA, semanticRunEvents, validateSimulationReplayRecord } from './simulationReplayRuntime';
import { classifySimulationReplayStorageError, saveSimulationReplay } from './simulationReplayStorage';

export function useSimulationReplay(replayRecord = null) {
  const runInputRef = useRef(null);
  const runLockedRef = useRef(false);
  const preparedRunRef = useRef(null);
  const lastFrameRef = useRef(null);
  const savedRecordRef = useRef(null);
  const savingRef = useRef(false);
  const [replayStatus, setReplayStatus] = useState(null);

  function prepareRun(state) {
    if (!runInputRef.current) {
      runInputRef.current = replayRecord?.input ? cloneReplayData(replayRecord.input) : createSimulationRunInput(state);
      preparedRunRef.current = prepareSimulationRunInput(runInputRef.current);
    }
    return preparedRunRef.current;
  }

  async function completeReplay({ events, random, ending, tainted }) {
    if (savingRef.current) return;
    savingRef.current = true;
    if (tainted) {
      setReplayStatus({ kind: 'unavailable', text: '수동 조작이 들어간 경기는 동일 재경기로 보관하지 않습니다.' });
      savingRef.current = false;
      return;
    }
    let retryableRecord = null;
    try {
      if (!runInputRef.current || !lastFrameRef.current || !random) throw new Error('경기의 시작 조건 또는 종료 기록이 없습니다.');
      const actual = cloneReplayData({ events: semanticRunEvents(events), finalFrame: lastFrameRef.current, random,
        summary: { ending } });
      if (replayRecord) {
        const comparison = compareSimulationReplay(replayRecord, actual);
        savedRecordRef.current = replayRecord;
        setReplayStatus({ kind: comparison.matched ? 'matched' : 'different', comparison,
          text: comparison.matched
            ? `원본과 사건 ${comparison.actualEvents.toLocaleString()}개·최종 상태·종료 판정이 모두 일치합니다.`
            : `원본과 결과가 다릅니다.${comparison.firstDifference >= 0 ? ` 처음 다른 사건: ${comparison.firstDifference + 1}번째.` : ' 최종 상태·난수 또는 종료 판정 차이가 있습니다.'}` });
        return;
      }
      setReplayStatus({ kind: 'saving', text: '동일 재경기를 위해 시작 조건과 전체 사건을 보관 중입니다.' });
      const record = { schema: REPLAY_SCHEMA, id: globalThis.crypto.randomUUID(), finishedAt: Date.now(),
        input: runInputRef.current, ...actual, summary: {
          ...actual.summary, participantCount: runInputRef.current.initialFrame.survivors.length,
          winnerTeamName: actual.finalFrame.survivors[0]?.matchTeamName || actual.finalFrame.survivors[0]?.teamName || '',
          winnerName: actual.finalFrame.survivors[0]?.name || '',
        } };
      // Keep the current completed run replayable even if browser storage fills.
      validateSimulationReplayRecord(record);
      savedRecordRef.current = record;
      retryableRecord = record;
      await saveSimulationReplay(record);
      setReplayStatus({ kind: 'saved', text: '시작 조건과 전체 사건을 경기 보관함에 저장했습니다.' });
    } catch (error) {
      const classified = classifySimulationReplayStorageError(error);
      setReplayStatus({ kind: 'error', storageKind: classified.kind, canRetrySave: Boolean(retryableRecord),
        text: `경기 보관 실패: ${classified.text}` });
    } finally { savingRef.current = false; }
  }

  async function retrySaveReplay() {
    const record = savedRecordRef.current;
    if (!record || savingRef.current) return;
    savingRef.current = true;
    setReplayStatus({ kind: 'saving', text: '완주 기록을 다시 보관하는 중입니다.' });
    try {
      await saveSimulationReplay(record);
      setReplayStatus({ kind: 'saved', text: '완주 기록을 경기 보관함에 저장했습니다.' });
    } catch (error) {
      const classified = classifySimulationReplayStorageError(error);
      setReplayStatus({ kind: 'error', storageKind: classified.kind, canRetrySave: true,
        text: `경기 보관 실패: ${classified.text}` });
    } finally { savingRef.current = false; }
  }

  return { runInputRef, runLockedRef, lastFrameRef, savedRecordRef, replayStatus, prepareRun, completeReplay, retrySaveReplay };
}
