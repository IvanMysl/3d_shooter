@echo off
setlocal
cd /d "%~dp0"
python tools\build.py
if errorlevel 1 (
  echo.
  echo ERROR: Game was not rebuilt. Check that Python is installed.
  pause
  exit /b 1
)
echo.
echo Done! Open index.html to play. No server or internet is needed.
pause
