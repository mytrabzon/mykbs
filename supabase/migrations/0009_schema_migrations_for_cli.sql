-- CLI uyumu: "relation supabase_migrations.schema_migrations does not exist" hatası için.
-- Proje Dashboard'dan oluşturulduysa bu tablo yoktur. Önce bunu Dashboard > SQL Editor'da
-- tek seferlik çalıştırın; sonra supabase db push kullanabilirsiniz.
CREATE SCHEMA IF NOT EXISTS supabase_migrations;

CREATE TABLE IF NOT EXISTS supabase_migrations.schema_migrations (
  version TEXT PRIMARY KEY
);

COMMENT ON TABLE supabase_migrations.schema_migrations IS 'Supabase CLI migration tracking';
