import { useMemo } from 'react';
import { GAMEPLAY_PERK_PRODUCTS } from '../../../utils/gameplayPerks';
import { getSponsorTeamOptions } from '../_lib/simulationSponsorPerks';

export default function SimulationSponsorPerkSetup({
  gameplayPerks = {},
  matchMode = 'squad',
  onTeamChange,
  onWithoutPerksChange,
  onRefresh,
  withoutPerks = false,
  selectedTeamId = '',
  survivors = [],
  disabled = false,
}) {
  const teams = useMemo(() => getSponsorTeamOptions(survivors), [survivors]);
  const selected = teams.find((team) => team.teamId === selectedTeamId) || teams[0] || null;
  const equipped = new Set(Array.isArray(gameplayPerks.equippedCodes) ? gameplayPerks.equippedCodes : []);
  const activeProductCodes = new Set((Array.isArray(gameplayPerks.products) ? gameplayPerks.products : [])
    .map((product) => product?.code));
  const products = GAMEPLAY_PERK_PRODUCTS.filter((product) => product?.gameSlug === 'eternal-hunger');

  return (
    <section className="simulation-sponsor-perks" aria-label="이번 경기 후원 특전">
      <div className="simulation-sponsor-perks__heading">
        <strong>이번 경기 후원 팀</strong>
        <span>{matchMode === 'solo' ? '솔로 모드: 선택 대원 1명에게 적용' : '관전자 팀 선택과 별개로 고정'}</span>
      </div>
      <label>
        후원 대상
        <select
          value={selected?.teamId || ''}
          disabled={disabled || !teams.length}
          onChange={(event) => onTeamChange?.(event.target.value)}
        >
          {teams.map((team) => (
            <option key={team.teamId} value={team.teamId}>
              {matchMode === 'solo' ? team.memberNames[0] : team.teamName} · {team.memberNames.join(', ')}
            </option>
          ))}
        </select>
      </label>
      <div className="simulation-sponsor-perks__products" aria-live="polite">
        {products.length ? products.map((product) => (
          <p key={product.code}>
            <strong>{product.name}</strong> · {product.description}{' '}
            {withoutPerks
              ? '이번 경기에서는 LP 특전을 적용하지 않습니다.'
              : gameplayPerks.status === 'error'
                ? '계정 특전을 확인하지 못해 이번 경기에는 적용되지 않습니다.'
              : gameplayPerks.status === 'ready' && !activeProductCodes.has(product.code)
                ? '현재 서비스 비활성 · 이번 경기에 적용되지 않습니다.'
              : equipped.has(product.code)
              ? `${selected?.teamName || '선택한 대상'}에 이번 경기 시작 시 적용됩니다.`
              : '미장착 · 특전 메뉴에서 장착하면 다음 경기 시작 때 적용됩니다.'}
          </p>
        )) : <p>장착된 경기 특전 정보를 확인할 수 없습니다. 특전 메뉴에서 장착한 뒤 경기를 시작할 수 있습니다.</p>}
      </div>
      {gameplayPerks.status === 'loading' ? <small>계정 특전 정보를 불러오는 중입니다.</small> : null}
      {gameplayPerks.status === 'guest' ? <small>게스트 경기에는 계정 후원 특전이 적용되지 않습니다.</small> : null}
      {gameplayPerks.status === 'error' ? <div>
        <small>계정 특전 정보를 읽지 못했습니다. 아래에서 특전 없이 시작하거나 다시 불러올 수 있습니다.</small>{' '}
        <button type="button" disabled={disabled} onClick={() => Promise.resolve(onRefresh?.()).catch(() => {})}>다시 불러오기</button>
      </div> : null}
      {gameplayPerks.status !== 'guest' ? <label className="simulation-sponsor-perks__skip">
        <input type="checkbox" checked={withoutPerks} disabled={disabled}
          onChange={(event) => onWithoutPerksChange?.(event.target.checked)} />
        이번 경기는 LP 특전 없이 시작
      </label> : null}
    </section>
  );
}
