import Link from 'next/link';
import SiteHeader from '../../components/SiteHeader';

const PRIVACY_ITEMS = [
  {
    title: '수집하는 정보',
    body: '회원가입과 이용 과정에서 아이디, 닉네임, 비밀번호 해시, 복구 코드 해시, 프로필 소개, LP와 크레딧, 게시글, 댓글, 신고, 알림, 게임 기록, 스무고개 기록이 저장될 수 있습니다.',
  },
  {
    title: '이용 목적',
    body: '수집한 정보는 로그인, 계정 관리, 전적 저장, 랭킹 산정, 게시판 운영, 신고 처리, 알림 제공, 부정 이용 방지에 사용합니다.',
  },
  {
    title: '보관과 탈퇴',
    body: '계정 탈퇴 시 로그인 정보와 공개 프로필은 탈퇴 계정으로 정리됩니다. 다만 게시글, 신고 처리, 경기 기록처럼 서비스 흐름과 운영 근거에 필요한 기록은 보존될 수 있습니다.',
  },
  {
    title: '공개 범위',
    body: '닉네임, 프로필 소개, 일부 전적과 랭킹, 게시글과 댓글은 다른 이용자에게 표시될 수 있습니다. 비밀번호와 관리자 처리 정보는 공개하지 않습니다.',
  },
  {
    title: '문의와 정정',
    body: '이용자는 계정 화면에서 닉네임, 소개, 비밀번호를 수정할 수 있으며, 신고나 개인정보 관련 요청은 게시판 또는 운영자에게 문의할 수 있습니다.',
  },
];

export default function PrivacyPage() {
  return (
    <main className="policy-shell">
      <SiteHeader />
      <section className="policy-hero">
        <div>
          <span>PRIVACY</span>
          <h1>개인정보 처리방침</h1>
          <p>시행일: 2026년 7월 4일</p>
        </div>
        <Link href="/terms">이용약관</Link>
      </section>

      <section className="policy-card">
        {PRIVACY_ITEMS.map((row) => (
          <article key={row.title}>
            <h2>{row.title}</h2>
            <p>{row.body}</p>
          </article>
        ))}
      </section>
    </main>
  );
}
