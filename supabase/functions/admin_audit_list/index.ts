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

  let body: {
    branch_id?: string;
    action?: string;
    entity?: string;
    user_id?: string;
    from_date?: string;
    to_date?: string;
    limit?: number;
    offset?: number;
  };
  try {
    body = await req.json().catch(() => ({}));
  } catch {
    body = {};
  }

  const branchId = body.branch_id || auth.profile.branch_id;
  if (branchId !== auth.profile.branch_id && auth.profile.role !== "admin") {
    return errorResponse("Bu tesis icin yetkiniz yok", 403);
  }

  const limit = Math.min(Math.max(Number(body.limit) || 50, 1), 200);
  const offset = Math.max(Number(body.offset) || 0, 0);

  let query = auth.supabase
    .from("audit_logs")
    .select("id, branch_id, user_id, action, entity, entity_id, meta_json, created_at", { count: "exact" })
    .eq("branch_id", branchId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (body.action) query = query.eq("action", body.action);
  if (body.entity) query = query.eq("entity", body.entity);
  if (body.user_id) query = query.eq("user_id", body.user_id);
  if (body.from_date) query = query.gte("created_at", body.from_date);
  if (body.to_date) query = query.lte("created_at", body.to_date);

  const { data: logs, error, count } = await query;

  if (error) {
    console.error("admin_audit_list error:", error);
    return errorResponse(error.message, 500);
  }
  return jsonResponse({ logs: logs || [], total: count ?? 0 });
});
