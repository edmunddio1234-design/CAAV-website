-- =====================================================================================================
-- BLOCK 2 (added 2026-10-24, APPLIED 2026-10-24 to ykdyzsoukftzyfxfchoe): staff uploads for the XR Jags dashboard (/dashboard "Uploads").
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
