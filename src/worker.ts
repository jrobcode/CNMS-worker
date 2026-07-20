/**
 * Cloudflare Worker: app.cnms.io/v1 → Supabase Edge Functions proxy
 *
 * Maps:  https://app.cnms.io/v1/<function>/<rest>
 *   →    https://<project>.supabase.co/functions/v1/<function>/<rest>
 *
 * - Injects the Supabase `apikey` header from SUPABASE_ANON_KEY.
 * - Falls back to the anon key for public endpoints when no Authorization is sent.
 * - Preserves method, body, query string, and rate-limit response headers.
 * - Handles CORS preflight locally.
 */

export interface Env {
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  API_PREFIX: string;
}

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-api-key",
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  "Access-Control-Expose-Headers":
    "X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset, Retry-After",
  "Access-Control-Max-Age": "86400",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
      "X-CNMS-Worker": "cnms-api",
      ...CORS_HEADERS,
    },
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    if (url.pathname === "/" || url.pathname === "/health") {
      return json({
        service: "cnms-api",
        status: "ok",
        docs: "https://cnms.io/api",
      });
    }

    const prefix = env.API_PREFIX || "/v1";
    if (!url.pathname.startsWith(prefix + "/") && url.pathname !== prefix) {
      return json(
        { error: `Unknown path. Use ${prefix}/<endpoint>. See https://cnms.io/api` },
        404,
      );
    }

    if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) {
      return json({ error: "Worker configuration is incomplete" }, 500);
    }

    const rest = url.pathname.slice(prefix.length) || "/";
    const target = new URL(env.SUPABASE_URL);
    target.pathname = `/functions/v1${rest}`;
    target.search = url.search;

    const headers = new Headers(request.headers);
    headers.delete("host");
    headers.delete("content-length");
    headers.delete("cf-connecting-ip");
    headers.delete("cf-ray");
    headers.delete("cf-visitor");
    headers.delete("x-forwarded-for");
    headers.delete("x-forwarded-proto");
    headers.delete("x-real-ip");

    headers.set("apikey", env.SUPABASE_ANON_KEY);

    if (!headers.has("authorization")) {
      headers.set("authorization", `Bearer ${env.SUPABASE_ANON_KEY}`);
    }

    const init: RequestInit = {
      method: request.method,
      headers,
      body: ["GET", "HEAD"].includes(request.method) ? undefined : request.body,
      redirect: "manual",
    };

    let upstream: Response;
    try {
      upstream = await fetch(target.toString(), init);
    } catch (err) {
      return json(
        { error: "Upstream fetch failed", detail: (err as Error).message },
        502,
      );
    }

    const resHeaders = new Headers(upstream.headers);
    for (const [k, v] of Object.entries(CORS_HEADERS)) resHeaders.set(k, v);
    resHeaders.set("X-CNMS-Worker", "cnms-api");
    resHeaders.delete("sb-gateway-version");
    resHeaders.delete("sb-project-ref");

    return new Response(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: resHeaders,
    });
  },
};

