# Patches the generated iOS project after `npx cap add ios` / `npx cap sync ios`.
# Idempotent — safe to run on every sync.
#  1. Face ID permission string (required by the biometric plugin on iOS)
#  2. Wall-ette app icon (1024 opaque, iOS applies its own mask)
$ErrorActionPreference = "Stop"

$plist = "ios/App/App/Info.plist"
if (-not (Test-Path $plist)) {
    Write-Host "ios project not found - run 'npx cap add ios' first." -ForegroundColor Yellow
    exit 0
}

# ── 1. NSFaceIDUsageDescription ──
$content = Get-Content $plist -Raw
if ($content -notmatch "NSFaceIDUsageDescription") {
    $insert = "`t<key>NSFaceIDUsageDescription</key>`n`t<string>Wall-ette uses Face ID to unlock your wallet quickly and securely.</string>`n</dict>"
    $content = $content -replace "</dict>\s*</plist>", "$insert`n</plist>"
    Set-Content -Path $plist -Value $content -NoNewline
    Write-Host "Added NSFaceIDUsageDescription to Info.plist"
} else {
    Write-Host "Info.plist already has Face ID permission - skipped"
}

# ── 2. App icon ──
$iconSrc = "store-assets/icon-ios-1024.png"
$iconSet = "ios/App/App/Assets.xcassets/AppIcon.appiconset"
if ((Test-Path $iconSrc) -and (Test-Path $iconSet)) {
    # Capacitor's template references a single 1024 universal icon.
    $targets = Get-ChildItem $iconSet -Filter *.png
    foreach ($t in $targets) {
        Copy-Item $iconSrc $t.FullName -Force
    }
    Write-Host "App icon applied to $($targets.Count) file(s) in AppIcon.appiconset"
} else {
    Write-Host "Icon source or appiconset missing - skipped icon step" -ForegroundColor Yellow
}

Write-Host "iOS patch complete." -ForegroundColor Green
