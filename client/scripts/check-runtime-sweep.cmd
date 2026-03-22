@echo off
cd /d %~dp0\..
call npm run check:runtime:sweep
if errorlevel 1 exit /b %errorlevel%
call npm run build
