@echo off
cd /d "%~dp0"
if not exist node_modules (
  echo [Bionify Reader] Installing dependencies...
  call npm install
  if errorlevel 1 goto :error
)
echo [Bionify Reader] Starting http://localhost:8080 ...
call npm run dev
exit /b %errorlevel%
:error
echo.
echo Failed. Copy the full terminal output and send it for debugging.
pause
exit /b 1
