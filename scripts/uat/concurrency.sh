#!/usr/bin/env bash
#
# concurrency.sh -- exercise SegmentRepository's lock ordering (#66) under load
# by firing many concurrent API requests at the running UAT Emby. This is the
# Phase 3 concurrency guard: the plugin's SQLite stack (SQLitePCL.pretty + the
# raw provider Emby bundles) cannot be hosted outside the Emby runtime, so the
# only faithful way to stress the read/write locks is against a real server.
#
# Local manual gate only (needs the UAT Emby up + seeded): never run by CI or a
# git hook. Reads are always exercised; an idempotent write is added when a
# seeded episode can be discovered, so reads and writes contend for the locks.
#
#   WORKERS     concurrent workers (default 8)
#   ITERATIONS  request rounds per worker (default 25)
#
# A deadlock or lock-ordering regression surfaces as request timeouts / 500s
# (curl -fsS fails -> recorded) or as a drifting row count, and fails the run.

set -euo pipefail

SR_UAT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=scripts/uat/lib.sh disable=SC1091
. "$SR_UAT_DIR/lib.sh"

WORKERS="${WORKERS:-8}"
ITERATIONS="${ITERATIONS:-25}"

# A fixed, deterministic IntroStart value (5s in ticks). Writing the same value
# every time keeps the write idempotent so the run does not corrupt seeded data.
FIXED_INTRO_TICKS=50000000

# URL-encode the read-path query once (spaces and parens would otherwise make a
# malformed URL). @uri matches how the Bruno collection encodes the same call.
CUSTOM_QUERY="$(jq -rn --arg s 'SELECT COUNT(*) FROM MediaSegments' '$s|@uri')"

wait_for_healthy

# --- discover IDs (best-effort; reads below degrade gracefully without them) --
log "Discovering sample IDs from the API"
library_id="$(sr_get /emby/segment_reporting/library_summary \
    | jq -r '.[0].LibraryId // empty' 2>/dev/null || true)"
series_id=""
if [ -n "$library_id" ]; then
    series_id="$(sr_get /emby/segment_reporting/series_list "libraryId=${library_id}" \
        | jq -r '(.series // [])[0].SeriesId // empty' 2>/dev/null || true)"
fi
# A seeded episode ItemId for the idempotent write half of the stress. Do not
# pass Limit=1: it would truncate the API result before the /uat-media filter
# runs, so a first episode outside the seeded library would silently drop the
# write path. Filter the full episode list, then take the first match.
episode_id="$(sr_get /emby/Items 'Recursive=true&IncludeItemTypes=Episode&Fields=Path' \
    | jq -r '(.Items // []) | map(select((.Path // "")|startswith("/uat-media"))) | .[0].Id // empty' 2>/dev/null || true)"

log "library_id=${library_id:-<none>} series_id=${series_id:-<none>} episode_id=${episode_id:-<none>}"
if [ -z "$episode_id" ]; then
    log "No seeded episode found -- running READ-ONLY (run 'make uat-seed' for read+write contention)."
fi

rows_before="$(sr_get /emby/segment_reporting/cache_stats | jq -r '.rowCount // 0')"
log "rowCount before: $rows_before"

FAIL_DIR="$RUN_LOG_DIR/fail"
mkdir -p "$FAIL_DIR"

# --- one worker: a bounded round of mixed reads (+ idempotent write) ----------
worker() {
    local id="$1" i rc tmp
    # keep_first preserves the first non-zero exit of the iteration, so a later
    # successful request can never mask an earlier failure.
    keep_first() { tmp=$?; [ "$rc" -eq 0 ] && rc=$tmp; }
    for ((i = 0; i < ITERATIONS; i++)); do
        rc=0
        {
            sr_get /emby/segment_reporting/library_summary >/dev/null &&
            sr_get /emby/segment_reporting/cache_stats >/dev/null &&
            sr_get /emby/segment_reporting/sync_status >/dev/null &&
            sr_post /emby/segment_reporting/submit_custom_query \
                "query=${CUSTOM_QUERY}" >/dev/null
        } || keep_first

        if [ -n "$library_id" ]; then
            sr_get /emby/segment_reporting/series_list "libraryId=${library_id}" >/dev/null || keep_first
        fi
        if [ -n "$series_id" ]; then
            sr_get /emby/segment_reporting/season_list "seriesId=${series_id}" >/dev/null || keep_first
        fi
        if [ -n "$episode_id" ]; then
            # Idempotent write: always the same marker value, so it stresses the
            # write path / lock ordering without changing the row count.
            sr_post /emby/segment_reporting/update_segment \
                "ItemId=${episode_id}&MarkerType=IntroStart&Ticks=${FIXED_INTRO_TICKS}" >/dev/null || keep_first
        fi

        if [ "$rc" -ne 0 ]; then
            printf 'worker %s iter %s: request failed (rc=%s)\n' "$id" "$i" "$rc" \
                >> "$FAIL_DIR/worker-$id"
        fi
    done
}

log "Launching $WORKERS workers x $ITERATIONS iterations"
pids=()
for ((w = 0; w < WORKERS; w++)); do
    worker "$w" &
    pids+=("$!")
done

# Bounded join: if a worker hangs (deadlock), it cannot stall the run forever --
# curl's --max-time bounds each request, so workers always terminate.
rc_any=0
for pid in "${pids[@]}"; do
    wait "$pid" || rc_any=1
done

rows_after="$(sr_get /emby/segment_reporting/cache_stats | jq -r '.rowCount // 0')"
log "rowCount after: $rows_after"

# --- verdict ------------------------------------------------------------------
fail_count=0
if [ -d "$FAIL_DIR" ]; then
    fail_count="$(find "$FAIL_DIR" -type f | wc -l | tr -d ' ')"
fi

status=0
if [ "$fail_count" -ne 0 ]; then
    echo "FAIL: $fail_count worker(s) recorded request failures:" >&2
    cat "$FAIL_DIR"/* >&2 || true
    status=1
fi
if [ "$rc_any" -ne 0 ]; then
    echo "FAIL: at least one worker exited non-zero." >&2
    status=1
fi
if [ "$rows_before" != "$rows_after" ]; then
    echo "FAIL: rowCount drifted ($rows_before -> $rows_after); writes were idempotent, so this indicates corruption or a lost update." >&2
    status=1
fi

if [ "$status" -eq 0 ]; then
    log "PASS: $WORKERS x $ITERATIONS concurrent rounds, no errors, rowCount stable at $rows_after."
fi
exit "$status"
