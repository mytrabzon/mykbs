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

  let body: { post_id: string };
  try {
    body = await req.json();
  } catch {
    body = {} as { post_id: string };
  }
  if (!body.post_id) return errorResponse("post_id gerekli", 400);

  const { data: post, error: postErr } = await auth.supabase
    .from("posts")
    .select("id, branch_id")
    .eq("id", body.post_id)
    .eq("is_deleted", false)
    .single();

  if (postErr || !post) return errorResponse("Paylasim bulunamadi", 404);
  if (post.branch_id !== auth.profile.branch_id) {
    return errorResponse("Bu tesis icin yetkiniz yok", 403);
  }

  const { data: comments, error } = await auth.supabase
    .from("post_comments")
    .select("id, post_id, author_id, body, created_at")
    .eq("post_id", body.post_id)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("community_post_comments_list error:", error);
    return errorResponse(error.message, 500);
  }

  const list = comments || [];
  const authorIds = [...new Set(list.map((c: { author_id: string }) => c.author_id))];
  const { data: profiles } = await auth.supabase
    .from("user_profiles")
    .select("user_id, display_name, avatar_url")
    .in("user_id", authorIds);
  const profileMap = new Map((profiles || []).map((p: { user_id: string; display_name: string | null; avatar_url: string | null }) => [p.user_id, p]));

  const withAuthor = list.map((c: { author_id: string; [k: string]: unknown }) => {
    const p = profileMap.get(c.author_id);
    return { ...c, author: p ? { display_name: p.display_name, avatar_url: p.avatar_url } : null };
  });

  return jsonResponse({ comments: withAuthor });
});
