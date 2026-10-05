import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { Inter, Vazirmatn } from "next/font/google";
import { AppChrome } from "@/components/layout/AppChrome";
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
    "سرویس مستقل برای کاربران حرفه‌ای دیوار؛ کاهش زمان شکار از روزها به ۱–۲ ساعت.",
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
        <Script id="theme-init" src="/theme-init.js" strategy="beforeInteractive" />
      </head>
      <body
        className="flex min-h-full flex-col bg-background font-sans text-foreground"
        suppressHydrationWarning
      >
        <AppChrome>{children}</AppChrome>
      </body>
    </html>
  );
}
