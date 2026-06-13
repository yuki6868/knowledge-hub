import { useEffect, useMemo, useState, type DragEvent, type KeyboardEvent } from 'react'
import {
  ARTICLE_BOARD_STATUSES,
  CARD_STATUS_LABELS,
  CARD_STATUSES,
  SITE_TYPE_LABELS,
  SITE_TYPES,
} from './constants/knowledge'
import { mockCards } from './data/mockCards'
import type { CardHistory, CardStatus, CardWithTags, Conflict, RelatedCardReason, SiteType, Tag } from './types/knowledge'
import { getRelatedCards } from './utils/relatedCards'
import { downloadCardAsJson, downloadCardsAsJsonBundle } from './utils/jsonExport'
import { downloadCardAsMarkdown, downloadCardsAsMarkdownBundle } from './utils/markdownExport'
import { isSupabaseConfigured } from './lib/supabase'
import { fetchCardsFromSupabase, pushCardsToSupabase } from './services/supabaseCards'
import './App.css'

type StatusFilter = CardStatus | 'all'
type SiteFilter = SiteType | 'all'
type TagFilter = string | 'all'
type TagSortMode = 'count' | 'name'
type EditorMode = 'new' | 'edit'
type SyncStatus = 'synced' | 'pending' | 'conflict' | 'syncing'

type SyncState = {
  status: SyncStatus
  pendingCount: number
  conflictCount: number
  lastSyncedAt: string | null
  deviceId: string
}

type StatusStep = {
  status: CardStatus
  description: string
}

const ACTIVE_CARD_STATUSES = CARD_STATUSES.filter((status) => status !== 'trash')

const STATUS_FLOW: StatusStep[] = [
  { status: 'inbox', description: '最速メモの受け皿' },
  { status: 'card', description: '知識カード化済み' },
  { status: 'article-ready', description: '記事にできる候補' },
  { status: 'draft', description: '下書き作成中' },
  { status: 'published', description: '公開済み' },
  { status: 'archived', description: '保管・参照用' },
]

function getNextStatus(status: CardStatus): CardStatus | null {
  const index = STATUS_FLOW.findIndex((step) => step.status === status)
  if (index < 0 || index >= STATUS_FLOW.length - 1) return null
  return STATUS_FLOW[index + 1].status
}

type CardFormState = {
  title: string
  body: string
  site: SiteType
  status: CardStatus
  tagsText: string
}

const EMPTY_FORM: CardFormState = {
  title: '',
  body: '',
  site: 'other',
  status: 'inbox',
  tagsText: '',
}


const RELATED_REASON_LABELS: Record<RelatedCardReason, string> = {
  tag: 'タグ一致',
  site: 'サイト一致',
  title: 'タイトル一致',
  body: '本文一致',
}

