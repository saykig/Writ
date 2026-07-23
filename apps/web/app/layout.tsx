import type { Metadata } from "next";
import { IM_Fell_English, Libre_Baskerville, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { SiteNav } from "@/components/site/site-nav";
import { SiteFooter } from "@/components/site/site-footer";

const display = IM_Fell_English({
  variable: "--font-display",
  weight: "400",
  subsets: ["latin"],
  display: "swap",
});

const text = Libre_Baskerville({
  variable: "--font-text",
  weight: ["400", "700"],
  subsets: ["latin"],
  display: "swap",
});

const mono = IBM_Plex_Mono({
  variable: "--font-mono",
  weight: ["400", "500", "600"],
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Covenant · an auditable policy-evaluation compiler",
  description:
    "Covenant turns a G7 compliance methodology into a program, its evidence into a frozen reviewed ledger, and each score into a reproducible receipt. It catches scoring ambiguity before any evidence exists, and names exactly where a score depends on judgment.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${display.variable} ${text.variable} ${mono.variable} h-full`}
      suppressHydrationWarning
    >
      <body className="flex min-h-full flex-col">
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
          <SiteNav />
          <div className="flex-1">{children}</div>
          <SiteFooter />
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
