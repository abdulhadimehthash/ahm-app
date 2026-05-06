create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.password_entries (
  id uuid primary key default gen_random_uuid(),
  category text not null check (category in ('Personal', 'Client', 'Others')),
  username text not null,
  password_value text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  domain text not null,
  description text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.finance_entries (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null check (category in ('Client', 'Others')),
  amount numeric(12, 2) not null check (amount >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  finish_date date not null,
  notification_today_id text,
  notification_tomorrow_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists set_password_entries_updated_at on public.password_entries;
create trigger set_password_entries_updated_at
before update on public.password_entries
for each row execute function public.set_updated_at();

drop trigger if exists set_projects_updated_at on public.projects;
create trigger set_projects_updated_at
before update on public.projects
for each row execute function public.set_updated_at();

drop trigger if exists set_finance_entries_updated_at on public.finance_entries;
create trigger set_finance_entries_updated_at
before update on public.finance_entries
for each row execute function public.set_updated_at();

drop trigger if exists set_tasks_updated_at on public.tasks;
create trigger set_tasks_updated_at
before update on public.tasks
for each row execute function public.set_updated_at();

alter table public.password_entries enable row level security;
alter table public.projects enable row level security;
alter table public.finance_entries enable row level security;
alter table public.tasks enable row level security;

drop policy if exists "anon read password entries" on public.password_entries;
create policy "anon read password entries" on public.password_entries for select to anon using (true);
drop policy if exists "anon insert password entries" on public.password_entries;
create policy "anon insert password entries" on public.password_entries for insert to anon with check (true);
drop policy if exists "anon update password entries" on public.password_entries;
create policy "anon update password entries" on public.password_entries for update to anon using (true) with check (true);
drop policy if exists "anon delete password entries" on public.password_entries;
create policy "anon delete password entries" on public.password_entries for delete to anon using (true);

drop policy if exists "anon read projects" on public.projects;
create policy "anon read projects" on public.projects for select to anon using (true);
drop policy if exists "anon insert projects" on public.projects;
create policy "anon insert projects" on public.projects for insert to anon with check (true);
drop policy if exists "anon update projects" on public.projects;
create policy "anon update projects" on public.projects for update to anon using (true) with check (true);
drop policy if exists "anon delete projects" on public.projects;
create policy "anon delete projects" on public.projects for delete to anon using (true);

drop policy if exists "anon read finance entries" on public.finance_entries;
create policy "anon read finance entries" on public.finance_entries for select to anon using (true);
drop policy if exists "anon insert finance entries" on public.finance_entries;
create policy "anon insert finance entries" on public.finance_entries for insert to anon with check (true);
drop policy if exists "anon update finance entries" on public.finance_entries;
create policy "anon update finance entries" on public.finance_entries for update to anon using (true) with check (true);
drop policy if exists "anon delete finance entries" on public.finance_entries;
create policy "anon delete finance entries" on public.finance_entries for delete to anon using (true);

drop policy if exists "anon read tasks" on public.tasks;
create policy "anon read tasks" on public.tasks for select to anon using (true);
drop policy if exists "anon insert tasks" on public.tasks;
create policy "anon insert tasks" on public.tasks for insert to anon with check (true);
drop policy if exists "anon update tasks" on public.tasks;
create policy "anon update tasks" on public.tasks for update to anon using (true) with check (true);
drop policy if exists "anon delete tasks" on public.tasks;
create policy "anon delete tasks" on public.tasks for delete to anon using (true);
