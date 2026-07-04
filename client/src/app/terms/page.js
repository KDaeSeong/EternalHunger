import Link from 'next/link';
import SiteHeader from '../../components/SiteHeader';

const TERMS = [
  {
    title: '서비스 이용',
    body: 'Eternal Hunger는 시뮬레이션, 전적, 게시판, 스무고개 등 커뮤니티 게임 기능을 제공합니다. 이용자는 타인의 이용을 방해하거나 시스템을 악용하는 방식으로 서비스를 사용할 수 없습니다.',
  },
  {
    title: '계정 책임',
    body: '계정과 비밀번호 관리는 이용자 본인의 책임입니다. 계정이 도용되었거나 비정상 활동이 의심되면 운영자에게 신고할 수 있습니다.',
  },
  {
    title: '콘텐츠와 기록',
    body: '이용자가 작성한 게시글, 댓글, 신고, 게임 기록은 서비스 운영과 기록 보존을 위해 저장될 수 있습니다. 운영 정책 위반 콘텐츠는 숨김, 삭제, 정지 등의 조치를 받을 수 있습니다.',
  },
  {
    title: '운영 조치',
    body: '버그 악용, 스팸, 부적절한 게시물, 타인 사칭, 서비스 방해 행위가 확인되면 운영자는 계정 정지, 게시물 제한, 신고 처리 등의 조치를 할 수 있습니다.',
  },
  {
    title: '변경',
    body: '서비스 기능과 약관은 운영 상황에 따라 변경될 수 있습니다. 중요한 변경은 공지 또는 사이트 내 안내로 알립니다.',
  },
];

export default function TermsPage() {
  return (
    <main className="policy-shell">
      <SiteHeader />
      <section className="policy-hero">
        <div>
          <span>POLICY</span>
          <h1>이용약관</h1>
          <p>시행일: 2026년 7월 4일</p>
        </div>
        <Link href="/privacy">개인정보 처리방침</Link>
      </section>

      <section className="policy-card">
        {TERMS.map((row) => (
          <article key={row.title}>
            <h2>{row.title}</h2>
            <p>{row.body}</p>
          </article>
        ))}
      </section>
    </main>
  );
}
