import Link from 'next/link';
import { gameplayPerkNames } from '../../../../utils/gameplayPerks';
import { archiveShopPerkRows } from '../_lib/primitiveArchiveShopPerks';

export default function PrimitiveArchiveShopPerks({ state, context, withoutPerks, onWithoutPerksChange, onRetry, busy, compact = false }) {
  const rows = archiveShopPerkRows(state);
  if (compact) return rows.length ? (
    <div className="primitive-shop-perks__current" aria-label="이번 런 LP 특전">
      <strong>이번 런 LP 특전</strong>
      {rows.map((row) => <span key={row.code}>{row.name} · {row.remaining}/{row.limit}회 남음</span>)}
    </div>
  ) : null;

  const nextNames = gameplayPerkNames(context.equippedCodes, 'primitive-archive');
  return (
    <section className="primitive-shop-perks" aria-label="LP 플레이 특전 설정">
      <div className="primitive-shop-perks__heading"><h3>LP 플레이 특전</h3><Link href="/perks">특전 상점 · 장착 관리</Link></div>
      <p>이번 런: {rows.length ? rows.map((row) => `${row.name} ${row.remaining}/${row.limit}회 남음`).join(' · ') : '적용 없음'}</p>
      <p>다음 새 런: {withoutPerks ? '특전 없이 시작' : context.status === 'loading' ? '장착 정보 확인 중' : context.status === 'error' ? '장착 정보를 확인하지 못했습니다.' : nextNames.join(' · ') || '장착한 특전 없음'}</p>
      <small>영구 구매 후 게임별로 최대 3개 장착할 수 있습니다. 장착 변경은 새 런부터 적용되며, 진행 중인 런과 남은 횟수는 바뀌지 않습니다.</small>
      {context.status === 'guest' ? <p><Link href="/login">로그인</Link>하면 구매·장착한 특전을 새 런에 사용할 수 있습니다.</p> : (
        <label className="primitive-shop-perks__option"><input type="checkbox" checked={withoutPerks} disabled={busy} onChange={(event) => onWithoutPerksChange(event.target.checked)} />이번 새 런은 LP 특전 없이 시작</label>
      )}
      {context.status === 'error' ? <button type="button" onClick={onRetry} disabled={busy}>특전 정보 다시 확인</button> : null}
    </section>
  );
}
