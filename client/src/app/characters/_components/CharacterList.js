import Image from 'next/image';
import { normalizeWeaponType, normalizeWeaponTypes } from '../../../utils/equipmentCatalog';
import { CHARACTER_SKILL_SLOT_LABELS, CHARACTER_SKILL_SLOTS } from '../../../utils/characterSkillCompiler';
import { normalizeSupportedTacSkill } from '../../simulation/tacticalSkillTable';
import OverflowMenu from '../../../components/OverflowMenu';
import { characterId } from '../_lib/characterEditorRuntime';

function CharacterList({
  characters,
  onAnalyze,
  onApplyErPreset,
  onEditBasic,
  onOpenConfig,
  onRemove,
}) {
  return (
    <div className="cl-grid">
      {(Array.isArray(characters) ? characters : []).map((char) => {
        const realId = characterId(char);
        const configuredWeapons = normalizeWeaponTypes(char.erWeapons);
        const legacyWeapon = normalizeWeaponType(char.weaponType);
        const weapons = configuredWeapons.length ? configuredWeapons : (legacyWeapon ? [legacyWeapon] : []);
        const weapon = weapons.length > 2
          ? `${weapons.slice(0, 2).join(' · ')} 외 ${weapons.length - 2}종`
          : weapons.join(' · ') || '프리셋 무작위';
        const tactical = normalizeSupportedTacSkill(char.tacticalSkill) || '블링크';
        const activeSkills = CHARACTER_SKILL_SLOTS
          .map((slot) => [slot, char?.characterSkills?.[slot]])
          .filter(([, skill]) => skill?.enabled);
        return (
          <article className="cl-card" key={realId}>
            <div className="cl-card__avatar">
              {char.previewImage ? (
                <Image
                  src={char.previewImage}
                  alt=""
                  width={56}
                  height={56}
                  unoptimized
                />
              ) : (
                <span aria-hidden="true">{String(char.name || '?').trim().slice(0, 1) || '?'}</span>
              )}
            </div>

            <div className="cl-card__main">
              <h2 className="cl-card__name">
                {char.name || '이름 없음'}
                <span className="cl-card__gender">{char.gender || '여'}</span>
              </h2>
              <p className="cl-card__meta">
                <span>{weapon}</span>
                <span>전술 {tactical}</span>
              </p>
              {activeSkills.length ? (
                <p className="cl-card__skills">
                  {activeSkills.map(([slot, skill]) => `${CHARACTER_SKILL_SLOT_LABELS[slot]} ${skill.name || '사용'}`).join(' · ')}
                </p>
              ) : null}
            </div>

            <div className="cl-card__actions">
              <button type="button" className="ui-button ui-button--quiet ui-button--small" onClick={() => onEditBasic(realId)}>기본 정보</button>
              <button type="button" className="ui-button ui-button--quiet ui-button--small" onClick={() => onOpenConfig(char)}>전술·스킬</button>
              <OverflowMenu
                label={`${char.name || '캐릭터'} 메뉴 더보기`}
                items={[
                  { label: 'AI로 설정 분석', onSelect: () => onAnalyze(realId) },
                  { label: 'ER 프리셋 적용', onSelect: () => onApplyErPreset(realId) },
                  { label: '목록에서 삭제', onSelect: () => onRemove(realId), danger: true },
                ]}
              />
            </div>
          </article>
        );
      })}
    </div>
  );
}

export default CharacterList;
