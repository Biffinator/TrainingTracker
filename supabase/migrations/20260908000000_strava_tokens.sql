-- Per-user Strava OAuth tokens, written and read only by the `strava` Edge Function (service role).
-- RLS is on with no policies, so neither anon nor signed-in browser clients can touch this table.
create table if not exists public.strava_tokens (
  user_id uuid primary key references auth.users (id) on delete cascade,
  athlete_id bigint not null,
  athlete_name text,
  access_token text not null,
  refresh_token text not null,
  expires_at bigint not null,
  scope text,
  updated_at timestamptz not null default now()
);
alter table public.strava_tokens enable row level security;
revoke all on table public.strava_tokens from anon, authenticated;
