-- Knowledge Hub Supabase schema
-- Supabase SQL Editor でそのまま実行する。

create table if not exists public.cards (
  id text primary key,
  title text not null default '',
  body text not null default '',
  site text not null default 'other',
  status text not null default 'inbox',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  device_id text
);

create table if not exists public.tags (
  id text primary key,
  name text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.card_tags (
  card_id text not null references public.cards(id) on delete cascade,
  tag_id text not null references public.tags(id) on delete cascade,
  primary key (card_id, tag_id)
);

create table if not exists public.card_histories (
  id text primary key,
  card_id text not null references public.cards(id) on delete cascade,
  title text not null default '',
  body text not null default '',
  saved_at timestamptz not null default now()
);

create table if not exists public.conflicts (
  id text primary key,
  card_id text not null references public.cards(id) on delete cascade,
  local_title text,
  local_body text,
  remote_title text,
  remote_body text,
  created_at timestamptz not null default now(),
  resolved boolean not null default false
);

create index if not exists cards_updated_at_idx on public.cards(updated_at desc);
create index if not exists cards_status_idx on public.cards(status);
create index if not exists cards_site_idx on public.cards(site);
create index if not exists cards_deleted_at_idx on public.cards(deleted_at);
create index if not exists card_tags_card_id_idx on public.card_tags(card_id);
create index if not exists card_tags_tag_id_idx on public.card_tags(tag_id);

alter table public.cards enable row level security;
alter table public.tags enable row level security;
alter table public.card_tags enable row level security;
alter table public.card_histories enable row level security;
alter table public.conflicts enable row level security;

-- 開発用: anon key で読み書きできるようにする。
-- 本番でユーザー認証を入れる時は user_id を追加して auth.uid() ベースの policy に差し替える。
create policy "dev cards all" on public.cards for all using (true) with check (true);
create policy "dev tags all" on public.tags for all using (true) with check (true);
create policy "dev card_tags all" on public.card_tags for all using (true) with check (true);
create policy "dev card_histories all" on public.card_histories for all using (true) with check (true);
create policy "dev conflicts all" on public.conflicts for all using (true) with check (true);

-- Realtime同期用。cards / tags / card_tags の変更をフロントエンドへ配信する。
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
