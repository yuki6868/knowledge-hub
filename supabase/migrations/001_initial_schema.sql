create extension if not exists pgcrypto;

--------------------------------------------------
-- cards
--------------------------------------------------

create table cards (
    id uuid primary key default gen_random_uuid(),

    title text not null default '',
    body text not null default '',

    site text not null default 'other',

    status text not null default 'inbox'
        check (
            status in (
                'inbox',
                'card',
                'article-ready',
                'draft',
                'published',
                'archived',
                'trash'
            )
        ),

    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),

    device_id text
);

--------------------------------------------------
-- tags
--------------------------------------------------

create table tags (
    id uuid primary key default gen_random_uuid(),

    name text not null unique,

    created_at timestamptz not null default now()
);

--------------------------------------------------
-- card_tags
--------------------------------------------------

create table card_tags (
    card_id uuid not null references cards(id) on delete cascade,
    tag_id uuid not null references tags(id) on delete cascade,

    primary key(card_id, tag_id)
);

--------------------------------------------------
-- histories
--------------------------------------------------

create table card_histories (
    id uuid primary key default gen_random_uuid(),

    card_id uuid not null references cards(id) on delete cascade,

    title text not null,
    body text not null,

    saved_at timestamptz not null default now()
);

--------------------------------------------------
-- conflicts
--------------------------------------------------

create table conflicts (
    id uuid primary key default gen_random_uuid(),

    card_id uuid not null references cards(id) on delete cascade,

    local_title text,
    local_body text,

    remote_title text,
    remote_body text,

    created_at timestamptz not null default now(),

    resolved boolean not null default false
);

--------------------------------------------------
-- updated_at trigger
--------------------------------------------------

create or replace function update_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

create trigger trg_cards_updated_at
before update
on cards
for each row
execute function update_updated_at();

--------------------------------------------------
-- indexes
--------------------------------------------------

create index idx_cards_status on cards(status);
create index idx_cards_site on cards(site);
create index idx_cards_updated_at on cards(updated_at);
create index idx_tags_name on tags(name);

--------------------------------------------------
-- initial tags
--------------------------------------------------

insert into tags(name)
values
    ('react'),
    ('typescript'),
    ('supabase'),
    ('design'),
    ('note'),
    ('world-heritage'),
    ('accounting')
on conflict (name) do nothing;
