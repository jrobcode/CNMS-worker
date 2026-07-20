/**
 * Cloudflare Worker — app.cnms.io
 * Proxies all requests to Supabase backend.
 */

const SUPABASE_URL = "https://vycsekurctvnhfmkzwcl.supabase.co";

export default {
  async fetch(request: Request, _env: Env, _ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // Build the upstream URL — forward the path and query string as-is
    const upstreamUrl = new URL(url.pathname + url.search, SUPABASE_URL);

    // Forward the request with the original method, headers, and body
    const upstreamRequest = new Request(upstreamUrl.toString(), {
      method: request.method,
      headers: request.headers,
      body: request.body,
      // Preserve the original request signal for cancellation
      signal: request.signal,
    });

    // Add the Host header so Supabase sees the original host
    upstreamRequest.headers.set("Host", new URL(SUPABASE_URL).host);

    try {
      const response = await fetch(upstreamRequest);

      // Clone the response so we can modify headers
      const proxyResponse = new Response(response.body, response);

      // Add CORS headers for browser-based requests
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
