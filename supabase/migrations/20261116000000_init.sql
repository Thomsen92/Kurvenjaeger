-- Kurvenjäger: Konten, Cloud-Speicherstand, Spielwerte und Admin-Rechte.
-- Einmal im Supabase-Dashboard unter "SQL Editor" ausführen (idempotent, kann wiederholt werden).

-- 1) Profile (öffentliche Konto-Daten, vom Spieler nicht änderbar)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null,
  is_admin boolean not null default false,
  banned boolean not null default false,
  created_at timestamptz not null default now()
);
create unique index if not exists profiles_username_key on public.profiles (lower(username));

-- 2) Spielstand je Konto
create table if not exists public.saves (
  id uuid primary key references public.profiles(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- 3) Spielwerte und Ankündigung (key: 'game', 'announcement')
create table if not exists public.settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

-- Profil automatisch beim Registrieren anlegen (Name steckt in den Metadaten)
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, username)
  values (new.id, coalesce(nullif(new.raw_user_meta_data->>'username', ''), 'spieler_' || substr(new.id::text, 1, 6)));
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create or replace function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
drop trigger if exists saves_touch on public.saves;
create trigger saves_touch before insert or update on public.saves for each row execute function public.touch_updated_at();
drop trigger if exists settings_touch on public.settings;
create trigger settings_touch before insert or update on public.settings for each row execute function public.touch_updated_at();

-- Admin-Prüfung (security definer, damit die Policies nicht rekursiv werden)
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false);
$$;
create or replace function public.is_banned() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select banned from public.profiles where id = auth.uid()), false);
$$;

-- Row Level Security
alter table public.profiles enable row level security;
alter table public.saves enable row level security;
alter table public.settings enable row level security;

drop policy if exists profiles_read on public.profiles;
create policy profiles_read on public.profiles for select to authenticated using (id = auth.uid() or public.is_admin());
drop policy if exists profiles_admin_update on public.profiles;
create policy profiles_admin_update on public.profiles for update to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists saves_read on public.saves;
create policy saves_read on public.saves for select to authenticated using (id = auth.uid() or public.is_admin());
drop policy if exists saves_insert on public.saves;
create policy saves_insert on public.saves for insert to authenticated with check ((id = auth.uid() and not public.is_banned()) or public.is_admin());
drop policy if exists saves_update on public.saves;
create policy saves_update on public.saves for update to authenticated using ((id = auth.uid() and not public.is_banned()) or public.is_admin()) with check ((id = auth.uid() and not public.is_banned()) or public.is_admin());

drop policy if exists settings_read on public.settings;
create policy settings_read on public.settings for select to anon, authenticated using (true);
drop policy if exists settings_admin_write on public.settings;
create policy settings_admin_write on public.settings for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Rechte der Data API gezielt vergeben (nichts wird automatisch freigegeben)
revoke all on public.profiles, public.saves, public.settings from anon, authenticated;
grant select on public.settings to anon;
grant select, insert, update, delete on public.settings to authenticated;
grant select on public.profiles to authenticated;
grant update (banned, is_admin) on public.profiles to authenticated;   -- durch RLS nur für Admins wirksam
grant select, insert, update on public.saves to authenticated;

-- 4) EINMALIG: dich selbst zum Admin machen (Konto vorher im Spiel registrieren, Namen anpassen):
-- update public.profiles set is_admin = true where lower(username) = lower('DEINNAME');
