import type { Metadata } from "next";
import { Geist, Geist_Mono, Source_Serif_4 } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { SiteNav } from "@/components/site/site-nav";
import { SiteFooter } from "@/components/site/site-footer";

const sans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});

const mono = Geist_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  display: "swap",
});

// A text serif, used only by the Demo's memos. A policy memo is a document
// rather than an interface, and it should read like one.
const serif = Source_Serif_4({
  variable: "--font-serif",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://writewrit.vercel.app"),
  title: "Writ · source-grounded political knowledge",
  description:
    "Writ is a structured knowledge system and domain-specific language for political science and global affairs. It keeps claims, evidence, uncertainty, provenance, and derived results traceable across corpora.",
  openGraph: {
    title: "Writ",
    description: "A domain-specific language for global affairs",
    images: ["/writ-social-preview.png"],
  },
  twitter: {
    card: "summary_large_image",
    title: "Writ",
    description: "A domain-specific language for global affairs",
    images: ["/writ-social-preview.png"],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${sans.variable} ${mono.variable} ${serif.variable} h-full`}
      suppressHydrationWarning
    >
      <body className="flex min-h-full flex-col">
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
          <SiteNav />
          <div className="flex-1">{children}</div>
          <SiteFooter />
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
