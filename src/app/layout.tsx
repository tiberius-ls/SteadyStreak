import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "SteadyStreak",
    template: "%s · SteadyStreak",
  },
  description:
    "Habit streaks with safe NIM savings and competitive staking — a Nimiq Pay Mini App.",
  applicationName: "SteadyStreak",
  authors: [{ name: "SteadyStreak" }],
  keywords: [
    "Nimiq",
    "Nimiq Pay",
    "Mini App",
    "habits",
    "staking",
    "savings",
    "NIM",
    "SteadyStreak",
  ],
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
    apple: [{ url: "/icon.svg" }],
  },
  openGraph: {
    title: "SteadyStreak",
    description:
      "Build habits. Save NIM safely. Compete with stakes in Nimiq Pay.",
    type: "website",
    siteName: "SteadyStreak",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#0b1020",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full">{children}</body>
    </html>
  );
}
