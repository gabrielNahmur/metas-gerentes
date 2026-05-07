@echo off
echo ========================================================
echo GBI - Sincronizador de Metas e Vendas para AWS Lightsail
echo ========================================================
echo %date% %time%
echo.

:: Vai para a pasta correta onde o script está
cd /d "%~dp0"
node agente-sync.js

echo.
echo Processo finalizado!
