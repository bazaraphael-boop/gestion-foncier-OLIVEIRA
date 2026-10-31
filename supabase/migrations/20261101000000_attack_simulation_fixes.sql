-- ════════════════════════════════════════════════════════════════
-- Corrections après simulation d'attaque
--
-- À exécuter dans Supabase : SQL Editor → New query → Run. Ré-exécutable.
-- Ne modifie aucune parcelle existante. À lancer après 20261031000000_releve_verification.sql.
--
-- 1. Une parcelle piégée (bornes invalides, données trop lourdes) est refusée : elle pouvait
--    faire planter l'application chez tout le monde.
-- 2. Positions GPS : valeurs impossibles refusées.
-- 3. Seul l'administrateur émet un relevé vérifiable : un arpenteur pouvait obtenir un relevé
--    « authentique » après avoir changé le propriétaire.
-- 4. Journal d'audit : les insertions sans utilisateur connecté (SQL Editor) refonctionnent.
-- 5. Le rôle anonyme perd les droits inutiles, aussi sur les futures tables.
-- ════════════════════════════════════════════════════════════════

-- ─── 1. Forme d'une parcelle ────────────────────────────────────
create or replace function public.parcels_validate_row()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  geom jsonb := new.geometry::jsonb;
  props jsonb := new.properties::jsonb;
  ring jsonb;
  pt jsonb;
  item jsonb;
  field text;
begin
  -- Le périmètre de la concession a sa propre forme ; SQL Editor sans restriction
  if new.id = '__concession_boundary__' or auth.uid() is null then
    return new;
  end if;

  if length(new.id) > 200 then
    raise exception 'Identifiant de parcelle trop long' using errcode = '22023';
  end if;
  if pg_column_size(new.properties) > 1048576 or pg_column_size(new.geometry) > 1048576 then
    raise exception 'Parcelle trop volumineuse' using errcode = '22023';
  end if;

  if jsonb_typeof(geom) is distinct from 'object' or geom ->> 'type' is distinct from 'Polygon'
     or jsonb_typeof(geom -> 'coordinates') is distinct from 'array'
     or jsonb_typeof(geom -> 'coordinates' -> 0) is distinct from 'array' then
    raise exception 'Bornes de parcelle invalides' using errcode = '22023';
  end if;
  ring := geom -> 'coordinates' -> 0;
  if jsonb_array_length(ring) not between 3 and 5000 then
    raise exception 'Nombre de bornes invalide' using errcode = '22023';
  end if;
  for pt in select value from jsonb_array_elements(ring) loop
    if jsonb_typeof(pt) is distinct from 'array'
       or jsonb_typeof(pt -> 0) is distinct from 'number'
       or jsonb_typeof(pt -> 1) is distinct from 'number'
       or abs((pt ->> 0)::numeric) > 180
       or abs((pt ->> 1)::numeric) > 90 then
      raise exception 'Coordonnées de borne invalides' using errcode = '22023';
    end if;
  end loop;

  if jsonb_typeof(props) is distinct from 'object' then
    raise exception 'Fiche de parcelle invalide' using errcode = '22023';
  end if;
  foreach field in array array['lotNumber', 'occupantName', 'notes', 'status', 'formattedHa', 'formattedSqM', 'releveIssuedOn'] loop
    if props ? field and jsonb_typeof(props -> field) not in ('string', 'null') then
      raise exception 'Champ % invalide', field using errcode = '22023';
    end if;
  end loop;
  foreach field in array array['photos', 'documents'] loop
    if props ? field then
      if jsonb_typeof(props -> field) is distinct from 'array' then
        raise exception 'Liste % invalide', field using errcode = '22023';
      end if;
      for item in select value from jsonb_array_elements(props -> field) loop
        if jsonb_typeof(item -> 'path') is distinct from 'string' then
          raise exception 'Élément de % invalide', field using errcode = '22023';
        end if;
        if jsonb_typeof(item -> 'location') = 'object'
           and (jsonb_typeof(item -> 'location' -> 'lat') is distinct from 'number'
                or jsonb_typeof(item -> 'location' -> 'lng') is distinct from 'number') then
          raise exception 'Position de photo invalide' using errcode = '22023';
        end if;
      end loop;
    end if;
  end loop;
  return new;
end;
$$;

drop trigger if exists parcels_validate_row on public.parcels;
create trigger parcels_validate_row
  before insert or update on public.parcels
  for each row execute function public.parcels_validate_row();

