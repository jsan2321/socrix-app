import type { Metadata } from "next";
import Link from "next/link";
import { Brain, Sparkles, BookOpen } from "lucide-react";
import "./globals.css";

export const metadata: Metadata = {
  title: "The Socratic Cross-Examiner — AI Retrieval Practice",
  description:
    "AI-Powered Source-Grounded Retrieval Practice Platform using Devil's Advocate Socratic questions.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark scroll-smooth">
      <body className="min-h-screen bg-slate-950 text-slate-100 font-sans antialiased selection:bg-indigo-500 selection:text-white flex flex-col">
        {/* Modern Top Header / Navbar */}
        <header className="sticky top-0 z-50 backdrop-blur-md bg-slate-950/80 border-b border-slate-800/80 transition-all">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
            <Link
              href="/"
              className="flex items-center gap-2.5 group transition-transform duration-200 hover:scale-[1.01]"
            >
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 via-purple-600 to-pink-500 flex items-center justify-center shadow-lg shadow-indigo-500/25">
                <Brain className="w-5 h-5 text-white" />
              </div>
              <div className="flex flex-col">
                <span className="font-bold tracking-tight text-slate-100 group-hover:text-indigo-400 transition-colors">
                  Socratic Cross-Examiner
                </span>
                <span className="text-[10px] uppercase tracking-wider font-semibold text-indigo-400/90 -mt-0.5">
                  Retrieval Practice
                </span>
              </div>
            </Link>

            <nav className="flex items-center gap-4">
              <Link
                href="/upload"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-slate-200 bg-slate-900 border border-slate-800 hover:bg-slate-800 hover:border-slate-700 hover:text-white transition-all shadow-sm"
              >
                <Sparkles className="w-4 h-4 text-indigo-400" />
                <span>New Session</span>
              </Link>
            </nav>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {children}
        </main>

        {/* Minimal Footer */}
        <footer className="border-t border-slate-900 bg-slate-950/50 py-6 text-center text-xs text-slate-500">
          <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-indigo-500" />
              <span>Source-Grounded Retrieval Practice Platform</span>
            </div>
            <span>Built with Next.js 16, Supabase & pgvector</span>
          </div>
        </footer>
      </body>
    </html>
  );
}
