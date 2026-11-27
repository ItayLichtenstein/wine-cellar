import Link from "next/link";
import { pageTitle } from "@/i18n/metadata";
import { getT } from "@/i18n/server";

export const generateMetadata = pageTitle((t) => t.titles.terms);

// Short terms in plain language: 18+, provided as is, AI is not advice,
// what gets an account closed, Israeli law. Public, like the privacy page.
export default async function TermsPage() {
  const p = (await getT()).terms;
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-6 py-10 leading-relaxed">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold">{p.title}</h1>
        <p className="text-muted">{p.intro}</p>
      </header>
      {p.sections.map(([title, text]) => (
        <section key={title} className="flex flex-col gap-2">
          <h2 className="text-xl font-semibold">{title}</h2>
          <p>{text}</p>
        </section>
      ))}
      <p className="text-sm text-muted">{p.updated}</p>
      <div className="flex flex-wrap gap-4 text-sm">
        <Link href="/privacy" className="underline underline-offset-2">
          {p.privacyLink}
        </Link>
        <Link href="/" className="underline underline-offset-2">
          {p.back}
        </Link>
      </div>
    </main>
  );
}
