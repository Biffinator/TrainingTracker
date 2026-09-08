// Relays the signed-in user's Athletica calendar feed to the app.
// Athletica's feed sends no CORS headers, so the browser can't fetch it directly; this
// function fetches it server-side. The feed URL is a server secret (ATHLETICA_ICS_URL) and
// is never accepted from the client, so this can't be used as an open proxy.
import { createClient } from "npm:@supabase/supabase-js@2";

const FEED = Deno.env.get("ATHLETICA_ICS_URL") ?? "";
const ORIGINS = (Deno.env.get("ALLOWED_ORIGINS") ?? "https://biffinator.github.io").split(",").map((s) => s.trim()).filter(Boolean);

function cors(origin: string) {
  const ok = ORIGINS.includes(origin) || /^http:\/\/localhost(:\d+)?$/.test(origin);
  return {
    "Access-Control-Allow-Origin": ok ? origin : ORIGINS[0],
    "Vary": "Origin",
    "Access-Control-Allow-Headers": "authorization, apikey, content-type",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
  };
}

Deno.serve(async (req) => {
  const headers = cors(req.headers.get("origin") ?? "");
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers });
  if (req.method !== "GET") return new Response("Method not allowed", { status: 405, headers });

  const auth = req.headers.get("authorization") ?? "";
  if (!auth.startsWith("Bearer ")) return new Response("Unauthorized", { status: 401, headers });
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return new Response("Unauthorized", { status: 401, headers });

  if (!/^https:\/\/app\.athletica\.ai\/[^/]+\/athletica\.ics$/.test(FEED)) return new Response("Feed not configured", { status: 503, headers });
  const upstream = await fetch(FEED, { headers: { Accept: "text/calendar" } });
  if (!upstream.ok) return new Response("Upstream error " + upstream.status, { status: 502, headers });
  const body = await upstream.text();
  return new Response(body, { status: 200, headers: { ...headers, "Content-Type": "text/calendar; charset=utf-8", "Cache-Control": "private, max-age=900" } });
});
