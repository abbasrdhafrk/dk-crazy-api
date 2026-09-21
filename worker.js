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
        return json({
          status: "online",
          message: "DK Crazy API is working"
        }, headers);
      }

      // فحص قاعدة البيانات
      if (url.pathname === "/db-test") {
        const result = await env.DB
          .prepare("SELECT 1 AS test")
          .first();

        return json({
          success: true,
          database: "connected",
          result
        }, headers);
      }

      // فحص المفتاح
      if (url.pathname === "/check" && request.method === "POST") {
        const body = await request.json();

        const key = String(body.key || "").trim();
        const deviceId = String(body.device_id || "").trim();

        if (!key) {
          return json({
            success: false,
            error: "KEY_REQUIRED"
          }, headers, 400);
        }

        const license = await env.DB
          .prepare("SELECT * FROM licenses WHERE license_key = ?")
          .bind(key)
          .first();

        if (!license) {
          return json({
            success: false,
            valid: false,
            error: "INVALID_KEY"
          }, headers, 404);
        }

        if (license.status !== "ACTIVE") {
          return json({
            success: false,
            valid: false,
            error: "KEY_BLOCKED"
          }, headers, 403);
        }

        if (
          license.expires_at &&
          new Date(license.expires_at).getTime() <= Date.now()
        ) {
          await env.DB
            .prepare(
              "UPDATE licenses SET status = 'EXPIRED' WHERE license_key = ?"
            )
            .bind(key)
            .run();

          return json({
            success: false,
            valid: false,
            error: "KEY_EXPIRED"
          }, headers, 403);
        }

        if (
          deviceId &&
          license.device_id &&
          license.device_id !== deviceId
        ) {
          return json({
            success: false,
            valid: false,
            error: "DEVICE_MISMATCH"
          }, headers, 403);
        }

        return json({
          success: true,
          valid: true,
          plan: license.plan,
          expires_at: license.expires_at || null
        }, headers);
      }

      // تفعيل المفتاح لأول جهاز
      if (url.pathname === "/activate" && request.method === "POST") {
        const body = await request.json();

        const key = String(body.key || "").trim();
        const deviceId = String(body.device_id || "").trim();

        if (!key || !deviceId) {
          return json({
            success: false,
            error: "KEY_AND_DEVICE_REQUIRED"
          }, headers, 400);
        }

        const license = await env.DB
          .prepare("SELECT * FROM licenses WHERE license_key = ?")
          .bind(key)
          .first();

        if (!license) {
          return json({
            success: false,
            error: "INVALID_KEY"
          }, headers, 404);
        }

        if (license.status !== "ACTIVE") {
          return json({
            success: false,
            error: "KEY_NOT_ACTIVE"
          }, headers, 403);
        }

        if (
          license.expires_at &&
          new Date(license.expires_at).getTime() <= Date.now()
        ) {
          await env.DB
            .prepare(
              "UPDATE licenses SET status = 'EXPIRED' WHERE license_key = ?"
            )
            .bind(key)
            .run();

          return json({
            success: false,
            error: "KEY_EXPIRED"
          }, headers, 403);
        }

        // المفتاح مستخدم على جهاز آخر
        if (license.device_id && license.device_id !== deviceId) {
          return json({
            success: false,
            error: "KEY_ALREADY_USED"
          }, headers, 403);
        }

        // مفعّل مسبقاً على نفس الجهاز
        if (license.device_id === deviceId) {
          return json({
            success: true,
            activated: true,
            already_activated: true,
            plan: license.plan,
            expires_at: license.expires_at
          }, headers);
        }

        let days;

        if (license.plan === "DAY") {
          days = 1;
        } else if (license.plan === "WEEK") {
          days = 7;
        } else {
          return json({
            success: false,
            error: "INVALID_PLAN"
          }, headers, 400);
        }

        const activatedAt = new Date();
        const expiresAt = new Date(
          activatedAt.getTime() + days * 24 * 60 * 60 * 1000
        );

        await env.DB
          .prepare(`
            UPDATE licenses
            SET device_id = ?,
                activated_at = ?,
                expires_at = ?
            WHERE license_key = ?
          `)
          .bind(
            deviceId,
            activatedAt.toISOString(),
            expiresAt.toISOString(),
            key
          )
          .run();

        return json({
          success: true,
          activated: true,
          key,
          plan: license.plan,
          activated_at: activatedAt.toISOString(),
          expires_at: expiresAt.toISOString()
        }, headers);
      }

      // إنشاء مفتاح جديد
      if (url.pathname === "/create-key" && request.method === "POST") {
        const body = await request.json();

        if (!env.ADMIN_SECRET || body.secret !== env.ADMIN_SECRET) {
          return json({
            success: false,
            error: "UNAUTHORIZED"
          }, headers, 401);
        }

        const plan = String(body.plan || "").toUpperCase();

        if (plan !== "DAY" && plan !== "WEEK") {
          return json({
            success: false,
            error: "PLAN_MUST_BE_DAY_OR_WEEK"
          }, headers, 400);
        }

        const random = crypto.randomUUID()
          .replaceAll("-", "")
          .substring(0, 10)
          .toUpperCase();

        const key = `DK-CRAZY-${plan}-${random}`;

        await env.DB
          .prepare(`
            INSERT INTO licenses
            (license_key, plan, status)
            VALUES (?, ?, 'ACTIVE')
          `)
          .bind(key, plan)
          .run();

        return json({
          success: true,
          key,
          plan,
          status: "ACTIVE"
        }, headers);
      }

      return json({
        success: false,
        error: "NOT_FOUND"
      }, headers, 404);

    } catch (error) {
      return json({
        success: false,
        error: "SERVER_ERROR",
        message: String(error.message || error)
      }, headers, 500);
    }
  }
};

function json(data, headers, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers
  });
}