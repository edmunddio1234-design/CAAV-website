-- =====================================================================================================
-- BLOCK 5 (added 2026-10-24, APPLIED 2026-10-24 to ykdyzsoukftzyfxfchoe): saved prices for the Foundations plan's Budget cards.
-- Project: southern-xr-jags (ykdyzsoukftzyfxfchoe). Apply only after Sonny's OK, AFTER Blocks 1 to 4
-- (it uses public.staff and private.is_staff() / private.is_manager() from Block 3).
--
-- Written for a FIRST apply through a tool that refuses destructive statements: there is no "drop" anywhere.
-- The table and index use "if not exists", functions use "create or replace", the trigger uses
-- "create or replace trigger" (Postgres 14+), and each policy is only created if it is not there yet.
-- Running it a second time changes nothing and does not fail. Because policies are never dropped,
-- a CHANGED policy in a later edit of this file would NOT replace the live one; that needs its own block.
--
-- Plain words:
--   * One row per budget line on the Foundations plan (item_id = the line id in assets/plan-data.js,
--     for example "c1-o4-b1"). The row holds the price and an optional note.
--   * Everyone with an active staff login can READ the saved prices.
--   * Managers (admin, leadership) can add, change and remove prices.
--   * Students and student leads can only read. Visitors (not signed in) get nothing.
--   * Who changed it and when is filled in by the database, not by the page.
-- =====================================================================================================

create schema if not exists private;
grant usage on schema private to authenticated;

-- ---------- 1) table ----------
create table if not exists public.plan_budget (
  item_id text primary key check (char_length(btrim(item_id)) between 1 and 80),
  amount_usd numeric(12,2) check (amount_usd is null or amount_usd >= 0),
  note text check (note is null or char_length(note) <= 500),
  updated_by uuid default auth.uid() references public.staff(user_id) on delete set null,
  updated_at timestamptz not null default now()
);

-- ---------- 2) trigger: who changed it is always the signed-in person; updated_at keeps itself current ----------
create or replace function private.plan_budget_before_write() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if tg_op = 'UPDATE' then
    new.item_id := old.item_id;
  end if;
  new.updated_by := auth.uid();
  new.updated_at := now();
  return new;
end $$;
revoke all on function private.plan_budget_before_write() from public, anon, authenticated;

create or replace trigger plan_budget_bw before insert or update on public.plan_budget
  for each row execute function private.plan_budget_before_write();

-- ---------- 3) row rules (RLS) ----------
alter table public.plan_budget enable row level security;

-- table grants: signed-in users only; visitors (anon) get nothing. The policies below narrow it further.
revoke all on public.plan_budget from anon;
revoke all on public.plan_budget from authenticated;
grant select, insert, update, delete on public.plan_budget to authenticated;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'plan_budget' and policyname = 'plan_budget_read') then
    create policy plan_budget_read on public.plan_budget for select to authenticated using (private.is_staff());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'plan_budget' and policyname = 'plan_budget_insert') then
    create policy plan_budget_insert on public.plan_budget for insert to authenticated with check (private.is_manager());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'plan_budget' and policyname = 'plan_budget_update') then
    create policy plan_budget_update on public.plan_budget for update to authenticated using (private.is_manager()) with check (private.is_manager());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'plan_budget' and policyname = 'plan_budget_delete') then
    create policy plan_budget_delete on public.plan_budget for delete to authenticated using (private.is_manager());
  end if;
end $$;

-- ---------- 4) index ----------
create index if not exists plan_budget_updated_idx on public.plan_budget (updated_at desc);
