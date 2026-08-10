-- Adiuvaret AI Classroom Generator — Supabase schema
-- Run this once in the Supabase dashboard: SQL Editor -> New query -> paste -> Run.
-- Safe to re-run (idempotent).
--
-- AFTER running this, do two manual steps in the dashboard:
--   1. Authentication -> Sign In / Providers -> Email -> turn OFF "Confirm email".
--   2. Sign up through the app, then promote yourself to admin:
--        update public.profiles set role = 'admin' where email = 'you@example.com';

create extension if not exists pgcrypto;

-- ============================================================
-- Tables
-- ============================================================

create table if not exists public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  email      text not null,
  full_name  text,
  role       text not null default 'user' check (role in ('user', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.plans (
  id              uuid primary key default gen_random_uuid(),
  code            text unique not null,
  name            text not null,
  duration_months int not null check (duration_months > 0),
  price_inr       numeric(10, 2) not null check (price_inr >= 0),
  is_active       boolean not null default true,
  created_at      timestamptz not null default now()
);

create table if not exists public.subscriptions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null unique references public.profiles(id) on delete cascade,
  plan_id    uuid not null references public.plans(id),
  status     text not null default 'active' check (status in ('active', 'paused', 'expired', 'cancelled')),
  start_date timestamptz not null default now(),
  end_date   timestamptz not null,
  paused_at  timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Upgrades an existing install (safe on a fresh one too).
alter table public.subscriptions add column if not exists paused_at timestamptz;
alter table public.subscriptions drop constraint if exists subscriptions_status_check;
alter table public.subscriptions add constraint subscriptions_status_check
  check (status in ('active', 'paused', 'expired', 'cancelled'));

create table if not exists public.payments (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references public.profiles(id) on delete cascade,
  plan_id             uuid not null references public.plans(id),
  razorpay_order_id   text not null unique,
  razorpay_payment_id text unique,
  razorpay_signature  text,
  amount_inr          numeric(10, 2) not null,
  currency            text not null default 'INR',
  status              text not null default 'created' check (status in ('created', 'paid', 'failed')),
  created_at          timestamptz not null default now(),
  verified_at         timestamptz
);

create table if not exists public.activity_log (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  action     text not null,
  metadata   jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- History and Saved are one row with an is_saved flag, not two copies.
create table if not exists public.generated_content (
  id         uuid primary key,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  type       text not null check (type in ('worksheet', 'lesson', 'quiz', 'activity', 'exam')),
  title      text not null,
  summary    text,
  note       text,
  sections   jsonb,
  questions  jsonb,
  class_name text default '',
  subject    text default '',
  is_saved   boolean not null default false,
  saved_at   timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists generated_content_user_created_idx
  on public.generated_content (user_id, created_at desc);
create index if not exists generated_content_user_saved_idx
  on public.generated_content (user_id, is_saved, saved_at desc);
create index if not exists activity_log_user_created_idx
  on public.activity_log (user_id, created_at desc);
create index if not exists payments_user_created_idx
  on public.payments (user_id, created_at desc);

-- ============================================================
-- Helpers and triggers
-- ============================================================

-- SECURITY DEFINER so policies on `profiles` can call it without recursing
-- back through their own RLS check.
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  );
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    lower(new.email),
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    'user'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- RLS grants row access, not column access: without this a user could PATCH
-- their own profile row and set role='admin'.
create or replace function public.prevent_role_self_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is distinct from old.role and not public.is_admin() then
    new.role := old.role;
  end if;
  if new.email is distinct from old.email then
    new.email := old.email;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists profiles_guard_update on public.profiles;
create trigger profiles_guard_update
  before update on public.profiles
  for each row execute function public.prevent_role_self_escalation();

-- ============================================================
-- Row Level Security
-- ============================================================

alter table public.profiles          enable row level security;
alter table public.plans             enable row level security;
alter table public.subscriptions     enable row level security;
alter table public.payments          enable row level security;
alter table public.activity_log      enable row level security;
alter table public.generated_content enable row level security;

drop policy if exists profiles_select_own_or_admin on public.profiles;
create policy profiles_select_own_or_admin on public.profiles
  for select using (id = auth.uid() or public.is_admin());

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists plans_select_authenticated on public.plans;
create policy plans_select_authenticated on public.plans
  for select to authenticated using (true);

-- Regular users can only read their subscription — it is written by the Edge
-- Functions via the service-role key. Admins may manage it from the dashboard;
-- is_admin() is evaluated in Postgres, so a normal user cannot fake it.
drop policy if exists subscriptions_select_own_or_admin on public.subscriptions;
create policy subscriptions_select_own_or_admin on public.subscriptions
  for select using (user_id = auth.uid() or public.is_admin());

drop policy if exists subscriptions_admin_manage on public.subscriptions;
create policy subscriptions_admin_manage on public.subscriptions
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists payments_select_own_or_admin on public.payments;
create policy payments_select_own_or_admin on public.payments
  for select using (user_id = auth.uid() or public.is_admin());

drop policy if exists activity_log_select_own_or_admin on public.activity_log;
create policy activity_log_select_own_or_admin on public.activity_log
  for select using (user_id = auth.uid() or public.is_admin());

drop policy if exists activity_log_insert_own on public.activity_log;
create policy activity_log_insert_own on public.activity_log
  for insert with check (user_id = auth.uid());

-- So an admin action can be recorded against the user it affected.
drop policy if exists activity_log_insert_admin on public.activity_log;
create policy activity_log_insert_admin on public.activity_log
  for insert with check (public.is_admin());

drop policy if exists generated_content_select_own_or_admin on public.generated_content;
create policy generated_content_select_own_or_admin on public.generated_content
  for select using (user_id = auth.uid() or public.is_admin());

drop policy if exists generated_content_insert_own on public.generated_content;
create policy generated_content_insert_own on public.generated_content
  for insert with check (user_id = auth.uid());

drop policy if exists generated_content_update_own on public.generated_content;
create policy generated_content_update_own on public.generated_content
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists generated_content_delete_own on public.generated_content;
create policy generated_content_delete_own on public.generated_content
  for delete using (user_id = auth.uid());

-- ============================================================
-- Seed plans — edit these prices to whatever you actually charge
-- ============================================================

insert into public.plans (code, name, duration_months, price_inr, is_active) values
  ('1m',  '1 Month',   1,   499.00, true),
  ('3m',  '3 Months',  3,  1299.00, true),
  ('6m',  '6 Months',  6,  2399.00, true),
  ('12m', '1 Year',   12,  4299.00, true)
on conflict (code) do nothing;
