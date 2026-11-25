import type { Metadata } from "next";
import { SharedView } from "./shared-view";

export const metadata: Metadata = {
  title: "מרתף יין",
  // A private link: keep it out of search engines.
  robots: { index: false, follow: false },
};

export default function SharedPage() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 px-4 py-8">
      <SharedView />
    </main>
  );
}
