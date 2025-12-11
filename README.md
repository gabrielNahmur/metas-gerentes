# Sistema de Metas de Gerentes - GBI Combustíveis

Sistema web para definição e acompanhamento de metas gerenciais por unidade, integrado ao SQL Server e Power BI.

---

## Arquitetura

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Frontend      │────>│   Backend        │────>│   SQL Server    │
│   (HTML/JS)     │     │   (Node.js)      │     │   (Vendas)      │
└─────────────────┘     └────────┬─────────┘     └─────────────────┘
                                 │
                        ┌────────▼─────────┐
                        │   SQLite         │
                        │   (Metas/Cache)  │
                        └──────────────────┘
                                 │
                        ┌────────▼─────────┐
                        │   Power BI       │
                        │   (Dashboard)    │
                        └──────────────────┘
```

---

## Estrutura de Arquivos

```
metasGerentes/
├── backend/
│   ├── server.js           # Servidor Express principal
│   ├── database.js         # Conexão e schema SQLite
│   ├── sql-connection.js   # Conexão SQL Server
│   ├── scheduler.js        # Tarefas agendadas
│   ├── powerbi-refresh.js  # Refresh Power BI (opcional)
│   └── routes/
│       ├── metas.js        # API de metas
│       └── vendas.js       # API de vendas
├── frontend/
│   ├── index.html          # Interface web
│   ├── styles.css          # Estilos
│   └── app.js              # Lógica JavaScript
├── data/
│   └── metas.db            # Banco SQLite (gerado automaticamente)
├── scripts/
│   └── reset-db.js         # Script para resetar banco
└── package.json            # Dependências Node.js
```

---

## Backend

### server.js
Servidor Express que:
- Serve arquivos estáticos do frontend
- Expõe API REST em `/api/metas` e `/api/vendas`
- Inicializa banco de dados SQLite
- Inicia agendador de tarefas

### database.js
Gerencia o banco SQLite com as tabelas:

| Tabela | Descrição |
|--------|-----------|
| `unidades` | Cadastro das unidades (postos) |
| `metas` | Metas por unidade/mês/tipo (normalizado) |
| `metas_dayway` | Percentual DayWay por unidade/mês |
| `vendas_cache` | Cache de vendas do SQL Server |
| `metas_historico` | Histórico de alterações |

### sql-connection.js
Conexão com SQL Server (`192.168.20.250\SQL2016`):
- `buscarVendas(mes, ano)` - Busca vendas detalhadas
- `buscarResumoVendas(mes, ano)` - Retorna resumo agrupado por unidade

### scheduler.js
Tarefas agendadas via `node-schedule`:
- **06:00** - Sync vendas do SQL Server
- **07:00** - Refresh Power BI (se configurado)
- **Domingo 00:00** - Backup do banco de metas

---

## API REST

### Metas

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/api/metas?mes=X&ano=Y` | Lista metas agrupadas (frontend) |
| GET | `/api/metas/all` | Lista metas formato tabular (Power BI) |
| POST | `/api/metas` | Criar/atualizar meta individual |
| PUT | `/api/metas/batch` | Atualizar múltiplas metas |

**Formato `/api/metas` (frontend):**
```json
{
  "success": true,
  "data": [{
    "codigo": "001",
    "nome": "G. Sampaio",
    "tipo": "URBANO",
    "combustiveis_litros": 150000,
    "conveniencia_valor": 50000,
    "trocas_valor": 15000,
    "dayway_percent": 100
  }]
}
```

**Formato `/api/metas/all` (Power BI):**
```json
{
  "success": true,
  "data": [{
    "Unidade": "001",
    "Nome_Unidade": "G. Sampaio",
    "Mes": 12,
    "Ano": 2025,
    "Tipo_Produto": "COMBUSTÍVEIS",
    "Meta": 150000
  }]
}
```

