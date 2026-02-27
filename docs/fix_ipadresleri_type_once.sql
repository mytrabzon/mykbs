-- =============================================================================
-- ipAdresleri tip düzeltmesi – Tek seferlik (Supabase SQL Editor'da çalıştırın)
-- Sorun: Eski script'ler "ipAdresleri" TEXT[] ile oluşturmuş; Prisma String bekliyor.
-- Hata: P2032 "expected type String, found: []"
-- =============================================================================

-- Tesis.ipAdresleri: Eğer kolon TEXT değilse (örn. text[]) TEXT yap
DO $$
DECLARE
  ct text;
BEGIN
  SELECT format_type(a.atttypid, a.atttypmod) INTO ct
  FROM pg_attribute a
  JOIN pg_class c ON a.attrelid = c.oid
  JOIN pg_namespace n ON c.relnamespace = n.oid
  WHERE n.nspname = 'public' AND c.relname = 'Tesis' AND a.attname = 'ipAdresleri' AND NOT a.attisdropped;
  IF ct IS NOT NULL AND ct <> 'text' AND ct NOT LIKE 'character varying%' THEN
    EXECUTE format(
      'ALTER TABLE public."Tesis" ALTER COLUMN "ipAdresleri" TYPE text USING (CASE WHEN pg_typeof("ipAdresleri") = ''text[]''::regtype THEN array_to_string("ipAdresleri", '','') ELSE coalesce("ipAdresleri"::text, '''') END)'
    );
    RAISE NOTICE 'Tesis.ipAdresleri % -> text dönüştürüldü', ct;
  END IF;
END $$;

-- Kullanici tablosunda ipAdresleri varsa (yanlışlıkla eklenmiş) kaldır
ALTER TABLE public."Kullanici" DROP COLUMN IF EXISTS "ipAdresleri";
