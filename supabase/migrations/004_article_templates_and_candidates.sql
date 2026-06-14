--------------------------------------------------
-- Article templates and article candidates
--------------------------------------------------

-- Some older local schemas were created before the shared updated_at trigger
-- function existed. Define it here so this migration can be run independently.
create or replace function public.update_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.article_templates (
  id text primary key default gen_random_uuid()::text,
  user_id uuid references auth.users(id) on delete cascade,
  name text not null default '',
  site text not null default 'other',
  description text not null default '',
  fields jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  device_id text
);

create table if not exists public.article_drafts (
  id text primary key default gen_random_uuid()::text,
  user_id uuid references auth.users(id) on delete cascade,
  template_id text references public.article_templates(id) on delete set null,
  title text not null default '',
  site text not null default 'other',
  stage text not null default 'candidate'
    check (stage in ('candidate', 'draft', 'published', 'archived')),
  summary text not null default '',
  sections jsonb not null default '[]'::jsonb,
  source_card_id text references public.cards(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  device_id text
);

create table if not exists public.article_draft_cards (
  draft_id text not null references public.article_drafts(id) on delete cascade,
  card_id text not null references public.cards(id) on delete cascade,
  position integer not null default 0,
  primary key(draft_id, card_id)
);

create index if not exists idx_article_templates_user_id on public.article_templates(user_id);
create index if not exists idx_article_templates_site on public.article_templates(site);
create index if not exists idx_article_drafts_user_id on public.article_drafts(user_id);
create index if not exists idx_article_drafts_stage on public.article_drafts(stage);
create index if not exists idx_article_drafts_site on public.article_drafts(site);
create index if not exists idx_article_draft_cards_draft_id on public.article_draft_cards(draft_id);
create index if not exists idx_article_draft_cards_card_id on public.article_draft_cards(card_id);

drop trigger if exists trg_article_templates_updated_at on public.article_templates;
create trigger trg_article_templates_updated_at
before update on public.article_templates
for each row execute function public.update_updated_at();

drop trigger if exists trg_article_drafts_updated_at on public.article_drafts;
create trigger trg_article_drafts_updated_at
before update on public.article_drafts
for each row execute function public.update_updated_at();

alter table public.article_templates enable row level security;
alter table public.article_drafts enable row level security;
alter table public.article_draft_cards enable row level security;

drop policy if exists "article_templates_select_own" on public.article_templates;
drop policy if exists "article_templates_insert_own" on public.article_templates;
drop policy if exists "article_templates_update_own" on public.article_templates;
drop policy if exists "article_templates_delete_own" on public.article_templates;

create policy "article_templates_select_own" on public.article_templates
  for select using (user_id = auth.uid());
create policy "article_templates_insert_own" on public.article_templates
  for insert with check (user_id = auth.uid());
create policy "article_templates_update_own" on public.article_templates
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "article_templates_delete_own" on public.article_templates
  for delete using (user_id = auth.uid());

drop policy if exists "article_drafts_select_own" on public.article_drafts;
drop policy if exists "article_drafts_insert_own" on public.article_drafts;
drop policy if exists "article_drafts_update_own" on public.article_drafts;
drop policy if exists "article_drafts_delete_own" on public.article_drafts;

create policy "article_drafts_select_own" on public.article_drafts
  for select using (user_id = auth.uid());
create policy "article_drafts_insert_own" on public.article_drafts
  for insert with check (user_id = auth.uid());
create policy "article_drafts_update_own" on public.article_drafts
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "article_drafts_delete_own" on public.article_drafts
  for delete using (user_id = auth.uid());

drop policy if exists "article_draft_cards_select_own" on public.article_draft_cards;
drop policy if exists "article_draft_cards_insert_own" on public.article_draft_cards;
drop policy if exists "article_draft_cards_update_own" on public.article_draft_cards;
drop policy if exists "article_draft_cards_delete_own" on public.article_draft_cards;

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
