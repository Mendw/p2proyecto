@echo off
start cmd /k node index.js 1101
Timeout /t 1 /nobreak >nul
start cmd /k node index.js 1102 1101