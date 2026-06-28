import "./globals.css";
import '../styles/Home.css'; 
import '../styles/ERCharacters.css'; 
import '../styles/ERDetails.css'; 
import '../styles/EREvents.css'; 
import '../styles/ERModifiers.css'; 
import '../styles/ERAdmin.css';
import '../styles/ERPerks.css';
import '../styles/AppShell.css';
import AppProviders from '../components/AppProviders';
// import '../styles/ERMyProfile.css'; 
import '../styles/ERSimulation.css'; 
// (일단 주석 처리 해두고, 페이지 만들 때 하나씩 풉니다)

export const metadata = {
  title: "ETERNAL HUNGER",
  description: "ETERNAL HUNGER - 관전형 생존 배틀 시뮬레이션",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
