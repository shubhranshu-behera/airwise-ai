@echo off
setlocal

title Push AirWise AI to GitHub

cd /d "%~dp0"

echo ========================================================
echo             Push AirWise AI to GitHub
echo ========================================================
echo.
echo Since you are already logged in to GitHub in your browser:
echo.
echo 1. Open this link in your browser to generate a token:
echo    https://github.com/settings/tokens/new
echo.
echo 2. Note: Give it a name (e.g. 'AirWise') and check the 'repo' scope.
echo    Scroll down and click 'Generate token'.
echo.
echo 3. Copy the token (starts with ghp_...) and paste it below.
echo.

node scripts/upload-to-github.mjs

echo.
pause
