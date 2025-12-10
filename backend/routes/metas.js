const express = require('express');
const router = express.Router();
const database = require('../database');

/**
 * GET /api/metas
 * Retorna metas do mês/ano agrupadas por unidade (para o frontend)
 */
router.get('/', (req, res) => {
    try {
        const mes = parseInt(req.query.mes) || new Date().getMonth() + 1;
        const ano = parseInt(req.query.ano) || new Date().getFullYear();

        const db = database.getDb();

        // Buscar unidades
        const unidades = db.prepare(`
            SELECT codigo, nome, tipo, is_combinada FROM unidades ORDER BY tipo, codigo
        `).all();

        // Buscar metas do período
        const metas = db.prepare(`
            SELECT unidade_codigo, tipo_produto, meta 
            FROM metas 
            WHERE mes = ? AND ano = ?
        `).all(mes, ano);

        // Buscar DayWay do período
        const dayways = db.prepare(`
            SELECT unidade_codigo, dayway_percent 
            FROM metas_dayway 
            WHERE mes = ? AND ano = ?
        `).all(mes, ano);

        // Criar mapa de metas por unidade
        const metasMap = {};
        for (const m of metas) {
            if (!metasMap[m.unidade_codigo]) {
                metasMap[m.unidade_codigo] = {};
            }
            metasMap[m.unidade_codigo][m.tipo_produto] = m.meta;
        }

        // Criar mapa de DayWay por unidade
        const daywayMap = {};
        for (const d of dayways) {
            daywayMap[d.unidade_codigo] = d.dayway_percent;
        }

        // Montar resposta agrupada para o frontend
        const dados = unidades.map(u => ({
            codigo: u.codigo,
            nome: u.nome,
            tipo: u.tipo,
            is_combinada: u.is_combinada,
            combustiveis_litros: metasMap[u.codigo]?.['COMBUSTÍVEIS'] || 0,
            conveniencia_valor: metasMap[u.codigo]?.['CONVENIENCIA'] || 0,
            trocas_valor: metasMap[u.codigo]?.['LUBRIFICANTES'] || 0,
            dayway_percent: daywayMap[u.codigo] || 100
        }));

        res.json({
            success: true,
            mes,
            ano,
            data: dados
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/metas/all
 * Retorna TODAS as metas no formato TABULAR para Power BI
 * (igual planilha Excel: Unidade, Mês/Ano, Tipo Produto, Meta)
 */
router.get('/all', (req, res) => {
    try {
        const db = database.getDb();

        const dados = db.prepare(`
            SELECT 
                m.unidade_codigo as Unidade,
                (m.ano || '-' || printf('%02d', m.mes) || '-01') as "Mês/Ano",
                m.tipo_produto as "Tipo Produto",
                m.meta as Meta
            FROM metas m
            ORDER BY m.ano DESC, m.mes DESC, m.unidade_codigo, m.tipo_produto
        `).all();

        res.json({
            success: true,
            total: dados.length,
            data: dados
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/metas/:codigo
 * Retorna meta de uma unidade específica
 */
router.get('/:codigo', (req, res) => {
    try {
        const { codigo } = req.params;
        const mes = parseInt(req.query.mes) || new Date().getMonth() + 1;
        const ano = parseInt(req.query.ano) || new Date().getFullYear();

        const db = database.getDb();

        const unidade = db.prepare(`
            SELECT codigo, nome, tipo, is_combinada FROM unidades WHERE codigo = ?
        `).get(codigo);

        if (!unidade) {
            return res.status(404).json({
                success: false,
                error: 'Unidade não encontrada'
            });
        }

        const metas = db.prepare(`
            SELECT tipo_produto, meta FROM metas 
            WHERE unidade_codigo = ? AND mes = ? AND ano = ?
        `).all(codigo, mes, ano);

        const dayway = db.prepare(`
            SELECT dayway_percent FROM metas_dayway 
            WHERE unidade_codigo = ? AND mes = ? AND ano = ?
        `).get(codigo, mes, ano);

        const metasObj = {};
        for (const m of metas) {
            metasObj[m.tipo_produto] = m.meta;
        }

        res.json({
            success: true,
            data: {
                ...unidade,
                combustiveis_litros: metasObj['COMBUSTÍVEIS'] || 0,
                conveniencia_valor: metasObj['CONVENIENCIA'] || 0,
                trocas_valor: metasObj['LUBRIFICANTES'] || 0,
                dayway_percent: dayway?.dayway_percent || 100
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/metas
 * Cria ou atualiza metas de uma unidade
 * Recebe formato do frontend e salva no formato normalizado
 */
router.post('/', (req, res) => {
    try {
        const {
            unidade_codigo,
            mes,
            ano,
            combustiveis_litros,
            conveniencia_valor,
            trocas_valor,
            dayway_percent
        } = req.body;

        if (!unidade_codigo || !mes || !ano) {
            return res.status(400).json({
                success: false,
                error: 'Campos obrigatórios: unidade_codigo, mes, ano'
            });
        }

        const db = database.getDb();

        // Salvar cada tipo de produto como uma linha separada
        const stmtMeta = db.prepare(`
            INSERT INTO metas (unidade_codigo, mes, ano, tipo_produto, meta, updated_at)
            VALUES (@unidade_codigo, @mes, @ano, @tipo_produto, @meta, datetime('now'))
            ON CONFLICT(unidade_codigo, mes, ano, tipo_produto) DO UPDATE SET
                meta = @meta,
                updated_at = datetime('now')
        `);

        const stmtDayway = db.prepare(`
            INSERT INTO metas_dayway (unidade_codigo, mes, ano, dayway_percent, updated_at)
            VALUES (@unidade_codigo, @mes, @ano, @dayway_percent, datetime('now'))
            ON CONFLICT(unidade_codigo, mes, ano) DO UPDATE SET
                dayway_percent = @dayway_percent,
                updated_at = datetime('now')
        `);

        const transaction = db.transaction(() => {
            // Salvar metas por tipo de produto
            stmtMeta.run({
                unidade_codigo,
                mes: parseInt(mes),
                ano: parseInt(ano),
                tipo_produto: 'COMBUSTÍVEIS',
                meta: parseFloat(combustiveis_litros) || 0
            });

            stmtMeta.run({
                unidade_codigo,
                mes: parseInt(mes),
                ano: parseInt(ano),
                tipo_produto: 'CONVENIENCIA',
                meta: parseFloat(conveniencia_valor) || 0
            });

            stmtMeta.run({
                unidade_codigo,
                mes: parseInt(mes),
                ano: parseInt(ano),
                tipo_produto: 'LUBRIFICANTES',
                meta: parseFloat(trocas_valor) || 0
            });

            // Salvar DayWay
            stmtDayway.run({
                unidade_codigo,
                mes: parseInt(mes),
                ano: parseInt(ano),
                dayway_percent: parseFloat(dayway_percent) || 100
            });
        });

        transaction();

        res.json({
            success: true,
            message: 'Metas salvas com sucesso'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * PUT /api/metas/batch
 * Atualiza múltiplas metas de uma vez
 */
router.put('/batch', (req, res) => {
    try {
        const { metas } = req.body;

        if (!Array.isArray(metas) || metas.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Envie um array de metas'
            });
        }

        const db = database.getDb();

        const stmtMeta = db.prepare(`
            INSERT INTO metas (unidade_codigo, mes, ano, tipo_produto, meta, updated_at)
            VALUES (@unidade_codigo, @mes, @ano, @tipo_produto, @meta, datetime('now'))
            ON CONFLICT(unidade_codigo, mes, ano, tipo_produto) DO UPDATE SET
                meta = @meta,
                updated_at = datetime('now')
        `);

        const stmtDayway = db.prepare(`
            INSERT INTO metas_dayway (unidade_codigo, mes, ano, dayway_percent, updated_at)
            VALUES (@unidade_codigo, @mes, @ano, @dayway_percent, datetime('now'))
            ON CONFLICT(unidade_codigo, mes, ano) DO UPDATE SET
                dayway_percent = @dayway_percent,
                updated_at = datetime('now')
        `);

        const transaction = db.transaction((metas) => {
            for (const meta of metas) {
                const mes = parseInt(meta.mes);
                const ano = parseInt(meta.ano);

                // Salvar combustíveis
                stmtMeta.run({
                    unidade_codigo: meta.unidade_codigo,
                    mes, ano,
                    tipo_produto: 'COMBUSTÍVEIS',
                    meta: parseFloat(meta.combustiveis_litros) || 0
                });

                // Salvar conveniência
                stmtMeta.run({
                    unidade_codigo: meta.unidade_codigo,
                    mes, ano,
                    tipo_produto: 'CONVENIENCIA',
                    meta: parseFloat(meta.conveniencia_valor) || 0
                });

                // Salvar lubrificantes (trocas)
                stmtMeta.run({
                    unidade_codigo: meta.unidade_codigo,
                    mes, ano,
                    tipo_produto: 'LUBRIFICANTES',
                    meta: parseFloat(meta.trocas_valor) || 0
                });

                // Salvar DayWay
                stmtDayway.run({
                    unidade_codigo: meta.unidade_codigo,
                    mes, ano,
                    dayway_percent: parseFloat(meta.dayway_percent) || 100
                });
            }
        });

        transaction(metas);

        res.json({
            success: true,
            message: `${metas.length} metas salvas com sucesso`
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/metas/historico/:codigo
 * Retorna histórico de metas de uma unidade
 */
router.get('/historico/:codigo', (req, res) => {
    try {
        const { codigo } = req.params;

        const db = database.getDb();

        const historico = db.prepare(`
            SELECT * FROM metas_historico
            WHERE unidade_codigo = ?
            ORDER BY ano DESC, mes DESC
            LIMIT 36
        `).all(codigo);

        res.json({
            success: true,
            data: historico
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/metas/config/unidades
 * Retorna lista de unidades
 */
router.get('/config/unidades', (req, res) => {
    try {
        const db = database.getDb();

        const unidades = db.prepare(`
            SELECT * FROM unidades ORDER BY tipo, codigo
        `).all();

        res.json({
            success: true,
            data: unidades
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

module.exports = router;
