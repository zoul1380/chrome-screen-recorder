# Extension Validation Script
# Run this to validate the extension before loading in Chrome

Write-Host "🔍 Validating Chrome Extension..." -ForegroundColor Yellow
Write-Host ""

# Check if we're in the right directory
if (-not (Test-Path "manifest.json")) {
    Write-Host "❌ manifest.json not found. Please run this script from the extension directory." -ForegroundColor Red
    exit 1
}

Write-Host "✅ Found manifest.json" -ForegroundColor Green

# Validate JSON syntax
try {
    $manifest = Get-Content "manifest.json" -Raw | ConvertFrom-Json
    Write-Host "✅ manifest.json has valid JSON syntax" -ForegroundColor Green
} catch {
    Write-Host "❌ manifest.json has invalid JSON syntax: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Check required files
$requiredFiles = @(
    "manifest.json",
    "popup.html",
    "popup.js", 
    "background-display.js",
    "offscreen-display.html",
    "offscreen-display.js",
    "simple-converter.js",
    "gif-local.js"
)

foreach ($file in $requiredFiles) {
    if (Test-Path $file) {
        Write-Host "✅ Found $file" -ForegroundColor Green
    } else {
        Write-Host "❌ Missing required file: $file" -ForegroundColor Red
        exit 1
    }
}

# Check CSP compliance
$csp = $manifest.content_security_policy.extension_pages
if ($csp -match "https://") {
    Write-Host "❌ CSP contains external HTTPS references - this will cause loading errors" -ForegroundColor Red
    Write-Host "   Current CSP: $csp" -ForegroundColor Yellow
    exit 1
} else {
    Write-Host "✅ CSP is compliant (no external references)" -ForegroundColor Green
}

# Check manifest version
if ($manifest.manifest_version -eq 3) {
    Write-Host "✅ Using Manifest V3" -ForegroundColor Green
} else {
    Write-Host "⚠️  Using Manifest V$($manifest.manifest_version) - V3 recommended" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "🎉 Extension validation complete!" -ForegroundColor Green
Write-Host ""
Write-Host "📋 Next steps:" -ForegroundColor Cyan
Write-Host "1. Open Chrome and go to chrome://extensions/" -ForegroundColor White
Write-Host "2. Enable Developer mode (toggle in top-right)" -ForegroundColor White
Write-Host "3. Click Load unpacked and select this directory" -ForegroundColor White
Write-Host "4. Test the extension on test-format-conversion.html" -ForegroundColor White
Write-Host ""
Write-Host "🔧 Troubleshooting:" -ForegroundColor Cyan
Write-Host "- If extension fails to load, check Chrome console for errors" -ForegroundColor White
Write-Host "- Ensure Chrome version 88+ for full Manifest V3 support" -ForegroundColor White
Write-Host "- Try refreshing the extension in Chrome extensions page" -ForegroundColor White
