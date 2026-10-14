# CivicTrace — common tasks. Run from the repo root.
#
#   make ingest     resumable KPPP ingest (hours; ≤1 request/second)
#   make status     ingest progress
#   make rules      compute risk indicators into the SQLite store
#   make export     write the PUBLIC static data release to web/public/data
#   make web        build the static site (web/out)
#   make data       rules + export + web
#   make internal   relationship build (NOT for public deployment)
#   make test       pipeline tests + claims validation + web type-check/build
#   make check-public  verify a public build contains no relationship data

PIPE = cd pipeline && uv run
DB ?= data/civictrace.sqlite
# Rules/export can run against a snapshot so they don't contend with a running ingest.
SNAP ?= data/snapshot.sqlite

.PHONY: ingest status snapshot rules export web data internal test check-public kla

ingest:
	$(PIPE) civictrace ingest kppp

kla:
	$(PIPE) civictrace ingest kla

status:
	$(PIPE) civictrace status

snapshot:
	sqlite3 $(DB) ".backup '$(SNAP)'"

rules: snapshot
	$(PIPE) civictrace reparse --db ../$(SNAP)
	$(PIPE) civictrace rules --db ../$(SNAP)

export: rules
	$(PIPE) civictrace export --db ../$(SNAP) --out ../web/public/data

web:
	cd web && pnpm build

data: export web check-public

internal: rules
	$(PIPE) civictrace claims validate
	$(PIPE) civictrace export --db ../$(SNAP) --out ../web/public/data --include-relationships
	cd web && CIVICTRACE_INCLUDE_RELATIONSHIPS=1 pnpm build

test:
	$(PIPE) pytest -q
	$(PIPE) civictrace claims validate
	cd web && pnpm exec tsc --noEmit

check-public:
	@test ! -e web/public/data/relationships || (echo "FAIL: relationships data present in public export" && exit 1)
	@test ! -e web/out/data/relationships || (echo "FAIL: relationships data present in public build" && exit 1)
	@! grep -rqs "DECLARED_SHAREHOLDING_IN\|HELD_OFFICE\|SAME_ENTITY_AS" web/out/data || (echo "FAIL: claim predicates found in public build data" && exit 1)
	@echo "public build OK: no relationship data"
