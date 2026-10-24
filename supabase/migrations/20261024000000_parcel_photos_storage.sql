-- ════════════════════════════════════════════════════════════════
-- Photos des parcelles (Supabase Storage)
--
-- À exécuter une seule fois dans Supabase : SQL Editor → New query → Run.
-- Ré-exécutable. Nécessite la migration 20261022000000 (fonction public.app_role()).
--
-- Espace privé « parcel-photos » : les photos ne sont visibles que par les comptes
-- connectés admin et arpenteur (liens temporaires générés par l'application).
--   admin      voir, ajouter, supprimer
--   arpenteur  voir, ajouter
-- ════════════════════════════════════════════════════════════════

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('parcel-photos', 'parcel-photos', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "parcel_photos_select" on storage.objects;
create policy "parcel_photos_select" on storage.objects
  for select to authenticated
  using (bucket_id = 'parcel-photos' and public.app_role() in ('admin', 'arpenteur'));

drop policy if exists "parcel_photos_insert" on storage.objects;
create policy "parcel_photos_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'parcel-photos' and public.app_role() in ('admin', 'arpenteur'));

drop policy if exists "parcel_photos_delete" on storage.objects;
create policy "parcel_photos_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'parcel-photos' and public.app_role() = 'admin');

-- Vérification : l'espace doit apparaître avec public = false
select id, public, file_size_limit from storage.buckets where id = 'parcel-photos';
