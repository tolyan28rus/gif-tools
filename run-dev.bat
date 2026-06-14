@echo off
cd /d "%~dp0"
echo Starting GIF Tools dev server...
call npx next dev -p 3000 2>&1
pause
