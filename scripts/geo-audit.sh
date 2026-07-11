#!/usr/bin/env bash
# GEO-Audit (Schritt 1.9): prüft per curl OHNE JS, ob die für
# KI-Extraktion nötigen Elemente im Initial-HTML stehen.
# Verwendung:
#   scripts/geo-audit.sh <URL>            # H1 + JSON-LD (alle Seitentypen)
#   scripts/geo-audit.sh <URL> --article  # zusätzlich Kernaussage + FAQ
set -euo pipefail

url="${1:?Verwendung: $0 <URL> [--article]}"
mode="${2:-}"

html=$(curl -sf --max-time 20 "$url") || {
  echo "FEHLER: $url nicht abrufbar." >&2
  exit 1
}

fail=0
check() {
  local label="$1" pattern="$2"
  if printf '%s' "$html" | grep -qE "$pattern"; then
    echo "OK     $label"
  else
    echo "FEHLT  $label"
    fail=1
  fi
}

check "H1" '<h1[ >]'
check "JSON-LD (@graph)" 'application/ld\+json'

if [ "$mode" = "--article" ]; then
  check "Kernaussage-Box" 'class="article__summary"'
  check "FAQ-Sektion" 'aria-label="Häufige Fragen"'
fi

if [ "$fail" -ne 0 ]; then
  echo "GEO-Audit FEHLGESCHLAGEN für $url" >&2
  exit 1
fi
echo "GEO-Audit OK für $url"
