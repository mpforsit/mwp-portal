// Server-gerendertes HTML (kein Client-Framework), gleiche schlichte
// Optik wie der Pflege-Admin der API.
export const esc = (v: unknown): string =>
  String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

export const layout = (title: string, body: string): string => `<!doctype html>
<html lang="de"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${esc(title)} — myWell Ingest</title>
<style>
  body{font-family:system-ui,sans-serif;max-width:64rem;margin:2rem auto;padding:0 1rem;line-height:1.5;color:#26312f}
  table{border-collapse:collapse;width:100%;margin:1rem 0}
  th,td{border-bottom:1px solid #ddd;text-align:left;padding:.4rem .6rem;vertical-align:top}
  input,select,textarea,button{font:inherit;padding:.3rem .5rem;margin:.15rem 0}
  fieldset{margin:1.5rem 0;border:1px solid #ccc;border-radius:4px}
  .muted{color:#5c6a67;font-size:.9em}
  .off{opacity:.5}
  nav{margin-bottom:1.5rem}
  button{cursor:pointer}
</style></head>
<body><nav>
<a href="/admin/sources">Quellen</a> ·
<a href="/admin/attributes">Attribute</a>
</nav>
${body}</body></html>`
