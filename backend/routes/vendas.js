const express = require('express');
const router = express.Router();
const sqlConnection = require('../sql-connection');
const database = require('../database');
const scheduler = require('../scheduler');

/**
 * GET /api/vendas
 * Retorna vendas do mês/ano especificado
 */
router.get('/', async (req, res) => {
    try {
        const mes = parseInt(req.query.mes) || new Date().getMonth() + 1;
        const ano = parseInt(req.query.ano) || new Date().getFullYear();

        const vendas = await sqlConnection.buscarResumoVendas(mes, ano);

        res.json({
            success: true,
            mes,
            ano,
            data: vendas
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/vendas/cache
 * Retorna vendas do cache local (SQLite)
 */
router.get('/cache', (req, res) => {
    try {
        const mes = parseInt(req.query.mes) || new Date().getMonth() + 1;
        const ano = parseInt(req.query.ano) || new Date().getFullYear();

        const db = database.getDb();
        const vendas = db.prepare(`
            SELECT * FROM vendas_cache 
            WHERE mes = ? AND ano = ?
        `).all(mes, ano);

        res.json({
            success: true,
            mes,
            ano,
            source: 'cache',
            data: vendas
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/vendas/sync
 * Força sync manual de vendas do SQL Server
 */
router.post('/sync', async (req, res) => {
    try {
        const mes = parseInt(req.body.mes) || new Date().getMonth() + 1;
        const ano = parseInt(req.body.ano) || new Date().getFullYear();

        const resultado = await scheduler.executarSyncManual(mes, ano);

        res.json(resultado);
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/vendas/test-connection
 * Testa conexão com SQL Server
 */
router.get('/test-connection', async (req, res) => {
    const resultado = await sqlConnection.testarConexao();
    res.json(resultado);
});

/**
 * GET /api/vendas/indicadores
 * Retorna indicadores agrupados por unidade (combustíveis, conveniência, trocas)
 * Usado para YOY e LLM no frontend
 */
router.get('/indicadores', async (req, res) => {
    try {
        const mes = parseInt(req.query.mes) || new Date().getMonth() + 1;
        const ano = parseInt(req.query.ano) || new Date().getFullYear();

        // Primeiro tenta do cache local
        const db = database.getDb();
        let vendas = db.prepare(`
            SELECT unidade_codigo, categoria, valor_total, quantidade_total 
            FROM vendas_cache 
            WHERE mes = ? AND ano = ?
        `).all(mes, ano);

        let usouCache = vendas.length > 0;

        // Se não tem cache, busca do SQL Server diretamente
        if (!usouCache) {
            try {
                const sqlVendas = await sqlConnection.buscarResumoVendas(mes, ano);
                // buscarResumoVendas já retorna dados agrupados por unidade
                // com campos: combustiveis_qtd, combustiveis_valor, conveniencia_valor, trocas_valor
                if (sqlVendas && sqlVendas.length > 0) {
                    return res.json({
                        success: true,
                        mes,
                        ano,
                        source: 'sql_server',
                        data: sqlVendas.map(v => ({
                            codigo: v.codigo,
                            combustiveis_qtd: v.combustiveis_qtd || 0,
                            combustiveis_valor: v.combustiveis_valor || 0,
                            conveniencia_valor: v.conveniencia_valor || 0,
                            trocas_valor: v.trocas_valor || 0
                        }))
                    });
                }
            } catch (e) {
                console.warn('SQL Server indisponível:', e.message);
            }
        }

        // Agrupar dados do cache por unidade
        const unidadesMap = {};

        vendas.forEach(v => {
            const codigo = v.unidade_codigo;
            if (!unidadesMap[codigo]) {
                unidadesMap[codigo] = {
                    codigo,
                    combustiveis_qtd: 0,
                    combustiveis_valor: 0,
                    conveniencia_valor: 0,
                    trocas_valor: 0
                };
            }

            const cat = (v.categoria || '').toUpperCase();

            if (cat.includes('COMBUST')) {
                unidadesMap[codigo].combustiveis_qtd += v.quantidade_total || 0;
                unidadesMap[codigo].combustiveis_valor += v.valor_total || 0;
            } else if (cat.includes('CONVENI') || cat.includes('LOJA')) {
                unidadesMap[codigo].conveniencia_valor += v.valor_total || 0;
            } else if (cat.includes('LUBRI') || cat.includes('ADITIVO') || cat.includes('FILTRO') || cat.includes('ACESSORIO')) {
                unidadesMap[codigo].trocas_valor += v.valor_total || 0;
            }
        });

        res.json({
            success: true,
            mes,
            ano,
            source: usouCache ? 'cache' : 'empty',
            data: Object.values(unidadesMap)
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

module.exports = router;
