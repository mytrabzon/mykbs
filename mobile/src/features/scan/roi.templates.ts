/**
 * TR Kimlik / TR Ehliyet ROI coordinates (normalized 0..1 or pixel for 1024x640).
 * Used by backend for "nokta atışı" extraction; mobile can send full image, backend crops by ROI.
 */

/** Normalized rect: x, y, width, height in 0..1 */
export interface RoiRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** TR Kimlik ön yüz (örnek: 1024x640 normalized) */
export const TR_ID_FRONT_ROI: Record<string, RoiRect> = {
  tcKimlikNo: { x: 0.45, y: 0.25, width: 0.35, height: 0.08 },
  ad: { x: 0.25, y: 0.38, width: 0.5, height: 0.06 },
  soyad: { x: 0.25, y: 0.46, width: 0.5, height: 0.06 },
  dogumTarihi: { x: 0.45, y: 0.54, width: 0.25, height: 0.06 },
  seriNo: { x: 0.15, y: 0.62, width: 0.35, height: 0.05 },
};

/** TR Ehliyet ön yüz */
export const TR_DL_FRONT_ROI: Record<string, RoiRect> = {
  ad: { x: 0.3, y: 0.28, width: 0.45, height: 0.06 },
  soyad: { x: 0.3, y: 0.36, width: 0.45, height: 0.06 },
  dogumTarihi: { x: 0.3, y: 0.44, width: 0.25, height: 0.06 },
  belgeNo: { x: 0.3, y: 0.52, width: 0.4, height: 0.05 },
  gecerlilik: { x: 0.3, y: 0.6, width: 0.3, height: 0.05 },
  sinif: { x: 0.65, y: 0.5, width: 0.2, height: 0.06 },
};
