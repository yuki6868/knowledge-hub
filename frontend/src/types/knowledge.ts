export type CardStatus =
  | 'inbox'
  | 'card'
  | 'article-ready'
  | 'draft'
  | 'published'
  | 'archived'
  | 'trash'

export type SiteType =
  | 'note'
  | 'ai-system-design'
  | 'world-heritage'
  | 'accounting'
  | 'personal-dev'
  | 'other'

export type ISODateTimeString = string
export type UUID = string

export type Card = {
  id: UUID
  title: string
  body: string
  site: SiteType
  status: CardStatus
  created_at: ISODateTimeString
  updated_at: ISODateTimeString
  device_id: string | null
  deleted_at?: ISODateTimeString | null
}

export type NewCardInput = {
  title: string
  body: string
  site?: SiteType
  status?: CardStatus
  tagNames?: string[]
  device_id?: string | null
}

export type UpdateCardInput = Partial<
  Pick<Card, 'title' | 'body' | 'site' | 'status' | 'device_id'>
> & {
  tagNames?: string[]
}

export type Tag = {
  id: UUID
  name: string
  created_at: ISODateTimeString
}

export type CardTag = {
  card_id: UUID
  tag_id: UUID
}

export type CardHistory = {
  id: UUID
  card_id: UUID
  title: string
  body: string
  saved_at: ISODateTimeString
}

export type Conflict = {
  id: UUID
  card_id: UUID
  local_title: string | null
  local_body: string | null
  remote_title: string | null
  remote_body: string | null
  created_at: ISODateTimeString
  resolved: boolean
}

export type CardWithTags = Card & {
  tags: Tag[]
}

export type RelatedCard = CardWithTags & {
  score: number
  reasons: RelatedCardReason[]
}

export type RelatedCardReason =
  | 'tag'
  | 'site'
  | 'title'
  | 'body'

export type DashboardStats = {
  totalCards: number
  inboxCards: number
  articleReadyCards: number
  draftCards: number
  publishedCards: number
  archivedCards: number
  trashCards: number
  siteCounts: Record<SiteType, number>
}
