# Vercel公開手順

Knowledge Hub を iPhone から使う場合は、`localhost` ではなく Vercel に公開した URL を Safari で開き、ホーム画面に追加します。

## 1. 事前準備

Supabase 側で次を確認します。

- Authentication > Providers
  - Email を有効化
  - Google を使う場合は Google provider を有効化
- Authentication > URL Configuration
  - Site URL: `https://<your-project>.vercel.app`
  - Redirect URLs:
    - `http://localhost:5173`
    - `https://<your-project>.vercel.app`

`<your-project>` は Vercel で作るプロジェクト名に置き換えてください。

## 2. Vercelプロジェクト作成

1. GitHub にこのリポジトリを push
2. Vercel で New Project
3. 対象リポジトリを選択
4. Build 設定は `vercel.json` を使う

このリポジトリはルートに `vercel.json` を置いているため、Vercel 側で次が自動的に使われます。

- Install Command: `cd frontend && npm ci`
- Build Command: `cd frontend && npm run build`
- Output Directory: `frontend/dist`

## 3. 環境変数

Vercel の Project Settings > Environment Variables に次を設定します。

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
```

設定先は Production / Preview / Development のすべてに入れておくと、プレビューURLでも確認しやすいです。

## 4. デプロイ確認

公開後、Vercel URL を開いて次を確認します。

- ログイン画面が表示される
- メールログインまたはGoogleログインできる
- カードを作成できる
- Supabaseへ同期できる
- 別端末で開いたときにRealtime同期される
- iPhone Safari からホーム画面に追加できる

## 5. ローカルで本番ビルド確認

```bash
cd frontend
npm ci
npm run build
npm run preview
```

zip に含まれる `node_modules` を使うと Vite/Rolldown の optional dependency が不足することがあります。その場合は一度入れ直してください。

```bash
cd frontend
rm -rf node_modules package-lock.json
npm install
npm run build
```
