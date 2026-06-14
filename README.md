# Knowledge Hub

知識カードを中心に、メモ・整理・記事化・公開管理まで行う同期アプリ。

## Concept

```text
メモ
↓
知識カード
↓
整理・紐付け
↓
記事候補
↓
下書き
↓
公開済み
```

対象は Note、AI時代の設計ガイド、世界遺産サイト、会計士学習メモ、個人開発メモなど。AIは使わず、タグ一致・site一致・タイトル一致・本文単語一致で関連カードを判定します。

## Tech Stack

- React / Vite / TypeScript
- Supabase / PostgreSQL
- Supabase Auth
- Supabase Realtime
- PWA
- Electron Shell

## Development

```bash
cd frontend
npm install
npm run dev
```

`frontend/.env.local` を作成して Supabase の Project URL と Publishable key を設定します。

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_PUBLISHABLE_KEY
```

`.env.local` は Git に入れません。`.env.example`、`supabase/migrations/`、`vercel.json` は Git に入れます。

## Supabase Setup

Supabase Dashboard で次を設定します。

1. SQL Editor で migration を番号順に実行

```text
supabase/migrations/001_initial_schema.sql
supabase/migrations/002_enable_realtime.sql
supabase/migrations/003_user_data_isolation.sql
```

2. Authentication > Providers
   - Email を有効化
   - Google を使う場合は Google provider を有効化

3. Authentication > URL Configuration
   - 開発 Site URL: `http://localhost:5173`
   - 本番 Site URL: `https://<your-project>.vercel.app`
   - Redirect URLs に次を追加

```text
http://localhost:5173
http://localhost:5173/**
https://<your-project>.vercel.app
https://<your-project>.vercel.app/**
```

4. Database > Publications で Realtime 対象を確認
   - `cards`
   - `tags`
   - `card_tags`
   - `card_histories`
   - `card_conflicts`

5. RLS確認
   - `cards.user_id = auth.uid()` 系の policy が入っていることを確認します。

## Build

```bash
cd frontend
npm run build
npm run preview
```

zip に含まれる `node_modules` をそのまま使うと Vite/Rolldown の optional dependency が不足することがあります。その場合は入れ直します。

```bash
cd frontend
rm -rf node_modules package-lock.json
npm install
npm run build
```

## Vercel Deploy

このリポジトリはルートの `vercel.json` で Vercel 公開できるようにしています。

Vercel 側は次の設定にします。

```text
Framework Preset: Vite
Root Directory: frontend
Install Command: npm ci
Build Command: npm run build
Output Directory: dist
```

Vercel の Environment Variables に次を設定します。

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_PUBLISHABLE_KEY
```

`Secret key`、`service_role key`、DBパスワードは入れません。

## Backup

アプリ内の同期パネルから `バックアップJSON` を押すと、次をまとめて書き出します。

- cards
- card_histories
- card_conflicts
- sync metadata

通常の JSON Export はカード本文共有用、バックアップJSONは復旧・退避用です。


## Electron Shell / Mac App

commit030 で Vercel 本番URLを開く Mac アプリ用 Electron Shell を追加しています。

```bash
cd frontend
npm install
npm run electron:dev
```

ローカル開発中の Vite を包んで確認する場合は次のようにします。

```bash
cd frontend
KNOWLEDGE_HUB_URL=http://localhost:5173 npm run electron:dev
```

dmg を作る場合は次です。

```bash
cd frontend
npm run electron:dmg
```

詳細は `docs/electron-shell.md` を参照してください。

## PWA / iPhone

Knowledge Hub は PWA としてホーム画面追加に対応しています。

1. iPhone の Safari で Vercel 公開URLを開く
2. Googleログインする
3. 共有ボタンを押す
4. 「ホーム画面に追加」を選ぶ
5. ホーム画面の Knowledge Hub から起動する
6. クイックメモで保存し、PC側に同期されるか確認する

`http://localhost:5173` は開発確認用です。iPhoneで実用する場合は Vercel の公開URLを使います。

## Quick Memo on iPhone

クイックメモはスマホ向けに下から出る入力画面として使います。

- タイトル任意
- 本文必須ではない
- site選択対応
- タグ任意
- ログイン済みなら保存後にSupabaseへ自動同期


## First Run

本番利用時は初期ダミーカードを表示しません。ログイン後、空の状態から始めます。

おすすめ確認手順:

1. iPhoneまたはMacでログイン
2. `+ クイックメモ` から1件保存
3. 必要なら `Supabaseへ同期` を押す
4. 別端末で `Supabaseから読込` またはRealtime反映を確認

画面確認だけしたい場合は、カード一覧の空状態にある `サンプルカードを追加` を押します。サンプルは任意追加で、最初からDBへ投入されるものではありません。

## Commit Status

- commit023: Supabase Auth
- commit024: ユーザー別データ分離 / RLS
- commit025: Vercel公開 / PWA確認 / バックアップ / iPhoneクイックメモ改善
- commit026: 初期ダミーカード削除 / 空状態改善 / サンプルカード任意追加

## commit027: テンプレート・記事候補ワークフロー

Knowledge Hub は、単なる「タイトル＋本文」のメモ保管庫から、記事化のための作業台へ拡張しました。

### 追加されたこと

- テンプレート作成
  - サイト別に記事テンプレートを作成できます。
  - テンプレート項目は1行1項目で自由に定義できます。
  - 標準テンプレートとして Note / AI設計ガイド / 世界遺産 の型を追加できます。
- 記事候補作成
  - 空の記事候補を作成できます。
  - 既存カードから記事候補を作成できます。
  - カードから作った場合、そのカードは素材カードとして自動でぶら下がります。
- 素材カード管理
  - 記事候補に複数カードを紐付けできます。
  - 素材カードを見ながらテンプレート項目を埋められます。
- 下書き化
  - 記事候補を Markdown として出力できます。
  - 記事候補から下書きカードを作成できます。

### Supabase更新

DB変更があります。Supabase の SQL Editor で以下を実行してください。

```text
supabase/migrations/004_article_templates_and_candidates.sql
```

追加テーブル:

```text
article_templates
article_drafts
article_draft_cards
```

RLS も migration 内で設定しています。ログインユーザーごとにテンプレート・記事候補・素材カード紐付けが分離されます。

### Realtime

テンプレート・記事候補は手動同期対象です。まずはカード本体のRealtimeと分けています。
同期したい場合は、アプリ上の「Supabaseへ同期」「Supabaseから読込」を使います。


### commit028: 記事候補・テンプレート永続化

記事候補とテンプレートは、まずブラウザの `localStorage` に保存されます。
そのため開発環境でページを更新しても、作成中の記事候補は消えません。
ログイン済みの場合は、同期ボタンから Supabase の `article_templates` / `article_drafts` / `article_draft_cards` へ保存できます。

commit027 の初期SQLで記事系IDを uuid にしていた環境では、Supabase SQL Editorで次を実行してください。

```text
supabase/migrations/005_article_workflow_text_ids_and_local_persistence.sql
```
