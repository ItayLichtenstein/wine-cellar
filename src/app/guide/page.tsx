import type { Metadata } from "next";
import { BackLink } from "@/components/back-link";
import { GuideTour } from "./tour";

export const metadata: Metadata = { title: "מדריך למתחילים · מרתף יין" };

/** The beginner's guide: a short, touchable tour (see tour.tsx). */
export default function GuidePage() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-4 px-4 py-6">
      <BackLink href="/" label="למקרר" />
      <GuideTour />
    </main>
  );
}
