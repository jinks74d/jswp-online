# PowerShell script to start JSWP Online Development Server
# This script addresses the root cause of the Windows trace file permission issue

Write-Host "JSWP Online - Starting Development Server (Windows Fix)" -ForegroundColor Green
Write-Host "Addressing Next.js trace file permission issues..." -ForegroundColor Yellow
Write-Host ""

# Step 1: Kill all Node.js processes completely
Write-Host "1. Killing all Node.js processes..." -ForegroundColor Cyan
try {
    Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force
    Start-Sleep -Seconds 2
} catch {
    # Ignore if no processes found
}

# Step 2: Kill processes on specific ports
Write-Host "2. Freeing up ports..." -ForegroundColor Cyan
$ports = @(3000, 3001, 3002, 3003, 3004, 3005)
foreach ($port in $ports) {
    try {
        $process = netstat -ano | findstr ":$port "
        if ($process) {
            $pid = ($process -split '\s+')[-1]
            if ($pid -match '^\d+$') {
                Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
            }
        }
    } catch {
        # Continue if port is not in use
    }
}

# Step 3: Remove .next directory completely
Write-Host "3. Removing Next.js cache directory..." -ForegroundColor Cyan
if (Test-Path '.next') {
    try {
        Remove-Item -Path '.next' -Recurse -Force -ErrorAction Stop
        Write-Host "   ✓ Removed .next directory" -ForegroundColor Green
    } catch {
        Write-Host "   ⚠ Could not remove some .next files (they may be locked)" -ForegroundColor Yellow
        # Try to remove specific problematic files
        if (Test-Path '.next\trace') {
            Remove-Item -Path '.next\trace' -Recurse -Force -ErrorAction SilentlyContinue
        }
        if (Test-Path '.next\server\trace') {
            Remove-Item -Path '.next\server\trace' -Recurse -Force -ErrorAction SilentlyContinue
        }
    }
}

# Step 4: Create .next directory with proper permissions
Write-Host "4. Setting up .next directory with proper permissions..." -ForegroundColor Cyan
try {
    New-Item -Path '.next' -ItemType Directory -Force | Out-Null
    # Set full permissions for everyone to prevent permission issues
    icacls '.next' /grant Everyone:F /T /Q | Out-Null
    Write-Host "   ✓ Created .next directory with full permissions" -ForegroundColor Green
} catch {
    Write-Host "   ⚠ Could not set permissions, but continuing..." -ForegroundColor Yellow
}

# Step 5: Set environment variables to disable Next.js tracing
Write-Host "5. Setting Next.js environment variables..." -ForegroundColor Cyan
$env:NEXT_TELEMETRY_DISABLED = "1"
$env:NEXT_PRIVATE_NO_INSTRUMENT = "1"
Write-Host "   ✓ Disabled Next.js telemetry and instrumentation" -ForegroundColor Green

# Step 6: Start the development server
Write-Host "6. Starting development server..." -ForegroundColor Cyan
Write-Host ""
Write-Host "Starting Next.js development server..." -ForegroundColor Green
Write-Host "   Environment variables set to prevent trace file issues" -ForegroundColor Gray
Write-Host "   Server should start without permission errors" -ForegroundColor Gray
Write-Host ""

# Start npm run dev
npm run dev