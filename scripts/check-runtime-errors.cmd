@echo off
setlocal
set ROOT_DIR=%~dp0..
cd /d %ROOT_DIR%\client
echo [runtime-check] client strict eslint
call npx eslint "src/**/*.{js,jsx,mjs}" ^
  --rule "no-use-before-define: [2,{functions:false,classes:true,variables:true}]" ^
  --rule "no-undef: 2" ^
  --rule "no-shadow: 2" ^
  --rule "no-redeclare: 2"
if errorlevel 1 exit /b 1
echo [runtime-check] client build
call npm run build
if errorlevel 1 exit /b 1
cd /d %ROOT_DIR%\server
echo [runtime-check] server syntax
for /r %%f in (*.js) do node --check "%%f" || exit /b 1
