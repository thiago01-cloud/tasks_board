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
};

// Explicit rather than relying on the framework default, so mobile
// scaling behaves the same regardless of the Next.js version in use.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
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
