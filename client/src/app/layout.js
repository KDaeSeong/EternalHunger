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
// (일단 주석 처리 해두고, 페이지 만들 때 하나씩 풉니다)

export const metadata = {
  title: "케이의 게임개발소",
  description: "케이의 게임개발소 - 게임, 기록, 저장, 커뮤니티를 한곳에 모은 종합 게임 사이트",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">
        <AppProviders>
          {children}
          <GameTutorialLauncher />
        </AppProviders>
      </body>
    </html>
  );
}
