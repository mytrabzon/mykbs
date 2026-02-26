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

  let body: { limit?: number; offset?: number; unread_only?: boolean };
  try {
    body = await req.json().catch(() => ({}));
  } catch {
    body = {};
  }

  const limit = Math.min(Math.max(Number(body.limit) || 50, 1), 100);
  const offset = Math.max(Number(body.offset) || 0, 0);

  let query = auth.supabase
    .from("in_app_notifications")
    .select("id, type, title, body, data, is_read, created_at", { count: "exact" })
    .eq("user_id", auth.userId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (body.unread_only) query = query.eq("is_read", false);

  const { data: list, error, count } = await query;

  if (error) {
    console.error("in_app_notifications_list error:", error);
    return errorResponse(error.message, 500);
  }
  return jsonResponse({ notifications: list || [], total: count ?? 0 });
});
