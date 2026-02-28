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

  const list = posts || [];
  const authorIds = [...new Set(list.map((p: { author_id: string }) => p.author_id).filter(Boolean))];
  let profiles: Record<string, { display_name: string | null; avatar_url: string | null }> = {};
  if (authorIds.length > 0) {
    const { data: rows } = await auth.supabase
      .from("user_profiles")
      .select("user_id, display_name, avatar_url")
      .in("user_id", authorIds);
    if (rows?.length) {
      for (const r of rows) {
        profiles[r.user_id] = { display_name: r.display_name ?? null, avatar_url: r.avatar_url ?? null };
      }
    }
  }

  const postsWithAuthor = list.map((p: { author_id: string; [k: string]: unknown }) => ({
    ...p,
    author: p.author_id
      ? {
          user_id: p.author_id,
          display_name: profiles[p.author_id]?.display_name ?? null,
          avatar_url: profiles[p.author_id]?.avatar_url ?? null,
        }
      : null,
  }));

  return jsonResponse({ posts: postsWithAuthor, total: count ?? 0 });
});
