// Build-Time-Anbindung an die Vergleichs-Engine über die öffentliche
// API (Schritt 2.4) — kein SQL im Frontend (CLAUDE.md). Typen kommen
// type-only aus der API, keine Parallel-Definitionen.
import type {
  ComparisonProduct,
  ComparisonResponse,
} from '../../../api/src/vergleich-public'

export type { ComparisonProduct, ComparisonResponse }

const apiUrl = (
  (import.meta.env.API_URL as string | undefined) ?? 'http://localhost:3001'
).replace(/\/$/, '')

export const API_PUBLIC_URL = (
  (import.meta.env.PUBLIC_NEWSLETTER_API_URL as string | undefined) ??
  'http://localhost:3001'
).replace(/\/$/, '')

export const fetchComparisonCategories = async (): Promise<
  ComparisonResponse['category'][]
> => {
  const res = await fetch(`${apiUrl}/api/vergleich`)
  if (!res.ok) {
    console.warn(`Vergleichs-API nicht erreichbar (${res.status}).`)
    return []
  }
  const data = (await res.json()) as { categories: ComparisonResponse['category'][] }
  return data.categories
}

export const fetchComparison = async (
  slug: string,
): Promise<ComparisonResponse> => {
  const res = await fetch(`${apiUrl}/api/vergleich/${slug}`)
  if (!res.ok) {
    throw new Error(
      `Vergleichs-API antwortete mit ${res.status} für ${slug} (Build-Abbruch).`,
    )
  }
  return (await res.json()) as ComparisonResponse
}

export const formatPrice = (
  price: ComparisonProduct['price'],
): string | null => {
  if (!price) return null
  const amount = new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: price.currency,
  }).format(price.cents / 100)
  const unit =
    price.unitAmount && price.unit
      ? ` (${new Intl.NumberFormat('de-DE').format(price.unitAmount)} ${price.unit})`
      : ''
  return `${amount}${unit}`
}
