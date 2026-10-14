import { PageTitle, Section } from "@/components/ui";
import { getMeta } from "@/lib/data";
import { date } from "@/lib/format";

export const metadata = { title: "Corrections & right of reply" };

export default function CorrectionsPage() {
  const meta = getMeta();
  const email = process.env.NEXT_PUBLIC_CORRECTIONS_EMAIL;
  return (
    <div className="space-y-6">
      <PageTitle title="Corrections & right of reply">
        <p>
          CivicTrace republishes public procurement records and computes risk indicators from them. If something here is
          wrong, incomplete or missing context, tell us. Anyone named in a record can respond.
        </p>
      </PageTitle>

      <Section title="How to report">
        {email ? (
          <p className="text-sm">
            Email <a href={`mailto:${email}`}>{email}</a> with the page link, what is wrong, and any supporting document.
          </p>
        ) : (
          <p className="text-sm text-critical">
            No corrections contact is configured for this build (NEXT_PUBLIC_CORRECTIONS_EMAIL). It must not be deployed
            publicly until one is.
          </p>
        )}
        <ul className="list-disc pl-5 text-sm space-y-1 mt-3">
          <li>We acknowledge reports within 3 working days.</li>
          <li>
            While a report is reviewed, the disputed item can be withheld from the site. Withheld items are listed below.
          </li>
          <li>
            If the source record itself is wrong, we say so on the page and point to the portal. We don&apos;t silently
            &ldquo;fix&rdquo; official data.
          </li>
          <li>If an indicator is technically right but misleading, we can add context or a response from the party concerned.</li>
          <li>Every correction appears in the public changelog in the project repository.</li>
        </ul>
      </Section>

      <Section title="Currently withheld">
        {meta.suppressions.length ? (
          <table className="data">
            <thead>
              <tr>
                <th>Type</th>
                <th>Reason</th>
                <th>Since</th>
              </tr>
            </thead>
            <tbody>
              {meta.suppressions.map((s) => (
                <tr key={`${s.type}-${s.id}`}>
                  <td>{s.type}</td>
                  <td>{s.reason}</td>
                  <td>{date(s.since)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-sm text-muted">Nothing is withheld in this release.</p>
        )}
      </Section>
    </div>
  );
}
