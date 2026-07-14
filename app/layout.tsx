import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "첫째와둘째 팬 라운지",
  description: "방송 소식, 치지직 LIVE, 유튜브 다시보기, DM을 한곳에서 만나는 팬 공간",
  icons: {
    icon: "/logo.png",
    shortcut: "/logo.png",
  },
  openGraph: {
    title: "첫째와둘째 팬 라운지",
    description: "방송 소식, 치지직 LIVE, 유튜브 다시보기, DM을 한곳에서 만나는 팬 공간",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
