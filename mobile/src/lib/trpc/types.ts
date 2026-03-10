/**
 * Minimal client-side types for Supabase Edge tRPC router.
 * Mirrors supabase/functions/trpc/index.ts AppRouter shape.
 */
export interface MeResult {
  user_id: string;
  branch_id: string;
  role: string;
  display_name: string | null;
  title: string | null;
  avatar_url: string | null;
  is_admin: boolean;
}

export interface RoomsListResult {
  odalar: Array<{
    id: string;
    odaNumarasi: string;
    odaTipi: string;
    kapasite: number;
    durum: string;
    odadaMi: boolean;
    misafir?: {
      id: string;
      ad: string;
      soyad: string;
      girisTarihi: string;
    };
  }>;
}

export interface FacilitiesListResult {
  tesis: Record<string, unknown>;
  ozet: Record<string, unknown>;
}

export interface SettingsGetResult {
  kbsTuru: string | null;
  kbsTesisKodu: string;
  kbsWebServisSifre: string;
  ipKisitAktif: boolean;
}
