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

  let body: { post_id: string; body: string };
  try {
    body = await req.json();
  } catch {
    return errorResponse("Gecersiz JSON", 400);
  }

  if (!body.post_id || !body.body?.trim()) {
    return errorResponse("post_id ve body gerekli", 400);
  }

  const { data: post, error: postErr } = await auth.supabase
    .from("posts")
    .select("id, branch_id, author_id")
    .eq("id", body.post_id)
    .eq("is_deleted", false)
    .single();

  if (postErr || !post) {
    return errorResponse("Paylasim bulunamadi", 404);
  }
  if (post.branch_id !== auth.profile.branch_id) {
    return errorResponse("Bu tesis icin yetkiniz yok", 403);
  }

  const { data: comment, error: insertErr } = await auth.supabase
    .from("post_comments")
    .insert({
      post_id: body.post_id,
      branch_id: post.branch_id,
      author_id: auth.userId,
      body: body.body.trim(),
    })
    .select("id, created_at, body")
    .single();

  if (insertErr) {
    console.error("community_post_comment insert error:", insertErr);
    return errorResponse(insertErr.message, 500);
  }

  await writeAudit(auth.supabase, {
    branch_id: post.branch_id,
    user_id: auth.userId,
    action: "comment_create",
    entity: "post_comments",
    entity_id: comment.id,
    meta: { post_id: body.post_id },
  });

  const { data: authorProfile } = await auth.supabase
    .from("user_profiles")
    .select("display_name")
    .eq("user_id", auth.userId)
    .single();

  const notifTitle = "Yeni yorum";
  const notifBody =
    (authorProfile?.display_name || "Bir kullanici") +
    ' paylasimina yorum yapti.';

  await auth.supabase.from("in_app_notifications").insert({
    branch_id: post.branch_id,
    user_id: post.author_id,
    type: "post_comment",
    title: notifTitle,
    body: notifBody,
    data: { post_id: body.post_id, comment_id: comment.id },
  });

  await auth.supabase.from("notification_outbox").insert({
    branch_id: post.branch_id,
    target_user_ids: [post.author_id],
    payload: {
      to: null,
      title: notifTitle,
      body: notifBody,
      data: { post_id: body.post_id, comment_id: comment.id, type: "post_comment" },
    },
    status: "queued",
  });

  return jsonResponse({ success: true, comment });
});
