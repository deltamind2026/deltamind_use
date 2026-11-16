
-- DeltaMind: Portfolio Holdings
-- Stores each user's stock holdings.

create table public.portfolio_holdings (
    id uuid primary key default gen_random_uuid(),

    user_id uuid not null
        references auth.users(id) on delete cascade
        default auth.uid(),

    symbol text not null,
    shares numeric(20, 6) not null,
    buy_price numeric(20, 6) not null,

    added_at timestamptz not null default now(),

    constraint valid_symbol
        check (length(trim(symbol)) between 1 and 20),

    constraint positive_shares
        check (shares > 0),

    constraint positive_buy_price
        check (buy_price > 0)
);

-- Speed up searches for a user's holdings.
create index idx_portfolio_holdings_user
on public.portfolio_holdings(user_id);

-- Enable row-level security.
alter table public.portfolio_holdings
enable row level security;

-- Allow authenticated users to read their holdings.
create policy "Users can view own holdings"
on public.portfolio_holdings
for select
to authenticated
using ((select auth.uid()) = user_id);

-- Allow authenticated users to add their holdings.
create policy "Users can insert own holdings"
on public.portfolio_holdings
for insert
to authenticated
with check ((select auth.uid()) = user_id);

-- Allow authenticated users to update their holdings.
create policy "Users can update own holdings"
on public.portfolio_holdings
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

-- Allow authenticated users to delete their holdings.
create policy "Users can delete own holdings"
on public.portfolio_holdings
for delete
to authenticated
using ((select auth.uid()) = user_id);

-- Allow the authenticated role to use the table.
grant select, insert, update, delete
on public.portfolio_holdings to authenticated;
