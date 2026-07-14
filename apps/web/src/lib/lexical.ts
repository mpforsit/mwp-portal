// Lexical-RichText → HTML (Build-Time) + Inhaltsverzeichnis aus den
// H2-Überschriften (Redaktions-Template Teil 1: H2s = Sub-Queries).
import {
  convertLexicalToHTML,
  type HTMLConvertersFunction,
} from '@payloadcms/richtext-lexical/html'
import type {
  DefaultNodeTypes,
  SerializedHeadingNode,
} from '@payloadcms/richtext-lexical'
import type { Article } from './payload'

type RichText = Article['content']

export const slugifyHeading = (value: string): string =>
  value
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')

const nodeText = (node: { children?: unknown[] }): string =>
  (node.children ?? [])
    .map((child) => {
      const c = child as { text?: string; children?: unknown[] }
      if (typeof c.text === 'string') return c.text
      if (c.children) return nodeText(c)
      return ''
    })
    .join('')

export type TocEntry = { id: string; label: string }

export const extractToc = (content: RichText): TocEntry[] => {
  const entries: TocEntry[] = []
  for (const child of content.root.children) {
    const node = child as { type?: string; tag?: string; children?: unknown[] }
    if (node.type === 'heading' && node.tag === 'h2') {
      const label = nodeText(node)
      entries.push({ id: slugifyHeading(label), label })
    }
  }
  return entries
}

// H2s bekommen ids für Anker/TOC; alle übrigen Nodes rendern die
// Default-Converter (inkl. Tabellen als echtes HTML-table)
const converters: HTMLConvertersFunction<DefaultNodeTypes> = ({
  defaultConverters,
}) => ({
  ...defaultConverters,
  heading: ({ node, nodesToHTML }) => {
    const headingNode = node as SerializedHeadingNode
    const children = nodesToHTML({ nodes: headingNode.children }).join('')
    if (headingNode.tag === 'h2') {
      return `<h2 id="${slugifyHeading(nodeText(headingNode))}">${children}</h2>`
    }
    return `<${headingNode.tag}>${children}</${headingNode.tag}>`
  },
})

export const renderRichText = (content: RichText): string =>
  convertLexicalToHTML({ converters, data: content })
