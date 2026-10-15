import { PageTitle } from "@/components/ui";
import { GLOSSARY } from "@/lib/glossary";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Glossary of tender terms",
  description:
    "Plain-language definitions of the tender and procurement terms used on CivicTrace Bengaluru: estimate, price round, change notice, reserved tender and more.",
  path: "/glossary/",
});

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
            <dt className="text-title-m text-ink">{g.term}</dt>
            <dd className="text-sm text-ink-2 mt-1">{g.plain}</dd>
          </div>
        ))}
      </dl>
    </>
  );
}
