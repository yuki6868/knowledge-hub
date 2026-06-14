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

## Tech Stack

- React
- Vite
- TypeScript
- Supabase
- PostgreSQL
- Supabase Auth
- Supabase Realtime
- PWA
- Future: Electron / Tauri

## Main Status

- inbox
- card
- article-ready
- draft
- published
- archived
- deleted

## Development

```bash
cd frontend
npm install
npm run dev
```

`frontend/.env.local` を作成して Supabase の URL と anon key を設定します。

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
```

`.env.local` は Git に入れません。`.env.example` と `supabase/migrations/` は Git に入れます。

## Supabase Auth

Supabase Dashboard で次を設定します。

- Authentication > Providers
  - Email を有効化
  - Google を使う場合は Google provider を有効化
- Authentication > URL Configuration
  - 開発 Site URL: `http://localhost:5173`
  - 本番 Site URL: `https://<your-project>.vercel.app`
  - Redirect URLs に開発URLと本番URLを追加

## Database / Migration

Supabase SQL Editor で `supabase/migrations/` を番号順に適用します。

```text
001_initial_schema.sql
002_enable_realtime.sql
003_user_data_isolation.sql
```

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

Vercel の Environment Variables に次を設定します。

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
```

詳細手順は `docs/vercel-deploy.md` を参照してください。

## PWA / iPhone

Knowledge Hub は PWA としてホーム画面追加に対応しています。

### 開発時の確認

```bash
cd frontend
npm install
npm run build
npm run preview
```

ブラウザで preview URL を開き、アプリ内の同期状態パネルから PWA 状態を確認します。

### iPhoneで使う

1. SafariでVercel公開URLを開く
2. 共有ボタンを押す
3. 「ホーム画面に追加」を選ぶ
4. ホーム画面の Knowledge Hub から起動する

`http://localhost:5173` は開発確認用です。iPhoneで実用する場合は Vercel の公開URLを使います。
