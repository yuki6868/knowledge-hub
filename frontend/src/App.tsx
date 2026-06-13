import { useMemo, useState } from 'react'
import {
  CARD_STATUS_LABELS,
  CARD_STATUSES,
  SITE_TYPE_LABELS,
  SITE_TYPES,
} from './constants/knowledge'
import { mockCards } from './data/mockCards'
import type { CardHistory, CardStatus, CardWithTags, Conflict, RelatedCardReason, SiteType, Tag } from './types/knowledge'
import { getRelatedCards } from './utils/relatedCards'
import './App.css'

type StatusFilter = CardStatus | 'all'
type SiteFilter = SiteType | 'all'
type TagFilter = string | 'all'
type TagSortMode = 'count' | 'name'
type EditorMode = 'new' | 'edit'
type SyncStatus = 'synced' | 'pending' | 'conflict'

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
  const [showDetail, setShowDetail] = useState(false)
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null)
  const [editorMode, setEditorMode] = useState<EditorMode>('new')
  const [form, setForm] = useState<CardFormState>(EMPTY_FORM)
  const [syncState, setSyncState] = useState<SyncState>(INITIAL_SYNC_STATE)

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

  const activeCardCount = cards.filter((card) => card.status !== 'trash').length
  const articleReadyCount = cards.filter((card) => card.status === 'article-ready').length
  const publishedCount = cards.filter((card) => card.status === 'published').length
  const trashCards = cards.filter((card) => card.status === 'trash')
  const trashCount = trashCards.length
  const totalTagCount = allTags.length
  const syncStatusLabel =
    unresolvedConflicts.length > 0 ? '競合あり' : syncState.status === 'synced' ? '同期済み' : '未同期あり'
  const syncStatusDescription =
    unresolvedConflicts.length > 0
      ? '別端末更新との衝突があります。下の競合管理で採用する内容を選びます。'
      : syncState.status === 'synced'
        ? 'ローカル変更はすべて同期済みです。'
        : 'ローカル変更があります。Supabase接続後はここから同期します。'

  const startNewCard = () => {
    setEditorMode('new')
    setSelectedCardId(null)
    setForm(EMPTY_FORM)
    setShowTrash(false)
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
        device_id: 'local-dev',
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

  if (showTrash) {
    return (
      <main className="app-shell trash-screen">
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
            <button className="primary-button" type="button" onClick={startNewCard}>
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
            <button className="primary-button" type="button" onClick={startNewCard}>
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

  return (
    <main className="app-shell">
      <header className="app-header">
        <div>
          <p className="eyebrow">Knowledge Hub</p>
          <h1>知識カード管理</h1>
          <p className="lead">
            サイト別に知識カードを集め、記事候補・下書き・公開済みまで育てるための管理画面です。
          </p>
        </div>
        <button className="primary-button" type="button" onClick={startNewCard}>
          + クイックメモ
        </button>
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
        </div>

        <div className="sync-actions">
          <button type="button" onClick={markSynced} disabled={syncState.pendingCount === 0}>
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
              <span>{visibleCards.length}件</span>
            </div>

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
