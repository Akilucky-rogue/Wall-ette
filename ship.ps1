# Wall-ette full ship: typecheck -> build APK+web -> host APK -> deploy web
# -> install on phone -> commit & push.
# Usage:  .\ship.ps1 "feat: my change description"
param([string]$Message = "chore: update build")

# Retired on 19 Nov 2026 until audit item 14 (M12) reworks it. Since the move
# to Google Play it would build com.wallette.app signed with the old website
# key and publish it, which blocks installing the Play version, then commit
# everything with git add -A. Meanwhile:
#   website and rules:  npm run build; npx firebase-tools deploy --only hosting,firestore:rules
#   Android:            npm run android:bundle, then upload it in Play Console
Write-Host "ship.ps1 is retired for now; see the note at the top of this file." -ForegroundColor Yellow
exit 1

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

Write-Host "`n[1/6] Typecheck" -ForegroundColor Cyan
npx tsc --noEmit
if ($LASTEXITCODE -ne 0) { Write-Host "Typecheck failed - aborting." -ForegroundColor Red; exit 1 }

Write-Host "`n[2/6] Android release build (includes web build + sync)" -ForegroundColor Cyan
npm run android:release
if ($LASTEXITCODE -ne 0) { Write-Host "Build failed - aborting." -ForegroundColor Red; exit 1 }

Write-Host "`n[3/6] Stage APK for the web download banner" -ForegroundColor Cyan
New-Item -ItemType Directory -Force dist\downloads | Out-Null
Copy-Item android\app\build\outputs\apk\release\app-release.apk dist\downloads\wall-ette.apk -Force

Write-Host "`n[4/6] Deploy web (Firebase Hosting)" -ForegroundColor Cyan
npx firebase-tools deploy --only hosting
if ($LASTEXITCODE -ne 0) { Write-Host "Deploy failed - aborting before commit." -ForegroundColor Red; exit 1 }

Write-Host "`n[5/6] Install on connected phone" -ForegroundColor Cyan
adb install -r android\app\build\outputs\apk\release\app-release.apk
if ($LASTEXITCODE -ne 0) { Write-Host "adb install failed (phone not connected?) - continuing anyway." -ForegroundColor Yellow }

Write-Host "`n[6/6] Commit and push" -ForegroundColor Cyan
git add -A
git commit -m $Message
git push

Write-Host "`nShipped: web live, APK hosted + installed, repo pushed." -ForegroundColor Green
