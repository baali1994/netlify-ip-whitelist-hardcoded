import { createClient } from "@supabase/supabase-js";

/*
  HARD-CODED SETTINGS

  This is the easiest setup because you do not need to add Netlify
  environment variables.

  Important:
  - This file runs server-side as a Netlify Function.
  - Do NOT put SUPABASE_SECRET_KEY inside admin.html or any browser JS file.
  - If your GitHub repo is public, anyone can see these values.
*/

const SUPABASE_URL = "https://lfnjernrgkdtfetyoghq.supabase.co";
const SUPABASE_SECRET_KEY = String(
  process.env.SUPABASE_SECRET_KEY || ""
).trim();
const ADMIN_TOKEN = "sb_publishable_zW_eXePChSo8yaTw4aJ8Lg_IUHe9bZK";

function json(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type, x-admin-token",
      "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS"
    }
  });
}

function getSupabase() {
  return createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
}

function isValidIpv4(ip) {
  const value = String(ip || "").trim();
  const parts = value.split(".");
  if (parts.length !== 4) return false;

  return parts.every(part => {
    if (!/^\d{1,3}$/.test(part)) return false;
    const n = Number(part);
    return n >= 0 && n <= 255;
  });
}

function extractIpv4(value) {
  const text = String(value || "").trim();
  if (!text) return "";

  // Handle IPv4-mapped IPv6 values such as ::ffff:103.45.67.89.
  const mapped = text.match(/::ffff:(\d{1,3}(?:\.\d{1,3}){3})/i);
  if (mapped && isValidIpv4(mapped[1])) return mapped[1];

  // Headers such as x-forwarded-for may contain more than one address.
  const matches = text.match(/\b\d{1,3}(?:\.\d{1,3}){3}\b/g) || [];
  for (const candidate of matches) {
    if (isValidIpv4(candidate)) return candidate;
  }

  return isValidIpv4(text) ? text : "";
}

function getClientIpv4(req, context) {
  /*
    IPv4 ONLY.

    Prefer Netlify/request headers first, because context.ip may be IPv6 even
    when an IPv4 value is also present in a forwarding header. We scan every
    candidate and return only a real dotted-quad IPv4 address.
  */
  const candidates = [
    req.headers.get("x-nf-client-connection-ip"),
    req.headers.get("x-forwarded-for"),
    req.headers.get("true-client-ip"),
    req.headers.get("cf-connecting-ip"),
    req.headers.get("x-real-ip"),
    req.headers.get("client-ip"),
    context?.ip
  ];

  for (const candidate of candidates) {
    const ipv4 = extractIpv4(candidate);
    if (ipv4) return ipv4;
  }

  return "";
}

function requireAdmin(req, url) {
  const tokenFromHeader = req.headers.get("x-admin-token");
  const tokenFromQuery = url.searchParams.get("token");

  return Boolean(
    ADMIN_TOKEN &&
    (tokenFromHeader === ADMIN_TOKEN || tokenFromQuery === ADMIN_TOKEN)
  );
}

function validIp(ip) {
  // New whitelist entries and access checks are IPv4-only.
  return isValidIpv4(ip);
}

function validStoredIp(ip) {
  // Allow admin cleanup of legacy IPv6 rows already stored in Supabase.
  const value = String(ip || "").trim();
  if (!value || value.length > 80) return false;
  return /^[0-9a-fA-F:.]+$/.test(value);
}

async function readJson(req) {
  try {
    const text = await req.text();
    return text ? JSON.parse(text) : {};
  } catch {
    return {};
  }
}

