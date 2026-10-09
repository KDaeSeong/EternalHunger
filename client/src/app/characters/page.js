// client/src/app/characters/page.js
'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import '../../styles/ERCharacters.css';
import '../../styles/Home.css';
import { getErSubjectPreset } from '../../utils/erMeta';
import { apiGetCached, apiPost, clearApiGetCache, getToken } from '../../utils/api';
import { compactCharactersForSave, findCharacterSaveMismatches } from '../../utils/characterPayload';
import { readCompressedPreviewImage } from '../../utils/previewImage';
import { Plus } from 'lucide-react';
import PageHeader from '../../components/PageHeader';
import SiteHeader from '../../components/SiteHeader';
import CharacterBasicEditModal from './_components/CharacterBasicEditModal';
import CharacterList from './_components/CharacterList';
import CharacterSkillConfigModal from './_components/CharacterSkillConfigModal';
import CharacterAutoSetupModal from './_components/CharacterAutoSetupModal';
import {
  applyErPresetForEditing,
  characterId,
  createBlankCharacter,
  formatSaveMismatchMessage,
  loadCharactersAfterSave,
  normalizeCharacterEditorList,
  syncTokenCookie,
} from './_lib/characterEditorRuntime';
import { useCharacterSkillConfigEditor } from './_lib/useCharacterSkillConfigEditor';
import { useModalBackdropClose } from '../_lib/useModalBackdropClose';

