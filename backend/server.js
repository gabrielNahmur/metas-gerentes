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
app.use(express.json({ limit: '50mb' })); // Necessário limite maior para agent push

// --- TRAVA DE SEGURANÇA (BASIC AUTH) ---
app.use((req, res, next) => {
    // Liberar acesso para rotas críticas (Agente Local e Power BI) passarem sem a tela cinza
    const whitelist = [
        '/api/vendas/upload_sync', 
        '/api/powerbi', 
        '/api/metas/all', 
        '/api/metas/dayway/all'
    ];
    
    if (whitelist.some(route => req.path.startsWith(route))) {
        return next();
    }

    const user = process.env.BASIC_AUTH_USER || 'admin';
    const pass = process.env.BASIC_AUTH_PASS || 'gbi@2026';
    
    const b64auth = (req.headers.authorization || '').split(' ')[1] || '';
    const [login, password] = Buffer.from(b64auth, 'base64').toString().split(':');

    if (login && password && login === user && password === pass) {
        return next();
    }

    res.set('WWW-Authenticate', 'Basic realm="Acesso Restrito GBI"');
    res.status(401).send('Acesso Negado. Credenciais invalidas.');
});

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
