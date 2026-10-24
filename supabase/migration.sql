-- !!! BLOCK 1 IS ALREADY APPLIED (2026-10-24). DO NOT RE-RUN THIS WHOLE FILE. !!!
-- Its is_staff() below is the OLD version. migration-tasks.sql (Block 3) replaces it with one that also
-- requires staff.active. Re-running Block 1 after Block 3 would let turned-off staff read leads again.
-- To add uploads, run ONLY the BLOCK 2 section (or migration-uploads.sql), then migration-tasks.sql.
-- Southern University XR Jags / Immersion in Motion: shared lead capture + staff dashboard
-- Project: southern-xr-jags (new). Apply only after Sonny's OK.
create extension if not exists pgcrypto;

create table if not exists public.staff (
  user_id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  role text not null check (role in ('student_lead','student','leadership','admin')),
  created_at timestamptz not null default now()
);

create or replace function private.is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.staff where user_id = auth.uid());
$$;

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  site text not null check (char_length(site) <= 60),
  form text not null check (form in ('tour','sponsor','media','service','contact','launch_rsvp')),
  name text check (char_length(name) <= 200),
  organization text check (char_length(organization) <= 200),
  email text check (char_length(email) <= 200),
  phone text check (char_length(phone) <= 60),
  details jsonb not null default '{}'::jsonb check (pg_column_size(details) < 20000),
  page text check (char_length(page) <= 300),
  status text not null default 'new' check (status in ('new','contacted','scheduled','closed')),
  assigned_to uuid references public.staff(user_id)
);

create table if not exists public.activity_log (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  user_id uuid not null default auth.uid() references public.staff(user_id),
  happened_on date not null default current_date,
  platform text not null check (platform in ('LinkedIn','Instagram','Facebook','TikTok','X','YouTube','Email','Press','Event','Other')),
  kind text not null check (kind in ('Post','Story','Video','Boost','Outreach','Interview','Event','Other')),
  title text not null check (char_length(title) <= 300),
  link text check (char_length(link) <= 500),
  reach integer check (reach >= 0),
  boost_cost numeric(10,2) check (boost_cost >= 0),
  notes text check (char_length(notes) <= 2000)
);

alter table public.staff enable row level security;
alter table public.leads enable row level security;
alter table public.activity_log enable row level security;

-- Public visitors may only add a lead. They can never read leads.
create policy leads_public_insert on public.leads for insert to anon, authenticated
  with check (status = 'new' and assigned_to is null);
create policy leads_staff_read on public.leads for select to authenticated using (private.is_staff());
create policy leads_staff_update on public.leads for update to authenticated using (private.is_staff()) with check (private.is_staff());

create policy staff_read on public.staff for select to authenticated using (private.is_staff());

create policy activity_staff_read on public.activity_log for select to authenticated using (private.is_staff());
create policy activity_staff_insert on public.activity_log for insert to authenticated with check (private.is_staff() and user_id = auth.uid());
create policy activity_own_update on public.activity_log for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create index if not exists leads_created_idx on public.leads (created_at desc);
create index if not exists activity_happened_idx on public.activity_log (happened_on desc);

-- Applied 2026-10-24 to southern-xr-jags (ykdyzsoukftzyfxfchoe): is_staff() lives in schema "private"
-- (not exposed by the API). Use private.is_staff() in any new policy.

-- =====================================================================================================
-- BLOCK 2 (added 2026-10-24, NOT YET APPLIED): staff uploads for the XR Jags dashboard (/dashboard "Uploads").
-- Bio photos, simulation clips, resume/LinkedIn links and summer camp media.
-- Files go to the private Storage bucket "xrjags-uploads"; one row per item goes to public.uploads.
-- Only staff (private.is_staff()) can upload, read, change or remove. Visitors cannot see anything.
-- Apply after review. Safe to re-run: uses "if not exists" / "on conflict" / drop-if-exists for policies.
-- =====================================================================================================

-- 1) Private bucket. 200 MB per file (largest allowed type is a clip); the page also checks 10 MB for photos.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('xrjags-uploads', 'xrjags-uploads', false, 209715200,
        array['image/jpeg','image/png','image/webp','image/heic','image/heif',
              'video/mp4','video/quicktime','video/webm',
              'application/pdf'])
on conflict (id) do update
  set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- 2) Storage rules: staff only, this bucket only.
drop policy if exists xrjags_uploads_staff_read   on storage.objects;
drop policy if exists xrjags_uploads_staff_insert on storage.objects;
drop policy if exists xrjags_uploads_staff_update on storage.objects;
drop policy if exists xrjags_uploads_staff_delete on storage.objects;
create policy xrjags_uploads_staff_read on storage.objects for select to authenticated
  using (bucket_id = 'xrjags-uploads' and private.is_staff());
create policy xrjags_uploads_staff_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'xrjags-uploads' and private.is_staff());
create policy xrjags_uploads_staff_update on storage.objects for update to authenticated
  using (bucket_id = 'xrjags-uploads' and private.is_staff() and owner_id = auth.uid()::text)
  with check (bucket_id = 'xrjags-uploads' and private.is_staff());
create policy xrjags_uploads_staff_delete on storage.objects for delete to authenticated
  using (bucket_id = 'xrjags-uploads' and private.is_staff() and owner_id = auth.uid()::text);

-- 3) Metadata table. A row has a file (file_path in the bucket) or a link (url), or both.
create table if not exists public.uploads (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  user_id uuid not null default auth.uid() references public.staff(user_id),
  kind text not null check (kind in ('photo','clip','link','camp_media','other')),
  title text not null check (char_length(title) between 1 and 300),
  file_path text check (char_length(file_path) <= 500),
  url text check (url is null or (char_length(url) <= 500 and url ~* '^https?://')),
  notes text check (char_length(notes) <= 2000),
  check (file_path is not null or url is not null)
);
alter table public.uploads enable row level security;
drop policy if exists uploads_staff_read   on public.uploads;
drop policy if exists uploads_staff_insert on public.uploads;
drop policy if exists uploads_own_update   on public.uploads;
drop policy if exists uploads_own_delete   on public.uploads;
create policy uploads_staff_read on public.uploads for select to authenticated using (private.is_staff());
create policy uploads_staff_insert on public.uploads for insert to authenticated with check (private.is_staff() and user_id = auth.uid());
create policy uploads_own_update on public.uploads for update to authenticated using (private.is_staff() and user_id = auth.uid()) with check (user_id = auth.uid());
create policy uploads_own_delete on public.uploads for delete to authenticated using (private.is_staff() and user_id = auth.uid());
create index if not exists uploads_created_idx on public.uploads (created_at desc);
