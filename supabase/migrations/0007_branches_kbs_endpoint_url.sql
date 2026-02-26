-- Opsiyonel: branch bazlı KBS endpoint (Polis/Jandarma API URL override)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'branches' AND column_name = 'kbs_endpoint_url') THEN
    ALTER TABLE branches ADD COLUMN kbs_endpoint_url TEXT;
    COMMENT ON COLUMN branches.kbs_endpoint_url IS 'Opsiyonel: KBS API base URL (boşsa varsayılan POLIS/JANDARMA URL kullanılır)';
  END IF;
END $$;
