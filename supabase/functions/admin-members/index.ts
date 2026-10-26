// XR Jags staff dashboard: member management (Supabase Edge Function "admin-members"). Deployed 2026-10-24 with verify_jwt off: it checks the token itself (auth.getUser).
// Only an ACTIVE manager (staff.role admin or leadership) can call it. Actions:
//   create      { email, full_name, role }   -> new login + staff row; returns a temporary password ONCE
//   reset       { user_id }                  -> new temporary password ONCE; they must pick their own at next sign-in
//   deactivate  { user_id }                  -> staff.active = false + sign-in blocked (ban)
//   reactivate  { user_id }                  -> staff.active = true + ban lifted
//   role        { user_id, role }            -> change role
// Rules: only an admin may create an admin, or change/reset/turn off an admin. Nobody can turn off,
// demote or reset themselves here (so the last admin cannot lock everyone out by accident).
// Passwords are never logged and never stored by this function.
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided automatically by Supabase.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const ROLES = ["student", "student_lead", "leadership", "admin"] as const;
type Role = typeof ROLES[number];
const MANAGER_ROLES: Role[] = ["admin", "leadership"];
const ALLOWED_ORIGINS = ["https://caav-website.vercel.app", "https://suvrjags.org", "https://www.suvrjags.org"];
const LOCALHOST = /^http:\/\/localhost(:\d{1,5})?$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,}$/;
const BAN_FOREVER = "876000h"; // about 100 years

