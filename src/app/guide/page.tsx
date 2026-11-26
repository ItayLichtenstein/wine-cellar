import { pageTitle } from "@/i18n/metadata";
import { getT } from "@/i18n/server";
import { BackLink } from "@/components/back-link";
import { GuideTour } from "./tour";

export const generateMetadata = pageTitle((t) => t.titles.guide);

/** The beginner's guide: a short, touchable tour (see tour.tsx). */
export default async function GuidePage() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-4 px-4 py-6">
      <BackLink href="/" label={(await getT()).guide.back} />
      <GuideTour />
    </main>
  );
}
