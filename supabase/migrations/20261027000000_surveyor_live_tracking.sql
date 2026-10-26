-- Suivi en temps réel de l'arpenteur pendant que son GPS est activé dans l'app.
-- - surveyor_locations : dernière position connue de chaque arpenteur (une ligne par compte)
-- - surveyor_location_points : trace des déplacements (un point quand il a bougé)
-- Seul l'arpenteur écrit sa propre position ; seul l'admin voit les positions des autres.
-- Idempotent : peut être relancé sans risque.

create table if not exists public.surveyor_locations (
  user_id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  lat double precision not null,
  lng double precision not null,
  accuracy double precision,
  heading double precision,
  speed double precision,
  is_active boolean not null default true,
  updated_at timestamptz not null default now()
);

create table if not exists public.surveyor_location_points (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  lat double precision not null,
  lng double precision not null,
  accuracy double precision,
  recorded_at timestamptz not null default now()
);

create index if not exists surveyor_location_points_user_time_idx
  on public.surveyor_location_points (user_id, recorded_at desc);

alter table public.surveyor_locations enable row level security;
alter table public.surveyor_location_points enable row level security;

-- Dernière position
drop policy if exists "surveyor_locations_select" on public.surveyor_locations;
create policy "surveyor_locations_select" on public.surveyor_locations
  for select to authenticated
  using (user_id = auth.uid() or public.app_role() = 'admin');

drop policy if exists "surveyor_locations_insert" on public.surveyor_locations;
create policy "surveyor_locations_insert" on public.surveyor_locations
  for insert to authenticated
  with check (user_id = auth.uid() and public.app_role() = 'arpenteur');

drop policy if exists "surveyor_locations_update" on public.surveyor_locations;
create policy "surveyor_locations_update" on public.surveyor_locations
  for update to authenticated
  using (user_id = auth.uid() and public.app_role() = 'arpenteur')
  with check (user_id = auth.uid() and public.app_role() = 'arpenteur');

drop policy if exists "surveyor_locations_delete" on public.surveyor_locations;
create policy "surveyor_locations_delete" on public.surveyor_locations
  for delete to authenticated
  using (public.app_role() = 'admin');

-- Trace des déplacements
drop policy if exists "surveyor_points_select" on public.surveyor_location_points;
create policy "surveyor_points_select" on public.surveyor_location_points
  for select to authenticated
  using (user_id = auth.uid() or public.app_role() = 'admin');

drop policy if exists "surveyor_points_insert" on public.surveyor_location_points;
create policy "surveyor_points_insert" on public.surveyor_location_points
  for insert to authenticated
  with check (user_id = auth.uid() and public.app_role() = 'arpenteur');

drop policy if exists "surveyor_points_delete" on public.surveyor_location_points;
create policy "surveyor_points_delete" on public.surveyor_location_points
  for delete to authenticated
  using (public.app_role() = 'admin');

-- Temps réel : l'admin reçoit chaque nouvelle position sans recharger la page
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'surveyor_locations'
  ) then
    alter publication supabase_realtime add table public.surveyor_locations;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'surveyor_location_points'
  ) then
    alter publication supabase_realtime add table public.surveyor_location_points;
  end if;
end $$;

-- Les traces de plus de 30 jours sont supprimées à chaque nouvel envoi (pas de tâche planifiée nécessaire)
create or replace function public.prune_old_surveyor_points()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.surveyor_location_points
  where user_id = new.user_id and recorded_at < now() - interval '30 days';
  return new;
end;
$$;

drop trigger if exists prune_old_surveyor_points on public.surveyor_location_points;
create trigger prune_old_surveyor_points
  after insert on public.surveyor_location_points
  for each row execute function public.prune_old_surveyor_points();

-- Vérification : doit afficher les 2 tables avec rowsecurity = true
select tablename, rowsecurity from pg_tables
where schemaname = 'public' and tablename in ('surveyor_locations', 'surveyor_location_points');
