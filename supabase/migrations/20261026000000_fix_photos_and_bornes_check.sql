-- ════════════════════════════════════════════════════════════════
-- Correctif : enregistrement des photos refusé
--
-- À exécuter dans Supabase : SQL Editor → New query → Run. Ré-exécutable sans risque.
-- 1. (Re)crée l'espace privé « parcel-photos » et ses règles d'accès.
-- 2. Rend la protection des bornes compatible avec une colonne geometry de type json
--    (la comparaison json échouait et bloquait toute modification de parcelle).
-- 3. Affiche un diagnostic : chaque ligne doit indiquer OK.
-- ════════════════════════════════════════════════════════════════

-- 1. Espace de stockage des photos ───────────────────────────────
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

-- 2. Protection des bornes : comparaison en texte (fonctionne avec json et jsonb) ─
create or replace function public.parcels_bornes_admin_only()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null
     and public.app_role() is distinct from 'admin'
     and new.geometry::text is distinct from old.geometry::text then
    raise exception 'Seul l''administrateur peut modifier les bornes d''une parcelle'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

-- 3. Diagnostic ──────────────────────────────────────────────────
select 'Espace photos parcel-photos' as verification,
       case when exists (select 1 from storage.buckets where id = 'parcel-photos' and public = false) then 'OK' else 'MANQUANT' end as resultat
union all
select 'Règles d''accès aux photos',
       case when (select count(*) from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname like 'parcel_photos_%') = 3
            then 'OK' else 'INCOMPLET' end
union all
select 'Fonction des rôles (app_role)',
       case when exists (select 1 from pg_proc where proname = 'app_role') then 'OK' else 'MANQUANTE : lancer 20261022000000_auth_roles_rls.sql' end
union all
select 'Type de la colonne geometry',
       coalesce((select data_type from information_schema.columns where table_schema = 'public' and table_name = 'parcels' and column_name = 'geometry'), 'colonne absente')
union all
select 'Type de la colonne properties',
       coalesce((select data_type from information_schema.columns where table_schema = 'public' and table_name = 'parcels' and column_name = 'properties'), 'colonne absente')
union all
select 'Comptes et rôles',
       coalesce((select string_agg(u.email || ' = ' || p.role, ', ') from public.profiles p join auth.users u on u.id = p.id), 'AUCUN RÔLE ATTRIBUÉ');
