# CivicTrace — Bengaluru

Open-source procurement intelligence for Bengaluru's public works tenders. CivicTrace reads public tender records from
the Karnataka Public Procurement Portal (KPPP) and checks each one with transparent, testable rules for warning signs
of tender manipulation. Every warning sign comes with its evidence, a comparison baseline, the period and data
coverage, source links, plausible innocent explanations, and known limitations.

> **Warning signs are not proof.** They mark patterns worth a closer look. Nothing in this project alleges wrongdoing
> by any person or company.

## What's here

```
pipeline/   Python (uv): polite KPPP client, SQLite store, rules engine, static export, claims tooling
  config/   rules.yaml (thresholds + plain-language text), buyers.yaml, suppressions.yaml
  tests/    golden tests per rule, parser tests on recorded portal responses, claims/graph tests
web/        Next.js static site: interactive explorer, warning-sign evidence pages, tenders, suppliers, departments
data/       SQLite store (gitignored), raw archive (gitignored), claims/ and evidence/ (committed)
docs/       SOURCES.md (what the portal provides, verified), CORRECTIONS.md
```

## Quick start

```bash
./tasks.sh ingest      # resumable; ≤1 request/second; the full backfill takes about a day
./tasks.sh status      # progress
./tasks.sh data        # snapshot → rules → export → build site → verify no relationship data in public build
./tasks.sh test        # pipeline tests, claims validation, web type-check
```

Preview the built site:

```bash
python3 -m http.server 3210 --directory web/out
```

`make` targets mirror `tasks.sh` for machines that have `make`.

## The warning signs (rules 1–6)

| # | Plain name | Technical basis |
|---|---|---|
| 1 | One contractor wins unusually often | OCP R040; binomial test vs even split, Benjamini–Hochberg |
| 2 | Only one company competed | OCP R018; price-stage bidder count from the published comparative statement |
| 3 | Very little time to bid | OCP R003; IQR fence within buyer × work category × call type, plus materiality floor |
| 4 | Deadline or terms changed repeatedly | ≥3 corrigenda or ≥2 deadline extensions (calls ending in no bids excluded) |
| 5 | Winning price far from the official estimate | OCP R031; log-ratio IQR fences plus materiality floors |
| 6 | A few contractors get most of the work | OCP R051; HHI > 1800 or top-3 share ≥ 60%, ≥50 contracts |
| 7 | Mentioned in an official audit | Planned (CAG / Lokayukta, human-reviewed matches only) |

Thresholds and all explanatory text live in `pipeline/config/rules.yaml`. Each rule is versioned.

## Publication safeguards

- **Only what the portal publishes.** Contractor names appear exactly as KPPP shows them. Officials' phone numbers are
  never extracted.
- **Integrity checks.** Any response whose tender number doesn't match is quarantined and never attributed.
  Implausible award values are quarantined too.
- **No scores or leaderboards** of people or companies. Supplier pages are excluded from search engines (`noindex`).
- **Suppressions.** `pipeline/config/suppressions.yaml` withholds disputed items while a correction is reviewed.
- **Political-relationship layer is not public.** Claims (`data/claims/*.yaml`) must cite a verbatim excerpt from an
  official document, with a page locator and hashed evidence, and need a second reviewer. They are only exported with
  `./tasks.sh internal`, and `./tasks.sh data` fails if relationship data leaks into the public build. A person appears
  only if a complete documented chain links them to a KPPP supplier; holding an office alone never does.

### Before any public deployment

1. Corrections contact: `dakshinrajsiva@gmail.com` (default in `web/next.config.ts`; override with
   `NEXT_PUBLIC_CORRECTIONS_EMAIL` for forks).
2. Have a media lawyer review the site (criminal defamation: BNS §356; truth and public-good exceptions).
3. Confirm the corrections response commitment (currently 3 working days) is one you can keep.
4. Keep the relationship layer internal until claims are independently reviewed and legally cleared.

## Data source and terms

KPPP's copyright policy allows free reproduction of its material if it is reproduced accurately and the source is
acknowledged. CivicTrace uses the portal's public JSON service at no more than one request per second, archives every
response with a sha256 hash, and never bypasses CAPTCHAs or logins. See `docs/SOURCES.md`.

## Licence

Code: MIT. Data: as published by the Government of Karnataka (KPPP), reproduced with acknowledgement.
