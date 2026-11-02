-- ════════════════════════════════════════════════════════════════
-- Plusieurs arpenteurs sur un seul compte (une adresse e-mail)
--
-- À exécuter dans Supabase AVANT de mettre l'app à jour : SQL Editor → New query → Run.
-- Ré-exécutable. Ne supprime aucune donnée. L'ancienne version de l'app continue de fonctionner.
--
-- Chaque téléphone a son propre suivi : la position n'est plus unique par compte, mais par
-- compte + téléphone (device_id).
-- ════════════════════════════════════════════════════════════════

alter table public.surveyor_locations add column if not exists device_id text not null default 'principal';
alter table public.surveyor_location_points add column if not exists device_id text not null default 'principal';

alter table public.surveyor_locations drop constraint if exists surveyor_locations_pkey;
alter table public.surveyor_locations add constraint surveyor_locations_pkey primary key (user_id, device_id);

alter table public.surveyor_locations drop constraint if exists surveyor_locations_device;
alter table public.surveyor_locations add constraint surveyor_locations_device check (char_length(device_id) <= 64) not valid;
alter table public.surveyor_location_points drop constraint if exists surveyor_points_device;
alter table public.surveyor_location_points add constraint surveyor_points_device check (char_length(device_id) <= 64) not valid;

create index if not exists surveyor_location_points_device_time_idx
  on public.surveyor_location_points (user_id, device_id, recorded_at desc);

select 'OK : suivi par téléphone prêt' as verification;
