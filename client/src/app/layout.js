import "./globals.css";
import '../styles/Home.css'; 
import '../styles/ERCharacters.css'; 
import '../styles/ERDetails.css'; 
import '../styles/ERModifiers.css'; 
import '../styles/ERAdmin.css';
import '../styles/ERPerks.css';
import '../styles/ERRecords.css';
import '../styles/ERBalance.css';
import '../styles/TwentyQuestions.css';
import '../styles/AppShell.css';
import AppProviders from '../components/AppProviders';
import GameTutorialLauncher from './games/_components/GameTutorialLauncher';
import '../styles/ERSimulation.css';
// 사이트 공통 틀(헤더·글꼴·색·간격). 기존 스타일을 정돈하므로 항상 마지막에 둡니다.
import 'pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css';
import '../styles/SiteShell.css';
import '../styles/SitePages.css';

export const metadata = {
  // 각 라우트의 layout.js가 title을 정하면 "게시판 | 케이의 게임개발소"처럼 표시됩니다.
  title: { default: "케이의 게임개발소", template: "%s | 케이의 게임개발소" },
  description: "케이의 게임개발소 - 게임, 기록, 저장, 커뮤니티를 한곳에 모은 종합 게임 사이트",
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <body className="font-sans antialiased">
        <AppProviders>
          {children}
          <GameTutorialLauncher />
        </AppProviders>
      </body>
    </html>
  );
}
