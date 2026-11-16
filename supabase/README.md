# Supabase-Einrichtung (Kurvenjäger)

1. `.env.local` im Projektordner mit `VITE_SUPABASE_URL` und `VITE_SUPABASE_ANON_KEY` (publishable key) füllen (Vorlage: `.env.example`).
2. Datenbank anlegen, entweder
   - per CLI: `supabase login`, `supabase init`, `supabase link --project-ref <ref>`, dann `supabase db push`, oder
   - ohne CLI: Inhalt von `migrations/20261116000000_init.sql` im Dashboard unter **SQL Editor** ausführen.
3. Dashboard → **Authentication → Providers → Email**: **Confirm email** ausschalten (es werden nie E-Mails verschickt, Konten laufen über Name + Passwort).
4. Im Spiel ein Konto erstellen (Einstellungen → Konto), dann im SQL Editor einmal ausführen:
   `update public.profiles set is_admin = true where lower(username) = lower('DEINNAME');`
5. Online-Deploy (GitHub Pages): im Repo unter Settings → Variables die Variablen `SUPABASE_URL` und `SUPABASE_ANON_KEY` anlegen.

Den `service_role`-Key niemals ins Projekt oder in GitHub-Variablen legen.
