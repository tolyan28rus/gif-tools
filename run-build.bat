@echo off
cd /d "%~dp0"
echo Building GIF Tools...
call npx next build
if %errorlevel% neq 0 (
  echo Build failed!
  pause
  exit /b 1
)
echo Build complete!
pause
