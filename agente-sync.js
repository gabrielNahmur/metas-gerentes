require('dotenv').config();
const sqlConnection = require('./backend/sql-connection');

// Configurações
const AWS_URL = process.env.AWS_URL || 'http://3.239.244.231:3000';
const SYNC_TOKEN = 'GBI-AWS-SYNC-2026'; // Deve bater com o definido na AWS

async function rodarSincronia() {
    console.log(`[${new Date().toLocaleString()}] 🔄 Iniciando Sincronização Local -> AWS...`);

    try {
        const hoje = new Date();
        const mesAtual = hoje.getMonth() + 1;
        const anoAtual = hoje.getFullYear();

        // 1. Extrair vendas do SQL local
        console.log(`📡 Consultando SQL Server local (Mês: ${mesAtual}/${anoAtual})...`);
        const dadosSQL = await sqlConnection.buscarVendas(mesAtual, anoAtual);

        if (!dadosSQL || dadosSQL.length === 0) {
            console.log('⚠️ Nenhuma venda encontrada no SQL para este período.');
            return;
        }

        console.log(`📊 ${dadosSQL.length} registros encontrados. Preparando envio para AWS...`);

        // Formatar os dados para coincidir com a estrutura da tabela vendas_cache
        const payloadVendas = dadosSQL.map(v => ({
            mes: mesAtual,
            ano: anoAtual,
            unidade_codigo: v.CD_ESTAB.toString().padStart(3, '0'),
            categoria: v.DESCRICAO_CATEGORIA_ITEM,
            valor_total: v.ValorMesSelecionado || 0,
            quantidade_total: v.QtdMesSelecionado || 0
        }));

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
