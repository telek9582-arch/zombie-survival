@echo off
chcp 65001 >nul
title Zombie Survival - сервер на компьютере
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js не установлен. Скачайте версию LTS на https://nodejs.org , установите и запустите этот файл снова.
  pause
  exit /b
)
node server.js
pause
