import type { CardStatus, SiteType } from '../types/knowledge'

export const CARD_STATUSES: CardStatus[] = [
  'inbox',
  'card',
  'article-ready',
  'draft',
  'published',
  'archived',
  'trash',
]

export const ACTIVE_CARD_STATUSES: CardStatus[] = CARD_STATUSES.filter(
  (status) => status !== 'trash',
)

export const ARTICLE_BOARD_STATUSES: CardStatus[] = [
  'article-ready',
  'draft',
  'published',
]

export const CARD_STATUS_LABELS: Record<CardStatus, string> = {
  inbox: 'Inbox',
  card: 'カード',
  'article-ready': '記事候補',
  draft: '下書き',
  published: '公開済み',
  archived: 'アーカイブ',
  trash: 'ゴミ箱',
}

export const SITE_TYPES: SiteType[] = [
  'note',
  'ai-system-design',
  'world-heritage',
  'accounting',
  'personal-dev',
  'other',
]

export const SITE_TYPE_LABELS: Record<SiteType, string> = {
  note: 'Note',
  'ai-system-design': 'AI時代の設計ガイド',
  'world-heritage': '世界遺産サイト',
  accounting: '会計士学習',
  'personal-dev': '個人開発',
  other: 'その他',
}
