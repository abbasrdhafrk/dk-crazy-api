export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // CORS
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
            result: result
          }),
          { headers }
        );
      }

      return new Response(
        JSON.stringify({
          success: false,
          error: "Not found"
        }),
        {
          status: 404,
          headers
        }
      );

    } catch (error) {
      return new Response(
        JSON.stringify({
          success: false,
          error: error.message
        }),
        {
          status: 500,
          headers
        }
      );
    }
  }
};
