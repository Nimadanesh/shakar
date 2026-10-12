import type { Metadata, Viewport } from "next";
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
  title: "شکار | Shekaar",
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
        {/* Theme bootstrap: INLINE (not an external file) so it runs
            synchronously during HTML parsing — before the first paint, with
            zero network fetch. An external script (next/script
            beforeInteractive) can lose the race to first paint → the black
            flash on light theme. This is the root fix for the flash.

            It also re-asserts the theme if anything ever wipes the <html>
            class afterwards (e.g. a React client re-render after a
            hydration mismatch rebuilds <html> from the vdom's "dark").
            Without this, one bad component can stick the whole app in the
            wrong theme until the user toggles it. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){function a(){try{var t=localStorage.getItem('shakar-theme');var d=document.documentElement;var w=t==='light'?'light':'dark';if(!d.classList.contains(w)){d.classList.remove('dark','light');d.classList.add(w);}var m=document.querySelector('meta[name=theme-color]');if(m){m.setAttribute('content',w==='light'?'#F4F4F5':'#0B0B0C');}}catch(e){}}a();try{if(window.location.pathname==='/'&&localStorage.getItem('shakar-onboarded')!=='1'){window.location.replace('/onboarding');}}catch(e){}try{new MutationObserver(a).observe(document.documentElement,{attributes:true,attributeFilter:['class']});}catch(e){}})();`,
          }}
        />
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
