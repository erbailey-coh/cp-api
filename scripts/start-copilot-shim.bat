@echo off
REM Copilot Shim Auto-Start Script for Windows Task Scheduler
REM This script starts the copilot-shim service in WSL2

REM Start WSL and run PM2 resurrect to restore saved processes
wsl.exe -d Ubuntu-22.04 -- bash -lc "cd ~/development/copilot-shim && pm2 resurrect 2>/dev/null || pm2 start ecosystem.config.js"

REM Keep window open briefly to show any errors (remove this line for silent operation)
REM timeout /t 5
