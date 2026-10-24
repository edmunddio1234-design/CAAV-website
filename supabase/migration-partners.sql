-- =====================================================================================================
-- BLOCK 4 (added 2026-10-24, APPLIED 2026-10-24 to ykdyzsoukftzyfxfchoe): partners + the resources they offer and deliver.
-- Project: southern-xr-jags (ykdyzsoukftzyfxfchoe). Apply only after Sonny's OK, AFTER Blocks 1, 2 and 3
-- (it uses public.staff.active and private.is_staff() / private.is_manager() from Block 3).
--
-- Written for a FIRST apply through a tool that refuses destructive statements: there is no "drop" anywhere.
-- Tables and indexes use "if not exists", functions use "create or replace", triggers use
-- "create or replace trigger" (Postgres 14+), and each policy is only created if it is not there yet.
-- So running it a second time changes nothing and does not fail. Note: because policies are never dropped,
-- a CHANGED policy in a later edit of this file would NOT replace the live one; that needs its own block.
--
-- Plain words:
--   * Everyone with an active staff login can READ partners and their resources.
--   * Managers (admin, leadership) can add, change and remove.
--   * Student leads can add and change, but not remove.
--   * Students can only read. Visitors (not signed in) get nothing.
--   * Every potential partner must sign an NDA and gets an MOU: nda_status / mou_status are tracked
--     separately, each with its signed-on date. When a status is set to signed with no date, today is used.
--   * "Value delivered" on the dashboard = the sum of value_usd on resources marked deployed.
-- All rule functions live in schema "private", are security definer and pin search_path.
-- =====================================================================================================

create schema if not exists private;
grant usage on schema private to authenticated;

-- ---------- 1) rule function: who may add and change partner records ----------
create or replace function private.can_edit_partners() returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (select 1 from public.staff where user_id = auth.uid() and active and role in ('admin','leadership','student_lead'));
$$;
revoke all on function private.can_edit_partners() from public, anon;
grant execute on function private.can_edit_partners() to authenticated;

-- ---------- 2) tables ----------
create table if not exists public.partners (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  name text not null check (char_length(btrim(name)) between 1 and 200),
  kind text not null check (kind in ('resource','sponsor','program')),
  contact_name text check (contact_name is null or char_length(contact_name) <= 200),
  contact_email text check (contact_email is null or char_length(contact_email) <= 320),
  notes text check (notes is null or char_length(notes) <= 4000),
  -- every potential partner signs an NDA and gets an MOU, tracked separately
  nda_status text not null default 'not_started' check (nda_status in ('not_started','drafted','sent','signed')),
  nda_signed_on date,
  mou_status text not null default 'not_started' check (mou_status in ('not_started','drafted','sent','signed')),
  mou_signed_on date,
  -- optional extra agreement (MOA, sponsor agreement, other) with its own status
  other_agreement text not null default 'none' check (other_agreement in ('none','moa','sponsor_agreement','other')),
  other_agreement_status text not null default 'not_started' check (other_agreement_status in ('not_started','drafted','sent','signed')),
  created_by uuid default auth.uid() references public.staff(user_id) on delete set null
);

create table if not exists public.partner_resources (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partners(id) on delete cascade,
  created_at timestamptz not null default now(),
  what_offered text not null check (char_length(btrim(what_offered)) between 1 and 500),
  what_delivered text check (what_delivered is null or char_length(what_delivered) <= 500),
  value_usd numeric(12,2) check (value_usd is null or value_usd >= 0),
  date_offered date,
  date_deployed date,
  status text not null default 'offered' check (status in ('offered','confirmed','deployed','declined')),
  notes text check (notes is null or char_length(notes) <= 2000),
  created_by uuid default auth.uid() references public.staff(user_id) on delete set null,
  constraint partner_resources_dates check (date_deployed is null or date_offered is null or date_deployed >= date_offered)
);

-- ---------- 3) triggers: who made it is always the signed-in person; updated_at keeps itself current ----------
create or replace function private.partners_before_write() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if tg_op = 'INSERT' then
    new.created_by := auth.uid(); new.created_at := now(); new.updated_at := now();
  else
    new.id := old.id; new.created_by := old.created_by; new.created_at := old.created_at; new.updated_at := now();
  end if;
  if new.nda_status = 'signed' and new.nda_signed_on is null then new.nda_signed_on := current_date; end if;
  if new.mou_status = 'signed' and new.mou_signed_on is null then new.mou_signed_on := current_date; end if;
  if new.nda_status <> 'signed' then new.nda_signed_on := null; end if;   -- audit F2
  if new.mou_status <> 'signed' then new.mou_signed_on := null; end if;
  return new;
end $$;

create or replace function private.partner_resources_before_write() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if tg_op = 'INSERT' then
    new.created_by := auth.uid(); new.created_at := now();
  else
    new.id := old.id; new.partner_id := old.partner_id; new.created_by := old.created_by; new.created_at := old.created_at;
  end if;
  return new;
end $$;
revoke all on function private.partners_before_write(), private.partner_resources_before_write() from public, anon, authenticated;

create or replace trigger partners_bw before insert or update on public.partners
  for each row execute function private.partners_before_write();
create or replace trigger partner_resources_bw before insert or update on public.partner_resources
  for each row execute function private.partner_resources_before_write();

-- ---------- 4) row rules (RLS) ----------
alter table public.partners enable row level security;
alter table public.partner_resources enable row level security;

-- table grants: signed-in users only; visitors (anon) get nothing. The policies below narrow it further.
revoke all on public.partners, public.partner_resources from anon;
revoke all on public.partners, public.partner_resources from authenticated;
grant select, insert, update, delete on public.partners, public.partner_resources to authenticated;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'partners' and policyname = 'partners_read') then
    create policy partners_read on public.partners for select to authenticated using (private.is_staff());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'partners' and policyname = 'partners_insert') then
    create policy partners_insert on public.partners for insert to authenticated with check (private.can_edit_partners());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'partners' and policyname = 'partners_update') then
    create policy partners_update on public.partners for update to authenticated using (private.can_edit_partners()) with check (private.can_edit_partners());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'partners' and policyname = 'partners_delete') then
    create policy partners_delete on public.partners for delete to authenticated using (private.is_manager());
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'partner_resources' and policyname = 'partner_resources_read') then
    create policy partner_resources_read on public.partner_resources for select to authenticated using (private.is_staff());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'partner_resources' and policyname = 'partner_resources_insert') then
    create policy partner_resources_insert on public.partner_resources for insert to authenticated with check (private.can_edit_partners());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'partner_resources' and policyname = 'partner_resources_update') then
    create policy partner_resources_update on public.partner_resources for update to authenticated using (private.can_edit_partners()) with check (private.can_edit_partners());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'partner_resources' and policyname = 'partner_resources_delete') then
    create policy partner_resources_delete on public.partner_resources for delete to authenticated using (private.is_manager());
  end if;
end $$;

-- ---------- 5) indexes ----------
create index if not exists partners_kind_idx on public.partners (kind);
create index if not exists partners_name_idx on public.partners (lower(name));
create index if not exists partners_nda_open_idx on public.partners (nda_status) where nda_status <> 'signed';
create index if not exists partner_resources_partner_idx on public.partner_resources (partner_id, date_offered);
create index if not exists partner_resources_status_idx on public.partner_resources (status);
