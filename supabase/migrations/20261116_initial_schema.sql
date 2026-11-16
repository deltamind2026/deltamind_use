
-- DeltaMind: Initial database schema
-- Profiles linked to Supabase Authentication

create table public.profiles (
    id uuid primary key references auth.users(id) on delete cascade,
    display_name text,
    created_at timestamptz not null default now()
);

-- Enable Row Level Security
alter table public.profiles enable row level security;

-- Users can read their own profile
create policy "Users can view their own profile"
on public.profiles
for select
to authenticated
using ((select auth.uid()) = id);

-- Users can create their own profile
create policy "Users can create their own profile"
on public.profiles
for insert
to authenticated
with check ((select auth.uid()) = id);

-- Users can update their own profile
create policy "Users can update their own profile"
on public.profiles
for update
to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);
