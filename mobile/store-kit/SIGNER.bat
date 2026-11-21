@echo off
rem Double-click to sign the app for Google Play and Amazon. The key never leaves this PC.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0SIGNER.ps1"
echo.
pause
