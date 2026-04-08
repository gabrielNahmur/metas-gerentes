const sql = require('mssql');

// Configuração do SQL Server (baseado no VBA original)
const config = {
    server: process.env.SQL_SERVER || '192.168.20.250\\SQL2016',
    database: 'SMB_BI',
    user: 'SMB_BI',
    password: 'SMB_BI',
    options: {
        encrypt: false,
        trustServerCertificate: true,
        enableArithAbort: true
    },
    requestTimeout: 120000,     // 2 minutos para consultas
    connectionTimeout: 30000,   // 30 segundos para conectar
    pool: {
        max: 10,
        min: 0,
        idleTimeoutMillis: 30000
    }
};

let pool = null;

/**
 * Conecta ao SQL Server
 */
async function connect() {
    try {
        if (!pool) {
            pool = await sql.connect(config);
            console.log('✅ Conectado ao SQL Server');
        }
        return pool;
    } catch (error) {
        console.error('❌ Erro ao conectar ao SQL Server:', error.message);
        throw error;
    }
}

/**
 * Busca dados de vendas do SQL Server
 * Replica a lógica do VBA original
 */
async function buscarVendas(mes, ano) {
    try {
        await connect();

        // Calcular período YOY (M+1, Y-1)
        const dataBase = new Date(ano, mes - 1, 1);
        const dataYOY = new Date(dataBase);
        dataYOY.setMonth(dataYOY.getMonth() + 1);
        dataYOY.setFullYear(dataYOY.getFullYear() - 1);

        const mesYOY = dataYOY.getMonth() + 1;
        const anoYOY = dataYOY.getFullYear();

        const query = `
            SELECT 
                T.CD_ESTAB,
                T.DESCRICAO_CATEGORIA_ITEM,
                SUM(CASE WHEN YEAR(T.DATA_EMISSAO) = @ano AND MONTH(T.DATA_EMISSAO) = @mes 
                    THEN T.TOT_VLRITEM_REGRA ELSE 0 END) AS ValorMesSelecionado,
                SUM(CASE WHEN YEAR(T.DATA_EMISSAO) = @ano AND MONTH(T.DATA_EMISSAO) = @mes 
                    THEN T.QTD_VENDA ELSE 0 END) AS QtdMesSelecionado,
                SUM(CASE WHEN YEAR(T.DATA_EMISSAO) = @anoYOY AND MONTH(T.DATA_EMISSAO) = @mesYOY 
                    THEN T.TOT_VLRITEM_REGRA ELSE 0 END) AS ValorYOY,
                SUM(CASE WHEN YEAR(T.DATA_EMISSAO) = @anoYOY AND MONTH(T.DATA_EMISSAO) = @mesYOY 
                    THEN T.QTD_VENDA ELSE 0 END) AS QtdYOY
            FROM TMPBI_VENDA_DETALHADA AS T
            WHERE (
                (YEAR(T.DATA_EMISSAO) = @ano AND MONTH(T.DATA_EMISSAO) = @mes)
                OR (YEAR(T.DATA_EMISSAO) = @anoYOY AND MONTH(T.DATA_EMISSAO) = @mesYOY)
            )
            AND T.DESCRICAO_CATEGORIA_ITEM IN ('COMBUSTÍVEIS', 'CONVENIENCIA', 'LUBRIFICANTES', 'ADITIVOS', 'FILTROS', 'ACESSORIOS')
            AND T.SITUACAO = 'NORMAL'
            GROUP BY T.CD_ESTAB, T.DESCRICAO_CATEGORIA_ITEM
        `;

        const result = await pool.request()
            .input('mes', sql.Int, mes)
            .input('ano', sql.Int, ano)
            .input('mesYOY', sql.Int, mesYOY)
            .input('anoYOY', sql.Int, anoYOY)
            .query(query);

        return result.recordset;
    } catch (error) {
        console.error('❌ Erro ao buscar vendas:', error.message);
        throw error;
    }
}

/**
 * Busca resumo de vendas agrupado por unidade
 */
async function buscarResumoVendas(mes, ano) {
    try {
        const vendas = await buscarVendas(mes, ano);

        // Agrupar por unidade
        const resumo = {};

        for (const venda of vendas) {
            const codigo = venda.CD_ESTAB.toString().padStart(3, '0');

            if (!resumo[codigo]) {
                resumo[codigo] = {
                    codigo,
                    combustiveis_valor: 0,
                    combustiveis_qtd: 0,
                    conveniencia_valor: 0,
                    trocas_valor: 0,
                    yoy: {
                        combustiveis_qtd: 0,
                        conveniencia_valor: 0,
                        trocas_valor: 0
                    }
                };
            }

            const categoria = venda.DESCRICAO_CATEGORIA_ITEM;

            if (categoria === 'COMBUSTÍVEIS') {
                resumo[codigo].combustiveis_valor += venda.ValorMesSelecionado || 0;
                resumo[codigo].combustiveis_qtd += venda.QtdMesSelecionado || 0;
                resumo[codigo].yoy.combustiveis_qtd += venda.QtdYOY || 0;
            } else if (categoria === 'CONVENIENCIA') {
                resumo[codigo].conveniencia_valor += venda.ValorMesSelecionado || 0;
                resumo[codigo].yoy.conveniencia_valor += venda.ValorYOY || 0;
            } else if (['LUBRIFICANTES', 'ADITIVOS', 'FILTROS', 'ACESSORIOS'].includes(categoria)) {
                resumo[codigo].trocas_valor += venda.ValorMesSelecionado || 0;
                resumo[codigo].yoy.trocas_valor += venda.ValorYOY || 0;
            }
        }

        return Object.values(resumo);
    } catch (error) {
        console.error('❌ Erro ao buscar resumo de vendas:', error.message);
        throw error;
    }
}

/**
 * Testa a conexão com o SQL Server
 */
async function testarConexao() {
    try {
        await connect();
        const result = await pool.request().query('SELECT 1 AS test');
        return { success: true, message: 'Conexão OK' };
    } catch (error) {
        return { success: false, message: error.message };
    }
}

/**
 * Fecha a conexão
 */
async function close() {
    if (pool) {
        await pool.close();
        pool = null;
    }
}

module.exports = {
    connect,
    buscarVendas,
    buscarResumoVendas,
    testarConexao,
    close
};
