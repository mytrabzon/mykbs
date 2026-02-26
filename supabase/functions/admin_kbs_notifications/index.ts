import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  requireAdminOrMod,
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

  const auth = await requireAdminOrMod(req);
  if (auth instanceof Response) return auth;

  let body: { branch_id?: string; status?: string; limit?: number; offset?: number };
  try {
    body = await req.json().catch(() => ({}));
  } catch {
    body = {};
  }

  const branchId = body.branch_id || auth.profile.branch_id;
  if (branchId !== auth.profile.branch_id && auth.profile.role !== "admin") {
    return errorResponse("Bu tesis icin yetkiniz yok", 403);
  }

  const limit = Math.min(Math.max(Number(body.limit) || 50, 1), 100);
  const offset = Math.max(Number(body.offset) || 0, 0);

  let query = auth.supabase
    .from("notification_outbox")
    .select("id, branch_id, target_user_ids, payload, status, last_error, created_at, sent_at", { count: "exact" })
    .eq("branch_id", branchId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (body.status) query = query.eq("status", body.status);

  const { data: rows, error, count } = await query;

  if (error) {
    console.error("admin_kbs_notifications error:", error);
    return errorResponse(error.message, 500);
  }

  return jsonResponse({
    notifications: rows || [],
    total: count ?? 0,
    note: "KBS (jandarma/polis) bildirim detaylari mevcut backend API /bildirimler uzerinden alinabilir.",
  });
});
