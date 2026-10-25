#!/usr/bin/env bash
# CivicTrace task runner (same targets as the Makefile, for machines without make).
#   ./tasks.sh ingest | refresh | kla | status | rules | export | web | data | internal | test | check-public | deploy [prod] | release
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

deploy() {
  # Static upload of the built site (web/out) to the linked Vercel project (.vercel/project.json).
  # Vercel does not build anything: the data release only exists locally.
  export_public; web; check_public
  cp deploy/vercel.json web/out/vercel.json
  local org proj
  org=$(python3 -c "import json;print(json.load(open('.vercel/project.json'))['orgId'])")
  proj=$(python3 -c "import json;print(json.load(open('.vercel/project.json'))['projectId'])")
  if [ "${1:-}" = "prod" ]; then
    VERCEL_ORG_ID="$org" VERCEL_PROJECT_ID="$proj" vercel deploy web/out --yes --prod
  else
    VERCEL_ORG_ID="$org" VERCEL_PROJECT_ID="$proj" vercel deploy web/out --yes
  fi
}

release() {
  # Production release of the committed HEAD, built in a clean git worktree with the current data. Use this when the
  # working copy has uncommitted edits (from you or another session) that must not ship.
  local wt snap
  wt="$(mktemp -d)/release-wt"
  snap="$(mktemp -d)/release.sqlite"
  if [ "$(df -m / | awk 'NR==2 {print $4}')" -lt 300 ]; then echo "ABORT: less than 300 MB free"; exit 2; fi
  git worktree add -q --detach "$wt" HEAD
  # Expanded now: wt and snap are local to this function and gone by the time the EXIT trap runs.
  trap "git worktree remove --force '$wt' 2>/dev/null || true; rm -f '$snap'" EXIT
  echo "releasing $(git -C "$wt" rev-parse --short HEAD)"
  (cd "$wt/web" && pnpm install --frozen-lockfile --prefer-offline --silent)
  # Read-only snapshot: never takes a write lock on a database an ingest may be writing to.
  pipeline/.venv/bin/python -c "import sqlite3,sys; sqlite3.connect(f'file:{sys.argv[1]}?mode=ro', uri=True).backup(sqlite3.connect(sys.argv[2]))" "$DB" "$snap"
  local ct=(env PYTHONPATH="$wt/pipeline" CIVICTRACE_DATA_DIR="$PWD/data" "$PWD/pipeline/.venv/bin/python" -m civictrace.cli)
  (cd "$wt/pipeline" && "${ct[@]}" reparse --db "$snap" >/dev/null && "${ct[@]}" rules --db "$snap" >/dev/null && "${ct[@]}" export --db "$snap" --out "$wt/web/public/data")
  (cd "$wt/web" && pnpm build >/dev/null)
  if [ -e "$wt/web/out/data/relationships" ] || grep -rqs "DECLARED_SHAREHOLDING_IN\|HELD_OFFICE\|SAME_ENTITY_AS" "$wt/web/out/data"; then
    echo "FAIL: relationship data in the public build"; exit 3
  fi
  cp deploy/vercel.json "$wt/web/out/vercel.json"
  local org proj
  org=$(python3 -c "import json;print(json.load(open('.vercel/project.json'))['orgId'])")
  proj=$(python3 -c "import json;print(json.load(open('.vercel/project.json'))['projectId'])")
  VERCEL_ORG_ID="$org" VERCEL_PROJECT_ID="$proj" vercel deploy "$wt/web/out" --yes --prod
}

case "${1:-}" in
  ingest) pipe civictrace ingest kppp ;;
  # New and changed tenders only: the listing catches status changes, so unchanged unfinished tenders aren't re-fetched.
  refresh) pipe civictrace ingest kppp --workers 3 --refresh-days 3650 ;;
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
  deploy) deploy "${2:-}" ;;
  release) release ;;
  *) sed -n '2,3p' "$0"; exit 1 ;;
esac
