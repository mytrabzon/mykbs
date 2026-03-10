import { z } from "https://esm.sh/zod@3.22.4";
import { router, protectedProcedure } from "../_shared/trpc.ts";

const roomsListInput = z.object({ filtre: z.string().optional() }).optional();

export const roomsRouter = router({
  /** List rooms (guests) for current branch. Same contract as Edge Function rooms_list. */
  list: protectedProcedure
    .input(roomsListInput)
    .query(async ({ ctx, input }) => {
      const branchId = ctx.user.profile.branch_id;
      const { data: rooms, error } = await ctx.supabase
        .from("guests")
        .select("id, full_name, document_no, created_at")
        .eq("branch_id", branchId);
      if (error) throw new Error(`Oda listesi alınamadı: ${error.message}`);
      const odalar = (rooms || []).map((g: Record<string, unknown>, i: number) => {
        const hasGuest = !!g;
        const fullName = (g.full_name as string) || "";
        const parts = fullName.split(" ");
        const ad = parts[0] || "";
        const soyad = parts.slice(1).join(" ") || "";
        return {
          id: g.id,
          odaNumarasi: String(100 + i),
          odaTipi: "Standart Oda",
          kapasite: 2,
          durum: hasGuest ? "dolu" : "bos",
          odadaMi: hasGuest,
          misafir: hasGuest
            ? {
                id: g.id,
                ad,
                soyad,
                girisTarihi: g.created_at,
              }
            : undefined,
        };
      });
      return { odalar };
    }),

  /** Get single room (guest) by id. Same contract as Edge Function room_get. */
  get: protectedProcedure
    .input(z.object({ id: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const branchId = ctx.user.profile.branch_id;
      const { data: room, error } = await ctx.supabase
        .from("guests")
        .select("*")
        .eq("id", input.id)
        .eq("branch_id", branchId)
        .single();
      if (error) throw new Error(error.message);
      return room ?? {};
    }),
});
