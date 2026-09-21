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
            // Activate license
      if (url.pathname === "/activate" && request.method === "POST") {
        const body = await request.json();
        const key = body.key;
        const deviceId = body.device_id;

        if (!key || !deviceId) {
          return new Response(
            JSON.stringify({
              success: false,
              error: "Missing key or device_id"
            }),
            { status: 400, headers }
          );
        }

        const license = await env.DB
          .prepare("SELECT * FROM licenses WHERE license_key = ?")
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

        if (license.status !== "ACTIVE") {
          return new Response(
            JSON.stringify({
              success: false,
              error: "License is not active"
            }),
            { status: 403, headers }
          );
        }

        if (license.device_id && license.device_id !== deviceId) {
          return new Response(
            JSON.stringify({
              success: false,
              error: "License is already activated on another device"
            }),
            { status: 403, headers }
          );
        }
        if (license.expires_at) {
          const expiresAt = new Date(license.expires_at);

          if (expiresAt <= new Date()) {
            await env.DB
              .prepare("UPDATE licenses SET status = 'EXPIRED' WHERE license_key = ?")
              .bind(key)
              .run();

            return new Response(
              JSON.stringify({
                success: false,
                error: "License expired"
              }),
              { status: 403, headers }
            );
          }

          return new Response(
            JSON.stringify({
              success: true,
              message: "License already activated",
              license_key: license.license_key,
              plan: license.plan,
              device_id: license.device_id,
              activated_at: license.activated_at,
              expires_at: license.expires_at
            }),
            { headers }
          );
        }
        const now = new Date();
        const expires = new Date(now);

        if (license.plan === "DAY") {
          expires.setDate(expires.getDate() + 1);
        }

        await env.DB
          .prepare(
            "UPDATE licenses SET device_id = ?, activated_at = ?, expires_at = ? WHERE license_key = ?"
          )
          .bind(
            deviceId,
            now.toISOString(),
            expires.toISOString(),
            key
          )
          .run();

        return new Response(
          JSON.stringify({
            success: true,
            message: "License activated",
            license_key: key,
            plan: license.plan,
            device_id: deviceId,
            activated_at: now.toISOString(),
            expires_at: expires.toISOString()
          }),
          { headers }
        );
      }
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
