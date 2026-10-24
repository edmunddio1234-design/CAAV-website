-- =====================================================================================================
-- BLOCK 3 (added 2026-10-24, APPLIED 2026-10-24 to ykdyzsoukftzyfxfchoe): team tasks + member management for the XR Jags staff dashboard.
-- Project: southern-xr-jags (ykdyzsoukftzyfxfchoe). Apply only after Sonny's OK, AFTER Block 1.
-- Safe to re-run: "if not exists", "create or replace", drop-if-exists for policies and triggers.
--
-- Plain words:
--   * A "manager" is active staff with role admin or leadership (Lynelle is admin). Managers see every task.
--   * Everyone else only sees tasks they are on, or tasks they made ("siloed").
--   * Turning someone's access off (staff.active = false) hides everything from them at once.
--   * Deleting a task only hides it (soft delete, with a reason). Only managers see the Deleted list and restore.
--   * History (task_activity) and notifications are written by the database itself (triggers), never by the page.
-- All rule functions live in schema "private" (not reachable through the API), are security definer,
-- and pin search_path.
-- =====================================================================================================

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;   -- policies call private.* as the signed-in user

-- ---------- 1) staff: email, on/off switch, "pick your own password" flag ----------
alter table public.staff add column if not exists email text;
alter table public.staff add column if not exists active boolean not null default true;
-- existing rows (people already signed in with their own password) get false; new rows default to true
alter table public.staff add column if not exists must_change_password boolean not null default false;
alter table public.staff alter column must_change_password set default true;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'staff_email_len') then
    alter table public.staff add constraint staff_email_len check (email is null or char_length(email) <= 320);
  end if;
end $$;

-- ---------- 2) rule functions ----------
-- is_staff now also requires the account to be switched on. Same signature, so every Block 1/2 policy
-- (leads, activity_log, uploads, storage) follows automatically.
create or replace function private.is_staff() returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (select 1 from public.staff where user_id = auth.uid() and active);
$$;

create or replace function private.is_manager() returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (select 1 from public.staff where user_id = auth.uid() and active and role in ('admin','leadership'));
$$;

create or replace function private.is_active_staff(uid uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (select 1 from public.staff where user_id = uid and active);
$$;

-- ---------- 3) tables ----------
create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  title text not null check (char_length(btrim(title)) between 1 and 200),
  details text check (details is null or char_length(details) <= 4000),
  status text not null default 'todo' check (status in ('todo','doing','review','done')),
  priority text not null default 'normal' check (priority in ('normal','high')),
  due_date date,
  created_by uuid default auth.uid() references public.staff(user_id) on delete set null,
  done_at timestamptz,
  deleted_at timestamptz,
  deleted_by uuid references public.staff(user_id) on delete set null,
  deleted_reason text check (deleted_reason is null or char_length(deleted_reason) <= 300)
);

create table if not exists public.task_members (
  task_id uuid not null references public.tasks(id) on delete cascade,
  user_id uuid not null references public.staff(user_id) on delete cascade,
  added_at timestamptz not null default now(),
  added_by uuid default auth.uid() references public.staff(user_id) on delete set null,
  primary key (task_id, user_id)
);

