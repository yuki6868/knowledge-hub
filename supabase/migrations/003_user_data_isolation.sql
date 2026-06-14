--------------------------------------------------
-- User data isolation / RLS
--------------------------------------------------

-- commit024:
-- Supabase Auth の auth.uid() を使い、カード・タグ・履歴・競合をユーザーごとに分離する。
-- 既存データは user_id が null のまま残るため、ログイン後に使うデータは再同期してください。

alter table public.cards
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

alter table public.tags
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

alter table public.card_histories
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

alter table public.conflicts
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

-- 既存の共有データがある環境でも migration が止まらないよう、user_id は nullable のまま追加する。
-- アプリからの新規 insert / update は RLS とフロント側の user_id 付与で必ず auth.uid() に紐付く。

-- 既存の tags.name unique はユーザー別タグ名と衝突するため外す。
do $$
declare
  constraint_name text;
begin
  select tc.constraint_name into constraint_name
  from information_schema.table_constraints tc
  join information_schema.constraint_column_usage ccu
    on tc.constraint_name = ccu.constraint_name
   and tc.table_schema = ccu.table_schema
  where tc.table_schema = 'public'
    and tc.table_name = 'tags'
    and tc.constraint_type = 'UNIQUE'
    and ccu.column_name = 'name'
  limit 1;

  if constraint_name is not null then
    execute format('alter table public.tags drop constraint %I', constraint_name);
  end if;
end $$;

create index if not exists idx_tags_user_name
  on public.tags(user_id, name);

create index if not exists idx_cards_user_id on public.cards(user_id);
create index if not exists idx_tags_user_id on public.tags(user_id);
create index if not exists idx_card_histories_user_id on public.card_histories(user_id);
create index if not exists idx_conflicts_user_id on public.conflicts(user_id);

alter table public.cards enable row level security;
alter table public.tags enable row level security;
alter table public.card_tags enable row level security;
alter table public.card_histories enable row level security;
alter table public.conflicts enable row level security;

-- commit018 時点の開発用 policy が残っている場合は、ユーザー分離を破るため削除する。
drop policy if exists "dev cards all" on public.cards;
drop policy if exists "dev tags all" on public.tags;
drop policy if exists "dev card_tags all" on public.card_tags;
drop policy if exists "dev card_histories all" on public.card_histories;
drop policy if exists "dev conflicts all" on public.conflicts;

drop policy if exists "cards_select_own" on public.cards;
drop policy if exists "cards_insert_own" on public.cards;
drop policy if exists "cards_update_own" on public.cards;
drop policy if exists "cards_delete_own" on public.cards;

create policy "cards_select_own" on public.cards
  for select using (user_id = auth.uid());

create policy "cards_insert_own" on public.cards
  for insert with check (user_id = auth.uid());

create policy "cards_update_own" on public.cards
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "cards_delete_own" on public.cards
  for delete using (user_id = auth.uid());

drop policy if exists "tags_select_own" on public.tags;
drop policy if exists "tags_insert_own" on public.tags;
drop policy if exists "tags_update_own" on public.tags;
drop policy if exists "tags_delete_own" on public.tags;

create policy "tags_select_own" on public.tags
  for select using (user_id = auth.uid());

create policy "tags_insert_own" on public.tags
  for insert with check (user_id = auth.uid());

create policy "tags_update_own" on public.tags
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "tags_delete_own" on public.tags
  for delete using (user_id = auth.uid());

drop policy if exists "card_tags_select_own" on public.card_tags;
drop policy if exists "card_tags_insert_own" on public.card_tags;
drop policy if exists "card_tags_update_own" on public.card_tags;
drop policy if exists "card_tags_delete_own" on public.card_tags;

create policy "card_tags_select_own" on public.card_tags
  for select using (
    exists (
      select 1 from public.cards c
      where c.id = card_tags.card_id
        and c.user_id = auth.uid()
    )
  );

create policy "card_tags_insert_own" on public.card_tags
  for insert with check (
    exists (
      select 1 from public.cards c
      where c.id = card_tags.card_id
        and c.user_id = auth.uid()
    )
    and exists (
      select 1 from public.tags t
      where t.id = card_tags.tag_id
        and t.user_id = auth.uid()
    )
  );

create policy "card_tags_update_own" on public.card_tags
  for update using (
    exists (
      select 1 from public.cards c
      where c.id = card_tags.card_id
        and c.user_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from public.cards c
      where c.id = card_tags.card_id
        and c.user_id = auth.uid()
    )
    and exists (
      select 1 from public.tags t
      where t.id = card_tags.tag_id
        and t.user_id = auth.uid()
    )
  );

create policy "card_tags_delete_own" on public.card_tags
  for delete using (
    exists (
      select 1 from public.cards c
      where c.id = card_tags.card_id
        and c.user_id = auth.uid()
    )
  );

drop policy if exists "card_histories_select_own" on public.card_histories;
drop policy if exists "card_histories_insert_own" on public.card_histories;
drop policy if exists "card_histories_update_own" on public.card_histories;
drop policy if exists "card_histories_delete_own" on public.card_histories;

create policy "card_histories_select_own" on public.card_histories
  for select using (user_id = auth.uid());

create policy "card_histories_insert_own" on public.card_histories
  for insert with check (user_id = auth.uid());

create policy "card_histories_update_own" on public.card_histories
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "card_histories_delete_own" on public.card_histories
  for delete using (user_id = auth.uid());

drop policy if exists "conflicts_select_own" on public.conflicts;
drop policy if exists "conflicts_insert_own" on public.conflicts;
drop policy if exists "conflicts_update_own" on public.conflicts;
drop policy if exists "conflicts_delete_own" on public.conflicts;

create policy "conflicts_select_own" on public.conflicts
  for select using (user_id = auth.uid());

create policy "conflicts_insert_own" on public.conflicts
  for insert with check (user_id = auth.uid());

create policy "conflicts_update_own" on public.conflicts
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "conflicts_delete_own" on public.conflicts
  for delete using (user_id = auth.uid());
