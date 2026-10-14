#!/usr/bin/env bash
# CivicTrace task runner (same targets as the Makefile, for machines without make).
#   ./tasks.sh ingest | kla | status | rules | export | web | data | internal | test | check-public
set -euo pipefail
cd "$(dirname "$0")"

DB="${DB:-data/civictrace.sqlite}"
SNAP="${SNAP:-data/snapshot.sqlite}"
pipe() { (cd pipeline && uv run "$@"); }

snapshot() { sqlite3 "$DB" ".backup '$SNAP'"; }
rules() { snapshot; pipe civictrace reparse --db "../$SNAP"; pipe civictrace rules --db "../$SNAP"; }
export_public() { rules; pipe civictrace export --db "../$SNAP" --out ../web/public/data; }
web() { (cd web && pnpm build); }
check_public() {
  if [ -e web/public/data/relationships ] || [ -e web/out/data/relationships ]; then
    echo "FAIL: relationships data present in public build"; exit 1
  fi
  if grep -rqs "DECLARED_SHAREHOLDING_IN\|HELD_OFFICE\|SAME_ENTITY_AS" web/out/data; then
    echo "FAIL: claim predicates found in public build data"; exit 1
  fi
  echo "public build OK: no relationship data"
}

case "${1:-}" in
  ingest) pipe civictrace ingest kppp ;;
  kla) pipe civictrace ingest kla ;;
  status) pipe civictrace status ;;
  rules) rules ;;
  export) export_public ;;
  web) web ;;
  data) export_public; web; check_public ;;
  internal)
    rules
    pipe civictrace claims validate
    pipe civictrace export --db "../$SNAP" --out ../web/public/data --include-relationships
    (cd web && CIVICTRACE_INCLUDE_RELATIONSHIPS=1 pnpm build)
    echo "INTERNAL build in web/out — do not deploy publicly" ;;
  test)
    pipe pytest -q
    pipe civictrace claims validate
    (cd web && pnpm exec tsc --noEmit) ;;
  check-public) check_public ;;
  *) sed -n '2,3p' "$0"; exit 1 ;;
esac
