import Image from 'next/image';
import { normalizeWeaponType } from '../../../utils/equipmentCatalog';
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

            <label>
              사용 무기
              <select
                value={normalizeWeaponType(character.weaponType) || ''}
                onChange={(event) => onUpdateCharacter(id, 'weaponType', normalizeWeaponType(event.target.value))}
              >
                <option value="">랜덤</option>
                {WEAPON_TYPES_KO.map((weapon) => (
                  <option key={weapon} value={weapon}>{weapon}</option>
                ))}
              </select>
            </label>
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
