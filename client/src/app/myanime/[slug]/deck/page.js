'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import SiteHeader from '../../../../components/SiteHeader';
import DualAcademyDeckPage from '../../../games/dual-academy-tcg/deck/page';

function normalizeRouteId(value) {
  const raw = Array.isArray(value) ? value[0] : value;
  return String(raw || '').trim();
}

function UnknownDeck({ slug }) {
  return (
    <main className="games-page-shell">
      <SiteHeader />
      <section className="games-page">
        <section className="games-hero">
          <div>
            <p className="games-kicker">MyAnime</p>
            <h1>덱 화면을 찾을 수 없습니다</h1>
            <p>{slug ? `${slug}에는 아직 별도 덱 편집 화면이 없습니다.` : '잘못된 MyAnime 덱 주소입니다.'}</p>
          </div>
          <div className="games-hero-actions">
            <Link href="/myanime">MyAnime 허브</Link>
            <Link href="/games">게임 허브</Link>
          </div>
        </section>
      </section>
    </main>
  );
}

export default function MyAnimeDeckAliasPage() {
  const params = useParams();
  const slug = normalizeRouteId(params?.slug);
  return slug === 'dual-academy-tcg' ? <DualAcademyDeckPage /> : <UnknownDeck slug={slug} />;
}
