import type { Metadata } from "next";
import { Heebo } from "next/font/google";
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
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
