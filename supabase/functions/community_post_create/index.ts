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

  let body: {
    branch_id: string;
    category?: string;
    title?: string;
    body: string;
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

  const category = body.category || "general";
  const validCategories = [
    "procedure",
    "warning",
    "question",
    "solution",
    "experience",
    "general",
  ];
  if (!validCategories.includes(category)) {
    return errorResponse("Gecersiz category", 400);
  }

  const { data: post, error } = await auth.supabase
    .from("posts")
    .insert({
      branch_id: body.branch_id,
      author_id: auth.userId,
      type: "post",
      category,
      title: body.title?.trim() || null,
      body: body.body.trim(),
      media: body.media || null,
    })
    .select("id, created_at, title, body, category")
    .single();

  if (error) {
    console.error("community_post_create error:", error);
    return errorResponse(error.message, 500);
  }

  await writeAudit(auth.supabase, {
    branch_id: body.branch_id,
    user_id: auth.userId,
    action: "post_create",
    entity: "posts",
    entity_id: post.id,
    meta: { category },
  });

  return jsonResponse({ success: true, post });
});
