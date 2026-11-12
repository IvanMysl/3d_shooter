@echo off
setlocal
cd /d "%~dp0"
py -3 tools\package.py --output "%~dp0NEON_RIFT_3D_MODULAR.zip"
if errorlevel 1 (
  echo Packaging failed. See the error message above.
  pause
  exit /b 1
)
echo Full ZIP package is ready.
pause
