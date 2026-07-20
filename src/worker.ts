/**
 * Cloudflare Worker — app.cnms.io/v1/*
 * Proxies /v1/... requests to Supabase backend.
 */

export default {
  async fetch(request: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // Only handle /v1/* paths
    if (!path.startsWith("/v1")) {
      return new Response(JSON.stringify({ error: "Not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      });
    }

    // Strip /v1 prefix before forwarding to Supabase
    const upstreamPath = path.replace(/^\/v1/, "") + url.search;
    const upstreamUrl = new URL(upstreamPath, env.SUPABASE_URL);

    // Forward the request with the original method, headers, and body
    const upstreamRequest = new Request(upstreamUrl.toString(), {
      method: request.method,
      headers: request.headers,
      body: request.body,
      signal: request.signal,
    });

    upstreamRequest.headers.set("Host", new URL(env.SUPABASE_URL).host);

    try {
      const response = await fetch(upstreamRequest);
      const proxyResponse = new Response(response.body, response);

      proxyResponse.headers.set("Access-Control-Allow-Origin", "*");
      proxyResponse.headers.set(
        "Access-Control-Allow-Methods",
        "GET, POST, PUT, DELETE, PATCH, OPTIONS"
      );
      proxyResponse.headers.set(
        "Access-Control-Allow-Headers",
        "Content-Type, Authorization, apikey, X-Client-Info"
      );

      return proxyResponse;
    } catch (err) {
      return new Response(
        JSON.stringify({ error: "Internal Server Error", message: String(err) }),
        {
          status: 500,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        }
      );
    }
  },
};
