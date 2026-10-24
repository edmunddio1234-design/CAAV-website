-- =====================================================================================================
-- BLOCK 6 (added 2026-10-24, NOT YET APPLIED): link live tasks to the Foundations plan items.
-- Project: southern-xr-jags (ykdyzsoukftzyfxfchoe). Apply only after Sonny's OK, AFTER Block 3 (migration-tasks.sql).
--
-- Written for a FIRST apply through a tool that refuses destructive statements: there is no "drop" anywhere.
-- Column and index use "if not exists", the function uses "create or replace", the trigger uses
-- "create or replace trigger" (Postgres 14+), the check constraint is only added if it is not there yet.
-- Running it a second time changes nothing and does not fail.
--
-- Plain words:
--   * public.tasks gets a new column plan_item_id: the id of the plan item a task came from
--     (for example "c1-a4" in the Foundations plan, assets/plan-data.js). Tasks made by hand leave it empty.
--   * Only one task can point at each plan item (a unique index that ignores empty values), so loading the
--     plan tasks (seed-plan-tasks.sql) can be run again and again without making copies.
--   * Only managers (admin, leadership) can set or change plan_item_id. For anyone else the database keeps
--     the old value on a change and leaves it empty on a new task, so nobody can take a plan item's place.
--     A privileged SQL editor run (no signed-in user) is not limited.
--   * The staff dashboard and the Foundations "My live tasks" panel keep working before and after this block.
-- =====================================================================================================

alter table public.tasks add column if not exists plan_item_id text;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'tasks_plan_item_len') then
    alter table public.tasks add constraint tasks_plan_item_len
      check (plan_item_id is null or (char_length(plan_item_id) between 1 and 60 and plan_item_id ~ '^[a-z0-9][a-z0-9-]*$'));
  end if;
end $$;

-- one task per plan item; empty values are not counted
create unique index if not exists tasks_plan_item_uidx on public.tasks (plan_item_id) where plan_item_id is not null;

-- guard: only managers (or a privileged run with no signed-in user) may set or change plan_item_id
create or replace function private.tasks_plan_item_guard() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if auth.uid() is null or private.is_manager() then return new; end if;
  if tg_op = 'INSERT' then new.plan_item_id := null;
  else new.plan_item_id := old.plan_item_id;
  end if;
  return new;
end $$;
revoke all on function private.tasks_plan_item_guard() from public, anon, authenticated;

create or replace trigger tasks_plan_item_biu before insert or update on public.tasks
  for each row execute function private.tasks_plan_item_guard();
