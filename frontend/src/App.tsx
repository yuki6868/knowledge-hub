import { useMemo, useState } from 'react'
import {
  CARD_STATUS_LABELS,
  CARD_STATUSES,
  SITE_TYPE_LABELS,
  SITE_TYPES,
} from './constants/knowledge'
import { mockCards } from './data/mockCards'
import type { CardStatus, CardWithTags, SiteType, Tag } from './types/knowledge'
import './App.css'

type StatusFilter = CardStatus | 'all'
type SiteFilter = SiteType | 'all'
type TagFilter = string | 'all'
type TagSortMode = 'count' | 'name'
type EditorMode = 'new' | 'edit'

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

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('ja-JP', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
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
  const [searchText, setSearchText] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [siteFilter, setSiteFilter] = useState<SiteFilter>('all')
  const [tagFilter, setTagFilter] = useState<TagFilter>('all')
  const [tagSearchText, setTagSearchText] = useState('')
  const [tagSortMode, setTagSortMode] = useState<TagSortMode>('count')
  const [showTrash, setShowTrash] = useState(false)
  const [selectedCardId, setSelectedCardId] = useState<string | null>(mockCards[0]?.id ?? null)
  const [editorMode, setEditorMode] = useState<EditorMode>('edit')
  const [form, setForm] = useState<CardFormState>(
    mockCards[0] ? toFormState(mockCards[0]) : EMPTY_FORM,
  )

  const selectedCard = useMemo(() => {
    return cards.find((card) => card.id === selectedCardId) ?? null
  }, [cards, selectedCardId])


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

  const activeSiteLabel = siteFilter === 'all' ? 'すべてのサイト' : SITE_TYPE_LABELS[siteFilter]

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
  const trashCount = cards.filter((card) => card.status === 'trash').length
  const totalTagCount = allTags.length

  const startNewCard = () => {
    setEditorMode('new')
    setSelectedCardId(null)
    setForm(EMPTY_FORM)
    setShowTrash(false)
  }

  const selectCard = (card: CardWithTags) => {
    setEditorMode('edit')
    setSelectedCardId(card.id)
    setForm(toFormState(card))
  }

  const selectSite = (site: SiteFilter) => {
    setSiteFilter(site)
    setShowTrash(false)
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
      setEditorMode('edit')
      return
    }

    if (!selectedCard) return

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
  }

  const moveToTrash = (cardId: string) => {
    const now = new Date().toISOString()

    setCards((current) =>
      current.map((card) =>
        card.id === cardId
          ? {
              ...card,
              status: 'trash',
              updated_at: now,
            }
          : card,
      ),
    )
    setShowTrash(true)
  }

  const restoreCard = (cardId: string) => {
    const now = new Date().toISOString()

    setCards((current) =>
      current.map((card) =>
        card.id === cardId
          ? {
              ...card,
              status: 'card',
              updated_at: now,
            }
          : card,
      ),
    )
    setShowTrash(false)
  }

  const permanentlyDeleteCard = (cardId: string) => {
    const ok = window.confirm('このカードを完全削除します。復元できません。')
    if (!ok) return

    setCards((current) => current.filter((card) => card.id !== cardId))
    if (selectedCardId === cardId) {
      setSelectedCardId(null)
      setEditorMode('new')
      setForm(EMPTY_FORM)
    }
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
                {CARD_STATUSES.map((status) => (
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
              className={showTrash ? 'toggle-button active' : 'toggle-button'}
              type="button"
              onClick={() => {
                setShowTrash((current) => !current)
                setStatusFilter('all')
                setTagFilter('all')
              }}
            >
              {showTrash ? '通常カードへ戻る' : 'ゴミ箱を見る'}
            </button>
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
                <h2>{showTrash ? 'ゴミ箱' : 'カード一覧'}</h2>
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
                        <div className="action-row">
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
                        <div className="action-row">
                          <button type="button" onClick={() => selectCard(card)}>
                            編集
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
                {CARD_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {CARD_STATUS_LABELS[status]}
                  </option>
                ))}
              </select>
            </label>
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

          <p className="editor-note">
            まだSupabaseには保存せず、ReactのローカルstateでCRUDとタグ管理の動きを確認します。次以降でDB接続へ差し替えます。
          </p>
        </aside>
      </section>
    </main>
  )
}

export default App
