import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createContext } from "../_shared/context.ts";
import { router, publicProcedure } from "../_shared/trpc.ts";
import { fetchRequestHandler } from "https://esm.sh/@trpc/server@10.45.0/adapters/fetch";
import { authRouter } from "../routers/auth.ts";
import { roomsRouter } from "../routers/rooms.ts";
import { facilitiesRouter } from "../routers/facilities.ts";
import { settingsRouter } from "../routers/settings.ts";
import { adminRouter } from "../routers/admin.ts";
import { getCorsHeaders } from "../_shared/auth.ts";

const appRouter = router({
  health: publicProcedure.query(() => ({
    status: "ok",
    message: "tRPC Edge Function is working",
    timestamp: new Date().toISOString(),
  })),

  auth: authRouter,
  rooms: roomsRouter,
  facilities: facilitiesRouter,
  settings: settingsRouter,
  admin: adminRouter,

  /** @deprecated Use facilities.list instead. Kept for backward compatibility. */
  getTesisler: publicProcedure.query(async ({ ctx }) => {
    const { data, error } = await ctx.supabase
      .from("tesis")
      .select("*")
      .limit(10);
    if (error) throw new Error(error.message);
    return { success: true, data };
  }),

  /** @deprecated Use rooms.get or equivalent. Kept for backward compatibility. */
  getTesisById: publicProcedure
    .input((val: unknown) => {
      if (typeof val === "object" && val !== null && "id" in val) {
        return val as { id: string };
      }
      throw new Error("Invalid input: id is required");
    })
    .query(async ({ input, ctx }) => {
      const { data, error } = await ctx.supabase
        .from("tesis")
        .select("*")
        .eq("id", input.id)
        .single();
      if (error) throw new Error(error.message);
      return { success: true, data };
    }),

  /** @deprecated Kept for backward compatibility. */
  createTesis: publicProcedure
    .input((val: unknown) => {
      if (typeof val === "object" && val !== null) return val as Record<string, unknown>;
      throw new Error("Invalid input");
    })
    .mutation(async ({ input, ctx }) => {
      const { data, error } = await ctx.supabase
        .from("tesis")
        .insert(input)
        .select()
        .single();
      if (error) throw new Error(error.message);
      return { success: true, data };
    }),
});

export type AppRouter = typeof appRouter;

const CORS_HEADERS = getCorsHeaders();
const HEALTH_PAYLOAD = {
  status: "ok",
  message: "tRPC Edge Function is working",
  timestamp: new Date().toISOString(),
};

serve(async (req) => {
  const url = new URL(req.url);

  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 204, headers: CORS_HEADERS });
  }

  if (req.method === "GET" && (url.pathname.endsWith("/health") || url.pathname.endsWith("/trpc/health"))) {
    return new Response(JSON.stringify(HEALTH_PAYLOAD), {
      status: 200,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  const res = await fetchRequestHandler({
    endpoint: "/functions/v1/trpc",
    req,
    router: appRouter,
    createContext: () => createContext(req),
    onError: ({ error, path }) => {
      console.error("[tRPC] error", path, error.code, error.message);
    },
  });

  const headers = new Headers(res.headers);
  Object.entries(CORS_HEADERS).forEach(([k, v]) => headers.set(k, v));
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
});
