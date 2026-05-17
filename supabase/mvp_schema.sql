-- MVP schema for mql5_v2.
-- Run this in Supabase SQL Editor before testing the static admin.
-- This intentionally opens anon access for fast testing only.

create table if not exists products (
  id bigserial primary key,
  name text not null default '',
  price numeric not null default 0,
  description text not null default '',
  remaining_quantity integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists customers (
  id bigserial primary key,
  name text not null default '',
  phone text not null default '',
  zalo text not null default '',
  email text not null default '',
  registered_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists orders (
  id bigserial primary key,
  customer_id bigint not null references customers(id),
  product_id bigint not null references products(id),
  quantity integer not null default 1,
  amount numeric not null default 0,
  status text not null default 'pending'
    check (status in ('pending', 'success', 'cancelled')),
  payment_content text not null default 'MQL5_Coc',
  purchased_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists sepay_transactions (
  id bigserial primary key,
  sepay_id text unique,
  gateway text,
  transaction_date text,
  account_number text,
  code text,
  content text,
  transfer_type text,
  transfer_amount integer,
  reference_code text,
  matched_order_id bigint references orders(id),
  raw_payload text,
  created_at timestamptz not null default now()
);

create index if not exists idx_orders_status on orders(status);
create index if not exists idx_orders_payment_content on orders(payment_content);
create unique index if not exists idx_sepay_transactions_sepay_id
  on sepay_transactions(sepay_id);

alter table products enable row level security;
alter table customers enable row level security;
alter table orders enable row level security;
alter table sepay_transactions enable row level security;

drop policy if exists "mvp anon all products" on products;
create policy "mvp anon all products"
  on products for all to anon
  using (true)
  with check (true);

drop policy if exists "mvp anon all customers" on customers;
create policy "mvp anon all customers"
  on customers for all to anon
  using (true)
  with check (true);

drop policy if exists "mvp anon all orders" on orders;
create policy "mvp anon all orders"
  on orders for all to anon
  using (true)
  with check (true);

drop policy if exists "mvp anon all sepay_transactions" on sepay_transactions;
create policy "mvp anon all sepay_transactions"
  on sepay_transactions for all to anon
  using (true)
  with check (true);
