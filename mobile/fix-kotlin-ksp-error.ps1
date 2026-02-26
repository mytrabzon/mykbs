# Fix Kotlin KSP Compiler Error
# This script helps resolve the expo-updates:kspDebugKotlin internal compiler error

Write-Host "🔧 Fixing Kotlin KSP Compiler Error..." -ForegroundColor Cyan
Write-Host ""

# Navigate to Android directory
Set-Location -Path "$PSScriptRoot\android" -ErrorAction Stop

Write-Host "1️⃣ Cleaning Gradle cache..." -ForegroundColor Yellow
& .\gradlew.bat clean --no-daemon

Write-Host ""
Write-Host "2️⃣ Stopping Gradle daemon..." -ForegroundColor Yellow
& .\gradlew.bat --stop

Write-Host ""
Write-Host "3️⃣ Removing build directories..." -ForegroundColor Yellow
if (Test-Path "build") {
    Remove-Item -Path "build" -Recurse -Force
    Write-Host "   ✓ Removed build directory" -ForegroundColor Green
}
if (Test-Path "app\build") {
    Remove-Item -Path "app\build" -Recurse -Force
    Write-Host "   ✓ Removed app\build directory" -ForegroundColor Green
}

Write-Host ""
Write-Host "4️⃣ Clearing Gradle cache..." -ForegroundColor Yellow
$gradleCache = "$env:USERPROFILE\.gradle\caches"
if (Test-Path $gradleCache) {
    Write-Host "   ⚠️  Gradle cache location: $gradleCache" -ForegroundColor Yellow
    Write-Host "   💡 You can manually clear it if needed: Remove-Item -Path '$gradleCache' -Recurse -Force" -ForegroundColor Cyan
}

Write-Host ""
Write-Host "5️⃣ Invalidating Android Studio caches (if applicable)..." -ForegroundColor Yellow
Write-Host "   💡 In Android Studio: File > Invalidate Caches / Restart" -ForegroundColor Cyan

Write-Host ""
Write-Host "✅ Cleanup complete!" -ForegroundColor Green
Write-Host ""
Write-Host "📝 Next steps:" -ForegroundColor Cyan
Write-Host "   1. Try building again: cd android && .\gradlew.bat assembleDebug" -ForegroundColor White
Write-Host "   2. If error persists, try downgrading Kotlin to 2.0.21:" -ForegroundColor White
Write-Host "      - Edit mobile/android/gradle.properties" -ForegroundColor White
Write-Host "      - Change: android.kotlinVersion=2.0.21" -ForegroundColor White
Write-Host "      - Edit mobile/app.config.js" -ForegroundColor White
Write-Host "      - Change: kotlinVersion: '2.0.21'" -ForegroundColor White
Write-Host "   3. Check the full error log with: .\gradlew.bat assembleDebug --stacktrace --info" -ForegroundColor White
Write-Host ""

Set-Location -Path $PSScriptRoot

