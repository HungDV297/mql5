-- Email automation queue for landing leads and orders.
-- Safe to run more than once. Existing rows are preserved.

create table if not exists public.email_events (
  id bigserial primary key,
  event_type text not null,
  recipient_email text not null,
  recipient_name text not null default '',
  subject text not null default '',
  template_key text not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'queued'
    check (status in ('queued', 'processing', 'sent', 'failed', 'cancelled')),
  scheduled_at timestamptz not null default now(),
  sent_at timestamptz,
  attempts integer not null default 0,
  max_attempts integer not null default 3,
  resend_id text,
  last_error text,
  lead_id text,
  customer_id bigint,
  order_id bigint,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.email_events
  add column if not exists event_type text not null default 'manual';

alter table public.email_events
  add column if not exists recipient_email text not null default '';

alter table public.email_events
  add column if not exists recipient_name text not null default '';

alter table public.email_events
  add column if not exists subject text not null default '';

alter table public.email_events
  add column if not exists template_key text not null default 'manual';

alter table public.email_events
  add column if not exists payload jsonb not null default '{}'::jsonb;

alter table public.email_events
  add column if not exists status text not null default 'queued';

alter table public.email_events
  add column if not exists scheduled_at timestamptz not null default now();

alter table public.email_events
  add column if not exists sent_at timestamptz;

alter table public.email_events
  add column if not exists attempts integer not null default 0;

alter table public.email_events
  add column if not exists max_attempts integer not null default 3;

alter table public.email_events
  add column if not exists resend_id text;

alter table public.email_events
  add column if not exists last_error text;

alter table public.email_events
  add column if not exists lead_id text;

alter table public.email_events
  alter column lead_id type text using lead_id::text;

alter table public.email_events
  add column if not exists customer_id bigint;

alter table public.email_events
  add column if not exists order_id bigint;

alter table public.email_events
  add column if not exists created_at timestamptz not null default now();

alter table public.email_events
  add column if not exists updated_at timestamptz not null default now();

create index if not exists idx_email_events_due
  on public.email_events(status, scheduled_at)
  where status in ('queued', 'failed');

create index if not exists idx_email_events_lead_id
  on public.email_events(lead_id);

create index if not exists idx_email_events_order_id
  on public.email_events(order_id);

alter table public.email_events enable row level security;

drop policy if exists "mvp anon insert email events" on public.email_events;
drop policy if exists "mvp anon select email events" on public.email_events;
drop policy if exists "mvp anon update email events" on public.email_events;

create or replace function public.claim_due_email_events(batch_limit integer default 10)
returns setof public.email_events
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  update public.email_events e
  set
    status = 'processing',
    attempts = e.attempts + 1,
    last_error = null,
    updated_at = now()
  where e.id in (
    select q.id
    from public.email_events q
    where q.status = 'queued'
      and q.scheduled_at <= now()
      and q.attempts < q.max_attempts
    order by q.scheduled_at asc
    limit greatest(1, least(coalesce(batch_limit, 10), 50))
    for update skip locked
  )
  returning e.*;
end;
$$;

create or replace function public.queue_lead_email_sequence()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  row_data jsonb;
  lead_name text;
  lead_email text;
begin
  row_data := to_jsonb(new);
  lead_email := trim(coalesce(row_data->>'email', ''));
  lead_name := trim(coalesce(row_data->>'full_name', row_data->>'name', ''));

  if lead_email = '' then
    return new;
  end if;

  insert into public.email_events (
    event_type,
    recipient_email,
    recipient_name,
    subject,
    template_key,
    payload,
    scheduled_at,
    lead_id
  )
  values
    (
      'lead_welcome',
      lead_email,
      lead_name,
      'HungAAI đã nhận thông tin của bạn',
      'lead_welcome',
      jsonb_build_object(
        'name', lead_name,
        'phone', coalesce(row_data->>'phone', ''),
        'want_register_now', coalesce((row_data->>'want_register_now')::boolean, false),
        'want_consultation', coalesce((row_data->>'want_consultation')::boolean, false),
        'want_join_community', coalesce((row_data->>'want_join_community')::boolean, false)
      ),
      now(),
      new.id::text
    ),
    (
      'lead_value_day_2',
      lead_email,
      lead_name,
      '3 điểm cần rõ trước khi viết bot MQL5',
      'lead_value_day_2',
      jsonb_build_object('name', lead_name),
      now() + interval '2 days',
      new.id::text
    ),
    (
      'lead_offer_day_3',
      lead_email,
      lead_name,
      'Nếu muốn mình soi case MQL5 của bạn',
      'lead_offer_day_3',
      jsonb_build_object('name', lead_name),
      now() + interval '3 days',
      new.id::text
    );

  return new;
end;
$$;

drop trigger if exists trg_queue_lead_email_sequence on public.leads;
create trigger trg_queue_lead_email_sequence
after insert on public.leads
for each row
execute function public.queue_lead_email_sequence();

create or replace function public.queue_order_confirmation_email()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  c record;
begin
  select id, name, email, phone
  into c
  from public.customers
  where id = new.customer_id
  limit 1;

  if c.email is null or trim(c.email) = '' then
    return new;
  end if;

  insert into public.email_events (
    event_type,
    recipient_email,
    recipient_name,
    subject,
    template_key,
    payload,
    scheduled_at,
    customer_id,
    order_id
  )
  values (
    'order_confirmation',
    trim(c.email),
    trim(coalesce(c.name, '')),
    'Xác nhận đơn hàng MQL5 của bạn',
    'order_confirmation',
    jsonb_build_object(
      'name', trim(coalesce(c.name, '')),
      'phone', coalesce(c.phone, ''),
      'order_id', new.id,
      'amount', new.amount,
      'status', new.status,
      'payment_content', new.payment_content
    ),
    now(),
    c.id,
    new.id
  );

  return new;
end;
$$;

drop trigger if exists trg_queue_order_confirmation_email on public.orders;
create trigger trg_queue_order_confirmation_email
after insert on public.orders
for each row
execute function public.queue_order_confirmation_email();
