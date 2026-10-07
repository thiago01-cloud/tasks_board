import type { Metadata, Viewport } from "next";
import { Playfair_Display, Inter } from "next/font/google";
import "./globals.css";
import Footer from "./components/Footer";
import { pageTitle, APP_DESCRIPTION } from "@/lib/constants";

const serif = Playfair_Display({
  subsets: ["latin"],
  weight: ["600", "700"],
  variable: "--font-serif",
  display: "swap",
});

const sans = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: pageTitle(),
  description: APP_DESCRIPTION,
  // PWA — see public/manifest.json, public/sw.js and lib/push.ts. The
  // icons here cover the browser tab/bookmark and the iOS home-screen
  // case specifically (Safari doesn't read manifest.json for its
  // touch icon); Android/desktop installs read their icons from the
  // manifest itself.
  manifest: "/manifest.json",
  icons: {
    icon: "/icons/icon-192.png",
    apple: "/icons/apple-touch-icon.png",
  },
};

// Explicit rather than relying on the framework default, so mobile
// scaling behaves the same regardless of the Next.js version in use.
// themeColor matches manifest.json's own (tinted browser UI/status bar
// once installed, and Android's task-switcher chrome before that).
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#2a3365",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" className={`${serif.variable} ${sans.variable}`}>
      <body>
        {children}
        <Footer />
      </body>
    </html>
  );
}
