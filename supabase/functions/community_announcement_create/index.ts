import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  requireAdminOrMod,
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

  const auth = await requireAdminOrMod(req);
  if (auth instanceof Response) return auth;

  let body: {
    branch_id: string;
    title?: string;
    body: string;
    category?: string;
    media?: { images?: string[]; files?: string[] };
  };
  try {
    body = await req.json();
  } catch {
    return errorResponse("Gecersiz JSON", 400);
  }

  if (!body.body?.trim()) return errorResponse("body gerekli", 400);
  if (!body.branch_id) return errorResponse("branch_id gerekli", 400);
  if (body.branch_id !== auth.profile.branch_id) {
    return errorResponse("Bu tesis icin yetkiniz yok", 403);
  }

  const { data: post, error } = await auth.supabase
    .from("posts")
    .insert({
      branch_id: body.branch_id,
      author_id: auth.userId,
      type: "announcement",
      category: body.category || "announcement",
      title: body.title?.trim() || null,
      body: body.body.trim(),
      media: body.media || null,
    })
    .select("id, created_at, title, body")
    .single();

  if (error) {
    console.error("community_announcement_create error:", error);
    return errorResponse(error.message, 500);
  }

  const { data: branchUsers } = await auth.supabase
    .from("user_profiles")
    .select("user_id")
    .eq("branch_id", body.branch_id)
    .eq("is_disabled", false);

  const userIds = (branchUsers || []).map((r: { user_id: string }) => r.user_id).filter((id: string) => id !== auth.userId);

  const notifTitle = body.title?.trim() || "Yeni duyuru";
  const notifBody = body.body.trim().slice(0, 200);

  if (userIds.length > 0) {
    const inserts = userIds.map((uid: string) => ({
      branch_id: body.branch_id,
      user_id: uid,
      type: "announcement",
      title: notifTitle,
      body: notifBody,
      data: { post_id: post.id },
    }));
    await auth.supabase.from("in_app_notifications").insert(inserts);

    await auth.supabase.from("notification_outbox").insert({
      branch_id: body.branch_id,
      target_user_ids: userIds,
      payload: {
        title: notifTitle,
        body: notifBody,
        data: { post_id: post.id, type: "announcement" },
      },
      status: "queued",
    });
  }

  await writeAudit(auth.supabase, {
    branch_id: body.branch_id,
    user_id: auth.userId,
    action: "announcement_create",
    entity: "posts",
    entity_id: post.id,
  });

  return jsonResponse({ success: true, post });
});
