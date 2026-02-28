import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import '../styles/Home.css'; 
import '../styles/ERCharacters.css'; 
import '../styles/ERDetails.css'; 
import '../styles/EREvents.css'; 
import '../styles/ERModifiers.css'; 
import '../styles/ERAdmin.css';
// import '../styles/ERMyProfile.css'; 
import '../styles/ERSimulation.css'; 
// (일단 주석 처리 해두고, 페이지 만들 때 하나씩 풉니다)

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "ETERNAL HUNGER",
  description: "ETERNAL HUNGER - 관전형 생존 배틀 시뮬레이션",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
