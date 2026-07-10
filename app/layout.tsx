import type { Metadata, Viewport } from "next";
import { Newsreader, Inter } from "next/font/google";
import "./globals.css";

// Editorial serif for headlines, the wordmark, and stat numerals — gives the
// product the authority of a print masthead. Italic is used for accents.
const serif = Newsreader({
  variable: "--font-serif",
  subsets: ["latin"],
  style: ["normal", "italic"],
  display: "swap",
});

// Clean grotesque for UI chrome and body copy.
const sans = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#FBFAF8",
};

export const metadata: Metadata = {
  title: "Briefed",
  description: "An AI-powered interactive news map",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Briefed",
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${serif.variable} ${sans.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
