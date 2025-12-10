const express = require('express');
const cors = require('cors');
const path = require('path');

// Importar módulos
const database = require('./database');
const sqlConnection = require('./sql-connection');
const scheduler = require('./scheduler');

// Importar rotas
const vendasRoutes = require('./routes/vendas');
const metasRoutes = require('./routes/metas');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend')));

// Inicializar banco de dados
database.initialize();

// Rotas da API
app.use('/api/vendas', vendasRoutes);
app.use('/api/metas', metasRoutes);

// Rota principal - serve o frontend
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// Endpoint de saúde
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        database: database.isConnected() ? 'connected' : 'disconnected'
    });
});

// Endpoints Power BI
const powerbiRefresh = require('./powerbi-refresh');

app.get('/api/powerbi/status', async (req, res) => {
    const status = await powerbiRefresh.getRefreshStatus();
    res.json(status);
});

app.post('/api/powerbi/refresh', async (req, res) => {
    const result = await powerbiRefresh.triggerRefresh();
    res.json(result);
});

// Iniciar servidor
app.listen(PORT, () => {
    console.log(`🚀 Servidor rodando em http://localhost:${PORT}`);
    console.log(`📊 Sistema de Metas de Gerentes - GBI`);

    // Iniciar agendador de tarefas
    scheduler.start();
});

module.exports = app;
