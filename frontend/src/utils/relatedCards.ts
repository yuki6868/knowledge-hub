import type { CardWithTags, RelatedCard, RelatedCardReason } from '../types/knowledge'

const TAG_MATCH_SCORE = 10
const SITE_MATCH_SCORE = 5
const TITLE_WORD_MATCH_SCORE = 3
const BODY_WORD_MATCH_SCORE = 1
const DEFAULT_LIMIT = 5

function normalizeText(value: string): string {
  return value.toLowerCase().normalize('NFKC')
}

function extractWords(value: string): string[] {
  return Array.from(
    new Set(
      normalizeText(value)
        .split(/[\s,.;:!?()[\]{}<>"'`*_#\-\/\\|、。・「」『』【】（）]+/)
        .map((word) => word.trim())
        .filter((word) => word.length >= 2),
    ),
  )
}

function addReason(reasons: RelatedCardReason[], reason: RelatedCardReason) {
  if (!reasons.includes(reason)) reasons.push(reason)
}

function scoreRelatedCard(baseCard: CardWithTags, candidate: CardWithTags): RelatedCard | null {
  let score = 0
  const reasons: RelatedCardReason[] = []

  const baseTags = new Set(baseCard.tags.map((tag) => tag.name))
  const matchedTagCount = candidate.tags.filter((tag) => baseTags.has(tag.name)).length
  if (matchedTagCount > 0) {
    score += matchedTagCount * TAG_MATCH_SCORE
    addReason(reasons, 'tag')
  }

  if (baseCard.site === candidate.site) {
    score += SITE_MATCH_SCORE
    addReason(reasons, 'site')
  }

  const baseTitleWords = new Set(extractWords(baseCard.title))
  const candidateTitleWords = extractWords(candidate.title)
  const titleMatchedCount = candidateTitleWords.filter((word) => baseTitleWords.has(word)).length
  if (titleMatchedCount > 0) {
    score += titleMatchedCount * TITLE_WORD_MATCH_SCORE
    addReason(reasons, 'title')
  }

  const baseBodyWords = new Set(extractWords(baseCard.body))
  const candidateBodyWords = extractWords(candidate.body)
  const bodyMatchedCount = candidateBodyWords.filter((word) => baseBodyWords.has(word)).length
  if (bodyMatchedCount > 0) {
    score += bodyMatchedCount * BODY_WORD_MATCH_SCORE
    addReason(reasons, 'body')
  }

  if (score <= 0) return null

  return {
    ...candidate,
    score,
    reasons,
  }
}

export function getRelatedCards(
  baseCard: CardWithTags | null,
  cards: CardWithTags[],
  limit = DEFAULT_LIMIT,
): RelatedCard[] {
  if (!baseCard) return []

  return cards
    .filter((card) => card.id !== baseCard.id && card.status !== 'trash')
    .map((card) => scoreRelatedCard(baseCard, card))
    .filter((card): card is RelatedCard => card !== null)
    .sort((a, b) => b.score - a.score || b.updated_at.localeCompare(a.updated_at))
    .slice(0, limit)
}
