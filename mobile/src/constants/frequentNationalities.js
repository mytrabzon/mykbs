/**
 * Sık kullanılan uyruklar — kısayol butonları için.
 * Sıra: Alman, İngiliz, Rus, Türk vb. turist yoğun oteller için.
 */
export const FREQUENT_NATIONALITIES = [
  { code: 'DEU', label: 'Alman', labelEn: 'German' },
  { code: 'GBR', label: 'İngiliz', labelEn: 'British' },
  { code: 'RUS', label: 'Rus', labelEn: 'Russian' },
  { code: 'TUR', label: 'Türk', labelEn: 'Turkish' },
  { code: 'FRA', label: 'Fransız', labelEn: 'French' },
  { code: 'NLD', label: 'Hollandalı', labelEn: 'Dutch' },
  { code: 'USA', label: 'Amerikalı', labelEn: 'American' },
  { code: 'ITA', label: 'İtalyan', labelEn: 'Italian' },
  { code: 'ESP', label: 'İspanyol', labelEn: 'Spanish' },
  { code: 'POL', label: 'Leh', labelEn: 'Polish' },
  { code: 'UKR', label: 'Ukraynalı', labelEn: 'Ukrainian' },
  { code: 'KAZ', label: 'Kazak', labelEn: 'Kazakh' },
];

/** MRZ nationality 3-letter code → display label (TR) */
export function nationalityCodeToLabel(code) {
  if (!code) return '';
  const c = (code || '').toUpperCase().trim();
  const found = FREQUENT_NATIONALITIES.find((n) => n.code === c);
  return found ? found.label : c;
}
