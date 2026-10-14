import { PageTitle } from "@/components/ui";
import { GLOSSARY } from "@/lib/glossary";

export const metadata = { title: "Glossary" };

export default function GlossaryPage() {
  const entries = Object.entries(GLOSSARY).sort(([, a], [, b]) => a.term.localeCompare(b.term));
  return (
    <>
      <PageTitle title="Glossary">
        <p>The words used on this site, in plain language.</p>
      </PageTitle>
      <dl className="card divide-y divide-[var(--grid)]">
        {entries.map(([k, g]) => (
          <div key={k} id={k} className="p-4">
            <dt className="font-semibold text-ink">{g.term}</dt>
            <dd className="text-sm text-ink-2 mt-1">{g.plain}</dd>
          </div>
        ))}
      </dl>
    </>
  );
}
