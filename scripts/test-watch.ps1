param(
  [Parameter(Position = 0)]
  [string]$Service = "user-management"
)

$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $PSScriptRoot
$Allowed = @(
  "user-management",
  "job-management",
  "chat-management",
  "notification-management",
  "email-management"
)

if ($Allowed -notcontains $Service) {
  Write-Host "Unknown service: $Service" -ForegroundColor Red
  Write-Host "Use one of: $($Allowed -join ', ')"
  exit 1
}

$ServiceDir = Join-Path $Root "services\$Service"
if (-not (Test-Path $ServiceDir)) {
  Write-Host "Service folder not found: $ServiceDir" -ForegroundColor Red
  exit 1
}

Write-Host "Vitest watch mode: $Service" -ForegroundColor Cyan
Set-Location $ServiceDir
npm run test:watch
