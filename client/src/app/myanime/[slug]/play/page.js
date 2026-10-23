'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import SiteHeader from '../../../../components/SiteHeader';
import dynamic from 'next/dynamic';

function PlayLoading() {
  return (
    <main className="games-page-shell">
      <SiteHeader />
      <p className="ui-empty" role="status">게임을 불러오는 중입니다.</p>
    </main>
  );
}

// Each game's code loads only when its own address is opened.
// Static imports here used to ship all eleven games (about 2MB) with every one of them.
const MYANIME_PLAY_PAGES = {
  myanimecraft: dynamic(() => import('../../../games/myanimecraft/play/page'), { loading: PlayLoading }),
  'dual-academy-tcg': dynamic(() => import('../../../games/dual-academy-tcg/play/page'), { loading: PlayLoading }),
  'ba-vanguard': dynamic(() => import('../../../games/ba-vanguard/play/page'), { loading: PlayLoading }),
  'schale-idle-rpg': dynamic(() => import('../../../games/schale-idle-rpg/play/page'), { loading: PlayLoading }),
  'school-simulator': dynamic(() => import('../../../games/school-simulator/play/page'), { loading: PlayLoading }),
  'tonkatsu-teacher': dynamic(() => import('../../../games/tonkatsu-teacher/play/page'), { loading: PlayLoading }),
  'si-coding-sim': dynamic(() => import('../../../games/si-coding-sim/play/page'), { loading: PlayLoading }),
  'rail3d-sim': dynamic(() => import('../../../games/rail3d-sim/play/page'), { loading: PlayLoading }),
  'company-report': dynamic(() => import('../../../games/company-report/play/page'), { loading: PlayLoading }),
  'racing-logos-demo': dynamic(() => import('../../../games/racing-logos-demo/play/page'), { loading: PlayLoading }),
  'primitive-archive': dynamic(() => import('../../../games/primitive-archive/play/page'), { loading: PlayLoading }),
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
            <p className="games-kicker">MyAnime</p>
            <h1>게임을 찾을 수 없습니다</h1>
            <p>{slug ? `${slug} 플레이 라우트가 아직 MyAnime 허브에 연결되지 않았습니다.` : '잘못된 MyAnime 게임 주소입니다.'}</p>
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

export default function MyAnimePlayAliasPage() {
  const params = useParams();
  const slug = normalizeRouteId(params?.slug);
  const Page = MYANIME_PLAY_PAGES[slug];
  return Page ? <Page /> : <UnknownGame slug={slug} />;
}
