#!/usr/bin/env bash
# Measures the home-screen fridge query as a load-test user, through the
# local Supabase API (same select as src/lib/fridges.ts). LOCAL ONLY.
#   bash scripts/load-test/measure.sh [user-number]
set -euo pipefail
cd "$(dirname "$0")/../.."
URL=$(grep '^NEXT_PUBLIC_SUPABASE_URL=' .env.local | cut -d= -f2-)
KEY=$(grep '^NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=' .env.local | cut -d= -f2-)
case "$URL" in http://127.0.0.1:*|http://localhost:*) ;; *) echo "refusing: not a local Supabase URL"; exit 1;; esac
EMAIL="loadtest-${1:-1}@example.com"

TOKEN=$(curl -s "$URL/auth/v1/token?grant_type=password" -H "apikey: $KEY" -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"local-dev-password\"}" | sed -E 's/.*"access_token":"([^"]+)".*/\1/')

SELECT='id,zone_id,slot,wine_vintages(year,drink_from,drink_to,peak_from,peak_to,wines(winery,name,label_thumb))'
NO_THUMB='id,zone_id,slot,wine_vintages(year,drink_from,drink_to,peak_from,peak_to,wines(winery,name))'
for label in "with thumbnails:$SELECT" "without thumbnails:$NO_THUMB"; do
  name=${label%%:*}; sel=${label#*:}
  for enc in identity gzip; do
    curl -s -o /dev/null -w "$name, $enc: %{size_download} bytes in %{time_total}s\n" \
      -H "apikey: $KEY" -H "Authorization: Bearer $TOKEN" -H "Accept-Encoding: $enc" \
      "$URL/rest/v1/bottles?select=$sel&status=eq.stored"
  done
done
