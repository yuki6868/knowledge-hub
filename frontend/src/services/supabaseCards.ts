import { supabase } from '../lib/supabase'
import type { CardWithTags, Tag } from '../types/knowledge'
import type { Database } from '../types/database'

type CardRow = Database['public']['Tables']['cards']['Row']
type TagRow = Database['public']['Tables']['tags']['Row']
type CardTagRow = Database['public']['Tables']['card_tags']['Row']

function toCardRow(card: CardWithTags): CardRow {
  return {
    id: card.id,
    title: card.title,
    body: card.body,
    site: card.site,
    status: card.status,
    created_at: card.created_at,
    updated_at: card.updated_at,
    device_id: card.device_id,
    deleted_at: card.deleted_at ?? (card.status === 'trash' ? card.updated_at : null),
  }
}

function toTagRows(cards: CardWithTags[]): TagRow[] {
  const tagMap = new Map<string, Tag>()

  cards.forEach((card) => {
    card.tags.forEach((tag) => {
      const current = tagMap.get(tag.name)
      if (!current || tag.created_at < current.created_at) {
        tagMap.set(tag.name, tag)
      }
    })
  })

  return Array.from(tagMap.values()).map((tag) => ({
    id: tag.id,
    name: tag.name,
    created_at: tag.created_at,
  }))
}

function toCardTagRows(cards: CardWithTags[]): CardTagRow[] {
  return cards.flatMap((card) =>
    card.tags.map((tag) => ({
      card_id: card.id,
      tag_id: tag.id,
    })),
  )
}

export async function fetchCardsFromSupabase(): Promise<CardWithTags[]> {
  if (!supabase) {
    throw new Error('Supabase URL または anon key が設定されていません。')
  }

  const [cardsResult, tagsResult, cardTagsResult] = await Promise.all([
    supabase.from('cards').select('*').order('updated_at', { ascending: false }),
    supabase.from('tags').select('*'),
    supabase.from('card_tags').select('*'),
  ])

  if (cardsResult.error) throw cardsResult.error
  if (tagsResult.error) throw tagsResult.error
  if (cardTagsResult.error) throw cardTagsResult.error

  const tagsById = new Map((tagsResult.data ?? []).map((tag) => [tag.id, tag]))
  const tagIdsByCardId = new Map<string, string[]>()

  ;(cardTagsResult.data ?? []).forEach((row) => {
    const current = tagIdsByCardId.get(row.card_id) ?? []
    current.push(row.tag_id)
    tagIdsByCardId.set(row.card_id, current)
  })

  return (cardsResult.data ?? []).map((card) => ({
    id: card.id,
    title: card.title,
    body: card.body,
    site: card.site,
    status: card.status,
    created_at: card.created_at,
    updated_at: card.updated_at,
    device_id: card.device_id,
    deleted_at: card.deleted_at,
    tags: (tagIdsByCardId.get(card.id) ?? [])
      .map((tagId) => tagsById.get(tagId))
      .filter((tag): tag is TagRow => Boolean(tag))
      .map((tag) => ({
        id: tag.id,
        name: tag.name,
        created_at: tag.created_at,
      })),
  }))
}

export async function pushCardsToSupabase(cards: CardWithTags[]): Promise<void> {
  if (!supabase) {
    throw new Error('Supabase URL または anon key が設定されていません。')
  }

  const cardRows = cards.map(toCardRow)
  const tagRows = toTagRows(cards)
  const cardTagRows = toCardTagRows(cards)

  if (cardRows.length > 0) {
    const { error } = await supabase.from('cards').upsert(cardRows, { onConflict: 'id' })
    if (error) throw error
  }

  if (tagRows.length > 0) {
    const { error } = await supabase.from('tags').upsert(tagRows, { onConflict: 'id' })
    if (error) throw error
  }

  const cardIds = cards.map((card) => card.id)
  if (cardIds.length > 0) {
    const { error } = await supabase.from('card_tags').delete().in('card_id', cardIds)
    if (error) throw error
  }

  if (cardTagRows.length > 0) {
    const { error } = await supabase.from('card_tags').upsert(cardTagRows, { onConflict: 'card_id,tag_id' })
    if (error) throw error
  }
}
