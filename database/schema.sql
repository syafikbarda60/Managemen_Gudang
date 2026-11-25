begin;

create table if not exists public.warehouse_members (
  user_id text primary key references public."user"(id) on delete cascade
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 120),
  category text not null check (length(trim(category)) between 1 and 80),
  unit text not null check (length(trim(unit)) between 1 and 30),
  photo text check (length(photo) <= 2048 and photo ~ '^https://'),
  stock integer check (stock >= 0),
  minimum integer not null default 0 check (minimum >= 0),
  counted_at timestamptz
);

create table if not exists public.withdrawals (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id),
  operator text not null check (length(trim(operator)) between 1 and 100),
  taken_date date not null check (taken_date <= (now() at time zone 'Asia/Jakarta')::date),
  taken_time time not null,
  quantity integer not null check (quantity > 0),
  note text not null default '' check (length(note) <= 300)
);

create table if not exists public.receipts (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id),
  operator text not null check (length(trim(operator)) between 1 and 100),
  received_date date not null check (received_date <= (now() at time zone 'Asia/Jakarta')::date),
  received_time time not null,
  quantity integer not null check (quantity > 0),
  note text not null default '' check (length(note) <= 300)
);

create index if not exists withdrawals_date_idx on public.withdrawals (taken_date desc, taken_time desc, id);
create index if not exists receipts_date_idx on public.receipts (received_date desc, received_time desc, id);

create table if not exists public.stock_counts (
  id bigint generated always as identity primary key,
  product_id uuid not null references public.products(id),
  quantity integer not null check (quantity >= 0),
  counted_at timestamptz not null
);

create or replace function public.stamp_stock_count() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.counted_at := clock_timestamp();
  insert into public.stock_counts (product_id, quantity, counted_at)
    values (new.id, new.stock, new.counted_at);
  return new;
end;
$$;

create or replace trigger stamp_stock_count before update of stock on public.products
for each row execute function public.stamp_stock_count();

commit;