const INITIAL_SYNC_STATE: SyncState = {
  status: 'synced',
  pendingCount: 0,
  conflictCount: 0,
  lastSyncedAt: new Date().toISOString(),
  deviceId: 'local-dev',
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('ja-JP', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

function formatFullDate(value: string | null): string {
  if (!value) return 'まだ同期していません'

  return new Intl.DateTimeFormat('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(new Date(value))
}

function getPreview(body: string): string {
  if (body.length <= 96) return body
  return `${body.slice(0, 96)}...`
}

function matchesSearch(card: CardWithTags, keyword: string): boolean {
  const normalizedKeyword = keyword.trim().toLowerCase()
  if (!normalizedKeyword) return true

  const target = [
    card.title,
    card.body,
    card.site,
    card.status,
    ...card.tags.map((tag) => tag.name),
  ]
    .join(' ')
    .toLowerCase()

  return target.includes(normalizedKeyword)
}

function createId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function getOrCreateDeviceId(): string {
  const storageKey = 'knowledge-hub-device-id'
  const current = window.localStorage.getItem(storageKey)
  if (current) return current

  const next = `device-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  window.localStorage.setItem(storageKey, next)
  return next
}

function normalizeTagName(value: string): string {
  return value.trim().replace(/^#/, '').toLowerCase()
}

function getConflictPreview(localValue: string | null, remoteValue: string | null): string {
  if (localValue && remoteValue && localValue !== remoteValue) return '差分あり'
  if (localValue === remoteValue) return '同じ内容'
  if (localValue && !remoteValue) return 'ローカルのみ'
  if (!localValue && remoteValue) return 'リモートのみ'
  return '空'
}

function hasTag(card: CardWithTags, tagName: string): boolean {
  return card.tags.some((tag) => tag.name === tagName)
}

function parseTags(tagsText: string): Tag[] {
  const now = new Date().toISOString()

  return Array.from(
    new Set(
      tagsText
        .split(',')
        .map(normalizeTagName)
        .filter(Boolean)
        .sort(),
    ),
  ).map((name) => ({
    id: createId('tag'),
    name,
    created_at: now,
  }))
}

function toFormState(card: CardWithTags): CardFormState {
  return {
    title: card.title,
    body: card.body,
    site: card.site,
    status: card.status,
    tagsText: card.tags.map((tag) => tag.name).join(', '),
  }
}

function App() {
  const [cards, setCards] = useState<CardWithTags[]>(mockCards)
  const [cardHistories, setCardHistories] = useState<CardHistory[]>([])
  const [conflicts, setConflicts] = useState<Conflict[]>([])
  const [selectedConflictId, setSelectedConflictId] = useState<string | null>(null)
  const [searchText, setSearchText] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [siteFilter, setSiteFilter] = useState<SiteFilter>('all')
  const [tagFilter, setTagFilter] = useState<TagFilter>('all')
  const [tagSearchText, setTagSearchText] = useState('')
  const [tagSortMode, setTagSortMode] = useState<TagSortMode>('count')
  const [showTrash, setShowTrash] = useState(false)
  const [showArticleBoard, setShowArticleBoard] = useState(false)
  const [showDetail, setShowDetail] = useState(false)
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null)
  const [exportCardIds, setExportCardIds] = useState<string[]>([])
  const [editorMode, setEditorMode] = useState<EditorMode>('new')
  const [form, setForm] = useState<CardFormState>(EMPTY_FORM)
  const [isQuickMemoOpen, setIsQuickMemoOpen] = useState(false)
  const [quickMemoTitle, setQuickMemoTitle] = useState('')
  const [quickMemoBody, setQuickMemoBody] = useState('')
  const [draggingArticleCardId, setDraggingArticleCardId] = useState<string | null>(null)
  const [dragOverArticleStatus, setDragOverArticleStatus] = useState<CardStatus | null>(null)
  const [syncState, setSyncState] = useState<SyncState>(() => ({
    ...INITIAL_SYNC_STATE,
    deviceId: getOrCreateDeviceId(),
  }))
  const [syncMessage, setSyncMessage] = useState<string | null>(null)
  const [syncError, setSyncError] = useState<string | null>(null)

  const selectedCard = useMemo(() => {
    return cards.find((card) => card.id === selectedCardId) ?? null
  }, [cards, selectedCardId])

  const selectedCardHistories = useMemo(() => {
    if (!selectedCardId) return []

    return cardHistories
      .filter((history) => history.card_id === selectedCardId)
      .sort((a, b) => b.saved_at.localeCompare(a.saved_at))
  }, [cardHistories, selectedCardId])

  const relatedCards = useMemo(() => {
    return getRelatedCards(selectedCard, cards, 5)
  }, [cards, selectedCard])

  const unresolvedConflicts = useMemo(() => {
    return conflicts
      .filter((conflict) => !conflict.resolved)
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
  }, [conflicts])

  const selectedConflict = useMemo(() => {
    return unresolvedConflicts.find((conflict) => conflict.id === selectedConflictId) ?? unresolvedConflicts[0] ?? null
  }, [selectedConflictId, unresolvedConflicts])

  const selectedConflictCard = useMemo(() => {
    if (!selectedConflict) return null
    return cards.find((card) => card.id === selectedConflict.card_id) ?? null
  }, [cards, selectedConflict])

  useEffect(() => {
    if (!syncMessage && !syncError) return

    const timerId = window.setTimeout(() => {
      setSyncMessage(null)
      setSyncError(null)
    }, 6000)

    return () => window.clearTimeout(timerId)
  }, [syncError, syncMessage])

  const markLocalChange = () => {
    setSyncState((current) => ({
      ...current,
      status: unresolvedConflicts.length > 0 ? 'conflict' : 'pending',
      pendingCount: current.pendingCount + 1,
      conflictCount: unresolvedConflicts.length,
    }))
  }

  const markSynced = () => {
    setSyncState((current) => ({
      ...current,
      status: unresolvedConflicts.length > 0 ? 'conflict' : 'synced',
      pendingCount: 0,
      conflictCount: unresolvedConflicts.length,
      lastSyncedAt: new Date().toISOString(),
    }))
  }

  const loadFromSupabase = async () => {
    setSyncError(null)
    setSyncMessage(null)
    setSyncState((current) => ({ ...current, status: 'syncing' }))

    try {
      const remoteCards = await fetchCardsFromSupabase()
      setCards(remoteCards)
      setSelectedCardId(null)
      setShowDetail(false)
      setShowTrash(false)
      setShowArticleBoard(false)
      setExportCardIds([])
      setSyncState((current) => ({
        ...current,
        status: unresolvedConflicts.length > 0 ? 'conflict' : 'synced',
        pendingCount: 0,
        conflictCount: unresolvedConflicts.length,
        lastSyncedAt: new Date().toISOString(),
      }))
      setSyncMessage(`Supabaseから${remoteCards.length}件読み込みました。`)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Supabaseからの読み込みに失敗しました。'
      setSyncError(message)
      setSyncState((current) => ({
        ...current,
        status: unresolvedConflicts.length > 0 ? 'conflict' : current.pendingCount > 0 ? 'pending' : 'synced',
      }))
    }
  }

  const syncToSupabase = async () => {
    setSyncError(null)
    setSyncMessage(null)
    setSyncState((current) => ({ ...current, status: 'syncing' }))

    try {
      await pushCardsToSupabase(cards)
      setSyncState((current) => ({
        ...current,
        status: unresolvedConflicts.length > 0 ? 'conflict' : 'synced',
        pendingCount: 0,
        conflictCount: unresolvedConflicts.length,
        lastSyncedAt: new Date().toISOString(),
      }))
      setSyncMessage(`Supabaseへ${cards.length}件同期しました。`)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Supabaseへの同期に失敗しました。'
      setSyncError(message)
      setSyncState((current) => ({
        ...current,
        status: unresolvedConflicts.length > 0 ? 'conflict' : 'pending',
      }))
    }
  }

  const simulateConflict = () => {
    const targetCard = selectedCard ?? cards.find((card) => card.status !== 'trash') ?? null
    if (!targetCard) return

    const now = new Date().toISOString()
    const conflict: Conflict = {
      id: createId('conflict'),
      card_id: targetCard.id,
      local_title: targetCard.title,
      local_body: targetCard.body,
      remote_title: `${targetCard.title}（別端末版）`,
      remote_body: `${targetCard.body}

---
別端末で追記された想定メモです。`,
      created_at: now,
      resolved: false,
    }

    setConflicts((current) => [conflict, ...current])
    setSelectedConflictId(conflict.id)
    setSyncState((current) => ({
      ...current,
      status: 'conflict',
      conflictCount: current.conflictCount + 1,
    }))
  }

  const resolveConflict = (conflictId: string, strategy: 'local' | 'remote') => {
    const conflict = conflicts.find((item) => item.id === conflictId)
    if (!conflict) return

    const now = new Date().toISOString()

    if (strategy === 'remote') {
      setCards((current) =>
        current.map((card) =>
          card.id === conflict.card_id
            ? {
                ...card,
                title: conflict.remote_title ?? card.title,
                body: conflict.remote_body ?? card.body,
                updated_at: now,
              }
            : card,
        ),
      )

      if (selectedCardId === conflict.card_id) {
        setForm((current) => ({
          ...current,
          title: conflict.remote_title ?? current.title,
          body: conflict.remote_body ?? current.body,
        }))
      }
    }

    setConflicts((current) =>
      current.map((item) => (item.id === conflictId ? { ...item, resolved: true } : item)),
    )
    setSelectedConflictId(null)

    const nextConflictCount = Math.max(unresolvedConflicts.length - 1, 0)
    setSyncState((current) => ({
      ...current,
      status: nextConflictCount > 0 ? 'conflict' : current.pendingCount > 0 ? 'pending' : 'synced',
      conflictCount: nextConflictCount,
    }))
  }

  const resolveConflicts = () => {
    setConflicts((current) => current.map((conflict) => ({ ...conflict, resolved: true })))
    setSelectedConflictId(null)
    setSyncState((current) => ({
      ...current,
      status: current.pendingCount > 0 ? 'pending' : 'synced',
      conflictCount: 0,
    }))
  }

  const allTags = useMemo(() => {
    const tagMap = new Map<string, { name: string; count: number; sites: Set<SiteType> }>()

    cards
      .filter((card) => card.status !== 'trash')
      .forEach((card) => {
        card.tags.forEach((tag) => {
          const current = tagMap.get(tag.name) ?? {
            name: tag.name,
            count: 0,
            sites: new Set<SiteType>(),
          }
          current.count += 1
          current.sites.add(card.site)
          tagMap.set(tag.name, current)
        })
      })

    const normalizedSearch = tagSearchText.trim().toLowerCase()

    return Array.from(tagMap.values())
      .filter((tag) => !normalizedSearch || tag.name.includes(normalizedSearch))
      .sort((a, b) => {
        if (tagSortMode === 'name') return a.name.localeCompare(b.name)
        return b.count - a.count || a.name.localeCompare(b.name)
      })
  }, [cards, tagSearchText, tagSortMode])

  const siteStats = useMemo(() => {
    return SITE_TYPES.map((site) => {
      const siteCards = cards.filter((card) => card.site === site && card.status !== 'trash')
      return {
        site,
        total: siteCards.length,
        articleReady: siteCards.filter((card) => card.status === 'article-ready').length,
        draft: siteCards.filter((card) => card.status === 'draft').length,
        published: siteCards.filter((card) => card.status === 'published').length,
      }
    })
  }, [cards])

  const statusStats = useMemo(() => {
    return STATUS_FLOW.map((step) => {
      const statusCards = cards.filter((card) => card.status === step.status)
      return {
        ...step,
        count: statusCards.length,
        latestUpdatedAt: statusCards.map((card) => card.updated_at).sort().at(-1) ?? null,
      }
    })
  }, [cards])

  const dashboardStats = useMemo(() => {
    const activeCards = cards.filter((card) => card.status !== 'trash')
    const articleCards = activeCards.filter((card) =>
      ['article-ready', 'draft', 'published'].includes(card.status),
    )
    const publishedCards = activeCards.filter((card) => card.status === 'published')
    const recentCards = [...activeCards]
      .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
      .slice(0, 4)

    const siteRows = SITE_TYPES.map((site) => {
      const siteCards = activeCards.filter((card) => card.site === site)
      const published = siteCards.filter((card) => card.status === 'published').length
      const inPipeline = siteCards.filter((card) =>
        ['article-ready', 'draft', 'published'].includes(card.status),
      ).length

      return {
        site,
        total: siteCards.length,
        inPipeline,
        published,
      }
    }).sort((a, b) => b.total - a.total || a.site.localeCompare(b.site))

    return {
      articleCards,
      publishedCards,
      recentCards,
      siteRows,
      pipelineRate: activeCards.length > 0 ? Math.round((articleCards.length / activeCards.length) * 100) : 0,
      publishRate: articleCards.length > 0 ? Math.round((publishedCards.length / articleCards.length) * 100) : 0,
    }
  }, [cards])

  const articleBoardColumns = useMemo(() => {
    return ARTICLE_BOARD_STATUSES.map((status) => ({
      status,
      cards: cards
        .filter((card) => card.status === status)
        .sort((a, b) => b.updated_at.localeCompare(a.updated_at)),
    }))
  }, [cards])

  const articlePipelineCount = articleBoardColumns.reduce((total, column) => total + column.cards.length, 0)

  const activeSiteLabel = siteFilter === 'all' ? 'すべてのサイト' : SITE_TYPE_LABELS[siteFilter]
  const activeStatusLabel = statusFilter === 'all' ? 'すべての状態' : CARD_STATUS_LABELS[statusFilter]

  const visibleCards = useMemo(() => {
    return cards
      .filter((card) => (showTrash ? card.status === 'trash' : card.status !== 'trash'))
      .filter((card) => statusFilter === 'all' || card.status === statusFilter)
      .filter((card) => siteFilter === 'all' || card.site === siteFilter)
      .filter((card) => tagFilter === 'all' || hasTag(card, tagFilter))
      .filter((card) => matchesSearch(card, searchText))
      .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
  }, [cards, searchText, showTrash, siteFilter, statusFilter, tagFilter])

  const selectedExportCards = useMemo(() => {
    const selectedIds = new Set(exportCardIds)
    return cards
      .filter((card) => selectedIds.has(card.id) && card.status !== 'trash')
      .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
  }, [cards, exportCardIds])

  const exportableCards = useMemo(() => {
    return cards
      .filter((card) => card.status !== 'trash')
      .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
  }, [cards])

  const activeCardCount = cards.filter((card) => card.status !== 'trash').length
  const articleReadyCount = cards.filter((card) => card.status === 'article-ready').length
  const publishedCount = cards.filter((card) => card.status === 'published').length
  const trashCards = cards.filter((card) => card.status === 'trash')
  const trashCount = trashCards.length
  const totalTagCount = allTags.length
  const syncStatusLabel =
    unresolvedConflicts.length > 0
      ? '競合あり'
      : syncState.status === 'syncing'
        ? '同期中'
        : syncState.status === 'synced'
          ? '同期済み'
          : '未同期あり'
  const syncStatusDescription =
    unresolvedConflicts.length > 0
      ? '別端末更新との衝突があります。下の競合管理で採用する内容を選びます。'
      : !isSupabaseConfigured
        ? 'Supabase未設定です。.env.local に URL と anon key を設定すると同期できます。'
        : syncState.status === 'syncing'
          ? 'Supabaseと通信しています。'
          : syncState.status === 'synced'
            ? 'ローカル変更はすべて同期済みです。'
            : 'ローカル変更があります。Supabaseへ手動同期できます。'

  const openQuickMemo = () => {
    setQuickMemoTitle('')
    setQuickMemoBody('')
    setIsQuickMemoOpen(true)
  }

  const closeQuickMemo = () => {
    setIsQuickMemoOpen(false)
  }

  const saveQuickMemo = () => {
    const trimmedTitle = quickMemoTitle.trim()
    const trimmedBody = quickMemoBody.trim()

    if (!trimmedTitle && !trimmedBody) return

    const now = new Date().toISOString()
    const newCard: CardWithTags = {
      id: createId('card'),
      title: trimmedTitle || getPreview(trimmedBody) || '無題のメモ',
      body: quickMemoBody,
      site: 'other',
      status: 'inbox',
      created_at: now,
      updated_at: now,
      device_id: syncState.deviceId,
      tags: [],
    }

    setCards((current) => [newCard, ...current])
    setSelectedCardId(newCard.id)
    setEditorMode('new')
    setForm(EMPTY_FORM)
    setQuickMemoTitle('')
    setQuickMemoBody('')
    setIsQuickMemoOpen(false)
    setShowTrash(false)
    setShowArticleBoard(false)
    setShowDetail(false)
    markLocalChange()
  }

  const handleQuickMemoKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
      event.preventDefault()
      saveQuickMemo()
    }
  }

  const startNewCard = () => {
    setEditorMode('new')
    setSelectedCardId(null)
    setForm(EMPTY_FORM)
    setShowTrash(false)
    setShowArticleBoard(false)
    setShowDetail(false)
  }

  const selectCard = (card: CardWithTags) => {
    setEditorMode('edit')
    setSelectedCardId(card.id)
    setForm(toFormState(card))
    setShowDetail(true)
  }

  const jumpToRelatedCard = (card: CardWithTags) => {
    setShowTrash(false)
    setShowArticleBoard(false)
    setStatusFilter('all')
    setTagFilter('all')
    setSiteFilter('all')
    selectCard(card)
  }

  const selectSite = (site: SiteFilter) => {
    setSiteFilter(site)
    setShowTrash(false)
  }

  const openTrashWindow = () => {
    setShowTrash(true)
    setShowArticleBoard(false)
    setStatusFilter('all')
    setTagFilter('all')
    setSelectedCardId(null)
    setShowDetail(false)
    setEditorMode('new')
    setForm(EMPTY_FORM)
  }

  const closeTrashWindow = () => {
    setShowTrash(false)
    setStatusFilter('all')
    setTagFilter('all')
  }

  const toggleExportCard = (cardId: string) => {
    setExportCardIds((current) =>
      current.includes(cardId) ? current.filter((id) => id !== cardId) : [...current, cardId],
    )
  }

  const selectVisibleExportCards = () => {
    setExportCardIds(visibleCards.filter((card) => card.status !== 'trash').map((card) => card.id))
  }

  const clearExportSelection = () => {
    setExportCardIds([])
  }

  const exportSelectedCardsAsMarkdown = () => {
    downloadCardsAsMarkdownBundle(selectedExportCards, 'selected-cards')
  }

  const exportVisibleCardsAsMarkdown = () => {
    downloadCardsAsMarkdownBundle(
      visibleCards.filter((card) => card.status !== 'trash'),
      'visible-cards',
    )
  }

  const exportAllCardsAsMarkdown = () => {
    downloadCardsAsMarkdownBundle(exportableCards, 'all-cards')
  }

  const exportSelectedCardsAsJson = () => {
    downloadCardsAsJsonBundle(selectedExportCards, 'selected-cards')
  }

  const exportVisibleCardsAsJson = () => {
    downloadCardsAsJsonBundle(
      visibleCards.filter((card) => card.status !== 'trash'),
      'visible-cards',
    )
  }

  const exportAllCardsAsJson = () => {
    downloadCardsAsJsonBundle(exportableCards, 'all-cards')
  }

  const saveCard = () => {
    const now = new Date().toISOString()
    const normalizedTitle = form.title.trim() || '無題のカード'
    const nextTags = parseTags(form.tagsText)

    if (editorMode === 'new') {
      const newCard: CardWithTags = {
        id: createId('card'),
        title: normalizedTitle,
        body: form.body,
        site: form.site,
        status: form.status,
        created_at: now,
        updated_at: now,
        device_id: syncState.deviceId,
        tags: nextTags,
      }

      setCards((current) => [newCard, ...current])
      setSelectedCardId(newCard.id)
      setEditorMode('new')
      setShowDetail(false)
      setForm(EMPTY_FORM)
      markLocalChange()
      return
    }

    if (!selectedCard) return

    const titleChanged = selectedCard.title !== normalizedTitle
    const bodyChanged = selectedCard.body !== form.body

    if (titleChanged || bodyChanged) {
      const snapshot: CardHistory = {
        id: createId('history'),
        card_id: selectedCard.id,
        title: selectedCard.title,
        body: selectedCard.body,
        saved_at: now,
      }

      setCardHistories((current) => [snapshot, ...current])
    }

    setCards((current) =>
      current.map((card) =>
        card.id === selectedCard.id
          ? {
              ...card,
              title: normalizedTitle,
              body: form.body,
              site: form.site,
              status: form.status,
              tags: nextTags,
              updated_at: now,
            }
          : card,
      ),
    )
    markLocalChange()
  }

  const moveToTrash = (cardId: string) => {
    updateCardStatus(cardId, 'trash')
  }

  const updateCardStatus = (cardId: string, status: CardStatus) => {
    const now = new Date().toISOString()

    setCards((current) =>
      current.map((card) =>
        card.id === cardId
          ? {
              ...card,
              status,
              updated_at: now,
            }
          : card,
      ),
    )

    if (selectedCardId === cardId) {
      setForm((current) => ({ ...current, status }))
    }

    markLocalChange()

    // 状態変更後に勝手に画面遷移しない。
    // ゴミ箱へ移動してもカード一覧に残り、復元してもゴミ箱画面に残る。
  }

  const openArticleBoard = () => {
    setShowArticleBoard(true)
    setShowTrash(false)
    setStatusFilter('all')
    setTagFilter('all')
  }

  const closeArticleBoard = () => {
    setShowArticleBoard(false)
  }

  const handleArticleDragStart = (event: DragEvent<HTMLElement>, cardId: string) => {
    setDraggingArticleCardId(cardId)
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', cardId)
  }

  const handleArticleDragEnd = () => {
    setDraggingArticleCardId(null)
    setDragOverArticleStatus(null)
  }

  const handleArticleDragOver = (event: DragEvent<HTMLElement>, status: CardStatus) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
    setDragOverArticleStatus(status)
  }

  const handleArticleDrop = (event: DragEvent<HTMLElement>, status: CardStatus) => {
    event.preventDefault()

    const cardId = event.dataTransfer.getData('text/plain') || draggingArticleCardId
    setDraggingArticleCardId(null)
    setDragOverArticleStatus(null)

    if (!cardId) return

    const targetCard = cards.find((card) => card.id === cardId)
    if (!targetCard || targetCard.status === status) return

    updateCardStatus(cardId, status)
  }

  const restoreCard = (cardId: string) => {
    updateCardStatus(cardId, 'card')
  }

  const restoreAllTrashCards = () => {
    if (trashCount === 0) return

    const ok = window.confirm(`ゴミ箱内の${trashCount}件をすべてカードへ復元します。`)
    if (!ok) return

    const now = new Date().toISOString()
    setCards((current) =>
      current.map((card) =>
        card.status === 'trash'
          ? {
              ...card,
              status: 'card',
              updated_at: now,
            }
          : card,
      ),
    )
    markLocalChange()
    // 全件復元後も勝手にカード一覧へ戻らない。
  }

  const emptyTrash = () => {
    if (trashCount === 0) return

    const ok = window.confirm(
      `ゴミ箱内の${trashCount}件を完全削除します。復元できません。実行しますか？`,
    )
    if (!ok) return

    const trashIds = new Set(trashCards.map((card) => card.id))
    setCards((current) => current.filter((card) => card.status !== 'trash'))

    if (selectedCardId && trashIds.has(selectedCardId)) {
      setSelectedCardId(null)
      setShowDetail(false)
      setEditorMode('new')
      setForm(EMPTY_FORM)
    }
    markLocalChange()
  }

  const permanentlyDeleteCard = (cardId: string) => {
    const ok = window.confirm('このカードを完全削除します。復元できません。')
    if (!ok) return

    setCards((current) => current.filter((card) => card.id !== cardId))
    setCardHistories((current) => current.filter((history) => history.card_id !== cardId))
    if (selectedCardId === cardId) {
      setSelectedCardId(null)
      setShowDetail(false)
      setEditorMode('new')
      setForm(EMPTY_FORM)
    }
    markLocalChange()
  }

  const restoreHistoryToForm = (history: CardHistory) => {
    setForm((current) => ({
      ...current,
      title: history.title,
      body: history.body,
    }))
  }

  const quickMemoModal = isQuickMemoOpen ? (
    <div
      className="quick-memo-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="quick-memo-title"
      onMouseDown={closeQuickMemo}
    >
      <section className="quick-memo-dialog" onMouseDown={(event) => event.stopPropagation()}>
        <div className="quick-memo-header">
          <div>
            <p className="eyebrow">Quick Memo</p>
            <h2 id="quick-memo-title">クイックメモ</h2>
            <p>あとで整理する前提で、まずは inbox に放り込みます。</p>
          </div>
          <button className="quick-memo-close" type="button" onClick={closeQuickMemo} aria-label="閉じる">
            ×
          </button>
        </div>

        <label className="quick-memo-field">
          <span>タイトル（任意）</span>
          <input
            value={quickMemoTitle}
            onChange={(event) => setQuickMemoTitle(event.target.value)}
            placeholder="空なら本文から自動で作ります"
            autoFocus
          />
        </label>

        <label className="quick-memo-field">
          <span>本文</span>
          <textarea
            value={quickMemoBody}
            onChange={(event) => setQuickMemoBody(event.target.value)}
            onKeyDown={handleQuickMemoKeyDown}
            placeholder="思いついたことをそのまま書く。Cmd/Ctrl + Enter で保存。"
            rows={9}
          />
        </label>

        <div className="quick-memo-info">
          <span>保存先</span>
          <strong>status: inbox / site: other / tags: なし</strong>
        </div>

        <div className="quick-memo-actions">
          <button className="ghost-button" type="button" onClick={closeQuickMemo}>
            キャンセル
          </button>
          <button
            className="primary-button"
            type="button"
            onClick={saveQuickMemo}
            disabled={!quickMemoTitle.trim() && !quickMemoBody.trim()}
          >
            inboxへ保存
          </button>
        </div>
      </section>
    </div>
  ) : null

  if (showTrash) {
    return (
      <main className="app-shell trash-screen">
        {quickMemoModal}
        <header className="app-header trash-window-header">
          <div>
            <p className="eyebrow">Trash Window</p>
            <h1>ゴミ箱</h1>
            <p className="lead">
              通常削除したカードだけを別画面で確認します。復元するか、ここから明示的に完全削除します。
            </p>
          </div>
          <div className="trash-window-actions">
            <button className="ghost-button" type="button" onClick={closeTrashWindow}>
              ← カード一覧へ戻る
            </button>
            <button className="primary-button" type="button" onClick={openQuickMemo}>
              + クイックメモ
            </button>
          </div>
        </header>

        <section className="trash-window-summary" aria-label="ゴミ箱サマリー">
          <article className="summary-card danger-summary">
            <span>ゴミ箱内</span>
            <strong>{trashCount}</strong>
          </article>
          <article className="summary-card">
            <span>通常カード</span>
            <strong>{activeCardCount}</strong>
          </article>
          <div className="trash-window-note">
            <strong>ここは別画面です。</strong>
            <p>通常一覧ではゴミ箱カードを表示しません。完全削除はこの画面だけで実行します。</p>
          </div>
        </section>

        <section className="toolbar trash-toolbar" aria-label="ゴミ箱検索">
          <label className="search-box">
            <span>ゴミ箱内検索</span>
            <input
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              placeholder="タイトル・本文・タグで検索"
            />
          </label>
          <label>
            <span>サイト</span>
            <select
              value={siteFilter}
              onChange={(event) => setSiteFilter(event.target.value as SiteFilter)}
            >
              <option value="all">すべて</option>
              {SITE_TYPES.map((site) => (
                <option key={site} value={site}>
                  {SITE_TYPE_LABELS[site]}
                </option>
              ))}
            </select>
          </label>
          <div className="trash-actions">
            <button type="button" onClick={restoreAllTrashCards} disabled={trashCount === 0}>
              全て復元
            </button>
            <button className="danger" type="button" onClick={emptyTrash} disabled={trashCount === 0}>
              ゴミ箱を空にする
            </button>
          </div>
        </section>

        <section className="card-list trash-card-list" aria-label="ゴミ箱カード一覧">
          <div className="list-header">
            <div>
              <h2>ゴミ箱のカード</h2>
              <p className="active-filter-note">
                {activeSiteLabel}
                {tagFilter !== 'all' ? ` / #${tagFilter}` : ''}
              </p>
            </div>
            <span>{visibleCards.length}件</span>
          </div>

          {visibleCards.length === 0 ? (
            <div className="empty-state">
              <strong>ゴミ箱は空です</strong>
              <p>削除したカードはここに表示されます。</p>
            </div>
          ) : (
            <div className="cards-grid trash-cards-grid">
              {visibleCards.map((card) => (
                <article className="knowledge-card trash-card" key={card.id}>
                  <div className="card-topline">
                    <span className="site-pill">{SITE_TYPE_LABELS[card.site]}</span>
                    <span className={`status-pill status-${card.status}`}>
                      {CARD_STATUS_LABELS[card.status]}
                    </span>
                  </div>
                  <h3>{card.title}</h3>
                  <p>{getPreview(card.body)}</p>
                  <div className="tag-row">
                    {card.tags.map((tag) => (
                      <span key={tag.id}>#{tag.name}</span>
                    ))}
                  </div>
                  <div className="card-footer">
                    <span>更新 {formatDate(card.updated_at)}</span>
                    <div className="action-row" onClick={(event) => event.stopPropagation()}>
                      <button type="button" onClick={() => restoreCard(card.id)}>
                        復元
                      </button>
                      <button
                        className="danger"
                        type="button"
                        onClick={() => permanentlyDeleteCard(card.id)}
                      >
                        完全削除
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </main>
    )
  }


  if (showDetail && selectedCard) {
    return (
      <main className="app-shell detail-screen">
        {quickMemoModal}
        <header className="app-header detail-header">
          <div>
            <p className="eyebrow">Card Detail</p>
            <h1>{selectedCard.title || '無題のカード'}</h1>
            <p className="lead">
              一覧とは別画面で、本文・タグ・状態・関連カード・履歴をまとめて確認します。
            </p>
          </div>
          <div className="detail-header-actions">
            <button className="ghost-button" type="button" onClick={() => setShowDetail(false)}>
              ← カード一覧へ戻る
            </button>
            <button className="primary-button" type="button" onClick={openQuickMemo}>
              + クイックメモ
            </button>
          </div>
        </header>

        <section className="detail-layout" aria-label="カード詳細">
          <article className="detail-main-panel">
            <div className="detail-card-meta">
              <span className="site-pill">{SITE_TYPE_LABELS[selectedCard.site]}</span>
              <span className={`status-pill status-${selectedCard.status}`}>
                {CARD_STATUS_LABELS[selectedCard.status]}
              </span>
              <span>作成 {formatDate(selectedCard.created_at)}</span>
              <span>更新 {formatDate(selectedCard.updated_at)}</span>
            </div>

            <label className="form-field">
              <span>タイトル</span>
              <input
                value={form.title}
                onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                placeholder="例: React設計メモ"
              />
            </label>

            <label className="form-field">
              <span>本文</span>
              <textarea
                value={form.body}
                onChange={(event) => setForm((current) => ({ ...current, body: event.target.value }))}
                placeholder="思いついたことをそのまま書く"
                rows={16}
              />
            </label>

            <div className="form-row">
              <label className="form-field">
                <span>サイト</span>
                <select
                  value={form.site}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, site: event.target.value as SiteType }))
                  }
                >
                  {SITE_TYPES.map((site) => (
                    <option key={site} value={site}>
                      {SITE_TYPE_LABELS[site]}
                    </option>
                  ))}
                </select>
              </label>

              <label className="form-field">
                <span>状態</span>
                <select
                  value={form.status}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, status: event.target.value as CardStatus }))
                  }
                >
                  {ACTIVE_CARD_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {CARD_STATUS_LABELS[status]}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="status-quick-actions" aria-label="状態変更ショートカット">
              {STATUS_FLOW.map((step) => (
                <button
                  className={form.status === step.status ? 'status-step-button active' : 'status-step-button'}
                  key={step.status}
                  type="button"
                  onClick={() => setForm((current) => ({ ...current, status: step.status }))}
                >
                  {CARD_STATUS_LABELS[step.status]}
                </button>
              ))}
            </div>

            <label className="form-field">
              <span>タグ</span>
              <input
                value={form.tagsText}
                onChange={(event) => setForm((current) => ({ ...current, tagsText: event.target.value }))}
                placeholder="react, design, note"
                list="known-tags"
              />
              <datalist id="known-tags">
                {allTags.map((tag) => (
                  <option key={tag.name} value={tag.name} />
                ))}
              </datalist>
            </label>

            <div className="editor-actions detail-actions">
              <button className="primary-button" type="button" onClick={saveCard}>
                保存
              </button>
              <button className="ghost-button" type="button" onClick={() => downloadCardAsMarkdown(selectedCard)}>
                Markdown出力
              </button>
              <button className="ghost-button" type="button" onClick={() => downloadCardAsJson(selectedCard)}>
                JSON出力
              </button>
              <button className="danger-outline-button" type="button" onClick={() => moveToTrash(selectedCard.id)}>
                ゴミ箱へ移動
              </button>
            </div>
          </article>

          <aside className="detail-side-panel">
            <section className="related-panel" aria-label="関連カード">
              <div className="related-header">
                <div>
                  <p className="eyebrow">Related Cards</p>
                  <h3>関連カード</h3>
                </div>
                <span>{relatedCards.length}件</span>
              </div>

              {relatedCards.length === 0 ? (
                <p className="related-empty">タグ・サイト・タイトル・本文単語が近いカードはまだありません。</p>
              ) : (
                <div className="related-list">
                  {relatedCards.map((card) => (
                    <button
                      className="related-item"
                      key={card.id}
                      type="button"
                      onClick={() => jumpToRelatedCard(card)}
                    >
                      <div className="related-item-main">
                        <strong>{card.title || '無題のカード'}</strong>
                        <span>{SITE_TYPE_LABELS[card.site]}</span>
                      </div>
                      <p>{getPreview(card.body)}</p>
                      <div className="related-meta">
                        <b>{card.score}点</b>
                        {card.reasons.map((reason) => (
                          <em key={reason}>{RELATED_REASON_LABELS[reason]}</em>
                        ))}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </section>

            <section className="history-panel" aria-label="編集履歴">
              <div className="history-header">
                <div>
                  <p className="eyebrow">History</p>
                  <h3>編集履歴</h3>
                </div>
                <span>{selectedCardHistories.length}件</span>
              </div>

              {selectedCardHistories.length === 0 ? (
                <p className="history-empty">まだ編集前データはありません。保存時に変更前のタイトルと本文を残します。</p>
              ) : (
                <div className="history-list">
                  {selectedCardHistories.map((history) => (
                    <article className="history-item" key={history.id}>
                      <div>
                        <strong>{history.title || '無題のカード'}</strong>
                        <span>{formatFullDate(history.saved_at)}</span>
                      </div>
                      <p>{getPreview(history.body)}</p>
                      <button type="button" onClick={() => restoreHistoryToForm(history)}>
                        フォームに戻す
                      </button>
                    </article>
                  ))}
                </div>
              )}
            </section>
          </aside>
        </section>
      </main>
    )
  }


  if (showArticleBoard) {
    return (
      <main className="app-shell article-board-screen">
        {quickMemoModal}
        <header className="app-header article-board-screen-header">
          <div>
            <p className="eyebrow">Article Board</p>
            <h1>記事化ボード</h1>
            <p className="lead">
              記事候補・下書き・公開済みを別画面のKanbanで管理します。カードをドラッグ&ドロップして状態を移動できます。
            </p>
          </div>
          <div className="article-board-window-actions">
            <button className="ghost-button" type="button" onClick={closeArticleBoard}>
              ← カード一覧へ戻る
            </button>
            <button className="primary-button" type="button" onClick={openQuickMemo}>
              + クイックメモ
            </button>
          </div>
        </header>

        <section className="article-board-summary" aria-label="記事化ボードサマリー">
          <article className="summary-card">
            <span>記事候補</span>
            <strong>{articleReadyCount}</strong>
          </article>
          <article className="summary-card">
            <span>下書き</span>
            <strong>{cards.filter((card) => card.status === 'draft').length}</strong>
          </article>
          <article className="summary-card">
            <span>公開済み</span>
            <strong>{publishedCount}</strong>
          </article>
          <div className="article-board-note">
            <strong>ドラッグで状態変更</strong>
            <p>列にドロップすると status を更新します。大量に増えても列ごとにスクロールできます。</p>
          </div>
        </section>

        <section className="article-board article-board-full" aria-label="記事化ボード">
          <div className="article-board-header">
            <div>
              <p className="eyebrow">Kanban</p>
              <h2>記事パイプライン</h2>
              <p>カードを掴んで、記事候補・下書き・公開済みの列へ移動します。</p>
            </div>
            <strong>{articlePipelineCount}件</strong>
          </div>

          <div className="article-kanban article-kanban-full">
            {articleBoardColumns.map((column) => (
              <section
                className={
                  dragOverArticleStatus === column.status
                    ? `article-column article-column-${column.status} drag-over`
                    : `article-column article-column-${column.status}`
                }
                key={column.status}
                onDragOver={(event) => handleArticleDragOver(event, column.status)}
                onDragLeave={() => setDragOverArticleStatus(null)}
                onDrop={(event) => handleArticleDrop(event, column.status)}
              >
                <div className="article-column-header">
                  <div>
                    <h3>{CARD_STATUS_LABELS[column.status]}</h3>
                    <span>{column.cards.length}件</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setStatusFilter(column.status)
                      setShowArticleBoard(false)
                      setShowTrash(false)
                    }}
                  >
                    一覧で絞る
                  </button>
                </div>

                {column.cards.length === 0 ? (
                  <div className="article-column-empty">
                    <strong>{CARD_STATUS_LABELS[column.status]}は空です</strong>
                    <p>ここにカードをドロップできます。</p>
                  </div>
                ) : (
                  <div className="article-column-list">
                    {column.cards.map((card) => {
                      const nextStatus = getNextStatus(card.status)
                      return (
                        <article
                          className={
                            draggingArticleCardId === card.id
                              ? 'article-board-card dragging'
                              : 'article-board-card'
                          }
                          key={card.id}
                          draggable
                          onDragStart={(event) => handleArticleDragStart(event, card.id)}
                          onDragEnd={handleArticleDragEnd}
                        >
                          <div className="article-drag-handle" aria-hidden="true">⋮⋮</div>
                          <div className="card-topline">
                            <span className="site-pill">{SITE_TYPE_LABELS[card.site]}</span>
                            <span className={`status-pill status-${card.status}`}>
                              {CARD_STATUS_LABELS[card.status]}
                            </span>
                          </div>
                          <h4>{card.title || '無題のカード'}</h4>
                          <p>{getPreview(card.body)}</p>
                          <div className="tag-row">
                            {card.tags.slice(0, 4).map((tag) => (
                              <span key={tag.id}>#{tag.name}</span>
                            ))}
                          </div>
                          <div className="article-card-actions">
                            <button type="button" onClick={() => selectCard(card)}>
                              詳細
                            </button>
                            {nextStatus && ARTICLE_BOARD_STATUSES.includes(nextStatus) ? (
                              <button type="button" onClick={() => updateCardStatus(card.id, nextStatus)}>
                                {CARD_STATUS_LABELS[nextStatus]}へ
                              </button>
                            ) : null}
                          </div>
                        </article>
                      )
                    })}
                  </div>
                )}
              </section>
            ))}
          </div>
        </section>
      </main>
    )
  }

  return (
    <main className="app-shell">
      {quickMemoModal}
      <header className="app-header">
        <div>
          <p className="eyebrow">Knowledge Hub</p>
          <h1>知識カード管理</h1>
          <p className="lead">
            サイト別に知識カードを集め、記事候補・下書き・公開済みまで育てるための管理画面です。
          </p>
        </div>
        <div className="header-actions">
          <button className="ghost-button" type="button" onClick={openArticleBoard}>
            記事化ボード
          </button>
          <button className="primary-button" type="button" onClick={openQuickMemo}>
            + クイックメモ
          </button>
        </div>
      </header>

      <section className="summary-grid" aria-label="進捗サマリー">
        <article className="summary-card">
          <span>カード</span>
          <strong>{activeCardCount}</strong>
        </article>
        <article className="summary-card">
          <span>記事候補</span>
          <strong>{articleReadyCount}</strong>
        </article>
        <article className="summary-card">
          <span>公開済み</span>
          <strong>{publishedCount}</strong>
        </article>
        <article className="summary-card">
          <span>ゴミ箱</span>
          <strong>{trashCount}</strong>
        </article>
        <article className="summary-card">
          <span>タグ</span>
          <strong>{totalTagCount}</strong>
        </article>
      </section>

      <section className="progress-dashboard" aria-label="進捗ダッシュボード">
        <div className="dashboard-hero-card">
          <div>
            <p className="eyebrow">Progress Dashboard</p>
            <h2>記事化の進み具合</h2>
            <p>inbox から公開済みまで、知識カードがどこで止まっているかを一目で確認します。</p>
          </div>

          <div className="dashboard-rate-grid">
            <div className="dashboard-rate-card">
              <span>記事化レーン投入率</span>
              <strong>{dashboardStats.pipelineRate}%</strong>
              <div className="dashboard-meter" aria-hidden="true">
                <i style={{ width: `${dashboardStats.pipelineRate}%` }} />
              </div>
              <small>{dashboardStats.articleCards.length} / {activeCardCount} 件</small>
            </div>
            <div className="dashboard-rate-card">
              <span>公開到達率</span>
              <strong>{dashboardStats.publishRate}%</strong>
              <div className="dashboard-meter" aria-hidden="true">
                <i style={{ width: `${dashboardStats.publishRate}%` }} />
              </div>
              <small>{publishedCount} / {dashboardStats.articleCards.length} 件</small>
            </div>
          </div>
        </div>

        <div className="dashboard-status-panel">
          <div className="dashboard-panel-header">
            <div>
              <p className="eyebrow">Status</p>
              <h3>状態別カード数</h3>
            </div>
            <span>{activeCardCount}件</span>
          </div>
          <div className="dashboard-status-list">
            {statusStats.map((stat) => {
              const width = activeCardCount > 0 ? Math.round((stat.count / activeCardCount) * 100) : 0
              return (
                <button
                  className="dashboard-status-row"
                  key={stat.status}
                  type="button"
                  onClick={() => {
                    setStatusFilter(stat.status)
                    setShowTrash(false)
                    setShowArticleBoard(false)
                  }}
                >
                  <span>{CARD_STATUS_LABELS[stat.status]}</span>
                  <div className="dashboard-mini-meter" aria-hidden="true">
                    <i style={{ width: `${width}%` }} />
                  </div>
                  <strong>{stat.count}</strong>
                </button>
              )
            })}
          </div>
        </div>

        <div className="dashboard-site-panel">
          <div className="dashboard-panel-header">
            <div>
              <p className="eyebrow">Sites</p>
              <h3>サイト別数</h3>
            </div>
            <span>{SITE_TYPES.length}サイト</span>
          </div>
          <div className="dashboard-site-list">
            {dashboardStats.siteRows.map((row) => (
              <button
                className="dashboard-site-row"
                key={row.site}
                type="button"
                onClick={() => selectSite(row.site)}
              >
                <span>{SITE_TYPE_LABELS[row.site]}</span>
                <strong>{row.total}</strong>
                <small>候補以上 {row.inPipeline} / 公開 {row.published}</small>
              </button>
            ))}
          </div>
        </div>

        <div className="dashboard-recent-panel">
          <div className="dashboard-panel-header">
            <div>
              <p className="eyebrow">Recent</p>
              <h3>最近更新したカード</h3>
            </div>
          </div>
          <div className="dashboard-recent-list">
            {dashboardStats.recentCards.map((card) => (
              <button className="dashboard-recent-item" key={card.id} type="button" onClick={() => selectCard(card)}>
                <strong>{card.title || '無題のカード'}</strong>
                <span>{SITE_TYPE_LABELS[card.site]} / {CARD_STATUS_LABELS[card.status]}</span>
                <small>{formatDate(card.updated_at)}</small>
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className={`sync-panel sync-${syncState.status}`} aria-label="同期状態">
        <div className="sync-panel-main">
          <div>
            <p className="eyebrow">Sync Status</p>
            <h2>{syncStatusLabel}</h2>
            <p>{syncStatusDescription}</p>
          </div>
          <span className="sync-badge">{syncStatusLabel}</span>
        </div>

        <div className="sync-metrics" aria-label="同期メトリクス">
          <div>
            <span>未同期件数</span>
            <strong>{syncState.pendingCount}</strong>
          </div>
          <div>
            <span>競合件数</span>
            <strong>{unresolvedConflicts.length}</strong>
          </div>
          <div>
            <span>最終同期</span>
            <strong>{formatFullDate(syncState.lastSyncedAt)}</strong>
          </div>
          <div>
            <span>端末ID</span>
            <strong>{syncState.deviceId}</strong>
          </div>
          <div>
            <span>Supabase</span>
            <strong>{isSupabaseConfigured ? '設定済み' : '未設定'}</strong>
          </div>
        </div>

        {syncMessage ? <p className="sync-message">{syncMessage}</p> : null}
        {syncError ? <p className="sync-error">{syncError}</p> : null}

        <div className="sync-actions">
          <button
            type="button"
            onClick={loadFromSupabase}
            disabled={!isSupabaseConfigured || syncState.status === 'syncing'}
          >
            Supabaseから読込
          </button>
          <button
            type="button"
            onClick={syncToSupabase}
            disabled={!isSupabaseConfigured || syncState.status === 'syncing'}
          >
            Supabaseへ同期
          </button>
          <button type="button" onClick={markSynced} disabled={syncState.pendingCount === 0 || syncState.status === 'syncing'}>
            同期済みにする
          </button>
          <button type="button" onClick={simulateConflict}>
            競合を仮作成
          </button>
          <button type="button" onClick={resolveConflicts} disabled={syncState.conflictCount === 0}>
            競合解決済みにする
          </button>
        </div>
      </section>

      <section className="conflict-panel" aria-label="競合管理">
        <div className="conflict-panel-header">
          <div>
            <p className="eyebrow">Conflicts</p>
            <h2>競合管理</h2>
            <p>同じカードを複数端末で編集した時に、ローカル版かリモート版を選ぶための場所です。</p>
          </div>
          <strong>{unresolvedConflicts.length}件</strong>
        </div>

        {unresolvedConflicts.length === 0 ? (
          <div className="conflict-empty">
            <strong>未解決の競合はありません</strong>
            <p>同期実装後は、競合が起きたカードだけここに表示します。</p>
          </div>
        ) : (
          <div className="conflict-layout">
            <div className="conflict-list" aria-label="競合一覧">
              {unresolvedConflicts.map((conflict) => {
                const card = cards.find((item) => item.id === conflict.card_id)
                return (
                  <button
                    className={selectedConflict?.id === conflict.id ? 'conflict-list-item active' : 'conflict-list-item'}
                    key={conflict.id}
                    type="button"
                    onClick={() => setSelectedConflictId(conflict.id)}
                  >
                    <span>{card?.title ?? conflict.local_title ?? '削除済みカード'}</span>
                    <small>{formatFullDate(conflict.created_at)}</small>
                  </button>
                )
              })}
            </div>

            {selectedConflict ? (
              <div className="conflict-detail">
                <div className="conflict-target-card">
                  <span>対象カード</span>
                  <strong>{selectedConflictCard?.title ?? selectedConflict.local_title ?? '削除済みカード'}</strong>
                </div>

                <div className="conflict-compare-grid">
                  <article className="conflict-version-card">
                    <div className="conflict-version-header">
                      <strong>ローカル版</strong>
                      <span>{getConflictPreview(selectedConflict.local_title, selectedConflict.remote_title)}</span>
                    </div>
                    <h3>{selectedConflict.local_title || '無題のカード'}</h3>
                    <p>{selectedConflict.local_body || '本文なし'}</p>
                    <button type="button" onClick={() => resolveConflict(selectedConflict.id, 'local')}>
                      ローカル版を採用
                    </button>
                  </article>

                  <article className="conflict-version-card remote-version">
                    <div className="conflict-version-header">
                      <strong>リモート版</strong>
                      <span>{getConflictPreview(selectedConflict.remote_body, selectedConflict.local_body)}</span>
                    </div>
                    <h3>{selectedConflict.remote_title || '無題のカード'}</h3>
                    <p>{selectedConflict.remote_body || '本文なし'}</p>
                    <button type="button" onClick={() => resolveConflict(selectedConflict.id, 'remote')}>
                      リモート版を採用
                    </button>
                  </article>
                </div>
              </div>
            ) : null}
          </div>
        )}
      </section>

      <section className="workspace-grid">
        <div className="left-pane">
          <section className="toolbar" aria-label="カード絞り込み">
            <label className="search-box">
              <span>検索</span>
              <input
                value={searchText}
                onChange={(event) => setSearchText(event.target.value)}
                placeholder="タイトル・本文・タグで検索"
              />
            </label>

            <label>
              <span>状態</span>
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
              >
                <option value="all">すべて</option>
                {ACTIVE_CARD_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {CARD_STATUS_LABELS[status]}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span>サイト</span>
              <select
                value={siteFilter}
                onChange={(event) => setSiteFilter(event.target.value as SiteFilter)}
              >
                <option value="all">すべて</option>
                {SITE_TYPES.map((site) => (
                  <option key={site} value={site}>
                    {SITE_TYPE_LABELS[site]}
                  </option>
                ))}
              </select>
            </label>

            <button
              className="toggle-button"
              type="button"
              onClick={openTrashWindow}
            >
              ゴミ箱を別画面で開く
            </button>
          </section>

          <section className="status-manager" aria-label="ステータス管理">
            <div className="status-manager-header">
              <div>
                <p className="eyebrow">Status Flow</p>
                <h2>ステータス管理</h2>
                <p>{activeStatusLabel} のカードを表示しています。</p>
              </div>
              <button
                className={statusFilter === 'all' && !showTrash ? 'status-filter-card active' : 'status-filter-card'}
                type="button"
                onClick={() => {
                  setStatusFilter('all')
                  setShowTrash(false)
                }}
              >
                <span>すべて</span>
                <strong>{activeCardCount}</strong>
              </button>
            </div>

            <div className="status-flow-grid">
              {statusStats.map((stat) => (
                <button
                  className={statusFilter === stat.status && !showTrash ? 'status-filter-card active' : 'status-filter-card'}
                  key={stat.status}
                  type="button"
                  onClick={() => {
                    setStatusFilter(stat.status)
                    setShowTrash(false)
                  }}
                >
                  <span>{CARD_STATUS_LABELS[stat.status]}</span>
                  <strong>{stat.count}</strong>
                  <small>{stat.description}</small>
                  {stat.latestUpdatedAt ? <em>最終更新 {formatDate(stat.latestUpdatedAt)}</em> : null}
                </button>
              ))}
            </div>
          </section>

          <section className="site-manager" aria-label="サイト管理">
            <div className="site-manager-header">
              <div>
                <p className="eyebrow">Sites</p>
                <h2>サイト別ビュー</h2>
                <p>{activeSiteLabel} のカードを表示しています。</p>
              </div>
              <button
                className={siteFilter === 'all' ? 'site-filter-card active' : 'site-filter-card'}
                type="button"
                onClick={() => selectSite('all')}
              >
                <span>すべて</span>
                <strong>{activeCardCount}</strong>
              </button>
            </div>

            <div className="site-grid">
              {siteStats.map((stat) => (
                <button
                  className={siteFilter === stat.site ? 'site-filter-card active' : 'site-filter-card'}
                  key={stat.site}
                  type="button"
                  onClick={() => selectSite(stat.site)}
                >
                  <span>{SITE_TYPE_LABELS[stat.site]}</span>
                  <strong>{stat.total}</strong>
                  <small>
                    候補 {stat.articleReady} / 下書き {stat.draft} / 公開 {stat.published}
                  </small>
                </button>
              ))}
            </div>
          </section>

          <section className="tag-manager" aria-label="タグ管理">
            <div className="tag-manager-header">
              <div>
                <p className="eyebrow">Tags</p>
                <h2>タグ管理</h2>
              </div>
              <button
                className={tagFilter === 'all' ? 'tag-filter-chip active' : 'tag-filter-chip'}
                type="button"
                onClick={() => setTagFilter('all')}
              >
                すべて
              </button>
            </div>

            <div className="tag-tools">
              <label>
                <span>タグ検索</span>
                <input
                  value={tagSearchText}
                  onChange={(event) => setTagSearchText(event.target.value)}
                  placeholder="例: react"
                />
              </label>
              <label>
                <span>並び順</span>
                <select
                  value={tagSortMode}
                  onChange={(event) => setTagSortMode(event.target.value as TagSortMode)}
                >
                  <option value="count">使用数が多い順</option>
                  <option value="name">名前順</option>
                </select>
              </label>
            </div>

            {allTags.length === 0 ? (
              <p className="muted-text">まだタグがありません。カード編集画面でタグを追加してください。</p>
            ) : (
              <div className="tag-cloud">
                {allTags.map((tag) => (
                  <button
                    className={tagFilter === tag.name ? 'tag-filter-chip active' : 'tag-filter-chip'}
                    key={tag.name}
                    type="button"
                    onClick={() => setTagFilter((current) => (current === tag.name ? 'all' : tag.name))}
                  >
                    <span>#{tag.name}</span>
                    <strong>{tag.count}</strong>
                  </button>
                ))}
              </div>
            )}
          </section>


          <section className="card-list" aria-label="カード一覧">
            <div className="list-header">
              <div>
                <h2>カード一覧</h2>
                <p className="active-filter-note">
                  {activeSiteLabel}
                  {tagFilter !== 'all' ? ` / #${tagFilter}` : ''}
                </p>
              </div>
              <div className="list-header-actions">
                <span>{visibleCards.length}件</span>
                <button type="button" onClick={selectVisibleExportCards} disabled={showTrash || visibleCards.length === 0}>
                  表示分を選択
                </button>
                <button type="button" onClick={clearExportSelection} disabled={exportCardIds.length === 0}>
                  選択解除
                </button>
              </div>
            </div>

            {!showTrash ? (
              <div className="export-toolbar" aria-label="Export">
                <div>
                  <strong>Export</strong>
                  <span>選択 {selectedExportCards.length}件 / 表示 {visibleCards.filter((card) => card.status !== 'trash').length}件</span>
                </div>
                <div className="export-format-group">
                  <span>Markdown</span>
                  <div className="export-actions">
                    <button type="button" onClick={exportSelectedCardsAsMarkdown} disabled={selectedExportCards.length === 0}>
                      選択
                    </button>
                    <button type="button" onClick={exportVisibleCardsAsMarkdown} disabled={visibleCards.filter((card) => card.status !== 'trash').length === 0}>
                      表示中
                    </button>
                    <button type="button" onClick={exportAllCardsAsMarkdown} disabled={exportableCards.length === 0}>
                      全カード
                    </button>
                  </div>
                </div>
                <div className="export-format-group">
                  <span>JSON</span>
                  <div className="export-actions">
                    <button type="button" onClick={exportSelectedCardsAsJson} disabled={selectedExportCards.length === 0}>
                      選択
                    </button>
                    <button type="button" onClick={exportVisibleCardsAsJson} disabled={visibleCards.filter((card) => card.status !== 'trash').length === 0}>
                      表示中
                    </button>
                    <button type="button" onClick={exportAllCardsAsJson} disabled={exportableCards.length === 0}>
                      全カード
                    </button>
                  </div>
                </div>
              </div>
            ) : null}

            {visibleCards.length === 0 ? (
              <div className="empty-state">
                <strong>該当するカードがありません</strong>
                <p>検索条件や絞り込みを変えてください。</p>
              </div>
            ) : (
              <div className="cards-grid">
                {visibleCards.map((card) => (
                  <article
                    className={
                      selectedCardId === card.id
                        ? 'knowledge-card selected'
                        : 'knowledge-card'
                    }
                    key={card.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => selectCard(card)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        selectCard(card)
                      }
                    }}
                  >
                    <div className="card-topline">
                      {!showTrash ? (
                        <label className="export-check" onClick={(event) => event.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={exportCardIds.includes(card.id)}
                            onChange={() => toggleExportCard(card.id)}
                          />
                          <span>出力</span>
                        </label>
                      ) : null}
                      <span className="site-pill">{SITE_TYPE_LABELS[card.site]}</span>
                      <span className={`status-pill status-${card.status}`}>
                        {CARD_STATUS_LABELS[card.status]}
                      </span>
                    </div>
                    <h3>{card.title}</h3>
                    <p>{getPreview(card.body)}</p>
                    <div className="tag-row">
                      {card.tags.map((tag) => (
                        <span key={tag.id}>#{tag.name}</span>
                      ))}
                    </div>
                    <div className="card-footer">
                      <span>更新 {formatDate(card.updated_at)}</span>
                      {showTrash ? (
                        <div className="action-row" onClick={(event) => event.stopPropagation()}>
                          <button type="button" onClick={() => restoreCard(card.id)}>
                            復元
                          </button>
                          <button
                            className="danger"
                            type="button"
                            onClick={() => permanentlyDeleteCard(card.id)}
                          >
                            完全削除
                          </button>
                        </div>
                      ) : (
                        <div className="action-row" onClick={(event) => event.stopPropagation()}>
                          {getNextStatus(card.status) ? (
                            <button
                              type="button"
                              onClick={() => updateCardStatus(card.id, getNextStatus(card.status)!)}
                            >
                              {CARD_STATUS_LABELS[getNextStatus(card.status)!]}へ
                            </button>
                          ) : null}
                          <button type="button" onClick={() => selectCard(card)}>
                            詳細を見る
                          </button>
                          <button type="button" onClick={() => downloadCardAsMarkdown(card)}>
                            MD出力
                          </button>
                          <button className="danger" type="button" onClick={() => moveToTrash(card.id)}>
                            ゴミ箱へ
                          </button>
                        </div>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>

        <aside className="editor-panel" aria-label="カード編集">
          <div className="editor-header">
            <div>
              <p className="eyebrow">Card Editor</p>
              <h2>{editorMode === 'new' ? '新規カード' : 'カード編集'}</h2>
            </div>
            <button className="ghost-button" type="button" onClick={startNewCard}>
              新規
            </button>
          </div>

          <label className="form-field">
            <span>タイトル</span>
            <input
              value={form.title}
              onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
              placeholder="例: React設計メモ"
            />
          </label>

          <label className="form-field">
            <span>本文</span>
            <textarea
              value={form.body}
              onChange={(event) => setForm((current) => ({ ...current, body: event.target.value }))}
              placeholder="思いついたことをそのまま書く"
              rows={10}
            />
          </label>

          <div className="form-row">
            <label className="form-field">
              <span>サイト</span>
              <select
                value={form.site}
                onChange={(event) =>
                  setForm((current) => ({ ...current, site: event.target.value as SiteType }))
                }
              >
                {SITE_TYPES.map((site) => (
                  <option key={site} value={site}>
                    {SITE_TYPE_LABELS[site]}
                  </option>
                ))}
              </select>
            </label>

            <label className="form-field">
              <span>状態</span>
              <select
                value={form.status}
                onChange={(event) =>
                  setForm((current) => ({ ...current, status: event.target.value as CardStatus }))
                }
              >
                {ACTIVE_CARD_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {CARD_STATUS_LABELS[status]}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="status-quick-actions" aria-label="状態変更ショートカット">
            {STATUS_FLOW.map((step) => (
              <button
                className={form.status === step.status ? 'status-step-button active' : 'status-step-button'}
                key={step.status}
                type="button"
                onClick={() => setForm((current) => ({ ...current, status: step.status }))}
              >
                {CARD_STATUS_LABELS[step.status]}
              </button>
            ))}
          </div>

          <label className="form-field">
            <span>タグ</span>
            <input
              value={form.tagsText}
              onChange={(event) => setForm((current) => ({ ...current, tagsText: event.target.value }))}
              placeholder="react, design, note"
              list="known-tags"
            />
            <datalist id="known-tags">
              {allTags.map((tag) => (
                <option key={tag.name} value={tag.name} />
              ))}
            </datalist>
          </label>

          <div className="editor-actions">
            <button className="primary-button" type="button" onClick={saveCard}>
              保存
            </button>
            {editorMode === 'edit' && selectedCard ? (
              <button className="ghost-button" type="button" onClick={() => downloadCardAsMarkdown(selectedCard)}>
                Markdown出力
              </button>
            ) : null}
            {editorMode === 'edit' && selectedCard ? (
              <button className="danger-outline-button" type="button" onClick={() => moveToTrash(selectedCard.id)}>
                ゴミ箱へ移動
              </button>
            ) : null}
          </div>

          <section className="related-panel" aria-label="関連カード">
            <div className="related-header">
              <div>
                <p className="eyebrow">Related Cards</p>
                <h3>関連カード</h3>
              </div>
              <span>{relatedCards.length}件</span>
            </div>

            {editorMode === 'new' ? (
              <p className="related-empty">新規カードは保存後に関連カードを表示します。</p>
            ) : relatedCards.length === 0 ? (
              <p className="related-empty">タグ・サイト・タイトル・本文単語が近いカードはまだありません。</p>
            ) : (
              <div className="related-list">
                {relatedCards.map((card) => (
                  <button
                    className="related-item"
                    key={card.id}
                    type="button"
                    onClick={() => jumpToRelatedCard(card)}
                  >
                    <div className="related-item-main">
                      <strong>{card.title || '無題のカード'}</strong>
                      <span>{SITE_TYPE_LABELS[card.site]}</span>
                    </div>
                    <p>{getPreview(card.body)}</p>
                    <div className="related-meta">
                      <b>{card.score}点</b>
                      {card.reasons.map((reason) => (
                        <em key={reason}>{RELATED_REASON_LABELS[reason]}</em>
                      ))}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </section>

          <section className="history-panel" aria-label="編集履歴">
            <div className="history-header">
              <div>
                <p className="eyebrow">History</p>
                <h3>編集履歴</h3>
              </div>
              <span>{selectedCardHistories.length}件</span>
            </div>

            {editorMode === 'new' ? (
              <p className="history-empty">新規カードは保存後に履歴を残せます。</p>
            ) : selectedCardHistories.length === 0 ? (
              <p className="history-empty">まだ編集前データはありません。保存時に変更前のタイトルと本文を残します。</p>
            ) : (
              <div className="history-list">
                {selectedCardHistories.map((history) => (
                  <article className="history-item" key={history.id}>
                    <div>
                      <strong>{history.title || '無題のカード'}</strong>
                      <span>{formatFullDate(history.saved_at)}</span>
                    </div>
                    <p>{getPreview(history.body)}</p>
                    <button type="button" onClick={() => restoreHistoryToForm(history)}>
                      フォームに戻す
                    </button>
                  </article>
                ))}
              </div>
            )}
          </section>

          <p className="editor-note">
            削除はまずゴミ箱へ移動します。完全削除はゴミ箱画面でのみ実行します。保存すると、編集前のタイトルと本文を履歴に残します。
          </p>
        </aside>
      </section>
    </main>
  )
}

export default App
