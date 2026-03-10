import { z } from "https://esm.sh/zod@3.22.4";
import { router, protectedProcedure } from "../_shared/trpc.ts";

export const authRouter = router({
  /** Current user + profile (branch_id, role, display_name, is_admin). Same contract as Edge Function me. */
  me: protectedProcedure.query(async ({ ctx }) => {
    const { data: profileRow } = await ctx.supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", ctx.user.id)
      .maybeSingle();
    const is_admin = profileRow?.is_admin === true || ctx.user.profile.role === "admin";
    return {
      user_id: ctx.user.id,
      branch_id: ctx.user.profile.branch_id,
      role: ctx.user.profile.role,
      display_name: ctx.user.profile.display_name,
      title: ctx.user.profile.title,
      avatar_url: ctx.user.profile.avatar_url,
      is_admin,
    };
  }),
});
