import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import DueBadge from "./due-badge";
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
    default: "读中文 · readChinese",
    template: "%s · 读中文",
  },
  description: "Learn Mandarin by reading real text with pinyin and tap-to-define",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-zinc-50 dark:bg-zinc-950">
        <header className="border-b border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-900/80 backdrop-blur sticky top-0 z-40">
          <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
            <Link href="/" className="flex items-baseline gap-2 group">
              <span className="text-xl font-bold tracking-wide group-hover:opacity-70 transition-opacity">
                读中文
              </span>
              <span className="text-xs text-zinc-500 dark:text-zinc-400 font-mono">
                readChinese
              </span>
            </Link>
            <nav className="flex items-center gap-4 text-sm">
              <Link
                href="/"
                className="text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
              >
                总览 Stats
              </Link>
              <Link
                href="/library"
                className="text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
              >
                书库 Library
              </Link>
              <Link
                href="/vocab"
                className="text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
              >
                词汇 Vocab
              </Link>
              <Link
                href="/review"
                className="text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
              >
                复习 Review
                <DueBadge />
              </Link>
              <Link
                href="/settings"
                className="text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
              >
                设置 Settings
              </Link>
            </nav>
          </div>
        </header>
        {children}
      </body>
    </html>
  );
}