function cors(origin: string | null): Record<string, string> {
  const ok = origin && (ALLOWED_ORIGINS.includes(origin) || LOCALHOST.test(origin));
  return {
    ...(ok ? { "Access-Control-Allow-Origin": origin! } : {}),
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

function reply(origin: string | null, status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors(origin), "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

// Readable temporary password: 3 groups of 4 from an alphabet with no look-alikes
// (no 0/O/o, 1/l/I/i, 5/S, 2/Z, 8/B). 12 random characters, about 66 bits. Unbiased (rejection sampling).
const ALPHABET = "abcdefghjkmnpqrstuvwxyzACDEFGHJKLMNPQRTUVWXY34679";
function tempPassword(): string {
  const out: string[] = [];
  const max = 256 - (256 % ALPHABET.length);
  while (out.length < 12) {
    const buf = new Uint8Array(32);
    crypto.getRandomValues(buf);
    for (const b of buf) { if (b < max && out.length < 12) out.push(ALPHABET[b % ALPHABET.length]); }
  }
  // make sure it has a digit, a lower and an upper letter (some password rules ask for these)
  const s = out.join("");
  if (!/[0-9]/.test(s) || !/[a-z]/.test(s) || !/[A-Z]/.test(s)) return tempPassword();
  return `${s.slice(0, 4)}-${s.slice(4, 8)}-${s.slice(8, 12)}`;
}

Deno.serve(async (req) => {
  const origin = req.headers.get("Origin");
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(origin) });
  if (req.method !== "POST") return reply(origin, 405, { ok: false, error: "Use POST." });
  if (origin && !(ALLOWED_ORIGINS.includes(origin) || LOCALHOST.test(origin))) {
    return reply(origin, 403, { ok: false, error: "This page is not allowed to manage members." });
  }

  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) return reply(origin, 500, { ok: false, error: "Member tools are not set up yet." });
  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

  // 1) who is calling? (the auth server checks the token's signature and expiry)
  const jwt = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  if (!jwt) return reply(origin, 401, { ok: false, error: "Please sign in again." });
  const { data: who, error: whoErr } = await admin.auth.getUser(jwt);
  if (whoErr || !who?.user) return reply(origin, 401, { ok: false, error: "Please sign in again." });
  const callerId = who.user.id;

  // 2) is the caller an active manager?
  const { data: me } = await admin.from("staff").select("user_id, role, active").eq("user_id", callerId).maybeSingle();
  if (!me || !me.active || !MANAGER_ROLES.includes(me.role)) {
    return reply(origin, 403, { ok: false, error: "Only managers can manage members." });
  }
  const callerIsAdmin = me.role === "admin";

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return reply(origin, 400, { ok: false, error: "Nothing was sent." }); }
  if (!body || typeof body !== "object" || Array.isArray(body)) return reply(origin, 400, { ok: false, error: "Nothing was sent." });
  const action = String(body.action || "");

  async function target(userId: unknown) {
    if (typeof userId !== "string" || !UUID.test(userId)) return { err: reply(origin, 400, { ok: false, error: "Pick a team member." }) };
    const { data } = await admin.from("staff").select("user_id, full_name, role, active").eq("user_id", userId).maybeSingle();
    if (!data) return { err: reply(origin, 404, { ok: false, error: "That person is not on the team list." }) };
    if (data.role === "admin" && !callerIsAdmin) return { err: reply(origin, 403, { ok: false, error: "Only an admin can change an admin's account." }) };
    if (data.role === "leadership" && !callerIsAdmin) return { err: reply(origin, 403, { ok: false, error: "Only an admin can change a leadership account." }) };
    return { row: data };
  }

  try {
    if (action === "create") {
      const email = String(body.email || "").trim().toLowerCase();
      const fullName = String(body.full_name || "").trim();
      const role = String(body.role || "") as Role;
      if (!EMAIL.test(email) || email.length > 320) return reply(origin, 400, { ok: false, error: "Check the email address." });
      if (!fullName || fullName.length > 120) return reply(origin, 400, { ok: false, error: "Type their full name." });
      if (!ROLES.includes(role)) return reply(origin, 400, { ok: false, error: "Pick a role." });
      if (role === "admin" && !callerIsAdmin) return reply(origin, 403, { ok: false, error: "Only an admin can add another admin." });
      if (role === "leadership" && !callerIsAdmin) return reply(origin, 403, { ok: false, error: "Only an admin can add a leadership member." });

      const password = tempPassword();
      const { data: made, error } = await admin.auth.admin.createUser({
        email, password, email_confirm: true, user_metadata: { full_name: fullName },
      });
      if (error || !made?.user) {
        const taken = /already|registered|exists/i.test(error?.message || "");
        console.log(JSON.stringify({ fn: "admin-members", action, ok: false, reason: taken ? "email_taken" : "create_failed" }));
        return reply(origin, taken ? 409 : 500, { ok: false, error: taken ? "That email already has a login." : "The login was not made. Try again." });
      }
      const { error: rowErr } = await admin.from("staff").insert({
        user_id: made.user.id, full_name: fullName, role, email, active: true, must_change_password: true,
      });
      if (rowErr) {
        await admin.auth.admin.deleteUser(made.user.id); // undo, so there is no login without a staff row
        console.log(JSON.stringify({ fn: "admin-members", action, ok: false, reason: "staff_row_failed" }));
        return reply(origin, 500, { ok: false, error: "The team list was not updated. Nothing was saved." });
      }
      console.log(JSON.stringify({ fn: "admin-members", action, ok: true, by: callerId, user: made.user.id }));
      return reply(origin, 200, { ok: true, user_id: made.user.id, full_name: fullName, email, role, temp_password: password });
    }

    if (action === "reset") {
      const t = await target(body.user_id); if (t.err) return t.err;
      if (t.row!.user_id === callerId) return reply(origin, 400, { ok: false, error: "To change your own password, sign out and use your own account settings." });
      const password = tempPassword();
      const { error } = await admin.auth.admin.updateUserById(t.row!.user_id, { password });
      if (error) return reply(origin, 500, { ok: false, error: "The password was not reset. Try again." });
      const { error: flagErr } = await admin.from("staff").update({ must_change_password: true }).eq("user_id", t.row!.user_id);
      if (flagErr) return reply(origin, 500, { ok: false, error: "The password was reset, but the first-sign-in step was not set. Try again." });
      console.log(JSON.stringify({ fn: "admin-members", action, ok: true, by: callerId, user: t.row!.user_id }));
      return reply(origin, 200, { ok: true, user_id: t.row!.user_id, full_name: t.row!.full_name, temp_password: password });
    }

    if (action === "deactivate" || action === "reactivate") {
      const t = await target(body.user_id); if (t.err) return t.err;
      if (t.row!.user_id === callerId) return reply(origin, 400, { ok: false, error: "You cannot turn off your own access." });
      const on = action === "reactivate";
      const { error } = await admin.auth.admin.updateUserById(t.row!.user_id, { ban_duration: on ? "none" : BAN_FOREVER });
      if (error) return reply(origin, 500, { ok: false, error: "Access was not changed. Try again." });
      const { error: rowErr } = await admin.from("staff").update({ active: on }).eq("user_id", t.row!.user_id);
      if (rowErr) return reply(origin, 500, { ok: false, error: "Access was only partly changed. Try again." });
      console.log(JSON.stringify({ fn: "admin-members", action, ok: true, by: callerId, user: t.row!.user_id }));
      return reply(origin, 200, { ok: true, user_id: t.row!.user_id, active: on });
    }

    if (action === "role") {
      const t = await target(body.user_id); if (t.err) return t.err;
      const role = String(body.role || "") as Role;
      if (!ROLES.includes(role)) return reply(origin, 400, { ok: false, error: "Pick a role." });
      if (role === "admin" && !callerIsAdmin) return reply(origin, 403, { ok: false, error: "Only an admin can make someone an admin." });
      if (role === "leadership" && !callerIsAdmin) return reply(origin, 403, { ok: false, error: "Only an admin can make someone leadership." });
      if (t.row!.user_id === callerId) return reply(origin, 400, { ok: false, error: "You cannot change your own role." });
      const { error } = await admin.from("staff").update({ role }).eq("user_id", t.row!.user_id);
      if (error) return reply(origin, 500, { ok: false, error: "The role was not changed. Try again." });
      console.log(JSON.stringify({ fn: "admin-members", action, ok: true, by: callerId, user: t.row!.user_id, role }));
      return reply(origin, 200, { ok: true, user_id: t.row!.user_id, role });
    }

    return reply(origin, 400, { ok: false, error: "Unknown action." });
  } catch (_e) {
    console.log(JSON.stringify({ fn: "admin-members", action, ok: false, reason: "exception" }));
    return reply(origin, 500, { ok: false, error: "Something went wrong. Try again." });
  }
});
