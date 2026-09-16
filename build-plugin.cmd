@echo off
cd /d "%~dp0"
if not exist node_modules (
  echo [Bionify Reader] Installing dependencies...
  call npm install
  if errorlevel 1 goto :error
)
echo [Bionify Reader] Building PluginZip.zip ...
call npm run build
if errorlevel 1 goto :error
echo.
echo Done: %~dp0PluginZip.zip
pause
exit /b 0
:error
echo.
echo Build failed. Copy the full terminal output and send it for debugging.
pause
exit /b 1
