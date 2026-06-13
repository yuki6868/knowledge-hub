import { CARD_STATUS_LABELS, SITE_TYPE_LABELS } from '../constants/knowledge'
import type { CardWithTags } from '../types/knowledge'

function escapeYamlValue(value: string): string {
  return JSON.stringify(value)
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

export function createMarkdownFileName(card: CardWithTags): string {
  return `${formatDateForFileName(card.updated_at)}_${sanitizeFileName(card.title)}.md`
}

export function createMarkdownBundleFileName(prefix = 'knowledge-hub-export'): string {
  return `${prefix}_${formatDateForFileName(new Date().toISOString())}.md`
}

export function cardToMarkdown(card: CardWithTags): string {
  const tags = card.tags.map((tag) => tag.name).sort()
  const tagLines = tags.length > 0 ? tags.map((tag) => `  - ${escapeYamlValue(tag)}`).join('\n') : '  []'

  return `---
id: ${escapeYamlValue(card.id)}
title: ${escapeYamlValue(card.title || '無題のカード')}
site: ${escapeYamlValue(card.site)}
site_label: ${escapeYamlValue(SITE_TYPE_LABELS[card.site])}
status: ${escapeYamlValue(card.status)}
status_label: ${escapeYamlValue(CARD_STATUS_LABELS[card.status])}
tags:
${tagLines}
created_at: ${escapeYamlValue(card.created_at)}
updated_at: ${escapeYamlValue(card.updated_at)}
device_id: ${escapeYamlValue(card.device_id ?? '')}
---

# ${card.title || '無題のカード'}

${card.body || ''}
`
}

export function cardsToMarkdownBundle(cards: CardWithTags[]): string {
  return cards
    .map((card, index) => {
      const divider = index === 0 ? '' : '\n\n---\n\n'
      return `${divider}${cardToMarkdown(card).trimEnd()}`
    })
    .join('')
    .concat('\n')
}

export function downloadTextFile(fileName: string, content: string): void {
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')

  anchor.href = url
  anchor.download = fileName
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

export function downloadCardAsMarkdown(card: CardWithTags): void {
  downloadTextFile(createMarkdownFileName(card), cardToMarkdown(card))
}

export function downloadCardsAsMarkdownBundle(cards: CardWithTags[], prefix?: string): void {
  if (cards.length === 0) return
  downloadTextFile(createMarkdownBundleFileName(prefix), cardsToMarkdownBundle(cards))
}