### Vendas

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/api/vendas?mes=X&ano=Y` | Busca vendas do SQL Server |
| GET | `/api/vendas/indicadores?mes=X&ano=Y` | Indicadores agrupados (YOY/LLM) |
| POST | `/api/vendas/sync` | Força sincronização manual |
| GET | `/api/vendas/test-connection` | Testa conexão SQL Server |

---

## Frontend

### index.html
Interface estilo Excel com:
- Seletores de mês/ano
- Tabela com unidades agrupadas (URBANO/RODOVIA)
- Colunas: Ano Anterior, Orçamento, Mês Anterior, META, % vs Ano Ant.
- Botões: Sync Vendas, Salvar Metas

### app.js
Lógica principal:
- `carregarDados()` - Busca metas e vendas, sincroniza 3 períodos
- `renderTabela()` - Renderiza tabela com dados
- `startEditing()` - Edição inline de células
- `salvarMetas()` - Salva alterações via API

### styles.css
Estilos visuais:
- Cores por categoria (combustíveis=verde, loja=laranja, trocas=azul)
- Células editáveis destacadas
- Layout responsivo

---

## Banco de Dados

### Schema SQLite

```sql
-- Unidades
CREATE TABLE unidades (
    codigo TEXT PRIMARY KEY,
    nome TEXT NOT NULL,
    tipo TEXT DEFAULT 'URBANO',  -- URBANO ou RODOVIA
    is_combinada INTEGER DEFAULT 0
);

-- Metas (normalizado)
CREATE TABLE metas (
    id INTEGER PRIMARY KEY,
    unidade_codigo TEXT,
    mes INTEGER,
    ano INTEGER,
    tipo_produto TEXT,  -- COMBUSTÍVEIS, CONVENIENCIA, LUBRIFICANTES
    meta REAL DEFAULT 0,
    orcamento REAL DEFAULT 0,
    UNIQUE(unidade_codigo, mes, ano, tipo_produto)
);

-- DayWay separado
CREATE TABLE metas_dayway (
    id INTEGER PRIMARY KEY,
    unidade_codigo TEXT,
    mes INTEGER,
    ano INTEGER,
    dayway_percent REAL DEFAULT 100,
    UNIQUE(unidade_codigo, mes, ano)
);
```

---

## Configuração

### Variáveis de Conexão SQL Server
Arquivo: `backend/sql-connection.js`
```javascript
const config = {
    server: '192.168.20.250\\SQL2016',
    database: 'SMB_BI',
    user: 'SMB_BI',
    password: 'SMB_BI',
    requestTimeout: 120000  // 2 minutos
};
```

### Unidades Cadastradas
Arquivo: `backend/database.js` - função `seedUnidades()`

| Código | Nome | Tipo |
|--------|------|------|
| 001 | G. Sampaio | URBANO |
| 002 | S. Filho | URBANO |
| 003 | P. Vargas | URBANO |
| 004 | Próprio - Rio Branco | URBANO |
| 005 | S. Gabriel | URBANO |
| 006 | S. Bernardo | URBANO |
| 007 | BR 293 | RODOVIA |
| 008 | B. Upacarai | URBANO |
| 012 | Gral Osorio (Bagé) | URBANO |
| 013 | Gral Netto | URBANO |
| 050 | Eldorado | RODOVIA |
| 051 | Mathias | URBANO |
| 052 | Rio Branco | URBANO |
| 054 | Helvio Basso | URBANO |

---

## Deploy e Operação

### Iniciar com PM2
```bash
pm2 start backend/server.js --name "metas-gerentes"
pm2 start ngrok.exe --name "ngrok" --interpreter none -- http 3000 --domain=SEU_DOMINIO
pm2 save
```

### Atualizar código
```bash
git pull
pm2 restart metas-gerentes
```

### Monitorar
```bash
pm2 status     # Ver status
pm2 logs       # Ver logs
pm2 monit      # Monitor CPU/RAM
```

### Resetar banco de dados
```bash
node scripts/reset-db.js
```

---

## Integração Power BI

O Power BI consome a API `/api/metas/all` que retorna dados no formato tabular:
- Uma linha por **Unidade + Tipo Produto + Mês/Ano**
- Colunas: Unidade, Nome_Unidade, Mes, Ano, Tipo_Produto, Meta

### Configurar no Power BI Desktop
1. Obter Dados → Web
2. URL: `https://SEU_DOMINIO.ngrok-free.dev/api/metas/all`
3. Transformar em tabela no Power Query
4. Configurar refresh agendado no Power BI Service

---

## Dependências

| Pacote | Versão | Descrição |
|--------|--------|-----------|
| express | ^4.18 | Framework web |
| cors | ^2.8 | Habilita CORS |
| better-sqlite3 | ^9.4 | Banco SQLite |
| mssql | ^10.0 | Conexão SQL Server |
| node-schedule | ^2.1 | Agendador de tarefas |
| axios | ^1.6 | Cliente HTTP |

---

## Licença

Desenvolvido para GBI Combustíveis LTDA.
