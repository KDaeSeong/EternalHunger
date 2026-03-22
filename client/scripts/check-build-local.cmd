@echo off
cd /d %~dp0\..
if not exist node_modules (
  echo [check-build-local] installing deps
  call npm ci --no-audit --no-fund
  if errorlevel 1 exit /b %errorlevel%
)
echo [check-build-local] running prebuild
call npm run prebuild
if errorlevel 1 exit /b %errorlevel%
echo [check-build-local] running next build
call npx next build
