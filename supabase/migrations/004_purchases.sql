-- Purchases table (created by Paddle webhook)
create table if not exists purchases (
  id               uuid primary key default gen_random_uuid(),
  transaction_id   text unique not null,
  user_id          uuid references auth.users(id) on delete set null,
  paddle_customer_id text,
  price_id         text not null,
  quantity         int not null default 1,
  status           text not null default 'completed',
  created_at       timestamptz not null default now()
);

-- RLS: users can read their own purchases, service role can insert
alter table purchases enable row level security;

create policy "users read own purchases"
  on purchases for select
  using (auth.uid() = user_id);

-- Extra clicks column on users table (tracks purchased clicks remaining)
alter table users
  add column if not exists extra_clicks int not null default 0;

-- RPC: add purchased clicks to a user
create or replace function add_extra_clicks(uid uuid, amount int)
returns void
language plpgsql security definer as $$
begin
  insert into users (id, extra_clicks)
  values (uid, amount)
  on conflict (id) do update
    set extra_clicks = users.extra_clicks + excluded.extra_clicks;
end;
$$;
