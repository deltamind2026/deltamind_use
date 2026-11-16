
-- DeltaMind: Paper Trading Database
-- Simulated money, open positions, and trade history.

-- 1. Each user has a simulated trading account.
create table public.paper_accounts (
    user_id uuid primary key
        references auth.users(id) on delete cascade,

    cash_balance numeric(20, 6) not null default 10000,
    updated_at timestamptz not null default now(),

    constraint nonnegative_cash
        check (cash_balance >= 0)
);

create policy "Users can view own paper account"
on public.paper_accounts
for select
to authenticated
using ((select auth.uid()) = user_id);

alter table public.paper_accounts
enable row level security;


-- 2. Stores each user's open simulated positions.
create table public.paper_positions (
    id uuid primary key default gen_random_uuid(),

    user_id uuid not null
        references auth.users(id) on delete cascade,

    symbol text not null,
    shares numeric(20, 6) not null,
    avg_cost numeric(20, 6) not null,

    created_at timestamptz not null default now(),

    constraint paper_position_symbol
        check (
            length(trim(symbol)) between 1 and 20
            and symbol = upper(trim(symbol))
        ),

    constraint paper_position_shares
        check (shares > 0),

    constraint paper_position_cost
        check (avg_cost > 0),

    constraint unique_user_position
        unique (user_id, symbol)
);

create index idx_paper_positions_user
on public.paper_positions(user_id);

alter table public.paper_positions
enable row level security;

create policy "Users can view own paper positions"
on public.paper_positions
for select
to authenticated
using ((select auth.uid()) = user_id);


-- 3. Stores simulated buy/sell transaction history.
create table public.paper_trades (
    id uuid primary key default gen_random_uuid(),

    user_id uuid not null
        references auth.users(id) on delete cascade,

    symbol text not null,

    action text not null
        check (action in ('BUY', 'SELL')),

    shares numeric(20, 6) not null
        check (shares > 0),

    price numeric(20, 6) not null
        check (price > 0),

    total numeric(30, 6)
        generated always as (shares * price) stored,

    executed_at timestamptz not null default now(),

    constraint paper_trade_symbol
        check (
            length(trim(symbol)) between 1 and 20
            and symbol = upper(trim(symbol))
        )
);

create index idx_paper_trades_user_time
on public.paper_trades(user_id, executed_at desc);

alter table public.paper_trades
enable row level security;

create policy "Users can view own paper trades"
on public.paper_trades
for select
to authenticated
using ((select auth.uid()) = user_id);


-- Authenticated users may read their permitted rows.
grant select on
    public.paper_accounts,
    public.paper_positions,
    public.paper_trades
to authenticated;

-- Paper trading writes will be implemented through
-- secure, atomic server-side database functions later.
-- No direct user INSERT, UPDATE, or DELETE policies.
