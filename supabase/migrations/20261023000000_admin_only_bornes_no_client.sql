-- ════════════════════════════════════════════════════════════════
-- 1. Bornes des parcelles modifiables uniquement par l'admin
-- 2. Suppression du portail client (rôle « client »)
--
-- À exécuter une seule fois dans Supabase : SQL Editor → New query → Run.
-- Ne supprime aucune parcelle. Ré-exécutable.
-- ════════════════════════════════════════════════════════════════

-- ─── 1. Verrou sur la géométrie (bornes) des parcelles ──────────
-- L'arpenteur peut modifier la fiche (statut, occupant, notes) mais pas
-- les sommets. Les requêtes lancées depuis le SQL Editor (sans utilisateur
-- connecté) ne sont pas bloquées.
create or replace function public.parcels_bornes_admin_only()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null
     and new.geometry is distinct from old.geometry
     and public.app_role() is distinct from 'admin' then
    raise exception 'Seul l''administrateur peut modifier les bornes d''une parcelle'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists parcels_bornes_admin_only on public.parcels;
create trigger parcels_bornes_admin_only
  before update on public.parcels
  for each row execute function public.parcels_bornes_admin_only();

-- ─── 2. Suppression du rôle client ──────────────────────────────
delete from public.profiles where role = 'client';

alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles
  add constraint profiles_role_check check (role in ('admin', 'arpenteur'));

drop policy if exists "parcels_select_roles" on public.parcels;
create policy "parcels_select_roles" on public.parcels
  for select to authenticated
  using (public.app_role() in ('admin', 'arpenteur'));

do $$
begin
  if to_regclass('public.concession') is not null then
    execute 'drop policy if exists "concession_select_roles" on public.concession';
    execute $p$create policy "concession_select_roles" on public.concession
      for select to authenticated using (public.app_role() in ('admin', 'arpenteur'))$p$;
  end if;
end $$;

drop function if exists public.admin_set_client_pin(text, text);

-- Vérification : liste des comptes et de leurs rôles
select u.email, p.role
from auth.users u left join public.profiles p on p.id = u.id
order by u.email;
