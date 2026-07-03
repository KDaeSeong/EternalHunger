// client/src/app/characters/page.js
'use client';

import { useEffect, useMemo, useState } from 'react';
import '../../styles/ERCharacters.css';
import '../../styles/Home.css';
import { applyErSubjectPreset, getErSubjectPreset } from '../../utils/erMeta';
import { apiGetCached, apiPost, clearApiGetCache, getToken } from '../../utils/api';
import { compactCharactersForSave, findCharacterSaveMismatches } from '../../utils/characterPayload';
import { readCompressedPreviewImage } from '../../utils/previewImage';
import { normalizeErStats } from '../../utils/erStats';
import SiteHeader from '../../components/SiteHeader';
import CharacterBasicEditModal from './_components/CharacterBasicEditModal';
import CharacterList from './_components/CharacterList';
import CharacterSkillConfigModal from './_components/CharacterSkillConfigModal';
import {
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
  const [editCharId, setEditCharId] = useState(null);
  const { handleBackdropPointerDown, handleBackdropPointerUp } = useModalBackdropClose();

  const editChar = useMemo(
    () => characters.find((c) => String(characterId(c)) === String(editCharId)) || null,
    [characters, editCharId]
  );

  const {
    activeSkillSlot,
    closeConfigModal,
    compileEditSkillDescription,
    configChar,
    editCharacterSkillCode,
    editCharacterSkillLevels,
    editCharacterSkills,
    editGoalGearTier,
    editTacticalSkill,
    openConfigModal,
    saveConfigModal,
    setActiveSkillSlot,
    setEditCharacterSkillCode,
    setEditCharacterSkillLevels,
    setEditGoalGearTier,
    setEditTacticalSkill,
    updateEditSkill,
    updateEditSkillLevelValue,
  } = useCharacterSkillConfigEditor({ characters, setCharacters });

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


  const addCharacter = () => {
    const id = Date.now();
    const newChar = createBlankCharacter(id);
    setCharacters((prev) => [...prev, newChar]);
    setEditCharId(id);
  };

  const removeCharacter = (targetId) => {
    if (!confirm('이 캐릭터를 목록에서 삭제할까요? 저장 전까지 서버에는 반영되지 않습니다.')) return;
    setCharacters((prev) => prev.filter((char) => String(characterId(char)) !== String(targetId)));
    setDirtyPreviewIds((prev) => {
      const next = new Set(prev);
      next.delete(String(targetId));
      return next;
    });
  };

  const updateCharacter = (targetId, field, value) => {
    setCharacters((prev) =>
      prev.map((char) => {
        const id = characterId(char);
        if (String(id) !== String(targetId)) return char;
        return { ...char, [field]: value };
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
    setCharacters((prev) =>
      prev.map((char) => {
        const id = characterId(char);
        if (String(id) !== String(targetId)) return char;
        return applyErSubjectPreset(char, { replaceDefaultTactical: true, statBiasScale: 1 });
      })
    );
    alert(`ER 프리셋 적용: ${preset.names?.[0] || preset.code} / ${preset.primaryWeapon} / ${preset.tacticalSkill}`);
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

  const handleAiAnalyze = async (targetId) => {
    const text = prompt('캐릭터 설정 텍스트를 붙여넣어 주세요.');
    if (!text || text.length < 2) return;

    try {
      alert('AI가 분석 중입니다. 잠시만 기다려주세요.');
      const data = await apiPost('/analyze', { text });
      const charName = data.name || '이름없음';
      const gender = data.gender || '여';
      const newStats = normalizeErStats(data.stats);

      setCharacters((prev) =>
        prev.map((char) => {
          const id = characterId(char);
          if (String(id) !== String(targetId)) return char;
          return { ...char, name: charName, gender, stats: newStats };
        })
      );

      alert(`분석 완료\n이름: ${charName}\n성별: ${gender}`);
    } catch (error) {
      console.error(error);
      alert('AI 연결 오류가 발생했습니다. 서버 상태를 확인해 주세요.');
    }
  };

  const saveCharacters = async () => {
    const token = getToken();
    if (characters.length === 0) return alert('저장할 캐릭터가 없습니다.');
    if (!window.confirm('현재 캐릭터 목록을 저장하시겠습니까? 기존 서버 데이터는 이 목록으로 갱신됩니다.')) return;

    try {
      if (!token) throw new Error('로그인이 필요합니다.');
      const payload = compactCharactersForSave(characters, { previewImageIds: dirtyPreviewIds });
      const result = await apiPost('/characters/save', payload, { timeoutMs: 30000 });
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
      if (normalizedSaved.length !== payload.length) {
        throw new Error(`저장된 캐릭터 수가 맞지 않습니다. 요청 ${payload.length}명 / 저장 ${normalizedSaved.length}명`);
      }
      const mismatches = findCharacterSaveMismatches(payload, normalizedSaved, { saveResults: result?.saveResults });
      if (mismatches.length > 0) {
        throw new Error(formatSaveMismatchMessage(mismatches));
      }
      setCharacters(normalizedSaved);
      setDirtyPreviewIds(new Set());
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
      <div className="page-header">
        <div className="page-header-row">
          <div className="page-header-copy">
            <h1>캐릭터 설정</h1>
            <p>참가 캐릭터를 추가하고 기본 정보를 관리합니다.</p>
          </div>
          <div className="page-header-actions">
            <button type="button" className="page-header-action-btn secondary" onClick={addCharacter}>
              + 캐릭터 추가
            </button>
            <button type="button" className="page-header-action-btn primary" onClick={saveCharacters}>
              변경사항 저장
            </button>
          </div>
        </div>
      </div>

      <CharacterList
        characters={characters}
        onAnalyze={handleAiAnalyze}
        onApplyErPreset={applyErPresetToCharacter}
        onEditBasic={setEditCharId}
        onOpenConfig={openConfigModal}
        onRemove={removeCharacter}
      />

      <CharacterBasicEditModal
        character={editChar}
        onBackdropPointerDown={handleBackdropPointerDown}
        onBackdropPointerUp={handleBackdropPointerUp}
        onClose={closeEditModal}
        onImageUpload={handleImageUpload}
        onUpdateCharacter={updateCharacter}
      />

      <CharacterSkillConfigModal
        character={configChar}
        editCharacterSkillCode={editCharacterSkillCode}
        editCharacterSkillLevels={editCharacterSkillLevels}
        editCharacterSkills={editCharacterSkills}
        activeSkillSlot={activeSkillSlot}
        editGoalGearTier={editGoalGearTier}
        editTacticalSkill={editTacticalSkill}
        onBackdropPointerDown={handleBackdropPointerDown}
        onBackdropPointerUp={handleBackdropPointerUp}
        onClose={closeConfigModal}
        onCompileSkillDescription={compileEditSkillDescription}
        onSave={saveConfigModal}
        onSetActiveSkillSlot={setActiveSkillSlot}
        onSetCharacterSkillCode={setEditCharacterSkillCode}
        onSetCharacterSkillLevels={setEditCharacterSkillLevels}
        onSetGoalGearTier={setEditGoalGearTier}
        onSetTacticalSkill={setEditTacticalSkill}
        onUpdateSkill={updateEditSkill}
        onUpdateSkillLevelValue={updateEditSkillLevelValue}
      />

    </main>
  );
}
