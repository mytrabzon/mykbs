# Edge Function eşleşme raporu

Kod tabanında çağrılan Edge Function isimleri ile `supabase/functions` altındaki klasör isimleri karşılaştırıldı.

## Sonuç: Eşleşmeyen yok

Tüm çağrılan function isimleri, mevcut bir Edge Function klasörü ile **bire bir eşleşiyor**.

---

## Kodda kullanılan isimler (kaynak)

### Mobil – apiSupabase.ts / communityApi.js
| Çağrılan isim | Klasör (supabase/functions) |
|----------------|-----------------------------|
| facilities_list | ✅ facilities_list |
| settings_get | ✅ settings_get |
| room_get | ✅ room_get |
| auth_login | ✅ auth_login |
| auth_aktivasyon | ✅ auth_aktivasyon |
| auth_pin | ✅ auth_pin |
| auth_sifre | ✅ auth_sifre |
| auth_request_otp | ✅ auth_request_otp |
| auth_verify_otp | ✅ auth_verify_otp |
| auth_supabase_phone_session | ✅ auth_supabase_phone_session |
| auth_basvuru | ✅ auth_basvuru |
| nfc_read | ✅ nfc_read |
| document_scan | ✅ document_scan |
| checkin_create | ✅ checkin_create |
| settings_kbs_test | ✅ settings_kbs_test |
| notification_submit | ✅ notification_submit |
| checkout | ✅ checkout |
| settings_update | ✅ settings_update |
| branch_update | ✅ branch_update |
| me | ✅ me |
| community_post_list | ✅ community_post_list |
| community_post_create | ✅ community_post_create |
| community_post_comment | ✅ community_post_comment |
| community_post_react | ✅ community_post_react |
| community_post_delete | ✅ community_post_delete |
| community_post_comments_list | ✅ community_post_comments_list |
| community_comment_delete | ✅ community_comment_delete |
| upload_community_image | ✅ upload_community_image |
| profile_update | ✅ profile_update |
| upload_avatar | ✅ upload_avatar |
| community_announcement_create | ✅ community_announcement_create |
| in_app_notifications_list | ✅ in_app_notifications_list |
| in_app_notifications_mark_read | ✅ in_app_notifications_mark_read |
| push_register_token | ✅ push_register_token |

### Admin panel – callEdgeFunction
| Çağrılan isim | Klasör |
|----------------|--------|
| me | ✅ me |
| admin_kbs_notifications | ✅ admin_kbs_notifications |
| community_post_list | ✅ community_post_list |
| community_post_restore | ✅ community_post_restore |

### Backend / Supabase iç
| Kullanım | Klasör |
|----------|--------|
| sync_branch_profile (backend supabaseSync.js) | ✅ sync_branch_profile |
| send-sms (backend sms.js, auth_request_otp içinden) | ✅ send-sms |

---

## Özel isim: send-sms

Klasör adı **tire** ile: `send-sms`. Backend ve `auth_request_otp` bu isimle çağırıyor; URL `.../functions/v1/send-sms` olarak doğru oluşuyor.

---

## Repoda olup kodda referans görmediğimiz fonksiyonlar

Aşağıdakiler `supabase/functions` altında var; mobil/admin/backend taramasında **doğrudan** `callFn` / `callEdgeFunction` ile geçmedi (tRPC, cron, webhook veya ileride kullanım için bırakılmış olabilir):

- health  
- trpc  
- rooms_list  
- admin_dashboard_stats  
- admin_audit_list  
- admin_user_list  
- admin_user_disable  
- admin_user_set_role  
- notification_dispatch  
- push_dispatch  
- kbs_status_notify  

Bunlar için isim uyumsuzluğu yok; sadece bu raporda taradığımız client/backend kodunda referans yok.

---

## Dinamik POST fallback (apiSupabase)

`apiSupabase.ts` içinde eşleşmeyen POST path’ler şu forma dönüştürülüyor:

`pathname.replace(/^\//, '').replace(/\//g, '_')`

Örnek: `/foo/bar` → `foo_bar`. Bu path’in gerçekten bir Edge Function olarak (`foo_bar`) deploy edilmiş olması gerekir; aksi halde 404 alınır. Şu an tüm bilinen path’ler açıkça map’lendiği için bu fallback’e düşen bir isim raporlanmadı.

---

**Tarih:** 2026-02-27  
**Özet:** Edge function dosya isimleri ile kullanımlar eşleşiyor; eşleşmeyen bir isim bulunmadı.
