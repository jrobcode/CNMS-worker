export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, x-api-key, Authorization",
          "Access-Control-Max-Age": "86400",
        },
      });
    }

    const path = url.pathname.replace(/^\/v1(?=\/|$)/, "") || "/";
    const target = `https://vycsekurctvnhfmkzwcl.supabase.co/functions/v1${path}${url.search}`;

    const headers = new Headers(request.headers);
    if (!headers.get("x-api-key")) {
      const auth = headers.get("authorization") || "";
      const m = auth.match(/^Bearer\s+(.+)$/i);
      if (m) headers.set("x-api-key", m[1]);
    }
    headers.delete("host");

    const res = await fetch(target, {
      method: request.method,
      headers,
      body: request.method !== "GET" && request.method !== "HEAD" ? request.body : null,
      redirect: "manual",
    });

    const newRes = new Response(res.body, res);
    newRes.headers.set("Access-Control-Allow-Origin", "*");
    return newRes;
  },
};

