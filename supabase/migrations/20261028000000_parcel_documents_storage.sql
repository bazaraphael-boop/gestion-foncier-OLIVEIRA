-- ════════════════════════════════════════════════════════════════
-- Documents des parcelles (titre de concession, contrat, plan cadastral, PV de bornage…)
--
-- À exécuter dans Supabase : SQL Editor → New query → Run. Ré-exécutable sans risque.
-- Espace privé « parcel-documents » : PDF, images, Word et Excel, 15 Mo par fichier.
-- L'admin et les arpenteurs consultent et ajoutent ; seul l'admin supprime.
-- La parcelle garde seulement la liste des fichiers (properties.documents).
-- ════════════════════════════════════════════════════════════════

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'parcel-documents',
  'parcel-documents',
  false,
  15728640,
  array[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ]
)
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "parcel_documents_select" on storage.objects;
create policy "parcel_documents_select" on storage.objects
  for select to authenticated
  using (bucket_id = 'parcel-documents' and public.app_role() in ('admin', 'arpenteur'));

drop policy if exists "parcel_documents_insert" on storage.objects;
create policy "parcel_documents_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'parcel-documents' and public.app_role() in ('admin', 'arpenteur'));

drop policy if exists "parcel_documents_delete" on storage.objects;
create policy "parcel_documents_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'parcel-documents' and public.app_role() = 'admin');

-- Vérification : les 2 lignes doivent indiquer OK
select 'Espace documents parcel-documents' as verification,
       case when exists (select 1 from storage.buckets where id = 'parcel-documents' and public = false) then 'OK' else 'MANQUANT' end as resultat
union all
select 'Règles d''accès aux documents',
       case when (select count(*) from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname like 'parcel_documents_%') = 3
            then 'OK' else 'INCOMPLET' end;
