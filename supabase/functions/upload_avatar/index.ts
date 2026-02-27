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

  let body: { image_base64: string; mime?: string };
  try {
    body = await req.json();
  } catch {
    return errorResponse("Gecersiz JSON", 400);
  }
  if (!body.image_base64) {
    return errorResponse("image_base64 gerekli", 400);
  }

  const buf = Uint8Array.from(atob(body.image_base64), (c) => c.charCodeAt(0));
  const ext = (body.mime || "image/jpeg").split("/")[1] || "jpg";
  const path = `${auth.userId}.${ext}`;

  const { data, error } = await auth.supabase.storage
    .from("avatars")
    .upload(path, buf, {
      contentType: body.mime || "image/jpeg",
      upsert: true,
    });

  if (error) {
    console.error("upload_avatar error:", error);
    if (error.message?.includes("Bucket not found")) {
      return errorResponse("avatars bucket bulunamadi. Dashboard'dan olusturun.", 500);
    }
    return errorResponse(error.message, 500);
  }

  const { data: urlData } = auth.supabase.storage.from("avatars").getPublicUrl(data.path);
  return jsonResponse({ url: urlData.publicUrl });
});
