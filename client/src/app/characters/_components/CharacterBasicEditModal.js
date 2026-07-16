import Image from 'next/image';
import {
  normalizeWeaponType,
  normalizeWeaponTypes,
} from '../../../utils/equipmentCatalog';
import { WEAPON_TYPES_KO, characterId } from '../_lib/characterEditorRuntime';

function CharacterBasicEditModal({
  character,
  onBackdropPointerDown,
  onBackdropPointerUp,
  onClose,
  onImageUpload,
  onUpdateCharacter,
}) {
  if (!character) return null;
  const id = characterId(character);
  const configuredWeapons = normalizeWeaponTypes(character.erWeapons);
  const legacyWeapon = normalizeWeaponType(character.weaponType);
  const selectedWeapons = configuredWeapons.length ? configuredWeapons : (legacyWeapon ? [legacyWeapon] : []);

  const updateWeapons = (nextWeapons) => {
    const erWeapons = normalizeWeaponTypes(nextWeapons);
    onUpdateCharacter(id, {
      erWeapons,
      weaponType: erWeapons[0] || '',
    });
  };

  const toggleWeapon = (weapon) => {
    updateWeapons(selectedWeapons.includes(weapon)
      ? selectedWeapons.filter((entry) => entry !== weapon)
      : [...selectedWeapons, weapon]);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="character-edit-backdrop"
      onPointerDown={onBackdropPointerDown}
      onPointerUp={(event) => onBackdropPointerUp(event, onClose)}
    >
      <div className="character-edit-modal">
        <div className="character-edit-head">
          <div>
            <p>기본 정보 편집</p>
            <h2>{character.name || '이름 없음'}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="닫기">×</button>
        </div>

        <div className="character-edit-grid">
          <div className="character-edit-image">
            {character.previewImage ? (
              <Image
                src={character.previewImage}
                alt="미리보기"
                width={180}
                height={180}
                unoptimized
              />
            ) : (
              <span>이미지 없음</span>
            )}
            <label>
              이미지 선택
              <input
                type="file"
                accept="image/*"
                onChange={(event) => onImageUpload(event, id)}
              />
            </label>
          </div>

          <div className="character-edit-fields">
            <label>
              이름
              <input
                type="text"
                value={character.name || ''}
                onChange={(event) => onUpdateCharacter(id, 'name', event.target.value)}
                placeholder="캐릭터 이름"
              />
            </label>

            <label>
              성별
              <select
                value={character.gender || '여'}
                onChange={(event) => onUpdateCharacter(id, 'gender', event.target.value)}
              >
                <option value="여">여</option>
                <option value="남">남</option>
                <option value="무성">무성</option>
              </select>
            </label>

            <fieldset className="character-weapon-picker">
              <legend className="sr-only">사용 가능 무기</legend>
              <div className="character-weapon-picker-head">
                <strong>사용 가능 무기</strong>
                <span>{selectedWeapons.length ? `${selectedWeapons.length}종 선택` : '프리셋 무작위'}</span>
                {selectedWeapons.length ? (
                  <button type="button" onClick={() => updateWeapons([])}>전체 해제</button>
                ) : null}
              </div>
              <div className="character-weapon-options">
                {WEAPON_TYPES_KO.map((weapon) => {
                  const checked = selectedWeapons.includes(weapon);
                  return (
                    <label key={weapon} className={checked ? 'selected' : ''}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleWeapon(weapon)}
                      />
                      <span>{weapon}</span>
                    </label>
                  );
                })}
              </div>
              <small>
                {selectedWeapons.length
                  ? `경기 시작 시 ${selectedWeapons.length}종 중 하나 선택`
                  : '경기 시작 시 캐릭터 프리셋 무기 중 하나 선택'}
              </small>
            </fieldset>
          </div>
        </div>

        <div className="character-edit-actions">
          <button type="button" onClick={onClose}>닫기</button>
        </div>
      </div>
    </div>
  );
}

export default CharacterBasicEditModal;
