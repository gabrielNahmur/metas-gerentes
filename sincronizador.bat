@echo off
echo ========================================================
echo GBI - Sincronizador de Metas e Vendas para AWS Lightsail
echo ========================================================
echo %date% %time%
echo.
echo Unidades monitoradas:
echo   001 G. Sampaio        002 S. Filho           003 P. Vargas
echo   004 Proprio Rio Branco 005 S. Gabriel         006 S. Bernardo
echo   007 BR 293            008 B. Upacarai         012 Gral Osorio (Bage)
echo   013 Gral Netto        014 Av. Santa Tecla 
echo   050 Eldorado          051 Mathias             052 Rio Branco
echo   054 Helvio Basso
echo.

:: Vai para a pasta correta onde o script esta
cd /d "%~dp0"
node agente-sync.js

echo.
echo Processo finalizado!
