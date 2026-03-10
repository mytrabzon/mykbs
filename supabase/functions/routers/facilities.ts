import { router, protectedProcedure } from "../_shared/trpc.ts";

export const facilitiesRouter = router({
  /** Current branch facility + summary. Same contract as Edge Function facilities_list. */
  list: protectedProcedure.query(async ({ ctx }) => {
    const branchId = ctx.user.profile.branch_id;
    const { data: branch } = await ctx.supabase
      .from("branches")
      .select("id, name, organization_id, address, latitude, longitude, kbs_configured")
      .eq("id", branchId)
      .single();
    const br = branch as Record<string, unknown> | null;
    const kbsConfigured = br && typeof br?.kbs_configured === "boolean" ? br.kbs_configured : false;
    let org: Record<string, unknown> | null = null;
    if (br?.organization_id) {
      const { data } = await ctx.supabase
        .from("organizations")
        .select("id, name")
        .eq("id", br.organization_id)
        .single();
      org = data as Record<string, unknown> | null;
    }
    const tesis = {
      id: br?.id,
      tesisAdi: (br?.name as string) || "Tesis",
      paket: "standard",
      kota: 100,
      kullanilanKota: 0,
      kbsTuru: "polis",
      kbsConnected: kbsConfigured,
      address: typeof br?.address === "string" ? br.address : undefined,
      latitude: typeof br?.latitude === "number" ? br.latitude : undefined,
      longitude: typeof br?.longitude === "number" ? br.longitude : undefined,
      organization: org,
    };
    const ozet = {
      toplamOda: 0,
      doluOda: 0,
      bugunGiris: 0,
      bugunCikis: 0,
      hataliBildirim: 0,
    };
    return { tesis, ozet };
  }),
});
