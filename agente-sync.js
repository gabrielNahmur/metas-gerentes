require('dotenv').config();
const sqlConnection = require('./backend/sql-connection');

// Configurações
const AWS_URL = process.env.AWS_URL || 'http://3.239.244.231:3000';
const SYNC_TOKEN = 'GBI-AWS-SYNC-2026'; // Deve bater com o definido na AWS

async function sincronizarPeriodo(mes, ano) {
    console.log(`📡 Consultando SQL Server local (Mês: ${mes}/${ano})...`);
    const dadosSQL = await sqlConnection.buscarVendas(mes, ano);

    if (!dadosSQL || dadosSQL.length === 0) {
        console.log(`⚠️ Nenhuma venda encontrada no SQL para ${mes}/${ano}.`);
        return [];
    }

    return dadosSQL.map(v => ({
        mes: mes,
        ano: ano,
        unidade_codigo: v.CD_ESTAB.toString().padStart(3, '0'),
        categoria: v.DESCRICAO_CATEGORIA_ITEM,
        valor_total: v.ValorMesSelecionado || 0,
        quantidade_total: v.QtdMesSelecionado || 0
    }));
}

async function rodarSincronia() {
    console.log(`[${new Date().toLocaleString()}] 🔄 Iniciando Sincronização Local -> AWS...`);

    try {
        const hoje = new Date();
        const mesAtual = hoje.getMonth() + 1;
        const anoAtual = hoje.getFullYear();

        const llmMes = mesAtual === 1 ? 12 : mesAtual - 1;
        const llmAno = mesAtual === 1 ? anoAtual - 1 : anoAtual;

        const yoyMes = mesAtual;
        const yoyAno = anoAtual - 1;

        // Extrair vendas dos 3 períodos necessários
        const vendasAtual = await sincronizarPeriodo(mesAtual, anoAtual);
        const vendasLlm = await sincronizarPeriodo(llmMes, llmAno);
        const vendasYoy = await sincronizarPeriodo(yoyMes, yoyAno);

        const payloadVendas = [...vendasAtual, ...vendasLlm, ...vendasYoy];

        if (payloadVendas.length === 0) {
            console.log('⚠️ Nenhum dado retornado para envios.');
            return;
        }

        console.log(`📊 ${payloadVendas.length} registros no total. Preparando envio para AWS...`);

        // 2. Enviar POST via HTTP para a Amazon Lightsail
        const resposta = await fetch(`${AWS_URL}/api/vendas/upload_sync`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                token: SYNC_TOKEN,
                vendas: payloadVendas
            })
        });

        const resultado = await resposta.json();

        if (resultado.success) {
            console.log(`✅ Sucesso! A AWS confirmou recebimento: ${resultado.message} (${resultado.count} itens)`);
        } else {
            console.error('❌ A AWS recusou o envio:', resultado.message || resultado.error);
        }

    } catch (error) {
        console.error('❌ Falha crítica no agente:', error.message);
    } finally {
        await sqlConnection.close();
        console.log(`[${new Date().toLocaleString()}] 🏁 Fim do processo.`);
        process.exit(0);
    }
}

// Iniciar
rodarSincronia();
