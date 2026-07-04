'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import SiteHeader from '../../../../components/SiteHeader';
import BaSrpgPlayPage from '../../../games/ba-srpg/play/page';

const SRPG_PLAY_PAGES = {
  'ba-srpg': BaSrpgPlayPage,
};

function normalizeRouteId(value) {
  const raw = Array.isArray(value) ? value[0] : value;
  return String(raw || '').trim();
}

function UnknownGame({ slug }) {
  return (
    <main className="games-page-shell">
      <SiteHeader />
      <section className="games-page">
        <section className="games-hero">
          <div>
            <p className="games-kicker">SRPG</p>
            <h1>게임을 찾을 수 없습니다</h1>
            <p>{slug ? `${slug} 플레이 라우트가 아직 SRPG 허브에 연결되지 않았습니다.` : '잘못된 SRPG 게임 주소입니다.'}</p>
          </div>
          <div className="games-hero-actions">
            <Link href="/srpg">SRPG 허브</Link>
            <Link href="/games">게임 허브</Link>
          </div>
        </section>
      </section>
    </main>
  );
}

export default function SrpgPlayAliasPage() {
  const params = useParams();
  const slug = normalizeRouteId(params?.slug);
  const Page = SRPG_PLAY_PAGES[slug];
  return Page ? <Page /> : <UnknownGame slug={slug} />;
}
