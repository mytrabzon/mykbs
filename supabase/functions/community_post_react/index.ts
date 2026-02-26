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

  let body: { post_id: string; action: "like" | "unlike" };
  try {
    body = await req.json();
  } catch {
    return errorResponse("Gecersiz JSON", 400);
  }

  if (!body.post_id) return errorResponse("post_id gerekli", 400);
  const action = body.action === "unlike" ? "unlike" : "like";

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

  if (action === "unlike") {
    await auth.supabase
      .from("post_reactions")
      .delete()
      .eq("post_id", body.post_id)
      .eq("user_id", auth.userId);
    return jsonResponse({ success: true, liked: false });
  }

  const { error: insertErr } = await auth.supabase.from("post_reactions").upsert(
    {
      post_id: body.post_id,
      user_id: auth.userId,
      branch_id: post.branch_id,
      type: "like",
    },
    { onConflict: "post_id,user_id" }
  );

  if (insertErr) {
    console.error("community_post_react error:", insertErr);
    return errorResponse(insertErr.message, 500);
  }
  return jsonResponse({ success: true, liked: true });
});
