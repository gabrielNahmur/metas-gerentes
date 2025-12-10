# Metas de Gerentes - GBI

Sistema de automação para gerenciamento de metas de gerentes.

## 🌐 Acesso

**URL Pública:** https://janeen-nontabulated-fredia.ngrok-free.dev

> O diretor pode acessar de qualquer lugar usando essa URL!

## ⚡ Iniciar (Duplo-clique)

Basta executar o arquivo `iniciar.bat` - ele inicia tudo automaticamente.

## 📋 Instalação (primeira vez)

```bash
# 1. Instalar Node.js: https://nodejs.org
# 2. Instalar Ngrok: https://ngrok.com/download
# 3. Configurar token do Ngrok (uma vez):
ngrok config add-authtoken SEU_TOKEN_AQUI

# 4. Instalar dependências do projeto:
npm install
```

## 🔧 Estrutura

```
metasGerentes/
├── backend/          # API Node.js
├── frontend/         # Interface web
├── data/             # Banco SQLite
├── iniciar.bat       # Script de inicialização
└── package.json
```

## ⏰ Automações

| Tarefa | Horário |
|--------|---------|
| Sync Vendas | 06:00 |
| Refresh Power BI | 07:00 |
| Backup Metas | Dom 00:00 |
