# Strava connection

Lets each signed-in user link their own Strava account from the Utilities tab. Completed activities (runs, rides, weight training, walks) from the last week fill in the matching workout's actual time and check it off.

How it's kept safe in a public repo:

- The Strava **client secret** is a function secret, never in the code or the browser.
- Each user's OAuth **tokens** live in `public.strava_tokens`, which has RLS on with no policies — only this function (service role) can read or write them. The browser only ever receives activity summaries.
- The OAuth `state` is an HMAC-signed, 10-minute token bound to the user who clicked Connect, so a callback can't attach someone else's Strava to an account.

## One-time setup

Run from the repo root, after the [Athletica relay](../athletica/README.md) steps (login + link).

1. Register an API application at <https://www.strava.com/settings/api>:
   - **Authorization Callback Domain:** `cgfddevbwgcvnenwzvfn.supabase.co` (your project ref + `.supabase.co`, no `https://`, no path)
   - Website / description: anything. Note the **Client ID** and **Client Secret**.
2. Create the token table. Either paste [`supabase/migrations/20260908000000_strava_tokens.sql`](../../migrations/20260908000000_strava_tokens.sql) into the dashboard's SQL editor and run it, or push it with the CLI (asks for the database password):
   ```bash
   npx supabase@latest db push
   ```
3. Set the secrets. `APP_URL` is where Strava sends the user back after approving:
   ```bash
   npx supabase@latest secrets set STRAVA_CLIENT_ID="<client id>" STRAVA_CLIENT_SECRET="<client secret>" APP_URL="https://biffinator.github.io/TrainingTracker/"
   ```
4. Deploy. JWT verification is turned off for this function in `supabase/config.toml` (Strava's redirect carries no user token); the function verifies callers itself:
   ```bash
   npx supabase@latest functions deploy strava
   ```
5. In the app: Utilities → **Connect Strava** → approve on Strava → you land back on Utilities and the first sync runs.

## Letting other people use it

New Strava API applications start in "single athlete" mode: only the athlete who created the app can connect. To let other users of this deployment connect their own accounts, request a higher athlete limit from Strava (Settings → API → your app → request access) — they typically ask for a short description and screenshots. Nothing in this code changes; every user already gets their own token row.

## Notes

- Sync runs on sign-in and every 30 minutes while the app is open; **Sync Strava now** forces it. Only activities of at least one minute inside the last 8 days are considered.
- Matching is by day and type: Run/TrailRun/VirtualRun → run rows, any Ride type → bike rows, WeightTraining/Crossfit/Workout → the day's lift, Walk/Hike → the treadmill row. One activity fills one row. Strava's recorded time replaces a typed time; a row stays linked to its activity while that activity exists on Strava.
- **Disconnect** revokes the app on Strava and deletes the token row. If a user revokes from Strava's side instead, the next sync notices and clears the connection in the app.
- Redeploy after editing `index.ts`.
