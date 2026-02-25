# Patch capacitor.build.gradle and @capacitor/app/android/build.gradle to use Java 17 instead of Java 21
$filesToPatch = @(
    "android/app/capacitor.build.gradle",
    "node_modules/@capacitor/app/android/build.gradle"
)

foreach ($gradleFile in $filesToPatch) {
    if (Test-Path $gradleFile) {
        (Get-Content $gradleFile) |
            ForEach-Object {
                $_ -replace 'JavaVersion\.VERSION_21', 'JavaVersion.VERSION_17'
            } | Set-Content $gradleFile
        Write-Host "Patched $gradleFile to use Java 17."
    } else {
        Write-Host "File not found: $gradleFile"
    }
}
