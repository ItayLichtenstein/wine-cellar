import Link from "next/link";
import { pageTitle } from "@/i18n/metadata";
import { getT } from "@/i18n/server";

export const generateMetadata = pageTitle((t) => t.titles.privacy);

// Plain language on purpose: what we keep, who sees it, what we never do.
// Keep this page in sync with docs/product-spec.md ("עמוד פרטיות").
export default async function PrivacyPage() {
  const p = (await getT()).privacy;
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-6 py-10 leading-relaxed">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold">{p.title}</h1>
        <p className="text-muted">{p.intro}</p>
      </header>

      <Section title={p.keptTitle}>
        <List items={p.kept} />
      </Section>

      <Section title={p.whoTitle}>
        <ul className="list-disc ps-5">
          {p.who.map(([who, what]) => (
            <li key={who}>
              <strong>{who}</strong>
              {what}
            </li>
          ))}
        </ul>
      </Section>

      <Section title={p.neverTitle}>
        <List items={p.never} />
      </Section>

      <Section title={p.whereTitle}>
        <p>{p.where}</p>
      </Section>

      <Section title={p.controlTitle}>
        <List items={p.control} />
      </Section>

      <Section title={p.contactTitle}>
        <p>
          <span className="inline-block">{p.contact}</span>{" "}
          <a href="mailto:thewinecellarapp@gmail.com" dir="ltr" className="underline underline-offset-2">
            thewinecellarapp@gmail.com
          </a>
        </p>
      </Section>

      <Link href="/" className="text-sm underline underline-offset-2">
        {p.back}
      </Link>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-xl font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function List({ items }: { items: string[] }) {
  return (
    <ul className="list-disc ps-5">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}
