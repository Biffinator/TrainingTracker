// Strava connection for the app. Each signed-in user links their own Strava account; the OAuth
// tokens are stored server-side (public.strava_tokens, service-role only) and the browser only ever
// receives activity summaries. The Strava client secret lives in the function's secrets.
//
// Deployed with verify_jwt=false because Strava's redirect (action=callback) carries no user JWT;
// every other action checks the caller's Supabase JWT itself.
import { createClient } from "npm:@supabase/supabase-js@2";

const CLIENT_ID = Deno.env.get("STRAVA_CLIENT_ID") ?? "";
const CLIENT_SECRET = Deno.env.get("STRAVA_CLIENT_SECRET") ?? "";
const ORIGINS = (Deno.env.get("ALLOWED_ORIGINS") ?? "https://biffinator.github.io").split(",").map((s) => s.trim()).filter(Boolean);
const APP_URL = Deno.env.get("APP_URL") ?? "https://biffinator.github.io/TrainingTracker/";
const SELF = Deno.env.get("SUPABASE_URL")! + "/functions/v1/strava";
const SCOPE = "activity:read_all";
const STATE_TTL_MS = 10 * 60 * 1000;
const MAX_WINDOW_S = 45 * 86400;

const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

function cors(origin: string) {
  const ok = ORIGINS.includes(origin) || /^http:\/\/localhost(:\d+)?$/.test(origin);
  return {
    "Access-Control-Allow-Origin": ok ? origin : ORIGINS[0],
    "Vary": "Origin",
    "Access-Control-Allow-Headers": "authorization, apikey, content-type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  };
}
const json = (body: unknown, status: number, headers: Record<string, string>) =>
  new Response(JSON.stringify(body), { status, headers: { ...headers, "Content-Type": "application/json" } });
const redirect = (params: Record<string, string>) => {
  const url = new URL(APP_URL);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return Response.redirect(url.toString(), 302);
};

// The OAuth `state` binds the callback to the user who started it: base64url(userId.expiry).hmac.
const enc = new TextEncoder();
const b64 = (bytes: ArrayBuffer | Uint8Array) => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const unb64 = (s: string) => atob(s.replace(/-/g, "+").replace(/_/g, "/"));
async function sign(payload: string) {
  const key = await crypto.subtle.importKey("raw", enc.encode(CLIENT_SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return b64(await crypto.subtle.sign("HMAC", key, enc.encode(payload)));
}
async function makeState(userId: string) {
  const payload = b64(enc.encode(`${userId}.${Date.now() + STATE_TTL_MS}`));
  return `${payload}.${await sign(payload)}`;
}
async function readState(state: string): Promise<string | null> {
  const [payload, sig] = state.split(".");
  if (!payload || !sig || sig !== await sign(payload)) return null;
  const [userId, expiry] = unb64(payload).split(".");
  if (!userId || !expiry || Date.now() > Number(expiry)) return null;
  return userId;
}

type TokenRow = { user_id: string; athlete_id: number; athlete_name: string | null; access_token: string; refresh_token: string; expires_at: number; scope: string | null };

async function stravaToken(params: Record<string, string>) {
  const res = await fetch("https://www.strava.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ client_id: CLIENT_ID, client_secret: CLIENT_SECRET, ...params }),
  });
  if (!res.ok) throw new Error("Strava token error " + res.status);
  return await res.json();
}

// Returns a fresh access token for the user, refreshing (and persisting) when it's about to expire.
async function accessTokenFor(row: TokenRow) {
  if (row.expires_at - 120 > Math.floor(Date.now() / 1000)) return row.access_token;
  const t = await stravaToken({ grant_type: "refresh_token", refresh_token: row.refresh_token });
  await admin.from("strava_tokens").update({ access_token: t.access_token, refresh_token: t.refresh_token, expires_at: t.expires_at, updated_at: new Date().toISOString() }).eq("user_id", row.user_id);
  return t.access_token as string;
}

async function callback(url: URL) {
  if (url.searchParams.get("error")) return redirect({ strava: "error", reason: url.searchParams.get("error")! });
  const userId = await readState(url.searchParams.get("state") ?? "");
  if (!userId) return redirect({ strava: "error", reason: "expired link, try again" });
  const scope = url.searchParams.get("scope") ?? "";
  if (!/activity:read/.test(scope)) return redirect({ strava: "error", reason: "activity access was not granted" });
  const code = url.searchParams.get("code");
  if (!code) return redirect({ strava: "error", reason: "missing code" });
  try {
    const t = await stravaToken({ grant_type: "authorization_code", code });
    const name = [t.athlete?.firstname, t.athlete?.lastname].filter(Boolean).join(" ");
    const { error } = await admin.from("strava_tokens").upsert({ user_id: userId, athlete_id: t.athlete?.id ?? 0, athlete_name: name || null, access_token: t.access_token, refresh_token: t.refresh_token, expires_at: t.expires_at, scope, updated_at: new Date().toISOString() });
    if (error) throw new Error(error.message);
    return redirect({ strava: "connected" });
  } catch (e) {
    return redirect({ strava: "error", reason: (e as Error).message.slice(0, 80) });
  }
}

Deno.serve(async (req) => {
  const headers = cors(req.headers.get("origin") ?? "");
  const url = new URL(req.url);
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers });
  if (!CLIENT_ID || !CLIENT_SECRET) return json({ error: "Strava not configured" }, 503, headers);
  if (req.method === "GET" && url.searchParams.get("action") === "callback") return await callback(url);
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405, headers);

  const auth = req.headers.get("authorization") ?? "";
  if (!auth.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401, headers);
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return json({ error: "Unauthorized" }, 401, headers);

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { /* empty body */ }
  const action = String(body.action ?? "");

  if (action === "authorize") {
    const params = new URLSearchParams({ client_id: CLIENT_ID, response_type: "code", redirect_uri: SELF + "?action=callback", approval_prompt: "auto", scope: SCOPE, state: await makeState(user.id) });
    return json({ url: "https://www.strava.com/oauth/authorize?" + params }, 200, headers);
  }

  const { data: row } = await admin.from("strava_tokens").select("*").eq("user_id", user.id).maybeSingle();

  if (action === "status") return json(row ? { connected: true, athlete: { id: row.athlete_id, name: row.athlete_name } } : { connected: false }, 200, headers);

  if (action === "disconnect") {
    if (row) {
      try { await fetch("https://www.strava.com/oauth/deauthorize", { method: "POST", headers: { Authorization: "Bearer " + await accessTokenFor(row) } }); } catch { /* token may already be dead; drop it regardless */ }
      await admin.from("strava_tokens").delete().eq("user_id", user.id);
    }
    return json({ connected: false }, 200, headers);
  }

  if (action === "activities") {
    if (!row) return json({ connected: false, activities: [] }, 200, headers);
    const before = Number(body.before), after = Number(body.after);
    if (!Number.isInteger(before) || !Number.isInteger(after) || after >= before || before - after > MAX_WINDOW_S) return json({ error: "Bad window" }, 400, headers);
    let access: string;
    try { access = await accessTokenFor(row); } catch {
      await admin.from("strava_tokens").delete().eq("user_id", user.id); // refresh refused: the user revoked access on Strava
      return json({ connected: false, activities: [], revoked: true }, 200, headers);
    }
    const res = await fetch(`https://www.strava.com/api/v3/athlete/activities?after=${after}&before=${before}&per_page=100`, { headers: { Authorization: "Bearer " + access } });
    if (res.status === 401) { await admin.from("strava_tokens").delete().eq("user_id", user.id); return json({ connected: false, activities: [], revoked: true }, 200, headers); }
    if (!res.ok) return json({ error: "Strava error " + res.status }, 502, headers);
    const list = await res.json() as Record<string, unknown>[];
    const activities = list.map((a) => ({ id: a.id, name: a.name, sport_type: a.sport_type ?? a.type, start_date_local: a.start_date_local, moving_time: a.moving_time, elapsed_time: a.elapsed_time, distance: a.distance }));
    return json({ connected: true, athlete: { id: row.athlete_id, name: row.athlete_name }, activities }, 200, headers);
  }

  return json({ error: "Unknown action" }, 400, headers);
});
