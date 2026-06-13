--------------------------------------------------
-- Supabase Realtime
--------------------------------------------------

-- cards / tags / card_tags の変更をフロントエンドへ配信する。
-- 既に publication に追加済みの場合でも再実行できるようにしている。
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'cards'
  ) then
    alter publication supabase_realtime add table public.cards;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'tags'
  ) then
    alter publication supabase_realtime add table public.tags;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'card_tags'
  ) then
    alter publication supabase_realtime add table public.card_tags;
  end if;
end $$;
