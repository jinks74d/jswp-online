# PowerShell script to start JSWP Online Development Server
Write-Host "Starting JSWP Online Development Server..." -ForegroundColor Green
Write-Host ""

# Kill any existing processes on common ports
Write-Host "Cleaning up existing processes..." -ForegroundColor Yellow
try {
    npx kill-port 3000 3001 3002 3003 2>$null
} catch {
    # Ignore errors if no processes found
}

# Remove problematic Next.js files with error handling
Write-Host "Cleaning Next.js cache..." -ForegroundColor Yellow
try {
    if (Test-Path ".next\trace") {
        Remove-Item -Path ".next\trace" -Recurse -Force
    }
    if (Test-Path ".next\server\trace") {
        Remove-Item -Path ".next\server\trace" -Recurse -Force
    }
} catch {
    Write-Host "Note: Some cache files could not be removed (this is normal)" -ForegroundColor Gray
}

# Set environment variables to disable tracing
$env:NEXT_TELEMETRY_DISABLED = "1"

# Start the development server
Write-Host "Starting development server..." -ForegroundColor Green
Write-Host ""
npm run dev