#!/usr/bin/env bash
# Prüft, ob die wichtigsten KI-Crawler die Startseite erreichen
# (erkennt CDN-/Bot-Blockaden, z. B. Cloudflare "Block AI bots").
# Verwendung: scripts/check-crawlers.sh https://staging.PORTAL-DOMAIN.de
set -euo pipefail

url="${1:?Verwendung: $0 <URL>}"

# Offizielle User-Agent-Strings (gekürzt auf den signifikanten Teil)
agents=(
  "GPTBot|Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; GPTBot/1.2; +https://openai.com/gptbot"
  "OAI-SearchBot|Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; OAI-SearchBot/1.0; +https://openai.com/searchbot"
  "ChatGPT-User|Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; ChatGPT-User/1.0; +https://openai.com/bot"
  "ClaudeBot|Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; ClaudeBot/1.0; +claudebot@anthropic.com)"
  "Claude-SearchBot|Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; Claude-SearchBot/1.0; +https://www.anthropic.com"
  "Claude-User|Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; Claude-User/1.0; +https://www.anthropic.com"
  "PerplexityBot|Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; PerplexityBot/1.0; +https://perplexity.ai/perplexitybot)"
  "Perplexity-User|Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; Perplexity-User/1.0; +https://perplexity.ai/perplexity-user)"
  "Google-Extended|Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; Google-Extended)"
  "DuckAssistBot|Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; DuckAssistBot/1.1; +http://duckduckgo.com/duckassistbot.html"
  "MistralAI-User|Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; MistralAI-User/1.0; +https://mistral.ai/bot)"
  "Browser-Referenz|Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36"
)

fail=0
for entry in "${agents[@]}"; do
  name="${entry%%|*}"
  ua="${entry#*|}"
  status=$(curl -s -o /tmp/crawler-check-body -w '%{http_code}' \
    --max-time 20 -A "$ua" "$url" || echo "000")
  first_bytes=$(head -c 80 /tmp/crawler-check-body | tr -d '\n\r')
  printf '%-18s %s  %s\n' "$name" "$status" "$first_bytes"
  if [ "$status" != "200" ]; then
    fail=1
  fi
done

rm -f /tmp/crawler-check-body

if [ "$fail" -ne 0 ]; then
  echo "FEHLER: mindestens ein Crawler bekommt keine 200 — CDN-/Bot-Regeln prüfen." >&2
  exit 1
fi
echo "OK: alle geprüften User-Agents erreichen $url mit 200."
