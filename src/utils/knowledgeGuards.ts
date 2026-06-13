import { CARD_STATUSES, SITE_TYPES } from '../constants/knowledge'
import type { CardStatus, SiteType } from '../types/knowledge'

export function isCardStatus(value: string): value is CardStatus {
  return CARD_STATUSES.includes(value as CardStatus)
}

export function isSiteType(value: string): value is SiteType {
  return SITE_TYPES.includes(value as SiteType)
}

export function normalizeTagName(value: string): string {
  return value.trim().replace(/\s+/g, '-').toLowerCase()
}

export function parseTagInput(value: string): string[] {
  return Array.from(
    new Set(
      value
        .split(/[#,\n]/)
        .map(normalizeTagName)
        .filter(Boolean),
    ),
  )
}
