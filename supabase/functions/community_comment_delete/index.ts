import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  requireAuth,
  getCorsHeaders,
  jsonResponse,
  errorResponse,
  writeAudit,
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

  let body: { comment_id: string };
  try {
    body = await req.json();
  } catch {
    return errorResponse("Gecersiz JSON", 400);
  }
  if (!body.comment_id) return errorResponse("comment_id gerekli", 400);

  const { data: comment, error: fetchErr } = await auth.supabase
    .from("post_comments")
    .select("id, post_id, branch_id, author_id")
    .eq("id", body.comment_id)
    .single();

  if (fetchErr || !comment) return errorResponse("Yorum bulunamadi", 404);
  if (comment.branch_id !== auth.profile.branch_id) {
    return errorResponse("Bu tesis icin yetkiniz yok", 403);
  }

  const isMod = ["admin", "moderator"].includes(auth.profile.role);
  const isOwner = comment.author_id === auth.userId;
  if (!isOwner && !isMod) {
    return errorResponse("Bu yorumu silemezsiniz", 403);
  }

  const { error: deleteErr } = await auth.supabase
    .from("post_comments")
    .delete()
    .eq("id", body.comment_id);

  if (deleteErr) {
    console.error("community_comment_delete error:", deleteErr);
    return errorResponse(deleteErr.message, 500);
  }

  await writeAudit(auth.supabase, {
    branch_id: comment.branch_id,
    user_id: auth.userId,
    action: "comment_delete",
    entity: "post_comments",
    entity_id: comment.id,
    meta: { post_id: comment.post_id },
  });

  return jsonResponse({ success: true });
});
