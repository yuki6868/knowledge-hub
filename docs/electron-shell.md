# commit030: Electron Shell

Knowledge Hub の Vercel 本番URLを Mac アプリとして開くための Electron Shell です。

## 目的

```text
Knowledge Hub.app
↓
起動
↓
https://knowledge-hub-tawny-one.vercel.app
```

React/Vite 側の画面や Supabase 保存処理は変更しません。Electron は BrowserWindow で本番URLを表示するだけです。

## 追加内容

- `frontend/electron/main.cjs`
  - Electron main process
  - BrowserWindow 作成
  - 本番URL表示
  - 外部リンクは既定ブラウザで開く
  - Mac向けメニュー追加
- `frontend/package.json`
  - Electron 起動スクリプト
  - dmg 作成スクリプト
  - electron-builder 設定

## 開発起動

```bash
cd frontend
npm install
npm run electron:dev
```

起動先URLを一時的に変えたい場合は環境変数を使います。

```bash
cd frontend
KNOWLEDGE_HUB_URL=http://localhost:5173 npm run electron:dev
```

## dmg作成

```bash
cd frontend
npm install
npm run electron:dmg
```

成果物は `frontend/dist/` 配下に作成されます。

## Release作成メモ

1. `npm run electron:dmg`
2. `frontend/dist/*.dmg` を確認
3. GitHub Releases に `v0.1.0-beta` などでアップロード
4. サイトのダウンロード導線から Release asset へリンク

## 注意

この commit030 は Electron Shell のみです。

- グローバルクイックメモは commit031
- メニューバー常駐は commit032
- ファイルドラッグ&ドロップ取り込みは commit033
