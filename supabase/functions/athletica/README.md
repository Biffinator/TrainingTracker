# Athletica feed relay

Fetches the signed-in user's Athletica calendar feed server-side (the feed sends no CORS headers, so the browser can't read it directly) and returns it to the app. The feed URL lives only as a Supabase secret.

## One-time deploy

1. Install the Supabase CLI and sign in (this opens a browser; nothing else needs your password):
   ```bash
   npm install -g supabase
   supabase login
   ```
2. From the repo root, link the project and set the two secrets. Get the feed URL from Athletica → Settings → Profile → Plan Settings. `ALLOWED_ORIGINS` is where the app is served from (comma-separate several).
   ```bash
   supabase link --project-ref cgfddevbwgcvnenwzvfn
   supabase secrets set ATHLETICA_ICS_URL="https://app.athletica.ai/<token>/athletica.ics" ALLOWED_ORIGINS="https://biffinator.github.io"
   ```
3. Deploy (JWT verification stays on, so only a signed-in user of this project can call it):
   ```bash
   supabase functions deploy athletica
   ```
   If the CLI asks to create `supabase/config.toml`, accept — it's the default project config.

Redeploy after editing `index.ts`; `supabase secrets set` again if you rotate the feed token.

## Notes

- Single-user by design: one secret feed URL for the project. To support several accounts, store each user's URL in a table keyed by `auth.uid()` with RLS and look it up from the caller's JWT instead of the secret.
- `localhost` origins are always allowed so local testing works.
