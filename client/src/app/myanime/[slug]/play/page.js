'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import SiteHeader from '../../../../components/SiteHeader';
import BaVanguardPlayPage from '../../../games/ba-vanguard/play/page';
import CompanyReportPlayPage from '../../../games/company-report/play/page';
import DualAcademyTcgPlayPage from '../../../games/dual-academy-tcg/play/page';
import MyAnimecraftPlayPage from '../../../games/myanimecraft/play/page';
import PrimitiveArchivePlayPage from '../../../games/primitive-archive/play/page';
import RacingLogosDemoPlayPage from '../../../games/racing-logos-demo/play/page';
import Rail3dSimPlayPage from '../../../games/rail3d-sim/play/page';
import SchaleIdleRpgPlayPage from '../../../games/schale-idle-rpg/play/page';
import SchoolSimulatorPlayPage from '../../../games/school-simulator/play/page';
import SiCodingSimPlayPage from '../../../games/si-coding-sim/play/page';
import TonkatsuTeacherPlayPage from '../../../games/tonkatsu-teacher/play/page';

const MYANIME_PLAY_PAGES = {
  myanimecraft: MyAnimecraftPlayPage,
  'dual-academy-tcg': DualAcademyTcgPlayPage,
  'ba-vanguard': BaVanguardPlayPage,
  'schale-idle-rpg': SchaleIdleRpgPlayPage,
  'school-simulator': SchoolSimulatorPlayPage,
  'tonkatsu-teacher': TonkatsuTeacherPlayPage,
  'si-coding-sim': SiCodingSimPlayPage,
  'rail3d-sim': Rail3dSimPlayPage,
  'company-report': CompanyReportPlayPage,
  'racing-logos-demo': RacingLogosDemoPlayPage,
  'primitive-archive': PrimitiveArchivePlayPage,
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
