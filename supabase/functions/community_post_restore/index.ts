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

  let body: { post_id: string };
  try {
    body = await req.json();
  } catch {
    return errorResponse("Gecersiz JSON", 400);
  }
  if (!body.post_id) return errorResponse("post_id gerekli", 400);

  const { data: post, error: fetchErr } = await auth.supabase
    .from("posts")
    .select("id, branch_id, is_deleted")
    .eq("id", body.post_id)
    .single();

  if (fetchErr || !post) return errorResponse("Paylasim bulunamadi", 404);
  if (post.branch_id !== auth.profile.branch_id) {
    return errorResponse("Bu tesis icin yetkiniz yok", 403);
  }
  if (!post.is_deleted) {
    return jsonResponse({ success: true, message: "Zaten yayinda" });
  }

  const { error: updateErr } = await auth.supabase
    .from("posts")
    .update({
      is_deleted: false,
      deleted_at: null,
      deleted_by: null,
    })
    .eq("id", body.post_id);

  if (updateErr) {
    console.error("community_post_restore error:", updateErr);
    return errorResponse(updateErr.message, 500);
  }

  await writeAudit(auth.supabase, {
    branch_id: post.branch_id,
    user_id: auth.userId,
    action: "post_restore",
    entity: "posts",
    entity_id: post.id,
  });

  return jsonResponse({ success: true });
});
