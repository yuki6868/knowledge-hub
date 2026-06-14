import type { CardWithTags, SiteType } from '../types/knowledge'

const SAMPLE_DEFINITIONS: Array<{
  title: string
  body: string
  site: SiteType
  tags: string[]
}> = [
  {
    title: '最初の知識カード',
    body: '散らばったメモをここに集めて、あとでタグ・サイト・状態で整理します。まずは短いメモで十分です。',
    site: 'other',
    tags: ['sample', 'memo'],
  },
  {
    title: '記事候補の育て方メモ',
    body: '思いつきはinboxに入れ、内容が固まったら知識カード、記事にできそうなら記事候補へ進めます。',
    site: 'ai-system-design',
    tags: ['article', 'workflow'],
  },
  {
    title: 'iPhoneクイックメモ確認',
    body: 'iPhoneのホーム画面から起動し、クイックメモを保存してPC側に同期されるか確認します。',
    site: 'personal-dev',
    tags: ['iphone', 'sync'],
  },
]

function createId(prefix: string, index: number): string {
  return `${prefix}-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 8)}`
}

export function createSampleCards(deviceId: string): CardWithTags[] {
  const now = new Date().toISOString()

  return SAMPLE_DEFINITIONS.map((sample, cardIndex) => ({
    id: createId('sample-card', cardIndex),
    title: sample.title,
    body: sample.body,
    site: sample.site,
    status: cardIndex === 1 ? 'article-ready' : 'inbox',
    created_at: now,
    updated_at: now,
    device_id: deviceId,
    deleted_at: null,
    tags: sample.tags.map((name, tagIndex) => ({
      id: createId('sample-tag', cardIndex * 10 + tagIndex),
      name,
      created_at: now,
    })),
  }))
}
