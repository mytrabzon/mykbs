# 403 "Branch bulunamadı" / Backend bağlantı hatası

## Sebep

`facilities_list` (ve benzeri) Edge Function, giriş yapan kullanıcının **user_profiles** kaydında **branch_id** arıyor. Bu satır yoksa veya **branch_id** boşsa **403** döner; uygulama "backend bağlantı hatası / yeniden dene" gibi gösterebilir.

Bu kayıt normalde **backend üzerinden giriş** (SMS veya şifre) sırasında **sync_branch_profile** ile oluşturulur.

## Ne yapmalı?

1. **Uygulamadan çıkış yap**, tekrar **giriş yap** (SMS veya şifre ile).
   - Giriş backend’e gidip `ensureSupabaseBranchAndProfile` çalışırsa Supabase’te **user_profiles** (ve gerekirse **branches**) oluşur/güncellenir.
2. Hâlâ 403 alıyorsan Supabase **Table Editor**’da kontrol et:
   - **user_profiles**: `user_id` = ilgili kullanıcının UUID’si (örn. `f7cfe2ef-00bd-4c70-b40d-c5b55e1c52d7`) olan satırda **branch_id** dolu mu?
   - **branches**: Bu **branch_id** ile bir satır var mı?
3. **RLS düzeltmesi** uygulandı mı?
   - Migration **0008_fix_user_profiles_rls_recursion.sql** Supabase’te çalıştırılmış olmalı (Dashboard > SQL Editor veya `supabase db push`).

## schema_migrations hatası (CLI)

"Hata: relation supabase_migrations.schema_migrations does not exist" alıyorsan:

1. Supabase **Dashboard** > **SQL Editor**’ı aç.
2. **supabase/migrations/0009_schema_migrations_for_cli.sql** içeriğini yapıştırıp **Run** ile çalıştır.
3. Bundan sonra yerelde `supabase db push` kullanabilirsin.
