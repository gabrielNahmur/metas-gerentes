@echo off
:: ========================================
:: Metas de Gerentes - GBI
:: Script de inicializacao automatica
:: ========================================

:: Definir diretorio do projeto
set PROJECT_DIR=C:\metasGerentes

:: Navegar para o diretorio
cd /d %PROJECT_DIR%

:: Iniciar o servidor Node.js em background (sem janela)
start /B node backend/server.js

:: Aguardar 5 segundos
timeout /t 5 /nobreak > nul

:: Iniciar o Ngrok em background
start /B ngrok http 3000 --domain=janeen-nontabulated-fredia.ngrok-free.dev --log=stdout > ngrok.log 2>&1

:: Log de inicio
echo [%date% %time%] Sistema iniciado >> startup.log
