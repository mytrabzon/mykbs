import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  requireAuth,
  getCorsHeaders,
  jsonResponse,
  errorResponse,
} from "../_shared/auth.ts";
import { BUCKET_AVATARS } from "../_shared/storage.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: getCorsHeaders() });
  }
  if (req.method !== "POST") {
    return errorResponse("Method not allowed", 405);
  }

  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;

  let body: { image_base64: string; mime?: string };
  try {
    body = await req.json();
  } catch {
    return errorResponse("Gecersiz JSON", 400);
  }
  if (!body.image_base64) {
    return errorResponse("image_base64 gerekli", 400);
  }

  // Data URL öneki veya boşluk/satır sonu atob'u bozabilir; temizle
  let raw = String(body.image_base64).trim();
  const base64Prefix = /^data:image\/[^;]+;base64,/i;
  if (base64Prefix.test(raw)) {
    raw = raw.replace(base64Prefix, "");
  }
  raw = raw.replace(/\s/g, "");

  let buf: Uint8Array;
  try {
    buf = Uint8Array.from(atob(raw), (c) => c.charCodeAt(0));
  } catch (e) {
    console.error("upload_avatar base64 decode error:", e);
    return errorResponse("Gecersiz resim verisi (base64 decode hatasi)", 400);
  }
  if (buf.length === 0) {
    return errorResponse("Bos resim verisi", 400);
  }
  const ext = (body.mime || "image/jpeg").split("/")[1] || "jpg";
  const path = `${auth.userId}.${ext}`;

  const { data, error } = await auth.supabase.storage
    .from(BUCKET_AVATARS)
    .upload(path, buf, {
      contentType: body.mime || "image/jpeg",
      upsert: true,
    });

  if (error) {
    console.error("upload_avatar error:", error);
    if (error.message?.includes("Bucket not found")) {
      return errorResponse(BUCKET_AVATARS + " bucket bulunamadi. Migration 0024 veya Dashboard'dan olusturun.", 500);
    }
    return errorResponse(error.message, 500);
  }

  const { data: urlData } = auth.supabase.storage.from(BUCKET_AVATARS).getPublicUrl(data.path);
  return jsonResponse({ url: urlData.publicUrl });
});
