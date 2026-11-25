import type { Metadata } from "next";
import { Suspense } from "react";
import { Heebo } from "next/font/google";
import { BottomNav } from "@/components/bottom-nav";
import "./globals.css";

// Heebo supports both Hebrew and Latin, so one font covers the whole UI.
const heebo = Heebo({
  variable: "--font-heebo",
  subsets: ["hebrew", "latin"],
});

// The preview a link gets in WhatsApp, iMessage and the like (Open Graph).
// Shared links land on /login first, which inherits this from the layout.
const PREVIEW_TITLE = "מרתף יין: יודעים בדיוק מה יש במקרר";
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
};

// Hebrew is the default language, so the whole document is right-to-left.
// English support (and switching `dir`) comes later with i18n.
export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="he" dir="rtl" className={`${heebo.variable} h-full antialiased`}>
      {/* pb-20 keeps the last content above the fixed bottom navigation. */}
      <body className="min-h-full flex flex-col pb-20">
        {children}
        {/* It reads the URL (usePathname), which must sit inside Suspense
            so the rest of the page can still be prerendered. */}
        <Suspense fallback={null}>
          <BottomNav />
        </Suspense>
      </body>
    </html>
  );
}
