import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  requireAuth,
  getCorsHeaders,
  jsonResponse,
  errorResponse,
} from "../_shared/auth.ts";
import { BUCKET_COMMUNITY } from "../_shared/storage.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: getCorsHeaders() });
  }
  if (req.method !== "POST") {
    return jsonResponse(
      { error: "Sadece POST desteklenir. Authorization: Bearer <token> ve body: { branch_id, image_base64 } gerekir.", code: "METHOD_NOT_ALLOWED" },
      405
    );
  }

  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;

  let body: { branch_id: string; image_base64: string; mime?: string };
  try {
    body = await req.json();
  } catch {
    return errorResponse("Gecersiz JSON", 400);
  }
  if (!body.branch_id || body.image_base64 == null) {
    return errorResponse("branch_id ve image_base64 gerekli", 400);
  }
  const rawBase64 = typeof body.image_base64 === "string" ? body.image_base64.trim() : "";
  if (!rawBase64) {
    return errorResponse("image_base64 gecerli bir metin olmali", 400);
  }
  if (body.branch_id !== auth.profile.branch_id) {
    return errorResponse("Bu tesis icin yetkiniz yok", 403);
  }

  let buf: Uint8Array;
  try {
    buf = Uint8Array.from(atob(rawBase64.replace(/^data:image\/[^;]+;base64,/i, "")), (c) => c.charCodeAt(0));
  } catch {
    return errorResponse("Gecersiz resim verisi (base64 decode hatasi)", 400);
  }
  const ext = (body.mime || "image/jpeg").split("/")[1] || "jpg";
  const path = `${body.branch_id}/${crypto.randomUUID()}.${ext}`;

  const { data, error } = await auth.supabase.storage
    .from(BUCKET_COMMUNITY)
    .upload(path, buf, {
      contentType: body.mime || "image/jpeg",
      upsert: false,
    });

  if (error) {
    console.error("upload_community_image error:", error);
    if (error.message?.includes("Bucket not found")) {
      return errorResponse(BUCKET_COMMUNITY + " bucket bulunamadi. Migration 0024 veya Dashboard'dan olusturun.", 500);
    }
    return errorResponse(error.message, 500);
  }

  const { data: urlData } = auth.supabase.storage.from(BUCKET_COMMUNITY).getPublicUrl(data.path);
  return jsonResponse({ url: urlData.publicUrl, path: data.path });
});