-- ─── 2. Positions GPS ───────────────────────────────────────────
-- En PostgreSQL, NaN est plus grand que tout nombre : ces contrôles le refusent aussi.
-- « not valid » : seules les nouvelles valeurs sont contrôlées.
alter table public.surveyor_locations drop constraint if exists surveyor_locations_values;
alter table public.surveyor_locations add constraint surveyor_locations_values check (
  lat between -90 and 90 and lng between -180 and 180
  and (accuracy is null or accuracy between 0 and 1000000)
  and (full_name is null or char_length(full_name) <= 120)
) not valid;

alter table public.surveyor_location_points drop constraint if exists surveyor_points_values;
alter table public.surveyor_location_points add constraint surveyor_points_values check (
  lat between -90 and 90 and lng between -180 and 180
  and (accuracy is null or accuracy between 0 and 1000000)
) not valid;

-- ─── 3. Relevé vérifiable : émission par l'administrateur ───────
create or replace function public.issue_releve(p_parcel_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.parcels%rowtype;
  props jsonb;
  geom jsonb;
  v_lot text;
  v_owner text;
  v_date date;
  v_hash text;
  v_fp text;
  m record;
  rec public.releves%rowtype;
begin
  if public.app_role() is distinct from 'admin' then
    raise exception 'Seul l''administrateur peut émettre un relevé vérifiable' using errcode = '42501';
  end if;
  select * into r from public.parcels where id = p_parcel_id and id <> '__concession_boundary__';
  if not found then
    raise exception 'Parcelle introuvable';
  end if;

  props := coalesce(r.properties::jsonb, '{}'::jsonb);
  geom := r.geometry::jsonb;
  v_lot := coalesce(nullif(props ->> 'lotNumber', ''), nullif(r.lot_number, ''), r.id);
  v_owner := coalesce(nullif(props ->> 'occupantName', ''), nullif(r.occupant_name, ''), 'Aucun (domaine libre)');
  if coalesce(props ->> 'releveIssuedOn', '') ~ '^\d{4}-\d{2}-\d{2}$' then
    v_date := (props ->> 'releveIssuedOn')::date;
  else
    v_date := (now() at time zone 'Africa/Kinshasa')::date;
  end if;

  select * into m from public.parcel_measures(geom);
  v_hash := public.parcel_content_hash(v_lot, v_owner, geom);
  v_fp := upper(substr(encode(sha256(convert_to(v_hash || '|' || v_date::text, 'UTF8')), 'hex'), 1, 16));
  v_fp := substr(v_fp, 1, 4) || '-' || substr(v_fp, 5, 4) || '-' || substr(v_fp, 9, 4) || '-' || substr(v_fp, 13, 4);

  insert into public.releves (parcel_id, reference, lot, owner, area_m2, sides, issued_on, fingerprint, content_hash)
  values (r.id, 'RMB-AUTH-' || upper(left(r.id, 10)), v_lot, v_owner, m.area_m2, m.sides, v_date, v_fp, v_hash)
  on conflict (parcel_id, fingerprint) do nothing;

  select * into rec from public.releves where parcel_id = r.id and fingerprint = v_fp;
  return jsonb_build_object('token', rec.token, 'fingerprint', rec.fingerprint, 'issued_on', to_char(rec.issued_on, 'DD/MM/YYYY'));
end;
$$;

-- ─── 4. Journal d'audit ─────────────────────────────────────────
create or replace function public.audit_logs_server_values()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null then
    new.user_id := auth.uid();
    new.role := public.app_role();
    new.timestamp := now();
  end if;
  return new;
end;
$$;

-- ─── 5. Droits du rôle anonyme ──────────────────────────────────
revoke all on public.surveyor_locations, public.surveyor_location_points, public.concession_zones from anon;
revoke all on function public.prune_old_surveyor_points() from public, anon;
revoke all on function public.parcels_bornes_admin_only() from public, anon;
revoke all on function public.parcels_new_lot_no_issue_date() from public, anon;
revoke all on function public.audit_logs_server_values() from public, anon;
revoke all on function public.parcels_validate_row() from public, anon;
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke all on functions from anon;
alter default privileges in schema public revoke all on sequences from anon;

-- Vérification : les parcelles déjà enregistrées qu'il faudrait corriger (0 = aucun souci)
select count(*) as parcelles_a_verifier
from public.parcels
where id <> '__concession_boundary__'
  and (geometry::jsonb ->> 'type' is distinct from 'Polygon'
       or jsonb_typeof(geometry::jsonb -> 'coordinates' -> 0) is distinct from 'array'
       or jsonb_typeof(properties::jsonb) is distinct from 'object');
