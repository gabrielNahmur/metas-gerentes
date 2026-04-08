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

        const payloadVendas = [];

        // Puxar os dados históricos de até 24 meses atrás (2 anos)
        // Isso garante que tabelas anuais e relatórios fiquem sempre cheios.
        for (let i = 0; i <= 24; i++) {
            // Calcular mês e ano retroativo
            const dataConsulta = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
            const refMes = dataConsulta.getMonth() + 1;
            const refAno = dataConsulta.getFullYear();

            const vendasPeriodo = await sincronizarPeriodo(refMes, refAno);
            payloadVendas.push(...vendasPeriodo);
        }

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
