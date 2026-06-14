# Vercel公開手順

Knowledge Hub を iPhone から使う場合は、`localhost` ではなく Vercel に公開した URL を Safari で開き、ホーム画面に追加します。

## 1. 前提

- GitHub に `knowledge-hub` を push 済み
- Supabase プロジェクト作成済み
- Supabase SQL / Auth / Realtime / RLS 設定済み

## 2. Vercelプロジェクト作成

1. Vercel に GitHub でログイン
2. New Project
3. `knowledge-hub` リポジトリを選択
4. 次のように設定

```text
Framework Preset: Vite
Root Directory: frontend
Install Command: npm ci
Build Command: npm run build
Output Directory: dist
```

このリポジトリはルートに `vercel.json` を置いています。Root Directory を `frontend` にしているため、`cd frontend && npm ci` のようなコマンドは不要です。

## 3. 環境変数

Vercel の Project Settings > Environment Variables に次を設定します。

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_PUBLISHABLE_KEY
```

Supabase の現在のUIでは `anon key` ではなく `Publishable key` と表示されることがあります。React/Viteに入れるのは Publishable key です。

入れてはいけないもの:

```text
Secret key
service_role key
Database password
```

## 4. Supabase URL Configuration

Vercel の公開URLが出たら、Supabase Dashboard で次を追加します。

```text
Authentication
↓
URL Configuration
```

Site URL:

```text
https://<your-project>.vercel.app
```

Redirect URLs:

```text
http://localhost:5173
http://localhost:5173/**
https://<your-project>.vercel.app
https://<your-project>.vercel.app/**
```

Googleログインで `localhost:3000` へ戻ろうとする場合は、Site URL が古い設定のままです。

## 5. Google OAuth確認

Supabase の Google Provider に表示されている Callback URL を Google Cloud Console の OAuth Client に登録します。

```text
https://YOUR_PROJECT_ID.supabase.co/auth/v1/callback
```

`redirect_uri_mismatch` が出る場合は、この値が完全一致していません。

## 6. デプロイ確認

公開後、Vercel URL を開いて次を確認します。

- 右上のユーザーアイコンが出る
- Googleログインできる
- クイックメモを保存できる
- Supabaseへ同期される
- iPhone Safari で開ける
- ホーム画面に追加できる
- PC側でRealtime反映される
- `バックアップJSON` をダウンロードできる

## 7. Git更新時

ローカルで修正したら、GitHubへ push します。

```bash
git add .
git commit -m "your change"
git push origin main
```

Vercel が自動で再デプロイします。手動でやる場合は Vercel の Deployments から Redeploy を押します。
