// Methodik-Seiten (Schritt 2.6): Fetch + Aufbereitung. Die
// Kriterientabelle wird automatisch aus dem criteria-JSONB generiert —
// die scoring-Definition IST die Spezifikation.
import { createMarkdownProcessor } from '@astrojs/markdown-remark'
import type {
  MethodologyResponse,
  MethodologyVersion,
} from '../../../api/src/methodik-public'
import type { Criterion } from '../../../api/src/scoring'

export type { MethodologyResponse, MethodologyVersion }

const apiUrl = (
  (import.meta.env.API_URL as string | undefined) ?? 'http://localhost:3001'
).replace(/\/$/, '')

export const fetchMethodology = async (
  slug: string,
): Promise<MethodologyResponse> => {
  const res = await fetch(`${apiUrl}/api/methodik/${slug}`)
  if (!res.ok) {
    throw new Error(
      `Methodik-API antwortete mit ${res.status} für ${slug} (Build-Abbruch).`,
    )
  }
  return (await res.json()) as MethodologyResponse
}

const processorPromise = createMarkdownProcessor()

export const renderMarkdown = async (md: string): Promise<string> => {
  const processor = await processorPromise
  return String((await processor.render(md)).code)
}

const formatNumber = (n: number): string =>
  new Intl.NumberFormat('de-DE').format(n)

// Scoring-Regeln als lesbarer Text für die Kriterientabelle
export const scoringRules = (criterion: Criterion): string[] => {
  const unit = criterion.unit ? ` ${criterion.unit}` : ''
  if (criterion.scoring.bands) {
    return criterion.scoring.bands.map((band) =>
      band.max !== undefined
        ? `bis ${formatNumber(band.max)}${unit}: ${band.points} Punkte`
        : `darüber: ${band.points} Punkte`,
    )
  }
  if (criterion.scoring.map) {
    return Object.entries(criterion.scoring.map).map(
      ([value, points]) => `${value}: ${points} Punkte`,
    )
  }
  return []
}

export const directionLabel = (direction?: string | null): string | null => {
  if (direction === 'lower_better') return 'niedriger ist besser'
  if (direction === 'higher_better') return 'höher ist besser'
  return direction ?? null
}
