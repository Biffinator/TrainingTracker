# Athletica feed relay

Fetches the signed-in user's Athletica calendar feed server-side (the feed sends no CORS headers, so the browser can't read it directly) and returns it to the app. The feed URL lives only as a Supabase secret.

## One-time deploy

The CLI runs via `npx` (no install; its npm package refuses global installs). Run these from the repo root.

1. Sign in — this opens a browser for you to log in; nothing else needs your password:
   ```bash
   npx supabase@latest login
   ```
2. Initialise the local project config once (creates `supabase/config.toml`; answer N to any editor-settings prompt), then link this project. `link` may ask for the database password — leave it blank and press Enter, it isn't needed for functions:
   ```bash
   npx supabase@latest init
   npx supabase@latest link --project-ref cgfddevbwgcvnenwzvfn
   ```
3. Set the two secrets. Get the feed URL from Athletica → Settings → Profile → Plan Settings. `ALLOWED_ORIGINS` is where the app is served from (comma-separate several):
   ```bash
   npx supabase@latest secrets set ATHLETICA_ICS_URL="https://app.athletica.ai/<token>/athletica.ics" ALLOWED_ORIGINS="https://biffinator.github.io"
   ```
4. Deploy (JWT verification stays on, so only a signed-in user of this project can call it):
   ```bash
   npx supabase@latest functions deploy athletica
   ```

Redeploy after editing `index.ts`; `supabase secrets set` again if you rotate the feed token.

## Notes

- Single-user by design: one secret feed URL for the project. To support several accounts, store each user's URL in a table keyed by `auth.uid()` with RLS and look it up from the caller's JWT instead of the secret.
- `localhost` origins are always allowed so local testing works.