export default function CharactersPage() {
  const [characters, setCharacters] = useState([]);
  const [dirtyPreviewIds, setDirtyPreviewIds] = useState(() => new Set());
  // Server IDs removed from the list since the last save. Deletion is explicit:
  // the server keeps every character that is not listed here.
  const [deletedIds, setDeletedIds] = useState(() => new Set());
  const [dirty, setDirty] = useState(false);
  const [editCharId, setEditCharId] = useState(null);
  const [setupCharId, setSetupCharId] = useState(null);
  const [setupNotice, setSetupNotice] = useState('');
  const [filterText, setFilterText] = useState('');
  const [loaded, setLoaded] = useState(false);
  const { handleBackdropPointerDown, handleBackdropPointerUp } = useModalBackdropClose();

  const setCharactersFromSkillEditor = useCallback((updater) => {
    setDirty(true);
    setCharacters(updater);
  }, []);

  const visibleCharacters = useMemo(() => {
    const needle = filterText.trim().toLowerCase();
    if (!needle) return characters;
    return characters.filter((char) => [
      char?.name,
      char?.weaponType,
      ...(Array.isArray(char?.erWeapons) ? char.erWeapons : []),
    ].join(' ').toLowerCase().includes(needle));
  }, [characters, filterText]);

  const editChar = useMemo(
    () => characters.find((c) => String(characterId(c)) === String(editCharId)) || null,
    [characters, editCharId]
  );
  const setupChar = characters.find(char => String(characterId(char)) === String(setupCharId)) || null;

  const {
    activeSkillSlot,
    closeConfigModal,
    compileEditSkillDescription,
    configChar,
    editCharacterSkillCode,
    editCharacterSkillLevels,
    editCharacterSkills,
    editUniqueResource,
    editTacticalSkill,
    enableAllEditSkills,
    manualSkillInputEnabled,
    openConfigModal,
    saveConfigModal,
    setActiveSkillSlot,
    setEditCharacterSkillCode,
    setEditCharacterSkillLevels,
    setEditUniqueResource,
    setEditTacticalSkill,
    setManualSkillInputEnabled,
    skillCompileNotice,
    updateEditSkill,
    updateEditSkillLevelValue,
  } = useCharacterSkillConfigEditor({ characters, setCharacters: setCharactersFromSkillEditor });

  async function fetchCharacters() {
    const token = getToken();
    if (!token) return [];
    try {
      const data = await apiGetCached('/characters?view=editor', { ttlMs: 8000, timeoutMs: 20000 });
      const normalized = normalizeCharacterEditorList(data);
      setCharacters(normalized);
      return normalized;
    } catch (err) {
      console.error('캐릭터 로드 실패:', err);
      return [];
    } finally {
      setLoaded(true);
    }
  }

  useEffect(() => {
    const token = getToken();
    if (!token) {
      alert('로그인이 필요합니다.');
      window.location.href = '/login';
      return;
    }
    syncTokenCookie(token);

    const timer = window.setTimeout(() => {
      fetchCharacters();
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);


  useEffect(() => {
    if (!dirty) return undefined;
    const warnBeforeLeave = (event) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warnBeforeLeave);
    return () => window.removeEventListener('beforeunload', warnBeforeLeave);
  }, [dirty]);

  const addCharacter = () => {
    const id = Date.now();
    const newChar = createBlankCharacter(id);
    setCharacters((prev) => [...prev, newChar]);
    setDirty(true);
    setEditCharId(id);
  };

  const removeCharacter = (targetId) => {
    if (!confirm('이 캐릭터를 목록에서 삭제할까요? 저장 전까지 서버에는 반영되지 않습니다.')) return;
    const target = characters.find((char) => String(characterId(char)) === String(targetId));
    const serverId = String(target?._id || '').trim();
    if (/^[a-f0-9]{24}$/i.test(serverId)) {
      setDeletedIds((prev) => new Set([...prev, serverId]));
    }
    setDirty(true);
    setCharacters((prev) => prev.filter((char) => String(characterId(char)) !== String(targetId)));
    setDirtyPreviewIds((prev) => {
      const next = new Set(prev);
      next.delete(String(targetId));
      return next;
    });
  };

  const updateCharacter = (targetId, field, value) => {
    const patch = field && typeof field === 'object' ? field : { [field]: value };
    setDirty(true);
    setCharacters((prev) =>
      prev.map((char) => {
        const id = characterId(char);
        if (String(id) !== String(targetId)) return char;
        return { ...char, ...patch };
      })
    );
  };

  const applyErPresetToCharacter = (targetId) => {
    const current = characters.find((char) => String(characterId(char)) === String(targetId));
    const preset = getErSubjectPreset(current);
    if (!preset) {
      alert('이름과 일치하는 ER 실험체 프리셋을 찾지 못했습니다.');
      return;
    }
    setDirty(true);
    setCharacters((prev) =>
      prev.map((char) => {
        const id = characterId(char);
        if (String(id) !== String(targetId)) return char;
        return applyErPresetForEditing(char);
      })
    );
    alert(`간이 ER 전투 성향 적용: ${preset.names?.[0] || preset.code} / ${preset.primaryWeapon} / ${preset.tacticalSkill}\n기본 능력치는 유지하며 경기 시작 때 규칙에 따른 보정을 한 번 적용합니다.\n고유 QWER·패시브를 가져오는 기능은 아닙니다. 고유 스킬은 자동 설정에서 작성할 수 있습니다.`);
  };

  const closeEditModal = () => setEditCharId(null);

  const handleImageUpload = (e, targetId) => {
    const file = e.target.files?.[0];
    if (!file) return;

    readCompressedPreviewImage(file)
      .then((preview) => {
        if (!preview) {
          alert('이미지 용량이 너무 커서 미리보기를 저장하지 못했습니다.');
          return;
        }
        updateCharacter(targetId, 'previewImage', preview);
        setDirtyPreviewIds((prev) => new Set([...prev, String(targetId)]));
      })
      .catch(() => {
        alert('이미지를 읽지 못했습니다.');
      });
  };

  const openAutoSetup = (targetId) => { setEditCharId(null); setSetupCharId(targetId); setSetupNotice(''); };
  const closeAutoSetup = useCallback(() => setSetupCharId(null), []);
  const applyAutoSetup = (plan) => {
    if (!setupChar) return { ok: false, message: '편집할 캐릭터를 찾지 못했습니다.' };
    updateCharacter(characterId(setupChar), plan.patch);
    setSetupNotice(`${setupChar.name || plan.draft.name}: ${plan.applied.join(' · ')} 초안을 편집 목록에 반영했습니다. 서버에 저장하려면 ‘지금 저장’을 눌러 주세요.`);
    return { ok: true };
  };

  const saveCharacters = async () => {
    const token = getToken();
    if (characters.length === 0 && deletedIds.size === 0) return alert('저장할 캐릭터가 없습니다.');
    const deleteNotice = deletedIds.size > 0 ? `\n삭제한 캐릭터 ${deletedIds.size}명은 서버에서도 삭제되며 전적도 함께 사라집니다.` : '';
    if (!window.confirm(`변경사항을 저장하시겠습니까?${deleteNotice}`)) return;

    try {
      if (!token) throw new Error('로그인이 필요합니다.');
      const payload = compactCharactersForSave(characters, { previewImageIds: dirtyPreviewIds });
      const result = await apiPost('/characters/save', { characters: payload, deletedIds: [...deletedIds] }, { timeoutMs: 30000 });
      clearApiGetCache('/characters');
      if (Array.isArray(result?.missingIds) && result.missingIds.length > 0) {
        throw new Error('일부 캐릭터를 찾을 수 없습니다. 새로고침 후 다시 저장해 주세요.');
      }
      if (result?.receivedCount !== undefined) {
        const receivedCount = Number(result.receivedCount || 0);
        const appliedCount = Number(result.updatedCount || 0) + Number(result.createdCount || 0);
        if (receivedCount !== payload.length || appliedCount !== payload.length) {
          throw new Error(`저장 반영 건수가 맞지 않습니다. 요청 ${payload.length}명 / 반영 ${appliedCount}명`);
        }
      }
      const savedCharacters = await loadCharactersAfterSave(result);
      const normalizedSaved = normalizeCharacterEditorList(savedCharacters);
      // The server keeps characters this page did not list (e.g. added in another
      // tab), so only the characters we sent must match.
      const mismatches = findCharacterSaveMismatches(payload, normalizedSaved, { saveResults: result?.saveResults });
      if (mismatches.length > 0) {
        throw new Error(formatSaveMismatchMessage(mismatches));
      }
      setCharacters(normalizedSaved);
      setDirtyPreviewIds(new Set());
      setDeletedIds(new Set());
      setDirty(false);
      alert('저장 완료');
    } catch (error) {
      console.error(error);
      const status = Number(error?.status || error?.response?.status || 0);
      alert(
        status === 413
          ? '저장 데이터가 너무 큽니다. 이미지 용량을 줄인 뒤 다시 시도해 주세요.'
          : `저장 실패: ${error?.message || '서버 오류'}`
      );
    }
  };

  return (
    <main className="characters-page-shell">
      <SiteHeader className="characters-site-header" />
      <div className="ui-page cl">
        <PageHeader
          title="캐릭터 설정"
          description={`경기에 나갈 캐릭터를 추가하고 무기와 전술 스킬을 정합니다.${loaded ? ` 지금 ${characters.length}명이 있습니다.` : ''}`}
          actions={(
            <>
              <button type="button" className="ui-button ui-button--quiet" onClick={addCharacter}>
                <Plus size={16} aria-hidden="true" />
                캐릭터 추가
              </button>
              <button type="button" className="ui-button ui-button--primary" onClick={saveCharacters}>
                변경사항 저장
              </button>
            </>
          )}
        />

        {characters.length > 6 ? (
          <input
            type="search"
            className="ui-input cl-filter"
            value={filterText}
            onChange={(event) => setFilterText(event.target.value)}
            placeholder="이름이나 무기로 찾기"
            aria-label="캐릭터 찾기"
          />
        ) : null}

        {!loaded && characters.length === 0 ? (
          <p className="ui-empty">캐릭터를 불러오는 중입니다.</p>
        ) : characters.length === 0 ? (
          <div className="ui-panel ui-empty cl-empty">
            <p>아직 캐릭터가 없습니다. 캐릭터를 추가해 첫 경기를 준비하세요.</p>
            <button type="button" className="ui-button ui-button--primary ui-button--small" onClick={addCharacter}>캐릭터 추가</button>
          </div>
        ) : visibleCharacters.length === 0 ? (
          <p className="ui-empty">‘{filterText.trim()}’에 맞는 캐릭터가 없습니다.</p>
        ) : (
          <CharacterList
            characters={visibleCharacters}
            onAutoSetup={openAutoSetup}
            onApplyErPreset={applyErPresetToCharacter}
            onEditBasic={setEditCharId}
            onOpenConfig={openConfigModal}
            onRemove={removeCharacter}
          />
        )}
      </div>

      {dirty ? (
        <div className="cl-savebar" role="status">
          <span>저장하지 않은 변경사항이 있습니다.</span>
          <button type="button" className="ui-button ui-button--primary" onClick={saveCharacters}>지금 저장</button>
        </div>
      ) : null}
      {setupNotice ? <p className="character-setup-notice" role="status">{setupNotice}</p> : null}

      <CharacterBasicEditModal
        character={editChar}
        onBackdropPointerDown={handleBackdropPointerDown}
        onBackdropPointerUp={handleBackdropPointerUp}
        onClose={closeEditModal}
        onImageUpload={handleImageUpload}
        onUpdateCharacter={updateCharacter}
        onAutoSetup={openAutoSetup}
      />
      {setupChar ? <CharacterAutoSetupModal key={String(characterId(setupChar))}
        character={setupChar} onClose={closeAutoSetup} onApply={applyAutoSetup} /> : null}

      <CharacterSkillConfigModal
        character={configChar}
        editCharacterSkillCode={editCharacterSkillCode}
        editCharacterSkillLevels={editCharacterSkillLevels}
        editCharacterSkills={editCharacterSkills}
        editUniqueResource={editUniqueResource}
        activeSkillSlot={activeSkillSlot}
        editTacticalSkill={editTacticalSkill}
        manualSkillInputEnabled={manualSkillInputEnabled}
        skillCompileNotice={skillCompileNotice}
        onBackdropPointerDown={handleBackdropPointerDown}
        onBackdropPointerUp={handleBackdropPointerUp}
        onClose={closeConfigModal}
        onCompileSkillDescription={compileEditSkillDescription}
        onSave={saveConfigModal}
        onSetActiveSkillSlot={setActiveSkillSlot}
        onSetCharacterSkillCode={setEditCharacterSkillCode}
        onSetCharacterSkillLevels={setEditCharacterSkillLevels}
        onSetUniqueResource={setEditUniqueResource}
        onSetManualSkillInputEnabled={setManualSkillInputEnabled}
        onSetTacticalSkill={setEditTacticalSkill}
        onUpdateSkill={updateEditSkill}
        onEnableAllSkills={enableAllEditSkills}
        onUpdateSkillLevelValue={updateEditSkillLevelValue}
      />

    </main>
  );
}
