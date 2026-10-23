import type { Metadata } from "next";
import Link from "next/link";
import { Inter, Newsreader } from "next/font/google";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { LanguageToggle } from "@/components/theme/LanguageToggle";
import { I18nProvider } from "@/lib/i18n/context";
import { SocraticLogo } from "@/components/brand/SocraticLogo";
import { HeaderBrand } from "@/components/navigation/HeaderBrand";
import { AppFooter } from "@/components/navigation/AppFooter";
import { AuthNav } from "@/components/auth/AuthNav";
import { PrimaryNav } from "@/components/navigation/PrimaryNav";
import { getOptionalAuthenticatedUser } from "@/lib/auth/require-user";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const newsreader = Newsreader({
  subsets: ["latin"],
  variable: "--font-serif",
  display: "swap",
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  title: "Socrix — Socratic Cross-Examiner & Retrieval Practice",
  description:
    "Source-Grounded Retrieval Practice Platform using Devil's Advocate Socratic questions to eliminate illusions of competence.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await getOptionalAuthenticatedUser();
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${inter.variable} ${newsreader.variable} scroll-smooth`}
    >
      <body className="min-h-screen bg-background text-foreground font-sans antialiased selection:bg-primary/20 selection:text-primary flex flex-col">
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange
        >
          <I18nProvider>
            {/* Top Header / Scholarly Navigation */}
            <header className="sticky top-0 z-50 backdrop-blur-md bg-background/85 border-b border-border transition-colors">
              <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
                <Link
                  href="/"
                  className="flex min-w-0 items-center gap-2.5 group"
                >
                  <div className="w-10 h-10 flex items-center justify-center text-foreground group-hover:text-primary transition-colors duration-200">
                    <SocraticLogo className="transition-transform duration-200 group-hover:scale-105" size={40} />
                  </div>
                  <HeaderBrand />
                </Link>

                <nav aria-label="Main navigation" className="flex shrink-0 items-center gap-1.5 sm:gap-3">
                  <PrimaryNav authenticated={Boolean(user)} />
                  <AuthNav email={user?.email} displayName={typeof user?.user_metadata?.display_name === "string" ? user.user_metadata.display_name : null} />
                  <LanguageToggle />
                  <ThemeToggle />
                </nav>
              </div>
            </header>

            {/* Main Content Area */}
            <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
              {children}
            </main>

            {/* Minimal Scholarly Footer */}
            <AppFooter />
          </I18nProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
