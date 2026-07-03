import { normalizeWeaponType } from '../../../utils/equipmentCatalog';
import { normalizeSupportedTacSkill } from '../../simulation/tacticalSkillTable';
import { characterId, gearTierLabel } from '../_lib/characterEditorRuntime';

function CharacterList({
  characters,
  onAnalyze,
  onApplyErPreset,
  onEditBasic,
  onOpenConfig,
  onRemove,
}) {
  return (
    <div id="characterRowContainer" className="character-list-compact">
      {(Array.isArray(characters) ? characters : []).map((char) => {
        const realId = characterId(char);
        const weapon = normalizeWeaponType(char.weaponType) || '랜덤';
        const tactical = normalizeSupportedTacSkill(char.tacticalSkill) || '블링크';
        const qSkill = char?.characterSkills?.q;
        return (
          <div className="characterRowContainer2 character-list-card" key={realId}>
            <div className="character-summary-avatar">
              {char.previewImage ? (
                <img src={char.previewImage} alt={`${char.name || '캐릭터'} 미리보기`} />
              ) : (
                <span>이미지 없음</span>
              )}
            </div>

            <div className="character-summary-main">
              <div className="character-summary-top">
                <strong>{char.name || '이름 없음'}</strong>
                <span>{char.gender || '여'}</span>
              </div>
              <div className="character-summary-meta">
                <span>무기: {weapon}</span>
                <span>목표: {gearTierLabel(char.goalGearTier)}</span>
                <span>전술: {tactical}</span>
                {qSkill?.enabled ? <span>Q: {qSkill.name || '사용자 Q'}</span> : null}
              </div>
            </div>

            <div className="character-summary-actions">
              <button type="button" onClick={() => onEditBasic(realId)}>기본 정보</button>
              <button type="button" onClick={() => onOpenConfig(char)}>목표/스킬</button>
              <button type="button" onClick={() => onAnalyze(realId)}>AI 분석</button>
              <button type="button" onClick={() => onApplyErPreset(realId)}>ER 프리셋</button>
              <button type="button" className="danger" onClick={() => onRemove(realId)}>삭제</button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default CharacterList;
