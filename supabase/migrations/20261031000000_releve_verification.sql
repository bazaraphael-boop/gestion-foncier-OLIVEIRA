-- ════════════════════════════════════════════════════════════════
-- Vérification en ligne des relevés (QR code)
--
-- À exécuter dans Supabase : SQL Editor → New query → Run. Ré-exécutable.
-- Ne modifie aucune parcelle.
--
-- Chaque relevé émis est inscrit par le serveur dans un registre, avec un jeton impossible à deviner.
-- Le QR code du PDF ouvre une page publique qui interroge ce registre : un faussaire peut modifier
-- un PDF, mais pas le registre. La superficie et les côtés sont recalculés ici à partir des bornes
-- enregistrées (UTM 33S), jamais repris de ce qu'envoie le navigateur.
-- ════════════════════════════════════════════════════════════════

create table if not exists public.releves (
  token         uuid primary key default gen_random_uuid(),
  parcel_id     text not null,
  reference     text not null,
  lot           text not null,
  owner         text not null,
  area_m2       numeric not null,
  sides         jsonb not null,
  issued_on     date not null,
  fingerprint   text not null,
  content_hash  text not null,
  revoked       boolean not null default false,
  issued_by     uuid default auth.uid(),
  created_at    timestamptz not null default now(),
  unique (parcel_id, fingerprint)
);

-- Aucun accès direct pour le public ; l'admin peut consulter le registre
alter table public.releves enable row level security;
revoke all on public.releves from anon, authenticated;
grant select on public.releves to authenticated;
drop policy if exists "releves_select_admin" on public.releves;
create policy "releves_select_admin" on public.releves
  for select to authenticated
  using (public.app_role() = 'admin');

-- [lng, lat] -> UTM zone 33S (série de Krüger, comme src/utils/utm.js)
create or replace function public.utm33s(lng double precision, lat double precision, out x double precision, out y double precision)
language plpgsql
immutable
set search_path = public
as $$
declare
  f constant double precision := 1 / 298.257223563;
  n constant double precision := f / (2 - f);
  big_a constant double precision := (6378137 / (1 + n)) * (1 + n * n / 4 + n ^ 4 / 64);
  phi double precision := radians(lat);
  dl double precision := radians(lng - 15);
  k constant double precision := 2 * sqrt(n) / (1 + n);
  t double precision;
  xi_p double precision;
  eta_p double precision;
  xi double precision;
  eta double precision;
  a1 constant double precision := n / 2 - 2 * n * n / 3 + 5 * n ^ 3 / 16;
  a2 constant double precision := 13 * n * n / 48 - 3 * n ^ 3 / 5;
  a3 constant double precision := 61 * n ^ 3 / 240;
begin
  t := sinh(atanh(sin(phi)) - k * atanh(k * sin(phi)));
  xi_p := atan2(t, cos(dl));
  eta_p := atanh(sin(dl) / sqrt(1 + t * t));
  xi := xi_p + a1 * sin(2 * xi_p) * cosh(2 * eta_p) + a2 * sin(4 * xi_p) * cosh(4 * eta_p) + a3 * sin(6 * xi_p) * cosh(6 * eta_p);
  eta := eta_p + a1 * cos(2 * xi_p) * sinh(2 * eta_p) + a2 * cos(4 * xi_p) * sinh(4 * eta_p) + a3 * cos(6 * xi_p) * sinh(6 * eta_p);
  x := 500000 + 0.9996 * big_a * eta;
  y := 10000000 + 0.9996 * big_a * xi;
end;
$$;

-- Superficie (m²) et longueur des côtés (m) d'un polygone GeoJSON
create or replace function public.parcel_measures(geom jsonb, out area_m2 numeric, out sides jsonb)
language plpgsql
immutable
set search_path = public
as $$
declare
  ring jsonb := geom -> 'coordinates' -> 0;
  cnt int := jsonb_array_length(ring);
  xs double precision[] := '{}';
  ys double precision[] := '{}';
  p record;
  i int;
  j int;
  s double precision := 0;
