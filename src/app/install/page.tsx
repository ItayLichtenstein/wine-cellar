import { pageTitle } from "@/i18n/metadata";
import { BackLink } from "@/components/back-link";
import { getT } from "@/i18n/server";
import { InstallSteps } from "./install-steps";

export const generateMetadata = pageTitle((t) => t.titles.install);

/** How to put the site on the home screen, so it opens like an app (iPhone and Android). */
export default async function InstallPage() {
  const t = await getT();
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 px-4 py-8">
      <header className="flex flex-col gap-1">
        <BackLink href="/" label={t.settings.back} />
        <h1 className="text-2xl font-bold">{t.install.title}</h1>
        <p className="text-sm text-muted">{t.install.intro}</p>
      </header>
      <InstallSteps />
    </main>
  );
}
