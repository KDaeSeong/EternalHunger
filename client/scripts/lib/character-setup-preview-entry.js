import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import Modal from '../../src/app/characters/_components/CharacterAutoSetupModal.js';
import { createBlankCharacter } from '../../src/app/characters/_lib/characterEditorRuntime.js';
import fixture from '../../../server/tests/fixtures/character-setup-fixture.js';
import contract from '../../../server/utils/characterSetupContract.js';

// Local-only interaction fixture: the actual React modal, constructed response,
// no account, model invocation, API request or persistence of any kind.
function Fixture() {
  const [character, setCharacter] = useState(() => ({ ...createBlankCharacter('setup-preview'), name: '내 캐릭터' }));
  const [open, setOpen] = useState(true);
  const [applied, setApplied] = useState(0);
  const [requests, setRequests] = useState(0);
  const outcome = new URLSearchParams(window.location.search).get('outcome');
  async function request() {
    setRequests(count => count + 1);
    if (outcome === 'slow') await new Promise(resolve => setTimeout(resolve, 4000));
    if (outcome === 'failure') throw new Error('검사용 자료 읽기 실패: 기존 캐릭터는 유지됩니다.');
    if (outcome === 'invalid') return { schema: 'invalid' };
    const draft = contract.sanitizeCharacterSetup(fixture.makeSetup());
    if (outcome === 'unsupported') {
      draft.characterSkills.passive.enabled = false;
      draft.characterSkills.passive.statModifiers = {};
      draft.warnings.push('검사용 원작 중첩 패시브는 지원하지 않아 비활성입니다.');
    }
    return draft;
  }
  return <main style={{ padding: 16 }}>
    <h1>자동 설정 로컬 확인 · 실제 AI가 아닌 독립 입력</h1>
    <p role="status">요청 {requests} · 적용 {applied} · 서버 저장 0</p>
    <button onClick={() => setOpen(true)}>자동 설정 열기</button>
    <pre aria-label="현재 캐릭터">{JSON.stringify({ name: character.name, hp: character.stats.maxHp,
      skills: Object.fromEntries(Object.entries(character.characterSkills).map(([slot, skill]) => [slot, skill.enabled])) }, null, 2)}</pre>
    {open ? <Modal character={character} request={request} onClose={() => setOpen(false)} onApply={plan => {
      setCharacter(current => ({ ...current, ...plan.patch })); setApplied(count => count + 1); return { ok: true };
    }} /> : null}
  </main>;
}
createRoot(document.getElementById('root')).render(<Fixture />);
