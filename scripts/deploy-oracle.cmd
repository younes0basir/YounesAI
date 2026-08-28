@echo off
REM Run Oracle deploy from CMD (double-click or: scripts\deploy-oracle.cmd)
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0deploy-oracle.ps1" %*
