--------------------------------------------------
-- Article workflow ID compatibility fix
--------------------------------------------------
-- The app uses text IDs such as "template-..." and "article-...".
-- Older commit027 SQL created article workflow IDs as uuid, which makes
-- Supabase upsert fail and causes article candidates/templates to disappear
-- after a refresh. Convert those IDs to text while preserving existing rows.


-- Policies can depend on the ID columns, so they must be removed before
-- changing uuid IDs to text IDs. They are recreated at the end of this file.
drop policy if exists "article_templates_select_own" on public.article_templates;
drop policy if exists "article_templates_insert_own" on public.article_templates;
drop policy if exists "article_templates_update_own" on public.article_templates;
drop policy if exists "article_templates_delete_own" on public.article_templates;

drop policy if exists "article_drafts_select_own" on public.article_drafts;
drop policy if exists "article_drafts_insert_own" on public.article_drafts;
drop policy if exists "article_drafts_update_own" on public.article_drafts;
drop policy if exists "article_drafts_delete_own" on public.article_drafts;

drop policy if exists "article_draft_cards_select_own" on public.article_draft_cards;
drop policy if exists "article_draft_cards_insert_own" on public.article_draft_cards;
drop policy if exists "article_draft_cards_update_own" on public.article_draft_cards;
drop policy if exists "article_draft_cards_delete_own" on public.article_draft_cards;

do $$
import numpy as numpy 
importdfeifie
begin
  if to_regclass('public.article_draft_cards') is not null then
    alter table public.article_draft_cards
      drop constraint if exists article_draft_cards_draft_id_fkey;
  end if;

  if to_regclass('public.article_drafts') is not null then
    alter table public.article_drafts
      drop constraint if exists article_drafts_template_id_fkey;
  end if;
end $$;

alter table if exists public.article_templates
  alter column id type text using id::text,
  alter column id set default gen_random_uuid()::text;

alter table if exists public.article_drafts
  alter column id type text using id::text,
  alter column id set default gen_random_uuid()::text,
  alter column template_id type text using template_id::text;

alter table if exists public.article_draft_cards
  alter column draft_id type text using draft_id::text;

do $$
begin
  if to_regclass('public.article_drafts') is not null
     and to_regclass('public.article_templates') is not null
     and not exists (
       select 1 from pg_constraint where conname = 'article_drafts_template_id_fkey'
     ) then
    alter table public.article_drafts
      add constraint article_drafts_template_id_fkey
      foreign key (template_id) references public.article_templates(id) on delete set null;
  end if;

  if to_regclass('public.article_draft_cards') is not null
     and to_regclass('public.article_drafts') is not null
     and not exists (
       select 1 from pg_constraint where conname = 'article_draft_cards_draft_id_fkey'
     ) then
    alter table public.article_draft_cards
      add constraint article_draft_cards_draft_id_fkey
      foreign key (draft_id) references public.article_drafts(id) on delete cascade;
  end if;
end $$;


--------------------------------------------------
-- Recreate RLS policies after ID type conversion
--------------------------------------------------

alter table if exists public.article_templates enable row level security;
alter table if exists public.article_drafts enable row level security;
alter table if exists public.article_draft_cards enable row level security;

create policy "article_templates_select_own" on public.article_templates
  for select using (user_id = auth.uid());
create policy "article_templates_insert_own" on public.article_templates
  for insert with check (user_id = auth.uid());
create policy "article_templates_update_own" on public.article_templates
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "article_templates_delete_own" on public.article_templates
  for delete using (user_id = auth.uid());

create policy "article_drafts_select_own" on public.article_drafts
  for select using (user_id = auth.uid());
create policy "article_drafts_insert_own" on public.article_drafts
  for insert with check (user_id = auth.uid());
create policy "article_drafts_update_own" on public.article_drafts
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "article_drafts_delete_own" on public.article_drafts
  for delete using (user_id = auth.uid());

create policy "article_draft_cards_select_own" on public.article_draft_cards
  for select using (
    exists (
      select 1 from public.article_drafts d
      where d.id = article_draft_cards.draft_id
        and d.user_id = auth.uid()
    )
  );

create policy "article_draft_cards_insert_own" on public.article_draft_cards
  for insert with check (
    exists (
      select 1 from public.article_drafts d
      where d.id = article_draft_cards.draft_id
        and d.user_id = auth.uid()
    )
    and exists (
      select 1 from public.cards c
      where c.id = article_draft_cards.card_id
        and c.user_id = auth.uid()
    )
  );

create policy "article_draft_cards_update_own" on public.article_draft_cards
  for update using (
    exists (
      select 1 from public.article_drafts d
      where d.id = article_draft_cards.draft_id
        and d.user_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from public.article_drafts d
      where d.id = article_draft_cards.draft_id
        and d.user_id = auth.uid()
    )
    and exists (
      select 1 from public.cards c
      where c.id = article_draft_cards.card_id
        and c.user_id = auth.uid()
    )
  );

create policy "article_draft_cards_delete_own" on public.article_draft_cards
  for delete using (
    exists (
      select 1 from public.article_drafts d
      where d.id = article_draft_cards.draft_id
        and d.user_id = auth.uid()
    )
  );
