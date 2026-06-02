#!/usr/bin/env bash
#
# clean.sh -- tear down the synthetic UAT data: delete the SR-UAT libraries,
# remove /uat-media in the container, and reset Local.bru sample IDs to
# placeholders.

set -euo pipefail

SR_UAT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=scripts/uat/lib.sh disable=SC1091
. "$SR_UAT_DIR/lib.sh"

LOCAL_BRU="$REPO_ROOT/bruno-tests/segment-reporting-api/environments/Local.bru"

delete_lib() {
    # delete_lib <Name> -- resolve the VirtualFolder ItemId and delete by id;
    # name-based delete throws a NullReferenceException on Emby 4.9.5.
    local name="$1" id
    id="$(sr_get /emby/Library/VirtualFolders '' \
        | jq -r --arg n "$name" 'map(select(.Name==$n)) | (.[0].ItemId // .[0].Id // empty)')"
    if [ -n "$id" ]; then
        log "Deleting library '$name' (id=$id)"
        curl -s -o /dev/null -X DELETE -H "X-Emby-Token: ${API_KEY}" \
            "${BASE_URL}/emby/Library/VirtualFolders?id=${id}" || true
    else
        log "Library '$name' not present"
    fi
}

delete_lib "SR-UAT-TV"
delete_lib "SR-UAT-Movies"

log "Removing /uat-media in container '$CONTAINER'"
docker exec "$CONTAINER" sh -c 'rm -rf /uat-media' || true

log "Resetting sample IDs in $LOCAL_BRU"
cat > "$LOCAL_BRU" <<'EOF'
vars {
  baseUrl: http://localhost:8096
  sampleLibraryId: REPLACE_WITH_LIBRARY_ID
  sampleSeriesId: REPLACE_WITH_SERIES_ID
  sampleSeasonId: REPLACE_WITH_SEASON_ID
  sampleItemId: REPLACE_WITH_ITEM_ID
  sampleItemId2: REPLACE_WITH_SECOND_ITEM_ID
}
vars:secret [
  apiKey
]
EOF

log "Clean complete."
