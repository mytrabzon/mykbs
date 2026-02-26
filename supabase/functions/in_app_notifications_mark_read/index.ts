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

  let body: { notification_id?: string; all?: boolean };
  try {
    body = await req.json();
  } catch {
    return errorResponse("Gecersiz JSON", 400);
  }

  if (body.all) {
    const { error } = await auth.supabase
      .from("in_app_notifications")
      .update({ is_read: true })
      .eq("user_id", auth.userId);
    if (error) {
      console.error("in_app_notifications_mark_read all error:", error);
      return errorResponse(error.message, 500);
    }
    return jsonResponse({ success: true });
  }

  if (!body.notification_id) return errorResponse("notification_id veya all gerekli", 400);

  const { error } = await auth.supabase
    .from("in_app_notifications")
    .update({ is_read: true })
    .eq("id", body.notification_id)
    .eq("user_id", auth.userId);

  if (error) {
    console.error("in_app_notifications_mark_read error:", error);
    return errorResponse(error.message, 500);
  }
  return jsonResponse({ success: true });
});
