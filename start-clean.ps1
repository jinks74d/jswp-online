Write-Host "JSWP Online - Root Cause Fix for Windows Trace File Issue" -ForegroundColor Green
Write-Host ""

# Kill all Node.js processes
Write-Host "Killing Node.js processes..." -ForegroundColor Yellow
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep -Seconds 2

# Remove .next directory completely
Write-Host "Removing .next directory..." -ForegroundColor Yellow
if (Test-Path '.next') {
    Remove-Item -Path '.next' -Recurse -Force -ErrorAction SilentlyContinue
}

# Set environment variables
Write-Host "Setting Next.js environment variables..." -ForegroundColor Yellow
$env:NEXT_TELEMETRY_DISABLED = "1"
$env:NEXT_PRIVATE_NO_INSTRUMENT = "1"

Write-Host ""
Write-Host "Starting development server..." -ForegroundColor Green
Write-Host ""

# Start the server
npm run dev