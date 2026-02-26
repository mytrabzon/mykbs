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

  let body: {
    branch_id?: string;
    type?: "post" | "announcement";
    category?: string;
    limit?: number;
    offset?: number;
    include_deleted?: boolean;
  };
  try {
    body = await req.json().catch(() => ({}));
  } catch {
    body = {};
  }

  const branchId = body.branch_id || auth.profile.branch_id;
  if (branchId !== auth.profile.branch_id) {
    return errorResponse("Bu tesis icin yetkiniz yok", 403);
  }

  const limit = Math.min(Math.max(Number(body.limit) || 20, 1), 100);
  const offset = Math.max(Number(body.offset) || 0, 0);
  const includeDeleted = body.include_deleted === true && ["admin", "moderator"].includes(auth.profile.role);

  let query = auth.supabase
    .from("posts")
    .select("id, branch_id, author_id, type, category, title, body, media, is_pinned, is_deleted, created_at, updated_at", { count: "exact" })
    .eq("branch_id", branchId)
    .order("is_pinned", { ascending: false })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (!includeDeleted) query = query.eq("is_deleted", false);
  if (body.type) query = query.eq("type", body.type);
  if (body.category) query = query.eq("category", body.category);

  const { data: posts, error, count } = await query;

  if (error) {
    console.error("community_post_list error:", error);
    return errorResponse(error.message, 500);
  }

  return jsonResponse({ posts: posts || [], total: count ?? 0 });
});
