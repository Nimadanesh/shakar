import type { Metadata, Viewport } from "next";
import { Inter, Vazirmatn } from "next/font/google";
import { BottomTabBar } from "@/components/layout/BottomTabBar";
import { Header } from "@/components/layout/Header";
import "./globals.css";

const vazirmatn = Vazirmatn({
  variable: "--font-vazirmatn",
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "700", "800"],
  display: "swap",
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "شکار | Shekar",
  description:
    "سرویس مستقل برای کاربران حرفه‌ای دیوار؛ کاهش زمان جستجوی جدی از روزها به ۱–۲ ساعت.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "شکار",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: "/icons/icon-192.png",
    apple: "/icons/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#0A0A0A",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem('shakar-theme');if(t==='light'){var d=document.documentElement;d.classList.remove('dark');d.classList.add('light');}}catch(e){}})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="fa"
      dir="rtl"
      className={`${vazirmatn.variable} ${inter.variable} dark h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body
        className="flex min-h-full flex-col bg-background font-sans text-foreground"
        suppressHydrationWarning
      >
        <Header />
        <div
          className="mx-auto flex w-full max-w-screen-sm flex-1 flex-col px-4"
          style={{ paddingBottom: "calc(6rem + env(safe-area-inset-bottom))" }}
        >
          {children}
        </div>
        <BottomTabBar />
      </body>
    </html>
  );
}
