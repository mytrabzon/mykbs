import { z } from "https://esm.sh/zod@3.22.4";
import { router, adminProcedure } from "../_shared/trpc.ts";

export const adminRouter = router({
  /** Dashboard özet istatistikleri — sadece super_admin UID. */
  admin_dashboard_stats: adminProcedure.query(async ({ ctx }) => {
    const [{ count: toplamKullanici }, { count: toplamTesis }, { data: tesisData }] = await Promise.all([
      ctx.supabase.from("user_profiles").select("user_id", { count: "exact", head: true }),
      ctx.supabase.from("tesis").select("id", { count: "exact", head: true }).catch(() => ({ count: 0 })),
      ctx.supabase.from("tesis").select("id").limit(1).then((r) => r.data),
    ]);
    const aktifTesis = tesisData?.length ?? 0;
    let toplamOda = 0;
    try {
      const { count } = await ctx.supabase.from("guests").select("id", { count: "exact", head: true });
      toplamOda = count ?? 0;
    } catch {
      // guests tablosu yoksa 0
    }
    return {
      toplamKullanici: toplamKullanici ?? 0,
      aktifTesis: toplamTesis ?? aktifTesis ?? 0,
      toplamTesis: toplamTesis ?? 0,
      bugunGiris: 0,
      toplamOda,
    };
  }),

  /** Son kullanıcılar listesi — sadece super_admin. */
  admin_user_list: adminProcedure
    .input(z.object({ limit: z.number().min(1).max(200).default(50) }))
    .query(async ({ ctx, input }) => {
      const { data: rows, error } = await ctx.supabase
        .from("user_profiles")
        .select("user_id, branch_id, role, display_name, title")
        .order("user_id", { ascending: true })
        .limit(input.limit);
      if (error) throw new Error(error.message);
      const list = (rows || []).map((r: Record<string, unknown>) => ({
        id: r.user_id,
        ad: (r.display_name as string)?.split(" ")[0] ?? "",
        soyad: (r.display_name as string)?.split(" ").slice(1).join(" ") ?? "",
        email: "",
        role: r.role ?? "user",
        created_at: null,
      }));
      return list;
    }),
});
