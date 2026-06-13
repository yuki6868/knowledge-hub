# Frontend Type Design

## 目的

DBスキーマに合わせて、React側で使う型を先に固定する。

## 追加ファイル

- `frontend/src/types/knowledge.ts`
- `frontend/src/types/database.ts`
- `frontend/src/constants/knowledge.ts`
- `frontend/src/utils/knowledgeGuards.ts`

## 方針

Knowledge Hubでは削除状態を `deleted_at` ではなく `status = 'trash'` として扱う。

そのため、通常のカード一覧では `trash` を除外し、ゴミ箱画面では `trash` のみを表示する。

## CardStatus

- inbox
- card
- article-ready
- draft
- published
- archived
- trash

## SiteType

- note
- ai-system-design
- world-heritage
- accounting
- personal-dev
- other
