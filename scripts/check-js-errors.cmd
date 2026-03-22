@echo off
setlocal enabledelayedexpansion

set ROOT_DIR=%~dp0..
set CLIENT_DIR=%ROOT_DIR%\client
set SERVER_DIR=%ROOT_DIR%\server

if not exist "%CLIENT_DIR%\node_modules" (
  pushd "%CLIENT_DIR%"
  call npm ci --no-audit --no-fund || exit /b 1
  popd
)

pushd "%CLIENT_DIR%"
call npm run lint -- . || exit /b 1
popd

if not exist "%SERVER_DIR%\node_modules" (
  pushd "%SERVER_DIR%"
  call npm ci --no-audit --no-fund || exit /b 1
  popd
)

pushd "%SERVER_DIR%"
node -e "const fs=require('fs');const path=require('path');const cp=require('child_process');const exts=new Set(['.js','.mjs','.cjs']);const files=[];function walk(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){if(entry.name==='node_modules'||entry.name==='.git') continue;const full=path.join(dir,entry.name);if(entry.isDirectory()) walk(full); else if(exts.has(path.extname(entry.name))) files.push(full);}} walk(process.cwd()); let failed=0; for(const file of files.sort()){const r=cp.spawnSync(process.execPath,['--check',file],{stdio:'inherit'}); if(r.status!==0) failed++;} console.log('checked '+files.length+' server files'); if(failed>0) process.exit(1);" || exit /b 1
popd

echo.
echo JS validation passed.
