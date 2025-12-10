# Guia de Deploy - Sistema de Metas de Gerentes

Este guia mostra como configurar o sistema para rodar 24/7 no servidor da empresa.

---

## Pré-requisitos no Servidor

1. **Node.js** instalado (v18+): https://nodejs.org/
2. **Git** instalado: https://git-scm.com/
3. **Ngrok** instalado e autenticado
4. Acesso de administrador ao Windows Server

---

## Passo 1: Configurar Git no Servidor

### No seu PC (desenvolvimento):

```bash
# Na pasta do projeto
cd "c:\Users\confi\OneDrive - GBI COMBUSTIVEIS LTDA\Área de Trabalho\metasGerentes"

# Inicializar Git (se ainda não fez)
git init

# Adicionar arquivos
git add .

# Criar primeiro commit
git commit -m "Versão inicial do sistema de metas"

# Criar repositório no GitHub (privado) e conectar
git remote add origin https://github.com/SEU_USUARIO/metas-gerentes.git
git branch -M main
git push -u origin main
```

### No Servidor:

```bash
# Clonar o repositório
cd C:\
git clone https://github.com/SEU_USUARIO/metas-gerentes.git

# Entrar na pasta
cd metas-gerentes

# Instalar dependências
npm install
```

---

## Passo 2: Instalar PM2

```bash
# Instalar PM2 globalmente
npm install pm2 -g

# Instalar módulo para startup no Windows
npm install pm2-windows-startup -g
```

---

## Passo 3: Iniciar o Servidor com PM2

```bash
# Na pasta do projeto no servidor
cd C:\metas-gerentes

# Iniciar o servidor
pm2 start backend/server.js --name "metas-gerentes"

# Verificar se está rodando
pm2 status
```

---

## Passo 4: Configurar Auto-Start no Windows

```bash
# Salvar configuração atual
pm2 save

# Configurar para iniciar com o Windows
pm2-startup install
```

> ⚠️ **Alternativa:** Se `pm2-startup` não funcionar, use o Agendador de Tarefas:
> 1. Criar tarefa > Ao iniciar o computador
> 2. Ação: Executar programa
> 3. Programa: `C:\Users\Administrator\AppData\Roaming\npm\pm2.cmd`
> 4. Argumentos: `resurrect`

---

## Passo 5: Configurar Ngrok

### Opção A: Rodar Ngrok com PM2

```bash
# Criar script para Ngrok
pm2 start "ngrok http 3000 --domain=janeen-nontabulated-fredia.ngrok-free.dev" --name "ngrok"
pm2 save
```

### Opção B: Usar arquivo de configuração do Ngrok

Criar arquivo `C:\metas-gerentes\ngrok.yml`:
```yaml
version: "2"
tunnels:
  metas:
    addr: 3000
    proto: http
    domain: janeen-nontabulated-fredia.ngrok-free.dev
```

Depois:
```bash
pm2 start "ngrok start --config=ngrok.yml metas" --name "ngrok"
pm2 save
```

---

## Comandos Úteis PM2

| Comando | Descrição |
|---------|-----------|
| `pm2 status` | Ver processos rodando |
| `pm2 logs` | Ver logs em tempo real |
| `pm2 logs metas-gerentes` | Logs só do servidor |
| `pm2 restart metas-gerentes` | Reiniciar após alterações |
| `pm2 stop metas-gerentes` | Parar o servidor |
| `pm2 delete metas-gerentes` | Remover do PM2 |
| `pm2 monit` | Monitor de CPU/RAM |

---

## Fluxo de Atualização do Código

### No seu PC (após fazer alterações):

```bash
git add .
git commit -m "Descrição da alteração"
git push
```

### No Servidor:

```bash
cd C:\metas-gerentes
git pull
pm2 restart metas-gerentes
```

---

## Verificar se Está Funcionando

1. Acesse: http://localhost:3000 (no servidor)
2. Acesse: https://janeen-nontabulated-fredia.ngrok-free.dev (externo)
3. Verifique logs: `pm2 logs`

---

## Arquivos Importantes

| Arquivo | Descrição |
|---------|-----------|
| `data/metas.db` | Banco de dados SQLite (FAZER BACKUP!) |
| `backend/sql-connection.js` | Configuração SQL Server |
| `.env` (criar se necessário) | Variáveis de ambiente |

---

## Backup Automático

O sistema já faz backup automático do banco de metas todo **domingo à meia-noite**.
Os backups ficam em `data/backups/`.
