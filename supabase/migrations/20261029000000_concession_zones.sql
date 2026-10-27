-- ════════════════════════════════════════════════════════════════
-- Zones de la concession (Zone ISETECH et les zones ajoutées par l'admin)
--
-- À exécuter dans Supabase : SQL Editor → New query → Run. Ré-exécutable sans risque.
-- Tout le monde (admin, arpenteur, client connecté) voit les zones ; seul l'admin en ajoute,
-- en modifie ou en supprime. Une zone supprimée est seulement masquée (deleted = true) :
-- elle peut être restaurée depuis le Table Editor. La Zone ISETECH est créée par l'app
-- à la première connexion de l'admin.
-- ════════════════════════════════════════════════════════════════

create table if not exists public.concession_zones (
  id text primary key,
  name text not null,
  color text not null default '#0284C7',
  geometry jsonb not null,
  deleted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.concession_zones enable row level security;

drop policy if exists "concession_zones_select" on public.concession_zones;
create policy "concession_zones_select" on public.concession_zones
  for select to authenticated
  using (public.app_role() in ('admin', 'arpenteur', 'client'));

drop policy if exists "concession_zones_insert" on public.concession_zones;
create policy "concession_zones_insert" on public.concession_zones
  for insert to authenticated
  with check (public.app_role() = 'admin');

drop policy if exists "concession_zones_update" on public.concession_zones;
create policy "concession_zones_update" on public.concession_zones
  for update to authenticated
  using (public.app_role() = 'admin')
  with check (public.app_role() = 'admin');

drop policy if exists "concession_zones_delete" on public.concession_zones;
create policy "concession_zones_delete" on public.concession_zones
  for delete to authenticated
  using (public.app_role() = 'admin');

-- Temps réel : une zone ajoutée ou supprimée apparaît chez tout le monde sans recharger
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'concession_zones'
  ) then
    alter publication supabase_realtime add table public.concession_zones;
  end if;
end $$;

-- Vérification : doit afficher concession_zones avec rowsecurity = true
select tablename, rowsecurity from pg_tables where schemaname = 'public' and tablename = 'concession_zones';
