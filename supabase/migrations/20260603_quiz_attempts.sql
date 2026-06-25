-- Quiz attempt tracking
-- Run this in Supabase SQL editor: https://supabase.com/dashboard/project/_/sql

create table if not exists quiz_attempts (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  date        date not null default current_date,
  correct     boolean not null,
  created_at  timestamptz not null default now()
);

alter table quiz_attempts enable row level security;

-- Users can only insert and read their own attempts
create policy "Users can insert own attempts"
  on quiz_attempts for insert
  with check (auth.uid() = user_id);

create policy "Users can read own attempts"
  on quiz_attempts for select
  using (auth.uid() = user_id);

-- Index for fast per-user queries on the profile page
create index if not exists quiz_attempts_user_id_idx on quiz_attempts (user_id);
