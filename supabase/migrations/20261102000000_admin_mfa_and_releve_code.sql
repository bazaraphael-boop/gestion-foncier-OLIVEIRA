-- ════════════════════════════════════════════════════════════════
-- Double vérification de l'administrateur + code imprimé des relevés
--
-- À exécuter dans Supabase : SQL Editor → New query → Run. Ré-exécutable.
-- À lancer après 20261101000000_attack_simulation_fixes.sql. Ne modifie aucune parcelle.
--
-- 1. Dès qu'un administrateur a activé la double vérification, son mot de passe seul ne donne
--    plus aucun droit : le serveur exige aussi le code à 6 chiffres de son téléphone.
-- 2. Chaque relevé reçoit un code court à taper sur le site officiel (VERIF-XXXXX-XXXXX).
--
-- Téléphone perdu : voir « Double vérification » dans supabase/README.md.
-- ════════════════════════════════════════════════════════════════

-- Arrête le script tout de suite si cette table n'est pas lisible
select count(*) as facteurs_actuels from auth.mfa_factors;

-- ─── 1. Rôle effectif ───────────────────────────────────────────
create or replace function public.app_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select p.role
  from public.profiles p
  where p.id = auth.uid()
    and not (
      p.role = 'admin'
      and coalesce(auth.jwt() ->> 'aal', 'aal1') <> 'aal2'
      and exists (select 1 from auth.mfa_factors f where f.user_id = p.id and f.status = 'verified')
    )
$$;

revoke all on function public.app_role() from public, anon;
grant execute on function public.app_role() to authenticated;

-- ─── 2. Code court des relevés ──────────────────────────────────
-- 10 caractères parmi 32 (sans I, O, 0, 1, faciles à confondre)
create or replace function public.new_releve_code()
returns text
language plpgsql
volatile
set search_path = public
as $$
declare
  alphabet constant text := '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  bytes bytea := uuid_send(gen_random_uuid());
  positions constant int[] := array[0, 1, 2, 3, 4, 5, 9, 10, 11, 12];
  chars text := '';
  pos int;
begin
  foreach pos in array positions loop
    chars := chars || substr(alphabet, (get_byte(bytes, pos) % 32) + 1, 1);
  end loop;
  return 'VERIF-' || substr(chars, 1, 5) || '-' || substr(chars, 6, 5);
end;
$$;

alter table public.releves add column if not exists code text;
update public.releves set code = public.new_releve_code() where code is null;
alter table public.releves alter column code set default public.new_releve_code();
alter table public.releves alter column code set not null;
create unique index if not exists releves_code_key on public.releves (code);

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
  return jsonb_build_object(
    'token', rec.token,
    'code', rec.code,
    'fingerprint', rec.fingerprint,
    'issued_on', to_char(rec.issued_on, 'DD/MM/YYYY')
  );
end;
$$;

-- Vérification publique par le code imprimé (tirets, espaces et minuscules acceptés)
create or replace function public.verify_releve_code(p_code text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  cleaned text := regexp_replace(upper(coalesce(p_code, '')), '[^A-Z0-9]', '', 'g');
  v_token uuid;
begin
  cleaned := regexp_replace(cleaned, '^VERIF', '');
  if length(cleaned) <> 10 then
    return jsonb_build_object('status', 'unknown');
  end if;
  select token into v_token from public.releves
  where code = 'VERIF-' || substr(cleaned, 1, 5) || '-' || substr(cleaned, 6, 5);
  if not found then
    return jsonb_build_object('status', 'unknown');
  end if;
  return public.verify_releve(v_token);
end;
$$;

revoke all on function public.new_releve_code() from public, anon, authenticated;
revoke all on function public.verify_releve_code(text) from public;
grant execute on function public.verify_releve_code(text) to anon, authenticated;

-- Vérification : doit afficher « OK »
select case when exists (select 1 from pg_proc where proname = 'verify_releve_code')
             and not exists (select 1 from public.releves where code is null)
            then 'OK : double vérification et codes de relevé prêts' else 'INCOMPLET' end as verification;
