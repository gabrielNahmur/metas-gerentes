@echo off
echo ========================================
echo  Metas de Gerentes - GBI
echo  Iniciando servidor...
echo ========================================
echo.

:: Inicia o servidor Node.js em background
start /B node backend/server.js

:: Aguarda 3 segundos para o servidor iniciar
timeout /t 3 /nobreak > nul

echo Servidor iniciado em http://localhost:3000
echo.
echo Iniciando tunel Ngrok...
echo Acesso externo: https://janeen-nontabulated-fredia.ngrok-free.dev
echo.

:: Inicia o ngrok com o dominio fixo
ngrok http 3000 --domain=janeen-nontabulated-fredia.ngrok-free.dev
