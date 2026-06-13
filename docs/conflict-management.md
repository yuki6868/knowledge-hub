# Conflict Management

## 方針

同じカードを複数端末で編集した場合、即時上書きせず `conflicts` として保持する。

ユーザーは競合管理パネルで次のどちらかを選ぶ。

- ローカル版を採用
- リモート版を採用

## 今回の実装

まだSupabase同期前なので、UI上で競合を仮作成できる。

今後、Supabase Realtimeやupdated_at比較で競合を検出したら、このUIへ流す。

## 解決後

`resolved = true` 相当として扱い、未解決一覧から外す。
