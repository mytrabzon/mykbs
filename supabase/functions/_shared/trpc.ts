import { initTRPC, TRPCError } from "https://esm.sh/@trpc/server@10.45.0";
import type { Context } from "./context.ts";

const t = initTRPC.context<Context>().create();

export const router = t.router;
export const publicProcedure = t.procedure;

/** Requires ctx.user; throws UNAUTHORIZED otherwise. Use for me, rooms_list, etc. */
export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Yetkilendirme gerekli",
    });
  }
  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

/** Sadece tek gizli admin hesabı (super_admin UID). Diğer kullanıcılar FORBIDDEN. */
const SUPER_ADMIN_UID = "67fe79fc-b6ac-4f45-a436-88e30e3171ef";

export const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.id !== SUPER_ADMIN_UID) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Bu işlem için yetkiniz yok",
    });
  }
  return next({ ctx });
});