create table if not exists public.task_checklist (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  text text not null check (char_length(btrim(text)) between 1 and 300),
  done boolean not null default false,
  done_by uuid references public.staff(user_id) on delete set null,
  done_at timestamptz,
  position integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.task_updates (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  user_id uuid not null default auth.uid() references public.staff(user_id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 2000),
  created_at timestamptz not null default now()
);

create table if not exists public.task_activity (
  id bigint generated always as identity primary key,
  task_id uuid not null references public.tasks(id) on delete cascade,
  user_id uuid references public.staff(user_id) on delete set null,
  action text not null check (action in ('created','assigned','unassigned','status','checklist','update','edited','deleted','restored')),
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.staff(user_id) on delete cascade,
  task_id uuid references public.tasks(id) on delete cascade,
  text text not null check (char_length(text) <= 300),
  read boolean not null default false,
  created_at timestamptz not null default now()
);

-- task helpers (these read tasks/task_members as the function owner, so policies never loop)
create or replace function private.is_task_member(t uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (select 1 from public.task_members where task_id = t and user_id = auth.uid());
$$;

-- can see: managers see everything (deleted too); others see live tasks they are on or made
create or replace function private.can_see_task(t uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select private.is_staff() and (
    private.is_manager()
    or exists (select 1 from public.tasks k where k.id = t and k.deleted_at is null
               and (k.created_by = auth.uid()
                    or exists (select 1 from public.task_members m where m.task_id = t and m.user_id = auth.uid()))));
$$;

-- can work on: can see it and it is not deleted (status, checklist ticks, updates)
create or replace function private.can_work_task(t uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select private.can_see_task(t) and exists (select 1 from public.tasks k where k.id = t and k.deleted_at is null);
$$;

-- can manage: managers, or whoever made the task (people on it, checklist lines, title/details/due)
create or replace function private.can_manage_task(t uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select private.is_staff() and exists (select 1 from public.tasks k where k.id = t and k.deleted_at is null
           and (private.is_manager() or k.created_by = auth.uid()));
$$;

create or replace function private.staff_name(uid uuid) returns text
language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce((select full_name from public.staff where user_id = uid), 'Someone');
$$;

create or replace function private.status_words(s text) returns text
language sql immutable set search_path = public, pg_temp as $$
  select case s when 'todo' then 'To do' when 'doing' then 'Working on it' when 'review' then 'Ready for review' when 'done' then 'Done' else s end;
$$;

-- notify everyone on a task (members + creator) except the person who did the thing
create or replace function private.notify_task_people(t uuid, actor uuid, msg text) returns void
language sql volatile security definer set search_path = public, pg_temp as $$
  insert into public.notifications (user_id, task_id, text)
  select distinct p.uid, t, left(msg, 300) from (
    select m.user_id as uid from public.task_members m where m.task_id = t
    union select k.created_by from public.tasks k where k.id = t
  ) p
  join public.staff s on s.user_id = p.uid and s.active
  where p.uid is not null and p.uid is distinct from actor;
$$;

-- ---------- 4) "pick your own password": clears ONLY the caller's own flag ----------
-- No arguments, so it can never touch someone else's row. Only works for active staff whose flag is set.
-- Returns true when the flag was cleared. The page calls it right after supabase.auth.updateUser({password}).
create or replace function private.clear_must_change() returns boolean
language plpgsql volatile security definer set search_path = public, pg_temp as $$
declare n int;
begin
  if auth.uid() is null then return false; end if;
  update public.staff set must_change_password = false
   where user_id = auth.uid() and active and must_change_password;
  get diagnostics n = row_count;
  return n > 0;
end $$;

-- public wrapper (the API only reaches schema public). Security invoker: all the power is in the private function.
create or replace function public.clear_my_password_flag() returns boolean
language sql volatile security invoker set search_path = public, pg_temp as $$
  select private.clear_must_change();
$$;

-- ---------- 4b) delete (soft) and restore ----------
-- Done through these instead of a plain update because, once deleted, a member can no longer see the row,
-- and Postgres refuses an update whose result the person could not see. Same rules as the trigger:
-- delete = the maker or a manager, with a reason; restore = managers only.
create or replace function private.delete_task(p_task uuid, p_reason text) returns boolean
language plpgsql volatile security definer set search_path = public, pg_temp as $$
declare n int;
begin
  if not private.can_manage_task(p_task) then
    raise exception 'Only the person who made this task, or a manager, can delete it' using errcode = '42501';
  end if;
  if coalesce(btrim(p_reason), '') = '' then raise exception 'Say why the task is being deleted' using errcode = '23514'; end if;
  update public.tasks set deleted_at = now(), deleted_reason = left(btrim(p_reason), 300) where id = p_task and deleted_at is null;
  get diagnostics n = row_count;
  return n > 0;
end $$;

create or replace function private.restore_task(p_task uuid) returns boolean
language plpgsql volatile security definer set search_path = public, pg_temp as $$
declare n int;
begin
  if not private.is_manager() then raise exception 'Only a manager can restore a task' using errcode = '42501'; end if;
  update public.tasks set deleted_at = null where id = p_task and deleted_at is not null;
  get diagnostics n = row_count;
  return n > 0;
end $$;

create or replace function public.delete_task(p_task uuid, p_reason text) returns boolean
language sql volatile security invoker set search_path = public, pg_temp as $$ select private.delete_task(p_task, p_reason); $$;
create or replace function public.restore_task(p_task uuid) returns boolean
language sql volatile security invoker set search_path = public, pg_temp as $$ select private.restore_task(p_task); $$;
revoke all on function private.delete_task(uuid, text), private.restore_task(uuid), public.delete_task(uuid, text), public.restore_task(uuid) from public, anon;
grant execute on function private.delete_task(uuid, text), private.restore_task(uuid), public.delete_task(uuid, text), public.restore_task(uuid) to authenticated;

revoke all on function private.is_staff() from public, anon;
revoke all on function private.is_manager() from public, anon;
revoke all on function private.is_active_staff(uuid) from public, anon;
revoke all on function private.is_task_member(uuid) from public, anon;
revoke all on function private.can_see_task(uuid) from public, anon;
revoke all on function private.can_work_task(uuid) from public, anon;
revoke all on function private.can_manage_task(uuid) from public, anon;
revoke all on function private.staff_name(uuid) from public, anon;
revoke all on function private.status_words(text) from public, anon;
revoke all on function private.notify_task_people(uuid, uuid, text) from public, anon, authenticated;
revoke all on function private.clear_must_change() from public, anon;
revoke all on function public.clear_my_password_flag() from public, anon;
grant execute on function private.is_staff(), private.is_manager(), private.is_active_staff(uuid),
  private.is_task_member(uuid), private.can_see_task(uuid), private.can_work_task(uuid), private.can_manage_task(uuid),
  private.clear_must_change() to authenticated;
grant execute on function public.clear_my_password_flag() to authenticated;
-- leads_public_insert (Block 1) is open to anon and does not call is_staff, so anon needs nothing here.

-- ---------- 5) triggers: guard rules + history + notifications ----------
-- tasks, before insert: the maker is always the signed-in person; a new task is never born deleted
create or replace function private.tasks_before_insert() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if auth.uid() is not null then new.created_by := auth.uid(); end if;
  new.created_at := now(); new.updated_at := now();
  new.deleted_at := null; new.deleted_by := null; new.deleted_reason := null;
  new.done_at := case when new.status = 'done' then now() else null end;
  new.title := btrim(new.title);
  return new;
end $$;

-- tasks, before update: who may change what
create or replace function private.tasks_before_update() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare me uuid := auth.uid(); mgr boolean := private.is_manager(); maker boolean;
begin
  new.id := old.id; new.created_at := old.created_at; new.created_by := old.created_by;
  maker := (old.created_by = me);
  if me is not null then
    -- delete (soft)
    if old.deleted_at is null and new.deleted_at is not null then
      if not (mgr or maker) then raise exception 'Only the person who made this task, or a manager, can delete it' using errcode = '42501'; end if;
      if coalesce(btrim(new.deleted_reason), '') = '' then raise exception 'Say why the task is being deleted' using errcode = '23514'; end if;
      new.deleted_at := now(); new.deleted_by := me; new.deleted_reason := btrim(new.deleted_reason);
    -- restore
    elsif old.deleted_at is not null and new.deleted_at is null then
      if not mgr then raise exception 'Only a manager can restore a task' using errcode = '42501'; end if;
      new.deleted_by := null; new.deleted_reason := null;
    elsif old.deleted_at is not null then
      if not mgr then raise exception 'This task was deleted' using errcode = '42501'; end if;
      new.deleted_at := old.deleted_at; new.deleted_by := old.deleted_by; new.deleted_reason := old.deleted_reason;
    else
      new.deleted_by := null; new.deleted_reason := null;
    end if;
    -- people who were handed the task may change only its status
    if not (mgr or maker) and (new.title is distinct from old.title or new.details is distinct from old.details
        or new.priority is distinct from old.priority or new.due_date is distinct from old.due_date) then
      raise exception 'Only the person who made this task, or a manager, can change its title, details, priority or due date' using errcode = '42501';
    end if;
  end if;
  if new.status is distinct from old.status then
    new.done_at := case when new.status = 'done' then now() else null end;
  else
    new.done_at := old.done_at;
  end if;
  new.title := btrim(new.title);
  new.updated_at := now();
  return new;
end $$;

create or replace function private.tasks_after_insert() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  insert into public.task_activity (task_id, user_id, action, detail) values (new.id, auth.uid(), 'created', jsonb_build_object('title', new.title));
  return new;
end $$;

create or replace function private.tasks_after_update() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare me uuid := auth.uid(); who text := private.staff_name(auth.uid());
begin
  if old.deleted_at is null and new.deleted_at is not null then
    insert into public.task_activity (task_id, user_id, action, detail) values (new.id, me, 'deleted', jsonb_build_object('reason', new.deleted_reason));
    return new;
  end if;
  if old.deleted_at is not null and new.deleted_at is null then
    insert into public.task_activity (task_id, user_id, action) values (new.id, me, 'restored');
    perform private.notify_task_people(new.id, me, who || ' brought back the task "' || new.title || '"');
    return new;
  end if;
  if new.status is distinct from old.status then
    insert into public.task_activity (task_id, user_id, action, detail)
      values (new.id, me, 'status', jsonb_build_object('from', old.status, 'to', new.status));
    perform private.notify_task_people(new.id, me, who || ' moved "' || new.title || '" to ' || private.status_words(new.status));
    if new.status in ('review','done') then
      -- managers hear about work that is ready for review or done (skip anyone already told above)
      insert into public.notifications (user_id, task_id, text)
      select s.user_id, new.id, left(who || ' moved "' || new.title || '" to ' || private.status_words(new.status), 300)
        from public.staff s
       where s.active and s.role in ('admin','leadership') and s.user_id is distinct from me
         and s.user_id is distinct from new.created_by
         and not exists (select 1 from public.task_members m where m.task_id = new.id and m.user_id = s.user_id);
    end if;
  end if;
  if new.title is distinct from old.title or new.details is distinct from old.details
     or new.priority is distinct from old.priority or new.due_date is distinct from old.due_date then
    insert into public.task_activity (task_id, user_id, action, detail) values (new.id, me, 'edited',
      jsonb_strip_nulls(jsonb_build_object(
        'title', case when new.title is distinct from old.title then new.title end,
        'details', case when new.details is distinct from old.details then true end,
        'priority', case when new.priority is distinct from old.priority then new.priority end,
        'due_date', case when new.due_date is distinct from old.due_date then coalesce(new.due_date::text, 'none') end)));
  end if;
  return new;
end $$;

create or replace function private.members_after_insert() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare t text;
begin
  select title into t from public.tasks where id = new.task_id;
  insert into public.task_activity (task_id, user_id, action, detail) values (new.task_id, auth.uid(), 'assigned', jsonb_build_object('user_id', new.user_id));
  if new.user_id is distinct from auth.uid() then
    insert into public.notifications (user_id, task_id, text)
      values (new.user_id, new.task_id, left(private.staff_name(auth.uid()) || ' gave you a task: "' || t || '"', 300));
  end if;
  return new;
end $$;

create or replace function private.members_before_insert() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not private.is_active_staff(new.user_id) then raise exception 'That person''s access is turned off' using errcode = '23514'; end if;
  if auth.uid() is not null then new.added_by := auth.uid(); end if;
  new.added_at := now();
  return new;
end $$;

create or replace function private.members_after_delete() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if exists (select 1 from public.tasks where id = old.task_id) then
    insert into public.task_activity (task_id, user_id, action, detail) values (old.task_id, auth.uid(), 'unassigned', jsonb_build_object('user_id', old.user_id));
  end if;
  return old;
end $$;

-- checklist: people handed the task may only tick/untick; the maker/managers may also reword or reorder
create or replace function private.checklist_before_update() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  new.id := old.id; new.task_id := old.task_id; new.created_at := old.created_at;
  if auth.uid() is not null and not private.can_manage_task(old.task_id)
     and (new.text is distinct from old.text or new.position is distinct from old.position) then
    raise exception 'Only the person who made this task, or a manager, can change checklist wording' using errcode = '42501';
  end if;
  if new.done is distinct from old.done then
    if new.done then new.done_by := auth.uid(); new.done_at := now(); else new.done_by := null; new.done_at := null; end if;
  else
    new.done_by := old.done_by; new.done_at := old.done_at;
  end if;
  return new;
end $$;

create or replace function private.checklist_before_insert() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  new.text := btrim(new.text); new.created_at := now();
  if new.done then new.done_by := auth.uid(); new.done_at := now(); else new.done_by := null; new.done_at := null; end if;
  return new;
end $$;

create or replace function private.checklist_after_update() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.done is distinct from old.done then
    insert into public.task_activity (task_id, user_id, action, detail)
      values (new.task_id, auth.uid(), 'checklist', jsonb_build_object('text', new.text, 'done', new.done));
  end if;
  return new;
end $$;

create or replace function private.updates_before_insert() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if auth.uid() is not null then new.user_id := auth.uid(); end if;
  new.created_at := now(); new.body := btrim(new.body);
  return new;
end $$;

create or replace function private.updates_after_insert() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare t text;
begin
  select title into t from public.tasks where id = new.task_id;
  insert into public.task_activity (task_id, user_id, action, detail) values (new.task_id, new.user_id, 'update', jsonb_build_object('update_id', new.id));
  perform private.notify_task_people(new.task_id, new.user_id, private.staff_name(new.user_id) || ' posted an update on "' || t || '"');
  return new;
end $$;

-- trigger functions are never called directly
revoke all on function private.tasks_before_insert(), private.tasks_before_update(), private.tasks_after_insert(),
  private.tasks_after_update(), private.members_after_insert(), private.members_before_insert(), private.members_after_delete(),
  private.checklist_before_update(), private.checklist_before_insert(), private.checklist_after_update(),
  private.updates_before_insert(), private.updates_after_insert() from public, anon, authenticated;

drop trigger if exists tasks_bi on public.tasks;
drop trigger if exists tasks_bu on public.tasks;
drop trigger if exists tasks_ai on public.tasks;
drop trigger if exists tasks_au on public.tasks;
create trigger tasks_bi before insert on public.tasks for each row execute function private.tasks_before_insert();
create trigger tasks_bu before update on public.tasks for each row execute function private.tasks_before_update();
create trigger tasks_ai after insert on public.tasks for each row execute function private.tasks_after_insert();
create trigger tasks_au after update on public.tasks for each row execute function private.tasks_after_update();

drop trigger if exists task_members_bi on public.task_members;
drop trigger if exists task_members_ai on public.task_members;
drop trigger if exists task_members_ad on public.task_members;
create trigger task_members_bi before insert on public.task_members for each row execute function private.members_before_insert();
create trigger task_members_ai after insert on public.task_members for each row execute function private.members_after_insert();
create trigger task_members_ad after delete on public.task_members for each row execute function private.members_after_delete();

drop trigger if exists task_checklist_bi on public.task_checklist;
drop trigger if exists task_checklist_bu on public.task_checklist;
drop trigger if exists task_checklist_au on public.task_checklist;
create trigger task_checklist_bi before insert on public.task_checklist for each row execute function private.checklist_before_insert();
create trigger task_checklist_bu before update on public.task_checklist for each row execute function private.checklist_before_update();
create trigger task_checklist_au after update on public.task_checklist for each row execute function private.checklist_after_update();

drop trigger if exists task_updates_bi on public.task_updates;
drop trigger if exists task_updates_ai on public.task_updates;
create trigger task_updates_bi before insert on public.task_updates for each row execute function private.updates_before_insert();
create trigger task_updates_ai after insert on public.task_updates for each row execute function private.updates_after_insert();

-- ---------- 6) row rules (RLS) ----------
alter table public.tasks enable row level security;
alter table public.task_members enable row level security;
alter table public.task_checklist enable row level security;
alter table public.task_updates enable row level security;
alter table public.task_activity enable row level security;
alter table public.notifications enable row level security;

-- table grants: signed-in users only; visitors (anon) get nothing. Hard deletes only on members/checklist.
revoke all on public.tasks, public.task_members, public.task_checklist, public.task_updates, public.task_activity, public.notifications from anon;
revoke all on public.tasks, public.task_members, public.task_checklist, public.task_updates, public.task_activity, public.notifications from authenticated;
grant select, insert, update on public.tasks to authenticated;
grant select, insert, delete on public.task_members to authenticated;
grant select, insert, update, delete on public.task_checklist to authenticated;
grant select, insert on public.task_updates to authenticated;
grant select on public.task_activity to authenticated;
grant select on public.notifications to authenticated;
grant update (read) on public.notifications to authenticated;   -- people can only mark their own as read

drop policy if exists tasks_read on public.tasks;
drop policy if exists tasks_insert on public.tasks;
drop policy if exists tasks_update on public.tasks;
-- written inline (no lookup of tasks itself) so a brand-new row can be returned to the person who made it
create policy tasks_read on public.tasks for select to authenticated using (
  private.is_manager()
  or (deleted_at is null and private.is_staff() and (created_by = auth.uid() or private.is_task_member(id))));
create policy tasks_insert on public.tasks for insert to authenticated with check (
  private.is_staff() and created_by = auth.uid() and deleted_at is null);
-- the before-update trigger decides who may delete/restore/edit; this decides who may touch the row at all
create policy tasks_update on public.tasks for update to authenticated
  using (private.is_manager() or (deleted_at is null and private.is_staff() and (created_by = auth.uid() or private.is_task_member(id))))
  with check (private.is_manager() or (private.is_staff() and (created_by = auth.uid() or private.is_task_member(id))));

drop policy if exists task_members_read on public.task_members;
drop policy if exists task_members_insert on public.task_members;
drop policy if exists task_members_delete on public.task_members;
create policy task_members_read on public.task_members for select to authenticated using (private.can_see_task(task_id));
create policy task_members_insert on public.task_members for insert to authenticated with check (private.can_manage_task(task_id));
create policy task_members_delete on public.task_members for delete to authenticated using (private.can_manage_task(task_id));

drop policy if exists task_checklist_read on public.task_checklist;
drop policy if exists task_checklist_insert on public.task_checklist;
drop policy if exists task_checklist_update on public.task_checklist;
drop policy if exists task_checklist_delete on public.task_checklist;
create policy task_checklist_read on public.task_checklist for select to authenticated using (private.can_see_task(task_id));
create policy task_checklist_insert on public.task_checklist for insert to authenticated with check (private.can_work_task(task_id));
create policy task_checklist_update on public.task_checklist for update to authenticated using (private.can_work_task(task_id)) with check (private.can_work_task(task_id));
create policy task_checklist_delete on public.task_checklist for delete to authenticated using (private.can_manage_task(task_id));

drop policy if exists task_updates_read on public.task_updates;
drop policy if exists task_updates_insert on public.task_updates;
create policy task_updates_read on public.task_updates for select to authenticated using (private.can_see_task(task_id));
create policy task_updates_insert on public.task_updates for insert to authenticated with check (user_id = auth.uid() and private.can_work_task(task_id));

drop policy if exists task_activity_read on public.task_activity;
create policy task_activity_read on public.task_activity for select to authenticated using (private.can_see_task(task_id));

drop policy if exists notifications_own_read on public.notifications;
drop policy if exists notifications_own_update on public.notifications;
create policy notifications_own_read on public.notifications for select to authenticated using (user_id = auth.uid() and private.is_staff());
create policy notifications_own_update on public.notifications for update to authenticated
  using (user_id = auth.uid() and private.is_staff()) with check (user_id = auth.uid());

-- ---------- 7) indexes ----------
create index if not exists tasks_live_status_idx on public.tasks (status) where deleted_at is null;
create index if not exists tasks_created_by_idx on public.tasks (created_by);
create index if not exists tasks_due_idx on public.tasks (due_date) where deleted_at is null;
create index if not exists tasks_deleted_idx on public.tasks (deleted_at desc) where deleted_at is not null;
create index if not exists task_members_user_idx on public.task_members (user_id);
create index if not exists task_checklist_task_idx on public.task_checklist (task_id, position);
create index if not exists task_updates_task_idx on public.task_updates (task_id, created_at desc);
create index if not exists task_activity_task_idx on public.task_activity (task_id, created_at desc);
create index if not exists notifications_user_idx on public.notifications (user_id, read, created_at desc);
create index if not exists staff_email_idx on public.staff (lower(email));

-- ---------- 8) make Lynelle the admin (run ONCE by hand after her login exists; fill in her email) ----------
-- insert into public.staff (user_id, full_name, role, email, active, must_change_password)
-- select id, 'Lynelle', 'admin', email, true, false from auth.users where lower(email) = lower('LYNELLE_EMAIL_HERE')
-- on conflict (user_id) do update set role = 'admin', active = true, email = excluded.email;

-- Audit fix F10: the activity owner-update rule also requires an active staff account.
drop policy if exists activity_own_update on public.activity_log;
create policy activity_own_update on public.activity_log for update to authenticated
  using (private.is_staff() and user_id = auth.uid()) with check (private.is_staff() and user_id = auth.uid());
