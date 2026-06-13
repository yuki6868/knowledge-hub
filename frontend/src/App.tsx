import { useMemo, useState } from 'react'
import {
  CARD_STATUS_LABELS,
  CARD_STATUSES,
  SITE_TYPE_LABELS,
  SITE_TYPES,
} from './constants/knowledge'
import { mockCards } from './data/mockCards'
import type { CardStatus, CardWithTags, SiteType } from './types/knowledge'
import './App.css'

type StatusFilter = CardStatus | 'all'
type SiteFilter = SiteType | 'all'

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

function App() {
  const [searchText, setSearchText] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [siteFilter, setSiteFilter] = useState<SiteFilter>('all')
  const [showTrash, setShowTrash] = useState(false)

  const visibleCards = useMemo(() => {
    return mockCards
      .filter((card) => (showTrash ? card.status === 'trash' : card.status !== 'trash'))
      .filter((card) => statusFilter === 'all' || card.status === statusFilter)
      .filter((card) => siteFilter === 'all' || card.site === siteFilter)
      .filter((card) => matchesSearch(card, searchText))
      .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
  }, [searchText, showTrash, siteFilter, statusFilter])

  const activeCardCount = mockCards.filter((card) => card.status !== 'trash').length
  const articleReadyCount = mockCards.filter((card) => card.status === 'article-ready').length
  const publishedCount = mockCards.filter((card) => card.status === 'published').length
  const trashCount = mockCards.filter((card) => card.status === 'trash').length

  return (
    <main className="app-shell">
      <header className="app-header">
        <div>
          <p className="eyebrow">Knowledge Hub</p>
          <h1>知識カード一覧</h1>
          <p className="lead">
            メモを知識カードとして集め、記事候補・下書き・公開済みまで育てるための最初の一覧画面です。
          </p>
        </div>
        <button className="primary-button" type="button">
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
      </section>

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
          }}
        >
          {showTrash ? '通常カードへ戻る' : 'ゴミ箱を見る'}
        </button>
      </section>

      <section className="card-list" aria-label="カード一覧">
        <div className="list-header">
          <h2>{showTrash ? 'ゴミ箱' : 'カード一覧'}</h2>
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
              <article className="knowledge-card" key={card.id}>
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
                      <button type="button">復元</button>
                      <button className="danger" type="button">完全削除</button>
                    </div>
                  ) : (
                    <button type="button">詳細</button>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  )
}

export default App