begin
  if ring -> 0 = ring -> (cnt - 1) then
    cnt := cnt - 1;
  end if;
  if cnt < 3 then
    raise exception 'Parcelle sans bornes valides';
  end if;
  for i in 0 .. cnt - 1 loop
    select * into p from public.utm33s((ring -> i ->> 0)::double precision, (ring -> i ->> 1)::double precision);
    xs := xs || p.x;
    ys := ys || p.y;
  end loop;
  sides := '[]'::jsonb;
  for i in 1 .. cnt loop
    j := i % cnt + 1;
    s := s + xs[i] * ys[j] - xs[j] * ys[i];
    sides := sides || to_jsonb(round(sqrt((xs[j] - xs[i]) ^ 2 + (ys[j] - ys[i]) ^ 2)::numeric, 1));
  end loop;
  area_m2 := round(abs(s)::numeric / 2);
end;
$$;

-- Lot + propriétaire + bornes : ce qui rend un relevé périmé s'il change
create or replace function public.parcel_content_hash(lot text, owner text, geom jsonb)
returns text
language sql
immutable
set search_path = public
as $$
  select encode(sha256(convert_to(lot || '|' || owner || '|' || geom::text, 'UTF8')), 'hex')
$$;

-- Émission : réservée à l'admin et aux arpenteurs. Même contenu et même date = même jeton.
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
  if public.app_role() is null or public.app_role() not in ('admin', 'arpenteur') then
    raise exception 'Réservé à l''administrateur et aux arpenteurs' using errcode = '42501';
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

-- Vérification publique (page ouverte par le QR code) : uniquement ce qui est imprimé sur le relevé
create or replace function public.verify_releve(p_token uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  rec public.releves%rowtype;
  r public.parcels%rowtype;
  props jsonb;
  v_status text := 'authentic';
begin
  select * into rec from public.releves where token = p_token;
  if not found then
    return jsonb_build_object('status', 'unknown');
  end if;

  select * into r from public.parcels where id = rec.parcel_id;
  if rec.revoked then
    v_status := 'revoked';
  elsif not found then
    v_status := 'outdated';
  else
    props := coalesce(r.properties::jsonb, '{}'::jsonb);
    if public.parcel_content_hash(
         coalesce(nullif(props ->> 'lotNumber', ''), nullif(r.lot_number, ''), r.id),
         coalesce(nullif(props ->> 'occupantName', ''), nullif(r.occupant_name, ''), 'Aucun (domaine libre)'),
         r.geometry::jsonb
       ) <> rec.content_hash then
      v_status := 'outdated';
    end if;
  end if;

  return jsonb_build_object(
    'status', v_status,
    'reference', rec.reference,
    'lot', rec.lot,
    'owner', rec.owner,
    'area_m2', rec.area_m2,
    'sides', rec.sides,
    'issued_on', to_char(rec.issued_on, 'DD/MM/YYYY'),
    'fingerprint', rec.fingerprint
  );
end;
$$;

revoke all on function public.utm33s(double precision, double precision) from public, anon;
revoke all on function public.parcel_measures(jsonb) from public, anon;
revoke all on function public.parcel_content_hash(text, text, jsonb) from public, anon;
revoke all on function public.issue_releve(text) from public, anon;
revoke all on function public.verify_releve(uuid) from public;
grant execute on function public.issue_releve(text) to authenticated;
grant execute on function public.verify_releve(uuid) to anon, authenticated;

-- Pour annuler un relevé : Table Editor → releves → revoked = true

-- Vérification : doit afficher « OK »
select case when exists (select 1 from pg_proc where proname = 'verify_releve')
             and exists (select 1 from pg_tables where tablename = 'releves' and rowsecurity)
            then 'OK : registre des relevés prêt' else 'INCOMPLET' end as verification;
