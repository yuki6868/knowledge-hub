import type { CardWithTags } from '../types/knowledge'

export const mockCards: CardWithTags[] = [
  {
    id: '11111111-1111-4111-8111-111111111111',
    title: 'AI時代の設計ガイド：小さく作って育てる',
    body: '詳細設計を完璧に固めるより、動く単位で小さく作り、検証しながら育てる。記事化するときは、初心者にも伝わる順番に並べ替える。',
    site: 'ai-system-design',
    status: 'article-ready',
    created_at: '2026-06-10T09:00:00.000Z',
    updated_at: '2026-06-12T11:30:00.000Z',
    device_id: 'desktop-dev',
    tags: [
      { id: 'tag-001', name: 'design', created_at: '2026-06-10T09:00:00.000Z' },
      { id: 'tag-002', name: 'react', created_at: '2026-06-10T09:00:00.000Z' },
    ],
  },
  {
    id: '22222222-2222-4222-8222-222222222222',
    title: '宮島記事：厳島神社の導入メモ',
    body: '世界遺産サイト用。厳島神社は海上に浮かぶ社殿の印象から入り、平清盛、信仰、観光導線へつなげると読みやすい。',
    site: 'world-heritage',
    status: 'draft',
    created_at: '2026-06-09T13:15:00.000Z',
    updated_at: '2026-06-11T08:20:00.000Z',
    device_id: 'desktop-dev',
    tags: [
      { id: 'tag-003', name: 'world-heritage', created_at: '2026-06-09T13:15:00.000Z' },
      { id: 'tag-004', name: 'miyajima', created_at: '2026-06-09T13:15:00.000Z' },
    ],
  },
  {
    id: '33333333-3333-4333-8333-333333333333',
    title: 'Noteネタ：苦労を買ってでもしろの再解釈',
    body: '苦労そのものを美化するのではなく、リスクのある行動からしか得られない学びを取りに行く、という解釈にすると現代でも使える。',
    site: 'note',
    status: 'card',
    created_at: '2026-06-08T18:45:00.000Z',
    updated_at: '2026-06-10T22:05:00.000Z',
    device_id: 'iphone-pwa',
    tags: [
      { id: 'tag-005', name: 'note', created_at: '2026-06-08T18:45:00.000Z' },
      { id: 'tag-006', name: 'essay', created_at: '2026-06-08T18:45:00.000Z' },
    ],
  },
  {
    id: '44444444-4444-4444-8444-444444444444',
    title: 'Supabase同期設計メモ',
    body: 'updated_atが新しい方を採用する。通常削除はstatus=trash。完全削除はゴミ箱画面から明示的に行う。',
    site: 'personal-dev',
    status: 'inbox',
    created_at: '2026-06-12T06:10:00.000Z',
    updated_at: '2026-06-12T06:40:00.000Z',
    device_id: 'desktop-dev',
    tags: [
      { id: 'tag-007', name: 'supabase', created_at: '2026-06-12T06:10:00.000Z' },
      { id: 'tag-008', name: 'sync', created_at: '2026-06-12T06:10:00.000Z' },
    ],
  },
  {
    id: '55555555-5555-4555-8555-555555555555',
    title: '古いテストカード',
    body: 'ゴミ箱表示と復元・完全削除ボタンの見た目を確認するためのカード。',
    site: 'other',
    status: 'trash',
    created_at: '2026-06-01T12:00:00.000Z',
    updated_at: '2026-06-02T12:00:00.000Z',
    device_id: 'desktop-dev',
    tags: [
      { id: 'tag-009', name: 'trash', created_at: '2026-06-01T12:00:00.000Z' },
    ],
  },
]
