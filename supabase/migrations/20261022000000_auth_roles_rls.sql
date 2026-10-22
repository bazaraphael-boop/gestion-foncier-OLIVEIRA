-- ════════════════════════════════════════════════════════════════
-- Authentification Supabase + rôles + règles RLS
-- Concession Manuel Joaquim d'Oliveira — Cadastre Numérique
--
-- À exécuter une seule fois dans Supabase : SQL Editor → New query → Run.
-- Le script est ré-exécutable (idempotent).
--
-- Rôles :
--   admin      lecture + création + modification + suppression, périmètre de la concession
--   arpenteur  lecture + création + modification (pas de suppression, pas de concession)
--   client     lecture seule
-- Un utilisateur sans ligne dans public.profiles n'a accès à rien.
-- ════════════════════════════════════════════════════════════════

-- ─── 1. Profils et rôles ────────────────────────────────────────
create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  role        text not null check (role in ('admin', 'arpenteur', 'client')),
  full_name   text,
  created_at  timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Rôle de l'utilisateur courant (security definer : contourne la RLS de profiles
-- pour éviter une récursion dans les politiques).
create or replace function public.app_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid()
$$;

revoke all on function public.app_role() from public, anon;
grant execute on function public.app_role() to authenticated;

drop policy if exists "profiles_select_own_or_admin" on public.profiles;
create policy "profiles_select_own_or_admin" on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.app_role() = 'admin');

-- Aucune politique INSERT/UPDATE/DELETE : un utilisateur ne peut pas
-- changer son propre rôle. Les rôles se gèrent dans le SQL Editor.
revoke all on public.profiles from anon;

-- ─── 2. Table parcels ───────────────────────────────────────────
alter table public.parcels enable row level security;

-- Supprime les éventuelles anciennes politiques ouvertes
do $$
declare p record;
begin
  for p in select policyname from pg_policies where schemaname = 'public' and tablename = 'parcels' loop
    execute format('drop policy %I on public.parcels', p.policyname);
  end loop;
end $$;

-- Lecture : tout utilisateur connecté ayant un rôle
create policy "parcels_select_roles" on public.parcels
  for select to authenticated
  using (public.app_role() in ('admin', 'arpenteur', 'client'));

-- Création : admin et arpenteur ; le périmètre de la concession reste réservé à l'admin
create policy "parcels_insert_staff" on public.parcels
  for insert to authenticated
  with check (
    public.app_role() = 'admin'
    or (public.app_role() = 'arpenteur' and id <> '__concession_boundary__')
  );

-- Modification : idem
create policy "parcels_update_staff" on public.parcels
  for update to authenticated
  using (
    public.app_role() = 'admin'
    or (public.app_role() = 'arpenteur' and id <> '__concession_boundary__')
  )
  with check (
    public.app_role() = 'admin'
    or (public.app_role() = 'arpenteur' and id <> '__concession_boundary__')
  );

-- Suppression : admin uniquement
create policy "parcels_delete_admin" on public.parcels
  for delete to authenticated
  using (public.app_role() = 'admin');

-- Les visiteurs anonymes n'ont plus aucun droit direct sur la table
revoke all on public.parcels from anon;

-- Table de secours « concession » (si elle existe) : mêmes principes
do $$
begin
  if to_regclass('public.concession') is not null then
    execute 'alter table public.concession enable row level security';
    execute 'drop policy if exists "concession_select_roles" on public.concession';
    execute 'drop policy if exists "concession_write_admin" on public.concession';
    execute $p$create policy "concession_select_roles" on public.concession
      for select to authenticated using (public.app_role() in ('admin', 'arpenteur', 'client'))$p$;
    execute $p$create policy "concession_write_admin" on public.concession
      for all to authenticated using (public.app_role() = 'admin') with check (public.app_role() = 'admin')$p$;
    execute 'revoke all on public.concession from anon';
  end if;
end $$;

-- ─── 3. Journal d'audit (insertion seule) ───────────────────────
create table if not exists public.audit_logs (
  id            text primary key,
  timestamp     timestamptz not null default now(),
  user_id       uuid not null default auth.uid() references auth.users (id),
  role          text,
  actor         text,
  action        text not null,
  action_label  text,
  target        text,
  details       text,
  severity      text,
  device        text
);

alter table public.audit_logs enable row level security;

drop policy if exists "audit_insert_own" on public.audit_logs;
create policy "audit_insert_own" on public.audit_logs
  for insert to authenticated
  with check (user_id = auth.uid() and public.app_role() is not null);

drop policy if exists "audit_select_admin" on public.audit_logs;
create policy "audit_select_admin" on public.audit_logs
  for select to authenticated
  using (public.app_role() = 'admin');

-- Pas de politique UPDATE/DELETE : le journal ne peut être ni modifié ni effacé
-- depuis l'application.
revoke all on public.audit_logs from anon;

-- ─── 4. Changement du code PIN du compte client partagé (admin) ─
-- Le portail client se connecte à un compte Supabase de rôle « client »
-- dont le mot de passe est le code PIN à 6 chiffres.
create or replace function public.admin_set_client_pin(client_email text, new_pin text)
returns void
language plpgsql
security definer
set search_path = public, extensions, auth
as $$
declare target uuid;
begin
  if public.app_role() is distinct from 'admin' then
    raise exception 'Réservé à l''administrateur' using errcode = '42501';
  end if;
  if new_pin !~ '^[0-9]{6}$' then
    raise exception 'Le code PIN doit comporter exactement 6 chiffres';
  end if;

  select u.id into target
  from auth.users u
  join public.profiles p on p.id = u.id
  where lower(u.email) = lower(client_email) and p.role = 'client';

  if target is null then
    raise exception 'Compte client introuvable : %', client_email;
  end if;

  update auth.users
  set encrypted_password = extensions.crypt(new_pin, extensions.gen_salt('bf')),
      updated_at = now()
  where id = target;
end;
$$;

revoke all on function public.admin_set_client_pin(text, text) from public, anon;
grant execute on function public.admin_set_client_pin(text, text) to authenticated;

-- ─── 5. Attribution des rôles (à adapter puis exécuter) ─────────
-- Créez d'abord les comptes dans Authentication → Users → Add user
-- (cochez « Auto Confirm User »), puis :
--
-- insert into public.profiles (id, role, full_name)
-- select id, 'admin', 'Administrateur' from auth.users where email = 'VOTRE_EMAIL_ADMIN'
-- on conflict (id) do update set role = excluded.role;
--
-- insert into public.profiles (id, role, full_name)
-- select id, 'arpenteur', 'Arpenteur Géomètre' from auth.users where email = 'EMAIL_ARPENTEUR'
-- on conflict (id) do update set role = excluded.role;
--
-- insert into public.profiles (id, role, full_name)
-- select id, 'client', 'Portail client' from auth.users where email = 'client@oliveira.cd'
-- on conflict (id) do update set role = excluded.role;
