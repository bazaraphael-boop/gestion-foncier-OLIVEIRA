-- ════════════════════════════════════════════════════════════════
-- Renforcement de la sécurité côté serveur
--
-- À exécuter dans Supabase : SQL Editor → New query → Run. Ré-exécutable.
-- Ne supprime et ne modifie aucune donnée existante.
--
-- 1. Parcelles : même en appelant directement l'API, un arpenteur ne peut plus changer
--    l'identifiant d'un lot, sa date d'émission, ses coordonnées Cadastre,
--    ni retirer une photo ou un document.
-- 2. Journal d'audit : le rôle, l'utilisateur et l'heure sont fixés par le serveur.
-- 3. Diagnostic : liste les tables publiques sans RLS.
-- ════════════════════════════════════════════════════════════════

-- ─── 1. Parcelles : champs réservés à l'administrateur ──────────
create or replace function public.parcels_bornes_admin_only()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  old_props jsonb := coalesce(old.properties::jsonb, '{}'::jsonb);
  new_props jsonb := coalesce(new.properties::jsonb, '{}'::jsonb);
begin
  -- Sans utilisateur connecté (SQL Editor) ou pour l'admin : aucune restriction
  if auth.uid() is null or public.app_role() is not distinct from 'admin' then
    return new;
  end if;

  if new.id is distinct from old.id then
    raise exception 'Seul l''administrateur peut changer l''identifiant d''une parcelle' using errcode = '42501';
  end if;
  if new.geometry::text is distinct from old.geometry::text
     or (new_props -> 'sourceCoordinates') is distinct from (old_props -> 'sourceCoordinates') then
    raise exception 'Seul l''administrateur peut modifier les bornes d''une parcelle' using errcode = '42501';
  end if;
  if (new_props -> 'releveIssuedOn') is distinct from (old_props -> 'releveIssuedOn') then
    raise exception 'Seul l''administrateur peut modifier la date d''émission' using errcode = '42501';
  end if;
  -- Ajouter une photo ou un document reste permis ; en retirer est réservé à l'admin
  if not (coalesce(old_props -> 'photos', '[]'::jsonb) <@ coalesce(new_props -> 'photos', '[]'::jsonb))
     or not (coalesce(old_props -> 'documents', '[]'::jsonb) <@ coalesce(new_props -> 'documents', '[]'::jsonb)) then
    raise exception 'Seul l''administrateur peut retirer une photo ou un document' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists parcels_bornes_admin_only on public.parcels;
create trigger parcels_bornes_admin_only
  before update on public.parcels
  for each row execute function public.parcels_bornes_admin_only();

-- À la création d'un lot, seule l'admin fixe une date d'émission. L'enregistrement de l'app passe
-- par un « upsert » : ce déclencheur s'exécute aussi pour un lot existant, qu'il laisse alors intact.
create or replace function public.parcels_new_lot_no_issue_date()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null
     and public.app_role() is distinct from 'admin'
     and not exists (select 1 from public.parcels p where p.id = new.id) then
    new.properties := new.properties::jsonb - 'releveIssuedOn';
  end if;
  return new;
end;
$$;

drop trigger if exists parcels_new_lot_no_issue_date on public.parcels;
create trigger parcels_new_lot_no_issue_date
  before insert on public.parcels
  for each row execute function public.parcels_new_lot_no_issue_date();

-- ─── 2. Journal d'audit : valeurs fixées par le serveur ─────────
create or replace function public.audit_logs_server_values()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.user_id := auth.uid();
  new.role := public.app_role();
  new.timestamp := now();
  return new;
end;
$$;

drop trigger if exists audit_logs_server_values on public.audit_logs;
create trigger audit_logs_server_values
  before insert on public.audit_logs
  for each row execute function public.audit_logs_server_values();

-- ─── 3. Diagnostic : doit afficher une seule ligne « OK » ───────
select coalesce(
         'TABLE SANS RLS : ' || string_agg(tablename, ', '),
         'OK : toutes les tables publiques ont la RLS activée'
       ) as verification
from pg_tables
where schemaname = 'public' and rowsecurity = false;
