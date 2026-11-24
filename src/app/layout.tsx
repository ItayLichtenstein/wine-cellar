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

export const metadata: Metadata = {
  title: "מרתף יין",
  description: "ניהול מקררי יין למשק הבית",
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
