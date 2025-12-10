const schedule = require('node-schedule');
const sqlConnection = require('./sql-connection');
const database = require('./database');
const powerbiRefresh = require('./powerbi-refresh');

/**
 * Inicia todas as tarefas agendadas
 */
function start() {
    console.log('⏰ Iniciando agendador de tarefas...');

    // Sync de vendas: Todo dia às 6h
    schedule.scheduleJob('0 6 * * *', async () => {
        console.log('🔄 [6:00] Iniciando sync de vendas...');
        await syncVendas();
    });

    // Refresh Power BI: Todo dia às 7h
    schedule.scheduleJob('0 7 * * *', async () => {
        console.log('📊 [7:00] Disparando refresh do Power BI...');
        await powerbiRefresh.triggerRefresh();
    });

    // Backup de metas: Todo domingo à meia-noite
    schedule.scheduleJob('0 0 * * 0', async () => {
        console.log('💾 [Domingo 00:00] Fazendo backup de metas...');
        await backupMetas();
    });

    console.log('✅ Tarefas agendadas:');
    console.log('   - Sync Vendas: 06:00 (diário)');
    console.log('   - Refresh Power BI: 07:00 (diário)');
    console.log('   - Backup Metas: 00:00 (domingo)');
}

/**
 * Sincroniza vendas do SQL Server para o cache local
 */
async function syncVendas() {
    try {
        const db = database.getDb();
        const agora = new Date();
        const mes = agora.getMonth() + 1;
        const ano = agora.getFullYear();

        console.log(`🔍 Buscando vendas para ${mes}/${ano}...`);

        const vendas = await sqlConnection.buscarVendas(mes, ano);

        // Atualizar cache local
        const stmt = db.prepare(`
            INSERT OR REPLACE INTO vendas_cache 
            (unidade_codigo, categoria, mes, ano, valor_total, quantidade_total, updated_at)
            VALUES (@unidade, @categoria, @mes, @ano, @valor, @quantidade, datetime('now'))
        `);

        for (const venda of vendas) {
            stmt.run({
                unidade: venda.CD_ESTAB.toString().padStart(3, '0'),
                categoria: venda.DESCRICAO_CATEGORIA_ITEM,
                mes: mes,
                ano: ano,
                valor: venda.ValorMesSelecionado || 0,
                quantidade: venda.QtdMesSelecionado || 0
            });
        }

        console.log(`✅ Sync concluído: ${vendas.length} registros atualizados`);
        return { success: true, count: vendas.length };
    } catch (error) {
        console.error('❌ Erro no sync de vendas:', error.message);
        return { success: false, error: error.message };
    }
}

/**
 * Faz backup das metas para a tabela de histórico
 */
async function backupMetas() {
    try {
        const db = database.getDb();

        const result = db.exec(`
            INSERT INTO metas_historico 
            (unidade_codigo, mes, ano, combustiveis_litros, conveniencia_valor, trocas_valor, dayway_percent)
            SELECT unidade_codigo, mes, ano, combustiveis_litros, conveniencia_valor, trocas_valor, dayway_percent
            FROM metas
        `);

        console.log('✅ Backup de metas concluído');
        return { success: true };
    } catch (error) {
        console.error('❌ Erro no backup de metas:', error.message);
        return { success: false, error: error.message };
    }
}

/**
 * Executa sync manualmente (para uso via API)
 */
async function executarSyncManual(mes, ano) {
    try {
        const db = database.getDb();

        console.log(`🔍 Sync manual para ${mes}/${ano}...`);

        const vendas = await sqlConnection.buscarVendas(mes, ano);

        const stmt = db.prepare(`
            INSERT OR REPLACE INTO vendas_cache 
            (unidade_codigo, categoria, mes, ano, valor_total, quantidade_total, updated_at)
            VALUES (@unidade, @categoria, @mes, @ano, @valor, @quantidade, datetime('now'))
        `);

        for (const venda of vendas) {
            stmt.run({
                unidade: venda.CD_ESTAB.toString().padStart(3, '0'),
                categoria: venda.DESCRICAO_CATEGORIA_ITEM,
                mes: mes,
                ano: ano,
                valor: venda.ValorMesSelecionado || 0,
                quantidade: venda.QtdMesSelecionado || 0
            });
        }

        console.log(`✅ Sync manual concluído: ${vendas.length} registros`);
        return { success: true, count: vendas.length };
    } catch (error) {
        console.error('❌ Erro no sync manual:', error.message);
        return { success: false, error: error.message };
    }
}

module.exports = {
    start,
    syncVendas,
    backupMetas,
    executarSyncManual
};
