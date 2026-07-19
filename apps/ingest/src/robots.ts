// Minimaler robots.txt-Parser + Allow/Disallow-Prüfung (längster
// übereinstimmender Pfad gewinnt, Allow schlägt gleich langes
// Disallow). Reicht für die Höflichkeitsprüfung vor dem Abruf.
interface Rule {
  allow: boolean
  path: string
}

// Extrahiert die Regeln der für `userAgent` zuständigen Gruppe.
// Spezifische Gruppe (Token-Match) hat Vorrang vor "*".
const rulesFor = (robotsTxt: string, userAgent: string): Rule[] => {
  const ua = userAgent.toLowerCase()
  const groups = new Map<string, Rule[]>()
  let current: string[] = []
  let sawDirective = false

  for (const rawLine of robotsTxt.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, '').trim()
    if (!line) continue
    const idx = line.indexOf(':')
    if (idx === -1) continue
    const field = line.slice(0, idx).trim().toLowerCase()
    const value = line.slice(idx + 1).trim()

    if (field === 'user-agent') {
      // Aufeinanderfolgende user-agent-Zeilen teilen sich eine Gruppe
      if (sawDirective) current = []
      current.push(value.toLowerCase())
      sawDirective = false
      for (const agent of current) if (!groups.has(agent)) groups.set(agent, [])
    } else if (field === 'allow' || field === 'disallow') {
      sawDirective = true
      for (const agent of current) {
        groups.get(agent)?.push({ allow: field === 'allow', path: value })
      }
    }
  }

  return groups.get(ua) ?? groups.get('*') ?? []
}

export const isAllowed = (
  robotsTxt: string,
  userAgent: string,
  path: string,
): boolean => {
  const rules = rulesFor(robotsTxt, userAgent)
  let best: Rule | undefined
  for (const rule of rules) {
    // Leeres Disallow ("Disallow:") = keine Sperre, überspringen
    if (rule.path === '' && !rule.allow) continue
    if (path.startsWith(rule.path)) {
      if (!best || rule.path.length > best.path.length) best = rule
    }
  }
  return best ? best.allow : true
}
