# Database Design

## 削除方針

Knowledge Hubでは `deleted_at` は使わない。

通常削除は物理削除ではなく、カードの状態を `trash` に変更する。

```text
通常削除
→ status = 'trash'
```

ゴミ箱画面では `status = 'trash'` のカードだけを表示する。

完全削除はゴミ箱画面からのみ実行する。

```text
ゴミ箱
→ 完全削除
→ DBからDELETE
```

## 理由

Knowledge Hubは知識カードを扱うアプリであり、削除した情報を後から復元したくなる可能性が高い。

そのため、通常操作では消さずにゴミ箱へ移動する。

一方で、不要なカードを永久に残し続ける必要もないため、ゴミ箱から明示的に完全削除できるようにする。

## status

- inbox
- card
- article-ready
- draft
- published
- archived
- trash

## cards

知識カード本体。

## tags

タグ。

## card_tags

カードとタグの多対多。

## card_histories

編集履歴。

カード本体が完全削除された場合、関連する履歴も削除される。

## conflicts

同期競合。

カード本体が完全削除された場合、関連する競合情報も削除される。
