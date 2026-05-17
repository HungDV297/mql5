-- Upgrade public.leads for MQL5 popup intent flags
-- Adds 3 boolean fields to capture what users want to register for.

alter table public.leads
  add column if not exists want_register_now boolean not null default false,
  add column if not exists want_consultation boolean not null default false,
  add column if not exists want_join_community boolean not null default false;

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
  check (
    want_register_now
    or want_consultation
    or want_join_community
  );
