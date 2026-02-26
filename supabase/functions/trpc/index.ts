import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createContext } from '../_shared/context.ts';
import { router, publicProcedure } from '../_shared/trpc.ts';
import { fetchRequestHandler } from 'https://esm.sh/@trpc/server@10.45.0/adapters/fetch';

// tRPC router tanımla
const appRouter = router({
  health: publicProcedure.query(() => {
    const payload = {
      status: 'ok',
      message: 'tRPC Edge Function is working',
      timestamp: new Date().toISOString(),
    };
    console.log('[tRPC] health', payload);
    return payload;
  }),

  getTesisler: publicProcedure.query(async ({ ctx }) => {
    try {
      const { data, error } = await ctx.supabase
        .from('tesis')
        .select('*')
        .limit(10);

      if (error) throw new Error(error.message);
      return { success: true, data };
    } catch (error) {
      throw new Error(`Failed to fetch tesisler: ${error.message}`);
    }
  }),

  getTesisById: publicProcedure
    .input((val: unknown) => {
      if (typeof val === 'object' && val !== null && 'id' in val) {
        return val as { id: string };
      }
      throw new Error('Invalid input: id is required');
    })
    .query(async ({ input, ctx }) => {
      try {
        const { data, error } = await ctx.supabase
          .from('tesis')
          .select('*')
          .eq('id', input.id)
          .single();

        if (error) throw new Error(error.message);
        return { success: true, data };
      } catch (error) {
        throw new Error(`Failed to fetch tesis: ${error.message}`);
      }
    }),

  createTesis: publicProcedure
    .input((val: unknown) => {
      if (typeof val === 'object' && val !== null) {
        return val as any;
      }
      throw new Error('Invalid input');
    })
    .mutation(async ({ input, ctx }) => {
      try {
        const { data, error } = await ctx.supabase
          .from('tesis')
          .insert(input)
          .select()
          .single();

        if (error) throw new Error(error.message);
        return { success: true, data };
      } catch (error) {
        throw new Error(`Failed to create tesis: ${error.message}`);
      }
    }),
});

export type AppRouter = typeof appRouter;

const HEALTH_PAYLOAD = {
  status: 'ok',
  message: 'tRPC Edge Function is working',
  timestamp: new Date().toISOString(),
};

serve((req) => {
  const url = new URL(req.url);
  console.log('[tRPC]', req.method, url.pathname, url.search || '');
  // GET /functions/v1/trpc/health → doğrudan 200 (adapter path 404 dönüyordu)
  if (req.method === 'GET' && (url.pathname.endsWith('/health') || url.pathname === 'health')) {
    console.log('[tRPC] health (direct)', HEALTH_PAYLOAD);
    return new Response(JSON.stringify(HEALTH_PAYLOAD), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  return fetchRequestHandler({
    endpoint: '/functions/v1/trpc',
    req,
    router: appRouter,
    createContext: () => createContext(req),
  }).then((res) => {
    console.log('[tRPC]', res.status, url.pathname);
    return res;
  });
});

