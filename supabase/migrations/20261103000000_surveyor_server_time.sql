-- ════════════════════════════════════════════════════════════════
-- Suivi des arpenteurs : l'heure de mise à jour vient du serveur
--
-- À exécuter dans Supabase : SQL Editor → New query → Run. Ré-exécutable.
-- Un téléphone mal réglé (date ou heure fausse) faisait apparaître l'arpenteur « hors ligne ».
-- ════════════════════════════════════════════════════════════════

create or replace function public.surveyor_locations_server_time()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function public.surveyor_locations_server_time() from public, anon;

drop trigger if exists surveyor_locations_server_time on public.surveyor_locations;
create trigger surveyor_locations_server_time
  before insert or update on public.surveyor_locations
  for each row execute function public.surveyor_locations_server_time();

select 'OK : heure du serveur active' as verification;
