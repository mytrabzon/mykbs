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

  let body: { display_name?: string; avatar_url?: string; title?: string };
  try {
    body = await req.json();
  } catch {
    return errorResponse("Gecersiz JSON", 400);
  }

  const updates: { display_name?: string; avatar_url?: string; title?: string | null } = {};
  if (typeof body.display_name === "string") {
    updates.display_name = body.display_name.trim() || null;
  }
  if (typeof body.avatar_url === "string") {
    updates.avatar_url = body.avatar_url.trim() || null;
  }
  if (typeof body.title === "string") {
    updates.title = body.title.trim() || null;
  }

  if (Object.keys(updates).length === 0) {
    return jsonResponse({ success: true, profile: auth.profile });
  }

  const { data, error } = await auth.supabase
    .from("user_profiles")
    .update(updates)
    .eq("user_id", auth.userId)
    .select("user_id, display_name, avatar_url, title")
    .single();

  if (error) {
    console.error("profile_update error:", error);
    return errorResponse(error.message, 500);
  }

  return jsonResponse({ success: true, profile: data });
});
