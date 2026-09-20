export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    const headers = {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers });
    }

    try {
      // الصفحة الرئيسية
      if (url.pathname === "/") {
        return new Response(
          JSON.stringify({
            status: "online",
            message: "DK Crazy API is working"
          }),
          { headers }
        );
      }

      // فحص قاعدة البيانات
      if (url.pathname === "/db-test") {
        const result = await env.DB
          .prepare("SELECT 1 AS test")
          .first();

        return new Response(
          JSON.stringify({
            success: true,
            database: "connected",
            result
          }),
          { headers }
        );
      }

      // فحص مفتاح
      if (url.pathname === "/check") {
        const key = url.searchParams.get("key");

        if (!key) {
          return new Response(
            JSON.stringify({
              success: false,
              error: "Missing key"
            }),
            { status: 400, headers }
          );
        }

        const license = await env.DB
          .prepare(
            "SELECT license_key, plan, device_id, activated_at, expires_at, status FROM licenses WHERE license_key = ?"
          )
          .bind(key)
          .first();

        if (!license) {
          return new Response(
            JSON.stringify({
              success: false,
              error: "Invalid key"
            }),
            { status: 404, headers }
          );
        }

        return new Response(
          JSON.stringify({
            success: true,
            license
          }),
          { headers }
        );
      }

      return new Response(
        JSON.stringify({
          success: false,
          error: "Not found"
        }),
        { status: 404, headers }
      );

    } catch (error) {
      return new Response(
        JSON.stringify({
          success: false,
          error: error.message
        }),
        { status: 500, headers }
      );
    }
  }
};
