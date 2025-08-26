@echo off
echo Starting JSWP Online Development Server...
echo.

REM Kill any existing processes on common ports
echo Cleaning up existing processes...
npx kill-port 3000 3001 3002 3003 >nul 2>&1

REM Remove problematic Next.js files
echo Cleaning Next.js cache...
if exist .next\trace rmdir /s /q .next\trace >nul 2>&1
if exist .next\server\trace rmdir /s /q .next\server\trace >nul 2>&1

REM Set environment variables to disable tracing
set NEXT_TELEMETRY_DISABLED=1

REM Start the development server
echo Starting development server...
echo.
npm run dev