import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  requireAuth,
  getCorsHeaders,
  jsonResponse,
  errorResponse,
} from "../_shared/auth.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: getCorsHeaders() });
  }
  if (req.method !== "POST") {
    return errorResponse("Method not allowed", 405);
  }

  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;

  let body: { token: string; platform: "ios" | "android" };
  try {
    body = await req.json();
  } catch {
    return errorResponse("Gecersiz JSON", 400);
  }

  if (!body.token?.trim()) return errorResponse("token gerekli", 400);
  if (!["ios", "android"].includes(body.platform || "")) {
    return errorResponse("platform ios veya android olmali", 400);
  }

  const { error } = await auth.supabase.from("user_push_tokens").upsert(
    {
      user_id: auth.userId,
      token: body.token.trim(),
      platform: body.platform,
      last_seen_at: new Date().toISOString(),
    },
    { onConflict: "user_id,token" }
  );

  if (error) {
    console.error("push_register_token error:", error);
    return errorResponse(error.message, 500);
  }
  return jsonResponse({ success: true });
});
