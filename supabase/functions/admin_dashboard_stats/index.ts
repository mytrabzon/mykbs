import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  requireAdminOrMod,
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

  const auth = await requireAdminOrMod(req);
  if (auth instanceof Response) return auth;

  const branchId = auth.profile.branch_id;
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const [
    postsRes,
    commentsRes,
    outboxQueued,
    outboxSent,
    outboxFailedCount,
    outboxFailedList,
    auditRes,
  ] = await Promise.all([
    auth.supabase
      .from("posts")
      .select("id", { count: "exact", head: true })
      .eq("branch_id", branchId)
      .gte("created_at", since),
    auth.supabase
      .from("post_comments")
      .select("id", { count: "exact", head: true })
      .eq("branch_id", branchId)
      .gte("created_at", since),
    auth.supabase
      .from("notification_outbox")
      .select("id", { count: "exact", head: true })
      .eq("branch_id", branchId)
      .eq("status", "queued"),
    auth.supabase
      .from("notification_outbox")
      .select("id", { count: "exact", head: true })
      .eq("branch_id", branchId)
      .eq("status", "sent")
      .gte("sent_at", since),
    auth.supabase
      .from("notification_outbox")
      .select("id", { count: "exact", head: true })
      .eq("branch_id", branchId)
      .eq("status", "failed"),
    auth.supabase
      .from("notification_outbox")
      .select("id, last_error")
      .eq("branch_id", branchId)
      .eq("status", "failed")
      .order("created_at", { ascending: false })
      .limit(10),
    auth.supabase
      .from("audit_logs")
      .select("id, action, entity, created_at")
      .eq("branch_id", branchId)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  const failedList = ((outboxFailedList.data || []) as { id: string; last_error: string }[]).map((r) => ({
    id: r.id,
    error: r.last_error,
  }));

  return jsonResponse({
    last_24h: {
      posts: postsRes.count ?? 0,
      comments: commentsRes.count ?? 0,
    },
    notification_outbox: {
      queued: outboxQueued.count ?? 0,
      sent: outboxSent.count ?? 0,
      failed: outboxFailedCount.count ?? 0,
      last_errors: failedList,
    },
    recent_audit: auditRes.data || [],
  });
});
