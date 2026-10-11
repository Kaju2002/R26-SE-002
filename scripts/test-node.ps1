$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $PSScriptRoot
$Services = @(
  "user-management",
  "job-management",
  "chat-management",
  "notification-management",
  "email-management"
)

foreach ($svc in $Services) {
  Write-Host ""
  Write-Host "========== $svc ==========" -ForegroundColor Cyan
  Push-Location (Join-Path $Root "services\$svc")
  try {
    npm test
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
  } finally {
    Pop-Location
  }
}

Write-Host ""
Write-Host "All Node service tests passed." -ForegroundColor Green
