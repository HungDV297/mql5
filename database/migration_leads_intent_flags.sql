-- Create/upgrade public.leads for the MQL5 landing form.
-- Safe to run more than once. Existing rows are preserved.

create table if not exists public.leads (
  id bigserial primary key,
  name text not null default '',
  full_name text not null default '',
  email text not null default '',
  phone text not null default '',
  want_register_now boolean not null default false,
  want_consultation boolean not null default false,
  want_join_community boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.leads
  add column if not exists id bigserial;

alter table public.leads
  add column if not exists name text not null default '';

alter table public.leads
  add column if not exists full_name text not null default '';

alter table public.leads
  add column if not exists email text not null default '';

alter table public.leads
  add column if not exists phone text not null default '';

alter table public.leads
  add column if not exists want_register_now boolean not null default false;

alter table public.leads
  add column if not exists want_consultation boolean not null default false;

alter table public.leads
  add column if not exists want_join_community boolean not null default false;

alter table public.leads
  add column if not exists created_at timestamptz not null default now();

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.leads'::regclass
      and contype = 'p'
  ) then
    alter table public.leads
      add constraint leads_pkey primary key (id);
  end if;
end $$;

-- Keep historical rows valid for the new "at least one selected" rule.
update public.leads
set want_register_now = true
where not (
  coalesce(want_register_now, false)
  or coalesce(want_consultation, false)
  or coalesce(want_join_community, false)
);

alter table public.leads
  drop constraint if exists leads_has_intent_check;

alter table public.leads
  add constraint leads_has_intent_check
  check (want_register_now or want_consultation or want_join_community);

alter table public.leads enable row level security;

drop policy if exists "mvp anon insert leads" on public.leads;
create policy "mvp anon insert leads"
  on public.leads for insert to anon
  with check (true);

grant insert on public.leads to anon;
grant usage, select on all sequences in schema public to anon;
