const Database = require('better-sqlite3');
const path = require('path');

async function migrar() {
    const dbPath = path.join(__dirname, '..', 'data', 'metas.db');
    const db = new Database(dbPath);

    console.log('Extraindo metas de Dez/2025 em diante do banco de dados local...');

    // Pega as metas recentes
    const metasRaw = db.prepare(`
        SELECT * FROM metas 
        WHERE ano >= 2026 OR (ano = 2025 AND mes >= 12)
    `).all();

    // Pega os dayways recentes para não apagar os da Lightsail (senão a API reseta para default)
    const daywaysRaw = db.prepare(`
        SELECT * FROM metas_dayway 
        WHERE ano >= 2026 OR (ano = 2025 AND mes >= 12)
    `).all();

    db.close();

    // Agrupar
    const batchMap = {};

    for (const m of metasRaw) {
        const key = `${m.unidade_codigo}_${m.mes}_${m.ano}`;
        if (!batchMap[key]) {
            batchMap[key] = {
                unidade_codigo: m.unidade_codigo,
                mes: m.mes,
                ano: m.ano
            };
        }
        
        if (m.tipo_produto === 'COMBUSTÍVEIS') batchMap[key].combustiveis_litros = m.meta;
        if (m.tipo_produto === 'CONVENIENCIA') batchMap[key].conveniencia_valor = m.meta;
        if (m.tipo_produto === 'LUBRIFICANTES') batchMap[key].trocas_valor = m.meta;
    }

    // Mescla o dayway para não zerar os que já estão na AWS!
    for (const d of daywaysRaw) {
        const key = `${d.unidade_codigo}_${d.mes}_${d.ano}`;
        if (!batchMap[key]) {
            batchMap[key] = {
                unidade_codigo: d.unidade_codigo,
                mes: d.mes,
                ano: d.ano
            };
        }
        batchMap[key].dayway_percent = d.dayway_percent;
        batchMap[key].atual_dayway_percent = d.atual_dayway_percent;
    }

    const payload = Object.values(batchMap);
    console.log(`Encontrados ${payload.length} blocos de metas mensais por unidade para migrar!`);

    if (payload.length === 0) {
        console.log('Nenhuma meta recente encontrada para enviar.');
        return;
    }

    console.log('Enviando para a AWS Lightsail...');
    // Lê o .env local para usar a variavel AWS_URL já configurada (http://3.239.244.231:3000)
    require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
    const AWS_URL = process.env.AWS_URL || 'http://3.239.244.231:3000';

    try {
        const res = await fetch(`${AWS_URL}/api/metas/batch`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ metas: payload })
        });
        
        const data = await res.json();
        if (data.success) {
            console.log('✅ SUCESSO! Todas as metas e porcentagens DayWay recentes foram inseridas na Lightsail!');
            console.log('Você já pode verificar o painel e em seguida desligar o ngrok se quiser.');
        } else {
            console.log('❌ Erro da API Lightsail:', data.error);
        }
    } catch (e) {
        console.log('❌ Erro de conexão com a AWS:', e.message);
    }
}

migrar();
