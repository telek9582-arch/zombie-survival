#!/bin/sh
cd "$(dirname "$0")"
command -v node >/dev/null 2>&1 || { echo "Установите Node.js (LTS) с https://nodejs.org и запустите снова."; exit 1; }
node server.js
