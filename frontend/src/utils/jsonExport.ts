import type { CardWithTags } from '../types/knowledge'

type ExportedCard = {
  id: string
  title: string
  body: string
  site: CardWithTags['site']
  status: CardWithTags['status']
  tags: string[]
  created_at: string
  updated_at: string
  device_id: string | null
}

type KnowledgeHubJsonExport = {
  app: 'knowledge-hub'
  format: 'cards-json'
  version: 1
  exported_at: string
  count: number
  cards: ExportedCard[]
}

function formatDateForFileName(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'unknown-date'

  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hour = String(date.getHours()).padStart(2, '0')
  const minute = String(date.getMinutes()).padStart(2, '0')

  return `${year}-${month}-${day}_${hour}${minute}`
}

function sanitizeFileName(value: string): string {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[\\/:*?"<>|#{}%&~]/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')

  return normalized || 'untitled-card'
}

function cardToExportedCard(card: CardWithTags): ExportedCard {
  return {
    id: card.id,
    title: card.title,
    body: card.body,
    site: card.site,
    status: card.status,
    tags: card.tags.map((tag) => tag.name).sort(),
    created_at: card.created_at,
    updated_at: card.updated_at,
    device_id: card.device_id,
  }
}

export function createJsonFileName(card: CardWithTags): string {
  return `${formatDateForFileName(card.updated_at)}_${sanitizeFileName(card.title)}.json`
}

export function createJsonBundleFileName(prefix = 'knowledge-hub-export'): string {
  return `${prefix}_${formatDateForFileName(new Date().toISOString())}.json`
}

export function cardToJson(card: CardWithTags): string {
  const payload: KnowledgeHubJsonExport = {
    app: 'knowledge-hub',
    format: 'cards-json',
    version: 1,
    exported_at: new Date().toISOString(),
    count: 1,
    cards: [cardToExportedCard(card)],
  }

  return `${JSON.stringify(payload, null, 2)}\n`
}

export function cardsToJsonBundle(cards: CardWithTags[]): string {
  const payload: KnowledgeHubJsonExport = {
    app: 'knowledge-hub',
    format: 'cards-json',
    version: 1,
    exported_at: new Date().toISOString(),
    count: cards.length,
    cards: cards.map(cardToExportedCard),
  }

  return `${JSON.stringify(payload, null, 2)}\n`
}

export function downloadJsonFile(fileName: string, content: string): void {
  const blob = new Blob([content], { type: 'application/json;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')

  anchor.href = url
  anchor.download = fileName
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

export function downloadCardAsJson(card: CardWithTags): void {
  downloadJsonFile(createJsonFileName(card), cardToJson(card))
}

export function downloadCardsAsJsonBundle(cards: CardWithTags[], prefix?: string): void {
  if (cards.length === 0) return
  downloadJsonFile(createJsonBundleFileName(prefix), cardsToJsonBundle(cards))
}
