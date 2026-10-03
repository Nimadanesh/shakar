import type { Metadata, Viewport } from "next";
import { Inter, Vazirmatn } from "next/font/google";
import { BottomTabBar } from "@/components/layout/BottomTabBar";
import { Header } from "@/components/layout/Header";
import "./globals.css";

const vazirmatn = Vazirmatn({
  variable: "--font-vazirmatn",
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "700"],
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
  themeColor: "#0B0B0D",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

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
      <body
        className="flex min-h-full flex-col bg-background font-sans text-foreground"
        suppressHydrationWarning
      >
        <div
          aria-hidden="true"
          className="pointer-events-none fixed inset-0 -z-0"
          style={{
            background:
              "radial-gradient(60% 40% at 85% 0%, rgb(255 77 58 / 0.08), transparent 70%), radial-gradient(50% 35% at 10% 20%, rgb(245 166 35 / 0.05), transparent 70%)",
          }}
        />
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
