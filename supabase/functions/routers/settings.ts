import { router, protectedProcedure } from "../_shared/trpc.ts";

export const settingsRouter = router({
  /** KBS and branch settings. Same contract as Edge Function settings_get. */
  get: protectedProcedure.query(async ({ ctx }) => {
    const branchId = ctx.user.profile.branch_id;
    const { data: branch } = await ctx.supabase
      .from("branches")
      .select("kbs_turu, kbs_tesis_kodu, kbs_web_servis_sifre")
      .eq("id", branchId)
      .single();
    const b = (branch || {}) as {
      kbs_turu?: string | null;
      kbs_tesis_kodu?: string | null;
      kbs_web_servis_sifre?: string | null;
    };
    return {
      kbsTuru: b.kbs_turu ?? null,
      kbsTesisKodu: b.kbs_tesis_kodu ?? "",
      kbsWebServisSifre: b.kbs_web_servis_sifre ?? "",
      ipKisitAktif: false,
    };
  }),
});
