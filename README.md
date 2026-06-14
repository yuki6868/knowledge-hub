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
- Future: Electron

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

## Commit Status

- commit023: Supabase Auth
- commit024: ユーザー別データ分離 / RLS
- commit025: Vercel公開 / PWA確認 / バックアップ / iPhoneクイックメモ改善
