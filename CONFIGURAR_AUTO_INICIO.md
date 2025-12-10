# Como Configurar Inicialização Automática no Windows Server

## Opção 1: Agendador de Tarefas (Recomendado)

### Passo a passo:

1. **Abra o Agendador de Tarefas**
   - Pressione `Win + R`
   - Digite `taskschd.msc` e pressione Enter

2. **Crie uma nova tarefa**
   - Clique em "Criar Tarefa..." (lado direito)

3. **Aba "Geral"**
   - Nome: `Metas Gerentes - GBI`
   - Marque: "Executar estando o usuário conectado ou não"
   - Marque: "Executar com privilégios mais altos"

4. **Aba "Disparadores"**
   - Clique em "Novo..."
   - Selecione: "Ao iniciar"
   - Atraso: 30 segundos (para dar tempo do sistema carregar)
   - Clique OK

5. **Aba "Ações"**
   - Clique em "Novo..."
   - Ação: "Iniciar um programa"
   - Programa: `C:\metasGerentes\auto-start.bat`
   - Clique OK

6. **Aba "Condições"**
   - Desmarque: "Iniciar a tarefa somente se o computador estiver ligado na tomada"

7. **Aba "Configurações"**
   - Marque: "Permitir que a tarefa seja executada por demanda"
   - Marque: "Se a tarefa falhar, reiniciar a cada: 1 minuto"
   - Tentativas: 3

8. **Clique OK** e digite a senha do administrador

---

## Opção 2: PM2 (Gerenciador de Processos)

```bash
# Instalar PM2 globalmente
npm install -g pm2
npm install -g pm2-windows-startup

# Iniciar os serviços
pm2 start backend/server.js --name "metas-api"
pm2 start "ngrok http 3000 --domain=janeen-nontabulated-fredia.ngrok-free.dev" --name "metas-tunnel"

# Configurar startup
pm2 save
pm2-startup install
```

---

## Estrutura no Servidor

Copie a pasta para `C:\metasGerentes` no servidor:

```
C:\metasGerentes\
├── backend\
├── frontend\
├── data\
├── node_modules\
├── auto-start.bat     <- Script de inicialização
├── iniciar.bat        <- Iniciar manualmente
└── package.json
```

---

## Verificar se está funcionando

Após reiniciar o servidor, acesse:
https://janeen-nontabulated-fredia.ngrok-free.dev

Se não funcionar, verifique o arquivo `C:\metasGerentes\startup.log`