export default async function handler(req, context) {
  if (req.method.toUpperCase() === "OPTIONS") {
    return json(200, { success: true });
  }

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get("action") || "";
    const method = req.method.toUpperCase();
    const supabase = getSupabase();

    /*
      PUBLIC CHECK ENDPOINT USED BY PYTHON APP

      URL:
      https://YOUR-SITE.netlify.app/.netlify/functions/ips?action=check

      If visitor IP exists in Supabase and active=true:
      returns HTTP 200 and allowed=true.

      Otherwise:
      returns HTTP 403 and allowed=false.
    */
    if (method === "GET" && action === "check") {
      const ip = getClientIpv4(req, context);

      if (!validIp(ip)) {
        return json(403, {
          allowed: false,
          ip,
          reason: "Could not detect a valid IPv4 address"
        });
      }

      const { data, error } = await supabase
        .from("ip_whitelist")
        .select("ip, active")
        .eq("ip", ip)
        .eq("active", true)
        .maybeSingle();

      if (error) {
        return json(500, {
          allowed: false,
          ip,
          reason: "Database error"
        });
      }

      return json(data ? 200 : 403, {
        allowed: Boolean(data),
        ip
      });
    }

    /*
      PUBLIC IP DETECTION TEST

      URL:
      https://YOUR-SITE.netlify.app/.netlify/functions/ips?action=whoami
    */
    if (method === "GET" && action === "whoami") {
      return json(200, {
        ip: getClientIpv4(req, context)
      });
    }

    /*
      ADMIN ACTIONS BELOW
      These require ADMIN_TOKEN.
    */
    if (!requireAdmin(req, url)) {
      return json(401, {
        success: false,
        error: "Unauthorized. Wrong admin token."
      });
    }

    /*
      LIST ALL IPS
    */
    if (method === "GET" && action === "list") {
      const { data, error } = await supabase
        .from("ip_whitelist")
        .select("ip, label, active, created_at, updated_at")
        .order("created_at", { ascending: false });

      if (error) return json(500, { success: false, error: error.message });

      return json(200, { success: true, data: data || [] });
    }

    /*
      ADD CURRENT IP DETECTED BY NETLIFY
    */
    if (method === "POST" && action === "add-current") {
      const body = await readJson(req);
      const ip = getClientIpv4(req, context);
      const label = String(body.label || "Current IP").trim();

      if (!validIp(ip)) {
        return json(400, {
          success: false,
          error: "Could not detect a valid IPv4 address",
          ip
        });
      }

      const { error } = await supabase
        .from("ip_whitelist")
        .upsert(
          {
            ip,
            label,
            active: true,
            updated_at: new Date().toISOString()
          },
          { onConflict: "ip" }
        );

      if (error) return json(500, { success: false, error: error.message });

      return json(200, {
        success: true,
        message: "Current IP added or re-enabled",
        ip
      });
    }

    /*
      ADD MANUAL IP
    */
    if (method === "POST" && action === "add") {
      const body = await readJson(req);
      const ip = String(body.ip || "").trim();
      const label = String(body.label || "Manual IP").trim();

      if (!validIp(ip)) {
        return json(400, { success: false, error: "Valid IPv4 address required" });
      }

      const { error } = await supabase
        .from("ip_whitelist")
        .upsert(
          {
            ip,
            label,
            active: true,
            updated_at: new Date().toISOString()
          },
          { onConflict: "ip" }
        );

      if (error) return json(500, { success: false, error: error.message });

      return json(200, {
        success: true,
        message: "Manual IP added or re-enabled",
        ip
      });
    }

    /*
      ENABLE OR DISABLE IP
    */
    if (method === "PATCH" && action === "toggle") {
      const body = await readJson(req);
      const ip = String(body.ip || "").trim();
      const active = Boolean(body.active);

      if (!validStoredIp(ip)) {
        return json(400, { success: false, error: "Valid stored IP required" });
      }

      const { error } = await supabase
        .from("ip_whitelist")
        .update({
          active,
          updated_at: new Date().toISOString()
        })
        .eq("ip", ip);

      if (error) return json(500, { success: false, error: error.message });

      return json(200, {
        success: true,
        ip,
        active
      });
    }

    /*
      DELETE IP
    */
    if (method === "DELETE" && action === "delete") {
      const body = await readJson(req);
      const ip = String(body.ip || "").trim();

      if (!validStoredIp(ip)) {
        return json(400, { success: false, error: "Valid stored IP required" });
      }

      const { error } = await supabase
        .from("ip_whitelist")
        .delete()
        .eq("ip", ip);

      if (error) return json(500, { success: false, error: error.message });

      return json(200, {
        success: true,
        deleted: ip
      });
    }

    return json(404, {
      success: false,
      error: "Unknown action"
    });
  } catch (err) {
    return json(500, {
      success: false,
      error: err.message || "Server error"
    });
  }
}
