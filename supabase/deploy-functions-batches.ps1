# Supabase Edge Functions - Tek tek deploy (timeout onlemek icin)
# "Bundle generation timed out" hatasi icin: tum function'lar tek tek deploy edilir.
#
# Kullanım:
#   .\deploy-functions-batches.ps1                    # Tumunu tek tek deploy et
#   .\deploy-functions-batches.ps1 -Batch 2           # Sadece 2. grubu (8'li) deploy et
#   .\deploy-functions-batches.ps1 -Debug             # Debug ciktisi ile
#   .\deploy-functions-batches.ps1 -UseApi            # Sunucu tarafi bundle (--use-api)

param(
    [int]$Batch = 0,   # 0 = hepsi, 1..7 = sadece o numarali grup
    [switch]$Debug,
    [switch]$UseApi    # --use-api: Docker yerine sunucuda bundle (timeout azaltabilir)
)

$allFunctions = @(
    "admin_audit_list", "admin_dashboard_stats", "admin_kbs_notifications",
    "admin_user_disable", "admin_user_list", "admin_user_set_role",
    "auth_aktivasyon", "auth_basvuru", "auth_login", "auth_pin",
    "auth_request_otp", "auth_sifre", "auth_supabase_phone_session", "auth_verify_otp",
    "branch_update", "checkin_create", "checkout",
    "community_announcement_create", "community_comment_delete", "community_post_comment",
    "community_post_comments_list", "community_post_create", "community_post_delete",
    "community_post_list", "community_post_react", "community_post_restore",
    "document_scan", "facilities_list", "health",
    "in_app_notifications_list", "in_app_notifications_mark_read", "kbs_status_notify",
    "me", "nfc_read", "notification_dispatch", "notification_submit",
    "profile_update", "push_dispatch", "push_register_token",
    "rooms_list", "room_get", "send-sms",
    "settings_get", "settings_kbs_test", "settings_update",
    "sync_branch_profile", "trpc", "upload_avatar", "upload_community_image"
)

$batchSize = 8
$batches = [System.Collections.ArrayList]@()
for ($i = 0; $i -lt $allFunctions.Count; $i += $batchSize) {
    $end = [Math]::Min($i + $batchSize, $allFunctions.Count)
    $batches.Add(@($allFunctions[$i..($end-1)])) | Out-Null
}

$toDeploy = if ($Batch -ge 1 -and $Batch -le $batches.Count) {
    $batches[$Batch - 1]
} else {
    $allFunctions
}

$flags = @()
if ($Debug) { $flags += "--debug" }
if ($UseApi) { $flags += "--use-api" }

Write-Host "Deploy edilecek function sayisi: $($toDeploy.Count)" -ForegroundColor Cyan
if ($flags.Count -gt 0) { Write-Host "Flags: $($flags -join ' ')" -ForegroundColor Gray }
Write-Host ""

$failed = @()
foreach ($fn in $toDeploy) {
    Write-Host "Deploy: $fn ... " -NoNewline
    $args = @("functions", "deploy", $fn) + $flags
    & npx supabase @args 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "OK" -ForegroundColor Green
    } else {
        Write-Host "FAILED" -ForegroundColor Red
        $failed += $fn
    }
}

if ($failed.Count -gt 0) {
    Write-Host "`nBasarisiz: $($failed -join ', ')" -ForegroundColor Red
    exit 1
}
Write-Host "`nTumu tamamlandi." -ForegroundColor Green
