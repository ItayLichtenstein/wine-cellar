import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { Heebo } from "next/font/google";
import { BottomNav } from "@/components/bottom-nav";
import { I18nProvider } from "@/i18n/provider";
import { getLocale } from "@/i18n/server";
import "./globals.css";

// Heebo supports both Hebrew and Latin, so one font covers the whole UI.
const heebo = Heebo({
  variable: "--font-heebo",
  subsets: ["hebrew", "latin"],
});

// The preview a link gets in WhatsApp, iMessage and the like (Open Graph).
// Shared links land on /login first, which inherits this from the layout.
const PREVIEW_TITLE = "מרתף יין · יודעים בדיוק מה יש במקרר";
const PREVIEW_TEXT = "עוזר לך להחליט איזה בקבוק פותחים הערב";

export const metadata: Metadata = {
  // Absolute URLs for the preview image; Vercel sets the production host.
  metadataBase: new URL(
    process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000",
  ),
  title: "מרתף יין",
  description: PREVIEW_TEXT,
  openGraph: { title: PREVIEW_TITLE, description: PREVIEW_TEXT, siteName: "מרתף יין", locale: "he_IL", type: "website" },
  twitter: { card: "summary_large_image", title: PREVIEW_TITLE, description: PREVIEW_TEXT },
  appleWebApp: { capable: true, title: "מרתף יין", statusBarStyle: "default" },
};

// The browser bar and the installed app's status bar match the page.
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6ecea" },
    { media: "(prefers-color-scheme: dark)", color: "#2a0b12" },
  ],
};

// <html> is the static shell, drawn before the language cookie is read, so it
// starts as Hebrew (the default). Everything inside waits for the cookie
// (ADR 0010): the provider gives every page its language and direction.
export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="he" dir="rtl" suppressHydrationWarning className={`${heebo.variable} h-full antialiased`}>
      {/* pb-20 keeps the last content above the fixed bottom navigation. */}
      <body className="min-h-full flex flex-col pb-20">
        <Suspense fallback={null}>
          <WithLocale>
            {children}
            <BottomNav />
          </WithLocale>
        </Suspense>
      </body>
    </html>
  );
}

/** Reads the cookie (dynamic, hence inside Suspense) and hands the language down. */
async function WithLocale({ children }: { children: React.ReactNode }) {
  return <I18nProvider locale={await getLocale()}>{children}</I18nProvider>;
}
