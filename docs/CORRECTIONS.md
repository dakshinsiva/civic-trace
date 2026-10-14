# Corrections & right of reply — process

1. **Receive.** Reports arrive at the address in `NEXT_PUBLIC_CORRECTIONS_EMAIL` and are acknowledged within 3 working
   days.
2. **Withhold if disputed.** If a report plausibly identifies an error, add an entry to
   `pipeline/config/suppressions.yaml` (type, id, reason, date) and publish a new release. The item disappears and is
   listed on /corrections as withheld.
3. **Check against the source.** Compare the record with the archived portal response (sha256 in `source_document`) and
   with the live portal.
   - If **CivicTrace is wrong** (parsing, attribution, rule logic): fix the code, add a regression test, publish, and
     remove the suppression.
   - If **the portal itself is wrong**: say so on the page with a note. Don't silently rewrite official data.
   - If **the data is right but the indicator misleads**: add context to the rule's explanations, or attach the party's
     response.
4. **Log it.** Every correction gets a dated entry in the repository changelog.
