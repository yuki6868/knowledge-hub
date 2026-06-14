
# Knowledge Hub

知識カードを中心に、メモ・整理・記事化・公開管理まで行う同期アプリ。

## Concept

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

を一元管理する。

## Tech Stack

- React

- Vite

- TypeScript

- Supabase

- PostgreSQL

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

1. SafariでアプリURLを開く
2. 共有ボタンを押す
3. 「ホーム画面に追加」を選ぶ
4. ホーム画面の Knowledge Hub から起動する

Supabase の URL と anon key は `frontend/.env.local` に設定します。

```env
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

`.env.local` はGitに入れません。`.env.example` と `supabase/migrations/` はGitに入れます。
